import os
import time
import asyncio
from datetime import datetime
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from curl_cffi.requests import AsyncSession
import requests

# Global state for AsyncSession (NSE direct) and Lock
nse_session = None
session_lock = asyncio.Lock()

# In-memory caches to minimize CPU, memory, and upstream latency
CACHE_TTL_SECONDS = 30
_stocks_cache = {"data": None, "timestamp": 0}
_sectors_cache = {"data": None, "timestamp": 0}
_candles_cache = {}

# Sector indices mapping
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

class LightweightYahooClient:
    """Ultra-low-memory Yahoo Finance client (< 2MB RAM) using batch endpoints."""
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        self.crumb = None
        self.crumb_fetched_at = 0

    def _ensure_crumb(self):
        now = time.time()
        if self.crumb and (now - self.crumb_fetched_at < 3600):
            return
        try:
            self.session.get("https://fc.yahoo.com", timeout=4)
        except Exception:
            pass
        try:
            r = self.session.get("https://query1.finance.yahoo.com/v1/test/getcrumb", timeout=4)
            if r.status_code == 200 and r.text.strip():
                self.crumb = r.text.strip()
                self.crumb_fetched_at = now
        except Exception as e:
            print(f"Crumb refresh note: {e}")

    def get_quotes(self, symbols):
        self._ensure_crumb()
        quotes = []
        chunk_size = 40
        for i in range(0, len(symbols), chunk_size):
            chunk = symbols[i:i + chunk_size]
            syms_str = ",".join(chunk)
            crumb_param = f"&crumb={self.crumb}" if self.crumb else ""
            url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={syms_str}{crumb_param}"
            try:
                r = self.session.get(url, timeout=5)
                if r.status_code == 200:
                    quotes.extend(r.json().get("quoteResponse", {}).get("result", []))
                elif r.status_code in [401, 403]:
                    self.crumb = None
                    self._ensure_crumb()
            except Exception:
                pass
        return quotes

    def get_candles(self, symbol):
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol.upper()}.NS?interval=5m&range=1d"
        r = self.session.get(url, timeout=6)
        if r.status_code != 200:
            return []
        data = r.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return []
        res = result[0]
        timestamps = res.get("timestamp", [])
        quote = res.get("indicators", {}).get("quote", [{}])[0]
        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        candles = []
        for i in range(len(timestamps)):
            o = opens[i] if i < len(opens) else None
            h = highs[i] if i < len(highs) else None
            l = lows[i] if i < len(lows) else None
            c = closes[i] if i < len(closes) else None
            v = volumes[i] if i < len(volumes) else None
            if o is None or c is None:
                continue
            candles.append({
                "timestamp": datetime.fromtimestamp(timestamps[i]).isoformat(),
                "open": round(o, 2),
                "high": round(h, 2),
                "low": round(l, 2),
                "close": round(c, 2),
                "volume": int(v or 0)
            })
        return candles

yf_client = LightweightYahooClient()

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
        print(f"NSE session init note: {e}")

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
    if not nse_session:
        return
    async with session_lock:
        try:
            await nse_session.get("https://www.nseindia.com", timeout=8)
            await asyncio.sleep(1)
        except Exception:
            pass

