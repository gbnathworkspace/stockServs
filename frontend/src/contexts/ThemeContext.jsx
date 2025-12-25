import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext();

export const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
  GLASS: 'glass',
};

export function ThemeProvider({ children }) {
  // Initialize from localStorage immediately
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme');
    // Validate saved theme against known themes
    if (Object.values(THEMES).includes(saved)) {
      return saved;
    }
    return THEMES.DARK;
  });

  // Function to update theme both in state and localStorage
  const setTheme = async (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setThemeState(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);

      // Sync with backend if user is logged in
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Fetch current profile to merge preferences
          const res = await fetch('/profile/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          const preferences = data.profile?.preferences || {};
          
          await fetch('/profile/me', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              preferences: { ...preferences, theme: newTheme }
            })
          });
        } catch (err) {
          console.error('Failed to sync theme to backend:', err);
        }
      }
    }
  };

  const syncThemeWithBackend = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
      const res = await fetch('/profile/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const backendTheme = data.profile?.preferences?.theme;
      
      if (backendTheme && Object.values(THEMES).includes(backendTheme) && backendTheme !== theme) {
        setThemeState(backendTheme);
        localStorage.setItem('theme', backendTheme);
        document.documentElement.setAttribute('data-theme', backendTheme);
      }
    } catch (err) {
      console.error('Failed to fetch user theme:', err);
    }
  };

  // Sync with backend on mount
  useEffect(() => {
    syncThemeWithBackend();
  }, []);

  // Sync with document element on mount and state change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listen for storage changes (e.g. from other tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'theme' && Object.values(THEMES).includes(e.newValue)) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = {
    theme,
    setTheme,
    syncThemeWithBackend,
    isDark: theme === THEMES.DARK,
    isLight: theme === THEMES.LIGHT,
    isGlass: theme === THEMES.GLASS,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
