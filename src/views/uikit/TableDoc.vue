<script setup>
import { FilterMatchMode, FilterOperator, FilterService } from '@primevue/core/api';
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { useTicketData } from '@/composables/useTicketData';
import { useFacetedFilterOptions } from '@/composables/useFacetedFilterOptions';
import { useCSVExport } from '@/composables/useCSVExport';
import { cleanAndFormatString } from '@/utils/stringUtils';
import { applyTicketFilters } from '@/utils/ticketFilters';
import { formatDate } from '@/utils/dateUtils';
import { debounce } from '@/utils/debounce';

import { useTableStore } from '@/stores/tableStore';

import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const isAdmin = computed(() => authStore.hasRole('admin'));

const maskEmail = (email) => {
    if (!email || email === '-') return '-';
    return '*'.repeat(email.length);
};

const FILTER_DEBOUNCE_MS = 300;
const VIRTUAL_ITEM_SIZE = 44;
const VIRTUAL_SCROLL_DELAY = 200;
const VIRTUAL_NUM_TOLERATED = 10;

const tableStore = useTableStore();

// ────────────────────────────────────────────────
// Custom filter for MultiSelect (contains any)
// ────────────────────────────────────────────────
FilterService.register('containsAny', (value, filter) => {
    if (!filter?.length) return true;
    if (!value) return false;
    const anyInRow = value.split(', ').map((t) => t.trim());
    return filter.some((selected) => anyInRow.includes(selected));
});

// ────────────────────────────────────────────────
// Composables & full data
// ────────────────────────────────────────────────
const { fullProcessedTickets, isLoading, _lazyInit } = useTicketData();

onMounted(() => _lazyInit());

// ────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────
const dataTable = ref(null);

// Default "Today" date range
const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};
const tomorrowStart = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
};

