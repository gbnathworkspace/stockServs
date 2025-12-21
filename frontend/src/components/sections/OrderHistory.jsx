import React, { useState, useEffect } from 'react';
import { authApi } from '../../lib/api.js';

const API_BASE_URL = window.location.origin;

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, buy, sell

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/orders`);
      setOrders(res.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.side?.toLowerCase() === filter;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="orders-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">📋</span>
          <h2>Order History</h2>
        </div>
        <div className="section-actions">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${filter === 'buy' ? 'active' : ''}`}
              onClick={() => setFilter('buy')}
            >
              Buy
            </button>
            <button
              className={`filter-tab ${filter === 'sell' ? 'active' : ''}`}
              onClick={() => setFilter('sell')}
            >
              Sell
            </button>
          </div>
          <button onClick={loadOrders} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No Orders Yet</div>
          <div className="empty-state-text">
            Start trading to see your order history here.
          </div>
        </div>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => (
                <tr key={order.id || idx}>
                  <td>{formatDate(order.created_at)}</td>
                  <td className="order-symbol">{order.symbol}</td>
                  <td>
                    <span className={`order-side ${order.side?.toLowerCase()}`}>
                      {order.side}
                    </span>
                  </td>
                  <td>{order.quantity}</td>
                  <td>₹{Number(order.price || 0).toLocaleString()}</td>
                  <td>₹{Number(order.total_value || 0).toLocaleString()}</td>
                  <td>
                    <span className={`order-status ${order.status?.toLowerCase() || 'filled'}`}>
                      {order.status || 'Filled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order Summary */}
      {orders.length > 0 && (
        <div className="orders-summary">
          <div className="summary-item">
            <span className="summary-label">Total Orders</span>
            <span className="summary-value">{orders.length}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Buy Orders</span>
            <span className="summary-value positive">
              {orders.filter(o => o.side?.toLowerCase() === 'buy').length}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Sell Orders</span>
            <span className="summary-value negative">
              {orders.filter(o => o.side?.toLowerCase() === 'sell').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
