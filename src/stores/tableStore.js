// src/stores/tableStore.js
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { NEGATIVE_SENTIMENTS } from '@/config/enums';

export const useTableStore = defineStore('table', () => {
    const filteredTickets = ref([]);
    let cachedStats = null;
    let cachedStatsLength = 0;

    function setFilteredTickets(rows) {
        filteredTickets.value = rows || [];
        // Invalidate cache when customers change
        cachedStats = null;
        cachedStatsLength = 0;
    }

    // ────────────────────────────────────────────────
    // Aggregations for charts (memoized)
    // ────────────────────────────────────────────────
    const topicStats = computed(() => {
        const currentLength = filteredTickets.value.length;

        // Return cached result if data hasn't changed
        if (cachedStats !== null && cachedStatsLength === currentLength) {
            return cachedStats;
        }

        const stats = {};

        filteredTickets.value.forEach((c) => {
            const topic = c.topic?.trim() || 'Unknown';
            if (!stats[topic]) {
                stats[topic] = {
                    total: 0,
                    negative: 0
                };
            }
            stats[topic].total++;

            // Assuming you have a sentiment field (or derive negative from it)
            const isNegative = NEGATIVE_SENTIMENTS.includes(c.sentiment?.toLowerCase());
            if (isNegative) {
                stats[topic].negative++;
            }
        });

        // Sort by total descending
        cachedStats = Object.entries(stats)
            .map(([topic, counts]) => ({
                topic,
                total: counts.total,
                negative: counts.negative,
                percentNegative: counts.total > 0 ? (counts.negative / counts.total) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total);

        cachedStatsLength = currentLength;
        return cachedStats;
    });

    const chartLabels = computed(() => topicStats.value.map((s) => s.topic));
    const totalChatsData = computed(() => topicStats.value.map((s) => s.total));
    const negativeChatsData = computed(() => topicStats.value.map((s) => s.negative));
    const percentNegativeData = computed(() => topicStats.value.map((s) => s.percentNegative.toFixed(1)));

    return {
        filteredTickets,
        setFilteredTickets,
        topicStats,
        chartLabels,
        totalChatsData,
        negativeChatsData,
        percentNegativeData
    };
});
