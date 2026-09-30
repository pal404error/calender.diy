# TrueNorth Bookings — Deployment Guide

This guide covers deployment of **TrueNorth Bookings** to Cloudflare's Free Tier (Workers + D1 + Static Assets) with Brevo HTTP Email and Turnstile bot protection.

---

## 1. Prerequisites

- **Node.js**: v18+ or v20+ (`node -v`)
- **Cloudflare Account**: Free tier (no credit card required)
- **Brevo Account**: Free tier (300 emails/day, no credit card required)
- **Cloudflare API Token**: Needs `Cloudflare D1:Edit` and `Cloudflare Workers Scripts:Edit` permissions.

---

## 2. Fresh Clone to Local Development

```bash
# 1. Clone repository
git clone https://github.com/pal404error/calender.diy.git
cd calender.diy/worker

# 2. Install dependencies
npm install

# 3. Create local development database & run migrations
npx wrangler d1 migrations apply truenorth-db --local

# 4. Seed local database with initial Canadian vendor profile
npx wrangler d1 execute truenorth-db --local --file=scripts/seed.sql

# 5. Run local development server
npm run dev
```

Visit `http://localhost:8787` in your browser.
Default vendor login: `admin@truenorth.ca` / `AdminPassword2026!`.

---

## 3. Production Deployment (Cloudflare Free Tier)

### Step 1: Create Remote D1 Database (if not already created)
```bash
npx wrangler d1 create truenorth-db
```
Note the database UUID returned by Wrangler and update `worker/wrangler.jsonc` if needed:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "truenorth-db",
    "database_id": "5da030fe-c357-4a0a-9793-b8260c4ee4d8",
    "migrations_dir": "migrations"
  }
]
```

### Step 2: Apply D1 Schema Migrations to Remote
```bash
npx wrangler d1 migrations apply truenorth-db --remote
```

### Step 3: Seed Remote Database
```bash
npx wrangler d1 execute truenorth-db --remote --file=scripts/seed.sql
```

### Step 4: Configure Production Secrets
Set sensitive production keys via Wrangler (never commit secrets to git):

```bash
# Brevo API Key for transactional emails (from app.brevo.com -> SMTP & API -> API Keys)
npx wrangler secret put BREVO_API_KEY

# Cloudflare Turnstile Secret Key (from Cloudflare Dashboard -> Turnstile)
npx wrangler secret put TURNSTILE_SECRET_KEY

# Session Signing Secret (random 32+ character hex string)
npx wrangler secret put SESSION_SECRET
```

*Note: For local development, secrets can optionally be placed in `worker/.dev.vars` (which is gitignored).*

### Step 5: Deploy Worker
```bash
npm run deploy
```

Your service is now live on `<worker-name>.<subdomain>.workers.dev` (e.g. `https://truenorth-bookings.grew-anything-barn.workers.dev`).

---

## 4. Custom Domain Setup (Free on Cloudflare)

To use your own Canadian domain (e.g. `bookings.mybusiness.ca`):

1. Add your domain to your Cloudflare dashboard (free tier DNS).
2. Go to **Workers & Pages** → Select `truenorth-bookings`.
3. Click **Settings** → **Domains & Routes** → **Add Custom Domain**.
4. Enter `bookings.mybusiness.ca` and click **Add Domain**.
5. Cloudflare will automatically provision a free universal SSL certificate and route requests directly to your Worker.
