// Type definitions for TrueNorth Bookings (Cloudflare Workers + D1)

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  BRAND_NAME?: string;
  BRAND_TAGLINE?: string;
  CURRENCY?: string;
  APP_URL?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_NAME?: string;
  BREVO_SENDER_EMAIL?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SESSION_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  timezone: string;
  password_hash: string | null;
  role: 'admin' | 'user';
  auth_provider: 'local' | 'oidc';
  oidc_subject: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  username: string | null;
  booking_email: string | null;
  title: string | null;
  bio: string | null;
  avatar_path: string | null;
  allow_dynamic_group: number;
  language: string;
  business_name: string | null;
  street_address: string | null;
  province: string | null;
  postal_code: string | null;
  phone: string | null;
  tax_number: string | null;
  prices_include_tax: number;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  timezone: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  account_id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_min: number;
  location_type: string;
  location_value: string | null;
  buffer_before: number;
  buffer_after: number;
  min_notice_min: number;
  slot_interval_min: number | null;
  booking_horizon_days: number | null;
  first_slot_only: number;
  timezone: string | null;
  enabled: number;
  visibility: 'public' | 'unlisted' | 'private';
  cancel_notice_min: number | null;
  reschedule_notice_min: number | null;
  requires_confirmation: number;
  created_by_user_id: string | null;
  created_at: string;
  deposit_amount: number | null;
  deposit_recipient_email: string | null;
  cancellation_policy: string | null;
}

export interface AvailabilityRule {
  id: string;
  event_type_id: string;
  day_of_week: number; // 0..6
  start_time: string;  // "09:00"
  end_time: string;    // "17:00"
}

export interface AvailabilityOverride {
  id: string;
  event_type_id: string;
  date: string;       // "YYYY-MM-DD"
  start_time: string | null;
  end_time: string | null;
  is_blocked: number;
}

export interface Booking {
  id: string;
  event_type_id: string;
  uid: string;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  cancel_token: string;
  reschedule_token: string;
  assigned_user_id: string | null;
  guest_phone: string | null;
  deposit_status: 'none' | 'pending' | 'received';
  time_version: number;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface SlotTime {
  start: string;       // "10:00" in guest TZ
  end: string;         // "10:30" in guest TZ
  host_date: string;   // "YYYY-MM-DD" in host TZ
  host_time: string;   // "10:00" in host TZ
  guest_date: string;  // "YYYY-MM-DD" in guest TZ
}

export interface SlotDay {
  date: string;        // "YYYY-MM-DD"
  label: string;       // e.g. "Monday, October 5"
  slots: SlotTime[];
}
