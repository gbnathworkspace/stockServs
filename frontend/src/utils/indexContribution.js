/**
 * Nifty 50 Index Contribution Utilities
 * Calculates contribution points and OI signals for index stocks
 */

// Nifty 50 weights (approximate - based on latest NSE data)
// Source: https://www.nseindia.com/products-services/indices-index-nifty50
export const NIFTY_WEIGHTS = {
  'HDFCBANK': 12.96,
  'RELIANCE': 9.87,
  'ICICIBANK': 7.68,
  'INFY': 6.12,
  'ITC': 4.48,
  'TCS': 4.02,
  'LT': 3.89,
  'BHARTIARTL': 3.71,
  'AXISBANK': 3.01,
  'SBIN': 2.91,
  'KOTAKBANK': 2.62,
  'BAJFINANCE': 2.29,
  'HINDUNILVR': 2.25,
  'MARUTI': 1.68,
  'ASIANPAINT': 1.63,
  'SUNPHARMA': 1.60,
  'TITAN': 1.59,
  'HCLTECH': 1.54,
  'NTPC': 1.49,
  'BAJAJFINSV': 1.48,
  'POWERGRID': 1.44,
  'M&M': 1.43,
  'TATAMOTORS': 1.38,
  'ULTRACEMCO': 1.36,
  'ONGC': 1.28,
  'TECHM': 1.15,
  'NESTLEIND': 1.14,
  'TATASTEEL': 1.09,
  'WIPRO': 1.05,
  'ADANIENT': 1.02,
  'JSWSTEEL': 0.98,
  'COALINDIA': 0.95,
  'INDUSINDBK': 0.94,
  'ADANIPORTS': 0.92,
  'GRASIM': 0.88,
  'HINDALCO': 0.85,
  'BPCL': 0.82,
  'DRREDDY': 0.78,
  'BRITANNIA': 0.75,
  'DIVISLAB': 0.72,
  'CIPLA': 0.68,
  'APOLLOHOSP': 0.65,
  'HEROMOTOCO': 0.62,
  'EICHERMOT': 0.58,
  'TATACONSUM': 0.55,
  'SBILIFE': 0.52,
  'HDFCLIFE': 0.48,
  'BAJAJ-AUTO': 0.45,
  'UPL': 0.42,
  'LTIM': 0.38,
};

// Current approximate Nifty level (will be fetched from API in production)
const DEFAULT_NIFTY_LEVEL = 24500;

/**
 * Calculate contribution points to Nifty index
 * Formula: (Price Change / Prev Close) × Weight × Nifty Level / 100
 */
export function calculateContributionPoints(symbol, priceChange, prevClose, niftyLevel = DEFAULT_NIFTY_LEVEL) {
  const weight = NIFTY_WEIGHTS[symbol] || 0;

  if (!weight || !prevClose || prevClose === 0) {
    return 0;
  }

  const contributionPoints = (priceChange / prevClose) * weight * (niftyLevel / 100);
  return Math.round(contributionPoints * 100) / 100;
}

/**
 * OI Signal Types
 */
export const OI_SIGNALS = {
  LONG_BUILDUP: {
    signal: 'LONG_BUILDUP',
    label: 'Long Buildup',
    emoji: '🟢',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    description: 'Fresh Buying - Trust this move'
  },
  SHORT_COVERING: {
    signal: 'SHORT_COVERING',
    label: 'Short Covering',
    emoji: '🟡',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
    description: 'Sellers Exiting - Weak move, be careful'
  },
  SHORT_BUILDUP: {
    signal: 'SHORT_BUILDUP',
    label: 'Short Buildup',
    emoji: '🔴',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    description: 'Fresh Selling - Trust the fall'
  },
  LONG_UNWINDING: {
    signal: 'LONG_UNWINDING',
    label: 'Long Unwinding',
    emoji: '🟠',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    description: 'Profit Booking - Just a dip'
  }
};

/**
 * Determine OI signal based on price and OI change
 * Price Up + OI Up = Long Buildup (Strong bullish)
 * Price Up + OI Down = Short Covering (Weak bullish)
 * Price Down + OI Up = Short Buildup (Strong bearish)
 * Price Down + OI Down = Long Unwinding (Weak bearish)
 */
