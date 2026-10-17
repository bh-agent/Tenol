import { describe, expect, it, vi } from 'vitest';

// mvp.ts는 서버 Supabase 클라이언트를 import하므로 모킹하고 순수 함수만 검사
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('./member-ids', () => ({ getClubMemberIds: vi.fn() }));

import { getPeriodStartDate } from './mvp';

describe('getPeriodStartDate (KST 달력 기준)', () => {
  const wed = new Date(2026, 9, 14); // 2026-10-14 수요일
  const sun = new Date(2026, 9, 18); // 2026-10-18 일요일
  const mon = new Date(2026, 9, 12); // 2026-10-12 월요일

  it('week: 이번 주 월요일', () => {
    expect(getPeriodStartDate('week', wed)).toBe('2026-10-12');
    expect(getPeriodStartDate('week', sun)).toBe('2026-10-12'); // 일요일은 그 주의 마지막 날
    expect(getPeriodStartDate('week', mon)).toBe('2026-10-12');
  });

  it('month: 이번 달 1일', () => {
    expect(getPeriodStartDate('month', wed)).toBe('2026-10-01');
  });

  it('year: 올해 1월 1일', () => {
    expect(getPeriodStartDate('year', wed)).toBe('2026-01-01');
  });

  it('all/match: 제한 없음', () => {
    expect(getPeriodStartDate('all', wed)).toBeNull();
    expect(getPeriodStartDate('match', wed)).toBeNull();
  });

  it('연초 주간: 전년도 월요일로 넘어감', () => {
    expect(getPeriodStartDate('week', new Date(2026, 0, 2))).toBe('2025-12-29'); // 2026-01-02 금
  });
});
