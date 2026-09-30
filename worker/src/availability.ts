// Availability and slot computation engine
// Faithful TypeScript port of calrs compute_slots and compute_slots_from_rules

import {
  fromLocalToUtcSingle,
  toWallString,
  busy_range,
  getTimezoneOffsetMs,
  parseNaive,
  formatNaive,
  event_timezone,
} from './booking_time';
import type { SlotDay, SlotTime, AvailabilityRule, AvailabilityOverride } from './types';

export type BusyInterval = [string, string]; // [start_iso_wall, end_iso_wall]

export type BusySource =
  | { type: 'individual'; times: BusyInterval[] }
  | { type: 'group'; memberBusy: Record<string, BusyInterval[]> }
  | { type: 'team'; memberBusy: Record<string, BusyInterval[]> };

/**
 * Check if any busy interval overlaps with [buf_start, buf_end)
 */
export function hasConflict(
  busy: BusyInterval[],
  bufStart: string,
  bufEnd: string
): boolean {
  return busy.some(([s, e]) => s < bufEnd && e > bufStart);
}

/**
 * Whether one slot (buffers already applied) is free under a BusySource.
 */
export function busySourceIsFree(
  busy: BusySource,
  bufStart: string,
  bufEnd: string
): boolean {
  switch (busy.type) {
    case 'individual':
      return !hasConflict(busy.times, bufStart, bufEnd);
    case 'group': {
      const members = Object.values(busy.memberBusy);
      if (members.length === 0) return true;
      return members.some((times) => !hasConflict(times, bufStart, bufEnd));
    }
    case 'team': {
      const members = Object.values(busy.memberBusy);
      if (members.length === 0) return false;
      return members.every((times) => !hasConflict(times, bufStart, bufEnd));
    }
  }
}

/**
 * Add minutes to a naive datetime wall-string "YYYY-MM-DDTHH:MM:SS"
 */
