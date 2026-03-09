<script setup>
import { useTableStore } from '@/stores/tableStore';
import { computed } from 'vue';
import { formatDate } from '@/utils/dateUtils';
import { VIP_SEGMENT_ORDER as SEGMENT_ORDER } from '@/config/enums';

const CSAT_HIGH_THRESHOLD = 80; // % — green
const CSAT_MID_THRESHOLD = 50;  // % — yellow; below this is red

const tableStore = useTableStore();

let cachedDateRange = null;
let cachedFilteredTicketsLength = 0;

const filteredTickets = computed(() => tableStore.filteredTickets || []);

const dateRange = computed(() => {
    const currentLength = filteredTickets.value.length;

    if (cachedDateRange !== null && cachedFilteredTicketsLength === currentLength) {
        return cachedDateRange;
    }

    if (!currentLength) {
        cachedDateRange = { start: null, end: null };
        cachedFilteredTicketsLength = currentLength;
        return cachedDateRange;
    }

    let min = new Date(filteredTickets.value[0].timestamp);
    let max = new Date(filteredTickets.value[0].timestamp);

    for (let i = 1; i < currentLength; i++) {
        const ts = new Date(filteredTickets.value[i].timestamp);
        if (ts < min) min = ts;
        if (ts > max) max = ts;
    }

    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);

    cachedDateRange = { start: min, end: max };
    cachedFilteredTicketsLength = currentLength;

    return cachedDateRange;
});

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


function initVipStats(dateKeys) {
    const vipStats = {};
    SEGMENT_ORDER.forEach((vip) => {
        vipStats[vip] = {
            segment: vip.charAt(0).toUpperCase() + vip.slice(1),
            perDate: Object.fromEntries(dateKeys.map((k) => [k, { good: 0, bad: 0, rated: 0 }]))
        };
    });
    return vipStats;
}

function aggregateTickets(vipStats, tickets) {
    tickets.forEach((customer) => {
        const vip = (customer.vip_level || 'none').toLowerCase();
        const ts = new Date(customer.timestamp);
        ts.setHours(0, 0, 0, 0);
        const dateKey = ts.toISOString().split('T')[0];
        const bucket = vipStats[vip]?.perDate[dateKey];
        if (!bucket) return;
        const csat = customer.csat_score?.toLowerCase();
        if (csat === 'good') bucket.good++;
        if (csat === 'bad') bucket.bad++;
        if (csat === 'good' || csat === 'bad') bucket.rated++;
    });
}

function calcCsatPercentages(vipStats) {
    Object.values(vipStats).forEach((group) => {
        Object.values(group.perDate).forEach((stats) => {
            stats.csat = stats.rated > 0 ? ((stats.good / stats.rated) * 100).toFixed(2) + '%' : '—';
        });
    });
}

function buildRows(vipStats, dateValues) {
    return SEGMENT_ORDER.filter((vip) => vipStats[vip]).map((vip) => {
        const group = vipStats[vip];
        const row = { segment: group.segment };
        dateValues.forEach((date) => {
            const dateKey = date.toISOString().split('T')[0];
            const s = group.perDate[dateKey];
            row[`good_${dateKey}`] = s.good;
            row[`bad_${dateKey}`] = s.bad;
            row[`rated_${dateKey}`] = s.rated;
            row[`csat_${dateKey}`] = s.csat;
        });
        return row;
    });
}

function buildTotalsRow(vipStats, dateValues) {
    const totalRow = { segment: 'TOTAL' };
    dateValues.forEach((date) => {
        const dateKey = date.toISOString().split('T')[0];
        let good = 0, bad = 0, rated = 0;
        Object.values(vipStats).forEach((group) => {
            const s = group.perDate[dateKey];
            good += s.good;
            bad += s.bad;
            rated += s.rated;
        });
        totalRow[`good_${dateKey}`] = good;
        totalRow[`bad_${dateKey}`] = bad;
        totalRow[`rated_${dateKey}`] = rated;
        totalRow[`csat_${dateKey}`] = rated > 0 ? ((good / rated) * 100).toFixed(2) + '%' : '—';
    });
    return totalRow;
}

const groupedData = computed(() => {
    if (!filteredTickets.value.length) return [];
    const dateKeys = dates.value.map((d) => d.toISOString().split('T')[0]);
    const vipStats = initVipStats(dateKeys);
    aggregateTickets(vipStats, filteredTickets.value);
    calcCsatPercentages(vipStats);
    const rows = buildRows(vipStats, dates.value);
    rows.push(buildTotalsRow(vipStats, dates.value));
    return rows;
});


