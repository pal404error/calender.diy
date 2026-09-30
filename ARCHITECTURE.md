# TrueNorth Bookings — Architecture & Cloudflare Port Specification

## 1. Executive Summary

**TrueNorth Bookings** is a full port of **calrs** (open-source scheduling platform written in Rust, AGPL-3.0) to **Cloudflare's 100% Free Serverless Stack** (Workers + D1 + Workers Static Assets) engineered specifically as a **Canadian White-Label Booking Platform** ("Made in Canada 🇨🇦") for independent Canadian service businesses, trades, salons, and consultants.

The Rust application serves as the authoritative functional specification. Availability computation, daylight-saving transitions, seasonal offsets, and scheduling rules have been ported with exact mathematical fidelity.

---

## 2. Architecture Mapping (Rust calrs → Cloudflare Port)

| calrs (Rust) Component | Cloudflare Port (TypeScript / Workers) | Rationale & Engineering Guarantees |
|---|---|---|
| **Axum + Tokio Runtime** | **Hono** on **Cloudflare Workers** (`export default app`) | Zero cold starts (<5ms), global edge distribution across 300+ cities, strict sub-10ms CPU execution per request. |
| **Sqlx + SQLite (64 migrations)** | **Cloudflare D1** (`truenorth-db`, SQLite dialect) | Consolidated, clean migration preserving trigger constraints (`time_version = 1` RFC3339 UTC check) with set-based query efficiency. |
| **40 Minijinja Templates** | **Server-Rendered HTML Components** (Tailwind CSS CDN) | Fast edge HTML streaming, no client hydration lag, mobile-first Canadian responsive UI. |
| **Lettre SMTP (TCP Sockets)** | **Brevo HTTP API** (`POST /v3/smtp/email`) | Workers Free tier cannot sustain raw TCP SMTP sockets reliably; all mail runs over outbound HTTP subrequests (unmetered CPU I/O). |
| **Argon2 Password Hashing** | **W3C Web Crypto PBKDF2-HMAC-SHA256** | 100,000 iterations, 32-byte key, 16-byte cryptographically secure random salt. Native V8 runtime implementation with zero npm dependencies. |
| **Session Cookies / In-Memory** | **D1 `sessions` Table + HttpOnly Secure Cookies** | Fully stateless isolates. Any Cloudflare edge worker anywhere in the world can validate session state without sticky routing. |
| **Image / Captcha Crates** | **Cloudflare Turnstile** | Modern privacy-preserving bot detection; bypasses bot fraud on booking forms without user friction. |
| **Local Static Assets** | **Workers Static Assets** (`worker/public`) | Embedded edge asset delivery with zero egress costs. |

---

## 3. Canadian White-Label & Banking Implementation

### Canadian Localization
1. **Branding & Identity**: "TrueNorth Bookings" branded throughout, featuring "Made in Canada 🇨🇦" header banners and footers.
2. **Currency**: All service prices, deposits, and totals are strictly displayed in Canadian Dollars (`$X.XX CAD`). No USD currency codes or symbols exist in the application.
3. **Timezones**: Canadian timezones are prioritized at the top of all picker controls:
   - `America/St_Johns` (Newfoundland Time)
   - `America/Halifax` (Atlantic Time)
   - `America/Toronto` (Eastern Time - ON / QC)
   - `America/Winnipeg` (Central Time - MB)
   - `America/Regina` (Central Time - SK, no DST)
   - `America/Edmonton` (Mountain Time - AB / NT)
   - `America/Vancouver` (Pacific Time - BC / YT)
4. **Vendor Registration & Profile**:
   - Business Name & Street Address.
   - **13 Provinces & Territories Dropdown**: `AB`, `BC`, `MB`, `NB`, `NL`, `NS`, `NT`, `NU`, `ON`, `PE`, `QC`, `SK`, `YT`.
   - **Postal Code Validation**: Strict Canadian format regex (`^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$`), automatically normalized to standard uppercase `A1A 1A1`.
   - **Phone Number Format**: Canadian `+1 (XXX) XXX-XXXX`.
   - **Tax Compliance**: Optional GST/HST registration number field with "Prices include GST/HST" toggle for client receipts and confirmation emails.

