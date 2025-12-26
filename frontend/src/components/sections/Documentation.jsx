import React from 'react';

export default function Documentation() {
  return (
    <div className="product-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">📖</span>
          <h2>Platform Guide</h2>
        </div>
        <p className="section-subtitle">
          Quick reference for all trading tools and features
        </p>
      </div>

      {/* TradeFinder Products */}
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          TradeFinder Products
        </h3>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Option Clock</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Real-time option chain analysis with PCR, Max Pain, and OI buildup tracking.<br/>
            <strong>Use for:</strong> Identifying market direction using options data. High PCR = bearish sentiment, Low PCR = bullish.<br/>
            <strong>Requires:</strong> Fyers API authentication for live data.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Option Apex</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Candle-by-candle option analysis with entry/exit signals.<br/>
            <strong>Use for:</strong> Intraday option trading. Shows OI buildup, volume spikes, and institutional flow.<br/>
            <strong>Signals:</strong> ENTRY (new position), EXIT (book profit/cut loss). Confidence score 0-100%.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Market Pulse</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Detects smart money activity through volume and delivery analysis.<br/>
            <strong>Volume Surge:</strong> Stocks with 2x+ average volume - potential breakout candidates.<br/>
            <strong>High Delivery %:</strong> 60%+ delivery indicates cash market buying (institutional).<br/>
            <strong>Block Deals:</strong> Large bulk transactions by institutions.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Insider Strategy</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Multi-factor scoring system for high-probability trades.<br/>
            <strong>Formula:</strong> Momentum (40%) + Volume (30%) + OI (30%) = Composite Score.<br/>
            <strong>Grades:</strong> A (80+) = Strong, B (60-79) = Good, C (40-59) = Moderate, D (&lt;40) = Weak.<br/>
            <strong>Includes:</strong> Entry, Target, Stop Loss with 2:1 risk-reward ratio.
          </p>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Sector Scope</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Sector rotation analysis and relative strength tracking.<br/>
            <strong>Use for:</strong> Identifying which sectors are leading/lagging the market.<br/>
            <strong>Shows:</strong> Sector-wise performance, breadth, and rotation patterns.
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Swing Spectrum</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Identifies 52-week breakout opportunities for swing trading.<br/>
            <strong>52W High Breakouts:</strong> Stocks breaking yearly highs - momentum continuation plays.<br/>
            <strong>52W Low Breakouts:</strong> Stocks at yearly lows - reversal candidates.<br/>
            <strong>Strength:</strong> STRONG (within 2%), MODERATE (2-5%), WEAK (5-10% from level).
          </p>
        </div>
      </div>

      {/* Virtual Trading */}
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          Virtual Trading
        </h3>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Paper Trading</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Simulated trading with virtual money (₹1,00,000 starting balance).<br/>
            <strong>Use for:</strong> Testing strategies without risking real capital.<br/>
            <strong>Features:</strong> Buy/Sell stocks, track P&L, view portfolio performance.
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Watchlist</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>What it does:</strong> Track stocks you're interested in.<br/>
            <strong>Use for:</strong> Monitoring potential trades before entry.
          </p>
        </div>
      </div>

      {/* Real Trading */}
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          Real Trading
        </h3>

        <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
          <strong>Broker Integration:</strong> Connect your Zerodha or Fyers account for live trading.<br/>
          <strong>Features:</strong> Real portfolio sync, live order placement, P&L tracking.<br/>
          <strong>Setup:</strong> Authenticate through broker OAuth flow from settings.
        </p>
      </div>

      {/* Market Data */}
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          Market Data
        </h3>

        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ color: 'var(--info)', marginBottom: '0.5rem' }}>Top Gainers / Losers</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            Real-time list of best and worst performing stocks in NIFTY 50.
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ color: 'var(--info)', marginBottom: '0.5rem' }}>FII/DII Activity</h4>
          <p style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <strong>FII (Foreign):</strong> Net buying/selling by foreign institutions.<br/>
            <strong>DII (Domestic):</strong> Net buying/selling by mutual funds, insurance companies.<br/>
            <strong>Use for:</strong> Understanding institutional money flow direction.
          </p>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem', background: 'var(--card-bg-hover)' }}>
        <h3 style={{ marginBottom: '1rem' }}>Quick Tips</h3>
        <ul style={{ opacity: 0.9, lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li><strong>Green badge</strong> = Bullish / Positive / Strong signal</li>
          <li><strong>Red badge</strong> = Bearish / Negative / Weak signal</li>
          <li><strong>Blue badge</strong> = Neutral / Informational</li>
          <li>Data auto-refreshes every 30-60 seconds</li>
          <li>Market hours: 9:15 AM - 3:30 PM IST</li>
          <li>Best results during market hours when live data flows</li>
        </ul>
      </div>
    </div>
  );
}
