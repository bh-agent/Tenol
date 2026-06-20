/**
 * Calculate the next match date for a recurring template.
 *
 * @param dayOfWeek 0=Sunday, 6=Saturday
 * @param frequencyWeeks 1=weekly, 2=biweekly, etc.
 * @param lastCreatedDate ISO date string (YYYY-MM-DD) of last created match, or null
 * @returns ISO date string (YYYY-MM-DD)
 */
/**
 * "오늘"을 한국 시간(KST, UTC+9) 기준 자정으로 반환.
 * Vercel 크론은 UTC에서 도는데(00:00 KST = 15:00 UTC), 그냥 new Date()를 쓰면
 * 요일/날짜 계산이 하루 어긋날 수 있다. KST 벽시계 기준으로 정규화한다.
 * - UTC 서버: getTimezoneOffset()=0 → +9h 시프트로 KST 날짜를 읽음.
 * - KST 브라우저: getTimezoneOffset()=-540 → 결과적으로 로컬 자정(=KST)과 동일(동작 변화 없음).
 */
export function kstToday(): Date {
  const now = new Date();
  const kstMs = now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000;
  const d = new Date(kstMs);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getNextMatchDate(
  dayOfWeek: number,
  frequencyWeeks: number,
  lastCreatedDate: string | null
): string {
  const today = kstToday();

  if (!lastCreatedDate) {
    // Find next upcoming occurrence of dayOfWeek
    const result = new Date(today);
    const currentDay = result.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    result.setDate(result.getDate() + daysUntil);
    return formatDate(result);
  }

  // Calculate from last created date
  const last = new Date(lastCreatedDate + 'T00:00:00');
  const intervalDays = frequencyWeeks * 7;
  const next = new Date(last);
  next.setDate(next.getDate() + intervalDays);

  // If next is in the past, keep advancing until future
  while (next <= today) {
    next.setDate(next.getDate() + intervalDays);
  }

  return formatDate(next);
}

export type TitleFormat = 'name_only' | 'with_date' | 'with_round';

/**
 * Auto-generate match title based on format.
 *
 * - name_only:  "토요 정기전"
 * - with_date:  "토요 정기전 (4/5)"
 * - with_round: "토요 정기전 4월 1회차"
 */
export function resolveTitle(
  name: string,
  dateStr: string,
  titleFormat: TitleFormat = 'with_date',
  roundNumber?: number,
): string {
  const date = new Date(dateStr + 'T00:00:00');
  const month = date.getMonth() + 1;
  const day = date.getDate();

  switch (titleFormat) {
    case 'name_only':
      return name;
    case 'with_date':
      return `${name} (${month}/${day})`;
    case 'with_round':
      return `${name} ${month}월 ${roundNumber ?? 1}회차`;
    default:
      return `${name} (${month}/${day})`;
  }
}

/**
 * Calculate the next upcoming dates for preview.
 */
export function getUpcomingDates(
  dayOfWeek: number,
  frequencyWeeks: number,
  count = 4,
): string[] {
  const today = kstToday();

  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const first = new Date(today);
  first.setDate(first.getDate() + daysUntil);

  const dates: string[] = [];
  const intervalDays = frequencyWeeks * 7;
  const cursor = new Date(first);

  for (let i = 0; i < count; i++) {
    dates.push(formatDate(cursor));
    cursor.setDate(cursor.getDate() + intervalDays);
  }

  return dates;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
