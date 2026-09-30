// Public-facing booking views (Canadian White-Label)

import { TIMEZONES, formatMoneyCAD } from '../i18n';
import type { User, EventType, SlotDay } from '../types';
import { htmlLayout } from './layout';

/**
 * Public Vendor Profile listing all active services
 */
export function renderUserProfile(user: User, eventTypes: EventType[]): string {
  const addressLine = [user.street_address, user.province, user.postal_code]
    .filter(Boolean)
    .join(', ');

  const servicesHtml =
    eventTypes.length === 0
      ? `<p class="text-gray-500 py-8 text-center bg-white rounded-lg border border-dashed border-gray-300">No public booking services currently available.</p>`
      : `
      <div class="grid gap-4 sm:grid-cols-2">
        ${eventTypes
          .map((et) => {
            const depositBadge = et.deposit_amount && et.deposit_amount > 0
              ? `<span class="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                   <span>🇨🇦</span> Deposit: ${formatMoneyCAD(et.deposit_amount)}
                 </span>`
              : '';

            return `
              <a href="/u/${user.username}/${et.slug}" class="block p-5 bg-white border border-gray-200 rounded-lg hover:border-red-500 hover:shadow-md transition">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h3 class="font-semibold text-gray-900 text-lg hover:text-red-600 transition">${et.title}</h3>
                  <span class="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded">${et.duration_min} min</span>
                </div>
                ${et.description ? `<p class="text-sm text-gray-600 mb-3 line-clamp-2">${et.description}</p>` : ''}
                <div class="flex items-center gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span>📍 ${et.location_type === 'in_person' ? (et.location_value || 'In Person') : et.location_type}</span>
                  ${depositBadge}
                </div>
              </a>
            `;
          })
          .join('')}
      </div>
    `;

  const taxNotice = user.tax_number
    ? `<div class="text-xs text-gray-500 mt-1">
         <span>GST/HST #: <strong>${user.tax_number}</strong></span>
         <span class="mx-1.5">·</span>
         <span>${user.prices_include_tax ? 'Prices include GST/HST' : 'Subject to GST/HST'}</span>
       </div>`
    : '';

  const content = `
    <div class="max-w-4xl mx-auto space-y-8">
      <!-- Vendor Header Profile -->
      <div class="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-2xl font-bold text-gray-900">${user.business_name || user.name}</h1>
              <span class="text-xs bg-red-100 text-red-800 font-semibold px-2 py-0.5 rounded">🇨🇦 Canada</span>
            </div>
            ${user.title ? `<p class="text-sm text-gray-600 font-medium mt-0.5">${user.title}</p>` : ''}
            ${user.bio ? `<p class="text-sm text-gray-600 mt-2 max-w-xl">${user.bio}</p>` : ''}
            
            <div class="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 mt-3">
              ${addressLine ? `<span>📍 ${addressLine}</span>` : ''}
              ${user.phone ? `<span>📞 ${user.phone}</span>` : ''}
              <span>🌐 ${user.timezone}</span>
            </div>
            ${taxNotice}
          </div>
        </div>
      </div>

      <!-- Services Section -->
      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>Available Services & Appointments</span>
        </h2>
        ${servicesHtml}
      </div>
    </div>
  `;

  return htmlLayout({
    title: user.business_name || user.name,
    children: content,
  });
}

/**
 * Public Slot Picker for an Event Type
 */
