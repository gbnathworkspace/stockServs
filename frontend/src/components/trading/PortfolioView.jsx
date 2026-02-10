import React from 'react';

function parseSymbolDisplay(symbol) {
  // Parse F&O symbols like "NSE:NIFTY2621225000CE" into readable format
  const s = (symbol || '').toUpperCase();

  // Match Fyers option format: NSE:SYMBOL + YYMMDD or YY+MONTHCODE+DD + STRIKE + CE/PE
  const fnoMatch = s.match(/^(?:NSE:)?([A-Z]+?)(\d{2})(\w)(\d{2})(\d+)(CE|PE)$/);
  if (fnoMatch) {
    const [, underlying, , , , strike, type] = fnoMatch;
    return { display: `${underlying} ${strike} ${type}`, isFno: true, underlying, strike, type };
  }

  // Match monthly format: NSE:NIFTY26FEB25000CE
  const monthlyMatch = s.match(/^(?:NSE:)?([A-Z]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$/);
  if (monthlyMatch) {
    const [, underlying, , month, strike, type] = monthlyMatch;
    return { display: `${underlying} ${strike} ${type} (${month})`, isFno: true, underlying, strike, type };
  }

  // Check if it ends with CE/PE with digits — generic F&O detection
  if ((s.endsWith('CE') || s.endsWith('PE')) && /\d/.test(s)) {
    const type = s.slice(-2);
    const clean = s.replace(/^NSE:/, '');
    return { display: clean, isFno: true, underlying: clean, strike: '', type };
  }

  // Regular equity symbol
  return { display: symbol, isFno: false };
}

export default function PortfolioView({ 
  portfolio, 
  loading, 
  onSelectHolding 
}) {
  const hasAllPrices = portfolio.every(item => item.ltp != null && item.ltp > 0);
  const totalValue = portfolio.reduce((sum, item) => {
    const price = (item.ltp != null && item.ltp > 0) ? item.ltp : item.average_price;
    return sum + (item.quantity * price);
  }, 0);
  const totalInvested = portfolio.reduce((sum, item) => sum + (item.quantity * item.average_price), 0);
  const totalPnl = totalValue - totalInvested;
  
  return (
    <div className="portfolio-container">
      <div className="portfolio-summary">
        <div className="summary-card">
          <span className="label">Current Value</span>
          <span className="value">{hasAllPrices ? `₹${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—'}</span>
        </div>
        <div className="summary-card">
          <span className="label">Invested</span>
          <span className="value">₹{totalInvested.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div className={`summary-card ${hasAllPrices ? (totalPnl >= 0 ? 'positive' : 'negative') : ''}`}>
          <span className="label">Total P&L</span>
          <span className="value">
            {hasAllPrices
              ? `${totalPnl >= 0 ? '+' : '-'}₹${Math.abs(totalPnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
              : '—'}
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
                 const hasLtp = item.ltp != null && item.ltp > 0;
                 const currVal = hasLtp ? item.quantity * item.ltp : null;
                 const invested = item.quantity * item.average_price;
                 const pnl = currVal != null ? currVal - invested : null;
                 const pnlPercent = pnl != null && invested > 0 ? (pnl / invested) * 100 : null;
                 const parsed = parseSymbolDisplay(item.symbol);

                 return (
                  <tr key={idx} onClick={() => onSelectHolding(item)} className="clickable-row">
                    <td className="font-medium">
                      {parsed.display}
                      {parsed.isFno && (
                        <span style={{ marginLeft: '6px', padding: '1px 5px', background: 'rgba(255, 165, 0, 0.15)', color: '#ffa500', borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600, verticalAlign: 'middle' }}>F&O</span>
                      )}
                    </td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">₹{item.average_price.toFixed(2)}</td>
                    <td className="text-right">{hasLtp ? `₹${item.ltp.toFixed(2)}` : '-'}</td>
                    <td className="text-right">{currVal != null ? `₹${currVal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}</td>
                    <td className={`text-right ${pnl != null ? (pnl >= 0 ? 'positive' : 'negative') : ''}`}>
                      {pnl != null ? (
                        <>
                          <div>{pnl >= 0 ? '+' : '-'}₹{Math.abs(pnl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          <div className="sub-text">({pnlPercent >= 0 ? '+' : '-'}{Math.abs(pnlPercent).toFixed(2)}%)</div>
                        </>
                      ) : <div>-</div>}
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
