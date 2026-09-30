// Vendor Admin Dashboard Views (Bookings approval, Interac deposits, Event Types, Profile & Tax)

import { CANADIAN_PROVINCES, TIMEZONES, formatMoneyCAD } from '../i18n';
import type { User, EventType, Booking } from '../types';
import { htmlLayout } from './layout';

/**
 * Login Page
 */
export function renderLogin(error?: string): string {
  const errorBox = error
    ? `<div class="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md mb-4">${error}</div>`
    : '';

  const content = `
    <div class="max-w-md mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
      <div class="text-center mb-6">
        <span class="text-3xl">🍁</span>
        <h1 class="text-xl font-bold text-gray-900 mt-2">Vendor Login</h1>
        <p class="text-xs text-gray-500">Sign in to manage your Canadian booking schedule</p>
      </div>

      ${errorBox}

      <form action="/auth/login" method="POST" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Email or Username</label>
          <input type="text" name="email" required placeholder="Username or email" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 shadow-sm" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Password</label>
          <input type="password" name="password" required placeholder="••••••••" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 shadow-sm" />
        </div>

        <button type="submit" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-sm shadow transition">
          Sign In
        </button>
      </form>
    </div>
  `;

  return htmlLayout({
    title: 'Vendor Login',
    children: content,
  });
}

/**
 * Dashboard Main View
 */
export function renderDashboard(
  user: User,
  pendingCount: number,
  confirmedCount: number,
  eventTypesCount: number
): string {
  const content = `
    <div class="space-y-6">
      <!-- Welcome Header -->
      <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold text-gray-900">Welcome, ${user.business_name || user.name}!</h1>
            <span class="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded">🇨🇦 Canadian Vendor</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Your public scheduling URL: <a href="/u/${user.username}" target="_blank" class="text-red-600 hover:underline font-medium">/u/${user.username} ↗</a></p>
        </div>
        <div class="flex items-center gap-2">
          <a href="/dashboard/event-types/new" class="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-sm transition">
            + New Service
          </a>
        </div>
      </div>

      <!-- Quick Metrics -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a href="/dashboard/bookings?status=pending" class="bg-white border border-gray-200 rounded-xl p-5 hover:border-amber-400 hover:shadow-sm transition">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500">Pending Interac Holds</span>
            <span class="text-amber-500 font-bold">🍁</span>
          </div>
          <p class="text-2xl font-bold text-amber-700 mt-2">${pendingCount}</p>
          <span class="text-[11px] text-amber-600">Awaiting e-Transfer confirmation</span>
        </a>

        <a href="/dashboard/bookings?status=confirmed" class="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-400 hover:shadow-sm transition">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500">Confirmed Bookings</span>
            <span class="text-green-500 font-bold">✓</span>
          </div>
          <p class="text-2xl font-bold text-green-700 mt-2">${confirmedCount}</p>
          <span class="text-[11px] text-gray-400">Scheduled appointments</span>
        </a>

        <a href="/dashboard/event-types" class="bg-white border border-gray-200 rounded-xl p-5 hover:border-red-400 hover:shadow-sm transition">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-gray-500">Active Services</span>
            <span class="text-red-500 font-bold">⚙️</span>
          </div>
          <p class="text-2xl font-bold text-gray-900 mt-2">${eventTypesCount}</p>
          <span class="text-[11px] text-gray-400">Booking event types</span>
        </a>
      </div>

      <!-- Quick Links Navigation -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <h2 class="text-sm font-bold text-gray-900 mb-2">Bookings & Interac Approval</h2>
          <p class="text-xs text-gray-500 mb-4">View incoming appointment requests, approve Interac deposits, and manage guest schedules.</p>
          <a href="/dashboard/bookings" class="text-xs font-semibold text-red-600 hover:underline">Manage Bookings →</a>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-5">
          <h2 class="text-sm font-bold text-gray-900 mb-2">Canadian Vendor Profile & Taxes</h2>
          <p class="text-xs text-gray-500 mb-4">Configure business location, province/territory, postal code, phone, and GST/HST tax rules.</p>
          <a href="/dashboard/settings" class="text-xs font-semibold text-red-600 hover:underline">Edit Vendor Profile →</a>
        </div>
      </div>
    </div>
  `;

  return htmlLayout({
    title: 'Dashboard',
    user,
    children: content,
  });
}

