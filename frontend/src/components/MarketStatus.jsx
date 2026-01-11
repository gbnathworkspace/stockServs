import React, { useState, useEffect } from 'react';
import { authApi } from '../lib/api';
import useAutoRefresh from '../hooks/useAutoRefresh';

const MarketStatus = () => {
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIndices = async () => {
    try {
      const res = await authApi(`${window.location.origin}/nse_data/major-indices`);
      if (res.indices) {
        setIndices(res.indices);
      }
    } catch (err) {
      console.error("Failed to load major indices", err);
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

  return (
    <div className="market-status-bar">
      {indices.map((index) => (
        <div key={index.symbol} className="market-index-item">
          <div className="index-name">
            {index.symbol}
            <span className="index-exchange">{index.exchange}</span>
          </div>
          <div className="index-price-group">
            <span className="index-price">{index.last.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            <span className={`index-change ${index.change >= 0 ? 'positive' : 'negative'}`}>
              {index.change >= 0 ? '+' : ''}{index.change.toFixed(2)} ({index.pChange.toFixed(2)}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MarketStatus;