export function determineOISignal(priceChange, oiChange) {
  const priceUp = priceChange > 0;
  const oiUp = oiChange > 0;

  if (priceUp && oiUp) return 'LONG_BUILDUP';
  if (priceUp && !oiUp) return 'SHORT_COVERING';
  if (!priceUp && oiUp) return 'SHORT_BUILDUP';
  return 'LONG_UNWINDING';
}

/**
 * Process raw stock data into contributor format
 */
export function processContributorData(stocksData, niftyLevel = DEFAULT_NIFTY_LEVEL) {
  if (!stocksData || !Array.isArray(stocksData)) {
    return { movers: [], draggers: [], totalPositive: 0, totalNegative: 0 };
  }

  const withContribution = stocksData
    .filter(stock => NIFTY_WEIGHTS[stock.symbol]) // Only Nifty 50 stocks
    .map(stock => {
      const priceChange = (stock.lastPrice || stock.ltp || 0) - (stock.previousClose || stock.prevClose || 0);
      const contributionPoints = calculateContributionPoints(
        stock.symbol,
        priceChange,
        stock.previousClose || stock.prevClose || 0,
        niftyLevel
      );

      // OI data might not always be available - use mock for now
      const oiChange = stock.oiChange || 0;
      const oiChangePct = stock.oiChangePct || 0;

      return {
        symbol: stock.symbol,
        ltp: stock.lastPrice || stock.ltp || 0,
        prevClose: stock.previousClose || stock.prevClose || 0,
        priceChange,
        priceChangePct: stock.pChange || ((priceChange / (stock.previousClose || 1)) * 100),
        weight: NIFTY_WEIGHTS[stock.symbol] || 0,
        contributionPoints,
        oiChange,
        oiChangePct,
        oiSignal: determineOISignal(priceChange, oiChange),
        dayHigh: stock.dayHigh || 0,
        dayLow: stock.dayLow || 0,
      };
    });

  // Sort by absolute contribution points
  const sorted = [...withContribution].sort(
    (a, b) => Math.abs(b.contributionPoints) - Math.abs(a.contributionPoints)
  );

  const movers = sorted.filter(s => s.contributionPoints > 0);
  const draggers = sorted.filter(s => s.contributionPoints < 0);

  const totalPositive = movers.reduce((sum, s) => sum + s.contributionPoints, 0);
  const totalNegative = draggers.reduce((sum, s) => sum + s.contributionPoints, 0);

  return {
    movers: movers.slice(0, 10),
    draggers: draggers.slice(0, 10),
    totalPositive: Math.round(totalPositive * 100) / 100,
    totalNegative: Math.round(totalNegative * 100) / 100,
    netContribution: Math.round((totalPositive + totalNegative) * 100) / 100,
  };
}

/**
 * Analyze market strength based on top movers' OI signals
 */
export function analyzeMarketStrength(movers) {
  if (!movers || movers.length === 0) {
    return {
      strength: 'neutral',
      message: 'No data available',
      color: 'text-gray-400 bg-gray-500/20',
      longBuildupCount: 0,
      shortCoveringCount: 0,
    };
  }

  const top3 = movers.slice(0, 3);
  const longBuildupCount = top3.filter(s => s.oiSignal === 'LONG_BUILDUP').length;
  const shortCoveringCount = top3.filter(s => s.oiSignal === 'SHORT_COVERING').length;

  let strength, message, color;

  if (longBuildupCount >= 2) {
    strength = 'strong';
    message = 'Strong Trend - Fresh buying in top movers';
    color = 'strength-strong';
  } else if (shortCoveringCount >= 2) {
    strength = 'weak';
    message = 'Weak Rally - Mostly short covering';
    color = 'strength-weak';
  } else {
    strength = 'neutral';
    message = 'Mixed Signals - Watch carefully';
    color = 'strength-neutral';
  }

  return {
    strength,
    message,
    color,
    longBuildupCount,
    shortCoveringCount,
  };
}
