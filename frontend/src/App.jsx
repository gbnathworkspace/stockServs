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
import OptionClock from './components/sections/OptionClock.jsx';
import OptionApex from './components/sections/OptionApex.jsx';
import MarketPulse from './components/sections/MarketPulse.jsx';
import InsiderStrategy from './components/sections/InsiderStrategy.jsx';
import SectorScope from './components/sections/SectorScope.jsx';
import SwingSpectrum from './components/sections/SwingSpectrum.jsx';
import RefreshControl from './components/RefreshControl.jsx';

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
    const authCode = urlParams.get('auth_code') || urlParams.get('code');
    const id = urlParams.get('id');
    const fyersConnected = urlParams.get('fyers_connected');
    const fyersError = urlParams.get('fyers_error');

    if (fyersConnected === 'true') {
      alert('Fyers connected successfully!');
      window.history.replaceState({}, document.title, window.location.pathname);
      setActiveSection('settings.profile');
    } else if (fyersError) {
      alert('Fyers connection failed: ' + fyersError);
      window.history.replaceState({}, document.title, window.location.pathname);
      setActiveSection('settings.profile');
    } else if (s === 'ok' && authCode) {
      // Legacy handling for direct redirects to /app/
      handleFyersCallback(s, authCode, id);
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

      case 'products':
        // Handle TradeFinder Products subsections
        switch (subSection) {
          case 'option-clock':
            return <OptionClock />;
          case 'option-apex':
            return <OptionApex />;
          case 'market-pulse':
            return <MarketPulse />;
          case 'insider-strategy':
            return <InsiderStrategy />;
          case 'sector-scope':
            return <SectorScope />;
          case 'swing-spectrum':
            return <SwingSpectrum />;
          default:
            return <OptionClock />; // Default to first product
        }

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
      'products': 'TradeFinder Products',
      'products.option-clock': 'Option Clock',
      'products.option-apex': 'Option Apex',
      'products.market-pulse': 'Market Pulse',
      'products.insider-strategy': 'Insider Strategy',
      'products.sector-scope': 'Sector Scope',
      'products.swing-spectrum': 'Swing Spectrum',
      'trading': 'Virtual Trading',
      'trading.trade': 'Trade Stocks',
      'trading.portfolio': 'My Portfolio',
      'trading.orders': 'Order History',
      'market': 'Market Data',
      'market.gainers': 'Top Gainers',
      'market.losers': 'Top Losers',
      'market.weekly': 'Weekly Movers',
      'market.bulk': 'Bulk Deals',
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
            <RefreshControl />
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
