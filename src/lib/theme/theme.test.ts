import { describe, expect, it } from 'vitest';
import {
  parseThemePreference,
  readThemeCookie,
  resolveTheme,
  THEME_BACKGROUND,
  THEME_INIT_SCRIPT,
} from './theme';

describe('parseThemePreference', () => {
  it('허용 값만 통과, 나머지는 system', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
    expect(parseThemePreference('blue')).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('system은 OS 선호를 따른다', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('명시 값은 OS와 무관', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readThemeCookie', () => {
  it('쿠키 헤더에서 tenol-theme를 찾는다', () => {
    expect(readThemeCookie('a=1; tenol-theme=light; b=2')).toBe('light');
    expect(readThemeCookie('tenol-theme=dark')).toBe('dark');
    expect(readThemeCookie('x-tenol-theme=light')).toBe('system'); // 접두사 오매칭 방지
    expect(readThemeCookie('a=1')).toBe('system');
    expect(readThemeCookie(null)).toBe('system');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('문법 오류 없이 평가된다', () => {
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });
  it('두 테마의 바닥색을 모두 포함한다', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_BACKGROUND.dark);
    expect(THEME_INIT_SCRIPT).toContain(THEME_BACKGROUND.light);
  });
});
