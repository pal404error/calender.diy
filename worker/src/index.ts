// TrueNorth Bookings — Canadian White-Label Scheduling on Cloudflare Workers + D1
// Ported faithfully from calrs (AGPL-3.0)

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env, User, EventType, Booking } from './types';
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  generateToken,
} from './auth';
import {
  encode,
  wall_strings,
  ics_times,
  toWallString,
} from './booking_time';
import { computeEventSlots } from './availability';
import {
  sendBookingConfirmationEmail,
  sendPendingDepositEmail,
  sendCancellationEmail,
  generateIcs,
  type EmailBookingDetails,
} from './email';
import {
  formatCanadianPostalCode,
  isValidCanadianPostalCode,
  formatCanadianPhone,
} from './i18n';
import {
  renderUserProfile,
  renderEventSlots,
  renderBookingForm,
  renderConfirmation,
  renderCancelPage,
} from './views/public';
import {
  renderLogin,
  renderDashboard,
  renderBookingsList,
  renderEventTypesList,
  renderEventTypeForm,
  renderVendorProfile,
} from './views/dashboard';

const app = new Hono<{ Bindings: Env }>();

// Helper to authenticate request
async function getAuthUser(c: any): Promise<User | null> {
  const sessionId = getCookie(c, 'session');
  return validateSession(c.env.DB, sessionId);
}

// -------------------------------------------------------------
// Root & Static Assets
// -------------------------------------------------------------

app.get('/', async (c) => {
  const user = await getAuthUser(c);
  if (user) {
    return c.redirect('/dashboard');
  }

  // Find the primary vendor account
  const vendor = await c.env.DB.prepare(
    'SELECT username FROM users WHERE enabled = 1 AND username IS NOT NULL LIMIT 1'
  ).first<{ username: string }>();

  if (vendor?.username) {
    return c.redirect(`/u/${vendor.username}`);
  }

  return c.redirect('/auth/login');
});

// -------------------------------------------------------------
// Authentication Routes
// -------------------------------------------------------------

app.get('/auth/login', async (c) => {
  const user = await getAuthUser(c);
  if (user) return c.redirect('/dashboard');
  return c.html(renderLogin());
});

app.post('/auth/login', async (c) => {
  const body = await c.req.parseBody();
  const email = (body.email as string)?.trim().toLowerCase();
  const password = body.password as string;

  if (!email || !password) {
    return c.html(renderLogin('Please enter both email and password.'), 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(email) = ? AND enabled = 1'
  )
    .bind(email)
    .first<User>();

  if (!user || !user.password_hash) {
    return c.html(renderLogin('Invalid email or password.'), 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.html(renderLogin('Invalid email or password.'), 401);
  }

  const sessionId = await createSession(c.env.DB, user.id);
  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
  });

  return c.redirect('/dashboard');
});

app.post('/auth/logout', async (c) => {
  const sessionId = getCookie(c, 'session');
  if (sessionId) {
    await destroySession(c.env.DB, sessionId);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.redirect('/auth/login');
});

// -------------------------------------------------------------
// Public Vendor Booking Routes
// -------------------------------------------------------------

// Vendor Profile
app.get('/u/:username', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(username) = ? AND enabled = 1'
  )
    .bind(username)
    .first<User>();

  if (!user) return c.text('Vendor not found', 404);

  const eventTypes = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?)
       AND et.enabled = 1 AND et.visibility = 'public'
     ORDER BY et.title`
  )
    .bind(user.id, user.id)
    .all<EventType>();

  return c.html(renderUserProfile(user, eventTypes.results || []));
});

// Slot Picker for an Event Type
app.get('/u/:username/:slug', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const slug = c.req.param('slug').toLowerCase();
  const tzQuery = c.req.query('tz');

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(username) = ? AND enabled = 1'
  )
    .bind(username)
    .first<User>();

  if (!user) return c.text('Vendor not found', 404);

  const et = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?)
       AND LOWER(et.slug) = ? AND et.enabled = 1`
  )
    .bind(user.id, user.id, slug)
    .first<EventType>();

  if (!et) return c.text('Service not found', 404);

  const guestTz = tzQuery || user.timezone || 'America/Toronto';
  const { days } = await computeEventSlots(c.env.DB, et.id, guestTz, {
    startOffset: 0,
    daysAhead: 14,
  });

  return c.html(renderEventSlots(user, et, days, guestTz));
});

