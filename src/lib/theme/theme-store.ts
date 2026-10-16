'use client';

/**
 * 테마 상태 저장소 (클라이언트 전용).
 *
 * 단일 진실원: localStorage의 선호값. 여기서 읽어 <html data-theme>,
 * <meta theme-color>, 쿠키를 한 번에 동기화하고, 구독자(React 훅·네이티브
 * 상태바)에게 해석된 테마를 알린다. 선호가 'system'이면 OS 변경도 따라간다.
 */

import { useSyncExternalStore } from 'react';
import {
  parseThemePreference,
  readThemeCookie,
  resolveTheme,
  THEME_BACKGROUND,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

type Listener = () => void;

const listeners = new Set<Listener>();
let mediaQuery: MediaQueryList | null = null;
let mediaBound = false;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

function systemPrefersDark(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getThemePreference(): ThemePreference {
  if (!isBrowser()) return 'system';
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  if (raw) return parseThemePreference(raw);
  return readThemeCookie(document.cookie);
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(getThemePreference(), systemPrefersDark());
}

function applyToDocument(resolved: ResolvedTheme) {
  if (!isBrowser()) return;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== resolved) {
    // 전환 순간에만 배경·글자색을 짧게 보간. 끝나면 클래스 제거(개별 transition 보존)
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', resolved);
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_BACKGROUND[resolved]);
}

function notify() {
  applyToDocument(getResolvedTheme());
  listeners.forEach((l) => l());
}

function bindMediaQuery() {
  if (mediaBound || !isBrowser() || typeof window.matchMedia !== 'function') return;
  mediaBound = true;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getThemePreference() === 'system') notify();
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', onChange);
  } else {
    // 구형 WebView
    (mediaQuery as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener?.(onChange);
  }
}

export function setThemePreference(pref: ThemePreference) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {}
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE_NAME}=${pref}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  notify();
}

export function subscribeTheme(listener: Listener): () => void {
  bindMediaQuery();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getServerPreference = (): ThemePreference => 'system';
const getServerResolved = (): ResolvedTheme => 'dark';

/** 선호값 + 해석값 + setter. SSR 시에는 system/dark로 렌더되고 마운트 후 실제 값으로 바뀐다. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference, getServerPreference);
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme, getServerResolved);
  return { preference, resolved, setPreference: setThemePreference };
}
