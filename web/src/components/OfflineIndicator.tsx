import React, { useState, useCallback, useEffect, useRef } from 'react';

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [show, setShow] = useState(!navigator.onLine);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    setOffline(false);
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 5000);
  }, []);

  const handleOffline = useCallback(() => {
    setOffline(true);
    setShow(true);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleOnline, handleOffline]);

  if (!show) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm border-b transition-colors duration-300 ${
        offline
          ? 'bg-warning/10 border-warning/20 text-warning'
          : 'bg-success/10 border-success/20 text-success'
      }`}
      role="alert"
    >
      {offline ? '离线模式 — 部分功能不可用' : '已恢复在线连接'}
    </div>
  );
}
