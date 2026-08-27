import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from curl_cffi.requests import AsyncSession
import yfinance as yf

# 1. Global state for AsyncSession and Lock
nse_session = None
session_lock = asyncio.Lock()

# 2. Use Lifespan to initialize the session and fetch initial cookies safely
@asynccontextmanager
async def lifespan(app: FastAPI):
    global nse_session
    # Do NOT override User-Agent. Let impersonate handle it to match TLS fingerprints.
    # Only add headers that don't conflict with browser defaults.
    custom_headers = {
        "Referer": "https://www.nseindia.com/market-data/live-equity-market"
    }
    nse_session = AsyncSession(impersonate="chrome120", headers=custom_headers)
    
    await refresh_nse_session()
    yield
    # Cleanup on shutdown
    if nse_session:
        await nse_session.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def refresh_nse_session():
    """Helper to fetch fresh cookies with a concurrency lock"""
    # 3. Prevent multiple concurrent requests from spamming the homepage
    async with session_lock:
        try:
            await nse_session.get("https://www.nseindia.com", timeout=10)
            await asyncio.sleep(1) # Brief pause to mimic human transition
            print("Successfully refreshed NSE session cookies.")
        except Exception as e:
            print(f"Failed to fetch cookies: {e}")

@app.get("/api/hello")
async def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/stocks")
async def get_stocks():
    url = "https://www.nseindia.com/api/equity-stockIndex?index=SECURITIES%20IN%20F%26O"
    
    try:
        response = await nse_session.get(url, timeout=10)
        
        if response.status_code in [401, 403]:
            await refresh_nse_session()
            response = await nse_session.get(url, timeout=10)
            
        if response.status_code != 200:
            # 4. Raise proper HTTP exceptions instead of returning 200 OK with error strings
            raise HTTPException(status_code=502, detail=f"NSE API failed with status: {response.status_code}")
            
        nse_data = response.json()
        raw_data = nse_data.get("data", [])
        advance = nse_data.get("advance", {})
        
        sorted_data = sorted(raw_data, key=lambda x: float(x.get("pChange", 0) or 0))
        
        return {
            "advance": advance,
            "top-gainer": sorted_data[-7:][::-1], 
            "top-losers": sorted_data[:7]        
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/candles/{symbol}")
async def get_candles(symbol: str):
    try:
        # 5. yfinance is synchronous. Use asyncio.to_thread to prevent it from blocking the FastAPI event loop.
        def fetch_yf_data():
            ticker = yf.Ticker(f"{symbol.upper()}.NS")
            return ticker.history(period="1d", interval="5m")
            
        df = await asyncio.to_thread(fetch_yf_data)
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data found for symbol {symbol}")
            
        df = df.reset_index()
        
        candles = [
            {
                "timestamp": row["Datetime"].isoformat(),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"])
            }
            for _, row in df.iterrows()
        ]
            
        return {"symbol": symbol, "candles": candles}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sector-performance")
async def get_sector_performance():
    url = "https://www.nseindia.com/api/allIndices"
    
    try:
        response = await nse_session.get(url, timeout=10)
        
        if response.status_code in [401, 403]:
            await refresh_nse_session()
            response = await nse_session.get(url, timeout=10)
            
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"NSE API failed with status: {response.status_code}")
            
        nse_data = response.json()
        all_indices = nse_data.get("data", [])
        
        sectoral_indices_data = [
            index for index in all_indices if index.get("key") == "SECTORAL INDICES"
        ]
        
        sorted_data = sorted(sectoral_indices_data, key=lambda x: float(x.get("percentChange", 0) or 0))
        
        return {
            "top-gainer": sorted_data[-5:][::-1],
            "top-losers": sorted_data[:5]        
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount the React build (dist) folder to serve the UI
ui_dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "dist")
if os.path.exists(ui_dist_path):
    app.mount("/", StaticFiles(directory=ui_dist_path, html=True), name="ui")