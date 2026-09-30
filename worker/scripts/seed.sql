-- ====================================================================
-- TrueNorth Bookings - Seed Data for Canadian Local Vendor (D1)
-- ====================================================================

-- 1. Insert Initial Vendor User (Admin)
-- Login: admin@truenorth.ca / AdminPassword2026!
INSERT OR REPLACE INTO users (
    id, email, name, timezone, password_hash, role, auth_provider,
    enabled, username, title, bio, language,
    business_name, street_address, province, postal_code, phone, tax_number, prices_include_tax
) VALUES (
    'usr_canadian_admin_01',
    'admin@truenorth.ca',
    'Olivier Tremblay',
    'America/Toronto',
    'pbkdf2$100000$d4235c57e43f256525fac4a7fbeedcf8$8742e6bf9a084ceb60c5a1727f7af42c0d2f7463a817d502f905e1e0aaa38546',
    'admin',
    'local',
    1,
    'admin',
    'Master Specialist & Consultant',
    'Local Canadian consulting and on-site trade service. Proudly serving Toronto, the GTA, and across Ontario. Made in Canada 🇨🇦',
    'en',
    'TrueNorth Canadian Wellness & Trades',
    '100 King Street West, Suite 5600',
    'ON',
    'M5X 1C9',
    '+1 (416) 555-0188',
    '889977665 RT 0001',
    1
);

-- 2. Insert Account
INSERT OR REPLACE INTO accounts (
    id, name, email, timezone, user_id
) VALUES (
    'acc_canadian_admin_01',
    'TrueNorth Canadian Wellness & Trades',
    'admin@truenorth.ca',
    'America/Toronto',
    'usr_canadian_admin_01'
);

-- 3. Insert Service 1: Initial Consultation (Free, no deposit)
INSERT OR REPLACE INTO event_types (
    id, account_id, slug, title, description, duration_min,
    location_type, location_value, buffer_before, buffer_after, min_notice_min,
    timezone, enabled, visibility, created_by_user_id, cancellation_policy
) VALUES (
    'et_consultation_01',
    'acc_canadian_admin_01',
    'consultation',
    'Initial Consultation',
    'Complimentary 30-minute consultation to review requirements, project estimates, or wellness intake.',
    30,
    'in_person',
    '100 King Street West, Suite 5600, Toronto, ON',
    0,
    15,
    60,
    'America/Toronto',
    1,
    'public',
    'usr_canadian_admin_01',
    'Please notify us at least 12 hours in advance if you need to reschedule or cancel.'
);

-- 4. Insert Service 2: On-Site Assessment (With Canadian Interac e-Transfer Deposit)
INSERT OR REPLACE INTO event_types (
    id, account_id, slug, title, description, duration_min,
    location_type, location_value, buffer_before, buffer_after, min_notice_min,
    timezone, enabled, visibility, created_by_user_id,
    deposit_amount, deposit_recipient_email, cancellation_policy
) VALUES (
    'et_onsite_assessment_02',
    'acc_canadian_admin_01',
    'assessment',
    'On-Site Assessment & Service',
    'Comprehensive 60-minute on-site assessment and diagnostic visit. Requires a $50.00 CAD deposit via Interac e-Transfer to confirm slot hold.',
    60,
    'in_person',
    'Client location in Greater Toronto Area',
    15,
    15,
    120,
    'America/Toronto',
    1,
    'public',
    'usr_canadian_admin_01',
    50.00,
    'payments@truenorth.ca',
    'Interac deposits are 100% refundable if cancellation is requested at least 24 hours prior to appointment.'
);

-- 5. Availability Rules (Mon-Fri 09:00 - 17:00) for both event types
-- Consultation Rules
INSERT OR REPLACE INTO availability_rules (id, event_type_id, day_of_week, start_time, end_time) VALUES
('ar_c_1', 'et_consultation_01', 1, '09:00', '17:00'),
('ar_c_2', 'et_consultation_01', 2, '09:00', '17:00'),
('ar_c_3', 'et_consultation_01', 3, '09:00', '17:00'),
('ar_c_4', 'et_consultation_01', 4, '09:00', '17:00'),
('ar_c_5', 'et_consultation_01', 5, '09:00', '17:00');

-- Assessment Rules
INSERT OR REPLACE INTO availability_rules (id, event_type_id, day_of_week, start_time, end_time) VALUES
('ar_a_1', 'et_onsite_assessment_02', 1, '09:00', '17:00'),
('ar_a_2', 'et_onsite_assessment_02', 2, '09:00', '17:00'),
('ar_a_3', 'et_onsite_assessment_02', 3, '09:00', '17:00'),
('ar_a_4', 'et_onsite_assessment_02', 4, '09:00', '17:00'),
('ar_a_5', 'et_onsite_assessment_02', 5, '09:00', '17:00');
