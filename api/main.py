import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import requests
import yfinance as yf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/hello")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/stocks")
def get_stocks():
    url = "https://www.nseindia.com/api/equity-stockIndex?index=SECURITIES%20IN%20F%26O"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        # NSE requires a valid session cookie, so we visit the home page first
        session.get("https://www.nseindia.com", timeout=10)
        
        response = session.get(url, timeout=10)
        response.raise_for_status()
        nse_data = response.json()
        
        raw_data = nse_data.get("data", [])
        advance = nse_data.get("advance", {})
        
        # Safely parse percentage change and sort the stock data
        sorted_data = sorted(raw_data, key=lambda x: float(x.get("pChange", 0) or 0))
        
        return {
            "advance": advance,
            "top-gainer": sorted_data[-5:][::-1], # Last 5 items, reversed for highest to lowest
            "top-losers": sorted_data[:5]         # First 5 items (lowest to highest)
        }
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/candles/{symbol}")
def get_candles(symbol: str):
    try:
        # Append .NS to fetch the stock from the National Stock Exchange
        ticker = yf.Ticker(f"{symbol.upper()}.NS")
        
        # Fetch today's data with 5-minute intervals
        df = ticker.history(period="1d", interval="5m")
        
        if df.empty:
            return {"error": f"No data found for symbol {symbol}"}
            
        df = df.reset_index()
        
        candles = []
        for _, row in df.iterrows():
            candles.append({
                "timestamp": row["Datetime"].isoformat(),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"])
            })
            
        return {"symbol": symbol, "candles": candles}
        
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/sector-performance")
def get_sector_performance():
    url = "https://www.nseindia.com/api/allIndices"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    try:
        # NSE requires a valid session cookie, so we visit the home page first
        session.get("https://www.nseindia.com", timeout=10)
        
        response = session.get(url, timeout=10)
        response.raise_for_status()
        nse_data = response.json()
        
        all_indices = nse_data.get("data", [])
        
        # Filter for sectoral indices based on the 'key'
        sectoral_indices_data = [
            index for index in all_indices if index.get("key") == "SECTORAL INDICES"
        ]
        
        # Safely parse percentage change and sort the sectoral indices
        sorted_data = sorted(sectoral_indices_data, key=lambda x: float(x.get("percentChange", 0) or 0))
        
        return {
            "top-gainer": sorted_data[-5:][::-1], # Last 5 items, reversed for highest to lowest
            "top-losers": sorted_data[:5]         # First 5 items (lowest to highest)
        }
        
    except Exception as e:
        return {"error": str(e)}

# Mount the React build (dist) folder to serve the UI
ui_dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "dist")
if os.path.exists(ui_dist_path):
    app.mount("/", StaticFiles(directory=ui_dist_path, html=True), name="ui")
