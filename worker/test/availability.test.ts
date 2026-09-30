import { describe, it, expect } from 'vitest';
import { computeSlotsFromRules, hasConflict, busySourceIsFree } from '../src/availability';
import type { AvailabilityRule, AvailabilityOverride } from '../src/types';

describe('Availability Engine (ported from calrs)', () => {
  const defaultRules: AvailabilityRule[] = [
    // Mon-Fri 09:00 to 17:00
    { id: '1', event_type_id: 'et1', day_of_week: 1, start_time: '09:00', end_time: '17:00' },
    { id: '2', event_type_id: 'et1', day_of_week: 2, start_time: '09:00', end_time: '17:00' },
    { id: '3', event_type_id: 'et1', day_of_week: 3, start_time: '09:00', end_time: '17:00' },
    { id: '4', event_type_id: 'et1', day_of_week: 4, start_time: '09:00', end_time: '17:00' },
    { id: '5', event_type_id: 'et1', day_of_week: 5, start_time: '09:00', end_time: '17:00' },
  ];

  it('generates 30-minute slots between 09:00 and 17:00', () => {
    const days = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 7,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    expect(days.length).toBeGreaterThan(0);
    const day = days[0];
    expect(day.slots.length).toBe(16); // 8 hours * 2 slots/hr
    expect(day.slots[0].start).toBe('09:00');
    expect(day.slots[0].end).toBe('09:30');
    expect(day.slots[15].start).toBe('16:30');
    expect(day.slots[15].end).toBe('17:00');
  });

  it('removes slots conflicting with busy periods', () => {
    const firstDay = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 1,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    if (firstDay.length === 0) return; // Weekend
    const targetDate = firstDay[0].date;

    // Mark 10:00 to 11:00 busy on targetDate
    const busyTimes: [string, string][] = [
      [`${targetDate}T10:00:00`, `${targetDate}T11:00:00`],
    ];

    const filtered = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 1,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
      busy: { type: 'individual', times: busyTimes },
    });

    const slotStarts = filtered[0].slots.map((s) => s.start);
    expect(slotStarts).not.toContain('10:00');
    expect(slotStarts).not.toContain('10:30');
    expect(slotStarts).toContain('09:30');
    expect(slotStarts).toContain('11:00');
  });

  it('respects buffer time before and after meetings', () => {
    const firstDay = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 1,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    if (firstDay.length === 0) return;
    const targetDate = firstDay[0].date;

    // Busy from 10:00 to 10:30. With 15 min buffer before, 09:30 slot (09:30-10:00) overlaps buffer!
    const busyTimes: [string, string][] = [
      [`${targetDate}T10:00:00`, `${targetDate}T10:30:00`],
    ];

    const buffered = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 1,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
      bufferBefore: 15,
      bufferAfter: 15,
      busy: { type: 'individual', times: busyTimes },
    });

    const starts = buffered[0].slots.map((s) => s.start);
    expect(starts).not.toContain('09:30'); // blocked by bufferBefore
    expect(starts).not.toContain('10:00'); // busy
    expect(starts).not.toContain('10:30'); // blocked by bufferAfter
    expect(starts).toContain('09:00');
    expect(starts).toContain('11:00');
  });

  it('skips blocked override days completely', () => {
    const daysBefore = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 3,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    if (daysBefore.length === 0) return;
    const dateToBlock = daysBefore[0].date;

    const overrides: AvailabilityOverride[] = [
      {
        id: 'ov1',
        event_type_id: 'et1',
        date: dateToBlock,
        start_time: null,
        end_time: null,
        is_blocked: 1,
      },
    ];

    const daysAfter = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 3,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
      overrides,
    });

    const remainingDates = daysAfter.map((d) => d.date);
    expect(remainingDates).not.toContain(dateToBlock);
  });

  it('custom hours override replaces weekly rules for that day', () => {
    const daysBefore = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 3,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    if (daysBefore.length === 0) return;
    const targetDate = daysBefore[0].date;

    // Custom hours: 14:00 to 16:00 only
    const overrides: AvailabilityOverride[] = [
      {
        id: 'ov2',
        event_type_id: 'et1',
        date: targetDate,
        start_time: '14:00',
        end_time: '16:00',
        is_blocked: 0,
      },
    ];

    const daysAfter = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 3,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
      overrides,
    });

    const targetDay = daysAfter.find((d) => d.date === targetDate);
    expect(targetDay).toBeDefined();
    expect(targetDay!.slots.length).toBe(4); // 14:00, 14:30, 15:00, 15:30
    expect(targetDay!.slots[0].start).toBe('14:00');
    expect(targetDay!.slots[3].end).toBe('16:00');
  });

  it('firstSlotOnly retains only the earliest slot of each day', () => {
    const days = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 7,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
      firstSlotOnly: true,
    });

    for (const day of days) {
      expect(day.slots.length).toBe(1);
    }
  });

  it('bookingHorizonDays boundary is inclusive and caps days ahead', () => {
    const days = computeSlotsFromRules({
      rules: defaultRules,
      duration: 30,
      startOffset: 1,
      daysAhead: 30,
      bookingHorizonDays: 2,
      hostTz: 'America/Toronto',
      guestTz: 'America/Toronto',
      minNotice: 0,
    });

    expect(days.length).toBeLessThanOrEqual(2);
  });
});
