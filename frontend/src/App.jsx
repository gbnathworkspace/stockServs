import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './components/sections/Dashboard.jsx';
import VirtualTrading from './components/VirtualTrading.jsx';
import MarketData from './components/sections/MarketData.jsx';
import OrderHistory from './components/sections/OrderHistory.jsx';
import Wallet from './components/sections/Wallet.jsx';
import Watchlist from './components/sections/Watchlist.jsx';
import Settings from './components/sections/Settings.jsx';

function App() {
  const navigate = useNavigate();
  const isAuthed = Boolean(localStorage.getItem('access_token'));
  const userEmail = localStorage.getItem('user_email') || 'User';
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  // Fetch version and handle Fyers callback on mount
  useEffect(() => {
    fetch('/static/version.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => setAppVersion(`v${data.version}`))
      .catch(() => setAppVersion('v1.0.0'));

    // Handle Fyers callback
    const urlParams = new URLSearchParams(window.location.search);
    const s = urlParams.get('s');
    const code = urlParams.get('code');
    const id = urlParams.get('id');

    if (s === 'ok' && code) {
      handleFyersCallback(s, code, id);
    }
  }, []);

  const handleFyersCallback = async (s, code, id) => {
    try {
      const response = await fetch(`/fyers/callback?s=${s}&code=${code}&id=${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        alert('Fyers connected successfully!');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setActiveSection('settings.profile');
      } else {
        alert('Failed to connect Fyers: ' + data.detail);
      }
    } catch (error) {
      console.error('Error handling Fyers callback:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    navigate('/login');
  };

  const handleSectionChange = (sectionId) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false); // Close mobile menu on navigation
  };

  // Parse section and subsection
  const [mainSection, subSection] = activeSection.split('.');

  const renderContent = () => {
    switch (mainSection) {
      case 'dashboard':
        return <Dashboard onNavigate={handleSectionChange} />;

      case 'trading':
        if (subSection === 'portfolio' || subSection === 'orders') {
          return (
            <VirtualTrading
              initialTab={subSection === 'orders' ? 'orders' : 'portfolio'}
            />
          );
        }
        return <VirtualTrading initialTab="trade" />;

      case 'market':
        return <MarketData subSection={subSection || 'gainers'} />;

      case 'charts':
        return (
          <div className="coming-soon-section">
            <div className="empty-state">
              <div className="empty-state-icon">📉</div>
              <div className="empty-state-title">Charts & Analysis</div>
              <div className="empty-state-text">
                Advanced charting features are available when you trade stocks.
                Select a stock to view detailed candlestick charts with technical indicators.
              </div>
              <button className="primary-btn" onClick={() => handleSectionChange('trading.trade')}>
                Go to Trading
              </button>
            </div>
          </div>
        );

      case 'wallet':
        return <Wallet subSection={subSection || 'balance'} onNavigate={handleSectionChange} />;

      case 'watchlist':
        return <Watchlist onNavigate={handleSectionChange} />;

      case 'settings':
        return <Settings subSection={subSection || 'profile'} />;

      default:
        return <Dashboard onNavigate={handleSectionChange} />;
    }
  };

  const getSectionTitle = () => {
    const titles = {
      'dashboard': 'Dashboard',
      'trading': 'Virtual Trading',
      'trading.trade': 'Trade Stocks',
      'trading.portfolio': 'My Portfolio',
      'trading.orders': 'Order History',
      'market': 'Market Data',
      'market.gainers': 'Top Gainers',
      'market.losers': 'Top Losers',
      'market.weekly': 'Weekly Movers',
      'market.bulk': 'Bulk Deals',
      'charts': 'Charts & Analysis',
      'charts.candles': 'Candlestick Charts',
      'charts.indicators': 'Technical Indicators',
      'wallet': 'Wallet',
      'wallet.balance': 'Balance',
      'wallet.transactions': 'Transactions',
      'watchlist': 'Watchlist',
      'settings': 'Settings',
      'settings.profile': 'Profile',
      'settings.preferences': 'Preferences',
    };
    return titles[activeSection] || titles[mainSection] || 'Dashboard';
  };

  return (
    <div className="app-layout">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="main-header">
          <div className="header-left">
            {/* Mobile Hamburger Button */}
            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
            <h1 className="page-title">{getSectionTitle()}</h1>
            {appVersion && <span className="version-badge">{appVersion}</span>}
          </div>
          <div className="header-right">
            <span className="user-email">{userEmail}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="content-area">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
