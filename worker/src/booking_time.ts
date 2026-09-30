// Faithful TypeScript port of calrs src/booking_time.rs
// Version 0: legacy local wall clock (unmarked)
// Version 1: RFC3339 UTC instant (enforces trailing Z)

export interface NaiveDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function parseNaive(value: string): NaiveDateTime | null {
  const clean = value.trim().replace(/Z$/, '');
  const [d, t] = clean.split(/[T ]/);
  if (!d) return null;
  const dParts = d.split('-').map(Number);
  if (dParts.length !== 3 || dParts.some(isNaN)) return null;
  const tParts = (t || '00:00:00').split(':').map(Number);
  if (tParts.length < 2 || tParts.some(isNaN)) return null;
  return {
    year: dParts[0],
    month: dParts[1],
    day: dParts[2],
    hour: tParts[0],
    minute: tParts[1],
    second: tParts[2] || 0,
  };
}

export function formatNaive(n: NaiveDateTime): string {
  const y = String(n.year).padStart(4, '0');
  const m = String(n.month).padStart(2, '0');
  const d = String(n.day).padStart(2, '0');
  const hh = String(n.hour).padStart(2, '0');
  const mm = String(n.minute).padStart(2, '0');
  const ss = String(n.second).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export function naive(value: string): string | null {
  const parsed = parseNaive(value);
  return parsed ? formatNaive(parsed) : null;
}

/**
 * Returns the offset in milliseconds (local_minus_utc) for a given UTC instant in the given timezone.
 */
export function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const getPart = (t: string) => parseInt(parts.find((p) => p.type === t)!.value, 10);
    let hour = getPart('hour');
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      hour,
      getPart('minute'),
      getPart('second')
    );
    return asUtc - date.getTime();
  } catch {
    return 0; // fallback to UTC
  }
}

/**
 * Render a Date object in a timezone as "YYYY-MM-DDTHH:MM:SS"
 */
