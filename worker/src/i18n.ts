// Canadian Localization, Timezones, Validation, and Internationalization (en-CA / fr-CA)

export interface ProvinceOption {
  code: string;
  nameEn: string;
  nameFr: string;
}

export const CANADIAN_PROVINCES: ProvinceOption[] = [
  { code: 'AB', nameEn: 'Alberta', nameFr: 'Alberta' },
  { code: 'BC', nameEn: 'British Columbia', nameFr: 'Colombie-Britannique' },
  { code: 'MB', nameEn: 'Manitoba', nameFr: 'Manitoba' },
  { code: 'NB', nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick' },
  { code: 'NL', nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador' },
  { code: 'NS', nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse' },
  { code: 'NT', nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest' },
  { code: 'NU', nameEn: 'Nunavut', nameFr: 'Nunavut' },
  { code: 'ON', nameEn: 'Ontario', nameFr: 'Ontario' },
  { code: 'PE', nameEn: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard' },
  { code: 'QC', nameEn: 'Quebec', nameFr: 'Québec' },
  { code: 'SK', nameEn: 'Saskatchewan', nameFr: 'Saskatchewan' },
  { code: 'YT', nameEn: 'Yukon', nameFr: 'Yukon' },
];

export interface TimezoneOption {
  iana: string;
  label: string;
  isCanadian: boolean;
}

export const TIMEZONES: TimezoneOption[] = [
  // Canadian Timezones (Listed First)
  { iana: 'America/St_Johns', label: '🇨🇦 Newfoundland Time (St. John\'s)', isCanadian: true },
  { iana: 'America/Halifax', label: '🇨🇦 Atlantic Time (Halifax)', isCanadian: true },
  { iana: 'America/Toronto', label: '🇨🇦 Eastern Time (Toronto / Montreal)', isCanadian: true },
  { iana: 'America/Winnipeg', label: '🇨🇦 Central Time (Winnipeg)', isCanadian: true },
  { iana: 'America/Regina', label: '🇨🇦 Central Time - No DST (Regina)', isCanadian: true },
  { iana: 'America/Edmonton', label: '🇨🇦 Mountain Time (Edmonton / Calgary)', isCanadian: true },
  { iana: 'America/Vancouver', label: '🇨🇦 Pacific Time (Vancouver)', isCanadian: true },

  // Common International Timezones
  { iana: 'UTC', label: '🌐 UTC', isCanadian: false },
  { iana: 'America/New_York', label: 'Eastern Time (New York)', isCanadian: false },
  { iana: 'America/Chicago', label: 'Central Time (Chicago)', isCanadian: false },
  { iana: 'America/Denver', label: 'Mountain Time (Denver)', isCanadian: false },
  { iana: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)', isCanadian: false },
  { iana: 'Europe/London', label: 'London (GMT/BST)', isCanadian: false },
  { iana: 'Europe/Paris', label: 'Paris (CET/CEST)', isCanadian: false },
  { iana: 'Asia/Tokyo', label: 'Tokyo (JST)', isCanadian: false },
  { iana: 'Australia/Sydney', label: 'Sydney (AEST)', isCanadian: false },
];

/**
 * Validates a Canadian postal code (e.g. A1A 1A1, K1A 0B1)
 */
export function isValidCanadianPostalCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const regex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
  return regex.test(code.trim());
}

/**
 * Normalizes a Canadian postal code to standard format "A1A 1A1"
 */
export function formatCanadianPostalCode(code: string): string {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  }
  return code.trim().toUpperCase();
}

/**
 * Validates Canadian / North American phone numbers
 */
export function isValidCanadianPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
}

/**
 * Formats a phone number to standard Canadian presentation: +1 (XXX) XXX-XXXX
 */
export function formatCanadianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const base = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (base.length === 10) {
    return `+1 (${base.slice(0, 3)}) ${base.slice(3, 6)}-${base.slice(6)}`;
  }
  return phone.trim();
}

/**
 * Formats money strictly as $X.XX CAD
 */
export function formatMoneyCAD(amount: number): string {
  return `$${amount.toFixed(2)} CAD`;
}

/**
 * Canadian English and French UI translations
 */
export const TRANSLATIONS = {
  en: {
    brand_tagline: 'Made in Canada 🇨🇦',
    footer_text: 'Made in Canada 🇨🇦 · Powered by calrs (AGPL-3.0) — ',
    footer_source: 'source',
    select_slot: 'Select Date & Time',
    your_details: 'Enter Details',
    confirmed: 'Booking Confirmed',
    pending_approval: 'Pending Interac e-Transfer Hold',
    deposit_required: 'Interac e-Transfer Deposit Required',
    tax_inclusive: 'Prices include GST/HST',
    tax_exclusive: 'Subject to applicable GST/HST',
    cancellation_policy: 'Cancellation Policy',
  },
  fr: {
    brand_tagline: 'Fait au Canada 🇨🇦',
    footer_text: 'Fait au Canada 🇨🇦 · Propulsé par calrs (AGPL-3.0) — ',
    footer_source: 'code source',
    select_slot: 'Choisir la date et l\'heure',
    your_details: 'Vos informations',
    confirmed: 'Réservation confirmée',
    pending_approval: 'En attente de virement Interac',
    deposit_required: 'Acompte par virement Interac requis',
    tax_inclusive: 'Les prix incluent la TPS/TVH',
    tax_exclusive: 'Sujet aux taxes TPS/TVH applicables',
    cancellation_policy: 'Politique d\'annulation',
  },
};
