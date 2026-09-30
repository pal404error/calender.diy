// Brevo HTTP API Email Sender and RFC 5545 ICS Generator
// Zero raw TCP sockets — pure HTTP API compliant with Cloudflare Workers Free Tier

import { formatMoneyCAD } from './i18n';
import type { Env } from './types';

export interface EmailBookingDetails {
  uid: string;
  eventTitle: string;
  guestName: string;
  guestEmail: string;
  guestTimezone: string;
  hostName: string;
  hostEmail: string;
  hostTimezone: string;
  dateStr: string;         // e.g. "2026-10-15"
  startTimeStr: string;    // e.g. "10:00"
  endTimeStr: string;      // e.g. "10:30"
  utcStartIcs: string;     // e.g. "20261015T140000Z"
  utcEndIcs: string;       // e.g. "20261015T143000Z"
  notes?: string | null;
  location?: string | null;
  cancelUrl: string;
  icsDownloadUrl?: string;

  // Canadian Vendor Profile & Policy Fields
  businessName?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  taxNumber?: string | null;
  pricesIncludeTax?: boolean;
  cancellationPolicy?: string | null;

  // Interac e-Transfer Details
  depositAmount?: number | null;
  depositRecipientEmail?: string | null;
  bookingReference: string;
}

function sanitizeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Generates an RFC 5545 compliant .ics file with CRLF line endings
 */
export function generateIcs(details: EmailBookingDetails, method: 'REQUEST' | 'CANCEL' = 'REQUEST'): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const summary = sanitizeIcs(`${details.eventTitle} — ${details.guestName} & ${details.hostName}`);
  
  let desc = `Booking with ${details.hostName}\\n`;
  if (details.businessName) desc += `Vendor: ${details.businessName}\\n`;
  if (details.businessAddress) desc += `Address: ${details.businessAddress}\\n`;
  if (details.businessPhone) desc += `Phone: ${details.businessPhone}\\n`;
  if (details.taxNumber) desc += `GST/HST #: ${details.taxNumber}\\n`;
  if (details.cancellationPolicy) desc += `Cancellation Policy: ${details.cancellationPolicy}\\n`;
  if (details.notes) desc += `Notes: ${details.notes}\\n`;
  desc += `Cancel booking: ${details.cancelUrl}\\n`;
  const sanitizedDesc = sanitizeIcs(desc);

  const locationLine = details.location ? `LOCATION:${sanitizeIcs(details.location)}\r\n` : '';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrueNorth Bookings//calrs//EN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${details.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${details.utcStartIcs}`,
    `DTEND:${details.utcEndIcs}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${sanitizedDesc}`,
    locationLine ? locationLine.trimEnd() : null,
    `ORGANIZER;CN="${details.hostName}":mailto:${details.hostEmail}`,
    `ATTENDEE;CN="${details.guestName}";RSVP=TRUE:mailto:${details.guestEmail}`,
    `STATUS:${method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n') + '\r\n';
}

/**
 * Send an email via Brevo HTTP API
 */
export async function sendBrevoEmail(
  env: Env,
  payload: {
    to: { email: string; name: string }[];
    subject: string;
    htmlContent: string;
    textContent: string;
    attachment?: { name: string; content: string }[]; // base64
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = env.BREVO_API_KEY;
  const senderName = env.BREVO_SENDER_NAME || 'Bookings';
  const senderEmail = env.BREVO_SENDER_EMAIL || 'notifications@calender.diy';

  if (!apiKey || apiKey === 'YOUR_BREVO_API_KEY') {
    console.log('[Brevo Mock Email Sent]:', {
      to: payload.to,
      subject: payload.subject,
      attachments: payload.attachment?.map((a) => a.name),
    });
    return { success: true, id: 'mock-id' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: payload.to,
        subject: payload.subject,
        htmlContent: payload.htmlContent,
        textContent: payload.textContent,
        attachment: payload.attachment,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Brevo API Error]:', res.status, errText);
      return { success: false, error: errText };
    }

    const data = (await res.json()) as { messageId?: string };
    return { success: true, id: data.messageId };
  } catch (err: any) {
    console.error('[Brevo Network Error]:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Booking Confirmation Email (Confirmed status)
 */
export async function sendBookingConfirmationEmail(
  env: Env,
  details: EmailBookingDetails
): Promise<void> {
  const icsText = generateIcs(details, 'REQUEST');
  const icsBase64 = btoa(unescape(encodeURIComponent(icsText)));

  const taxNote = details.taxNumber
    ? `<p style="margin: 4px 0; color: #4b5563; font-size: 13px;">GST/HST Registration: <strong>${details.taxNumber}</strong> (${details.pricesIncludeTax ? 'Prices include GST/HST' : 'Subject to GST/HST'})</p>`
    : '';

  const cancellationNote = details.cancellationPolicy
    ? `<div style="margin-top: 16px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; font-size: 13px; color: #374151;">
         <strong>Cancellation Policy:</strong><br>${details.cancellationPolicy}
       </div>`
    : '';

  const vendorInfo = `
    <div style="margin-top: 16px; padding: 12px; border-left: 3px solid #dc2626; background: #fff5f5; font-size: 13px;">
      <strong style="color: #991b1b;">${details.businessName || details.hostName}</strong><br>
      ${details.businessAddress ? `📍 ${details.businessAddress}<br>` : ''}
      ${details.businessPhone ? `📞 ${details.businessPhone}<br>` : ''}
      ${taxNote}
    </div>
  `;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <span style="font-size: 24px; margin-right: 8px;">🍁</span>
        <h2 style="margin: 0; color: #111827; font-size: 20px;">Booking Confirmed!</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.5;">Hi <strong>${details.guestName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.5;">Your appointment for <strong>${details.eventTitle}</strong> with <strong>${details.hostName}</strong> is confirmed.</p>
      
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; font-size: 15px;">🗓️ <strong>Date:</strong> ${details.dateStr}</p>
        <p style="margin: 4px 0; font-size: 15px;">⏰ <strong>Time:</strong> ${details.startTimeStr} - ${details.endTimeStr} (${details.guestTimezone})</p>
        ${details.location ? `<p style="margin: 4px 0; font-size: 15px;">📍 <strong>Location:</strong> ${details.location}</p>` : ''}
        ${details.notes ? `<p style="margin: 4px 0; font-size: 15px;">📝 <strong>Notes:</strong> ${details.notes}</p>` : ''}
      </div>

      ${vendorInfo}
      ${cancellationNote}

      <div style="margin-top: 24px; text-align: center;">
        <a href="${details.cancelUrl}" style="display: inline-block; padding: 10px 18px; background-color: #ef4444; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">Need to Cancel?</a>
      </div>

    </div>
  `;

  const text = `
Booking Confirmed!
Service: ${details.eventTitle}
With: ${details.hostName}
Date: ${details.dateStr}
Time: ${details.startTimeStr} - ${details.endTimeStr} (${details.guestTimezone})
${details.location ? `Location: ${details.location}\n` : ''}
Cancel URL: ${details.cancelUrl}
  `.trim();

  await sendBrevoEmail(env, {
    to: [{ email: details.guestEmail, name: details.guestName }],
    subject: `Confirmed: ${details.eventTitle} with ${details.hostName}`,
    htmlContent: html,
    textContent: text,
    attachment: [
      {
        name: 'invite.ics',
        content: icsBase64,
      },
    ],
  });
}