// Booking Form View
app.get('/u/:username/:slug/book', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const slug = c.req.param('slug').toLowerCase();
  const date = c.req.query('date');
  const time = c.req.query('time');
  const tz = c.req.query('tz') || 'America/Toronto';

  if (!date || !time) {
    return c.redirect(`/u/${username}/${slug}`);
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(username) = ? AND enabled = 1'
  )
    .bind(username)
    .first<User>();

  if (!user) return c.text('Vendor not found', 404);

  const et = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?)
       AND LOWER(et.slug) = ? AND et.enabled = 1`
  )
    .bind(user.id, user.id, slug)
    .first<EventType>();

  if (!et) return c.text('Service not found', 404);

  return c.html(
    renderBookingForm(user, et, date, time, tz, c.env.TURNSTILE_SITE_KEY)
  );
});

// Handle Booking Form Submission
app.post('/u/:username/:slug/book', async (c) => {
  const username = c.req.param('username').toLowerCase();
  const slug = c.req.param('slug').toLowerCase();
  const body = await c.req.parseBody();

  const date = body.date as string;
  const time = body.time as string;
  const tz = (body.tz as string) || 'America/Toronto';
  const name = (body.name as string)?.trim();
  const email = (body.email as string)?.trim().toLowerCase();
  const phone = body.phone ? formatCanadianPhone(body.phone as string) : null;
  const notes = (body.notes as string)?.trim() || null;
  const turnstileResponse = body['cf-turnstile-response'] as string;

  if (!date || !time || !name || !email) {
    return c.text('Missing required booking fields', 400);
  }

  // Turnstile Verification (if configured)
  if (c.env.TURNSTILE_SECRET_KEY && turnstileResponse !== 'dev-bypass') {
    try {
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${encodeURIComponent(c.env.TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(turnstileResponse)}`,
        }
      );
      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        return c.text('Turnstile verification failed. Please try again.', 403);
      }
    } catch (err) {
      console.error('Turnstile verification error:', err);
    }
  }

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE LOWER(username) = ? AND enabled = 1'
  )
    .bind(username)
    .first<User>();

  if (!user) return c.text('Vendor not found', 404);

  const et = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?)
       AND LOWER(et.slug) = ? AND et.enabled = 1`
  )
    .bind(user.id, user.id, slug)
    .first<EventType>();

  if (!et) return c.text('Service not found', 404);

  // Encode start time to UTC instant using exact calrs booking_time algorithm
  const naiveTime = `${date}T${time}:00`;
  const encoded = encode(naiveTime, tz, et.duration_min);
  if (!encoded) {
    return c.text(
      'The requested time is nonexistent or ambiguous due to daylight saving change. Please choose another slot.',
      400
    );
  }

  const [utcStart, utcEnd] = encoded;

  // Determine initial booking status:
  // If event type requires an Interac deposit or manual approval, place in pending hold!
  const hasDeposit = et.deposit_amount && et.deposit_amount > 0;
  const isPending = hasDeposit || et.requires_confirmation === 1;
  const status = isPending ? 'pending' : 'confirmed';
  const depositStatus = hasDeposit ? 'pending' : 'none';

  const bookingId = generateToken(16);
  const uid = generateToken(16);
  const cancelToken = generateToken(24);
  const rescheduleToken = generateToken(24);

  // Insert booking into D1 with version 1 UTC timestamps
  await c.env.DB.prepare(
    `INSERT INTO bookings (
       id, event_type_id, uid, guest_name, guest_email, guest_timezone,
       notes, start_at, end_at, status, cancel_token, reschedule_token,
       assigned_user_id, guest_phone, deposit_status, time_version
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(
      bookingId,
      et.id,
      uid,
      name,
      email,
      tz,
      notes,
      utcStart,
      utcEnd,
      status,
      cancelToken,
      rescheduleToken,
      user.id,
      phone,
      depositStatus
    )
    .run();

  // Prepare email details
  const ics = ics_times(utcStart, utcEnd)!;
  const appUrl = c.env.APP_URL || new URL(c.req.url).origin;
  const cancelUrl = `${appUrl}/booking/cancel/${cancelToken}`;
  const addressLine = [user.street_address, user.province, user.postal_code]
    .filter(Boolean)
    .join(', ');

  const emailDetails: EmailBookingDetails = {
    uid,
    eventTitle: et.title,
    guestName: name,
    guestEmail: email,
    guestTimezone: tz,
    hostName: user.name,
    hostEmail: user.email,
    hostTimezone: user.timezone,
    dateStr: date,
    startTimeStr: time,
    endTimeStr: toWallString(new Date(utcEnd), tz).split('T')[1].substring(0, 5),
    utcStartIcs: ics[0],
    utcEndIcs: ics[1],
    notes,
    location: et.location_value || et.location_type,
    cancelUrl,
    businessName: user.business_name,
    businessAddress: addressLine,
    businessPhone: user.phone,
    taxNumber: user.tax_number,
    pricesIncludeTax: user.prices_include_tax === 1,
    cancellationPolicy: et.cancellation_policy,
    depositAmount: et.deposit_amount,
    depositRecipientEmail: et.deposit_recipient_email || user.email,
    bookingReference: uid.slice(0, 8),
  };

  // Dispatch Brevo email in background via ctx.waitUntil
  c.executionCtx.waitUntil(
    (async () => {
      try {
        if (status === 'pending') {
          await sendPendingDepositEmail(c.env, emailDetails);
        } else {
          await sendBookingConfirmationEmail(c.env, emailDetails);
        }
      } catch (err) {
        console.error('Failed to send booking email:', err);
      }
    })()
  );

  return c.redirect(`/confirmed/${cancelToken}`);
});

