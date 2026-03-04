const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true' || true;

import mockTicketSummaries from './mock-ticket-summaries.json';

export const CustomerService = {
    async getTicketSummaries(params = {}) {
        const {
            page = 1,
            limit = 5,
            globalFilter = '',
            brand = [],
            csat_score = null,
            sentiment = null,
            topic = [],
            agent_email = [],
            customer_email = [],
            _chatTagsString = [],
            chat_transcript = null,
            email_transcript = null,
            summary = null,
            startDate = null,
            endDate = null
        } = params;

        if (USE_MOCK) {
            return mockPaginatedResponse(mockTicketSummaries, params);
        }

        try {
            const response = await api.get('/api/ticket-summaries/', {
                params: {
                    page,
                    page_size: limit,
                    search: globalFilter || null,
                    brand: brand.length ? brand.join(',') : null,
                    csat_score: csat_score || null,
                    sentiment: sentiment || null,
                    topic: topic.length ? topic.join(',') : null,
                    agent_email: agent_email.length ? agent_email.join(',') : null,
                    customer_email: customer_email.length ? customer_email.join(',') : null,
                    chat_tags: _chatTagsString.length ? _chatTagsString.join(',') : null,
                    chat_transcript_contains: chat_transcript || null,
                    email_transcript_contains: email_transcript || null,
                    summary_contains: summary || null,
                    timestamp_gte: startDate || null,
                    timestamp_lt: endDate || null
                }
            });

            return {
                data: response.data.results || response.data,
                total: response.data.count || response.data.total || response.data.length,
                page,
                limit
            };
        } catch (error) {
            console.error('Failed to fetch ticket summaries:', error);
            return { data: [], total: 0, page, limit };
        }
    },

    async getTicketById(ticketId) {
        if (USE_MOCK) {
            return mockTicketSummaries.find((t) => t.ticketid === ticketId) || null;
        }
        return null;
    }
};

async function mockPaginatedResponse(allData, params) {
    const {
        globalFilter = '',
        brand = [],
        csat_score = null,
        sentiment = null,
        topic = [],
        agent_email = [],
        customer_email = [],
        _chatTagsString = [],
        chat_transcript = null,
        email_transcript = null,
        summary = null,
        startDate = null,
        endDate = null
    } = params;

    let filteredData = [...allData];

    // Global search – covers :globalFilterFields fully
    if (globalFilter) {
        const searchLower = globalFilter.toLowerCase();
        filteredData = filteredData.filter((item) => {
            const stringMatch = [item.ticketid, item.topic, item.brand, item.vip_level, item.customer_email, item.agent_email, item.csat_score, item.sentiment, item.summary, item.chat_transcript, item.email_transcript].some((val) =>
                String(val || '')
                    .toLowerCase()
                    .includes(searchLower)
            );

            const tagsMatch = item.chat_tags?.some((tag) => tag.toLowerCase().includes(searchLower)) || false;

            return stringMatch || tagsMatch;
        });
    }

    // Dedicated filters
    if (brand.length > 0) {
        filteredData = filteredData.filter((item) => brand.includes(item.brand));
    }

    if (csat_score) {
        filteredData = filteredData.filter((item) => item.csat_score === csat_score);
    }

    if (sentiment) {
        filteredData = filteredData.filter((item) => item.sentiment === sentiment);
    }

    if (topic.length > 0) {
        filteredData = filteredData.filter((item) => topic.some((t) => item.topic?.includes(t)));
    }

    if (agent_email.length > 0) {
        filteredData = filteredData.filter((item) => agent_email.some((email) => item.agent_email?.toLowerCase().includes(email.toLowerCase())));
    }

    if (customer_email.length > 0) {
        filteredData = filteredData.filter((item) => customer_email.some((email) => item.customer_email?.toLowerCase().includes(email.toLowerCase())));
    }

    // Dedicated long-text filters (CONTAINS)
    if (chat_transcript) {
        const searchLower = chat_transcript.toLowerCase();
        filteredData = filteredData.filter((item) => item.chat_transcript?.toLowerCase().includes(searchLower));
    }

    if (email_transcript) {
        const searchLower = email_transcript.toLowerCase();
        filteredData = filteredData.filter((item) => item.email_transcript?.toLowerCase().includes(searchLower));
    }

    if (summary) {
        const searchLower = summary.toLowerCase();
        filteredData = filteredData.filter((item) => item.summary?.toLowerCase().includes(searchLower));
    }

    // Dedicated tags filter (contains any selected)
    if (_chatTagsString.length > 0) {
        filteredData = filteredData.filter((item) => _chatTagsString.some((selected) => item.chat_tags?.includes(selected)));
    }

    // Timestamp range – hoist Date creation outside loop for performance (optimized for 10000+ records)
    if (startDate) {
        const startDateObj = new Date(startDate);
        filteredData = filteredData.filter((item) => new Date(item.timestamp) >= startDateObj);
    }
    if (endDate) {
        const endDateObj = new Date(endDate);
        filteredData = filteredData.filter((item) => new Date(item.timestamp) < endDateObj);
    }

    const total = filteredData.length;
    const start = (params.page - 1) * params.limit;
    const paginated = filteredData.slice(start, start + params.limit);

    // Mock delay removed – instant response optimized for large datasets
    return { data: paginated, total, page: params.page, limit: params.limit };
}
