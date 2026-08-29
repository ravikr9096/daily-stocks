import os
import time
import asyncio
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from curl_cffi.requests import AsyncSession
import yfinance as yf

# Global state for AsyncSession and Lock
nse_session = None
session_lock = asyncio.Lock()

# In-memory caches to guarantee fast response times
CACHE_TTL_SECONDS = 30
_stocks_cache = {"data": None, "timestamp": 0}
_sectors_cache = {"data": None, "timestamp": 0}

# Sector indices mapping for Yahoo Finance fallback
SECTOR_MAP = {
    "^NSEBANK": "NIFTY BANK",
    "^CNXIT": "NIFTY IT",
    "^CNXAUTO": "NIFTY AUTO",
    "^CNXMETAL": "NIFTY METAL",
    "^CNXPHARMA": "NIFTY PHARMA",
    "^CNXFMCG": "NIFTY FMCG",
    "^CNXREALTY": "NIFTY REALTY",
    "^CNXENERGY": "NIFTY ENERGY",
    "^CNXINFRA": "NIFTY INFRA",
    "^CNXMEDIA": "NIFTY MEDIA",
    "^CNXPSUBANK": "NIFTY PSU BANK",
}

# Complete universe of NSE F&O stock symbols
FNO_SYMBOLS = [
    "ATHERENERG", "BSE", "COALINDIA", "ICICIBANK", "HDFCBANK", "BHARTIARTL", "TVSMOTOR", "INFY", "COFORGE",
    "SAIL", "TCS", "RELIANCE", "KOTAKBANK", "TATASTEEL", "DIVISLAB", "LICI", "M&M", "ADANIPORTS", "PERSISTENT",
    "VEDL", "TECHM", "IDEA", "LTM", "OFSS", "SBIN", "KALYANKJIL", "BAJFINANCE", "HCLTECH", "MCX", "LAURUSLABS",
    "AXISBANK", "ITC", "HINDZINC", "MARUTI", "LT", "KPITTECH", "DIXON", "VBL", "BEL", "BAJAJ-AUTO", "PAYTM",
    "ADANIPOWER", "TITAN", "SAGILITY", "APOLLOHOSP", "ULTRACEMCO", "EICHERMOT", "KAYNES", "WIPRO", "SOLARINDS",
    "ADANIENSOL", "CAMS", "BHEL", "NAUKRI", "NTPC", "SHRIRAMFIN", "MPHASIS", "HAL", "APLAPOLLO", "PREMIERENE",
    "GMRAIRPORT", "HEROMOTOCO", "POLYCAB", "INDHOTEL", "PFC", "CONCOR", "GRASIM", "SUNPHARMA", "LICHSGFIN",
    "HAVELLS", "AMBER", "BDL", "ASHOKLEY", "MARICO", "GLENMARK", "CUMMINSIND", "CGPOWER", "HYUNDAI",
    "HINDUNILVR", "JSWSTEEL", "MAXHEALTH", "SBILIFE", "CANBK", "ONGC", "KEI", "HINDALCO", "JIOFIN", "ADANIENT",
    "ZYDUSLIFE", "TATAPOWER", "BPCL", "HDFCAMC", "CHOLAFIN", "GAIL", "CDSL", "YESBANK", "MOTHERSON", "RECLTD",
    "SONACOMS", "SWIGGY", "FORTIS", "POWERGRID", "TRENT", "ICICIGI", "INDIGO", "CROMPTON", "BRITANNIA",
    "WAAREEENER", "BOSCHLTD", "ASIANPAINT", "LODHA", "MUTHOOTFIN", "ALKEM", "NMDC", "IDFCFIRSTB", "FEDERALBNK",
    "HINDPETRO", "SIEMENS", "HDFCLIFE", "SUZLON", "TATAELXSI", "POWERINDIA", "ASTRAL", "DMART", "INDUSINDBK",
    "ADANIGREEN", "TATACONSUM", "MAZDOCK", "SUPREMEIND", "PNB", "AUBANK", "BAJAJFINSV", "UNITDSPR", "TORNTPHARM",
    "OIL", "VOLTAS", "LTF", "BIOCON", "SBICARD", "AMBUJACEM", "BANKBARODA", "GODREJCP", "ANGELONE", "MAHABANK",
    "ICICIPRULI", "DRREDDY", "AUROPHARMA", "JINDALSTEL", "LUPIN", "DABUR", "ABB", "BHARATFORG", "NATIONALUM",
    "PIDILITIND", "NHPC", "DLF", "UNOMINDA", "FORCEMOT", "UPL", "GODREJPROP", "BANKINDIA", "UNIONBANK",
    "DELHIVERY", "MANAPPURAM", "RADICO", "NESTLEIND", "COCHINSHIP", "RVNL", "POLICYBZR", "PIIND", "NAM-INDIA",
    "NBCC", "INDUSTOWER", "BANDHANBNK", "IRFC", "MOTILALOFS", "JUBLFOOD", "KFINTECH", "IOC", "JSWENERGY",
    "CIPLA", "IREDA", "COLPAL", "NYKAA", "PNBHOUSING", "360ONE", "INOXWIND", "ABCAPITAL", "OBEROIRLTY",
    "PHOENIXLTD", "SHREECEM", "MFSL", "PAGEIND", "MANKIND", "PRESTIGE", "BLUESTARCO", "INDIANB", "SRF",
    "PATANJALI", "RBLBANK", "BAJAJHLDNG", "TIINDIA", "PETRONET", "PGEL", "GODFRYPHLP", "IEX"
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global nse_session
    custom_headers = {
        "Referer": "https://www.nseindia.com/market-data/live-equity-market",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        nse_session = AsyncSession(impersonate="chrome120", headers=custom_headers)
        await refresh_nse_session()
    except Exception as e:
        print(f"Session initialization note: {e}")

    yield

    if nse_session:
        try:
            await nse_session.close()
        except Exception:
            pass

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
    if not nse_session:
        return
    async with session_lock:
        try:
            await nse_session.get("https://www.nseindia.com", timeout=10)
            await asyncio.sleep(1)
            print("Successfully refreshed NSE session cookies.")
        except Exception as e:
            print(f"NSE cookie refresh note (expected on cloud IPs): {e}")

def fetch_stocks_yf():
    """Fallback fetcher using Yahoo Finance in parallel threads"""
    def fetch_single(sym):
        try:
            t = yf.Ticker(f"{sym}.NS")
            fi = t.fast_info
            last = fi.last_price
            prev = fi.previous_close
            if last is not None and prev is not None and prev > 0:
                pChange = round(((last - prev) / prev) * 100, 2)
                return {
                    "symbol": sym,
                    "lastPrice": round(last, 2),
                    "change": round(last - prev, 2),
                    "pChange": pChange,
                    "open": round(fi.open if fi.open else last, 2),
                    "dayHigh": round(fi.day_high if fi.day_high else last, 2),
                    "dayLow": round(fi.day_low if fi.day_low else last, 2),
                    "previousClose": round(prev, 2),
                }
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=30) as executor:
        results = [r for r in executor.map(fetch_single, FNO_SYMBOLS) if r is not None]

    if not results:
        return None

    advances = sum(1 for s in results if s["pChange"] > 0)
    declines = sum(1 for s in results if s["pChange"] < 0)
    unchanged = sum(1 for s in results if s["pChange"] == 0)

    sorted_data = sorted(results, key=lambda x: x["pChange"])

    return {
        "advance": {
            "advances": advances,
            "declines": declines,
            "unchanged": unchanged
        },
        "top-gainer": sorted_data[-7:][::-1],
        "top-losers": sorted_data[:7]
    }

def fetch_sectors_yf():
    """Fallback fetcher for sectoral indices using Yahoo Finance"""
    def fetch_single(sym):
        try:
            t = yf.Ticker(sym)
            fi = t.fast_info
            last = fi.last_price
            prev = fi.previous_close
            if last is not None and prev is not None and prev > 0:
                pChange = round(((last - prev) / prev) * 100, 2)
                return {
                    "index": SECTOR_MAP[sym],
                    "percentChange": pChange,
                    "last": round(last, 2)
                }
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=12) as executor:
        results = [r for r in executor.map(fetch_single, SECTOR_MAP.keys()) if r is not None]

    if not results:
        return None

    sorted_data = sorted(results, key=lambda x: x["percentChange"])

    return {
        "top-gainer": sorted_data[-5:][::-1],
        "top-losers": sorted_data[:5]
    }

