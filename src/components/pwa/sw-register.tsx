'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

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
