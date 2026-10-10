/**
 * Helper to get YYYY-MM-DD in local time
 */
export function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the next available working clinic date starting from tomorrow.
 * Respects configured working days (0=Sunday ... 6=Saturday) and specific clinic holidays.
 */
export function getNextBookableClinicDate(
  referenceDate: Date,
  workingDays: number[], // e.g. [1, 2, 3, 4, 5, 6]
  holidays: Date[]       // array of holiday dates
): Date {
  const holidaySet = new Set(holidays.map(toLocalDateString));

  // Start from tomorrow
  const candidate = new Date(referenceDate);
  candidate.setDate(candidate.getDate() + 1);
  candidate.setHours(0, 0, 0, 0);

  // Search forward up to 30 days
  for (let i = 0; i < 30; i++) {
    const dayOfWeek = candidate.getDay(); // 0 = Sun, 1 = Mon ...
    const dateStr = toLocalDateString(candidate);

    const isWorkingDay = workingDays.includes(dayOfWeek);
    const isHoliday = holidaySet.has(dateStr);

    if (isWorkingDay && !isHoliday) {
      return new Date(candidate);
    }

    candidate.setDate(candidate.getDate() + 1);
  }

  throw new Error('NO_AVAILABLE_WORKING_DAY_FOUND');
}

export function formatClinicDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
