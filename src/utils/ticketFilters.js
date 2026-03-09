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
        topic = [],
        vip_level = [],
        customer_email = [],
        agent_email = [],
        _chatTagsString = [],
        csat_score = null,
        sentiment = null,
        chat_transcript = null,
        email_transcript = null,
        summary = null,
        startDate = null,
        endDate = null
    } = params;

    let result = data;

    // Global search — covers all text fields and chat tags
    if (globalFilter) {
        const searchLower = globalFilter.toLowerCase();
        result = result.filter((item) => {
            const stringMatch = [
                String(item.ticketid || ''),
                item.topic || '',
                item.brand || '',
                item.vip_level || '',
                item.customer_email || '',
                item.agent_email || '',
                item.csat_score || '',
                item.sentiment || '',
                item.summary || '',
                item.chat_transcript || '',
                item.email_transcript || ''
            ].some((val) => val.toLowerCase().includes(searchLower));

            const tagsMatch = item.chat_tags?.some((tag) => tag.toLowerCase().includes(searchLower)) ?? false;
            return stringMatch || tagsMatch;
        });
    }

    // Ticket ID — exact match
    if (ticketid) {
        const idStr = String(ticketid).trim();
        if (idStr) result = result.filter((item) => String(item.ticketid) === idStr);
    }

    // Multi-select filters
    if (brand.length) result = result.filter((item) => brand.includes(item.brand));
    if (topic.length) result = result.filter((item) => topic.some((t) => item.topic?.includes(t)));
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
