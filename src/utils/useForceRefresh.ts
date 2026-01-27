import { useState, useEffect } from 'react';

interface RefreshData {
  forceRefresh: boolean;
  message: string;
  timestamp: string;
}

export const useForceRefresh = () => {
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/force-refresh.json?t=' + Date.now());
        const data: RefreshData = await res.json();
        
        const lastSeen = localStorage.getItem('lastRefreshTimestamp');
        
        if (data.forceRefresh && data.timestamp !== lastSeen) {
          setMessage(data.message);
          setTimestamp(data.timestamp);
          setShowModal(true);
        }
      } catch (e) {
        // Không có file = không cần refresh
      }
    };

    check();
    const interval = setInterval(check, 10 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    localStorage.setItem('lastRefreshTimestamp', timestamp);
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowModal(false);
  };

  return { showModal, message, handleRefresh, handleDismiss };
};