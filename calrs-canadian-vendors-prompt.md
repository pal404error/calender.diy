# Agent Prompt: White-label calrs for Canadian local vendors + free deploy

> Fill in every [PLACEHOLDER] before pasting this to your coding agent.
> Assumes your fork from the deploy guide exists at [FORK_URL].

---

You are a senior full-stack engineer and localization specialist. Take the open-source scheduling app **calrs** (my fork at `[FORK_URL]`, upstream https://github.com/olivierlambert/calrs, AGPL-3.0, Rust + SQLite) and turn it into `[BRAND_NAME]` — a white-labelled booking product for **Canadian local vendors**: salons, barbershops, clinics, repair trades, studios, and consultants.

**My inputs (replace before running):**
- `[BRAND_NAME]` — e.g. TrueNorth Bookings
- `[TAGLINE]` — e.g. "Online booking for Canadian local businesses"
- `[PRIMARY_COLOR]` — hex, e.g. #D80621 (or set it post-deploy in Admin → theme engine)
- `[LOGO_LIGHT]` / `[LOGO_DARK]` — paths/URLs to my logo files
- `[SUPPORT_EMAIL]` — e.g. support@mybrand.ca
- `[DEFAULT_TIMEZONE]` — e.g. America/Toronto
- `[FORK_URL]` — my GitHub fork of calrs

## TASK 1 — White-label as [BRAND_NAME]

1. Colours: use the built-in theme engine (Admin → theme → custom colours) for `[PRIMARY_COLOR]` — zero code.
2. Logo: replace `assets/calrs.png` (and any other logo/favicon files under `assets/`) with `[LOGO_LIGHT]`/`[LOGO_DARK]`.
3. Strings: `grep -ri "calrs" templates/ i18n/ assets/` and replace every **user-visible** occurrence (page titles, headers, footers, emails) with `[BRAND_NAME]`. Leave `LICENSE`, code comments, and `CALRS_` env var names untouched.
4. Metadata/tagline: site title and description → `[BRAND_NAME]` / `[TAGLINE]`; support links → `[SUPPORT_EMAIL]`.
5. Footer: add "Made in Canada 🇨🇦" and a link to the public fork (see AGPL constraint below).
6. **Legal (do not skip):** keep the `LICENSE` file and copyright notice intact. AGPL-3.0 hosting duty: the footer link to the public fork satisfies the source-offer requirement.

## TASK 2 — Canadian localization for local vendors

1. **Canadian English** in all user-visible copy: colour, centre, behaviour, cheque, etc. Grep for US spellings (`color`, `center`, `customize` in UI strings) and fix them.
2. **Currency:** all prices render as CAD — `$25.00 CAD`. No USD anywhere a vendor or customer can see.
3. **Timezones:** default `[DEFAULT_TIMEZONE]`; the timezone picker lists Canadian zones first (Toronto, Vancouver, Edmonton, Winnipeg, Halifax, St. John's).
4. **Vendor profile fields** (extend the settings/profile model): business name, street address, **province dropdown** (ON, QC, BC, AB, MB, SK, NS, NB, NL, PE, YT, NT, NU), **postal code** validated as `A1A 1A1`, phone validated as `+1 (___) ___-____`.
5. **Deposits via Interac e-Transfer** — calrs has no payment gateway, and Canadian vendors live on e-Transfer. Add per-event-type optional fields: "Deposit required ($)" + "e-Transfer recipient email". When set: the booking page and confirmation email show instructions ("Send a $20 deposit via Interac e-Transfer to `vendor@example.ca` to confirm your booking"), and the booking uses calrs' existing **pending-booking approval flow** so the vendor confirms once the e-Transfer lands.
6. **Tax:** optional vendor fields "GST/HST number" and "Prices include GST/HST" toggle; show both on the booking confirmation and customer email receipt.
7. **Confirmation page + emails:** include vendor business name, address, phone, and a per-event-type "Cancellation policy" text field.
8. **Stretch (do last):** enable the French (`fr`) locale through calrs' existing `i18n/` system for Quebec vendors.

## TASK 3 — Deploy free, no credit card (Render)

Follow the proven path: my fork already contains the Render fixes (`docker-start.sh` with SQLite git-backup + restore-on-boot, Dockerfile `PORT` fix). You only need to:

1. Create the Render Web Service from `[FORK_URL]` (Docker runtime, Free instance).
2. Set env vars: `CALRS_BASE_URL=https://<service>.onrender.com`, `BACKUP_REPO`, `BACKUP_GIT_TOKEN` (secret), Brevo SMTP (`smtp-relay.brevo.com:587`).
3. Deploy, then run the first-run checklist: register first user (becomes admin) → disable open registration → set brand colours → connect a test CalDAV calendar → test booking end-to-end in incognito → trigger a Manual Deploy and confirm bookings survive (backup restore works).

## Deliverables

1. Fork with all changes + a summary of every file touched.
2. Live public HTTPS URL.
3. Acceptance tests, all passing:
   - [ ] Zero user-visible "calrs" strings; Canadian spelling spot-check passes
   - [ ] Prices show in CAD; province dropdown + postal code + phone validation work
   - [ ] Interac deposit flow: booking page shows e-Transfer instructions, booking lands in pending approvals, vendor approval confirms it
   - [ ] Confirmation email contains vendor address, GST/HST info, cancellation policy, `.ics` invite
   - [ ] `LICENSE` + copyright intact; footer links the public fork
   - [ ] Bookings survive a Render manual redeploy

## Hard constraints

- **$0 total, no credit card.** Only free tiers — flag anything that costs money before doing it.
- Never commit secrets (tokens, SMTP passwords) — env vars only.
- Do not break existing calrs features: CalDAV sync + write-back, teams, reschedule, timezone handling, `.ics` emails.
- AGPL-3.0: keep `LICENSE` intact and keep the fork public with the footer link.