export function renderEventSlots(
  user: User,
  et: EventType,
  days: SlotDay[],
  selectedTz: string
): string {
  const tzOptions = TIMEZONES.map((tz) => {
    const selected = tz.iana === selectedTz ? 'selected' : '';
    return `<option value="${tz.iana}" ${selected}>${tz.label}</option>`;
  }).join('');

  const depositNotice = et.deposit_amount && et.deposit_amount > 0
    ? `
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
        <div class="font-semibold flex items-center gap-1.5">
          <span>🇨🇦</span>
          <span>Interac e-Transfer Deposit Required</span>
        </div>
        <p>A deposit of <strong>${formatMoneyCAD(et.deposit_amount)}</strong> is required to hold your appointment. You will receive transfer instructions upon booking.</p>
      </div>
    `
    : '';

  const slotsGrid = days.length === 0
    ? `<div class="p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
         No available times found in this window. Please check back soon or try another timezone.
       </div>`
    : `
      <div class="space-y-6">
        ${days
          .map((d) => `
            <div class="bg-white border border-gray-200 rounded-lg p-4">
              <h3 class="font-semibold text-gray-900 text-sm mb-3 pb-2 border-b border-gray-100 flex items-center justify-between">
                <span>${d.label}</span>
                <span class="text-xs font-normal text-gray-500">${d.slots.length} slots</span>
              </h3>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${d.slots
                  .map(
                    (s) => `
                    <a href="/u/${user.username}/${et.slug}/book?date=${s.guest_date}&time=${s.start}&tz=${encodeURIComponent(selectedTz)}"
                       class="py-2 px-3 text-center text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 rounded-md transition shadow-sm">
                      ${s.start}
                    </a>
                  `
                  )
                  .join('')}
              </div>
            </div>
          `)
          .join('')}
      </div>
    `;

  const content = `
    <div class="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
      <!-- Left sidebar: Service Details -->
      <div class="md:col-span-1 space-y-4">
        <div class="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <a href="/u/${user.username}" class="text-xs text-red-600 hover:underline flex items-center gap-1 font-medium">
            <span>← Back to ${user.business_name || user.name}</span>
          </a>
          <div>
            <h1 class="text-xl font-bold text-gray-900">${et.title}</h1>
            <p class="text-xs text-gray-500 mt-0.5">${user.business_name || user.name}</p>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
            <span>⏱️ ${et.duration_min} minutes</span>
            <span>·</span>
            <span>📍 ${et.location_type === 'in_person' ? (et.location_value || 'In Person') : et.location_type}</span>
          </div>
          ${et.description ? `<p class="text-xs text-gray-600 leading-relaxed">${et.description}</p>` : ''}
          ${depositNotice}
          ${et.cancellation_policy ? `
            <div class="text-xs text-gray-500 pt-2 border-t border-gray-100">
              <strong>Cancellation Policy:</strong><br>${et.cancellation_policy}
            </div>
          ` : ''}
        </div>

        <!-- Timezone selector -->
        <div class="bg-white border border-gray-200 rounded-xl p-4">
          <label class="block text-xs font-medium text-gray-700 mb-1.5">Your Timezone</label>
          <form method="GET" class="m-0">
            <select name="tz" onchange="this.form.submit()" class="w-full text-xs border-gray-300 rounded-md shadow-sm focus:border-red-500 focus:ring-red-500 p-2 border">
              ${tzOptions}
            </select>
          </form>
        </div>
      </div>

      <!-- Right main: Slot Calendar -->
      <div class="md:col-span-2">
        <h2 class="text-base font-semibold text-gray-900 mb-4 flex items-center justify-between">
          <span>Select Date & Time</span>
          <span class="text-xs text-gray-500 font-normal">Times shown in ${selectedTz}</span>
        </h2>
        ${slotsGrid}
      </div>
    </div>
  `;

  return htmlLayout({
    title: `${et.title} - Book Appointment`,
    children: content,
  });
}

/**
 * Public Booking Form Page
 */
