import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../lib/api';

export default function MarketPulse() {
  const [filterType, setFilterType] = useState('volume');
  const [loading, setLoading] = useState(true);
  const [volumeSurge, setVolumeSurge] = useState([]);
  const [deliveryLeaders, setDeliveryLeaders] = useState([]);
  const [blockActivity, setBlockActivity] = useState([]);
  const [error, setError] = useState(null);

  const filters = [
    { id: 'volume', label: 'Volume Surge', icon: '📊' },
    { id: 'delivery', label: 'High Delivery %', icon: '💰' },
    { id: 'blocks', label: 'Block Deals', icon: '🏢' }
  ];

  // Fetch Market Pulse data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const baseURL = 'http://localhost:8000';

        // Fetch volume surge data
        const volumeResponse = await fetch(`${baseURL}/market-pulse/volume-surge?min_ratio=2.0`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (volumeResponse.ok) {
          const volumeData = await volumeResponse.json();
          setVolumeSurge(volumeData.stocks || []);
        }

        // Fetch delivery leaders
        const deliveryResponse = await fetch(`${baseURL}/market-pulse/delivery-leaders?min_pct=60`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (deliveryResponse.ok) {
          const deliveryData = await deliveryResponse.json();
          setDeliveryLeaders(deliveryData.stocks || []);
        }

        // Fetch block activity
        const blockResponse = await fetch(`${baseURL}/market-pulse/block-activity?days=1`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (blockResponse.ok) {
          const blockData = await blockResponse.json();
          setBlockActivity(blockData.deals || []);
        }

      } catch (err) {
        console.error('Error fetching Market Pulse data:', err);
        setError('Failed to load Market Pulse data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Render volume surge stocks
  const renderVolumeSurge = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Volume Ratio</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {volumeSurge.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No volume surges detected
              </td>
            </tr>
          ) : (
            volumeSurge.slice(0, 20).map((stock, index) => (
              <tr key={index}>
                <td className="symbol-cell">{stock.symbol}</td>
                <td>₹{stock.ltp?.toFixed(2)}</td>
                <td className={stock.priceChangePct >= 0 ? 'positive' : 'negative'}>
                  {stock.priceChangePct >= 0 ? '+' : ''}{stock.priceChangePct?.toFixed(2)}%
                </td>
                <td>
                  <span className="badge badge-blue">
                    {stock.volumeRatio?.toFixed(1)}x
                  </span>
                </td>
                <td>
                  <span className={`badge ${stock.priceChangePct >= 3 ? 'badge-green' : 'badge-yellow'}`}>
                    {stock.priceChangePct >= 3 ? 'Strong' : 'Moderate'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render delivery leaders
  const renderDeliveryLeaders = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Delivery %</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {deliveryLeaders.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No high delivery stocks found
              </td>
            </tr>
          ) : (
            deliveryLeaders.slice(0, 20).map((stock, index) => (
              <tr key={index}>
                <td className="symbol-cell">{stock.symbol}</td>
                <td>₹{stock.ltp?.toFixed(2)}</td>
                <td className={stock.priceChangePct >= 0 ? 'positive' : 'negative'}>
                  {stock.priceChangePct >= 0 ? '+' : ''}{stock.priceChangePct?.toFixed(2)}%
                </td>
                <td>
                  <span className="badge badge-green">
                    {stock.deliveryPct?.toFixed(1)}%
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {stock.deliveryPct >= 70 ? 'Institutional' : 'Smart Money'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render block deals
  const renderBlockDeals = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Type</th>
            <th>Client</th>
            <th>Quantity</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {blockActivity.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No block deals found
              </td>
            </tr>
          ) : (
            blockActivity.slice(0, 20).map((deal, index) => (
              <tr key={index}>
                <td className="symbol-cell">{deal.symbol}</td>
                <td>
                  <span className={`badge ${deal.dealType === 'buy' ? 'badge-green' : 'badge-red'}`}>
                    {deal.dealType?.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  {deal.clientName?.substring(0, 30)}...
                </td>
                <td>{deal.quantity?.toLocaleString()}</td>
                <td>₹{deal.price?.toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">💓</span>
          <h2>Market Pulse</h2>
        </div>
        <p className="section-subtitle">
          Detect institutional activity and smart money flow
        </p>
      </div>

      {/* Stats Summary */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📊</div>
          </div>
          <div className="stat-card-label">Volume Surges</div>
          <div className="stat-card-value">{volumeSurge.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💰</div>
          </div>
          <div className="stat-card-label">Delivery Leaders</div>
          <div className="stat-card-value">{deliveryLeaders.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">🏢</div>
          </div>
          <div className="stat-card-label">Block Deals</div>
          <div className="stat-card-value">{blockActivity.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🎯</div>
          </div>
          <div className="stat-card-label">Active Signals</div>
          <div className="stat-card-value">
            {volumeSurge.filter(s => s.priceChangePct >= 3).length}
          </div>
        </div>
      </div>

      {/* Filter Selector */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="filter-buttons">
          {filters.map(filter => (
            <button
              key={filter.id}
              className={`filter-btn ${filterType === filter.id ? 'active' : ''}`}
              onClick={() => setFilterType(filter.id)}
            >
              <span style={{ marginRight: '0.5rem' }}>{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Display */}
      <div className="card" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
            Loading Market Pulse data...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)', opacity: 0.8 }}>
            {error}
          </div>
        ) : (
          <>
            {filterType === 'volume' && renderVolumeSurge()}
            {filterType === 'delivery' && renderDeliveryLeaders()}
            {filterType === 'blocks' && renderBlockDeals()}
          </>
        )}
      </div>
    </div>
  );
}
