<script setup>
import { useTableStore } from '@/stores/tableStore';
import { computed } from 'vue';

const tableStore = useTableStore();

// ────────────────────────────────────────────────
// Memoization cache for dateRange computation (optimized for 10000+ record datasets)
// Follows the same memoization pattern as tableStore.cachedStats
// Only recalculates when filtered dataset size changes, avoiding O(n) operations on every render
let cachedDateRange = null;
let cachedFilteredCustomersLength = 0;

// ────────────────────────────────────────────────
// 1. Get filtered customers from store (reactive)
const filteredCustomers = computed(() => tableStore.filteredCustomers || []);

// ────────────────────────────────────────────────
// 2. Compute date range from filtered data (min/max timestamp)
// OPTIMIZED: Memoized – only recalculates when dataset size changes (single-pass O(n))
const dateRange = computed(() => {
    const currentLength = filteredCustomers.value.length;
    
    // Return cached value if dataset size hasn't changed
    if (cachedDateRange !== null && cachedFilteredCustomersLength === currentLength) {
        return cachedDateRange;
    }

    if (!currentLength) {
        cachedDateRange = { start: null, end: null };
        cachedFilteredCustomersLength = currentLength;
        return cachedDateRange;
    }

    let min = new Date(filteredCustomers.value[0].timestamp);
    let max = new Date(filteredCustomers.value[0].timestamp);
    
    // Single-pass iteration (O(n) only when dataset size changes)
    for (let i = 1; i < currentLength; i++) {
        const ts = new Date(filteredCustomers.value[i].timestamp);
        if (ts < min) min = ts;
        if (ts > max) max = ts;
    }
    
    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);
    
    cachedDateRange = { start: min, end: max };
    cachedFilteredCustomersLength = currentLength;
    
    return cachedDateRange;
});