function getSegmentRowClass(segment) {
    const map = {
        None: 'segment-none',
        Normal: 'segment-normal',
        Bronze: 'segment-bronze',
        Silver: 'segment-silver',
        Gold: 'segment-gold',
        Platinum: 'segment-platinum',
        Diamond: 'segment-diamond',
        TOTAL: 'segment-total'
    };
    return map[segment] || '';
}

function getCsatClass(csat) {
    if (!csat || csat === '—') return 'csat-none';
    const val = parseFloat(csat);
    if (val >= CSAT_HIGH_THRESHOLD) return 'csat-high';
    if (val >= CSAT_MID_THRESHOLD) return 'csat-mid';
    return 'csat-low';
}
</script>

<template>
    <div class="vip-table card mt-8">
        <!-- Info banner – matches TableDoc pattern -->
        <div class="dt-info-card card mb-6 p-4">
            <p class="inline-block dt-info-p rounded-xl py-2 px-3">
                Aggregated from <strong>{{ tableStore.filteredTickets?.length || 0 }}</strong> filtered tickets &nbsp;·&nbsp; date range: <strong>{{ dateRange.start ? formatDate(dateRange.start) : '—' }}</strong> to
                <strong>{{ dateRange.end ? formatDate(dateRange.end) : '—' }}</strong>
            </p>
        </div>

        <div class="font-semibold text-xl mb-4">VIP Customer Segments by Date</div>

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
                table: { class: 'w-full text-sm' }
            }"
        >
            <!-- Segment column -->
            <Column header="Customer Segment" field="segment" :sortable="false" style="min-width: 160px; padding: 0">
                <template #body="{ data }">
                    <div :class="['segment-cell', getSegmentRowClass(data.segment)]">
                        <span class="segment-dot" :class="'dot-' + data.segment.toLowerCase()"></span>
                        <span class="segment-label">{{ data.segment }}</span>
                    </div>
                </template>
            </Column>

            <!-- Dynamic date columns -->
            <Column v-for="date in dates" :key="date.toISOString()" :header="formatDate(date)" style="min-width: 148px; padding: 0">
                <template #body="{ data }">
                    <div class="date-cell">
                        <!-- CSAT row -->
                        <div class="cell-row csat-row" :class="getCsatClass(data[`csat_${date.toISOString().split('T')[0]}`])">
                            <span class="cell-label">CSAT</span>
                            <span class="cell-value csat-value">{{ data[`csat_${date.toISOString().split('T')[0]}`] }}</span>
                        </div>
                        <!-- Stats rows -->
                        <div class="cell-row">
                            <span class="cell-label good-label">✓ Good</span>
                            <span class="cell-value">{{ data[`good_${date.toISOString().split('T')[0]}`] }}</span>
                        </div>
                        <div class="cell-row">
                            <span class="cell-label bad-label">✗ Bad</span>
                            <span class="cell-value">{{ data[`bad_${date.toISOString().split('T')[0]}`] }}</span>
                        </div>
                        <div class="cell-row rated-row">
                            <span class="cell-label">Rated</span>
                            <span class="cell-value rated-value">{{ data[`rated_${date.toISOString().split('T')[0]}`] }}</span>
                        </div>
                    </div>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style lang="scss" scoped>
/* ── Table wrapper ─────────────────────────────── */
.vip-table {
    :deep(.p-datatable) {
        .p-datatable-thead > tr > th {
            background-color: var(--p-primary-50);
            color: var(--p-primary-800);
            font-weight: 600;
            font-size: 0.8rem;
            letter-spacing: 0.03em;
            padding: 10px 12px !important;
            border-bottom: 2px solid var(--p-primary-200);

            .p-datatable-column-header-content {
                justify-content: center;
            }
        }

        .p-datatable-tbody > tr > td {
            padding: 0 !important;
            vertical-align: top;
            border-color: var(--p-datatable-body-cell-border-color);
        }

        .p-datatable-tbody > tr:last-child {
            > td .segment-cell {
                font-weight: 700;
                background-color: var(--p-surface-200);
                color: var(--p-text-color);
            }
            > td .date-cell {
                background-color: var(--p-surface-100);
            }
        }
    }
}

