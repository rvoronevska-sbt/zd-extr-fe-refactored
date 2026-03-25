import api from '@/services/authApi';
import { ref } from 'vue';
import { emptyToNone, normalizeTranscript } from '@/utils/normalization';
import { getCachedTickets, setCachedTickets, isCacheStale } from '@/services/ticketCache';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// ── Module-level cache (shared across ALL component instances) ──
let isInitialized = false;
let initPromise = null;

const fullProcessedTickets = ref([]);
const isLoading = ref(false);
const fetchError = ref(null);

// ── Fields that get emptyToNone normalization (short categorical fields) ──
const NORMALIZE_FIELDS = ['topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', 'sentiment', 'sentiment_reason'];

// ── Long-text fields cleaned via normalizeTranscript ──
const LONG_TEXT_FIELDS = ['summary', 'chat_transcript', 'email_transcript'];

// ── Helpers ──
const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (typeof value === 'number') return [String(value)];
    return [];
};

// ── Process a single raw ticket into the shape the table expects ──
function processTicket(ticket) {
    const tags = toArray(ticket.chat_tags).filter((t) => typeof t === 'string' && t.trim());
    const normalized = Object.fromEntries(NORMALIZE_FIELDS.map((field) => [field, emptyToNone(ticket[field])]));
    const longText = Object.fromEntries(LONG_TEXT_FIELDS.map((field) => [field, normalizeTranscript(ticket[field])]));
    const chatTagsString = tags
        .map((t) => t.trim().toLowerCase())
        .sort()
        .join(', ');

    const processed = {
        ...ticket,
        ...normalized,
        ...longText,
        timestamp: new Date(ticket.timestamp),
        _chatTagsString: chatTagsString
    };

    // Pre-computed lowercase search index — avoids 13× toLowerCase per row during global filter
    processed._searchIndex = [
        String(processed.ticketid || ''),
        processed.topic || '',
        processed.brand || '',
        processed.vip_level || '',
        processed.customer_email || '',
        processed.agent_email || '',
        processed.csat_score || '',
        processed.sentiment || '',
        processed.sentiment_reason || '',
        processed.summary || '',
        processed.chat_transcript || '',
        processed.email_transcript || '',
        chatTagsString
    ]
        .join('\0')
        .toLowerCase();

    return processed;
}

// ── Yield to the browser event loop between processing batches ──
// scheduler.yield() (Chrome 129+) resumes immediately after yielding with high priority;
// setTimeout fallback adds ~1ms per batch but is universally supported.
function yieldToMain() {
    if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
        return scheduler.yield();
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Process raw records in batches to keep main-thread tasks under 50ms ──
// 30k tickets / 150 per batch = 200 batches, each ~30ms → TBT drops to near-zero.
const PROCESS_BATCH_SIZE = 150;

async function processRecords(rawData) {
    const result = new Array(rawData.length);
    for (let i = 0; i < rawData.length; i += PROCESS_BATCH_SIZE) {
        const end = Math.min(i + PROCESS_BATCH_SIZE, rawData.length);
        for (let j = i; j < end; j++) {
            result[j] = processTicket(rawData[j]);
        }
        if (end < rawData.length) {
            await yieldToMain();
        }
    }
    fullProcessedTickets.value = result;
}

// ── Fetch from API and store raw data in IDB ──
async function fetchAndCache() {
    const response = await api.get('/api/ticket-summaries/');
    const raw = Array.isArray(response.data) ? response.data : (response.data.results ?? []);
    await processRecords(raw);
    // Write to IDB in the background — don't block the UI on IDB writes
    setCachedTickets(raw).catch((err) => console.warn('IDB write failed:', err));
}

// ── Background refresh: re-fetches silently, updates reactive state when done ──
async function refreshInBackground() {
    try {
        await fetchAndCache();
    } catch (err) {
        console.warn('Background refresh failed (non-fatal):', err);
    }
}

// ── Single fetch — runs once, result shared across all component instances ──
async function lazyInit() {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        isLoading.value = true;
        fetchError.value = null;
        try {
            if (USE_MOCK) {
                const { default: mockData } = await import('@/services/mock-ticket-summaries.json');
                await processRecords(mockData);
                isInitialized = true;
                return;
            }

            // ── 1. Try IDB cache first ──
            const cached = await getCachedTickets().catch(() => null);

            if (cached?.data?.length) {
                // Serve cached data immediately — UI renders at once
                await processRecords(cached.data);
                isLoading.value = false;
                isInitialized = true;

                if (isCacheStale(cached)) {
                    // Cache is old — silently refresh in background
                    refreshInBackground();
                }
                return;
            }

            // ── 2. No cache — full API fetch (first ever visit) ──
            await fetchAndCache();
            isInitialized = true;
        } catch (err) {
            fetchError.value = err;
            isInitialized = false; // allow retry on next call
            console.error('useTicketData: failed to load tickets', err);
        } finally {
            isLoading.value = false;
            initPromise = null;
        }
    })();

    return initPromise;
}

export function useTicketData() {
    return {
        fullProcessedTickets,
        isLoading,
        fetchError,
        _lazyInit: lazyInit
    };
}