### Interac e-Transfer Deposits (Zero Card Gateways)
To comply with the strict requirement of **no Stripe, credit cards, or paid third-party payment gateways**:
1. Per-event-type deposit configuration (`deposit_amount`, `deposit_recipient_email`).
2. Booking form informs guest of the deposit requirement.
3. Upon booking submission, the record is placed in **pending approval** hold (`status = 'pending'`).
4. The confirmation screen and automated Brevo email present explicit Canadian Interac transfer instructions:
   - Exact deposit amount in `$CAD`.
   - Recipient email address.
   - Memo reference requirement: `Ref: <UID_PREFIX> (<GUEST_NAME>)`.
5. The appointment slot is withheld from other guests while on hold.
6. The vendor dashboard features a 1-click affordance: **"Confirm Interac Transfer & Approve"**, which transitions status to `'confirmed'`, sends the calendar `.ics` invite, and locks the booking. Alternatively, the vendor can decline or cancel.

---

## 4. Availability Engine Mathematical Fidelity

The availability engine in `worker/src/booking_time.ts` and `worker/src/availability.ts` ports `src/booking_time.rs` and `src/web/mod.rs` verbatim:
- **`encode(startNaive, tz, minutes)`**: Validates local wall clock against `fromLocalToUtcSingle`. Nonexistent hours (spring forward transition gap) and ambiguous hours (fall back overlap) return `null`, rejecting invalid booking requests without silently shifting meeting times.
- **`busy_range(start, end, tz)`**: Calculates conservative wall-clock envelopes. When daylight-saving fall back occurs, the rollback offset expands the window to block the repeated hour completely.
- **`computeSlotsFromRules`**: Respects duration, intervals, buffer before/after, minimum notice periods, rolling booking horizons, date overrides (blocked days or custom hours), and frequency limit filters.

All ported availability unit tests pass in CI via Vitest.

---

## 5. Phased Delivery & Deferrals

### Phase 1 — MVP (Shipped & Live)
- [x] Public booking flow: vendor profile → slot picker → booking form with Turnstile → creation → confirmation.
- [x] Canadian White-Labeling (13 provinces, A1A 1A1 postal code, Canadian timezones first, CAD currency, GST/HST tax rules).
- [x] Interac e-Transfer deposit flow with vendor approval dashboard.
- [x] Brevo HTTP transactional emails with RFC 5545 `.ics` attachments.
- [x] PBKDF2 Web Crypto authentication & D1 session management.
- [x] 12/12 ported unit tests passing in Vitest.
- [x] Zero Stripe / card payment dependencies (`git grep -i stripe` returns 0).
- [x] Live deployment to Cloudflare Workers (`truenorth-bookings`).

### Phase 2 — Future Parity Roadmap
- Multi-member collective and round-robin scheduling teams.
- Two-way CalDAV background synchronization via Workers Cron Triggers (`scheduled` event).
- Automated email reminders scheduled 24 hours prior to meetings.
- Dynamic group booking links.
- Single Sign-On via OIDC / Arctic.

### Explicitly Deferred Features & Replacements
1. **EWS / Microsoft Exchange Support**:
   - *Reason*: EWS requires heavyweight SOAP XML parsing and NTLM/Kerberos legacy network authentication, which is incompatible with modern serverless edge runtimes and obsolete in modern Microsoft 365 environments.
   - *Replacement*: Modern Microsoft Graph API / OAuth2 CalDAV calendar subscriptions (Phase 2).
2. **SMS Providers (Twilio / sevenio / gatewayapi)**:
   - *Reason*: SMS requires paid carrier accounts, international A2P 10DLC registration, and recurring telephony costs that violate the 100% free-tier SaaS model.
   - *Replacement*: High-deliverability transactional email notifications via Brevo HTTP API (free 300 emails/day).
3. **Google Meet Direct API**:
   - *Reason*: Requires Google Cloud Project verification, OAuth consent screen reviews, and sensitive scope approvals.
   - *Replacement*: Static conference links (e.g. Jitsi Meet, Zoom, Google Meet room links) configured per event type.

---

## 6. AGPL-3.0 License Compliance

This project is a derivative work of `calrs` (authored by Olivier Lambert, AGPL-3.0).
- The original `LICENSE` file is retained intact in the repository root.
- The public fork repository is hosted at `https://github.com/pal404error/calender.diy`.
- Every rendered web page displays the mandatory notice in its footer:
  `Made in Canada 🇨🇦 · Powered by calrs (AGPL-3.0) — <a href="https://github.com/pal404error/calender.diy">source</a>`
