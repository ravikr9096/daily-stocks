import React, { memo, useState, useCallback } from 'react';
import StockChart from './StockChart';

const StockList = ({ title, stocks, type, onStockClick, lastFetchTime, maxLoss, totalCapital, lowVolBarsBefore }) => {
  const titleColor = type === 'gainer' ? 'green' : 'red';
  const [highlightedStocks, setHighlightedStocks] = useState({});

  const handleHighlightCheck = useCallback((symbol, shouldHighlight) => {
    setHighlightedStocks(prev => ({ ...prev, [symbol]: shouldHighlight }));
  }, []);

  return (
    <div className="card" style={{ flex: '1 1 300px', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', maxWidth: '100%' }}>
      <h3 style={{ marginTop: 0, color: titleColor }}>{title}</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {stocks?.map((stock) => (
          <li
            key={stock.symbol} 
            style={{ 
              padding: '0.5rem', 
              borderBottom: '1px solid #333', 
              cursor: 'pointer', 
              pointerEvents: 'none',
              ...(highlightedStocks[stock.symbol] && { 
                border: '2px solid #ffc107', 
                borderRadius: '4px', 
                margin: '-1px' 
              }) 
            }}
            onClick={() => onStockClick(stock.symbol, type)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <strong>{stock.symbol}</strong>
              <span style={{ color: titleColor }}>{type === 'gainer' ? '+' : ''}{stock.pChange}%</span>
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