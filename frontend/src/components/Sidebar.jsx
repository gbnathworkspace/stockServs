import React, { useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  LineChart,
  Star,
  Settings,
  Activity,
  ChevronRight
} from 'lucide-react';

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    subsections: []
  },
  {
    id: 'trading',
    label: 'Trading',
    icon: TrendingUp,
    subsections: []
  },
  {
    id: 'market',
    label: 'Market Data',
    icon: LineChart,
    subsections: [
      { id: 'gainers', label: 'Top Gainers' },
      { id: 'losers', label: 'Top Losers' },
      { id: 'nifty-contributors', label: 'Nifty Contributors' },
      { id: 'fii-dii', label: 'FII/DII Activity' },
      { id: 'weekly', label: 'Weekly Movers' },
      { id: 'bulk', label: 'Bulk Deals' },
    ]
  },

  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: Star,
    subsections: []
  },
  {
    id: 'documentation',
    label: 'Platform Guide',
    icon: '📖',
    subsections: []
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    subsections: [
      { id: 'profile', label: 'Profile' },
      { id: 'preferences', label: 'Preferences' },
    ]
  },
];

export default function Sidebar({ activeSection, onSectionChange, collapsed, onToggleCollapse, mobileOpen, onMobileClose }) {
  // Accordion behavior: Only one menu expanded at a time (desktop focus)
  const [expandedMenus, setExpandedMenus] = useState([]);


  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => {
      // If clicking the currently expanded menu, collapse it
      if (prev.includes(menuId)) {
        return [];
      }
      // Otherwise, collapse all others and expand only this one
      return [menuId];
    });
  };

  const handleItemClick = (item, subsection = null) => {
    if (item.subsections.length > 0 && !subsection) {
      toggleMenu(item.id);
    } else {
      const sectionId = subsection ? `${item.id}.${subsection.id}` : item.id;
      onSectionChange(sectionId);
      // Close mobile menu on navigation
      if (mobileOpen && onMobileClose) {
        onMobileClose();
      }
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <>
            <div className="sidebar-brand">
              <span className="brand-icon"><Activity size={24} /></span>
              <span className="brand-text">StockServs</span>
            </div>
            <p className="sidebar-tagline">Smart Trading Intelligence</p>
          </>
        )}
        <button className="sidebar-toggle" onClick={onToggleCollapse}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const isExpanded = expandedMenus.includes(item.id);
          const isActive = activeSection === item.id || activeSection.startsWith(`${item.id}.`);
          const hasSubsections = item.subsections.length > 0;

          return (
            <div key={item.id} className={`nav-group ${isActive ? 'active' : ''}`}>
              <button
                className={`nav-item ${isActive && !hasSubsections ? 'active' : ''}`}
                onClick={() => handleItemClick(item)}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon">
                  {React.createElement(item.icon, { size: 20 })}
                </span>
                {!collapsed && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    {hasSubsections && (
                      <span className={`nav-arrow ${isExpanded ? 'expanded' : ''}`}>
                        <ChevronRight size={16} />
                      </span>
                    )}
                  </>
                )}
              </button>

              {!collapsed && hasSubsections && isExpanded && (
                <div className="nav-subsections">
                  {item.subsections.map(sub => (
                    <button
                      key={sub.id}
                      className={`nav-subitem ${activeSection === `${item.id}.${sub.id}` ? 'active' : ''}`}
                      onClick={() => handleItemClick(item, sub)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-footer-content">
            <span className="footer-label">
              {localStorage.getItem('trading_mode') === 'live' ? 'Live Trading Mode' : 'Sandbox Mode'}
            </span>
            <span className={`footer-badge ${localStorage.getItem('trading_mode') === 'live' ? 'footer-badge-live' : ''}`}>
              {localStorage.getItem('trading_mode') === 'live' ? 'LIVE' : 'DEMO'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