// Factory – called once for init, again on clearFilter to get a fresh object
const createInitialFilters = () => ({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    timestamp: {
        operator: FilterOperator.AND,
        constraints: [
            { value: todayStart(), matchMode: FilterMatchMode.DATE_AFTER },
            { value: tomorrowStart(), matchMode: FilterMatchMode.DATE_BEFORE }
        ]
    },
    ticketid: { value: null, matchMode: FilterMatchMode.EQUALS },
    topic: { value: null, matchMode: FilterMatchMode.CONTAINS },
    brand: { value: [], matchMode: 'containsAny' },
    vip_level: { value: [], matchMode: 'containsAny' },
    customer_email: { value: [], matchMode: 'containsAny' },
    agent_email: { value: [], matchMode: 'containsAny' },
    csat_score: { value: null, matchMode: FilterMatchMode.EQUALS },
    _chatTagsString: { value: [], matchMode: 'containsAny' },
    chat_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
    email_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
    sentiment: { value: null, matchMode: FilterMatchMode.EQUALS },
    sentiment_reason: { value: null, matchMode: FilterMatchMode.CONTAINS },
    summary: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

const filters = ref(createInitialFilters());

// Virtual scroll state
const virtualTickets = ref([]);
const lazyLoading = ref(false);
const loadLazyTimeout = ref();

// Quick date filter active state
const activeQuickFilter = ref('today');

// Dialog state for transcript viewing
const dialog = reactive({ visible: false, type: '', transcript: '', date: null });

const openDialog = (type, transcript, timestamp) => {
    dialog.type = type;
    dialog.transcript = transcript;
    dialog.date = timestamp;
    dialog.visible = true;
};

// ────────────────────────────────────────────────
// Filtered data (computed – full dataset filtering)
// ────────────────────────────────────────────────
const filteredTickets = computed(() =>
    applyTicketFilters(fullProcessedTickets.value, {
        globalFilter: filters.value.global?.value || '',
        ticketid: filters.value.ticketid?.value,
        brand: filters.value.brand?.value ?? [],
        topic: filters.value.topic?.value,
        vip_level: filters.value.vip_level?.value ?? [],
        customer_email: filters.value.customer_email?.value ?? [],
        agent_email: filters.value.agent_email?.value ?? [],
        _chatTagsString: filters.value._chatTagsString?.value ?? [],
        csat_score: filters.value.csat_score?.value,
        sentiment: filters.value.sentiment?.value,
        sentiment_reason: filters.value.sentiment_reason?.value,
        chat_transcript: filters.value.chat_transcript?.value,
        email_transcript: filters.value.email_transcript?.value,
        summary: filters.value.summary?.value,
        startDate: filters.value.timestamp?.constraints?.[0]?.value,
        endDate: filters.value.timestamp?.constraints?.[1]?.value
    })
);

// ────────────────────────────────────────────────
// Faceted multiselect options
// ────────────────────────────────────────────────
const { availableBrands, availableVipLevels, availableCustomerEmails, availableAgentEmails, availableChatTags, availableSentiments, availableCsatScores } = useFacetedFilterOptions(filters, fullProcessedTickets);

const totalRecords = computed(() => filteredTickets.value.length);

const TABLE_HEIGHT_ON_LOADING = 100; // Min height to show skeleton loaders when data is empty/loading
const TABLE_FILTERS_PRIMARY_HEIGHT = 55; // Height of the primary filter row (for scroll calculations)
const TABLE_FILTERS_SECONDARY_HEIGHT = 58; // Height of the secondary filter row (for scroll calculations)
const VIRTUAL_ITEM_HEIGHT = 85; // Estimated pixel height of each row item (for scroll calculations)
const TABLE_MAX_HEIGHT = 500;

const dynamicScrollHeight = computed(() => {
    const contentHeight = TABLE_FILTERS_PRIMARY_HEIGHT + TABLE_FILTERS_SECONDARY_HEIGHT + totalRecords.value * VIRTUAL_ITEM_HEIGHT;
    const dynamicHeight = contentHeight < TABLE_MAX_HEIGHT ? `${contentHeight}px` : `${TABLE_MAX_HEIGHT}px`;
    return isLoading.value ? `${TABLE_HEIGHT_ON_LOADING}px` : dynamicHeight;
});

/**
 * Populate virtualTickets on scroll — mimics lazy-loading from a remote source.
 * Called by PrimeVue's virtual scroller whenever new rows enter the viewport.
 */
function loadTicketsLazy(event) {
    !lazyLoading.value && (lazyLoading.value = true);

    if (loadLazyTimeout.value) {
        clearTimeout(loadLazyTimeout.value);
    }

    loadLazyTimeout.value = setTimeout(() => {
        const { first, last } = event;
        const loadedChunk = filteredTickets.value.slice(first, last);
        const _virtual = [...virtualTickets.value];

        Array.prototype.splice.apply(_virtual, [first, last - first, ...loadedChunk]);

        virtualTickets.value = _virtual;
        lazyLoading.value = false;
    }, VIRTUAL_SCROLL_DELAY);
}

// ────────────────────────────────────────────────
// Watchers
// ────────────────────────────────────────────────

// Sync full filtered data to Pinia store (for VipTable & Charts)
//    and reset the virtual array so the scroller knows the new length.
//    Debounced to avoid thrashing on rapid keystroke filter input.
const syncFilteredData = debounce((filtered) => {
    tableStore.setFilteredTickets(filtered);

    // Reset virtual array and eagerly fill the first visible chunk
    // so rows are never empty after a filter change or clear
    const arr = new Array(filtered.length).fill(null);
    const initialChunk = Math.min(filtered.length, VIRTUAL_NUM_TOLERATED * 3);
    for (let i = 0; i < initialChunk; i++) {
        arr[i] = filtered[i];
    }
    virtualTickets.value = arr;
}, FILTER_DEBOUNCE_MS);

watch(filteredTickets, (newFiltered) => syncFilteredData(newFiltered), { immediate: true });

// ────────────────────────────────────────────────
// Export & format
// ────────────────────────────────────────────────
const { exportToCSV } = useCSVExport(dataTable, filteredTickets, formatDate);

// ────────────────────────────────────────────────
// Event handlers
// ────────────────────────────────────────────────

// Debounced wrapper for MultiSelect @change — prevents 5× recompute when
// selecting 5 items in rapid succession (each selection triggers filterCallback)
const debouncedFilterCallback = debounce((cb) => cb(), FILTER_DEBOUNCE_MS);

/**
 * Apply quick date filter presets (Today, Last 7 Days, Last 30 Days).
 * @param {string} period - Period key: 'today', 'week', or 'month'
 */
const setQuickDateFilter = (period) => {
    // Toggle off if clicking the already-active filter
    if (activeQuickFilter.value === period) {
        activeQuickFilter.value = null;
        if (filters.value?.timestamp?.constraints) {
            filters.value.timestamp.constraints[0].value = null;
            filters.value.timestamp.constraints[1].value = null;
        }
        return;
    }

    activeQuickFilter.value = period;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);

    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === 'week') (start.setDate(start.getDate() - 7), start.setHours(0, 0, 0, 0));
    else if (period === 'month') (start.setDate(start.getDate() - 30), start.setHours(0, 0, 0, 0));
    else if (period === '2 months') (start.setDate(start.getDate() - 60), start.setHours(0, 0, 0, 0));
    else if (period === '3 months') (start.setDate(start.getDate() - 90), start.setHours(0, 0, 0, 0));

    // Safely set date constraints
    if (filters.value?.timestamp?.constraints) {
        filters.value.timestamp.constraints[0].value = start;
        filters.value.timestamp.constraints[1].value = end;
    }
};

