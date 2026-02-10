import React, { useState, useEffect } from 'react';
import './modal.css';

export default function TradeModal({
  isOpen,
  onClose,
  stock,
  walletBalance,
  onTrade,
  isSubmitting,
  mode = 'virtual'
}) {
  const isLive = mode === 'real';
  const [form, setForm] = useState({
    quantity: 1,
    price: '',
    orderType: 'market',
    broker: isLive ? 'fyers' : 'virtual'
  });

  useEffect(() => {
    if (stock) {
      setForm(prev => ({
        ...prev,
        price: stock.lastPrice ? stock.lastPrice.toFixed(2) : '',
        quantity: stock.quantity || 1,
        broker: isLive ? 'fyers' : prev.broker
      }));
    }
  }, [stock, isLive]);

  if (!isOpen || !stock) return null;

  const price = parseFloat(form.price) || 0;
  const qty = parseInt(form.quantity) || 0;
  const totalValue = price * qty;
  const displayName = stock.displayName || stock.symbol;
  const hasPrice = stock.lastPrice && stock.lastPrice > 0;
  const isFno = stock.isFno || false;

  const handleSubmit = (side) => {
    onTrade(side, form);
  };

  return (
    <div className="stock-modal-overlay show" style={{zIndex: 10000}}>
      <div className="stock-modal-content trade-modal">
        <button className="modal-close" onClick={onClose}>&times;</button>

        <div className="modal-header">
          <h2>{displayName}</h2>
          {stock.displayName && stock.displayName !== stock.symbol && (
            <span className="modal-subtitle">{stock.symbol}</span>
          )}
          <div className="stock-price-info">
            <span className="stock-price">
              {hasPrice ? `₹${stock.lastPrice.toFixed(2)}` : '₹ --'}
            </span>
            {hasPrice && (
              <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                {stock.pChange >= 0 ? '+' : ''}{stock.pChange?.toFixed(2)}%
              </span>
            )}
          </div>
        {isFno && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', background: 'rgba(255, 165, 0, 0.2)', color: '#ffa500', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>F&O</span>
            {stock.quantity > 1 && (
              <span style={{ fontSize: '0.8rem', color: '#768390' }}>Lot size: {stock.quantity}</span>
            )}
          </div>
        )}
        </div>

        {!hasPrice && (
          <div className="trade-warning">
            Market closed — enter price manually or wait for market hours
          </div>
        )}

        <div className="trade-form">
          {!isLive && (
            <div className="form-group">
              <label>Broker</label>
              <div className="toggle-group">
                 <button
                  className={`toggle-btn ${form.broker === 'virtual' ? 'active' : ''}`}
                  onClick={() => setForm({...form, broker: 'virtual'})}
                 >Virtual</button>
                 <button
                  className={`toggle-btn ${form.broker === 'fyers' ? 'active' : ''}`}
                  onClick={() => setForm({...form, broker: 'fyers'})}
                 >Fyers Live</button>
              </div>
            </div>
          )}
          {isLive && (
            <div className="trade-modal-live-banner">
              Fyers Live Order
            </div>
          )}

          <div className="form-group">
            <label>Order Type</label>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${form.orderType === 'market' ? 'active' : ''}`}
                onClick={() => setForm({...form, orderType: 'market'})}
              >Market</button>
              <button
                className={`toggle-btn ${form.orderType === 'limit' ? 'active' : ''}`}
                onClick={() => setForm({...form, orderType: 'limit'})}
              >Limit</button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({...form, quantity: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                step="0.05"
                value={form.price}
                onChange={(e) => setForm({...form, price: e.target.value})}
                disabled={form.orderType === 'market' && hasPrice}
                placeholder={hasPrice ? '' : 'Enter price'}
              />
            </div>
          </div>

          <div className="trade-summary">
            <div className="summary-row">
              <span>Total Value</span>
              <span>₹{totalValue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            {form.broker === 'virtual' && (
              <div className="summary-row">
                <span>Available Balance</span>
                <span>₹{walletBalance?.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          <div className="trade-actions">
            <button
              className="trade-btn buy-btn"
              onClick={() => handleSubmit('BUY')}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'BUY'}
            </button>
            <button
              className="trade-btn sell-btn"
              onClick={() => handleSubmit('SELL')}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'SELL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
