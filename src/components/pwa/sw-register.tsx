'use client';

import { useEffect } from 'react';
import { isNative } from '@/lib/native';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // 네이티브 앱(Capacitor)은 원격 URL을 로드하므로 서비스워커가 캐시로 인해
    // 오래된 화면을 보여줄 수 있다. 네이티브에서는 SW를 등록하지 않고,
    // 이전 빌드에서 등록된 SW/캐시가 있으면 정리한다. (PWA는 웹에서만 동작)
    if (isNative) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      }).catch(() => {});
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
      return;
    }

    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New version available - show update toast
            showUpdateToast(newWorker);
          }
        });
      });
    });
  }, []);

  return null;
}

function showUpdateToast(worker: ServiceWorker) {
  // Create toast element
  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.style.cssText = `
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10000;
    background: rgba(20, 20, 20, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    color: #F5F5F5;
    padding: 12px 20px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(42,42,42,1);
    font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    animation: fadeIn 0.4s ease-out;
  `;

  const text = document.createElement('span');
  text.textContent = '업데이트가 있습니다';

  const button = document.createElement('button');
  button.textContent = '새로고침';
  button.style.cssText = `
    background: #00E676;
    color: #0A0A0A;
    border: none;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `;
  button.addEventListener('mouseenter', () => {
    button.style.background = '#69F0AE';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = '#00E676';
  });
  button.addEventListener('click', () => {
    worker.postMessage('skipWaiting');
    window.location.reload();
  });

  toast.appendChild(text);
  toast.appendChild(button);
  document.body.appendChild(toast);

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 10000);
}
