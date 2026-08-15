'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * iOS/Android에서 키보드가 올라올 때 포커스된 입력창이 가려지는 문제 해결.
 *
 * - 네이티브: Capacitor Keyboard의 keyboardDidShow 시점에 activeElement를 화면 중앙으로 스크롤.
 * - 공통(터치 기기): focusin 시 약간의 지연 후 스크롤 — 키보드가 이미 열린 상태에서
 *   다른 입력창으로 이동하는 경우(keyboardDidShow 미발화)를 커버.
 *
 * root layout에 마운트되어 (auth)·(main) 전 화면의 input/textarea에 적용된다.
 */
export function KeyboardScrollFix() {
  useEffect(() => {
    const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;
    if (!Capacitor.isNativePlatform() && !isTouch) return;

    const scrollFocusedIntoView = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    // 키보드가 열린 상태에서 필드 간 이동 대응
    const onFocusIn = (ev: FocusEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) {
        setTimeout(scrollFocusedIntoView, 300);
      }
    };
    document.addEventListener('focusin', onFocusIn);

    // 네이티브: 키보드 이벤트로
    //  1) --keyboard-height CSS 변수 설정 → Modal(바텀시트)이 키보드 위로 올라감
    //  2) body.keyboard-open 클래스 → 하단 고정 요소(.hide-on-keyboard) 숨김
    //  3) 표시 완료 시점에 포커스된 입력창을 화면 중앙으로 스크롤
    const removers: Array<() => void> = [];
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/keyboard')
        .then(async ({ Keyboard }) => {
          const h1 = await Keyboard.addListener('keyboardWillShow', (info) => {
            document.documentElement.style.setProperty(
              '--keyboard-height',
              `${info.keyboardHeight}px`
            );
            document.body.classList.add('keyboard-open');
          });
          const h2 = await Keyboard.addListener('keyboardDidShow', scrollFocusedIntoView);
          const h3 = await Keyboard.addListener('keyboardWillHide', () => {
            document.documentElement.style.removeProperty('--keyboard-height');
            document.body.classList.remove('keyboard-open');
          });
          removers.push(() => h1.remove(), () => h2.remove(), () => h3.remove());
        })
        .catch(() => {});
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      removers.forEach((r) => r());
      document.documentElement.style.removeProperty('--keyboard-height');
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return null;
}