export function renderBookingForm(
  user: User,
  et: EventType,
  date: string,
  time: string,
  tz: string,
  turnstileSiteKey?: string
): string {
  const depositBox = et.deposit_amount && et.deposit_amount > 0
    ? `
      <div class="p-4 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-2">
        <div class="flex items-center gap-1.5 font-bold text-sm text-amber-950">
          <span>🇨🇦</span>
          <span>Interac e-Transfer Deposit Notice</span>
        </div>
        <p>This appointment requires an Interac e-Transfer deposit of <strong class="text-sm font-bold text-red-700">${formatMoneyCAD(et.deposit_amount)}</strong>.</p>
        <p>Upon submitting this form, your slot will be held in <strong>pending approval</strong> status. Exact transfer instructions (recipient email & booking memo) will be displayed on the confirmation screen and sent to your email.</p>
      </div>
    `
    : '';

  const turnstileWidget = turnstileSiteKey
    ? `
      <div class="mt-4">
        <div class="cf-turnstile" data-sitekey="${turnstileSiteKey}"></div>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
      </div>
    `
    : `<input type="hidden" name="cf-turnstile-response" value="dev-bypass" />`;

  const content = `
    <div class="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm">
      <div class="mb-6 pb-4 border-b border-gray-200">
        <a href="/u/${user.username}/${et.slug}?tz=${encodeURIComponent(tz)}" class="text-xs text-red-600 hover:underline font-medium">← Back to times</a>
        <h1 class="text-xl font-bold text-gray-900 mt-2">${et.title}</h1>
        <p class="text-xs text-gray-500">${user.business_name || user.name}</p>
        
        <div class="flex items-center gap-3 mt-3 text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100 font-medium text-gray-800">
          <span>🗓️ ${date}</span>
          <span>·</span>
          <span>⏰ ${time} (${tz})</span>
          <span>·</span>
          <span>⏱️ ${et.duration_min} min</span>
        </div>
      </div>

      <form action="/u/${user.username}/${et.slug}/book" method="POST" class="space-y-4">
        <input type="hidden" name="date" value="${date}" />
        <input type="hidden" name="time" value="${time}" />
        <input type="hidden" name="tz" value="${tz}" />

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Your Full Name *</label>
          <input type="text" name="name" required placeholder="e.g. Jean Tremblay" class="w-full text-sm border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-500 focus:border-red-500" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
          <input type="email" name="email" required placeholder="jean@example.ca" class="w-full text-sm border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-500 focus:border-red-500" />
          <span class="text-[11px] text-gray-500">Booking confirmation & calendar invite will be sent here.</span>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Phone Number (Optional)</label>
          <input type="tel" name="phone" placeholder="+1 (416) 555-0199" class="w-full text-sm border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-500 focus:border-red-500" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Additional Notes (Optional)</label>
          <textarea name="notes" rows="2" placeholder="Any specific requirements or questions..." class="w-full text-sm border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-500 focus:border-red-500"></textarea>
        </div>

        ${depositBox}
        ${turnstileWidget}

        <button type="submit" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-sm shadow transition">
          ${et.deposit_amount && et.deposit_amount > 0 ? 'Request Hold & View e-Transfer Details' : 'Confirm Appointment'}
        </button>
      </form>
    </div>
  `;

  return htmlLayout({
    title: `Confirm Details - ${et.title}`,
    children: content,
  });
}

/**
 * Confirmation Page (Handles both Confirmed and Pending Interac e-Transfer holds)
 */
