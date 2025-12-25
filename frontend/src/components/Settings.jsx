import React from 'react';
import { useTheme, THEMES } from '../contexts/ThemeContext.jsx';

const Settings = ({ onClose }) => {
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      id: THEMES.DARK,
      name: 'Dark',
      description: 'Classic dark mode with deep blacks',
      icon: '🌙',
      preview: 'linear-gradient(135deg, #0a0b0e 0%, #131620 100%)',
    },
    {
      id: THEMES.LIGHT,
      name: 'Light',
      description: 'Clean and bright interface',
      icon: '☀️',
      preview: 'linear-gradient(135deg, #f5f7fa 0%, #e4e8ed 100%)',
    },
    {
      id: THEMES.GLASS,
      name: 'Glass',
      description: 'Translucent liquid glass aesthetic',
      icon: '✨',
      preview: 'linear-gradient(135deg, rgba(100,180,220,0.4) 0%, rgba(140,200,180,0.4) 50%, rgba(180,140,200,0.3) 100%)',
    },
  ];

  return (
    <div className="settings-modal" onClick={onClose}>
      <div className="settings-shell" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div>
            <h3>Settings</h3>
            <span className="muted">Customize your experience</span>
          </div>
          <button className="icon-button" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h4>Appearance</h4>
            <p className="muted">Choose your preferred theme</p>
            
            <div className="theme-grid">
              {themes.map((t) => (
                <div
                  key={t.id}
                  className={`theme-card ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <div 
                    className="theme-preview" 
                    style={{ background: t.preview }}
                  >
                    <span className="theme-icon">{t.icon}</span>
                  </div>
                  <div className="theme-info">
                    <span className="theme-name">{t.name}</span>
                    <span className="theme-desc">{t.description}</span>
                  </div>
                  {theme === t.id && (
                    <div className="theme-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <h4>About</h4>
            <div className="about-info">
              <p><strong>Stock Servs</strong></p>
              <p className="muted">Real-time market data and virtual trading platform</p>
              <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                Built with React, FastAPI & ❤️
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
