import React, { useState, useEffect } from 'react';
import { authApi } from '../lib/api';
import useAutoRefresh from '../hooks/useAutoRefresh';

const MarketStatus = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fyersConnected, setFyersConnected] = useState(false);

  const fetchIndices = async () => {
    try {
      // Use Fyers market data endpoint for major indices
      const res = await authApi(`${window.location.origin}/fyers/market/major-indices`);
      setFyersConnected(res.fyers_connected ?? false);

      if (res.indices) {
        // Transform Fyers format to display format
        const formattedIndices = res.indices.map(idx => ({
          symbol: idx.symbol || idx.identifier,
          exchange: 'NSE',
          last: idx.lastPrice || 0,
          change: idx.change || 0,
          pChange: idx.pChange || 0,
          open: idx.open || 0,
          high: idx.high || 0,
          low: idx.low || 0,
          previousClose: idx.previousClose || 0
        }));
        setIndices(formattedIndices);
      }
    } catch (err) {
      console.error("Failed to load major indices from Fyers", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useAutoRefresh('market-status', fetchIndices, 10000);

  useEffect(() => {
    fetchIndices();
  }, []);

  if (loading && indices.length === 0) return <div className="market-status-loading">Loading market data...</div>;

  // Show message if Fyers not connected
  if (!fyersConnected && !loading && indices.length === 0) {
    return (
      <div className="market-status-bar market-status-disconnected">
        <span className="connect-prompt">Connect Fyers to view live indices</span>
      </div>
    );
  }

  return (
    <div className="market-status-bar">
      {indices.map((index) => (
        <div key={index.symbol} className="market-index-item">
          <div className="index-name">
            {index.symbol}
            <span className="index-exchange">{index.exchange}</span>
          </div>
          <div className="index-price-group">
            <span className="index-price">{(index.last || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className={`index-change ${(index.change || 0) >= 0 ? 'positive' : 'negative'}`}>
              {(index.change || 0) >= 0 ? '+' : ''}{(index.change || 0).toFixed(2)} ({(index.pChange || 0).toFixed(2)}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MarketStatus;
