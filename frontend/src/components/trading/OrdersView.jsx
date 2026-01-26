import React from 'react';

export default function OrdersView({ orders, loading }) {
  if (loading) return <div className="loading-state">Loading orders...</div>;
  
  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <h3>No orders yet</h3>
        <p>Your trade history will appear here</p>
      </div>
    );
  }

  return (
    <div className="orders-container">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Side</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Price</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order, idx) => (
            <tr key={order.id || idx}>
              <td>{new Date(order.created_at).toLocaleString('en-IN')}</td>
              <td className="font-medium">{order.symbol}</td>
              <td>{order.order_type || 'MARKET'}</td>
              <td>
                <span className={`badge ${order.side === 'BUY' ? 'bg-green' : 'bg-red'}`}>
                  {order.side}
                </span>
              </td>
              <td className="text-right">{order.quantity}</td>
              <td className="text-right">₹{order.price?.toFixed(2)}</td>
              <td className="text-right status-cell">
                 <span className="status-dot success"></span> Executed
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
