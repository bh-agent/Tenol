'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (isOffline) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <div
      className={[
        'fixed top-0 left-0 right-0 z-[100]',
        'glass border-b border-white/[0.06]',
        'text-center py-2.5 px-4 text-sm font-medium',
        'flex items-center justify-center gap-2',
        'transition-all duration-300',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
      ].join(' ')}
    >
      <WifiOff className="w-4 h-4 text-warning flex-shrink-0" />
      <span className="text-foreground">
        인터넷에 연결되어 있지 않습니다
      </span>
    </div>
  );
}
