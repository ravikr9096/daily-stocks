import { useState, useEffect } from 'react'
import Chart from 'react-apexcharts'
import { API_BASE_URL } from './config'

export default function StockChart({
  symbol,
  lastFetchTime,
  type,
  isModal = false,
  maxLoss = 1000,
  totalCapital = 100000,
  lowVolBarsBefore = 2,
  onHighlightCheck
}) {
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [maxVolume, setMaxVolume] = useState(0)
  const [minPrice, setMinPrice] = useState(0)
  const [targetAnnotation, setTargetAnnotation] = useState(null)

  useEffect(() => {
    if (!symbol) return;

    const abortController = new AbortController();
    let cancelled = false;

    if (chartData.length === 0) {
      setLoading(true);
    }

    fetch(`${API_BASE_URL}/api/candles/${symbol}`, { signal: abortController.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch candle data');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);

        if (!data || !data.candles || data.candles.length === 0) {
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
        };

        const volumeSeries = {
          name: 'Volume',
          type: 'bar',
          data: data.candles.map(candle => ({
            x: new Date(candle.timestamp),
            y: candle.volume,
            fillColor: candle.close >= candle.open ? '#10b981' : '#f43f5e'
          }))
        };

        const maxV = Math.max(...data.candles.map(c => c.volume));
        setMaxVolume(maxV);

        const minP = Math.min(...data.candles.map(c => c.low));
        const maxP = Math.max(...data.candles.map(c => c.high));
        const pRange = maxP - minP;
        setMinPrice(minP - (pRange > 0 ? pRange * 0.4 : minP * 0.05));

        let target = null;
        if (type === 'gainer') {
          const redCandles = data.candles.filter(c => c.close < c.open);
          if (redCandles.length > 0) {
            target = redCandles.reduce((min, c) => (c.volume < min.volume ? c : min), redCandles[0]);
          }
        } else if (type === 'loser') {
          const greenCandles = data.candles.filter(c => c.close >= c.open);
          if (greenCandles.length > 0) {
            target = greenCandles.reduce((min, c) => (c.volume < min.volume ? c : min), greenCandles[0]);
          }
        }
        setTargetAnnotation(target);

        if (onHighlightCheck && data.candles.length > lowVolBarsBefore) {
          const checkIndex = data.candles.length - 1 - lowVolBarsBefore;
          const candleToCheck = data.candles[checkIndex];

          const volumes = data.candles.map(c => c.volume);
          const lowestVolume = Math.min(...volumes.filter(v => v > 0));
          const volumeThreshold = lowestVolume * 1.1;

          const shouldHighlight = candleToCheck && candleToCheck.volume > 0 && candleToCheck.volume <= volumeThreshold;
          onHighlightCheck(symbol, shouldHighlight);
        }

        setChartData([candleSeries, volumeSeries]);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [symbol, lastFetchTime, type, lowVolBarsBefore, onHighlightCheck])

  if (!symbol) return null;

  const options = {
    chart: {
      height: isModal ? 520 : 250,
      background: 'transparent',
      toolbar: {
        show: isModal,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        }
      },
      events: {
        click: (event) => {
          if (event.target && event.target.parentElement && event.target.parentElement.parentElement) {
            event.target.parentElement.parentElement.dispatchEvent(new Event('click', { bubbles: true }));
          }
        }
      }
    },
    grid: {
      show: isModal,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      strokeDashArray: 3
    },
    plotOptions: {
      bar: {
        columnWidth: '45%',
        borderRadius: 2
      },
      candlestick: {
        colors: {
          upward: '#10b981',
          downward: '#f43f5e'
        },
        wick: {
          useFillColor: true
        }
      }
    },
    stroke: {
      width: [1.5, 0]
    },
    xaxis: {
      type: 'datetime',
      labels: {
        show: isModal,
        style: { colors: '#64748b', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' },
        datetimeUTC: false
      },
      axisBorder: { show: isModal, color: 'rgba(255,255,255,0.08)' },
      axisTicks: { show: isModal, color: 'rgba(255,255,255,0.08)' }
    },
    yaxis: [
      {
        seriesName: 'Price',
        min: minPrice,
        labels: {
          style: { colors: '#94a3b8', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' },
          formatter: (val) => (val ? `₹${val.toFixed(1)}` : '')
        }
      },
      {
        seriesName: 'Volume',
        opposite: true,
        max: maxVolume ? maxVolume * 4.5 : undefined,
        labels: { show: false }
      }
    ],
    theme: { mode: 'dark' },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: {
      shared: true,
      custom: function ({ dataPointIndex, w }) {
        const candleData = w.config.series[0]?.data[dataPointIndex];
        const volumeData = w.config.series[1]?.data[dataPointIndex];

        if (!candleData || !volumeData) return '';

        const time = new Date(candleData.x).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const [o, h, l, c] = candleData.y;
        const v = volumeData.y;

        const isGain = c >= o;
        const color = isGain ? '#10b981' : '#f43f5e';
        const risk = Math.max(h - l, 0.05);
        const quantity = risk > 0 ? Math.floor(maxLoss / risk) : 0;
        const capitalRequired = quantity * h;
        const maxQuantity = h > 0 ? Math.floor((totalCapital * 5) / h) : 0;
        const actualLoss = maxQuantity * risk;

        return `
          <div style="padding: 12px 14px; background: rgba(13, 19, 34, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); color: #f1f5f9; font-family: 'DM Sans', sans-serif; font-size: 12px; min-width: 220px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.08);">
              <strong style="color: #60a5fa; font-family: 'JetBrains Mono', monospace; font-size: 13px;">${symbol}</strong>
              <span style="color: #94a3b8; font-family: 'JetBrains Mono', monospace; font-size: 11px;">${time}</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; margin-bottom: 8px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
              <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">O:</span> <strong>₹${o.toFixed(2)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">H:</span> <strong>₹${h.toFixed(2)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">L:</span> <strong>₹${l.toFixed(2)}</strong></div>
              <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">C:</span> <strong style="color: ${color};">₹${c.toFixed(2)}</strong></div>
            </div>

            <div style="padding: 4px 0; border-top: 1px dashed rgba(255,255,255,0.08); border-bottom: 1px dashed rgba(255,255,255,0.08); font-family: 'JetBrains Mono', monospace; font-size: 11px; display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #94a3b8;">Vol:</span> <strong>${Number(v).toLocaleString('en-IN')}</strong>
            </div>

            <div style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px;">
              <div style="display: flex; justify-content: space-between; color: #94a3b8; margin-bottom: 3px;">
                <span>Risk/Share:</span> <strong>₹${risk.toFixed(2)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #34d399; margin-bottom: 3px;">
                <span>Qty to Trade:</span> <strong>${quantity} shares</strong>
              </div>
              <div style="display: flex; justify-content: space-between; color: #94a3b8;">
                <span>Allocated Cap:</span> <strong>₹${capitalRequired.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>
              </div>
            </div>
          </div>
        `;
      }
    },
    annotations: targetAnnotation
      ? {
          points: [
            {
              x: new Date(targetAnnotation.timestamp).getTime(),
              y: targetAnnotation.high,
              marker: {
                size: 6,
                fillColor: type === 'gainer' ? '#f43f5e' : '#10b981',
                strokeColor: '#fff',
                strokeWidth: 2
              },
              label: {
                borderColor: type === 'gainer' ? 'rgba(244, 63, 94, 0.8)' : 'rgba(16, 185, 129, 0.8)',
                style: {
                  color: '#fff',
                  background: type === 'gainer' ? '#f43f5e' : '#10b981',
                  fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace'
                },
                text: type === 'gainer' ? 'Lowest Vol Red' : 'Lowest Vol Green',
                offsetY: -10
              }
            }
          ]
        }
      : {}
  };

  return (
    <>
      {loading && chartData.length === 0 && (
        <div className="chart-loading">
          <span className="live-dot" />
          Loading {symbol} chart…
        </div>
      )}
      {error && <p className="chart-error">Error loading chart: {error}</p>}
      {chartData.length > 0 && !error ? (
        <div style={{ pointerEvents: 'auto' }}>
          <Chart options={options} series={chartData} type="line" height={isModal ? 520 : 250} />
        </div>
      ) : null}
    </>
  );
}