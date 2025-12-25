/**
 * API Client with timeout, retry logic, and error recovery
 */

const DEFAULT_TIMEOUT = 15000; // 15 seconds (NSE API can be slow)
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

// Track pending requests to prevent duplicates
const pendingRequests = new Map();

/**
 * Sleep utility for retry delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options = {}, timeout = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Base API call with error handling
 */
export const api = async (url, options = {}) => {
  const res = await fetchWithTimeout(url, options, options.timeout || DEFAULT_TIMEOUT);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || message;
    } catch (e) {
      // ignore JSON parse errors
    }
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }
  return res.json();
};

/**
 * Authenticated API call with Bearer token
 */
export const authApi = async (url, options = {}) => {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not authenticated');

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return api(url, { ...options, headers });
};

/**
 * API call with automatic retry on failure
 * Uses exponential backoff: 1s, 2s, 4s
 */
export const apiWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await api(url, options);
    } catch (error) {
      lastError = error;

      // Don't retry on authentication errors (401) or client errors (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Don't retry on abort (timeout handled separately)
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }

      // Wait before retrying (exponential backoff)
      if (attempt < retries - 1) {
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        console.log(`Retry ${attempt + 1}/${retries} after ${delay}ms for ${url}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
};

/**
 * Authenticated API call with retry logic
 */
export const authApiWithRetry = async (url, options = {}, retries = MAX_RETRIES) => {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not authenticated');

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };

  return apiWithRetry(url, { ...options, headers }, retries);
};

/**
 * Silent API call - doesn't throw, returns null on error
 * Useful for background refresh where errors shouldn't interrupt UX
 */
export const silentAuthApi = async (url, options = {}) => {
  try {
    return await authApi(url, options);
  } catch (error) {
    console.warn(`Silent API call failed: ${url}`, error.message);
    return null;
  }
};

/**
 * Fast API call for auto-refresh with request deduplication
 * - Prevents duplicate requests for the same URL
 * - Filters out abort errors (don't show toast for cancelled requests)
 * - Silent fail - returns null on error without throwing
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {function} onError - Optional error callback for toast notifications
 */
export const fastAuthApi = async (url, options = {}, onError = null) => {
  // If same request is already pending, return that promise (deduplication)
  if (pendingRequests.has(url)) {
    return pendingRequests.get(url);
  }

  const promise = (async () => {
    try {
      return await authApi(url, options);
    } catch (error) {
      // Don't show error toast for aborted requests (user navigated away or request cancelled)
      const isAbortError = error.name === 'AbortError' ||
                           error.message?.includes('aborted') ||
                           error.message?.includes('signal');

      if (!isAbortError && onError && typeof onError === 'function') {
        onError(error.message || 'Request failed');
      }
      return null;
    } finally {
      pendingRequests.delete(url);
    }
  })();

  pendingRequests.set(url, promise);
  return promise;
};

/**
 * Batch API calls with parallel execution
 * Returns array of results (null for failed calls)
 */
export const batchApi = async (urls, options = {}) => {
  const results = await Promise.allSettled(
    urls.map(url => authApi(url, options))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.warn(`Batch call failed for ${urls[index]}:`, result.reason.message);
      return null;
    }
  });
};