// Confirmation Page
app.get('/confirmed/:token', async (c) => {
  const token = c.req.param('token');
  const booking = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, et.deposit_amount, et.deposit_recipient_email, et.cancellation_policy,
            u.id as user_id
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE b.cancel_token = ?`
  )
    .bind(token)
    .first<any>();

  if (!booking) return c.text('Booking not found', 404);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(booking.user_id)
    .first<User>();

  const et = await c.env.DB.prepare('SELECT * FROM event_types WHERE id = ?')
    .bind(booking.event_type_id)
    .first<EventType>();

  if (!user || !et) return c.text('Record not found', 404);

  return c.html(renderConfirmation(booking, user, et));
});

// Download .ics file
app.get('/booking/ics/:token', async (c) => {
  const token = c.req.param('token');
  const booking = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, et.location_type, et.location_value, et.cancellation_policy,
            u.name as host_name, u.email as host_email, u.business_name, u.street_address, u.province, u.postal_code, u.phone as business_phone, u.tax_number, u.prices_include_tax
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE b.cancel_token = ?`
  )
    .bind(token)
    .first<any>();

  if (!booking) return c.text('Booking not found', 404);

  const ics = ics_times(booking.start_at, booking.end_at)!;
  const appUrl = c.env.APP_URL || new URL(c.req.url).origin;
  const cancelUrl = `${appUrl}/booking/cancel/${token}`;
  const addressLine = [booking.street_address, booking.province, booking.postal_code]
    .filter(Boolean)
    .join(', ');

  const icsContent = generateIcs({
    uid: booking.uid,
    eventTitle: booking.event_title,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestTimezone: booking.guest_timezone,
    hostName: booking.host_name,
    hostEmail: booking.host_email,
    hostTimezone: 'America/Toronto',
    dateStr: booking.start_at.split('T')[0],
    startTimeStr: booking.start_at,
    endTimeStr: booking.end_at,
    utcStartIcs: ics[0],
    utcEndIcs: ics[1],
    notes: booking.notes,
    location: booking.location_value || booking.location_type,
    cancelUrl,
    businessName: booking.business_name,
    businessAddress: addressLine,
    businessPhone: booking.business_phone,
    taxNumber: booking.tax_number,
    cancellationPolicy: booking.cancellation_policy,
    bookingReference: booking.uid.slice(0, 8),
  });

  return new Response(icsContent, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="booking.ics"',
    },
  });
});