// ────────────────────────────────────────────────
// 3. Generate array of date objects (one per day in range)
const dates = computed(() => {
    if (!dateRange.value.start) return [];
    const res = [];
    let cur = new Date(dateRange.value.start);
    while (cur <= dateRange.value.end) {
        res.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return res;
});

// ────────────────────────────────────────────────
// 4. Compute grouped data: VIP level → per-date stats
const SEGMENT_ORDER = ['none', 'normal', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];

const groupedData = computed(() => {
    if (!filteredCustomers.value.length) return [];

    const vipStats = {};

    // Initialize stats for each VIP level
    SEGMENT_ORDER.forEach((vip) => {
        vipStats[vip] = {
            segment: vip.charAt(0).toUpperCase() + vip.slice(1),
            perDate: {}
        };
        dates.value.forEach((date) => {
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            vipStats[vip].perDate[dateKey] = { good: 0, bad: 0, rated: 0 };
        });
    });

    // Aggregate counts
    filteredCustomers.value.forEach((customer) => {
        const vip = (customer.vip_level || 'none').toLowerCase();
        const ts = new Date(customer.timestamp);
        ts.setHours(0, 0, 0, 0);
        const dateKey = ts.toISOString().split('T')[0];

        if (vipStats[vip] && vipStats[vip].perDate[dateKey]) {
            const csat = customer.csat_score?.toLowerCase();
            if (csat === 'good') vipStats[vip].perDate[dateKey].good++;
            if (csat === 'bad') vipStats[vip].perDate[dateKey].bad++;
            if (csat === 'good' || csat === 'bad') vipStats[vip].perDate[dateKey].rated++;
        }
    });

    // Compute CSAT % per cell
    Object.values(vipStats).forEach((group) => {
        Object.keys(group.perDate).forEach((dateKey) => {
            const stats = group.perDate[dateKey];
            stats.csat = stats.rated > 0 ? ((stats.good / stats.rated) * 100).toFixed(2) + '%' : '—';
        });
    });

    // Flatten into rows for DataTable
    const rows = [];
    SEGMENT_ORDER.forEach((vip) => {
        if (vipStats[vip]) {
            const group = vipStats[vip];
            const row = { segment: group.segment };
            dates.value.forEach((date) => {
                const dateKey = date.toISOString().split('T')[0];
                const stats = group.perDate[dateKey];
                row[`good_${dateKey}`] = stats.good;
                row[`bad_${dateKey}`] = stats.bad;
                row[`rated_${dateKey}`] = stats.rated;
                row[`csat_${dateKey}`] = stats.csat;
            });
            rows.push(row);
        }
    });

    // Totals row
    const totalRow = { segment: 'TOTAL' };
    dates.value.forEach((date) => {
        const dateKey = date.toISOString().split('T')[0];
        let totalGood = 0,
            totalBad = 0,
            totalRated = 0;
        Object.values(vipStats).forEach((group) => {
            const stats = group.perDate[dateKey];
            totalGood += stats.good;
            totalBad += stats.bad;
            totalRated += stats.rated;
        });
        totalRow[`good_${dateKey}`] = totalGood;
        totalRow[`bad_${dateKey}`] = totalBad;
        totalRow[`rated_${dateKey}`] = totalRated;
        totalRow[`csat_${dateKey}`] = totalRated > 0 ? ((totalGood / totalRated) * 100).toFixed(2) + '%' : '—';
    });
    rows.push(totalRow);

    return rows;
});

// Format date for header (DD.MM.YYYY)
const formatDateHeader = (date) => {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function getSegmentRowClass(segment) {
    const map = {
        None: 'segment-none',
        Normal: 'segment-normal',
        Bronze: 'segment-bronze',
        Silver: 'segment-silver',
        Gold: 'segment-gold',
        Platinum: 'segment-platinum',
        Diamond: 'segment-diamond',
        TOTAL: 'font-bold bg-gray-200'
    };
    return map[segment] || '';
}
</script>

<template>
    <div class="vip-table card mt-8">
        <div class="font-semibold text-xl mb-4">VIP Customer Segments by Date</div>

        <!-- Info banner -->
        <div class="dt-info-card card mb-8 p-4">
            <p class="inline-block dt-info-p rounded-xl py-2 px-3">
                Aggregated from <strong>{{ tableStore.filteredCustomers?.length || 0 }}</strong> filtered tickets (date range: {{ dateRange.start ? formatDateHeader(dateRange.start) : '—' }} to
                {{ dateRange.end ? formatDateHeader(dateRange.end) : '—' }})
            </p>
        </div>

        <DataTable
            :value="groupedData"
            rowGroupMode="rowspan"
            groupRowsBy="segment"
            sortMode="false"
            sortField="segment"
            :sortOrder="1"
            tableStyle="min-width: 50rem; text-align: center;"
            showGridlines
            responsiveLayout="scroll"
            :pt="{
                table: { class: 'w-full text-sm text-gray-700 dark:text-gray-300' },
                thead: { class: 'bg-gray-100 dark:bg-gray-700' },
                tbody: { class: '' },
                column: { root: { class: 'border-r last:border-r-0' } } // optional per-column tweaks
            }"
        >
            <Column header="Customer Segment" field="segment" :sortable="false" style="min-width: 180px; font-weight: bold; text-align: center; padding: 0">
                <template #body="{ data }">
                    <div :class="getSegmentRowClass(data.segment)" class="p-8 dark:text-[var(--surface-ground)]">{{ data.segment }}</div>
                </template>
            </Column>

            <!-- Dynamic columns – one set per date -->
            <Column v-for="date in dates" :key="date.toISOString()" :header="formatDateHeader(date)" style="min-width: 140px; text-align: center; vertical-align: text-bottom; padding: 0">
                <template #body="{ data }">
                    <div class="grid grid-cols-1 gap-0 text-sm p-0">
                        <div class="border-b border-solid border-(--p-datatable-body-cell-border-color)" :class="data[`csat_${date.toISOString().split('T')[0]}`] !== '—' ? 'bg-yellow-100 dark:text-[var(--surface-ground)]' : ''">
                            CSAT: {{ data[`csat_${date.toISOString().split('T')[0]}`] }}
                        </div>
                        <div class="border-b border-solid border-(--p-datatable-body-cell-border-color)">Good rates: {{ data[`good_${date.toISOString().split('T')[0]}`] }}</div>
                        <div class="border-b border-solid border-(--p-datatable-body-cell-border-color)">Bad rates: {{ data[`bad_${date.toISOString().split('T')[0]}`] }}</div>
                        <div>Rated: {{ data[`rated_${date.toISOString().split('T')[0]}`] }}</div>
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style lang="scss" scoped>
.vip-table {
    :deep(.p-datatable) {
        .p-datatable-thead > tr > th {
            background-color: var(--primary-50);
            color: var(--primary-800);
            font-weight: 600;
            padding: 12px !important;
            border-bottom-color: var(--text-color);
            .p-datatable-column-header-content {
                justify-content: center;
            }
        }

        .p-datatable-tbody > tr:last-child {
            font-weight: bold;
            background: var(--surface-200);
        }

        .p-datatable-tbody > tr > td {
            border-bottom-color: var(--text-color);
        }
    }
}

.segment-normal {
    background-color: #e6ffe6;
}
.segment-bronze {
    background-color: #fff3e0;
}
.segment-silver {
    background-color: #e3f2fd;
}
.segment-gold {
    background-color: #fffde7;
}
.segment-platinum {
    background-color: #f3e5f5;
}
.segment-diamond {
    background-color: #f5f5f5;
}
.segment-none {
    background-color: #fafafa;
}
</style>
