import React, { memo, useState, useCallback, useMemo } from 'react';
import StockChart from './StockChart';

const StockList = ({
  title,
  stocks,
  type,
  onStockClick,
  lastFetchTime,
  maxLoss,
  totalCapital,
  lowVolBarsBefore,
  searchQuery = '',
  filterSetupOnly = false
}) => {
  const [highlightedStocks, setHighlightedStocks] = useState({});

  const handleHighlightCheck = useCallback((symbol, shouldHighlight) => {
    setHighlightedStocks(prev => {
      if (prev[symbol] === shouldHighlight) return prev;
      return { ...prev, [symbol]: shouldHighlight };
    });
  }, []);

  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    return stocks.filter(stock => {
      const matchesSearch = !searchQuery || stock.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSetup = !filterSetupOnly || highlightedStocks[stock.symbol];
      return matchesSearch && matchesSetup;
    });
  }, [stocks, searchQuery, filterSetupOnly, highlightedStocks]);

  const setupCount = useMemo(() => {
    if (!stocks) return 0;
    return stocks.filter(s => highlightedStocks[s.symbol]).length;
  }, [stocks, highlightedStocks]);

  return (
    <div className={`card list-card stock-card stock-card--${type}`}>
      <div className="card-header">
        <div className="card-title-group">
          <h3 className="card-title">
            <span className={`card-title-dot card-title-dot--${type === 'gainer' ? 'gain' : 'loss'}`} />
            {title}
          </h3>
          {setupCount > 0 && (
            <span className="setup-badge" title="Stocks with low-volume contraction setup">
              ⚡ {setupCount} {setupCount === 1 ? 'setup' : 'setups'}
            </span>
          )}
        </div>
        <span className="card-count">{filteredStocks.length} of {stocks?.length ?? 0}</span>
      </div>

      {filteredStocks.length === 0 ? (
        <div className="empty-filter-state">
          <p>No {type === 'gainer' ? 'gainers' : 'losers'} match the current filter.</p>
        </div>
      ) : (
        <ul className="list-items">
          {filteredStocks.map((stock, index) => {
            const isHighlighted = highlightedStocks[stock.symbol];
            return (
              <li
                key={stock.symbol}
                className={`stock-item${isHighlighted ? ' stock-item--highlighted' : ''}`}
                onClick={() => onStockClick(stock.symbol, type)}
                title="Click to view full trading workstation"
              >
                <div className="stock-row">
                  <div className="stock-symbol-group">
                    <span className={`stock-rank rank-${index + 1}`}>
                      {index + 1}
                    </span>
                    <div className="stock-identity">
                      <strong className="stock-symbol">{stock.symbol}</strong>
                      {isHighlighted && (
                        <span className="stock-setup-tag">
                          ⚡ Vol Contraction
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="stock-price-group">
                    {stock.lastPrice && (
                      <span className="stock-price">
                        ₹{Number(stock.lastPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <span className={`change-badge change-badge--${type === 'gainer' ? 'gain' : 'loss'}`}>
                      {type === 'gainer' ? '▲ +' : '▼ '}{stock.pChange}%
                    </span>
                  </div>
                </div>

                <div className="stock-chart-wrapper">
                  <StockChart
                    symbol={stock.symbol}
                    lastFetchTime={lastFetchTime}
                    type={type}
                    maxLoss={maxLoss}
                    totalCapital={totalCapital}
                    lowVolBarsBefore={lowVolBarsBefore}
                    onHighlightCheck={handleHighlightCheck}
                  />
                </div>

                <div className="stock-card-footer">
                  <span className="expand-hint">Click chart to expand & calculate risk</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default memo(StockList);
