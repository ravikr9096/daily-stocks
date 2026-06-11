import { useState, useEffect } from 'react'
import './App.css'
import StockChart from './StockChart'

function App() {
  const [stocksData, setStocksData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(Date.now())

  const fetchStocks = () => {
    fetch('http://localhost:8000/api/stocks')
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

  useEffect(() => {
    // Initial fetch
    fetchStocks()

    // Set up polling every 1 minute (60000 ms)
    const intervalId = setInterval(fetchStocks, 60000)

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId)
  }, [])

  return (
    <div className="App">
      <h1>Market Overview</h1>
      
      {loading && !stocksData && <p>Loading market data...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {stocksData && !stocksData.error && (
        <>
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '2rem' }}>
            <div>
              <h3>Advances</h3>
              <p style={{ color: 'green', fontSize: '2rem', margin: 0 }}>{stocksData.advance?.advances}</p>
            </div>
            <div>
              <h3>Declines</h3>
              <p style={{ color: 'red', fontSize: '2rem', margin: 0 }}>{stocksData.advance?.declines}</p>
            </div>
            <div>
              <h3>Unchanged</h3>
              <p style={{ color: 'gray', fontSize: '2rem', margin: 0 }}>{stocksData.advance?.unchanged}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center' }}>
            <div className="card" style={{ flex: 1, minWidth: '300px' }}>
              <h2>Top Gainers</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {stocksData['top-gainer']?.map((stock) => (
                  <li 
                    key={stock.symbol}
                    style={{ padding: '1rem', borderBottom: '1px solid #444' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong>{stock.symbol}</strong>
                      <span style={{ color: 'green' }}>+{stock.pChange}%</span>
                    </div>
                    <StockChart symbol={stock.symbol} lastFetchTime={lastFetchTime} type="gainer" />
                  </li>
                ))}
              </ul>
            </div>

            <div className="card" style={{ flex: 1, minWidth: '300px' }}>
              <h2>Top Losers</h2>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {stocksData['top-losers']?.map((stock) => (
                  <li 
                    key={stock.symbol}
                    style={{ padding: '1rem', borderBottom: '1px solid #444' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <strong>{stock.symbol}</strong>
                      <span style={{ color: 'red' }}>{stock.pChange}%</span>
                    </div>
                    <StockChart symbol={stock.symbol} lastFetchTime={lastFetchTime} type="loser" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
