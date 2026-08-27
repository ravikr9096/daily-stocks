import os
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from curl_cffi import requests
import yfinance as yf

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Define strict browser headers
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/market-data/live-equity-market"
}

# 2. Create a global session to persist cookies and use TLS impersonation
nse_session = requests.Session(impersonate="chrome120")
nse_session.headers.update(headers)

def refresh_nse_session():
    """Helper to fetch fresh cookies from the homepage"""
    try:
        nse_session.get("https://www.nseindia.com", timeout=10)
        time.sleep(1) # Brief pause to mimic human transition
        print("Successfully refreshed NSE session cookies.")
    except Exception as e:
        print(f"Failed to fetch cookies: {e}")

# Fetch cookies once on startup
refresh_nse_session()

@app.get("/api/hello")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/stocks")
def get_stocks():
    url = "https://www.nseindia.com/api/equity-stockIndex?index=SECURITIES%20IN%20F%26O"
    
    try:
        # Use the global session, do NOT hit the homepage here
        response = nse_session.get(url, timeout=10)
        
        # If the session expired and we got a 401/403, refresh cookies and retry ONCE
        if response.status_code in [401, 403]:
            refresh_nse_session()
            response = nse_session.get(url, timeout=10)
            
        if response.status_code != 200:
            return {"error": f"Failed to fetch data. Status code: {response.status_code}"}
            
        nse_data = response.json()
        
        raw_data = nse_data.get("data", [])
        advance = nse_data.get("advance", {})
        
        # Safely parse percentage change and sort the stock data
        sorted_data = sorted(raw_data, key=lambda x: float(x.get("pChange", 0) or 0))
        
        return {
            "advance": advance,
            "top-gainer": sorted_data[-7:][::-1], # Last 7 items, reversed for highest to lowest
            "top-losers": sorted_data[:7]         # First 7 items (lowest to highest)
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
    
    try:
        # Use the global session
        response = nse_session.get(url, timeout=10)
        
        # Handle expired cookies
        if response.status_code in [401, 403]:
            refresh_nse_session()
            response = nse_session.get(url, timeout=10)
            
        if response.status_code != 200:
            return {"error": f"Failed to fetch data. Status code: {response.status_code}"}
            
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