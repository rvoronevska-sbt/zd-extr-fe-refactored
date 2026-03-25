/**
 * Applies all ticket filter criteria to a dataset.
 * Single source of truth used by both TableDoc (client-side computed)
 * and TicketService (mock data pagination).
 *
 * @param {Array} data - Array of ticket objects (processed or raw)
 * @param {Object} params - Flat filter params (all optional, safe to omit)
 * @returns {Array} New filtered array (original is not mutated)
 */
export function applyTicketFilters(data, params = {}) {
    const {
        globalFilter = '',
        ticketid = null,
        brand = [],
        topic = null,
        vip_level = [],
        customer_email = [],
        agent_email = [],
        _chatTagsString = [],
        csat_score = null,
        sentiment = null,
        sentiment_reason = null,
        chat_transcript = null,
        email_transcript = null,
        summary = null,
        startDate = null,
        endDate = null
    } = params;

    let result = data;

    // Global search — covers all text fields and chat tags
    // Uses short-circuit || chain instead of array allocation (avoids 360k+ allocations on 30k dataset)
    if (globalFilter) {
        const searchLower = globalFilter.trim().toLowerCase();
        if (searchLower) {
            result = result.filter(
                (item) =>
                    String(item.ticketid || '')
                        .toLowerCase()
                        .includes(searchLower) ||
                    (item.topic || '').toLowerCase().includes(searchLower) ||
                    (item.brand || '').toLowerCase().includes(searchLower) ||
                    (item.vip_level || '').toLowerCase().includes(searchLower) ||
                    (item.customer_email || '').toLowerCase().includes(searchLower) ||
                    (item.agent_email || '').toLowerCase().includes(searchLower) ||
                    (item.csat_score || '').toLowerCase().includes(searchLower) ||
                    (item.sentiment || '').toLowerCase().includes(searchLower) ||
                    (item.sentiment_reason || '').toLowerCase().includes(searchLower) ||
                    (item.summary || '').toLowerCase().includes(searchLower) ||
                    (item.chat_transcript || '').toLowerCase().includes(searchLower) ||
                    (item.email_transcript || '').toLowerCase().includes(searchLower) ||
                    (item.chat_tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false)
            );
        }
    }

    // Ticket ID — exact match
    if (ticketid) {
        const idStr = String(ticketid).trim();
        if (idStr) result = result.filter((item) => String(item.ticketid) === idStr);
    }

    // Multi-select filters
    if (brand.length) result = result.filter((item) => brand.includes(item.brand));
    if (vip_level.length) result = result.filter((item) => vip_level.includes(item.vip_level));
    if (customer_email.length) result = result.filter((item) => customer_email.some((e) => item.customer_email?.toLowerCase().includes(e.toLowerCase())));
    if (agent_email.length) result = result.filter((item) => agent_email.some((e) => item.agent_email?.toLowerCase().includes(e.toLowerCase())));
    if (_chatTagsString.length) result = result.filter((item) => _chatTagsString.some((tag) => item.chat_tags?.includes(tag)));

    // Single-value exact filters
    if (csat_score) result = result.filter((item) => item.csat_score === csat_score);

    if (sentiment?.trim()) {
        const sentimentLower = sentiment.trim().toLowerCase();
        result = result.filter((item) => item.sentiment?.trim().toLowerCase() === sentimentLower);
    }

    // Text contains filters
    if (topic) {
        const topicLower = topic.toLowerCase();
        result = result.filter((item) => item.topic?.toLowerCase().includes(topicLower));
    }

    if (sentiment_reason) {
        const csatReasonLower = sentiment_reason.toLowerCase();
        result = result.filter((item) => item.sentiment_reason?.toLowerCase().includes(csatReasonLower));
    }

    if (chat_transcript) {
        const lower = chat_transcript.toLowerCase();
        result = result.filter((item) => item.chat_transcript?.toLowerCase().includes(lower));
    }

    if (email_transcript) {
        const lower = email_transcript.toLowerCase();
        result = result.filter((item) => item.email_transcript?.toLowerCase().includes(lower));
    }

    if (summary) {
        const lower = summary.toLowerCase();
        result = result.filter((item) => item.summary?.toLowerCase().includes(lower));
    }

    // Date range — works for both Date objects and ISO strings
    if (startDate) {
        const start = new Date(startDate);
        result = result.filter((item) => new Date(item.timestamp) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        result = result.filter((item) => new Date(item.timestamp) < end);
    }

    return result;
}
