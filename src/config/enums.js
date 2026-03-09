// VIP tier values (excludes non-VIP segments 'none' and 'normal')
export const VIP_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

// All VIP segment rows in display order (includes non-VIP segments)
export const VIP_SEGMENT_ORDER = ['none', 'normal', ...VIP_TIERS];

// CSAT score values for filter dropdown
export const CSAT_OPTIONS = ['bad', 'good', 'unoffered'];

// Sentiment values for filter dropdown
export const SENTIMENT_OPTIONS = ['neutral', 'positive', 'very negative', 'very positive'];

// Sentiments treated as negative for chart and stats aggregation
export const NEGATIVE_SENTIMENTS = ['very negative', 'negative'];