/**
 * Bookings List View with Interac Deposit Approval Affordances
 */
export function renderBookingsList(
  user: User,
  bookings: Array<Booking & { event_title: string; deposit_amount?: number | null; deposit_recipient_email?: string | null }>
): string {
  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const activeBookings = bookings.filter((b) => b.status === 'confirmed');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

  const pendingHtml =
    pendingBookings.length === 0
      ? `<p class="text-xs text-gray-500 italic p-4 text-center">No pending Interac holds at this time.</p>`
      : `
      <div class="space-y-3">
        ${pendingBookings
          .map((b) => {
            const depositStr = b.deposit_amount ? formatMoneyCAD(b.deposit_amount) : '$0.00 CAD';
            return `
              <div class="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">🇨🇦 Interac Deposit Pending</span>
                    <span class="text-xs text-gray-600">Ref: <strong>${b.uid.slice(0, 8)}</strong></span>
                  </div>
                  <h3 class="font-bold text-gray-900 text-sm mt-1">${b.event_title} — ${b.guest_name}</h3>
                  <div class="flex flex-wrap items-center gap-x-3 text-xs text-gray-600 mt-1">
                    <span>🗓️ ${b.start_at}</span>
                    <span>✉️ ${b.guest_email}</span>
                    ${b.guest_phone ? `<span>📞 ${b.guest_phone}</span>` : ''}
                    <span class="font-semibold text-amber-900">Deposit: ${depositStr}</span>
                  </div>
                  ${b.notes ? `<p class="text-xs text-gray-500 mt-1 italic">Note: "${b.notes}"</p>` : ''}
                </div>

                <div class="flex items-center gap-2 w-full md:w-auto">
                  <form action="/dashboard/bookings/${b.id}/approve" method="POST" class="inline m-0">
                    <button type="submit" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold shadow-sm transition">
                      💰 Confirm Transfer & Approve
                    </button>
                  </form>
                  <form action="/dashboard/bookings/${b.id}/decline" method="POST" class="inline m-0">
                    <button type="submit" class="px-2.5 py-1.5 border border-red-300 hover:bg-red-50 text-red-700 rounded text-xs font-medium transition">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

  const confirmedHtml =
    activeBookings.length === 0
      ? `<p class="text-xs text-gray-500 italic p-4 text-center">No active bookings.</p>`
      : `
      <div class="divide-y divide-gray-200">
        ${activeBookings
          .map((b) => `
            <div class="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">Confirmed</span>
                  <h4 class="font-semibold text-gray-900 text-sm">${b.event_title} — ${b.guest_name}</h4>
                </div>
                <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>🗓️ ${b.start_at} (${b.guest_timezone})</span>
                  <span>✉️ ${b.guest_email}</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <a href="/booking/ics/${b.cancel_token}" class="text-xs text-gray-700 hover:underline">Download .ics</a>
                <form action="/dashboard/bookings/${b.id}/cancel" method="POST" class="inline m-0">
                  <button type="submit" class="text-xs text-red-600 hover:underline ml-2" onclick="return confirm('Cancel this booking?')">Cancel</button>
                </form>
              </div>
            </div>
          `)
          .join('')}
      </div>
    `;

  const content = `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold text-gray-900">Manage Bookings</h1>
      </div>

      <!-- Pending Interac Approval Section -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-gray-100">
          <h2 class="font-bold text-sm text-gray-900 flex items-center gap-1.5">
            <span>🇨🇦 Pending Interac e-Transfer Verification</span>
            <span class="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">${pendingBookings.length}</span>
          </h2>
          <span class="text-xs text-gray-500">Check your Canadian bank account before approving</span>
        </div>
        ${pendingHtml}
      </div>

      <!-- Confirmed Bookings Section -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h2 class="font-bold text-sm text-gray-900 pb-3 border-b border-gray-100">
          Confirmed Appointments (${activeBookings.length})
        </h2>
        ${confirmedHtml}
      </div>
    </div>
  `;

  return htmlLayout({
    title: 'Bookings',
    user,
    children: content,
  });
}