// Guest Cancel Form
app.get('/booking/cancel/:token', async (c) => {
  const token = c.req.param('token');
  const booking = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, et.cancellation_policy, u.id as user_id
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE b.cancel_token = ?`
  )
    .bind(token)
    .first<any>();

  if (!booking) return c.text('Booking not found', 404);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(booking.user_id)
    .first<User>();

  const et = await c.env.DB.prepare('SELECT * FROM event_types WHERE id = ?')
    .bind(booking.event_type_id)
    .first<EventType>();

  return c.html(renderCancelPage(booking, user!, et!));
});

// Guest Cancel Action
app.post('/booking/cancel/:token', async (c) => {
  const token = c.req.param('token');
  const body = await c.req.parseBody();
  const reason = (body.reason as string)?.trim();

  const booking = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, u.name as host_name, u.email as host_email, u.timezone as host_timezone
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE b.cancel_token = ?`
  )
    .bind(token)
    .first<any>();

  if (!booking) return c.text('Booking not found', 404);

  await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?")
    .bind(booking.id)
    .run();

  const ics = ics_times(booking.start_at, booking.end_at)!;
  const appUrl = c.env.APP_URL || new URL(c.req.url).origin;

  c.executionCtx.waitUntil(
    sendCancellationEmail(
      c.env,
      {
        uid: booking.uid,
        eventTitle: booking.event_title,
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        guestTimezone: booking.guest_timezone,
        hostName: booking.host_name,
        hostEmail: booking.host_email,
        hostTimezone: booking.host_timezone || 'America/Toronto',
        dateStr: booking.start_at.split('T')[0],
        startTimeStr: booking.start_at,
        endTimeStr: booking.end_at,
        utcStartIcs: ics[0],
        utcEndIcs: ics[1],
        cancelUrl: `${appUrl}/booking/cancel/${token}`,
        bookingReference: booking.uid.slice(0, 8),
      },
      reason
    )
  );

  return c.redirect(`/confirmed/${token}`);
});

// -------------------------------------------------------------
// Vendor Admin Dashboard Routes
// -------------------------------------------------------------

// Dashboard Overview
app.get('/dashboard', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const pending = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?) AND b.status = 'pending'`
  )
    .bind(user.id, user.id)
    .first<{ count: number }>();

  const confirmed = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?) AND b.status = 'confirmed'`
  )
    .bind(user.id, user.id)
    .first<{ count: number }>();

  const etCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE (a.user_id = ? OR et.created_by_user_id = ?) AND et.enabled = 1`
  )
    .bind(user.id, user.id)
    .first<{ count: number }>();

  return c.html(
    renderDashboard(
      user,
      pending?.count || 0,
      confirmed?.count || 0,
      etCount?.count || 0
    )
  );
});

// Bookings List
app.get('/dashboard/bookings', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const bookings = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, et.deposit_amount, et.deposit_recipient_email
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     WHERE a.user_id = ? OR et.created_by_user_id = ?
     ORDER BY b.start_at DESC LIMIT 100`
  )
    .bind(user.id, user.id)
    .all<any>();

  return c.html(renderBookingsList(user, bookings.results || []));
});