/* Dark-mode header */
:global(.app-dark) .vip-table :deep(.p-datatable) {
    .p-datatable-thead > tr > th {
        background-color: var(--p-primary-900);
        color: var(--p-primary-100);
        border-bottom-color: var(--p-primary-700);
    }
    .p-datatable-tbody > tr:last-child > td .segment-cell {
        background-color: var(--p-surface-700);
        color: var(--p-text-color);
    }
    .p-datatable-tbody > tr:last-child > td .date-cell {
        background-color: var(--p-surface-800);
    }
}

/* ── Segment column cell ───────────────────────── */
.segment-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    height: 100%;
    font-weight: 600;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    transition: background 0.15s;
}

.segment-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

/* Segment colours – light */
.segment-none {
    background-color: #f8f9fa;
    color: #555;
}
.segment-normal {
    background-color: #e8f5e9;
    color: #2e7d32;
}
.segment-bronze {
    background-color: #fff3e0;
    color: #bf360c;
}
.segment-silver {
    background-color: #e3f2fd;
    color: #1565c0;
}
.segment-gold {
    background-color: #fffde7;
    color: #f57f17;
}
.segment-platinum {
    background-color: #f3e5f5;
    color: #6a1b9a;
}
.segment-diamond {
    background-color: #eceff1;
    color: #263238;
}

.dot-none {
    background-color: #9e9e9e;
}
.dot-normal {
    background-color: #4caf50;
}
.dot-bronze {
    background-color: #bf6030;
}
.dot-silver {
    background-color: #90a4ae;
}
.dot-gold {
    background-color: #ffc107;
}
.dot-platinum {
    background-color: #ab47bc;
}
.dot-diamond {
    background-color: #455a64;
}
.dot-total {
    background-color: var(--p-primary-color);
}

/* Segment colours – dark */
:global(.app-dark) {
    .segment-none {
        background-color: #2a2a2a;
        color: #bbb;
    }
    .segment-normal {
        background-color: #1b3a1c;
        color: #a5d6a7;
    }
    .segment-bronze {
        background-color: #3e2008;
        color: #ffcc80;
    }
    .segment-silver {
        background-color: #0d2a40;
        color: #90caf9;
    }
    .segment-gold {
        background-color: #3a2f00;
        color: #ffe082;
    }
    .segment-platinum {
        background-color: #2a0e33;
        color: #ce93d8;
    }
    .segment-diamond {
        background-color: #1a2a30;
        color: #b0bec5;
    }
}

/* ── Date cell ─────────────────────────────────── */
.date-cell {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.cell-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 12px;
    font-size: 0.78rem;
    border-bottom: 1px solid var(--p-datatable-body-cell-border-color);

    &:last-child {
        border-bottom: none;
    }
}

.cell-label {
    color: var(--p-text-muted-color);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 500;
}

.cell-value {
    font-weight: 600;
    font-size: 0.82rem;
    color: var(--p-text-color);
}

.good-label {
    color: #4caf50;
}
.bad-label {
    color: #f44336;
}

.csat-row {
    padding: 6px 12px;
    border-bottom: 1px solid var(--p-datatable-body-cell-border-color);
}

.csat-value {
    font-size: 0.88rem;
}

.csat-high {
    background-color: rgba(76, 175, 80, 0.1);
    .csat-value {
        color: #2e7d32;
    }
}
.csat-mid {
    background-color: rgba(255, 193, 7, 0.1);
    .csat-value {
        color: #f57f17;
    }
}
.csat-low {
    background-color: rgba(244, 67, 54, 0.1);
    .csat-value {
        color: #c62828;
    }
}
.csat-none {
    .csat-value {
        color: var(--p-text-muted-color);
    }
}

.rated-row {
    background-color: var(--p-surface-50);
}
:global(.app-dark) .rated-row {
    background-color: var(--p-surface-800);
}

:global(.app-dark) {
    .csat-high {
        background-color: rgba(76, 175, 80, 0.18);
        .csat-value {
            color: #81c784;
        }
    }
    .csat-mid {
        background-color: rgba(255, 193, 7, 0.18);
        .csat-value {
            color: #ffd54f;
        }
    }
    .csat-low {
        background-color: rgba(244, 67, 54, 0.18);
        .csat-value {
            color: #e57373;
        }
    }
}
</style>
