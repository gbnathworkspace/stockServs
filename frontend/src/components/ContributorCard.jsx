import React from 'react';
import { OI_SIGNALS } from '../utils/indexContribution';

/**
 * ContributorCard - Displays a single stock's contribution to the index
 * Shows rank, symbol, price, OI signal badge, and contribution points
 */
export default function ContributorCard({ stock, rank, type }) {
  const signalConfig = OI_SIGNALS[stock.oiSignal] || OI_SIGNALS.LONG_BUILDUP;
  const isMover = type === 'mover';

  return (
    <div className={`contributor-card ${isMover ? 'contributor-mover' : 'contributor-dragger'}`}>
      {/* Left: Rank + Symbol */}
      <div className="contributor-left">
        <span className={`contributor-rank ${isMover ? 'rank-positive' : 'rank-negative'}`}>
          {rank}
        </span>

        <div className="contributor-info">
          <div className="contributor-symbol">{stock.symbol}</div>
          <div className="contributor-price">
            ₹{Number(stock.ltp).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Center: OI Signal Badge */}
      <div
        className="oi-signal-badge"
        style={{
          backgroundColor: signalConfig.bgColor,
          color: signalConfig.color,
          borderColor: signalConfig.color + '40',
        }}
        title={signalConfig.description}
      >
        <span className="oi-signal-emoji">{signalConfig.emoji}</span>
        <span className="oi-signal-label">{signalConfig.label}</span>
        {stock.oiChangePct !== 0 && (
          <span className="oi-signal-pct">
            ({stock.oiChangePct > 0 ? '+' : ''}{stock.oiChangePct.toFixed(1)}%)
          </span>
        )}
      </div>

      {/* Right: Contribution Points */}
      <div className="contributor-right">
        <div className={`contribution-points ${isMover ? 'points-positive' : 'points-negative'}`}>
          {stock.contributionPoints > 0 ? '+' : ''}{stock.contributionPoints.toFixed(1)} pts
        </div>
        <div className="contribution-pct">
          {stock.priceChangePct > 0 ? '+' : ''}{Number(stock.priceChangePct).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
