import React from 'react';

export default function PortfolioView({ 
  portfolio, 
  loading, 
  onSelectHolding 
}) {
  const totalValue = portfolio.reduce((sum, item) => sum + (item.quantity * (item.ltp || item.average_price)), 0);
  const totalInvested = portfolio.reduce((sum, item) => sum + (item.quantity * item.average_price), 0);
  const totalPnl = totalValue - totalInvested;
  
  return (
    <div className="portfolio-container">
      <div className="portfolio-summary">
        <div className="summary-card">
          <span className="label">Current Value</span>
          <span className="value">₹{totalValue.toLocaleString()}</span>
        </div>
        <div className="summary-card">
          <span className="label">Invested</span>
          <span className="value">₹{totalInvested.toLocaleString()}</span>
        </div>
        <div className={`summary-card ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
          <span className="label">Total P&L</span>
          <span className="value">
            {totalPnl >= 0 ? '+' : '-'}₹{Math.abs(totalPnl).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="portfolio-list">
        {loading ? (
          <div className="loading-state">Loading portfolio...</div>
        ) : portfolio.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💼</div>
            <h3>Your portfolio is empty</h3>
            <p>Start trading to build your portfolio</p>
          </div>
        ) : (
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Avg. Price</th>
                <th className="text-right">LTP</th>
                <th className="text-right">Cur. Value</th>
                <th className="text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((item, idx) => {
                 const currVal = item.quantity * (item.ltp || item.average_price);
                 const pnl = currVal - (item.quantity * item.average_price);
                 const pnlPercent = (pnl / (item.quantity * item.average_price)) * 100;
                 
                 return (
                  <tr key={idx} onClick={() => onSelectHolding(item)} className="clickable-row">
                    <td className="font-medium">{item.symbol}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">₹{item.average_price.toFixed(2)}</td>
                    <td className="text-right">₹{item.ltp?.toFixed(2) || '-'}</td>
                    <td className="text-right">₹{currVal.toLocaleString()}</td>
                    <td className={`text-right ${pnl >= 0 ? 'positive' : 'negative'}`}>
                      <div>{pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString()}</div>
                      <div className="sub-text">({pnlPercent >= 0 ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%)</div>
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
