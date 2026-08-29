import { useState, useCallback, useEffect, useMemo } from 'react';
import './App.css';
import StockChart from './StockChart';
import StockList from './StockList';
import SectorList from './SectorList';
import { useMarketData } from './useMarketData';

function formatLastUpdated(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function MarketBreadth({ advance }) {
  const advances = advance?.advances ?? 0;
  const declines = advance?.declines ?? 0;
  const unchanged = advance?.unchanged ?? 0;
  const total = advances + declines + unchanged || 1;

  const advancePct = Math.round((advances / total) * 100);
  const declinePct = Math.round((declines / total) * 100);
  const adRatio = declines > 0 ? (advances / declines).toFixed(2) : advances > 0 ? '∞' : '1.0';
  const netAdvancing = advances - declines;

  let sentimentText = 'Neutral';
  let sentimentClass = 'neutral';
  if (advancePct >= 65) {
    sentimentText = 'Strongly Bullish';
    sentimentClass = 'gain';
  } else if (advancePct >= 55) {
    sentimentText = 'Moderately Bullish';
    sentimentClass = 'gain';
  } else if (advancePct <= 35) {
    sentimentText = 'Strongly Bearish';
    sentimentClass = 'loss';
  } else if (advancePct <= 45) {
    sentimentText = 'Moderately Bearish';
    sentimentClass = 'loss';
  }

  return (
    <div className="card breadth-card">
      <div className="card-header">
        <div className="card-title-group">
          <h3 className="card-title">
            <span className="card-title-dot card-title-dot--neutral" />
            Market Breadth
          </h3>
          <span className={`sentiment-pill sentiment-pill--${sentimentClass}`}>
            <span className="sentiment-dot" />
            {sentimentText}
          </span>
        </div>
        <div className="card-header-meta">
          <span className="adr-badge" title="Advance-Decline Ratio">ADR: {adRatio}x</span>
          <span className="card-count">{total} F&O stocks</span>
        </div>
      </div>

      <div className="breadth-stats">
        <div className="breadth-stat breadth-stat--gain">
          <div className="breadth-stat-label">Advances</div>
          <div className="breadth-stat-value breadth-stat-value--gain">{advances}</div>
          <div className="breadth-stat-sub">{advancePct}% of market</div>
        </div>
        <div className="breadth-stat breadth-stat--neutral">
          <div className="breadth-stat-label">Unchanged</div>
          <div className="breadth-stat-value breadth-stat-value--neutral">{unchanged}</div>
          <div className="breadth-stat-sub">{Math.round((unchanged / total) * 100)}% flat</div>
        </div>
        <div className="breadth-stat breadth-stat--loss">
          <div className="breadth-stat-label">Declines</div>
          <div className="breadth-stat-value breadth-stat-value--loss">{declines}</div>
          <div className="breadth-stat-sub">{declinePct}% of market</div>
        </div>
      </div>

      <div className="breadth-bar-container">
        <div className="breadth-bar">
          <div
            className="breadth-bar-segment breadth-bar-segment--gain"
            style={{ width: `${(advances / total) * 100}%` }}
            title={`Advances: ${advances} (${advancePct}%)`}
          />
          <div
            className="breadth-bar-segment breadth-bar-segment--neutral"
            style={{ width: `${(unchanged / total) * 100}%` }}
            title={`Unchanged: ${unchanged}`}
          />
          <div
            className="breadth-bar-segment breadth-bar-segment--loss"
            style={{ width: `${(declines / total) * 100}%` }}
            title={`Declines: ${declines} (${declinePct}%)`}
          />
        </div>
        <div className="breadth-ratio">
          <span className="ratio-gain">▲ {advances} advancing ({advancePct}%)</span>
          <span className="ratio-net">
            Net: <strong style={{ color: netAdvancing >= 0 ? 'var(--gain)' : 'var(--loss)' }}>{netAdvancing > 0 ? `+${netAdvancing}` : netAdvancing}</strong>
          </span>
          <span className="ratio-loss">▼ {declines} declining ({declinePct}%)</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const CAPITAL_DEFAULT = 62580;
  const { marketData, loading, sectorsLoading, error, lastFetchTime, forceRefresh } = useMarketData();
  const [modalData, setModalData] = useState({ symbol: null, type: null });
  const [totalCapital, setTotalCapital] = useState(CAPITAL_DEFAULT);
  const [maxLoss, setMaxLoss] = useState(Math.round(0.02 * CAPITAL_DEFAULT));
  const [lowVolBarsBefore, setLowVolBarsBefore] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'setups', 'gainers', 'losers'

  // Sync ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalData({ symbol: null, type: null });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMaxLossChange = useCallback((e) => {
    setMaxLoss(Number(e.target.value));
  }, []);

  const handleTotalCapitalChange = useCallback((e) => {
    const cap = Number(e.target.value);
    setTotalCapital(cap);
  }, []);

  const handleQuickRiskPreset = useCallback((riskPercent) => {
    setMaxLoss(Math.round(totalCapital * (riskPercent / 100)));
  }, [totalCapital]);

  const handleStockClick = useCallback((symbol, type) => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;
    setModalData({ symbol, type });
  }, []);

  const handleLowVolBarsBeforeChange = useCallback((e) => {
    setLowVolBarsBefore(Number(e.target.value));
  }, []);

  const { stocksData, sectorData } = marketData || {};

  const riskPctOfCapital = useMemo(() => {
    if (!totalCapital || totalCapital <= 0) return 0;
    return ((maxLoss / totalCapital) * 100).toFixed(1);
  }, [maxLoss, totalCapital]);

  return (
    <div className="app">
      {/* Sticky Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-logo-row">
            <h1 className="header-title">
              <span className="header-title-icon">DS</span>
              Daily Stocks
            </h1>
            <span className={`live-badge ${loading ? 'loading' : ''}`}>
              <span className="live-dot" />
              {loading ? 'Syncing…' : 'Live'}
            </span>
          </div>
          <div className="header-meta">
            <span className="header-subtitle">NSE F&O Intelligence Station</span>
            {lastFetchTime && (
              <span className="header-updated-time">Updated {formatLastUpdated(lastFetchTime)}</span>
            )}
          </div>
        </div>

        {/* Trade Risk & Sizing Controls */}
        <div className="controls-panel">
          <div className="control-group">
            <label htmlFor="total-capital">Capital (₹)</label>
            <input
              id="total-capital"
              className="control-input control-input--capital"
              type="number"
              value={totalCapital}
              onChange={handleTotalCapitalChange}
            />
          </div>

          <div className="control-group">
            <div className="label-with-presets">
              <label htmlFor="max-loss">Max Loss (₹)</label>
              <div className="risk-preset-buttons">
                <button type="button" className={`btn-chip ${riskPctOfCapital === '1.0' ? 'active' : ''}`} onClick={() => handleQuickRiskPreset(1)}>1%</button>
                <button type="button" className={`btn-chip ${riskPctOfCapital === '2.0' ? 'active' : ''}`} onClick={() => handleQuickRiskPreset(2)}>2%</button>
                <button type="button" className={`btn-chip ${riskPctOfCapital === '3.0' ? 'active' : ''}`} onClick={() => handleQuickRiskPreset(3)}>3%</button>
              </div>
            </div>
            <div className="input-with-pill">
              <input
                id="max-loss"
                className="control-input control-input--risk"
                type="number"
                value={maxLoss}
                onChange={handleMaxLossChange}
              />
              <span className="risk-pct-pill">{riskPctOfCapital}%</span>
            </div>
          </div>

          <div className="control-group">
            <label htmlFor="low-vol-bars-before">Low Vol Bars</label>
            <input
              id="low-vol-bars-before"
              className="control-input control-input--narrow"
              type="number"
              value={lowVolBarsBefore}
              onChange={handleLowVolBarsBeforeChange}
              title="Number of candles back to check for dry-up contraction"
            />
          </div>

          <button
            className={`btn btn-primary ${loading ? 'btn--loading' : ''}`}
            onClick={forceRefresh}
            disabled={loading}
            title="Force refresh market data"
          >
            <span className="btn-icon">↻</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Loading Skeleton */}
      {loading && !marketData && (
        <div className="loading-skeleton">
          <div className="skeleton-card skeleton-card--breadth" />
          <div className="row">
            <div className="skeleton-card" style={{ flex: 1 }} />
            <div className="skeleton-card" style={{ flex: 1 }} />
          </div>
          <div className="row">
            <div className="skeleton-card skeleton-card--tall" style={{ flex: 1 }} />
            <div className="skeleton-card skeleton-card--tall" style={{ flex: 1 }} />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="status-banner status-banner--error">
          <span className="banner-icon">⚠️</span>
          <span>Failed to load market data: {error}</span>
          <button className="btn btn-sm" onClick={forceRefresh}>Retry</button>
        </div>
      )}

      {/* Main Content Dashboard */}
      {stocksData && !stocksData.error && (
        <main className="app-main">
          {/* Row 1: Market Breadth & Sector Performance */}
          <div className="row row--sectors">
            <MarketBreadth advance={stocksData.advance} />

            {sectorsLoading && !sectorData && (
              <div className="card list-card" style={{ flex: '1 1 300px' }}>
                <div className="chart-loading">
                  <span className="live-dot" />
                  Loading sectoral dynamics…
                </div>
              </div>
            )}

            {sectorData && !sectorData.error && (
              <>
                <SectorList title="Top Sector Gainers" sectors={sectorData['top-gainer']} type="gainer" />
                <SectorList title="Top Sector Losers" sectors={sectorData['top-losers']} type="loser" />
              </>
            )}
          </div>

          {/* Quick Filter & Search Bar */}
          <div className="search-filter-toolbar">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search stocks (e.g. RELIANCE, TCS, INFY)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="search-clear-btn" onClick={() => setSearchQuery('')}>✕</button>
              )}
            </div>

            <div className="filter-chips">
              <button
                className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                All Movers
              </button>
              <button
                className={`filter-chip filter-chip--highlight ${activeFilter === 'setups' ? 'active' : ''}`}
                onClick={() => setActiveFilter('setups')}
              >
                ⚡ Setups Only
              </button>
              <button
                className={`filter-chip filter-chip--gain ${activeFilter === 'gainers' ? 'active' : ''}`}
                onClick={() => setActiveFilter('gainers')}
              >
                🟢 Gainers
              </button>
              <button
                className={`filter-chip filter-chip--loss ${activeFilter === 'losers' ? 'active' : ''}`}
                onClick={() => setActiveFilter('losers')}
              >
                🔴 Losers
              </button>
            </div>
          </div>

          {/* Row 2: Stock Gainers & Losers with Charts */}
          <div className="row row--stocks">
            {(activeFilter === 'all' || activeFilter === 'setups' || activeFilter === 'gainers') && (
              <StockList
                title="Top Gainers"
                stocks={stocksData['top-gainer']}
                type="gainer"
                onStockClick={handleStockClick}
                lastFetchTime={lastFetchTime}
                maxLoss={maxLoss}
                totalCapital={totalCapital}
                lowVolBarsBefore={lowVolBarsBefore}
                searchQuery={searchQuery}
                filterSetupOnly={activeFilter === 'setups'}
              />
            )}

            {(activeFilter === 'all' || activeFilter === 'setups' || activeFilter === 'losers') && (
              <StockList
                title="Top Losers"
                stocks={stocksData['top-losers']}
                type="loser"
                onStockClick={handleStockClick}
                lastFetchTime={lastFetchTime}
                maxLoss={maxLoss}
                totalCapital={totalCapital}
                lowVolBarsBefore={lowVolBarsBefore}
                searchQuery={searchQuery}
                filterSetupOnly={activeFilter === 'setups'}
              />
            )}
          </div>
        </main>
      )}

      {/* Expanded Stock Workstation Modal */}
      {modalData.symbol && (
        <div
          className="modal-overlay"
          onClick={() => setModalData({ symbol: null, type: null })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-symbol-badge">{modalData.symbol.slice(0, 2)}</span>
                <div>
                  <h2 className="modal-symbol">{modalData.symbol}</h2>
                  <span className="modal-symbol-sub">NSE F&O 5-Min Intraday Workstation</span>
                </div>
                <span className={`modal-type-badge modal-type-badge--${modalData.type}`}>
                  {modalData.type === 'gainer' ? '▲ Top Gainer' : '▼ Top Loser'}
                </span>
              </div>
              <div className="modal-header-actions">
                <span className="esc-hint">Press ESC to exit</span>
                <button
                  className="modal-close"
                  onClick={() => setModalData({ symbol: null, type: null })}
                  aria-label="Close workstation"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body">
              <div className="modal-risk-banner">
                <div className="risk-metric">
                  <span className="risk-metric-label">Max Risk / Trade</span>
                  <strong className="risk-metric-value">₹{maxLoss.toLocaleString('en-IN')}</strong>
                </div>
                <div className="risk-metric">
                  <span className="risk-metric-label">Total Capital</span>
                  <strong className="risk-metric-value">₹{totalCapital.toLocaleString('en-IN')}</strong>
                </div>
                <div className="risk-metric">
                  <span className="risk-metric-label">Max Intraday Leverage (5x)</span>
                  <strong className="risk-metric-value" style={{ color: 'var(--accent-light)' }}>
                    ₹{(totalCapital * 5).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="modal-chart-area">
                <StockChart
                  symbol={modalData.symbol}
                  lastFetchTime={lastFetchTime}
                  type={modalData.type}
                  isModal={true}
                  maxLoss={maxLoss}
                  totalCapital={totalCapital}
                  lowVolBarsBefore={lowVolBarsBefore}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
