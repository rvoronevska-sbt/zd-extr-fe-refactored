import api from '@/services/authApi';
import { ref } from 'vue';
import { emptyToNone, normalizeTranscript } from '@/utils/normalization';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true';

// ── Module-level cache (shared across ALL component instances) ──
let isInitialized = false;
let initPromise = null;

const allChatTags = ref([]);
const allTopics = ref([]);
const allBrands = ref([]);
const allVipLevels = ref([]);
const allCustomerEmails = ref([]);
const allAgentEmails = ref([]);
const fullProcessedTickets = ref([]);
const isLoading = ref(false);
const fetchError = ref(null); // exposed so components can react to load failures

// ── Fields that get emptyToNone normalization (short categorical fields) ──
const NORMALIZE_FIELDS = ['topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', 'sentiment'];

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

// ── Process raw records into the shape the table expects ──
// Single pass: builds all filter sets AND transforms each record simultaneously
function processRecords(rawData) {
    const sets = {
        tag: new Set(),
        topic: new Set(),
        brand: new Set(),
        vip: new Set(),
        custEmail: new Set(),
        agentEmail: new Set()
    };

    const addToSet = (key, value) => {
        toArray(value).forEach((v) => v?.trim() && sets[key].add(v.trim()));
    };

    const processed = rawData.map((customer) => {
        // Build tag set and _chatTagsString in one go
        const tags = toArray(customer.chat_tags).filter((t) => typeof t === 'string' && t.trim());
        tags.forEach((t) => sets.tag.add(t.trim()));

        // Build all filter sets
        addToSet('topic', customer.topic);
        addToSet('brand', customer.brand);
        addToSet('vip', customer.vip_level);
        addToSet('custEmail', customer.customer_email);
        addToSet('agentEmail', customer.agent_email);

        // Normalize short categorical fields
        const normalized = Object.fromEntries(NORMALIZE_FIELDS.map((field) => [field, emptyToNone(customer[field])]));

        // Clean long-text fields (strips markdown artifacts, excess whitespace)
        const longText = Object.fromEntries(LONG_TEXT_FIELDS.map((field) => [field, normalizeTranscript(customer[field])]));

        return {
            ...customer,
            ...normalized,
            ...longText,
            timestamp: new Date(customer.timestamp),
            _chatTagsString: tags
                .map((t) => t.trim().toLowerCase())
                .sort()
                .join(', ')
        };
    });

    const sort = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    allChatTags.value = [...sets.tag].sort(sort);
    allTopics.value = [...sets.topic].sort(sort);
    allBrands.value = [...sets.brand].sort(sort);
    allVipLevels.value = [...sets.vip].sort(sort);
    allCustomerEmails.value = [...sets.custEmail].sort(sort);
    allAgentEmails.value = [...sets.agentEmail].sort(sort);
    fullProcessedTickets.value = processed;
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
                processRecords(mockData);
            } else {
                const response = await api.get('/api/ticket-summaries/');
                const raw = Array.isArray(response.data) ? response.data : (response.data.results ?? []);
                processRecords(raw);
            }
            isInitialized = true;
        } catch (err) {
            fetchError.value = err; // let components surface the error
            isInitialized = false; // allow retry on next call
            console.error('useArrayMultiSelects: failed to load tickets', err);
        } finally {
            isLoading.value = false;
            initPromise = null;
        }
    })();

    return initPromise;
}

export function useArrayMultiSelects() {
    return {
        allChatTags,
        allTopics,
        allBrands,
        allVipLevels,
        allCustomerEmails,
        allAgentEmails,
        fullProcessedTickets,
        isLoading,
        fetchError,
        _lazyInit: lazyInit
    };
}
