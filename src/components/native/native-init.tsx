'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNative = async () => {
      // Status Bar
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        if (Capacitor.getPlatform() === 'android') {
          await StatusBar.setBackgroundColor({ color: '#0A0A0A' });
        }
      } catch {}

      // Keyboard (iOS form handling)
      try {
        const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
        await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
        await Keyboard.setScroll({ isDisabled: false });
      } catch {}

      // Android back button
      try {
        const { App } = await import('@capacitor/app');
        App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            router.back();
          } else {
            App.exitApp();
          }
        });
      } catch {}

      // Push notifications — 리스너를 먼저 등록한 뒤 권한 처리
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

        await PushNotifications.addListener('registration', async (token) => {
          try {
            const { saveDeviceToken } = await import('@/lib/actions/push');
            await saveDeviceToken(token.value, platform);
          } catch {}
        });

        // 알림 탭 시 관련 화면으로 이동
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = (action.notification?.data ?? {}) as Record<string, string>;
          if (data.club_id && data.match_id) {
            router.push(`/clubs/${data.club_id}/matches/${data.match_id}`);
          } else if (data.club_id) {
            router.push(`/clubs/${data.club_id}`);
          } else {
            router.push('/notifications');
          }
        });

        // 이미 허용된 기기는 즉시 토큰 등록.
        // 미결정 상태면 최초 1회만 요청하고, 사용자가 거부한 선택은 존중한다.
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
        } else if (
          (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') &&
          !localStorage.getItem('tenol_push_asked')
        ) {
          localStorage.setItem('tenol_push_asked', '1');
          const req = await PushNotifications.requestPermissions();
          if (req.receive === 'granted') {
            await PushNotifications.register();
          }
        }
      } catch {}
    };

    initNative();
  }, [router]);

  return null;
}