// Approve Pending Interac Booking
app.post('/dashboard/bookings/:id/approve', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const bookingId = c.req.param('id');
  const booking = await c.env.DB.prepare(
    `SELECT b.*, et.title as event_title, et.location_type, et.location_value, et.cancellation_policy
     FROM bookings b
     JOIN event_types et ON et.id = b.event_type_id
     JOIN accounts a ON a.id = et.account_id
     WHERE b.id = ? AND (a.user_id = ? OR et.created_by_user_id = ?)`
  )
    .bind(bookingId, user.id, user.id)
    .first<any>();

  if (!booking) return c.text('Booking not found', 404);

  await c.env.DB.prepare(
    "UPDATE bookings SET status = 'confirmed', deposit_status = 'received' WHERE id = ?"
  )
    .bind(bookingId)
    .run();

  const ics = ics_times(booking.start_at, booking.end_at)!;
  const appUrl = c.env.APP_URL || new URL(c.req.url).origin;
  const addressLine = [user.street_address, user.province, user.postal_code]
    .filter(Boolean)
    .join(', ');

  c.executionCtx.waitUntil(
    sendBookingConfirmationEmail(c.env, {
      uid: booking.uid,
      eventTitle: booking.event_title,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      guestTimezone: booking.guest_timezone,
      hostName: user.name,
      hostEmail: user.email,
      hostTimezone: user.timezone,
      dateStr: booking.start_at.split('T')[0],
      startTimeStr: booking.start_at,
      endTimeStr: booking.end_at,
      utcStartIcs: ics[0],
      utcEndIcs: ics[1],
      notes: booking.notes,
      location: booking.location_value || booking.location_type,
      cancelUrl: `${appUrl}/booking/cancel/${booking.cancel_token}`,
      businessName: user.business_name,
      businessAddress: addressLine,
      businessPhone: user.phone,
      taxNumber: user.tax_number,
      cancellationPolicy: booking.cancellation_policy,
      bookingReference: booking.uid.slice(0, 8),
    })
  );

  return c.redirect('/dashboard/bookings');
});

// Decline / Cancel Booking
app.post('/dashboard/bookings/:id/decline', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const bookingId = c.req.param('id');
  await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?")
    .bind(bookingId)
    .run();

  return c.redirect('/dashboard/bookings');
});

app.post('/dashboard/bookings/:id/cancel', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const bookingId = c.req.param('id');
  await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?")
    .bind(bookingId)
    .run();

  return c.redirect('/dashboard/bookings');
});

// Event Types List
app.get('/dashboard/event-types', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const eventTypes = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE a.user_id = ? OR et.created_by_user_id = ?
     ORDER BY et.title`
  )
    .bind(user.id, user.id)
    .all<EventType>();

  return c.html(renderEventTypesList(user, eventTypes.results || []));
});

// Create Event Type Form
app.get('/dashboard/event-types/new', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');
  return c.html(renderEventTypeForm(user));
});

app.post('/dashboard/event-types/new', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const body = await c.req.parseBody();
  const title = (body.title as string)?.trim();
  const slug = (body.slug as string)?.trim().toLowerCase();
  const description = (body.description as string)?.trim() || null;
  const duration = parseInt(body.duration_min as string, 10) || 30;
  const bufferBefore = parseInt(body.buffer_before as string, 10) || 0;
  const bufferAfter = parseInt(body.buffer_after as string, 10) || 0;
  const depositAmount = body.deposit_amount
    ? parseFloat(body.deposit_amount as string)
    : null;
  const depositEmail = (body.deposit_recipient_email as string)?.trim() || null;
  const policy = (body.cancellation_policy as string)?.trim() || null;

  if (!title || !slug) {
    return c.text('Title and slug are required', 400);
  }

  // Get user account
  const account = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE user_id = ? LIMIT 1'
  )
    .bind(user.id)
    .first<{ id: string }>();

  const accountId = account?.id || user.id;
  const eventTypeId = generateToken(16);

  await c.env.DB.prepare(
    `INSERT INTO event_types (
       id, account_id, slug, title, description, duration_min,
       buffer_before, buffer_after, deposit_amount, deposit_recipient_email,
       cancellation_policy, created_by_user_id, enabled
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  )
    .bind(
      eventTypeId,
      accountId,
      slug,
      title,
      description,
      duration,
      bufferBefore,
      bufferAfter,
      depositAmount,
      depositEmail,
      policy,
      user.id
    )
    .run();

  // Create standard Mon-Fri 09:00 - 17:00 availability rules
  const ruleStmts = [1, 2, 3, 4, 5].map((day) =>
    c.env.DB.prepare(
      'INSERT INTO availability_rules (id, event_type_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)'
    ).bind(generateToken(16), eventTypeId, day, '09:00', '17:00')
  );

  await c.env.DB.batch(ruleStmts);

  return c.redirect('/dashboard/event-types');
});