def fetch_stocks_yf():
    """Low-memory batch stock quotes fetcher (< 1.5MB RAM)"""
    yf_symbols = [f"{sym}.NS" for sym in FNO_SYMBOLS]
    quotes = yf_client.get_quotes(yf_symbols)
    if not quotes:
        return None

    results = []
    advances = 0
    declines = 0
    unchanged = 0

    for q in quotes:
        raw_sym = q.get("symbol", "").replace(".NS", "")
        pChange = round(q.get("regularMarketChangePercent", 0) or 0, 2)
        lastPrice = round(q.get("regularMarketPrice", 0) or 0, 2)
        change = round(q.get("regularMarketChange", 0) or 0, 2)
        results.append({
            "symbol": raw_sym,
            "pChange": pChange,
            "lastPrice": lastPrice,
            "change": change,
            "open": round(q.get("regularMarketOpen", 0) or 0, 2),
            "dayHigh": round(q.get("regularMarketDayHigh", 0) or 0, 2),
            "dayLow": round(q.get("regularMarketDayLow", 0) or 0, 2),
            "previousClose": round(q.get("regularMarketPreviousClose", 0) or 0, 2)
        })
        if pChange > 0:
            advances += 1
        elif pChange < 0:
            declines += 1
        else:
            unchanged += 1

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
    """Low-memory sectoral indices fetcher (< 0.5MB RAM)"""
    symbols = list(SECTOR_MAP.keys())
    quotes = yf_client.get_quotes(symbols)
    if not quotes:
        return None

    results = []
    for q in quotes:
        sym = q.get("symbol")
        if sym in SECTOR_MAP:
            pChange = round(q.get("regularMarketChangePercent", 0) or 0, 2)
            last = round(q.get("regularMarketPrice", 0) or 0, 2)
            results.append({
                "index": SECTOR_MAP[sym],
                "percentChange": pChange,
                "last": last
            })

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
    # Return cache if still fresh
    if _stocks_cache["data"] and (now - _stocks_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _stocks_cache["data"]

    # 1. Direct NSE attempt
    if nse_session:
        try:
            url = "https://www.nseindia.com/api/equity-stockIndex?index=SECURITIES%20IN%20F%26O"
            response = await nse_session.get(url, timeout=5)
            if response.status_code in [401, 403]:
                await refresh_nse_session()
                response = await nse_session.get(url, timeout=5)

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
        except Exception:
            pass

    # 2. Ultra-lightweight fallback
    try:
        yf_data = await asyncio.to_thread(fetch_stocks_yf)
        if yf_data:
            _stocks_cache["data"] = yf_data
            _stocks_cache["timestamp"] = now
            return yf_data
    except Exception as e:
        print(f"Fallback stock fetch error: {e}")

    if _stocks_cache["data"]:
        return _stocks_cache["data"]

    raise HTTPException(status_code=503, detail="Unable to retrieve stock data.")

@app.get("/api/sector-performance")
async def get_sector_performance():
    now = time.time()
    if _sectors_cache["data"] and (now - _sectors_cache["timestamp"] < CACHE_TTL_SECONDS):
        return _sectors_cache["data"]

    # 1. Direct NSE attempt
    if nse_session:
        try:
            url = "https://www.nseindia.com/api/allIndices"
            response = await nse_session.get(url, timeout=5)
            if response.status_code in [401, 403]:
                await refresh_nse_session()
                response = await nse_session.get(url, timeout=5)

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
        except Exception:
            pass

    # 2. Ultra-lightweight fallback
    try:
        yf_data = await asyncio.to_thread(fetch_sectors_yf)
        if yf_data:
            _sectors_cache["data"] = yf_data
            _sectors_cache["timestamp"] = now
            return yf_data
    except Exception as e:
        print(f"Fallback sector fetch error: {e}")

    if _sectors_cache["data"]:
        return _sectors_cache["data"]

    raise HTTPException(status_code=503, detail="Unable to retrieve sector data.")

@app.get("/api/candles/{symbol}")
async def get_candles(symbol: str):
    now = time.time()
    cached = _candles_cache.get(symbol)
    if cached and (now - cached["timestamp"] < 15):
        return {"symbol": symbol, "candles": cached["candles"]}

    try:
        candles = await asyncio.to_thread(yf_client.get_candles, symbol)
        if not candles:
            if cached:
                return {"symbol": symbol, "candles": cached["candles"]}
            raise HTTPException(status_code=404, detail=f"No candle data for {symbol}")

        _candles_cache[symbol] = {"candles": candles, "timestamp": now}
        return {"symbol": symbol, "candles": candles}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount UI static files if present
ui_dist_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ui", "dist")
if os.path.exists(ui_dist_path):
    app.mount("/", StaticFiles(directory=ui_dist_path, html=True), name="ui")