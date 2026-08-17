import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from './config';

export function useMarketData(pollingInterval = 30000) {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(Date.now());

  const fetchData = useCallback(async (abortController) => {
    // Only show full loading state on initial fetch
    if (!marketData) {
      setLoading(true);
    }

    try {
      const [stocksResponse, sectorsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/stocks`, { signal: abortController.signal }),
        fetch(`${API_BASE_URL}/api/sector-performance`, { signal: abortController.signal })
      ]);

      if (!stocksResponse.ok) throw new Error("Failed to fetch stock data");
      if (!sectorsResponse.ok) throw new Error("Failed to fetch sector data");

      const stocks = await stocksResponse.json();
      const sectors = await sectorsResponse.json();

      setMarketData({ stocksData: stocks, sectorData: sectors });
      setLastFetchTime(Date.now());
      setError(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        console.error("Error fetching data:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [marketData]); // Depends on marketData to decide whether to set loading

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

  return { marketData, loading, error, lastFetchTime, forceRefresh };
}