export function toWallString(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const getPart = (t: string) => parts.find((p) => p.type === t)!.value;
    let h = getPart('hour');
    if (h === '24') h = '00';
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${h}:${getPart('minute')}:${getPart('second')}`;
  } catch {
    return date.toISOString().replace(/\.\d{3}Z$/, '');
  }
}

/**
 * Resolves a local wall-clock string to a unique UTC instant.
 * Nonexistent or ambiguous times return null.
 */
export function fromLocalToUtcSingle(naiveStr: string, timeZone: string): Date | null {
  const n = parseNaive(naiveStr);
  if (!n) return null;
  const targetWall = formatNaive(n);
  const targetMs = Date.UTC(n.year, n.month - 1, n.day, n.hour, n.minute, n.second);

  const testDts = [
    new Date(targetMs - 14 * 3600000),
    new Date(targetMs - 2 * 3600000),
    new Date(targetMs - 1 * 3600000),
    new Date(targetMs),
    new Date(targetMs + 1 * 3600000),
    new Date(targetMs + 2 * 3600000),
    new Date(targetMs + 14 * 3600000),
  ];

  const offsets = new Set(testDts.map((d) => getTimezoneOffsetMs(d, timeZone)));
  const validInstants: Date[] = [];

  for (const offset of offsets) {
    const candidateInstant = new Date(targetMs - offset);
    if (toWallString(candidateInstant, timeZone) === targetWall) {
      if (!validInstants.some((t) => t.getTime() === candidateInstant.getTime())) {
        validInstants.push(candidateInstant);
      }
    }
  }

  if (validInstants.length === 1) return validInstants[0];
  return null;
}

/**
 * UTC records ignore subsequent timezone-setting changes. Legacy records
 * keep their previous interpretation; this never rewrites their timestamps.
 */
export function local(value: string, legacyTz: string, targetTz: string): string | null {
  // If RFC3339 (has 'Z' or '+hh:mm' / '-hh:mm')
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return toWallString(d, targetTz);
    }
  }

  const wall = naive(value);
  if (!wall) return null;
  if (legacyTz === targetTz) {
    return wall;
  }

  // Convert naive in legacyTz to targetTz
  const instant = fromLocalToUtcSingle(wall, legacyTz);
  if (instant) {
    return toWallString(instant, targetTz);
  }

  // Fallback for edge cases: treat as UTC and convert
  const n = parseNaive(wall)!;
  const fallback = new Date(Date.UTC(n.year, n.month - 1, n.day, n.hour, n.minute, n.second));
  return toWallString(fallback, targetTz);
}

/**
 * Conservative wall-clock envelope for the availability engine.
 * On a backward clock change both occurrences of the repeated hour must be
 * blocked. Sorting the endpoints alone would still miss occupied times.
 */
export function busy_range(start: string, end: string, tz: string): [string, string] | null {
  const first = local(start, tz, tz);
  const last = local(end, tz, tz);
  if (!first || !last) return null;

  let firstDate = new Date(first + 'Z');
  let lastDate = new Date(last + 'Z');

  const isRfcStart = start.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(start);
  const isRfcEnd = end.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(end);

  if (isRfcStart && isRfcEnd) {
    const sDate = new Date(start);
    const eDate = new Date(end);
    if (!isNaN(sDate.getTime()) && !isNaN(eDate.getTime())) {
      const offsetStart = getTimezoneOffsetMs(sDate, tz);
      const offsetEnd = getTimezoneOffsetMs(eDate, tz);
      const rollback = offsetStart - offsetEnd;
      if (rollback > 0) {
        firstDate = new Date(firstDate.getTime() - rollback);
        lastDate = new Date(lastDate.getTime() + rollback);
        return [
          firstDate.toISOString().replace(/\.\d{3}Z$/, ''),
          lastDate.toISOString().replace(/\.\d{3}Z$/, ''),
        ];
      }
    }
  }

  return [first, last];
}

/**
 * A new booking must identify one instant. Reject nonexistent/ambiguous local
 * times rather than silently moving a meeting across a daylight-saving change.
 */
export function encode(startNaiveStr: string, tz: string, minutes: number): [string, string] | null {
  const startInstant = fromLocalToUtcSingle(startNaiveStr, tz);
  if (!startInstant) return null;

  const endInstant = new Date(startInstant.getTime() + minutes * 60 * 1000);
  const formatUtc = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

  return [formatUtc(startInstant), formatUtc(endInstant)];
}

/**
 * Local wall-clock strings for presentation only.
 */
export function wall_strings(start: string, end: string, targetTz: string): [string, string] {
  const render = (v: string) => local(v, targetTz, targetTz) || v;
  return [render(start), render(end)];
}

/**
 * Preserves both absolute endpoints in calendar attachments (RFC 5545).
 * Formats as "YYYYMMDDTHHMMSSZ".
 */
export function ics_times(start: string, end: string): [string, string] | null {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;

  const formatIcs = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}${m}${day}T${hh}${mm}${ss}Z`;
  };

  return [formatIcs(s), formatIcs(e)];
}

/**
 * Resolve the configured event timezone from D1.
 */
export async function event_timezone(db: D1Database, eventTypeId: string): Promise<string> {
  const row = await db
    .prepare(
      `SELECT COALESCE(NULLIF(et.timezone, ''), u.timezone) as tz
       FROM event_types et
       JOIN accounts a ON a.id = et.account_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE et.id = ?`
    )
    .bind(eventTypeId)
    .first<{ tz: string | null }>();

  return row?.tz || 'America/Toronto';
}

/**
 * Frequency limits count calendar periods in event timezone, not UTC days.
 */
export async function period_counts(
  db: D1Database,
  eventId: string,
  startStr: string,
  endStr: string
): Promise<Array<[string | null, number]>> {
  const tz = await event_timezone(db, eventId);
  const rows = await db
    .prepare(
      `SELECT CASE time_version WHEN 1 THEN start_at ELSE rtrim(start_at, 'Z') END AS start_at, assigned_user_id
       FROM bookings
       WHERE event_type_id = ? AND status IN ('confirmed', 'pending')
         AND start_at >= datetime(?, '-2 days') AND start_at < datetime(?, '+2 days')`
    )
    .bind(eventId, startStr, endStr)
    .all<{ start_at: string; assigned_user_id: string | null }>();

  const counts = new Map<string | null, number>();
  for (const row of rows.results || []) {
    const loc = local(row.start_at, tz, tz);
    if (loc && loc >= startStr && loc < endStr) {
      const key = row.assigned_user_id;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return Array.from(counts.entries());
}
