/**
 * RefreshControl Component
 * Global pause/resume control for auto-refresh with market status indicator
 */

import React, { useState, useEffect } from 'react';
import { useRefreshControl } from '../hooks/useAutoRefresh';
import { getMarketStatus, getNextMarketEvent, isMarketOpen } from '../utils/marketHours';

export default function RefreshControl() {
  const { isPaused, togglePause } = useRefreshControl();
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [nextEvent, setNextEvent] = useState(getNextMarketEvent());

  // Update market status every second
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
      setNextEvent(getNextMarketEvent());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const marketOpen = isMarketOpen();

  return (
    <div className="refresh-control">
      {/* Market Status */}
      <div className="market-status">
        <span className={`market-status-indicator ${marketOpen ? 'open' : 'closed'}`}>
          <span className="status-dot"></span>
          {marketStatus}
        </span>
        <span className="market-countdown">
          {nextEvent.event === 'close' ? 'Closes' : 'Opens'} in {nextEvent.countdown}
        </span>
      </div>

      {/* Pause/Resume Toggle */}
      <button
        className={`refresh-toggle-btn ${isPaused ? 'paused' : 'active'}`}
        onClick={togglePause}
        title={isPaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
      >
        {isPaused ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2l10 6-10 6V2z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h4v12H2V2zm8 0h4v12h-4V2z" />
          </svg>
        )}
        <span className="refresh-toggle-text">
          {isPaused ? 'Paused' : 'Live'}
        </span>
      </button>
    </div>
  );
}