// Edit Event Type Form
app.get('/dashboard/event-types/:slug/edit', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const slug = c.req.param('slug').toLowerCase();
  const et = await c.env.DB.prepare(
    `SELECT et.* FROM event_types et
     JOIN accounts a ON a.id = et.account_id
     WHERE LOWER(et.slug) = ? AND (a.user_id = ? OR et.created_by_user_id = ?)`
  )
    .bind(slug, user.id, user.id)
    .first<EventType>();

  if (!et) return c.text('Service not found', 404);

  return c.html(renderEventTypeForm(user, et));
});

app.post('/dashboard/event-types/:slug/edit', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const oldSlug = c.req.param('slug').toLowerCase();
  const body = await c.req.parseBody();

  const title = (body.title as string)?.trim();
  const newSlug = (body.slug as string)?.trim().toLowerCase();
  const description = (body.description as string)?.trim() || null;
  const duration = parseInt(body.duration_min as string, 10) || 30;
  const bufferBefore = parseInt(body.buffer_before as string, 10) || 0;
  const bufferAfter = parseInt(body.buffer_after as string, 10) || 0;
  const depositAmount = body.deposit_amount
    ? parseFloat(body.deposit_amount as string)
    : null;
  const depositEmail = (body.deposit_recipient_email as string)?.trim() || null;
  const policy = (body.cancellation_policy as string)?.trim() || null;

  await c.env.DB.prepare(
    `UPDATE event_types
     SET title = ?, slug = ?, description = ?, duration_min = ?,
         buffer_before = ?, buffer_after = ?, deposit_amount = ?,
         deposit_recipient_email = ?, cancellation_policy = ?
     WHERE slug = ?`
  )
    .bind(
      title,
      newSlug,
      description,
      duration,
      bufferBefore,
      bufferAfter,
      depositAmount,
      depositEmail,
      policy,
      oldSlug
    )
    .run();

  return c.redirect('/dashboard/event-types');
});

app.post('/dashboard/event-types/:slug/delete', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const slug = c.req.param('slug').toLowerCase();
  await c.env.DB.prepare(
    `DELETE FROM event_types WHERE slug = ? AND account_id IN (SELECT id FROM accounts WHERE user_id = ?)`
  )
    .bind(slug, user.id)
    .run();

  return c.redirect('/dashboard/event-types');
});

// Canadian Vendor Profile & Tax Settings
app.get('/dashboard/settings', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');
  return c.html(renderVendorProfile(user));
});

app.post('/dashboard/settings', async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.redirect('/auth/login');

  const body = await c.req.parseBody();
  const businessName = (body.business_name as string)?.trim() || null;
  const streetAddress = (body.street_address as string)?.trim() || null;
  const province = (body.province as string)?.trim().toUpperCase() || null;
  const rawPostal = (body.postal_code as string)?.trim() || null;
  const phone = body.phone ? formatCanadianPhone(body.phone as string) : null;
  const timezone = (body.timezone as string)?.trim() || user.timezone;
  const taxNumber = (body.tax_number as string)?.trim() || null;
  const pricesIncludeTax = body.prices_include_tax ? 1 : 0;

  let postalCode = rawPostal;
  if (rawPostal) {
    if (!isValidCanadianPostalCode(rawPostal)) {
      return c.html(
        renderVendorProfile(
          { ...user, business_name: businessName, street_address: streetAddress, province, phone, timezone, tax_number: taxNumber, prices_include_tax: pricesIncludeTax },
          'Error: Invalid Canadian postal code format (must match A1A 1A1).'
        ),
        400
      );
    }
    postalCode = formatCanadianPostalCode(rawPostal);
  }

  await c.env.DB.prepare(
    `UPDATE users
     SET business_name = ?, street_address = ?, province = ?, postal_code = ?,
         phone = ?, timezone = ?, tax_number = ?, prices_include_tax = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      businessName,
      streetAddress,
      province,
      postalCode,
      phone,
      timezone,
      taxNumber,
      pricesIncludeTax,
      user.id
    )
    .run();

  const updatedUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(user.id)
    .first<User>();

  return c.html(
    renderVendorProfile(
      updatedUser!,
      '✓ Canadian profile & tax details saved successfully.'
    )
  );
});

export default app;
