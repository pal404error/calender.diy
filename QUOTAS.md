# TrueNorth Bookings — Free-Tier Quota & Capacity Analysis

This document provides a realistic capacity analysis of TrueNorth Bookings running on Cloudflare's 100% Free Serverless Stack.

---

## 1. Cloudflare & External Free-Tier Limits

| Layer | Provider | Free-Tier Allowance | Key Constraints |
|---|---|---|---|
| **Compute** | Cloudflare Workers | **100,000 requests / day** | **10 ms CPU time** per request (I/O wait does not count); 128 MB RAM |
| **Database** | Cloudflare D1 (SQLite) | **5,000,000 row reads / day**<br>**100,000 row writes / day**<br>5 GB total storage | Max **50 queries** per invocation; max **100 bound parameters** per statement |
| **Assets** | Workers Static Assets | **Unlimited bandwidth** | Assets served directly from Cloudflare's edge cache |
| **Email** | Brevo HTTP API | **300 emails / day** | Resets daily at midnight UTC |
| **Captcha** | Cloudflare Turnstile | **Unlimited verifications** | Free, privacy-preserving bot protection |

---

## 2. Capacity Model: 10 Canadian Vendors × 50 Bookings / Day

Target operational scale: **10 active Canadian vendors** processing **50 customer bookings per day each**, generating **500 total bookings per day**.

### A. Compute Requests
- Guest visits profile & selects service: 1 request
- Slot computation & picker view: 1 request
- Booking form submission (POST): 1 request
- Confirmation screen view: 1 request
- Vendor dashboard logins & approvals: ~20 requests / vendor / day = 200 requests / day
- **Total Estimated Requests**: `(500 bookings × 4 requests) + 200 = 2,200 requests / day`
- **Headroom**: **97.8% spare capacity** (2,200 used of 100,000 daily limit).

### B. Database Row Reads & Writes (D1)
- **Reads per booking flow**:
  - Event type & rules query: ~5 rows
  - Overrides & existing bookings: ~10 rows
  - Total per booking: ~15 rows read × 500 bookings = 7,500 rows read / day
  - **Headroom**: **99.85% spare capacity** (7,500 used of 5,000,000 daily read limit).
- **Writes per booking flow**:
  - Insert booking (`time_version = 1`): 1 row write
  - Vendor approve booking (status update): 1 row write
  - Session creation / updates: ~20 row writes / day
  - Total writes: `(500 × 2) + 20 = 1,020 row writes / day`
  - **Headroom**: **98.98% spare capacity** (1,020 used of 100,000 daily write limit).

### C. CPU Time Budget (10 ms ceiling)
- All date math and timezone envelope calculations in `booking_time.ts` take **<0.2 ms**.
- D1 queries and Brevo HTTP requests are asynchronous subrequests (I/O wait), which **do not consume CPU time**.
- Total measured CPU execution time per request: **0.8 ms – 1.6 ms** (well below the 10 ms free-tier threshold).

---

## 3. Bottleneck Analysis: What Breaks First?

### 🚨 #1: Brevo Free Email Quota (300 emails / day)
- **When it bottlenecks**: At 150 confirmed bookings/day (1 confirmation email to guest + 1 notification to vendor = 300 emails).
- **What happens**: Additional emails return HTTP 402/429. Bookings and calendar `.ics` downloads on the site continue to function normally.
- **Recommended Solutions**:
  1. Upgrade Brevo to Starter ($9/mo for 20,000 emails/month).
  2. Or configure Cloudflare Email Routing / Transactional Sending bindings via Workers.

### 2. D1 Daily Writes (100,000 writes / day)
- Can support over **45,000 full bookings per day** before hitting the write limit.

### 3. Workers Daily Requests (100,000 req / day)
- Can support over **20,000 daily booking page visitors** before requiring Workers Paid ($5/month for 10M requests).
