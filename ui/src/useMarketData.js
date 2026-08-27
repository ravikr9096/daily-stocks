import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from './config';

export function useMarketData(pollingInterval = 30000) {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sectorsLoading, setSectorsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async (abortController) => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      // Step 1: top gainers/losers + market breadth (must complete before sectors)
      const stocksResponse = await fetch(`${API_BASE_URL}/api/stocks`, {
        signal: abortController.signal,
      });
      if (!stocksResponse.ok) throw new Error('Failed to fetch stock data');
      const stocks = await stocksResponse.json();
      if (stocks.error) throw new Error(stocks.error);

      setMarketData((prev) => ({ ...prev, stocksData: stocks }));
      setLastFetchTime(Date.now());
      setLoading(false);
      hasDataRef.current = true;

      // Step 2: sector data — fetched only after stocks, never in parallel
      setSectorsLoading(true);
      const sectorsResponse = await fetch(`${API_BASE_URL}/api/sector-performance`, {
        signal: abortController.signal,
      });
      if (!sectorsResponse.ok) throw new Error('Failed to fetch sector data');
      const sectors = await sectorsResponse.json();
      if (sectors.error) throw new Error(sectors.error);

      setMarketData((prev) => ({ ...prev, sectorData: sectors }));
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error('Error fetching data:', err);
      }
    } finally {
      setLoading(false);
      setSectorsLoading(false);
    }
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    fetchData(abortController);

    const intervalId = setInterval(() => fetchData(abortController), pollingInterval);

    return () => {
      abortController.abort();
      clearInterval(intervalId);
    };
  }, [fetchData, pollingInterval]);

  const forceRefresh = useCallback(() => {
    const abortController = new AbortController();
    fetchData(abortController);
  }, [fetchData]);

  return { marketData, loading, sectorsLoading, error, lastFetchTime, forceRefresh };
}
