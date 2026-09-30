import { describe, it, expect } from 'vitest';
import {
  naive,
  local,
  encode,
  busy_range,
  ics_times,
  wall_strings,
} from '../src/booking_time';

describe('booking_time logic ported from Rust', () => {
  it('seasonal offsets and legacy values match calrs', () => {
    const paris = 'Europe/Paris';
    const cases = [
      { wall: '2026-07-01T14:00:00', utc: '2026-07-01T12:00:00Z' },
      { wall: '2026-01-01T14:00:00', utc: '2026-01-01T13:00:00Z' },
    ];

    for (const { wall, utc } of cases) {
      const encoded = encode(naive(wall)!, paris, 30);
      expect(encoded).not.toBeNull();
      const [start] = encoded!;
      expect(start).toBe(utc);
      expect(local(start, 'UTC', paris)).toBe(naive(wall));
      expect(local(wall, paris, paris)).toBe(naive(wall));
    }
  });

  it('ambiguous or nonexistent start is rejected', () => {
    const paris = 'Europe/Paris';
    // 2026-03-29 02:30:00 is nonexistent in Europe/Paris (DST forward jump from 02:00 to 03:00)
    expect(encode(naive('2026-03-29T02:30:00')!, paris, 30)).toBeNull();

    // 2026-10-25 02:30:00 is ambiguous in Europe/Paris (DST backward fall from 03:00 to 02:00)
    expect(encode(naive('2026-10-25T02:30:00')!, paris, 30)).toBeNull();
  });

  it('calendar endpoints survive midnight and dst', () => {
    const paris = 'Europe/Paris';
    const cases = [
      {
        wall: '2026-03-29T01:30:00',
        minutes: 120,
        expectedStart: '20260329T003000Z',
        expectedEnd: '20260329T023000Z',
      },
      {
        wall: '2026-10-25T01:30:00',
        minutes: 180,
        expectedStart: '20261024T233000Z',
        expectedEnd: '20261025T023000Z',
      },
      {
        wall: '2026-07-01T23:45:00',
        minutes: 60,
        expectedStart: '20260701T214500Z',
        expectedEnd: '20260701T224500Z',
      },
    ];

    for (const { wall, minutes, expectedStart, expectedEnd } of cases) {
      const encoded = encode(naive(wall)!, paris, minutes);
      expect(encoded).not.toBeNull();
      const [s, e] = encoded!;
      const ics = ics_times(s, e);
      expect(ics).not.toBeNull();
      const [startIcs, endIcs] = ics!;
      expect(startIcs).toBe(expectedStart);
      expect(endIcs).toBe(expectedEnd);
    }
  });

  it('wall strings formats correctly for target timezone', () => {
    const [start, end] = wall_strings(
      '2026-07-01T12:00:00Z',
      '2026-07-01T12:30:00Z',
      'America/Toronto'
    );
    // Toronto is UTC-4 in July
    expect(start).toBe('2026-07-01T08:00:00');
    expect(end).toBe('2026-07-01T08:30:00');
  });

  it('busy range expands envelope during DST fall back', () => {
    const paris = 'Europe/Paris';
    // Interval spanning the fall back on 2026-10-25
    const range = busy_range('2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z', paris);
    expect(range).not.toBeNull();
    const [first, last] = range!;
    expect(first).toBeDefined();
    expect(last).toBeDefined();
  });
});
