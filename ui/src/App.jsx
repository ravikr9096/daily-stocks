import { useState, useCallback } from 'react'
import './App.css'
import StockChart from './StockChart'
import StockList from './StockList'
import SectorList from './SectorList'
import { useMarketData } from './useMarketData'

function formatLastUpdated(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function MarketBreadth({ advance }) {
  const advances = advance?.advances ?? 0;
  const declines = advance?.declines ?? 0;
  const unchanged = advance?.unchanged ?? 0;
  const total = advances + declines + unchanged || 1;

  return (
    <div className="card breadth-card">
      <div className="card-header">
        <h3 className="card-title">
          <span className="card-title-dot card-title-dot--neutral" />
          Market Breadth
        </h3>
        <span className="card-count">{total} stocks</span>
      </div>

      <div className="breadth-stats">
        <div className="breadth-stat">
          <div className="breadth-stat-label">Advances</div>
          <div className="breadth-stat-value breadth-stat-value--gain">{advances}</div>
        </div>
        <div className="breadth-stat">
          <div className="breadth-stat-label">Declines</div>
          <div className="breadth-stat-value breadth-stat-value--loss">{declines}</div>
        </div>
        <div className="breadth-stat">
          <div className="breadth-stat-label">Unchanged</div>
          <div className="breadth-stat-value breadth-stat-value--neutral">{unchanged}</div>
        </div>
      </div>

      <div className="breadth-bar">
        <div
          className="breadth-bar-segment breadth-bar-segment--gain"
          style={{ width: `${(advances / total) * 100}%` }}
        />
        <div
          className="breadth-bar-segment breadth-bar-segment--neutral"
          style={{ width: `${(unchanged / total) * 100}%` }}
        />
        <div
          className="breadth-bar-segment breadth-bar-segment--loss"
          style={{ width: `${(declines / total) * 100}%` }}
        />
      </div>
      <div className="breadth-ratio">
        <span>{Math.round((advances / total) * 100)}% advancing</span>
        <span>{Math.round((declines / total) * 100)}% declining</span>
      </div>
    </div>
  );
}

function App() {
  const { marketData, loading, error, lastFetchTime, forceRefresh } = useMarketData();
  const [modalData, setModalData] = useState({ symbol: null, type: null })
  const [maxLoss, setMaxLoss] = useState(1500)
  const [totalCapital, setTotalCapital] = useState(20000)
  const [lowVolBarsBefore, setLowVolBarsBefore] = useState(2)

  const handleMaxLossChange = useCallback((e) => {
    setMaxLoss(Number(e.target.value));
  }, []);

  const handleTotalCapitalChange = useCallback((e) => {
    setTotalCapital(Number(e.target.value));
  }, []);

  const handleStockClick = useCallback((symbol, type) => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;
    setModalData({ symbol, type });
  }, []);

  const handleLowVolBarsBeforeChange = useCallback((e) => {
    setLowVolBarsBefore(Number(e.target.value));
  }, []);

  const { stocksData, sectorData } = marketData || {};

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <h1 className="header-title">
            <span className="header-title-icon">DS</span>
            Daily Stocks
          </h1>
          <div className="header-meta">
            <span className="header-subtitle">NSE F&O — Top movers & sector performance</span>
            {lastFetchTime && (
              <span>Updated {formatLastUpdated(lastFetchTime)}</span>
            )}
            <span className={`live-badge ${loading ? 'loading' : ''}`}>
              <span className="live-dot" />
              {loading ? 'Syncing' : 'Live'}
            </span>
          </div>
        </div>

        <div className="controls-panel">
          <div className="control-group">
            <label htmlFor="max-loss">Max Loss (₹)</label>
            <input
              id="max-loss"
              className="control-input"
              type="number"
              value={maxLoss}
              onChange={handleMaxLossChange}
            />
          </div>
          <div className="control-group">
            <label htmlFor="total-capital">Capital (₹)</label>
            <input
              id="total-capital"
              className="control-input"
              type="number"
              value={totalCapital}
              onChange={handleTotalCapitalChange}
            />
          </div>
          <div className="control-group">
            <label htmlFor="low-vol-bars-before">Low Vol Bars</label>
            <input
              id="low-vol-bars-before"
              className="control-input control-input--narrow"
              type="number"
              value={lowVolBarsBefore}
              onChange={handleLowVolBarsBeforeChange}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={forceRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {loading && !marketData && (
        <div className="loading-skeleton">
          <div className="skeleton-card" />
          <div className="row">
            <div className="skeleton-card" style={{ flex: 1 }} />
            <div className="skeleton-card" style={{ flex: 1 }} />
          </div>
          <div className="skeleton-card skeleton-card--tall" />
        </div>
      )}

      {error && (
        <div className="status-banner status-banner--error">
          Failed to load market data: {error}
        </div>
      )}

      {stocksData && !stocksData.error && (
        <main className="app-main">
          <div className="row">
            <MarketBreadth advance={stocksData.advance} />

            {sectorData && !sectorData.error && (
              <>
                <SectorList title="Top Sector Gainers" sectors={sectorData['top-gainer']} type="gainer" />
                <SectorList title="Top Sector Losers" sectors={sectorData['top-losers']} type="loser" />
              </>
            )}
          </div>

          <div className="row row--stocks">
            <StockList
              title="Top Gainers"
              stocks={stocksData['top-gainer']}
              type="gainer"
              onStockClick={handleStockClick}
              lastFetchTime={lastFetchTime}
              maxLoss={maxLoss}
              totalCapital={totalCapital}
              lowVolBarsBefore={lowVolBarsBefore}
            />
            <StockList
              title="Top Losers"
              stocks={stocksData['top-losers']}
              type="loser"
              onStockClick={handleStockClick}
              lastFetchTime={lastFetchTime}
              maxLoss={maxLoss}
              totalCapital={totalCapital}
              lowVolBarsBefore={lowVolBarsBefore}
            />
          </div>
        </main>
      )}

      {modalData.symbol && (
        <div
          className="modal-overlay"
          onClick={() => setModalData({ symbol: null, type: null })}
        >
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-symbol">{modalData.symbol}</h2>
                <span className={`modal-type-badge modal-type-badge--${modalData.type}`}>
                  {modalData.type}
                </span>
              </div>
              <button
                className="modal-close"
                onClick={() => setModalData({ symbol: null, type: null })}
                aria-label="Close chart"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <StockChart
                symbol={modalData.symbol}
                lastFetchTime={lastFetchTime}
                type={modalData.type}
                isModal={true}
                maxLoss={maxLoss}
                totalCapital={totalCapital}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
