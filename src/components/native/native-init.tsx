'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

export function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // 리스너 핸들 수집: 레이아웃 재마운트 시 중복 등록되면 뒤로가기 1회에
    // router.back()이 N회 실행되는 등 오작동 → cleanup에서 반드시 제거
    const removers: Array<() => void> = [];

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
        const h = await App.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            router.back();
          } else {
            App.exitApp();
          }
        });
        removers.push(() => h.remove());
      } catch {}

      // iOS 검은 화면 대응: 앱을 오래 백그라운드에 뒀다 복귀하면 WKWebView가
      // 렌더 자원을 회수해 화면이 비어 보이는 경우가 있다. 30분 이상 백그라운드
      // 후 복귀 시 전체 새로고침으로 상태를 복구한다. (30분 이상 방치 후라
      // 입력 중 데이터 유실 우려는 사실상 없음)
      try {
        const { App } = await import('@capacitor/app');
        const STALE_MS = 30 * 60 * 1000;
        let hiddenAt: number | null = null;
        const hPause = await App.addListener('pause', () => {
          hiddenAt = Date.now();
        });
        const hResume = await App.addListener('resume', () => {
          const stale = hiddenAt && Date.now() - hiddenAt > STALE_MS;
          hiddenAt = null;
          if (stale) {
            // 복귀 직후엔 OS 네트워크가 아직 안 깨어났을 수 있다 — 이때 reload하면
            // 로드 실패로 오프라인 화면이 뜬다. 온라인 확인 후(또는 online 이벤트에) 새로고침.
            if (navigator.onLine) {
              window.location.reload();
            } else {
              window.addEventListener('online', () => window.location.reload(), { once: true });
            }
          } else {
            // 짧은 복귀는 데이터만 최신화
            router.refresh();
          }
        });
        removers.push(() => hPause.remove(), () => hResume.remove());
      } catch {}

      // Push notifications — 리스너를 먼저 등록한 뒤 권한 처리
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';

        const hReg = await PushNotifications.addListener('registration', async (token) => {
          try {
            const { saveDeviceToken } = await import('@/lib/actions/push');
            await saveDeviceToken(token.value, platform);
          } catch {}
        });
        removers.push(() => hReg.remove());

        // 알림 탭 시 관련 화면으로 이동
        const hTap = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = (action.notification?.data ?? {}) as Record<string, string>;
          if (data.club_id && data.match_id) {
            router.push(`/clubs/${data.club_id}/matches/${data.match_id}`);
          } else if (data.club_id) {
            router.push(`/clubs/${data.club_id}`);
          } else {
            router.push('/notifications');
          }
        });
        removers.push(() => hTap.remove());

        // Android 푸시는 Firebase(google-services.json) 설정 전까지 비활성.
        // 설정 없이 register()를 호출하면 네이티브에서
        // "Default FirebaseApp is not initialized" FATAL EXCEPTION이 발생해
        // 앱이 즉시 종료된다(JS try/catch로도 못 잡음). Android에 google-services.json을
        // 추가하고 재빌드한 뒤 이 가드를 iOS+Android로 열면 된다.
        const pushSupported = platform === 'ios';

        if (pushSupported) {
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
        }
      } catch {}
    };

    initNative();
    return () => {
      removers.forEach((r) => r());
    };
  }, [router]);

  return null;
}
