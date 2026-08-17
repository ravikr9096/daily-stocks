import { useState, useEffect } from 'react'
import Chart from 'react-apexcharts'
import { API_BASE_URL } from './config'

export default function StockChart({ symbol, lastFetchTime, type, isModal = false, maxLoss = 1000, totalCapital = 100000, lowVolBarsBefore = 2, onHighlightCheck }) {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [maxVolume, setMaxVolume] = useState(0)
  const [minPrice, setMinPrice] = useState(0)
  const [targetAnnotation, setTargetAnnotation] = useState(null)

  useEffect(() => {
    if (!symbol) return;

    // Only show the hard loading state if we have no chart data yet
    if (chartData.length === 0) {
      setLoading(true);
    }
    fetch(`${API_BASE_URL}/api/candles/${symbol}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch candle data")
        return res.json()
      })
      .then((data) => {
        if (data.error) throw new Error(data.error)
    
        if (!data || !data.candles) {
          setChartData([]);
          setLoading(false);
          setError(null);
          return;
        }
        
        const candleSeries = {
          name: 'Price',
          type: 'candlestick',
          data: data.candles.map(candle => ({
            x: new Date(candle.timestamp),
            y: [candle.open, candle.high, candle.low, candle.close]
          }))
        }
        
        const volumeSeries = {
          name: 'Volume',
          type: 'bar',
          data: data.candles.map(candle => ({
            x: new Date(candle.timestamp),
            y: candle.volume,
            fillColor: candle.close >= candle.open ? '#00E396' : '#FF4560'
          }))
        }
        
        const maxV = Math.max(...data.candles.map(c => c.volume))
        setMaxVolume(maxV)

        // Calculate price padding so candles don't overlap with volume at the bottom
        const minP = Math.min(...data.candles.map(c => c.low))
        const maxP = Math.max(...data.candles.map(c => c.high))
        const pRange = maxP - minP
        setMinPrice(minP - (pRange > 0 ? pRange * 0.4 : minP * 0.05))

        // Find the specific candle to highlight based on the stock type
        let target = null;
        if (type === 'gainer') {
          const redCandles = data.candles.filter(c => c.close < c.open);
          if (redCandles.length > 0) {
            target = redCandles.reduce((min, c) => c.volume < min.volume ? c : min, redCandles[0]);
          }
        } else if (type === 'loser') {
          const greenCandles = data.candles.filter(c => c.close >= c.open);
          if (greenCandles.length > 0) {
            target = greenCandles.reduce((min, c) => c.volume < min.volume ? c : min, greenCandles[0]);
          }
        }
        setTargetAnnotation(target);

        // Highlight check for low volume candle
        if (onHighlightCheck && data.candles.length > lowVolBarsBefore) {
          const checkIndex = data.candles.length - 1 - lowVolBarsBefore;
          const candleToCheck = data.candles[checkIndex];
          
          // Find the lowest volume in the entire series to determine what "low" means
          const volumes = data.candles.map(c => c.volume);
          const lowestVolume = Math.min(...volumes.filter(v => v > 0)); // Exclude zero volume

          // A candle is "low volume" if it's in the bottom 10% of volume for this stock's day
          const volumeThreshold = lowestVolume * 1.1; 

          const shouldHighlight = candleToCheck.volume > 0 && candleToCheck.volume <= volumeThreshold;
          onHighlightCheck(symbol, shouldHighlight);
        }
        
        setChartData([candleSeries, volumeSeries])
        setLoading(false)
        setError(null)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [symbol, lastFetchTime, type, lowVolBarsBefore, onHighlightCheck])

  if (!symbol) return null;

  const options = {
    chart: {
      height: isModal ? 500 : 250,
      background: 'transparent',
      toolbar: { show: isModal }, // Only show toolbar in modal
      events: {
        // This allows the parent li's onClick to fire
        click: (event, chartContext, config) => event.target.parentElement.parentElement.dispatchEvent(new Event('click', { bubbles: true }))
      }
    },
    grid: { 
      show: false // Removes background grid lines for a cleaner look
    },
    plotOptions: {
      bar: {
        columnWidth: '50%', // Thins out the volume bars to prevent horizontal overlap
      },
      candlestick: {
        colors: {
          upward: '#00E396',
          downward: '#FF4560'
        },
        wick: {
          useFillColor: true // Makes the wicks match the candle body color
        }
      }
    },
    stroke: {
      width: [1, 0] // 1px stroke for candles to reduce bulkiness, 0px for volume bars
    },
    title: {
      text: undefined
    },
    xaxis: {
      type: 'datetime',
      labels: { show: isModal }, // Hides the bottom time labels unless in modal
      axisBorder: { show: isModal },
      axisTicks: { show: isModal }
    },
    yaxis: [
      {
        seriesName: 'Price',
        min: minPrice, // Forces empty space at the bottom for the volume bars
        labels: { style: { colors: '#a3a3a3' } } // Softer color for price labels
      },
      {
        seriesName: 'Volume',
        opposite: true,
        max: maxVolume ? maxVolume * 5 : undefined, // Pushes volume bars slightly lower (bottom 20%)
        labels: { show: false } // Hides the volume numbers on the right
      }
    ],
    theme: { mode: 'dark' },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      enabledOnSeries: undefined, // Ensure tooltip is enabled for all series
      shared: true,
      custom: function ({ dataPointIndex, w }) {
        const candleData = w.config.series[0].data[dataPointIndex];
        const volumeData = w.config.series[1].data[dataPointIndex];
        
        if (!candleData || !volumeData) return '';
        
        const time = new Date(candleData.x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const [o, h, l, c] = candleData.y;
        const v = volumeData.y;
        
        const color = c >= o ? '#00E396' : '#FF4560';
        const risk = h - l;
        const quantity = risk > 0 ? Math.floor(maxLoss / risk) : 0;
        const capitalRequired = quantity * h;
        const maxQuantity = h > 0 ? Math.floor(totalCapital*5 / h) : 0;
        const actualLoss = maxQuantity * risk;
        
        return `
          <div style="padding: 10px; background: #000; border: 1px solid #333; color: #fff; font-family: sans-serif; font-size: 13px;">
            <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 4px; text-align: center;">
              ${time}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Open:</span> <strong>${o.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>High:</span> <strong>${h.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Low:</span> <strong>${l.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Close:</span> <strong style="color: ${color};">${c.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #333;">
              <span>Volume:</span> <strong>${v.toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 4px; padding-top: 4px; border-top: 1px solid #333;">
              <span>Max Loss:</span> <strong>${maxLoss}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Qty to Buy:</span> <strong style="color: #00E396;">${quantity}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Capital Required:</span> <strong>${capitalRequired.toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Max Qty:</span> <strong>${maxQuantity}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>Actual Loss:</span> <strong style="color: #FF4560;">${actualLoss.toFixed(2)}</strong>
            </div>
          </div>
        `;
      }
    },
    annotations: targetAnnotation ? {
      points: [
        {
          x: new Date(targetAnnotation.timestamp).getTime(),
          y: targetAnnotation.high,
          marker: {
            size: 6,
            fillColor: type === 'gainer' ? '#FF4560' : '#00E396',
            strokeColor: '#fff',
            strokeWidth: 2,
          },
          label: {
            borderColor: type === 'gainer' ? '#FF4560' : '#00E396',
            style: {
              color: '#fff',
              background: type === 'gainer' ? '#FF4560' : '#00E396',
            },
            text: type === 'gainer' ? 'Lowest Vol Red' : 'Lowest Vol Green',
            offsetY: -10
          }
        }
      ]
    } : {}
  }

  return (
    <>
      {loading && chartData.length === 0 && <p>Loading chart for {symbol}...</p>}
      {error && <p style={{ color: 'red' }}>Error loading chart: {error}</p>}
      {chartData.length > 0 && !error ? (
        <div style={{ pointerEvents: 'auto' }}>
          <Chart options={options} series={chartData} type="line" height={isModal ? 500 : 250} />
        </div>
      ) : null}
    </>
  )
}