/**
 * Send Interac e-Transfer Pending Deposit Email
 */
export async function sendPendingDepositEmail(
  env: Env,
  details: EmailBookingDetails
): Promise<void> {
  const depositStr = details.depositAmount ? formatMoneyCAD(details.depositAmount) : '$0.00 CAD';
  const recipient = details.depositRecipientEmail || details.hostEmail;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <span style="font-size: 24px; margin-right: 8px;">🇨🇦</span>
        <h2 style="margin: 0; color: #991b1b; font-size: 20px;">Action Required: Interac e-Transfer Deposit</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.5;">Hi <strong>${details.guestName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.5;">
        Your requested appointment for <strong>${details.eventTitle}</strong> on <strong>${details.dateStr} at ${details.startTimeStr} (${details.guestTimezone})</strong> has been placed on <strong>pending hold</strong>.
      </p>

      <div style="background-color: #fef2f2; border: 2px dashed #f87171; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #991b1b; font-size: 16px;">🇨🇦 Interac e-Transfer Payment Instructions</h3>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Deposit Amount:</strong> <span style="font-size: 18px; color: #991b1b; font-weight: bold;">${depositStr}</span></p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Send e-Transfer To:</strong> <a href="mailto:${recipient}" style="color: #b91c1c; font-weight: bold;">${recipient}</a></p>
        <p style="margin: 8px 0; font-size: 15px;"><strong>Memo / Message Required:</strong> <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-weight: bold;">Ref: ${details.bookingReference} (${details.guestName})</code></p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #7f1d1d;">
          <em>Please complete your e-Transfer within 24 hours. The vendor will approve your booking once the transfer arrives in their Canadian bank account.</em>
        </p>
      </div>

      ${details.cancellationPolicy ? `
        <div style="margin-top: 16px; padding: 12px; background-color: #f3f4f6; border-radius: 6px; font-size: 13px; color: #374151;">
          <strong>Cancellation Policy:</strong><br>${details.cancellationPolicy}
        </div>
      ` : ''}
    </div>
  `;

  const text = `
Action Required: Interac e-Transfer Deposit for ${details.eventTitle}
Deposit Amount: ${depositStr}
Send To: ${recipient}
Memo: Ref: ${details.bookingReference} (${details.guestName})
Date: ${details.dateStr} at ${details.startTimeStr} (${details.guestTimezone})
  `.trim();

  await sendBrevoEmail(env, {
    to: [{ email: details.guestEmail, name: details.guestName }],
    subject: `Action Required: Interac Deposit for ${details.eventTitle}`,
    htmlContent: html,
    textContent: text,
  });
}

/**
 * Send Cancellation Email
 */
export async function sendCancellationEmail(
  env: Env,
  details: EmailBookingDetails,
  reason?: string
): Promise<void> {
  const icsText = generateIcs(details, 'CANCEL');
  const icsBase64 = btoa(unescape(encodeURIComponent(icsText)));

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="margin-top: 0; color: #dc2626; font-size: 20px;">Booking Cancelled</h2>
      <p style="font-size: 15px; line-height: 1.5;">Hi <strong>${details.guestName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.5;">Your booking for <strong>${details.eventTitle}</strong> on <strong>${details.dateStr} at ${details.startTimeStr}</strong> has been cancelled.</p>
      ${reason ? `<p style="font-size: 14px; background: #fef2f2; padding: 10px; border-radius: 4px; color: #991b1b;"><strong>Reason:</strong> ${reason}</p>` : ''}
      
    </div>
  `;

  await sendBrevoEmail(env, {
    to: [{ email: details.guestEmail, name: details.guestName }],
    subject: `Cancelled: ${details.eventTitle} with ${details.hostName}`,
    htmlContent: html,
    textContent: `Your booking for ${details.eventTitle} on ${details.dateStr} at ${details.startTimeStr} has been cancelled.`,
    attachment: [
      {
        name: 'cancel.ics',
        content: icsBase64,
      },
    ],
  });
}
