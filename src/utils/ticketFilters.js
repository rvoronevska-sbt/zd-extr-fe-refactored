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

    // Global search — uses pre-computed _searchIndex (single lowercase string per row)
    // to avoid 13× toLowerCase calls per row on every keystroke
    if (globalFilter) {
        const searchLower = globalFilter.trim().toLowerCase();
        if (searchLower) {
            result = result.filter((item) => item._searchIndex.includes(searchLower));
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
    if (customer_email.length) {
        const lowerEmails = customer_email.map((e) => e.toLowerCase());
        result = result.filter((item) => {
            const val = item.customer_email?.toLowerCase();
            return val && lowerEmails.some((e) => val.includes(e));
        });
    }
    if (agent_email.length) {
        const lowerEmails = agent_email.map((e) => e.toLowerCase());
        result = result.filter((item) => {
            const val = item.agent_email?.toLowerCase();
            return val && lowerEmails.some((e) => val.includes(e));
        });
    }
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

    // Date range — item.timestamp is already a Date object from processTicket
    if (startDate) {
        const startMs = new Date(startDate).getTime();
        result = result.filter((item) => item.timestamp.getTime() >= startMs);
    }
    if (endDate) {
        const endMs = new Date(endDate).getTime();
        result = result.filter((item) => item.timestamp.getTime() < endMs);
    }

    return result;
}
