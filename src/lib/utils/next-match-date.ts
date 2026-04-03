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

/**
 * Resolve title pattern with date variables.
 * Supported: {month}, {day}, {weekday}
 */
export function resolveTitle(pattern: string, dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return pattern
    .replace(/\{month\}/g, String(date.getMonth() + 1))
    .replace(/\{day\}/g, String(date.getDate()))
    .replace(/\{weekday\}/g, weekdays[date.getDay()]);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
