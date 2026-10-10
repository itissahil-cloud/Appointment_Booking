/**
 * Normalize phone numbers to standard E.164 format.
 * Primarily handles Indian phone numbers (10 digits, with/without 0 or +91/91).
 */
export function normalizePhoneNumber(rawPhone: string): string {
  // Strip all non-numeric characters except leading '+'
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    // E.g. +919876543210 -> return as is
    return cleaned;
  }

  // If starts with 91 and has 12 digits total
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // If starts with 0 and has 11 digits (e.g. 09876543210)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+91${cleaned.substring(1)}`;
  }

  // If 10 digits (e.g. 9876543210)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // Default fallback with +
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}