export function addMinutesToWall(wall: string, minutes: number): string {
  const [d, t] = wall.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [h, min, s] = t.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day, h, min + minutes, s || 0));
  const yStr = dt.getUTCFullYear();
  const mStr = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dStr = String(dt.getUTCDate()).padStart(2, '0');
  const hStr = String(dt.getUTCHours()).padStart(2, '0');
  const minStr = String(dt.getUTCMinutes()).padStart(2, '0');
  const sStr = String(dt.getUTCSeconds()).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:${sStr}`;
}

export interface ComputeSlotsOptions {
  rules: AvailabilityRule[];
  duration: number;
  interval?: number;
  bufferBefore?: number;
  bufferAfter?: number;
  minNotice?: number;
  startOffset?: number;
  daysAhead?: number;
  bookingHorizonDays?: number | null;
  hostTz: string;
  guestTz: string;
  busy?: BusySource;
  overrides?: AvailabilityOverride[];
  firstSlotOnly?: boolean;
}

/**
 * Core slot computation from availability rules.
 */
export function computeSlotsFromRules(options: ComputeSlotsOptions): SlotDay[] {
  const {
    rules,
    duration,
    interval = duration,
    bufferBefore = 0,
    bufferAfter = 0,
    minNotice = 60,
    startOffset = 0,
    daysAhead = 14,
    bookingHorizonDays = null,
    hostTz,
    guestTz,
    busy = { type: 'individual', times: [] },
    overrides = [],
    firstSlotOnly = false,
  } = options;

  const now = new Date();
  const nowHostWall = toWallString(now, hostTz);
  const nowHostDate = nowHostWall.split('T')[0];
  const [currY, currM, currD] = nowHostDate.split('-').map(Number);

  const minStartMs = now.getTime() + minNotice * 60 * 1000;
  const slotDurationMin = duration;
  const slotStepMin = Math.max(1, interval);

  const result: SlotDay[] = [];

  for (let dayOffset = startOffset; dayOffset < startOffset + daysAhead; dayOffset++) {
    if (bookingHorizonDays !== null && dayOffset > bookingHorizonDays) {
      break;
    }

    // Base date for this offset in host timezone
    const offsetDate = new Date(Date.UTC(currY, currM - 1, currD + dayOffset));
    const yStr = offsetDate.getUTCFullYear();
    const mStr = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
    const dStr = String(offsetDate.getUTCDate()).padStart(2, '0');
    const dateStr = `${yStr}-${mStr}-${dStr}`;

    // Check availability overrides for this date
    const dayOverrides = overrides.filter((o) => o.date === dateStr);
    if (dayOverrides.some((o) => o.is_blocked === 1)) {
      continue;
    }

    // Windows for the day: custom override hours or weekly rules
    let windows: Array<[string, string]> = [];
    const customHours = dayOverrides.filter(
      (o) => o.is_blocked === 0 && o.start_time && o.end_time
    );

    if (customHours.length > 0) {
      windows = customHours.map((o) => [o.start_time!, o.end_time!]);
    } else {
      const weekday = offsetDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
      windows = rules
        .filter((r) => r.day_of_week === weekday)
        .map((r) => [r.start_time, r.end_time]);
    }

    if (windows.length === 0) continue;

    const daySlots: SlotTime[] = [];

    for (const [startStr, endStr] of windows) {
      let cursor = `${dateStr}T${startStr}:00`;
      const windowEnd = `${dateStr}T${endStr}:00`;

      while (cursor < windowEnd) {
        const slotStartUtc = fromLocalToUtcSingle(cursor, hostTz);
        if (!slotStartUtc) {
          cursor = addMinutesToWall(cursor, slotStepMin);
          continue;
        }

        const slotEndUtc = new Date(slotStartUtc.getTime() + slotDurationMin * 60 * 1000);
        const guestStartWall = toWallString(slotStartUtc, guestTz);
        const guestEndWall = toWallString(slotEndUtc, guestTz);

        const range = busy_range(
          slotStartUtc.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          slotEndUtc.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          hostTz
        );
        if (!range) {
          cursor = addMinutesToWall(cursor, slotStepMin);
          continue;
        }

        const [checkStart, checkEnd] = range;

        // Validation against min_notice, window bounds, and guest timezone ambiguity
        if (
          slotStartUtc.getTime() < minStartMs ||
          checkStart < `${dateStr}T${startStr}:00` ||
          checkEnd > windowEnd ||
          fromLocalToUtcSingle(guestStartWall, guestTz) === null
        ) {
          cursor = addMinutesToWall(cursor, slotStepMin);
          continue;
        }

        const bufStart = addMinutesToWall(checkStart, -bufferBefore);
        const bufEnd = addMinutesToWall(checkEnd, bufferAfter);

        if (busySourceIsFree(busy, bufStart, bufEnd)) {
          const guestTimeParts = guestStartWall.split('T')[1].substring(0, 5);
          const guestEndTimeParts = guestEndWall.split('T')[1].substring(0, 5);
          const hostTimeParts = cursor.split('T')[1].substring(0, 5);

          daySlots.push({
            start: guestTimeParts,
            end: guestEndTimeParts,
            host_date: dateStr,
            host_time: hostTimeParts,
            guest_date: guestStartWall.split('T')[0],
          });
        }

        cursor = addMinutesToWall(cursor, slotStepMin);
      }
    }

    if (daySlots.length > 0) {
      // Group by guest_date because slots near midnight in host TZ may land on different guest dates
      const guestDays = new Map<string, SlotTime[]>();
      for (const slot of daySlots) {
        const list = guestDays.get(slot.guest_date) || [];
        list.push(slot);
        guestDays.set(slot.guest_date, list);
      }

      for (const [guestDateStr, slots] of guestDays.entries()) {
        const [gy, gm, gd] = guestDateStr.split('-').map(Number);
        const dObj = new Date(Date.UTC(gy, gm - 1, gd));
        const label = dObj.toLocaleDateString('en-CA', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        });

        const existing = result.find((d) => d.date === guestDateStr);
        if (existing) {
          existing.slots.push(...slots);
        } else {
          result.push({
            date: guestDateStr,
            label,
            slots,
          });
        }
      }
    }
  }

  // Sort by date, and sort slots within each day by start time
  result.sort((a, b) => a.date.localeCompare(b.date));
  for (const day of result) {
    day.slots.sort((a, b) => a.start.localeCompare(b.start));
    if (firstSlotOnly) {
      day.slots = day.slots.slice(0, 1);
    }
  }

  return result;
}

/**
 * Fetch busy times for an event type from D1 and compute public availability.
 */
export async function computeEventSlots(
  db: D1Database,
  eventTypeId: string,
  guestTz: string,
  options: {
    startOffset?: number;
    daysAhead?: number;
    excludeBookingId?: string;
  } = {}
): Promise<{ hostTz: string; days: SlotDay[] }> {
  // 1. Fetch event type details
  const et = await db
    .prepare(
      `SELECT et.*, COALESCE(NULLIF(et.timezone, ''), u.timezone, 'America/Toronto') as computed_tz
       FROM event_types et
       JOIN accounts a ON a.id = et.account_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE et.id = ?`
    )
    .bind(eventTypeId)
    .first<any>();

  if (!et) {
    return { hostTz: 'America/Toronto', days: [] };
  }

  const hostTz = et.computed_tz;

  // 2. Fetch weekly availability rules
  const rules = await db
    .prepare(
      `SELECT * FROM availability_rules WHERE event_type_id = ? ORDER BY day_of_week, start_time`
    )
    .bind(eventTypeId)
    .all<AvailabilityRule>();

  // 3. Fetch availability overrides
  const overrides = await db
    .prepare(
      `SELECT * FROM availability_overrides WHERE event_type_id = ? ORDER BY date, start_time`
    )
    .bind(eventTypeId)
    .all<AvailabilityOverride>();

  // 4. Fetch existing confirmed/pending bookings that block availability
  const startOffset = options.startOffset ?? 0;
  const daysAhead = options.daysAhead ?? 14;
  const excludeId = options.excludeBookingId ?? '';

  const bookings = await db
    .prepare(
      `SELECT CASE time_version WHEN 1 THEN start_at ELSE rtrim(start_at, 'Z') END AS start_at,
              CASE time_version WHEN 1 THEN end_at ELSE rtrim(end_at, 'Z') END AS end_at
       FROM bookings
       WHERE event_type_id = ?
         AND status IN ('confirmed', 'pending')
         AND (? = '' OR id != ?)`
    )
    .bind(eventTypeId, excludeId, excludeId)
    .all<{ start_at: string; end_at: string }>();

  const busyTimes: BusyInterval[] = [];
  for (const b of bookings.results || []) {
    const range = busy_range(b.start_at, b.end_at, hostTz);
    if (range) {
      busyTimes.push(range);
    }
  }

  const days = computeSlotsFromRules({
    rules: rules.results || [],
    duration: et.duration_min,
    interval: et.slot_interval_min || et.duration_min,
    bufferBefore: et.buffer_before,
    bufferAfter: et.buffer_after,
    minNotice: et.min_notice_min,
    startOffset,
    daysAhead,
    bookingHorizonDays: et.booking_horizon_days,
    hostTz,
    guestTz,
    busy: { type: 'individual', times: busyTimes },
    overrides: overrides.results || [],
    firstSlotOnly: et.first_slot_only === 1,
  });

  return { hostTz, days };
}
