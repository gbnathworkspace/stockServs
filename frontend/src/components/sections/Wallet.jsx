import React, { useState, useEffect } from 'react';
import { authApi } from '../../lib/api.js';

const API_BASE_URL = window.location.origin;

export default function Wallet({ subSection, onNavigate }) {
  const [walletData, setWalletData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // No auto-refresh - wallet data only loaded on mount and manual refresh
  // DB calls only happen when user interacts (load page, click refresh, make trade)

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      const [summaryRes, ordersRes] = await Promise.all([
        authApi(`${API_BASE_URL}/portfolio/summary`).catch(() => null),
        authApi(`${API_BASE_URL}/portfolio/orders`).catch(() => ({ orders: [] })),
      ]);

      setWalletData(summaryRes);
      setOrders(ordersRes.orders || []);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const balance = walletData?.wallet_balance ?? 100000;
  const invested = walletData?.total_invested ?? 0;
  const currentValue = walletData?.current_value ?? 0;
  const totalPnL = walletData?.total_pnl ?? 0;
  const netWorth = balance + currentValue;

  if (subSection === 'transactions') {
    return (
      <div className="wallet-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">📝</span>
            <h2>Transactions</h2>
          </div>
          <button onClick={loadWalletData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">No Transactions</div>
            <div className="empty-state-text">
              Start trading to see your transaction history here.
            </div>
            <button className="primary-btn" onClick={() => onNavigate('trading.trade')}>
              Start Trading
            </button>
          </div>
        ) : (
          <div className="orders-table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id || idx}>
                    <td>{formatDate(order.created_at)}</td>
                    <td>
                      {order.side === 'BUY' ? 'Bought' : 'Sold'} {order.quantity} {order.symbol}
                    </td>
                    <td>
                      <span className={`order-side ${order.side?.toLowerCase()}`}>
                        {order.side}
                      </span>
                    </td>
                    <td className={`text-right ${order.side === 'BUY' ? 'negative' : 'positive'}`}>
                      {order.side === 'BUY' ? '-' : '+'}₹{Number(order.total_value || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Balance view (default)
  return (
    <div className="wallet-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">💰</span>
          <h2>Wallet</h2>
        </div>
        <button onClick={loadWalletData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading wallet...</div>
      ) : (
        <>
          <div className="wallet-overview">
            <div className="wallet-balance-card">
              <div className="wallet-balance-label">Available Balance</div>
              <div className="wallet-balance-value">{formatCurrency(balance)}</div>
              <div className="wallet-balance-change">
                <span className={totalPnL >= 0 ? 'positive' : 'negative'}>
                  {totalPnL >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(totalPnL))} today
                </span>
              </div>
            </div>

            <div className="wallet-actions-card">
              <button className="wallet-action-btn" onClick={() => onNavigate('trading.trade')}>
                <span className="wallet-action-icon">💹</span>
                <span>Trade Stocks</span>
              </button>
              <button className="wallet-action-btn" onClick={() => onNavigate('wallet.transactions')}>
                <span className="wallet-action-icon">📝</span>
                <span>View Transactions</span>
              </button>
              <button className="wallet-action-btn" onClick={() => onNavigate('trading.portfolio')}>
                <span className="wallet-action-icon">📁</span>
                <span>View Portfolio</span>
              </button>
            </div>
          </div>

          <div className="wallet-stats-grid">
            <div className="wallet-stat-card">
              <div className="wallet-stat-icon">🏦</div>
              <div className="wallet-stat-content">
                <span className="wallet-stat-label">Net Worth</span>
                <span className="wallet-stat-value">{formatCurrency(netWorth)}</span>
              </div>
            </div>

            <div className="wallet-stat-card">
              <div className="wallet-stat-icon">📈</div>
              <div className="wallet-stat-content">
                <span className="wallet-stat-label">Invested</span>
                <span className="wallet-stat-value">{formatCurrency(invested)}</span>
              </div>
            </div>

            <div className="wallet-stat-card">
              <div className="wallet-stat-icon">💹</div>
              <div className="wallet-stat-content">
                <span className="wallet-stat-label">Current Value</span>
                <span className="wallet-stat-value">{formatCurrency(currentValue)}</span>
              </div>
            </div>

            <div className="wallet-stat-card">
              <div className="wallet-stat-icon">📊</div>
              <div className="wallet-stat-content">
                <span className="wallet-stat-label">Total P&L</span>
                <span className={`wallet-stat-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
                  {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
                </span>
              </div>
            </div>
          </div>

          {/* Recent Transactions Preview */}
          {orders.length > 0 && (
            <div className="wallet-recent">
              <div className="wallet-recent-header">
                <h3>Recent Transactions</h3>
                <button className="link-btn" onClick={() => onNavigate('wallet.transactions')}>
                  View All →
                </button>
              </div>
              <div className="wallet-recent-list">
                {orders.slice(0, 5).map((order, idx) => (
                  <div key={order.id || idx} className="wallet-recent-item">
                    <div className="wallet-recent-info">
                      <span className={`order-side ${order.side?.toLowerCase()}`}>
                        {order.side}
                      </span>
                      <span className="wallet-recent-desc">
                        {order.quantity} {order.symbol}
                      </span>
                    </div>
                    <span className={order.side === 'BUY' ? 'negative' : 'positive'}>
                      {order.side === 'BUY' ? '-' : '+'}₹{Number(order.total_value || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
