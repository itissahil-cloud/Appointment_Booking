import { describe, it, expect } from 'vitest';
import { getNextBookableClinicDate, formatClinicDate, toLocalDateString } from '../../src/modules/clinic-settings/date-calculator.js';

describe('Date Calculator - Next Bookable Clinic Date', () => {
  it('should pick tomorrow if tomorrow is an open working day', () => {
    // 2026-10-07 is Wednesday
    const wednesday = new Date(2026, 9, 7, 10, 0, 0); // Month is 0-indexed: 9 = October
    const workingDays = [1, 2, 3, 4, 5, 6]; // Mon-Sat
    const holidays: Date[] = [];

    const nextDate = getNextBookableClinicDate(wednesday, workingDays, holidays);
    expect(nextDate.getDay()).toBe(4); // Thursday
    expect(toLocalDateString(nextDate)).toBe('2026-10-08');
  });

  it('should skip closed day (Sunday) and pick Monday', () => {
    // 2026-10-10 is Saturday
    const saturday = new Date(2026, 9, 10, 10, 0, 0);
    const workingDays = [1, 2, 3, 4, 5, 6]; // Mon-Sat, Sunday (0) closed
    const holidays: Date[] = [];

    const nextDate = getNextBookableClinicDate(saturday, workingDays, holidays);
    expect(nextDate.getDay()).toBe(1); // Monday
    expect(toLocalDateString(nextDate)).toBe('2026-10-12');
  });

  it('should skip holidays and move to the following working day', () => {
    // 2026-10-05 is Monday
    const monday = new Date(2026, 9, 5, 10, 0, 0);
    const workingDays = [1, 2, 3, 4, 5, 6];
    const holidays = [new Date(2026, 9, 6)]; // Tuesday is a holiday

    const nextDate = getNextBookableClinicDate(monday, workingDays, holidays);
    expect(nextDate.getDay()).toBe(3); // Wednesday
    expect(toLocalDateString(nextDate)).toBe('2026-10-07');
  });

  it('should correctly format dates for Indian clinic display', () => {
    const d = new Date(2026, 9, 8);
    const formatted = formatClinicDate(d);
    expect(formatted).toContain('October');
    expect(formatted).toContain('2026');
  });
});
