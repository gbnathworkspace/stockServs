import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from './components/Card.jsx';
import TabCard from './components/TabCard.jsx';
import PortfolioCard from './components/PortfolioCard.jsx';
import VirtualTrading from './components/VirtualTrading.jsx';
import Settings from './components/Settings.jsx';
import { authApi } from './lib/api.js';

const API_BASE_URL = window.location.origin;

// Helper to extract name from email
const getNameFromEmail = (email) => {
  if (!email) return 'User';
  const localPart = email.split('@')[0];
  // Capitalize first letter and handle dots/underscores
  return localPart
    .split(/[._]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

function App() {
  const navigate = useNavigate();
  const isAuthed = Boolean(localStorage.getItem('access_token'));
  const userEmail = localStorage.getItem('user_email') || 'User';
  const userName = getNameFromEmail(userEmail);
  const [status, setStatus] = useState('Idle');
  const [activeView, setActiveView] = useState('market');
  const [showSettings, setShowSettings] = useState(false);
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [bulkDeals, setBulkDeals] = useState([]);
  const [weekly, setWeekly] = useState(null);
  const [fiiDii, setFiiDii] = useState(null);
  const [indices, setIndices] = useState([]);
  const [appVersion, setAppVersion] = useState('');

  // Fetch version on mount
  useEffect(() => {
    fetch('/static/version.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => setAppVersion(`v${data.version}`))
      .catch(() => setAppVersion('v1.0.0'));
  }, []);

  // Fetch market indices on mount
  useEffect(() => {
    if (!isAuthed) return;
    const fetchIndices = async () => {
      try {
        const res = await authApi(`${API_BASE_URL}/nse_data/indices`);
        setIndices(res.indices || []);
      } catch (err) {
        console.log('Failed to fetch indices', err);
        // Fallback with empty or cached data
      }
    };
    fetchIndices();
    // Refresh indices every 30 seconds
    const interval = setInterval(fetchIndices, 30000);
    return () => clearInterval(interval);
  }, [isAuthed]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    navigate('/login');
  };

  const [loading, setLoading] = useState({
    gainers: false,
    losers: false,
    bulkDeals: false,
    weekly: false,
    fiiDii: false,
  });

  const [loaded, setLoaded] = useState({
    gainers: false,
    losers: false,
    bulkDeals: false,
    weekly: false,
    fiiDii: false,
  });

  const handleFetch = async (key, fn) => {
    if (!isAuthed) {
      setStatus('Login required');
      return;
    }
    if (loading[key]) return;
    setLoading((s) => ({ ...s, [key]: true }));
    setStatus(`Loading ${key}...`);
    try {
      await fn();
      setLoaded((s) => ({ ...s, [key]: true }));
      setStatus(`Loaded ${key}`);
    } catch (err) {
      console.error(`Failed to load ${key}`, err);
      setStatus(`Failed to load ${key}`);
    } finally {
      setLoading((s) => ({ ...s, [key]: false }));
      setTimeout(() => setStatus('Idle'), 1200);
    }
  };

  const loadGainers = () =>
    handleFetch('gainers', async () => {
      const res = await authApi(`${API_BASE_URL}/nse_data/top-gainers`);
      setGainers(res.top_gainers || []);
    });

  const loadLosers = () =>
    handleFetch('losers', async () => {
      const res = await authApi(`${API_BASE_URL}/nse_data/top-losers`);
      setLosers(res.top_losers || []);
    });

  const loadBulk = () =>
    handleFetch('bulkDeals', async () => {
      const res = await authApi(`${API_BASE_URL}/nse_data/bulk-deals`);
      setBulkDeals(res.bulk_deals || []);
    });

  const loadWeekly = () =>
    handleFetch('weekly', async () => {
      const res = await authApi(`${API_BASE_URL}/nse_data/weekly-gainers?days=5`);
      setWeekly(res);
    });

  const loadFiiDii = () =>
    handleFetch('fiiDii', async () => {
      const res = await authApi(`${API_BASE_URL}/nse_data/fii-dii-activity`);
      setFiiDii(res);
    });

  return (
    <div className="page">
      {/* Market Indices Ticker */}
      {indices.length > 0 && (
        <div className="indices-ticker">
          {indices.map((idx) => (
            <div key={idx.index} className="index-item">
              <span className="index-name">{idx.index}</span>
              <span className="index-value">₹{Number(idx.last || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className={`index-change ${(idx.percentChange || 0) >= 0 ? 'positive' : 'negative'}`}>
                {(idx.percentChange || 0) >= 0 ? '▲' : '▼'} {Math.abs(idx.percentChange || 0).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}

      <header className="topbar">
        <div>
          <div className="title-row">
            <p className="eyebrow">Stock Servs</p>
            {appVersion && <span className="version-badge">{appVersion}</span>}
          </div>
          <h1>Market Dashboard</h1>
          <p className="muted">Real-time market data and portfolio tracking</p>
        </div>
        <div className="topbar-right">
          <span className="user-name" title={userEmail}>👤 {userName}</span>
          <div className="chip">{status}</div>
          <button 
            className="settings-btn" 
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="view-tabs">
        <button
          className={`view-tab ${activeView === 'market' ? 'active' : ''}`}
          onClick={() => setActiveView('market')}
        >
          Market Movers
        </button>
        <button
          className={`view-tab ${activeView === 'trading' ? 'active' : ''}`}
          onClick={() => setActiveView('trading')}
        >
          Virtual Trading
        </button>
      </div>

      {activeView === 'market' && (
        <div className="grid">
          <TabCard
            title="Top Movers"
            disabled={!isAuthed}
            tabs={[
              {
                key: 'gainers',
                label: 'Top Gainers',
                onLoad: loadGainers,
                isLoaded: loaded.gainers,
                isLoading: loading.gainers,
                rows: gainers,
                tone: 'positive',
              },
              {
                key: 'losers',
                label: 'Top Losers',
                onLoad: loadLosers,
                isLoaded: loaded.losers,
                isLoading: loading.losers,
                rows: losers,
                tone: 'negative',
              },
            ]}
          />

          <Card
            title="Bulk Deals"
            actionLabel={loaded.bulkDeals ? 'Refresh' : 'Load'}
            onAction={loadBulk}
            isLoading={loading.bulkDeals}
            disabled={!isAuthed}
          >
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Client</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkDeals.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="loading">
                        {loaded.bulkDeals ? 'No data' : 'Click load to fetch bulk deals'}
                      </td>
                    </tr>
                  ) : (
                    bulkDeals.slice(0, 10).map((item) => (
                      <tr key={`${item.symbol}-${item.clientName}-${item.tradePrice}`}>
                        <td>{item.symbol || item.BD_SYMBOL || 'N/A'}</td>
                        <td>{item.clientName || item.client_name || item.BD_CLIENT_NAME || 'N/A'}</td>
                        <td className="text-right">
                          {(item.quantity || item.quantityTraded || item.BD_QTY_TRD || 0).toLocaleString()}
                        </td>
                        <td className="text-right">
                          ₹{Number(item.tradePrice || item.price || item.BD_TP_WATP || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Weekly Movers"
            actionLabel={loaded.weekly ? 'Refresh' : 'Load'}
            onAction={loadWeekly}
            isLoading={loading.weekly}
            disabled={!isAuthed}
          >
            <div className="weekly-container">
              {weekly?.weeklyData?.length ? (
                weekly.weeklyData.map((day) => (
                  <div key={day.dayName + day.date} className="weekly-column">
                    <div className="weekly-header">
                      <div>{day.dayName}</div>
                      <span className="muted">{day.date}</span>
                    </div>
                    <div className="weekly-block">
                      <div className="section-label positive">Top Gainers</div>
                      {(day.gainers || []).slice(0, 5).map((g) => (
                        <div className="mini-row" key={`g-${g.symbol}`}>
                          <span>{g.symbol}</span>
                          <span className="text-right positive">{g.pChange?.toFixed(2)}%</span>
                        </div>
                      ))}
                      <div className="section-label negative">Top Losers</div>
                      {(day.losers || []).slice(0, 5).map((l) => (
                        <div className="mini-row" key={`l-${l.symbol}`}>
                          <span>{l.symbol}</span>
                          <span className="text-right negative">{l.pChange?.toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="loading">{loaded.weekly ? 'No weekly data' : 'Click load to fetch weekly movers'}</div>
              )}
            </div>
          </Card>

          <Card
            title="FII/DII Activity"
            actionLabel={loaded.fiiDii ? 'Refresh' : 'Load'}
            onAction={loadFiiDii}
            isLoading={loading.fiiDii}
            disabled={!isAuthed}
          >
            {fiiDii ? (
              <div className="fii-dii-container">
                <div className="fii-dii-row">
                  <div className="fii-dii-block">
                    <div className="fii-dii-title">FII (Foreign)</div>
                    <div className="fii-dii-stats">
                      <div className="fii-dii-stat">
                        <span className="label">Buy</span>
                        <span className="value positive">₹{((fiiDii.fii?.buyValue || 0) / 100).toFixed(0)} Cr</span>
                      </div>
                      <div className="fii-dii-stat">
                        <span className="label">Sell</span>
                        <span className="value negative">₹{((fiiDii.fii?.sellValue || 0) / 100).toFixed(0)} Cr</span>
                      </div>
                      <div className="fii-dii-stat net">
                        <span className="label">Net</span>
                        <span className={`value ${(fiiDii.fii?.netValue || 0) >= 0 ? 'positive' : 'negative'}`}>
                          {(fiiDii.fii?.netValue || 0) >= 0 ? '+' : ''}₹{((fiiDii.fii?.netValue || 0) / 100).toFixed(0)} Cr
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="fii-dii-block">
                    <div className="fii-dii-title">DII (Domestic)</div>
                    <div className="fii-dii-stats">
                      <div className="fii-dii-stat">
                        <span className="label">Buy</span>
                        <span className="value positive">₹{((fiiDii.dii?.buyValue || 0) / 100).toFixed(0)} Cr</span>
                      </div>
                      <div className="fii-dii-stat">
                        <span className="label">Sell</span>
                        <span className="value negative">₹{((fiiDii.dii?.sellValue || 0) / 100).toFixed(0)} Cr</span>
                      </div>
                      <div className="fii-dii-stat net">
                        <span className="label">Net</span>
                        <span className={`value ${(fiiDii.dii?.netValue || 0) >= 0 ? 'positive' : 'negative'}`}>
                          {(fiiDii.dii?.netValue || 0) >= 0 ? '+' : ''}₹{((fiiDii.dii?.netValue || 0) / 100).toFixed(0)} Cr
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {fiiDii.date && <div className="fii-dii-date muted">Data as of: {fiiDii.date}</div>}
              </div>
            ) : (
              <div className="loading">{loaded.fiiDii ? 'No data available' : 'Click load to fetch FII/DII activity'}</div>
            )}
          </Card>

          <PortfolioCard disabled={!isAuthed} />
        </div>
      )}

      {activeView === 'trading' && (
        <VirtualTrading />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

export default App;
