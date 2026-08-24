import React, { memo, useState, useCallback } from 'react';
import StockChart from './StockChart';

const StockList = ({ title, stocks, type, onStockClick, lastFetchTime, maxLoss, totalCapital, lowVolBarsBefore }) => {
  const [highlightedStocks, setHighlightedStocks] = useState({});

  const handleHighlightCheck = useCallback((symbol, shouldHighlight) => {
    setHighlightedStocks(prev => ({ ...prev, [symbol]: shouldHighlight }));
  }, []);

  return (
    <div className="card list-card">
      <div className="card-header">
        <h3 className="card-title">
          <span className={`card-title-dot card-title-dot--${type === 'gainer' ? 'gain' : 'loss'}`} />
          {title}
        </h3>
        <span className="card-count">{stocks?.length ?? 0} stocks</span>
      </div>

      <ul className="list-items">
        {stocks?.map((stock, index) => (
          <li
            key={stock.symbol}
            className={`stock-item${highlightedStocks[stock.symbol] ? ' stock-item--highlighted' : ''}`}
            onClick={() => onStockClick(stock.symbol, type)}
          >
            <div className="stock-row">
              <div className="stock-symbol-group">
                <span className="stock-rank">{index + 1}</span>
                <strong className="stock-symbol">{stock.symbol}</strong>
              </div>
              <span className={`change-badge change-badge--${type === 'gainer' ? 'gain' : 'loss'}`}>
                {type === 'gainer' ? '+' : ''}{stock.pChange}%
              </span>
            </div>
            <StockChart
              symbol={stock.symbol}
              lastFetchTime={lastFetchTime}
              type={type}
              maxLoss={maxLoss}
              totalCapital={totalCapital}
              lowVolBarsBefore={lowVolBarsBefore}
              onHighlightCheck={handleHighlightCheck}
            />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(StockList);
