import { useState, useEffect } from 'react'
import './App.css'
import StockChart from './StockChart'

function App() {
  const [stocksData, setStocksData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(Date.now())
  const [selectedSymbol, setSelectedSymbol] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [sectorData, setSectorData] = useState(null)
  const [sectorLoading, setSectorLoading] = useState(true)
  const [sectorError, setSectorError] = useState(null)

  const fetchStocks = () => {
    fetch('http://192.168.1.12:8000/api/stocks')
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok")
        return response.json()
      })
      .then((data) => {
        setStocksData(data)
        setLastFetchTime(Date.now())
        setLoading(false)
        setError(null)
      })
      .catch((error) => {
        console.error("Error fetching data:", error)
        setError(error.message)
        setLoading(false)
      })
  }

  const fetchSectors = () => {
    fetch('http://192.168.1.12:8000/api/sector-performance')
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok")
        return response.json()
      })
      .then((data) => {
        setSectorData(data)
        setSectorLoading(false)
        setSectorError(null)
      })
      .catch((error) => {
        console.error("Error fetching sector data:", error)
        setSectorError(error.message)
        setSectorLoading(false)
      })
  }

  useEffect(() => {
    // Initial fetch
    fetchStocks()
    fetchSectors()

    // Set up polling every 1 minute (60000 ms)
    const intervalId1 = setInterval(fetchStocks, 60000)
    const intervalId2 = setInterval(fetchSectors, 60000)

    // Clean up the interval when the component unmounts
    return () => {
      clearInterval(intervalId1)
      clearInterval(intervalId2)
    }
  }, [])

  return (
    <div className="App" style={{ maxWidth: '1800px', margin: '0 auto', width: '100%', fontSize: '0.9rem' }}>
      <h2>Market Overview</h2>
      
      {loading && !stocksData && <p>Loading market data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {stocksData && !stocksData.error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }}>
          
          {/* Top Row (Advances & Sectors) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            
            <div className="card" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Advances</h4>
                  <p style={{ color: 'green', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.advances}</p>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Declines</h4>
                  <p style={{ color: 'red', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.declines}</p>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Unchanged</h4>
                  <p style={{ color: 'gray', fontSize: '1.5rem', margin: 0 }}>{stocksData.advance?.unchanged}</p>
                </div>
              </div>
            </div>

            {sectorData && !sectorData.error && (
              <>
                <div className="card" style={{ flex: '1 1 300px' }}>
                  <h3 style={{ marginTop: 0 }}>Top Sector Gainers</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sectorData['top-gainer']?.map((sector) => (
                      <li key={sector.index} style={{ padding: '0.25rem 0', borderBottom: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{sector.index}</strong>
                          <span style={{ color: 'green' }}>+{sector.percentChange}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card" style={{ flex: '1 1 300px' }}>
                  <h3 style={{ marginTop: 0 }}>Top Sector Losers</h3>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {sectorData['top-losers']?.map((sector) => (
                      <li key={sector.index} style={{ padding: '0.25rem 0', borderBottom: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{sector.index}</strong>
                          <span style={{ color: 'red' }}>{sector.percentChange}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Bottom Row (Stocks) */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ marginTop: 0 }}>Top Gainers</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {stocksData['top-gainer']?.map((stock) => (
                  <li 
                    key={stock.symbol}
                    style={{ padding: '0.5rem', borderBottom: '1px solid #444', cursor: 'pointer' }}
                    onClick={() => { setSelectedSymbol(stock.symbol); setSelectedType('gainer') }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong>{stock.symbol}</strong>
                      <span style={{ color: 'green' }}>+{stock.pChange}%</span>
                    </div>
                    <StockChart symbol={stock.symbol} lastFetchTime={lastFetchTime} type="gainer" />
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ marginTop: 0 }}>Top Losers</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {stocksData['top-losers']?.map((stock) => (
                  <li 
                    key={stock.symbol}
                    style={{ padding: '0.5rem', borderBottom: '1px solid #444', cursor: 'pointer' }}
                    onClick={() => { setSelectedSymbol(stock.symbol); setSelectedType('loser') }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <strong>{stock.symbol}</strong>
                      <span style={{ color: 'red' }}>{stock.pChange}%</span>
                    </div>
                    <StockChart symbol={stock.symbol} lastFetchTime={lastFetchTime} type="loser" />
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      )}

      {selectedSymbol && (
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
          onClick={() => setSelectedSymbol(null)}
        >
          <div 
            style={{
              background: '#242424',
              padding: '2rem',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '1000px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>{selectedSymbol}</h2>
              <button onClick={() => setSelectedSymbol(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <StockChart symbol={selectedSymbol} lastFetchTime={lastFetchTime} type={selectedType} isModal={true} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