/**
 * Event Types CRUD List
 */
export function renderEventTypesList(user: User, eventTypes: EventType[]): string {
  const listHtml =
    eventTypes.length === 0
      ? `<p class="text-xs text-gray-500 p-8 text-center bg-white rounded-xl border border-dashed border-gray-300">No services created yet.</p>`
      : `
      <div class="space-y-3">
        ${eventTypes
          .map((et) => {
            const depositBadge = et.deposit_amount && et.deposit_amount > 0
              ? `<span class="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-medium">🇨🇦 Deposit: ${formatMoneyCAD(et.deposit_amount)}</span>`
              : `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">No Deposit</span>`;

            return `
              <div class="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-gray-300 transition">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-bold text-gray-900 text-base">${et.title}</h3>
                    <span class="text-xs text-gray-500 font-mono">/u/${user.username}/${et.slug}</span>
                    <span class="text-xs ${et.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded font-semibold">
                      ${et.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div class="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span>⏱️ ${et.duration_min} min</span>
                    <span>📍 ${et.location_type}</span>
                    ${depositBadge}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <a href="/u/${user.username}/${et.slug}" target="_blank" class="px-2.5 py-1.5 border border-gray-300 hover:border-red-400 text-gray-700 rounded text-xs font-medium">View</a>
                  <a href="/dashboard/event-types/${et.slug}/edit" class="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-xs font-medium">Edit</a>
                  <form action="/dashboard/event-types/${et.slug}/delete" method="POST" class="inline m-0">
                    <button type="submit" class="px-2.5 py-1.5 text-red-600 hover:text-red-800 text-xs font-medium" onclick="return confirm('Delete this service?')">Delete</button>
                  </form>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

  const content = `
    <div class="max-w-4xl mx-auto space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-xl font-bold text-gray-900">Services & Event Types</h1>
        <a href="/dashboard/event-types/new" class="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-sm transition">
          + New Service
        </a>
      </div>
      ${listHtml}
    </div>
  `;

  return htmlLayout({
    title: 'Services',
    user,
    children: content,
  });
}

/**
 * Event Type Create/Edit Form
 */
export function renderEventTypeForm(
  user: User,
  et?: EventType | null
): string {
  const isEdit = Boolean(et);
  const action = isEdit ? `/dashboard/event-types/${et!.slug}/edit` : '/dashboard/event-types/new';

  const content = `
    <div class="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
      <div>
        <a href="/dashboard/event-types" class="text-xs text-red-600 hover:underline">← Back to Services</a>
        <h1 class="text-xl font-bold text-gray-900 mt-2">${isEdit ? 'Edit Service' : 'Create New Service'}</h1>
      </div>

      <form action="${action}" method="POST" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Title *</label>
            <input type="text" name="title" required value="${et?.title || ''}" placeholder="e.g. 60-min Consultation" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">URL Slug *</label>
            <input type="text" name="slug" required value="${et?.slug || ''}" placeholder="e.g. consultation" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Description</label>
          <textarea name="description" rows="2" placeholder="Brief description of this service..." class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500">${et?.description || ''}</textarea>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Duration (Minutes) *</label>
            <input type="number" name="duration_min" required value="${et?.duration_min || 30}" min="5" step="5" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Buffer Before (Min)</label>
            <input type="number" name="buffer_before" value="${et?.buffer_before || 0}" min="0" step="5" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Buffer After (Min)</label>
            <input type="number" name="buffer_after" value="${et?.buffer_after || 0}" min="0" step="5" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
        </div>

        <!-- Canadian Interac e-Transfer Settings -->
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
          <div class="flex items-center gap-1.5 font-bold text-xs text-red-950">
            <span>🇨🇦</span>
            <span>Interac e-Transfer Deposit Settings (Optional)</span>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">Deposit Amount ($ CAD)</label>
              <input type="number" name="deposit_amount" value="${et?.deposit_amount || ''}" step="0.01" min="0" placeholder="e.g. 25.00" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 bg-white" />
              <span class="text-[11px] text-gray-500">Leave blank for free / no deposit.</span>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-700 mb-1">e-Transfer Recipient Email</label>
              <input type="email" name="deposit_recipient_email" value="${et?.deposit_recipient_email || ''}" placeholder="payments@vendor.ca" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 bg-white" />
              <span class="text-[11px] text-gray-500">Defaults to your account email.</span>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Cancellation Policy</label>
          <textarea name="cancellation_policy" rows="2" placeholder="e.g. Full deposit refund if cancelled 24h prior to appointment." class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500">${et?.cancellation_policy || ''}</textarea>
        </div>

        <button type="submit" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-xs shadow transition">
          ${isEdit ? 'Save Changes' : 'Create Service'}
        </button>
      </form>
    </div>
  `;

  return htmlLayout({
    title: isEdit ? 'Edit Service' : 'New Service',
    user,
    children: content,
  });
}

/**
 * Canadian Vendor Profile & Tax Settings View
 */
export function renderVendorProfile(user: User, savedMessage?: string): string {
  const provinceOptions = CANADIAN_PROVINCES.map((p) => {
    const selected = p.code === user.province ? 'selected' : '';
    return `<option value="${p.code}" ${selected}>${p.code} - ${p.nameEn} / ${p.nameFr}</option>`;
  }).join('');

  const tzOptions = TIMEZONES.map((tz) => {
    const selected = tz.iana === user.timezone ? 'selected' : '';
    return `<option value="${tz.iana}" ${selected}>${tz.label}</option>`;
  }).join('');

  const alertBox = savedMessage
    ? `<div class="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-md mb-4">${savedMessage}</div>`
    : '';

  const content = `
    <div class="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
      <div>
        <h1 class="text-xl font-bold text-gray-900">Canadian Vendor Profile & Taxes</h1>
        <p class="text-xs text-gray-500 mt-1">Configure your Canadian business registration, address, and GST/HST details</p>
      </div>

      ${alertBox}

      <form action="/dashboard/settings" method="POST" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Business Name</label>
          <input type="text" name="business_name" value="${user.business_name || ''}" placeholder="e.g. Maple Health Clinic" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Street Address</label>
          <input type="text" name="street_address" value="${user.street_address || ''}" placeholder="e.g. 123 Bay Street, Suite 400" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Province / Territory (13 Canadian Regions) *</label>
            <select name="province" required class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 bg-white">
              <option value="">Select Province...</option>
              ${provinceOptions}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Postal Code (A1A 1A1) *</label>
            <input type="text" name="postal_code" value="${user.postal_code || ''}" placeholder="M5J 2R8" pattern="^[A-Za-z]\\d[A-Za-z][ -]?\\d[A-Za-z]\\d$" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 uppercase" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Business Phone (+1 format)</label>
            <input type="tel" name="phone" value="${user.phone || ''}" placeholder="+1 (416) 555-0100" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1">Default Timezone</label>
            <select name="timezone" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 bg-white">
              ${tzOptions}
            </select>
          </div>
        </div>

        <!-- Canadian Tax Section -->
        <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h3 class="font-bold text-xs text-gray-900">🇨🇦 Canadian GST / HST Registration</h3>
          <div>
            <label class="block text-xs text-gray-700 mb-1">GST/HST Number (e.g. 123456789 RT 0001)</label>
            <input type="text" name="tax_number" value="${user.tax_number || ''}" placeholder="123456789 RT 0001" class="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-red-500 focus:border-red-500 bg-white" />
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="prices_include_tax" name="prices_include_tax" value="1" ${user.prices_include_tax ? 'checked' : ''} class="rounded border-gray-300 text-red-600 focus:ring-red-500" />
            <label for="prices_include_tax" class="text-xs text-gray-700 font-medium">Prices already include GST/HST</label>
          </div>
        </div>

        <button type="submit" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-xs shadow transition">
          Save Canadian Profile & Tax Settings
        </button>
      </form>
    </div>
  `;

  return htmlLayout({
    title: 'Vendor Settings',
    user,
    children: content,
  });
}