@app.get("/api/hello")
async def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/api/stocks")
async def get_stocks():
    now = time.time()
    # Check cache first
    if _stocks_cache["data"] and (now - _stocks_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _stocks_cache["data"]

    # 1. Attempt NSE direct fetch
    if nse_session:
        try:
            url = "https://www.nseindia.com/api/equity-stockIndex?index=SECURITIES%20IN%20F%26O"
            response = await nse_session.get(url, timeout=6)
            if response.status_code in [401, 403]:
                await refresh_nse_session()
                response = await nse_session.get(url, timeout=6)

            if response.status_code == 200:
                nse_data = response.json()
                raw_data = nse_data.get("data", [])
                advance = nse_data.get("advance", {})
                sorted_data = sorted(raw_data, key=lambda x: float(x.get("pChange", 0) or 0))

                result = {
                    "advance": advance,
                    "top-gainer": sorted_data[-7:][::-1],
                    "top-losers": sorted_data[:7]
                }
                _stocks_cache["data"] = result
                _stocks_cache["timestamp"] = now
                return result
        except Exception as e:
            print(f"NSE fetch error, falling back to Yahoo Finance: {e}")

    # 2. Seamless Yahoo Finance Fallback (handles cloud IPs like Render/AWS)
    try:
        yf_data = await asyncio.to_thread(fetch_stocks_yf)
        if yf_data:
            _stocks_cache["data"] = yf_data
            _stocks_cache["timestamp"] = now
            return yf_data
    except Exception as e:
        print(f"Yahoo Finance stock fetch error: {e}")

    # 3. Return stale cache if available or raise
    if _stocks_cache["data"]:
        return _stocks_cache["data"]

    raise HTTPException(status_code=503, detail="Unable to retrieve stock data from upstream providers.")

@app.get("/api/sector-performance")
async def get_sector_performance():
    now = time.time()
    # Check cache first
    if _sectors_cache["data"] and (now - _sectors_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _sectors_cache["data"]

    # 1. Attempt NSE direct fetch
    if nse_session:
        try:
            url = "https://www.nseindia.com/api/allIndices"
            response = await nse_session.get(url, timeout=6)
            if response.status_code in [401, 403]:
                await refresh_nse_session()
                response = await nse_session.get(url, timeout=6)

            if response.status_code == 200:
                nse_data = response.json()
                all_indices = nse_data.get("data", [])
                sectoral_indices_data = [
                    index for index in all_indices if index.get("key") == "SECTORAL INDICES"
                ]
                sorted_data = sorted(sectoral_indices_data, key=lambda x: float(x.get("percentChange", 0) or 0))

                result = {
                    "top-gainer": sorted_data[-5:][::-1],
                    "top-losers": sorted_data[:5]
                }
                _sectors_cache["data"] = result
                _sectors_cache["timestamp"] = now
                return result
        except Exception as e:
            print(f"NSE sector fetch error, falling back to Yahoo Finance: {e}")

    # 2. Seamless Yahoo Finance Fallback
    try:
        yf_data = await asyncio.to_thread(fetch_sectors_yf)
        if yf_data:
            _sectors_cache["data"] = yf_data
            _sectors_cache["timestamp"] = now
            return yf_data
    except Exception as e:
        print(f"Yahoo Finance sector fetch error: {e}")

    # 3. Return stale cache if available or raise
    if _sectors_cache["data"]:
        return _sectors_cache["data"]

    raise HTTPException(status_code=503, detail="Unable to retrieve sector data from upstream providers.")

@app.get("/api/candles/{symbol}")
async def get_candles(symbol: str):
    try:
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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount the React build (dist) folder to serve the UI
ui_dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "dist")
if os.path.exists(ui_dist_path):
    app.mount("/", StaticFiles(directory=ui_dist_path, html=True), name="ui")