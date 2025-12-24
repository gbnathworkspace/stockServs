import React from 'react';
import { analyzeMarketStrength } from '../utils/indexContribution';

/**
 * MarketStrengthIndicator - Shows overall market strength based on top movers' OI signals
 * Analyzes whether rally is genuine (long buildup) or weak (short covering)
 */
export default function MarketStrengthIndicator({ movers }) {
  const analysis = analyzeMarketStrength(movers);

  const getIcon = () => {
    switch (analysis.strength) {
      case 'strong':
        return '💪';
      case 'weak':
        return '⚠️';
      default:
        return '📊';
    }
  };

  return (
    <div className={`market-strength-indicator ${analysis.color}`}>
      <div className="strength-message">
        <span className="strength-icon">{getIcon()}</span>
        <span className="strength-text">{analysis.message}</span>
      </div>
      <div className="strength-details">
        Top 3: {analysis.longBuildupCount} Long Buildup, {analysis.shortCoveringCount} Short Covering
      </div>
    </div>
  );
}
