/**
 * Formats a Date object to MM/DD/YYYY string (en-US locale by default).
 *
 * @param {Date} value - Date object to format
 * @param {string} [locale='en-US'] - BCP 47 locale tag
 * @returns {string} Formatted date string, or empty string if value is invalid
 */
export function formatDate(value, locale = 'en-US') {
    if (!value || !(value instanceof Date)) return '';
    return value.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}
