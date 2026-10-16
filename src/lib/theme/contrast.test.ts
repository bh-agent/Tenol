/**
 * 라이트 테마 글자색 대비 회귀 테스트.
 * globals.css의 [data-theme="light"] 값과 동일하게 유지해야 한다.
 * 색을 바꿀 때 이 테스트가 WCAG AA(4.5:1) 하한을 지켜준다.
 */
import { describe, expect, it } from 'vitest';

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = {
  background: '#F5F6F5',
  surface: '#FFFFFF',
  foreground: '#111111',
  mutedForeground: '#5C5F5C',
  subtle: '#8A8D8A',
  primary: '#00C853',
  primaryInk: '#007F55',
  success: '#007F55',
  warning: '#9E5F00',
  info: '#1565C0',
  destructive: '#C62828',
  medalGold: '#8F6400',
  medalSilver: '#757575',
  medalBronze: '#A0522D',
  recruitGuest: '#1565C0',
};

const DARK = {
  background: '#0A0A0A',
  surface: '#141414',
  foreground: '#F5F5F5',
  mutedForeground: '#A3A3A3',
  primaryInk: '#00E676',
  primary: '#00E676',
};

describe('라이트 테마 글자 대비 (흰 카드 기준)', () => {
  const textTokens: Array<[string, string]> = [
    ['foreground', LIGHT.foreground],
    ['mutedForeground', LIGHT.mutedForeground],
    ['primaryInk', LIGHT.primaryInk],
    ['success', LIGHT.success],
    ['warning', LIGHT.warning],
    ['info', LIGHT.info],
    ['destructive', LIGHT.destructive],
    ['medalGold', LIGHT.medalGold],
    ['medalBronze', LIGHT.medalBronze],
    ['recruitGuest', LIGHT.recruitGuest],
  ];
  it.each(textTokens)('%s ≥ 4.5:1 on surface', (_name, hex) => {
    expect(contrast(hex, LIGHT.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it.each(textTokens)('%s ≥ 4.5:1 on background', (_name, hex) => {
    expect(contrast(hex, LIGHT.background)).toBeGreaterThanOrEqual(4.5);
  });
  it('플레이스홀더·은메달은 UI 컴포넌트 기준 3:1', () => {
    expect(contrast(LIGHT.subtle, LIGHT.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(LIGHT.medalSilver, LIGHT.surface)).toBeGreaterThanOrEqual(3);
  });
  it('그린 채움 위 검은 글자', () => {
    expect(contrast('#000000', LIGHT.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('다크 테마 글자 대비 (회귀 방지)', () => {
  it('본문·보조·그린 글자', () => {
    expect(contrast(DARK.foreground, DARK.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK.mutedForeground, DARK.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK.primaryInk, DARK.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#000000', DARK.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
