import React, { useState } from 'react';
import Card from './Card.jsx';
import { authApi } from '../lib/api.js';

const API_BASE_URL = window.location.origin;

const PortfolioCard = ({ disabled }) => {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadPortfolio = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio`);
      setHoldings(res.holdings || []);
      setLoaded(true);
    } catch (err) {
      console.error('Failed to load portfolio', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Virtual Portfolio"
      actionLabel={loaded ? 'Refresh' : 'Load'}
      onAction={loadPortfolio}
      isLoading={loading}
      disabled={disabled}
    >
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Avg Price</th>
              <th className="text-right">LTP</th>
              <th className="text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {!holdings.length ? (
              <tr>
                <td colSpan="5" className="loading">
                  {loaded ? 'No holdings yet' : 'Click load to fetch portfolio'}
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const pnlClass = h.pnl > 0 ? 'positive' : h.pnl < 0 ? 'negative' : '';
                return (
                  <tr key={h.symbol}>
                    <td>{h.symbol}</td>
                    <td className="text-right">{h.quantity}</td>
                    <td className="text-right">₹{Number(h.average_price).toFixed(2)}</td>
                    <td className="text-right">
                      {h.ltp !== null && h.ltp !== undefined ? `₹${Number(h.ltp).toFixed(2)}` : '--'}
                    </td>
                    <td className={`text-right ${pnlClass}`}>
                      {h.pnl !== null && h.pnl !== undefined ? `₹${Number(h.pnl).toFixed(2)}` : '--'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default PortfolioCard;