const fromDate = computed({
    get: () => filters.value.timestamp?.constraints?.[0]?.value ?? null,
    set: (val) => {
        if (filters.value.timestamp?.constraints?.[0]) filters.value.timestamp.constraints[0].value = val;
    }
});

const toDate = computed({
    get: () => filters.value.timestamp?.constraints?.[1]?.value ?? null,
    set: (val) => {
        if (filters.value.timestamp?.constraints?.[1]) filters.value.timestamp.constraints[1].value = val;
    }
});

function clearFilter() {
    filters.value = createInitialFilters();
    // Reset date constraints to null (createInitialFilters defaults to "today")
    filters.value.timestamp.constraints[0].value = null;
    filters.value.timestamp.constraints[1].value = null;
    activeQuickFilter.value = null;
}
</script>

<template>
    <div class="data-table card mt-8 mb-8">
        <!-- Info card -->
        <div class="dt-info-card card mb-8 p-4!">
            <p class="inline-block dt-info-p rounded-xl py-2 px-3 m-0!" v-if="totalRecords > 0">
                Showing <strong>{{ totalRecords }}</strong> filtered tickets.
            </p>
            <p class="inline-block dt-info-p rounded-xl py-2 px-3 m-0!" v-else>No tickets found.</p>
            <p class="inline-block p-tag-info rounded-xl py-2 px-3 mb-0! ml-2!" v-if="totalRecords > 0">Tip: Use filters to narrow results. Export includes all filtered results.</p>
        </div>

        <DataTable
            ref="dataTable"
            :value="virtualTickets"
            :loading="isLoading"
            scrollable
            :scrollHeight="dynamicScrollHeight"
            :virtualScrollerOptions="{ lazy: true, onLazyLoad: loadTicketsLazy, itemSize: VIRTUAL_ITEM_SIZE, delay: VIRTUAL_SCROLL_DELAY, showLoader: true, loading: lazyLoading, numToleratedItems: VIRTUAL_NUM_TOLERATED }"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['ticketid', 'topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', '_chatTagsString', 'chat_transcript', 'email_transcript', 'sentiment', 'sentiment_reason', 'summary']"
            showGridlines
        >
            <!-- Header with quick filters, clear, export, global search -->
            <template #header>
                <div class="flex justify-between">
                    <Button type="button" icon="pi pi-filter-slash" label="Clear all filters" outlined @click="clearFilter()" aria-label="Clear all filters" />
                    <div class="flex flex-wrap gap-3 items-center">
                        <!-- Quick date filters -->
                        <div class="flex gap-2">
                            <Button label="Today" icon="pi pi-calendar" :outlined="activeQuickFilter !== 'today'" size="small" @click="setQuickDateFilter('today')" aria-label="Filter by today" />
                            <Button label="Last 7 Days" :outlined="activeQuickFilter !== 'week'" size="small" @click="setQuickDateFilter('week')" aria-label="Filter by last 7 days" />
                            <Button label="Last 30 Days" :outlined="activeQuickFilter !== 'month'" size="small" @click="setQuickDateFilter('month')" aria-label="Filter by last 30 days" />
                            <Button label="Last 2 Months" :outlined="activeQuickFilter !== '2 months'" size="small" @click="setQuickDateFilter('2 months')" aria-label="Filter by last 2 months" />
                            <Button label="Last 3 Months" :outlined="activeQuickFilter !== '3 months'" size="small" @click="setQuickDateFilter('3 months')" aria-label="Filter by last 3 months" />
                        </div>
                    </div>
                    <Button type="button" icon="pi pi-download" label="Export to CSV" outlined @click="exportToCSV()" aria-label="Export filtered results to CSV" />
                    <IconField>
                        <InputIcon>
                            <i class="pi pi-search" />
                        </InputIcon>
                        <InputText name="global-search" v-model="filters.global.value" placeholder="Global Search" />
                    </IconField>
                </div>
            </template>

            <template #empty>No tickets found.</template>
            <template #loading>Loading tickets... Please wait.</template>

            <Column header="Date" filterField="timestamp" dataType="date" filterMenuClass="my-date-filter-menu" style="min-width: 10rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ formatDate(data.timestamp) }}</template>
                </template>
                <template #filter="{ filterModel }">
                    <div class="flex flex-col sm:flex-row gap-2 p-2">
                        <DatePicker v-model="fromDate" placeholder="From (≥)" dateFormat="mm/dd/yy" showIcon />
                        <DatePicker v-model="toDate" placeholder="To (<)" dateFormat="mm/dd/yy" showIcon />
                    </div>
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="60%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Topic" filterField="topic" style="min-width: 15rem; height: 44px">
                <template #body="{ data }">
                    <div v-if="data" class="flex flex-wrap gap-1">
                        <Tag :value="data.topic" severity="warn" />
                    </div>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Topic" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="70%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Ticket ID" field="ticketid" filterField="ticketid" style="min-width: 10rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ data.ticketid }}</template>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Ticket ID" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="50%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Brand" filterField="brand" :showFilterMatchModes="false" style="min-width: 10rem; height: 44px">
                <template #body="{ data }">
                    <div v-if="data" class="flex flex-wrap gap-1">
                        <Tag :value="data.brand" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableBrands" placeholder="Any Brand" display="chip" :filter="true" showClear @change="debouncedFilterCallback(filterCallback)" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="40%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="VIP Level" filterField="vip_level" :showFilterMatchModes="false" style="min-width: 12rem; height: 44px">
                <template #body="{ data }">
                    <div v-if="data" class="flex flex-wrap gap-1">
                        <Tag :value="data.vip_level" severity="info" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableVipLevels" placeholder="Any VIP Level" display="chip" :filter="true" showClear @change="debouncedFilterCallback(filterCallback)" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="50%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Customer Email" filterField="customer_email" :showFilterMatchModes="false" style="min-width: 18rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ isAdmin ? data.customer_email || '-' : maskEmail(data.customer_email) }}</template>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableCustomerEmails" placeholder="Any Customer Email" display="chip" :filter="true" showClear @change="debouncedFilterCallback(filterCallback)" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="60%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Agent Email" filterField="agent_email" :showFilterMatchModes="false" style="min-width: 18rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ data.agent_email || '-' }}</template>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableAgentEmails" placeholder="Any Agent Email" display="chip" :filter="true" showClear @change="debouncedFilterCallback(filterCallback)" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="60%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="CSAT Score" field="csat_score" filterField="csat_score" style="min-width: 12rem; height: 44px">
                <template #body="{ data }">
                    <Tag v-if="data" :value="data.csat_score" severity="contrast" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="availableCsatScores" placeholder="Filter by CSAT Score" showClear>
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </Select>
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="30%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Chat Tags" filterField="_chatTagsString" :showFilterMatchModes="false" style="min-width: 30rem; height: 44px">
                <template #body="{ data }">
                    <div v-if="data" class="flex flex-wrap gap-1">
                        <Tag v-for="tag in data.chat_tags" :key="tag" :value="tag" severity="secondary" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableChatTags" placeholder="Filter by Chat Tags" display="chip" :filter="true" showClear @change="debouncedFilterCallback(filterCallback)">
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </MultiSelect>
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="80%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Chat Transcript" field="chat_transcript" filterField="chat_transcript" style="min-width: 12rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">
                        <Button v-if="data.chat_transcript" label="View" icon="pi pi-external-link" @click="openDialog('Chat', data.chat_transcript, data.timestamp)" size="small" severity="info" rounded aria-label="View chat transcript" />
                        <span v-else>—</span>
                    </template>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Chat Transcript" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="40%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Email Transcript" field="email_transcript" filterField="email_transcript" style="min-width: 13rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">
                        <Button v-if="data.email_transcript" label="View" icon="pi pi-external-link" @click="openDialog('Email', data.email_transcript, data.timestamp)" size="small" severity="info" rounded aria-label="View email transcript" />
                        <span v-else>—</span>
                    </template>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Email Transcript" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="40%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Sentiment" field="sentiment" filterField="sentiment" style="min-width: 4rem; height: 44px">
                <template #body="{ data }">
                    <Tag v-if="data" :value="data.sentiment" severity="help" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="availableSentiments" placeholder="Filter by Sentiment" showClear>
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </Select>
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="40%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Sentiment Reason" field="sentiment_reason" filterField="sentiment_reason" style="min-width: 14rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ data.sentiment_reason }}</template>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Sentiment Reason" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="70%" height="1rem" />
                    </div>
                </template>
            </Column>

            <Column header="Summary" field="summary" filterField="summary" style="min-width: 45rem; height: 44px">
                <template #body="{ data }">
                    <template v-if="data">{{ data.summary }}</template>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Summary" />
                </template>
                <template #loading>
                    <div class="flex items-center" style="height: 17px; flex-grow: 1; overflow: hidden">
                        <Skeleton width="90%" height="1rem" />
                    </div>
                </template>
            </Column>
        </DataTable>

        <!-- Transcript Dialog (chat & email) -->
        <Dialog
            v-model:visible="dialog.visible"
            :header="`${dialog.type} Transcript - ${formatDate(dialog.date)}`"
            :style="{ width: '75vw' }"
            maximizable
            modal
            :contentStyle="{ maxHeight: '400px', overflowY: 'auto' }"
            :aria-label="`${dialog.type} transcript viewer`"
        >
            <div class="space-y-3">
                <div class="text-xs text-gray-500 dark:text-gray-400 px-4 pt-2 font-semibold tracking-wide">Ticket Date: {{ formatDate(dialog.date) }}</div>
                <div class="whitespace-pre-wrap break-words text-sm p-4 bg-surface-50 dark:bg-surface-950 rounded font-mono">
                    {{ cleanAndFormatString(dialog.transcript) }}
                </div>
            </div>
            <template #footer>
                <Button label="Close" icon="pi pi-check" @click="dialog.visible = false" :aria-label="`Close ${dialog.type.toLowerCase()} transcript dialog`" />
            </template>
        </Dialog>
    </div>
</template>

<style lang="scss">
.p-datatable-mask.p-overlay-mask {
    background-color: var(--p-surface-100) !important;
    color: var(--text-color);
}

.app-dark .p-datatable-mask.p-overlay-mask {
    background-color: var(--p-surface-950) !important;
}

.p-datatable-frozen-tbody {
    font-weight: 700;
}

.p-datatable-scrollable .p-frozen-column {
    font-weight: 700;
}

/* Scoped or global */
.my-date-filter-menu {
    /* Example: make it wider */
    width: 320px !important;

    /* Optional: hide extra rule wrappers if PrimeVue still renders them */
    .p-datatable-filter-rule-list > .p-datatable-filter-rule > *:not(.flex):not(.p-datatable-filter-buttonbar) {
        display: none !important;
    }

    /* Hide the second DatePicker in the first rule ("To" in "after") */
    .p-datatable-filter-rule:nth-child(1) .p-datepicker:nth-child(2) {
        display: none !important;
    }

    /* Hide the first DatePicker in the second rule ("From" in "before") */
    .p-datatable-filter-rule:nth-child(2) .p-datepicker:nth-child(1) {
        display: none !important;
    }
}
</style>
