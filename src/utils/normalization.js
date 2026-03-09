import { cleanAndFormatString } from '@/utils/stringUtils';

/**
 * Converts empty, null, or whitespace-only values to 'none'.
 * Preserves case — use for short categorical fields (topic, brand, vip_level, etc.).
 *
 * @param {*} value
 * @returns {string}
 */
export const emptyToNone = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? 'none' : trimmed;
    }
    return value ?? 'none';
};

/**
 * Cleans long-text fields (summary, transcripts) — strips markdown artifacts
 * and excess whitespace. Returns the original value unchanged if falsy.
 *
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
export const normalizeTranscript = (value) => {
    if (!value) return value;
    return cleanAndFormatString(value);
};
