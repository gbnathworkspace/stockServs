import React, { useState, useEffect } from 'react';
import './modal.css';

export default function TradeModal({
  isOpen,
  onClose,
  stock,
  walletBalance,
  onTrade,
  isSubmitting
}) {
  const [form, setForm] = useState({
    quantity: 1,
    price: '',
    orderType: 'market',
    broker: 'virtual'
  });

  useEffect(() => {
    if (stock) {
      setForm(prev => ({
        ...prev,
        price: stock.lastPrice?.toFixed(2) || '',
        quantity: stock.quantity || 1 // defaulting to holding quantity if available, else 1
      }));
    }
  }, [stock]);

  if (!isOpen || !stock) return null;

  const totalValue = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 0);

  const handleSubmit = (side) => {
    onTrade(side, form);
  };

  return (
    <div className="stock-modal-overlay show" style={{zIndex: 10000}}>
      <div className="stock-modal-content">
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>{stock.symbol}</h2>
          <div className="stock-price-info">
            <span className="stock-price">₹{stock.lastPrice?.toFixed(2) || stock.ltp}</span>
            <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
              {stock.pChange >= 0 ? '+' : ''}{stock.pChange?.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="trade-form">
          <div className="form-group">
            <label>Broker</label>
            <div className="toggle-group">
               <button 
                className={`toggle-btn ${form.broker === 'virtual' ? 'active' : ''}`}
                onClick={() => setForm({...form, broker: 'virtual'})}
               >Virtual Sandbox</button>
               <button 
                className={`toggle-btn ${form.broker === 'fyers' ? 'active' : ''}`}
                onClick={() => setForm({...form, broker: 'fyers'})}
               >Fyers Live</button>
            </div>
          </div>

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
                value={form.price}
                onChange={(e) => setForm({...form, price: e.target.value})}
                disabled={form.orderType === 'market'}
              />
            </div>
          </div>

          <div className="trade-summary">
            <div className="summary-row">
              <span>Total Value</span>
              <span>₹{totalValue.toLocaleString()}</span>
            </div>
            {form.broker === 'virtual' && (
              <div className="summary-row">
                <span>Available Balance</span>
                <span>₹{walletBalance?.toLocaleString()}</span>
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
