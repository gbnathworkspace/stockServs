/**
 * Market Hours Utility
 * Handles NSE market hours detection and time calculations
 * NSE Trading Hours: 9:15 AM - 3:30 PM IST (Monday-Friday)
 */

/**
 * Get current time in IST
 * @returns {Date} Current date/time in IST
 */
export function getISTTime() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

/**
 * Check if NSE market is currently open
 * @returns {boolean} True if market is open
 */
export function isMarketOpen() {
  const istTime = getISTTime();
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();

  // Weekend check (0 = Sunday, 6 = Saturday)
  if (day === 0 || day === 6) {
    return false;
  }

  // Convert to minutes since midnight for easier comparison
  const currentMinutes = hours * 60 + minutes;
  const marketOpenMinutes = 9 * 60 + 15; // 9:15 AM
  const marketCloseMinutes = 15 * 60 + 30; // 3:30 PM

  return currentMinutes >= marketOpenMinutes && currentMinutes <= marketCloseMinutes;
}

/**
 * Get market status string
 * @returns {string} "Open" or "Closed"
 */
export function getMarketStatus() {
  return isMarketOpen() ? 'Open' : 'Closed';
}

/**
 * Get time until market opens (in milliseconds)
 * @returns {number} Milliseconds until market opens, or 0 if already open
 */
export function getTimeUntilMarketOpen() {
  if (isMarketOpen()) {
    return 0;
  }

  const istTime = getISTTime();
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();

  let targetDate = new Date(istTime);

  // If it's Saturday, move to Monday
  if (day === 6) {
    targetDate.setDate(targetDate.getDate() + 2);
  }
  // If it's Sunday, move to Monday
  else if (day === 0) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  // If it's a weekday but after market close, move to next day
  else if (hours >= 15 && (hours > 15 || minutes > 30)) {
    targetDate.setDate(targetDate.getDate() + 1);
    // If next day is Saturday, skip to Monday
    if (targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 2);
    }
  }

  // Set to 9:15 AM
  targetDate.setHours(9, 15, 0, 0);

  return targetDate.getTime() - istTime.getTime();
}

/**
 * Get time until market closes (in milliseconds)
 * @returns {number} Milliseconds until market closes, or 0 if already closed
 */
export function getTimeUntilMarketClose() {
  if (!isMarketOpen()) {
    return 0;
  }

  const istTime = getISTTime();
  const closeTime = new Date(istTime);
  closeTime.setHours(15, 30, 0, 0);

  return closeTime.getTime() - istTime.getTime();
}

/**
 * Format milliseconds to human-readable countdown
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string (e.g., "2h 15m")
 */
export function formatCountdown(ms) {
  if (ms <= 0) return 'Now';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get next market event (open or close)
 * @returns {Object} { event: 'open'|'close', time: Date, countdown: string }
 */
export function getNextMarketEvent() {
  const open = isMarketOpen();

  if (open) {
    const ms = getTimeUntilMarketClose();
    return {
      event: 'close',
      countdown: formatCountdown(ms),
      ms: ms
    };
  } else {
    const ms = getTimeUntilMarketOpen();
    return {
      event: 'open',
      countdown: formatCountdown(ms),
      ms: ms
    };
  }
}

/**
 * Check if current time is within trading hours (with buffer)
 * Useful for determining if auto-refresh should be more aggressive
 * @param {number} bufferMinutes - Minutes of buffer before/after market hours
 * @returns {boolean}
 */
export function isWithinTradingHours(bufferMinutes = 30) {
  const istTime = getISTTime();
  const day = istTime.getDay();
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();

  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }

  const currentMinutes = hours * 60 + minutes;
  const marketOpenMinutes = (9 * 60 + 15) - bufferMinutes;
  const marketCloseMinutes = (15 * 60 + 30) + bufferMinutes;

  return currentMinutes >= marketOpenMinutes && currentMinutes <= marketCloseMinutes;
}