export function renderConfirmation(
  booking: any,
  user: User,
  et: EventType
): string {
  const isPending = booking.status === 'pending';
  const depositAmount = et.deposit_amount ? formatMoneyCAD(et.deposit_amount) : '$0.00 CAD';
  const recipient = et.deposit_recipient_email || user.email;

  const statusHeader = isPending
    ? `
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 text-amber-600 text-2xl mb-1">
          🇨🇦
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Appointment Request Received</h1>
        <p class="text-sm text-amber-800 font-medium">Status: Pending Interac e-Transfer Deposit</p>
      </div>
    `
    : `
      <div class="text-center space-y-2">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 text-2xl mb-1">
          ✓
        </div>
        <h1 class="text-2xl font-bold text-gray-900">Booking Confirmed!</h1>
        <p class="text-sm text-gray-600">A calendar invite has been emailed to <strong>${booking.guest_email}</strong></p>
      </div>
    `;

  const interacInstructions = isPending
    ? `
      <div class="bg-red-50 border-2 border-dashed border-red-300 rounded-xl p-5 space-y-3">
        <div class="flex items-center gap-2 text-red-900 font-bold text-base">
          <span>🍁</span>
          <span>Interac e-Transfer Payment Steps</span>
        </div>
        <p class="text-xs text-red-800 leading-relaxed">
          Please log into your Canadian online banking or mobile banking app and send your e-Transfer with these exact details:
        </p>

        <div class="bg-white p-3 rounded-lg border border-red-200 text-xs space-y-2">
          <div class="flex justify-between items-center py-1 border-b border-gray-100">
            <span class="text-gray-500">Deposit Amount:</span>
            <span class="font-bold text-base text-red-700">${depositAmount}</span>
          </div>
          <div class="flex justify-between items-center py-1 border-b border-gray-100">
            <span class="text-gray-500">Recipient Email:</span>
            <span class="font-mono font-semibold text-gray-800 select-all">${recipient}</span>
          </div>
          <div class="flex justify-between items-center py-1">
            <span class="text-gray-500">Required Memo / Note:</span>
            <span class="font-mono bg-red-100 text-red-900 px-2 py-0.5 rounded font-bold select-all">Ref: ${booking.uid.slice(0, 8)} (${booking.guest_name})</span>
          </div>
        </div>

        <p class="text-[11px] text-gray-600 italic">
          * Your appointment slot is held for 24 hours. The vendor will approve your booking once the Interac transfer is verified.
        </p>
      </div>
    `
    : '';

  const content = `
    <div class="max-w-xl mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
      ${statusHeader}

      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs space-y-2">
        <div class="flex justify-between py-1 border-b border-gray-200">
          <span class="text-gray-500">Service:</span>
          <span class="font-semibold text-gray-900">${et.title}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-gray-200">
          <span class="text-gray-500">Vendor:</span>
          <span class="font-semibold text-gray-900">${user.business_name || user.name}</span>
        </div>
        <div class="flex justify-between py-1 border-b border-gray-200">
          <span class="text-gray-500">Date & Time:</span>
          <span class="font-semibold text-gray-900">${booking.start_at} (${booking.guest_timezone})</span>
        </div>
        <div class="flex justify-between py-1">
          <span class="text-gray-500">Guest Name:</span>
          <span class="font-semibold text-gray-900">${booking.guest_name}</span>
        </div>
      </div>

      ${interacInstructions}

      <div class="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <a href="/booking/ics/${booking.cancel_token}" class="w-full text-center py-2 px-4 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-xs font-semibold shadow-sm transition">
          📥 Download .ics Calendar File
        </a>
        <a href="/booking/cancel/${booking.cancel_token}" class="w-full text-center py-2 px-4 border border-gray-300 hover:border-red-400 text-gray-700 hover:text-red-600 rounded-md text-xs font-medium transition">
          Cancel Booking
        </a>
      </div>
    </div>
  `;

  return htmlLayout({
    title: isPending ? 'Deposit Pending' : 'Booking Confirmed',
    children: content,
  });
}

/**
 * Guest Booking Cancellation Page
 */
export function renderCancelPage(booking: any, user: User, et: EventType): string {
  const content = `
    <div class="max-w-lg mx-auto bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-5">
      <div class="border-b border-gray-200 pb-3">
        <h1 class="text-lg font-bold text-red-600">Cancel Appointment</h1>
        <p class="text-xs text-gray-500 mt-0.5">${et.title} with ${user.business_name || user.name}</p>
      </div>

      <div class="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1">
        <p><strong>Scheduled:</strong> ${booking.start_at} (${booking.guest_timezone})</p>
        <p><strong>Guest:</strong> ${booking.guest_name} (${booking.guest_email})</p>
        ${et.cancellation_policy ? `<p class="mt-2 text-gray-600"><strong>Policy:</strong> ${et.cancellation_policy}</p>` : ''}
      </div>

      <form action="/booking/cancel/${booking.cancel_token}" method="POST" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-700 mb-1">Reason for Cancellation (Optional)</label>
          <textarea name="reason" rows="2" placeholder="Brief reason..." class="w-full text-sm border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-500 focus:border-red-500"></textarea>
        </div>

        <button type="submit" class="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold text-xs shadow transition">
          Yes, Cancel This Appointment
        </button>
      </form>
    </div>
  `;

  return htmlLayout({
    title: 'Cancel Appointment',
    children: content,
  });
}
