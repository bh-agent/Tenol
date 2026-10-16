/**
 * 테마 선호 — 순수 로직 (서버·클라이언트·테스트 공용, DOM 의존 없음).
 *
 * - 선호(preference): 'system' | 'light' | 'dark' — 사용자가 설정에서 고른 값
 * - 해석(resolved): 'light' | 'dark' — 실제로 화면에 적용되는 값
 *
 * 저장 위치: localStorage(주) + 쿠키(보조). 쿠키는 서버가 생성하는 HTML
 * (OAuth 중간 페이지 등)이 테마를 알 수 있게 하는 용도.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tenol-theme';
export const THEME_COOKIE_NAME = 'tenol-theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

/** 네이티브 상태바·<meta name="theme-color">에 쓰는 바닥색. globals.css `--t-background`와 동일해야 한다. */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: '#0A0A0A',
  light: '#F5F6F5',
};

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

/** 쿠키 문자열에서 테마 선호를 읽는다 (서버 route handler·인라인 스크립트 공용 규칙). */
export function readThemeCookie(cookieHeader: string | null | undefined): ThemePreference {
  if (!cookieHeader) return 'system';
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)`));
  return parseThemePreference(m ? decodeURIComponent(m[1]) : null);
}

/**
 * 서버가 직접 생성하는 독립 HTML(OAuth 중간 페이지 등)용 색상 변수 CSS.
 * globals.css를 못 쓰는 곳이라 쿠키의 선호값으로 분기한다. 'system'이면
 * prefers-color-scheme 미디어쿼리에 맡긴다. 결과는 `<style>` 안에 넣고
 * 본문에서 var(--bg) 등으로 쓴다.
 */
const INTERSTITIAL_COLORS: Record<ResolvedTheme, Record<string, string>> = {
  dark: { bg: '#0A0A0A', fg: '#EDEDED', muted: '#999999', hint: '#666666', 'btn-bg': '#00E676', 'btn-fg': '#0A0A0A', ok: '#00E676', err: '#FF5252' },
  light: { bg: '#F5F6F5', fg: '#111111', muted: '#5C5F5C', hint: '#8A8D8A', 'btn-bg': '#00C853', 'btn-fg': '#0A0A0A', ok: '#007F55', err: '#C62828' },
};

function cssVars(theme: ResolvedTheme): string {
  return Object.entries(INTERSTITIAL_COLORS[theme])
    .map(([k, v]) => `--${k}:${v}`)
    .join(';');
}

export function interstitialThemeCss(pref: ThemePreference): string {
  if (pref === 'light') return `:root{color-scheme:light;${cssVars('light')}}`;
  if (pref === 'dark') return `:root{color-scheme:dark;${cssVars('dark')}}`;
  return `:root{color-scheme:dark light;${cssVars('dark')}}@media (prefers-color-scheme: light){:root{${cssVars('light')}}}`;
}

/**
 * <head>에 넣는 첫 페인트 전 스크립트.
 * 서버는 항상 data-theme="dark"로 렌더하고, 이 스크립트가 저장된 선호에 따라
 * 라이트로 바꾼다. 동기 실행이라 깜빡임이 없다. (React는 html에
 * suppressHydrationWarning을 둬 속성 차이를 무시한다.)
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var p=null;try{p=localStorage.getItem(k)}catch(e){}if(!p){var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]*)/);p=m?decodeURIComponent(m[1]):null}if(p!=='light'&&p!=='dark')p='system';var d=p==='system'?window.matchMedia('(prefers-color-scheme: dark)').matches:p==='dark';var t=d?'dark':'light';document.documentElement.setAttribute('data-theme',t);var el=document.querySelector('meta[name="theme-color"]');if(el)el.setAttribute('content',d?'${THEME_BACKGROUND.dark}':'${THEME_BACKGROUND.light}')}catch(e){}})();`;
