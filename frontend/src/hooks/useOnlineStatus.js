/**
 * Online Status Hook
 * Detects when the browser goes offline/online
 */

import { useState, useEffect } from 'react';

/**
 * Hook to detect online/offline status
 * @returns {boolean} - true if online, false if offline
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Network: Online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Network: Offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;
