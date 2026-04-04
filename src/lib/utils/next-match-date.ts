/**
 * Calculate the next match date for a recurring template.
 *
 * @param dayOfWeek 0=Sunday, 6=Saturday
 * @param frequencyWeeks 1=weekly, 2=biweekly, etc.
 * @param lastCreatedDate ISO date string (YYYY-MM-DD) of last created match, or null
 * @returns ISO date string (YYYY-MM-DD)
 */
export function getNextMatchDate(
  dayOfWeek: number,
  frequencyWeeks: number,
  lastCreatedDate: string | null
): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
