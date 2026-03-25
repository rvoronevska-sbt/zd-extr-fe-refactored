import api from '@/services/authApi';
import { applyTicketFilters } from '@/utils/ticketFilters';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

import mockTicketSummaries from './mock-ticket-summaries.json';

export const TicketService = {
    async getTicketSummaries(params = {}) {
        const {
            page = 1,
            limit = 5,
            globalFilter = '',
            brand = [],
            csat_score = null,
            sentiment = null,
            sentiment_reason = null,
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
                    sentiment_reason: sentiment_reason || null,
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
    const filteredData = applyTicketFilters(allData, {
        globalFilter: params.globalFilter,
        brand: params.brand,
        topic: params.topic,
        vip_level: params.vip_level,
        customer_email: params.customer_email,
        agent_email: params.agent_email,
        _chatTagsString: params._chatTagsString,
        csat_score: params.csat_score,
        sentiment: params.sentiment,
        sentiment_reason: params.sentiment_reason,
        chat_transcript: params.chat_transcript,
        email_transcript: params.email_transcript,
        summary: params.summary,
        startDate: params.startDate,
        endDate: params.endDate
    });

    const total = filteredData.length;
    const start = (params.page - 1) * params.limit;
    const paginated = filteredData.slice(start, start + params.limit);

    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600));

    return { data: paginated, total, page: params.page, limit: params.limit };
}
