import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { NEGATIVE_SENTIMENTS } from '@/config/enums';

// O(1) lookup instead of Array.includes O(n) — called per row
const NEGATIVE_SET = new Set(NEGATIVE_SENTIMENTS);

export const useTableStore = defineStore('table', () => {
    const filteredTickets = ref([]);

    function setFilteredTickets(rows) {
        filteredTickets.value = rows || [];
    }

    // ────────────────────────────────────────────────
    // Aggregations for charts (memoized by Vue computed)
    // ────────────────────────────────────────────────
    const topicStats = computed(() => {
        const stats = {};

        filteredTickets.value.forEach((c) => {
            const topic = c.topic || 'Unknown';
            if (!stats[topic]) {
                stats[topic] = { total: 0, negative: 0 };
            }
            stats[topic].total++;

            // Data is already trimmed by emptyToNone; sentiment values match NEGATIVE_SENTIMENTS case
            if (NEGATIVE_SET.has(c.sentiment?.toLowerCase())) {
                stats[topic].negative++;
            }
        });

        return Object.entries(stats)
            .map(([topic, counts]) => ({
                topic,
                total: counts.total,
                negative: counts.negative,
                percentNegative: counts.total > 0 ? (counts.negative / counts.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);
    });

    return {
        filteredTickets,
        setFilteredTickets,
        topicStats
    };
});
