export function useIsOpen(hours: string | null | undefined): boolean | null {
  if (!hours) return null;

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayNames: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  const parseTime = (t: string): number => {
    const clean = t.trim().toLowerCase();
    const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) return -1;
    let h = parseInt(match[1]);
    const m = parseInt(match[2] || '0');
    const period = match[3];
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60 + m;
  };

  // Extract the time range (works regardless of day prefix)
  const timeRangeMatch = hours.match(
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[–—\-to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );
  if (!timeRangeMatch) return null;

  const openTime = parseTime(timeRangeMatch[1]);
  const closeTime = parseTime(timeRangeMatch[2]);
  if (openTime < 0 || closeTime < 0) return null;

  // Handle overnight ranges (e.g. "3:00 PM – 12:00 AM") where closeTime <= openTime
  const isInTimeRange =
    closeTime > openTime
      ? currentMinutes >= openTime && currentMinutes < closeTime
      : currentMinutes >= openTime || currentMinutes < closeTime;
  const lower = hours.toLowerCase();

  // "Daily" — open every day
  if (lower.startsWith('daily')) return isInTimeRange;

  // Day range like "Tue–Sun" or "Mon-Fri"
  const rangeMatch = lower.match(/\b([a-z]+)\s*[–—\-]\s*([a-z]+)\b/);
  if (rangeMatch && dayNames[rangeMatch[1]] !== undefined && dayNames[rangeMatch[2]] !== undefined) {
    const start = dayNames[rangeMatch[1]];
    const end = dayNames[rangeMatch[2]];
    const inRange =
      start <= end
        ? currentDay >= start && currentDay <= end
        : currentDay >= start || currentDay <= end;
    return inRange && isInTimeRange;
  }

  // Comma-separated days like "Monday, Tuesday, Wednesday, ..."
  const dayMatches = [
    ...lower.matchAll(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/g),
  ];
  if (dayMatches.length > 0) {
    const listed = dayMatches.map((m) => dayNames[m[1]]);
    return listed.includes(currentDay) && isInTimeRange;
  }

  // Fallback: no day info — assume daily
  return isInTimeRange;
}