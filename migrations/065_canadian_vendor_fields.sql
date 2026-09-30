-- Canadian localization & vendor fields
-- Extends user/vendor profile with Canadian business address, province, postal code, phone, and GST/HST details.
ALTER TABLE users ADD COLUMN business_name TEXT;
ALTER TABLE users ADD COLUMN street_address TEXT;
ALTER TABLE users ADD COLUMN province TEXT;
ALTER TABLE users ADD COLUMN postal_code TEXT;
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN tax_number TEXT;
ALTER TABLE users ADD COLUMN prices_include_tax INTEGER NOT NULL DEFAULT 0;

-- Per-event-type deposit requirements (Interac e-Transfer) and cancellation policy
ALTER TABLE event_types ADD COLUMN deposit_amount REAL;
ALTER TABLE event_types ADD COLUMN deposit_recipient_email TEXT;
ALTER TABLE event_types ADD COLUMN cancellation_policy TEXT;
