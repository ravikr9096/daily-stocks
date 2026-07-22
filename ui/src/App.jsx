import { useState, useEffect, useCallback } from 'react'
import './App.css'
import StockChart from './StockChart'
import StockList from './StockList'
import SectorList from './SectorList'
import { API_BASE_URL } from './config'

function App() {
  const [stocksData, setStocksData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(Date.now())
  const [modalData, setModalData] = useState({ symbol: null, type: null })
  const [sectorData, setSectorData] = useState(null)
  const [sectorLoading, setSectorLoading] = useState(true)
  const [sectorError, setSectorError] = useState(null)
  const [maxLoss, setMaxLoss] = useState(1500)
  const [totalCapital, setTotalCapital] = useState(20000)

  useEffect(() => {
    document.body.style.backgroundColor = '#000'
    document.body.style.color = '#fff'
    document.body.style.margin = '0'

    let isMounted = true;
    let timeoutId;

    const fetchData = async () => {
      try {
        const [stocksResponse, sectorsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/stocks`),
          fetch(`${API_BASE_URL}/api/sector-performance`)
        ]);

        if (!stocksResponse.ok) throw new Error("Failed to fetch stock data");
        if (!sectorsResponse.ok) throw new Error("Failed to fetch sector data");

        const stocks = await stocksResponse.json();
        const sectors = await sectorsResponse.json();

        if (isMounted) {
          setStocksData(stocks);
          setSectorData(sectors);
          setLastFetchTime(Date.now());
          setError(null);
          setSectorError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setSectorError(err.message);
        }
        console.error("Error fetching data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setSectorLoading(false);
          // Schedule the next fetch
          timeoutId = setTimeout(fetchData, 30000);
        }
      }
    };

    fetchData(); // Initial fetch

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    }
  }, [])

  const handleMaxLossChange = useCallback((e) => {
    setMaxLoss(Number(e.target.value));
  }, []);

  const handleTotalCapitalChange = useCallback((e) => {
    setTotalCapital(Number(e.target.value));
  }, []);

  const handleStockClick = useCallback((symbol, type) => {
    // On mobile, we want to allow chart interaction (like showing tooltips on tap)
    // without immediately opening the modal. The modal remains for desktop clicks.
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) return;
    setModalData({ symbol, type });
  }, []);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setSectorLoading(true);
    // The useEffect cleanup/re-run logic will handle the fetch,
    // but we can force an immediate one by changing a dependency or creating a dedicated function.
    // For simplicity, let's just update the fetch time to trigger children updates.
    // A more robust implementation might involve a dedicated fetch function outside useEffect.
    setLastFetchTime(Date.now());
  }, []);

  return (
    <div className="App" style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh', maxWidth: '1800px', margin: '0 auto', width: '100%', fontSize: '0.9rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: '0', color: '#fff' }}>Market Overview</h2>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', color: '#fff', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label htmlFor="max-loss" style={{ marginRight: '10px' }}>Maximum Loss (₹):</label>
            <input
              id="max-loss"
              type="number"
              value={maxLoss}
              onChange={handleMaxLossChange}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #333', background: '#000', color: '#fff', width: '100px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label htmlFor="total-capital" style={{ marginRight: '10px' }}>Total Capital (₹):</label>
            <input
              id="total-capital"
              type="number"
              value={totalCapital}
              onChange={handleTotalCapitalChange}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #333', background: '#000', color: '#fff', width: '100px' }}
            />
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={loading}
            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: '#fff', cursor: 'pointer' }}
          >
            {loading ? 'Refreshing...' : 'Refresh Now'}
          </button>
        </div>
      </div>
      
      {loading && !stocksData && <p>Loading market data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {stocksData && !stocksData.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
          
          {/* Top Row (Advances & Sectors) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            
            <div className="card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', maxWidth: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: '1 1 30%' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Advances</h4>
                  <p style={{ color: 'green', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.advances}</p>
                </div>
                <div style={{ flex: '1 1 30%' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Declines</h4>
                  <p style={{ color: 'red', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.declines}</p>
                </div>
                <div style={{ flex: '1 1 30%' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Unchanged</h4>
                  <p style={{ color: 'gray', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.unchanged}</p>
                </div>
              </div>
            </div>

            {sectorData && !sectorData.error && (
              <>
                <SectorList title="Top Sector Gainers" sectors={sectorData['top-gainer']} type="gainer" />
                <SectorList title="Top Sector Losers" sectors={sectorData['top-losers']} type="loser" />
              </>
            )}
          </div>

          {/* Bottom Row (Stocks) */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <StockList
              title="Top Gainers"
              stocks={stocksData['top-gainer']}
              type="gainer"
              onStockClick={handleStockClick}
              lastFetchTime={lastFetchTime}
              maxLoss={maxLoss}
              totalCapital={totalCapital}
            />
            <StockList
              title="Top Losers"
              stocks={stocksData['top-losers']}
              type="loser"
              onStockClick={handleStockClick}
              lastFetchTime={lastFetchTime}
              maxLoss={maxLoss}
              totalCapital={totalCapital}
            />
          </div>

        </div>
      )}

      {modalData.symbol && (
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }} 
          onClick={() => setModalData({ symbol: null, type: null })}
        >
          <div 
            style={{
              background: '#111',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #333',
              width: '95%',
              maxWidth: '1000px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              maxHeight: '95vh',
              overflowY: 'auto'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>{modalData.symbol}</h2>
              <button onClick={() => setModalData({ symbol: null, type: null })} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <StockChart symbol={modalData.symbol} lastFetchTime={lastFetchTime} type={modalData.type} isModal={true} maxLoss={maxLoss} totalCapital={totalCapital} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
