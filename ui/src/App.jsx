import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    // Fetching data from the FastAPI backend
    fetch('http://localhost:8000/api/hello')
      .then((response) => response.json())
      .then((data) => setData(data.message))
      .catch((error) => console.error("Error fetching data:", error))
  }, [])

  return (
    <div className="App">
      <h1>React + FastAPI</h1>
      <div className="card">
        <h2>Backend Response:</h2>
        <p>{data ? data : "Loading..."}</p>
      </div>
    </div>
  )
}

export default App
