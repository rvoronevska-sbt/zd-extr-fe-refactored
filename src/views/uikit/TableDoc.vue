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

const PAGE_SIZE_DEFAULT = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];
const FILTER_DEBOUNCE_MS = 500;

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

// Pagination state
const lazyParams = ref({
    page: 1,
    limit: PAGE_SIZE_DEFAULT
});

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
// Filtered & paginated data (computed – full dataset filtering)
// ────────────────────────────────────────────────
const filteredTickets = computed(() =>
    applyTicketFilters([...fullProcessedTickets.value], {
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

const paginatedTickets = computed(() => {
    const start = (lazyParams.value.page - 1) * lazyParams.value.limit;
    return filteredTickets.value.slice(start, start + lazyParams.value.limit);
});

const totalRecords = computed(() => filteredTickets.value.length);

// ────────────────────────────────────────────────
// Watchers
// ────────────────────────────────────────────────

// 1. Debounced page reset when filters change (increased to 500ms for better UX)
const debouncedResetPage = debounce(() => {
    lazyParams.value.page = 1;
}, FILTER_DEBOUNCE_MS);

// Deep watch on all filters – reset page on any change
// Note: Deep watching is necessary here since filters contain nested objects
watch(
    () => filters.value,
    () => debouncedResetPage(),
    { deep: true }
);

// 2. Sync full filtered data to Pinia store (for VipTable & Charts)
watch(
    filteredTickets,
    (newFiltered) => {
        tableStore.setFilteredTickets(newFiltered);
    },
    { immediate: true }
);

// ────────────────────────────────────────────────
// Export & format
// ────────────────────────────────────────────────
const { exportToCSV } = useCSVExport(dataTable, filteredTickets, formatDate);

// ────────────────────────────────────────────────
// Event handlers
// ────────────────────────────────────────────────

/**
 * Handle pagination changes from DataTable.
 * @param {Object} event - Pagination event with page and rows info
 */
function onPage(event) {
    if (lazyParams.value) {
        lazyParams.value.page = event?.page ? event.page + 1 : 1;
        lazyParams.value.limit = event?.rows || 5;
    }
}

/**
 * Handle filter changes - reset pagination to page 1.
 */
function onFilter() {
    if (lazyParams.value) {
        lazyParams.value.page = 1;
    }
}

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

    if (lazyParams.value) {
        lazyParams.value.page = 1;
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
    lazyParams.value.page = 1;
    lazyParams.value.limit = PAGE_SIZE_DEFAULT;
}
</script>

<template>
    <div class="data-table card mt-8">
        <!-- Info card -->
        <div class="dt-info-card card mb-8 p-4">
            <p class="inline-block dt-info-p rounded-xl py-2 px-3" v-if="paginatedTickets.length > 0">
                Showing <strong>{{ paginatedTickets.length }}</strong> tickets on page {{ lazyParams.page }} (total: <strong>{{ totalRecords }}</strong
                >).
            </p>
            <p class="inline-block dt-info-p rounded-xl py-2 px-3" v-else>No tickets found on this page.</p>
            <p>Tip: Use filters to narrow results. Export includes current filtered page only.</p>
        </div>

        <div class="font-semibold text-xl mb-4">Filtering & Pagination</div>

        <DataTable
            ref="dataTable"
            :value="paginatedTickets"
            :lazy="true"
            :totalRecords="totalRecords"
            :rows="lazyParams.limit"
            :loading="isLoading"
            paginator
            :rowsPerPageOptions="PAGE_SIZE_OPTIONS"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
            :paginatorPosition="'both'"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['ticketid', 'topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', '_chatTagsString', 'chat_transcript', 'email_transcript', 'sentiment', 'sentiment_reason', 'summary']"
            responsiveLayout="scroll"
            showGridlines
            @page="onPage"
            @filter="onFilter"
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

            <Column header="Date" filterField="timestamp" dataType="date" filterMenuClass="my-date-filter-menu" style="min-width: 10rem">
                <template #body="{ data }">
                    {{ formatDate(data.timestamp) }}
                </template>
                <template #filter="{ filterModel }">
                    <div class="flex flex-col sm:flex-row gap-2 p-2">
                        <DatePicker v-model="fromDate" placeholder="From (≥)" dateFormat="mm/dd/yy" showIcon />
                        <DatePicker v-model="toDate" placeholder="To (<)" dateFormat="mm/dd/yy" showIcon />
                    </div>
                </template>
            </Column>

            <Column header="Topic" filterField="topic" style="min-width: 15rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag :value="data.topic" severity="warn" />
                    </div>
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Topic" />
                </template>
            </Column>

            <Column header="Ticket ID" field="ticketid" filterField="ticketid" style="min-width: 10rem">
                <template #body="{ data }">
                    {{ data.ticketid }}
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Ticket ID" />
                </template>
            </Column>

            <Column header="Brand" filterField="brand" :showFilterMatchModes="false" style="min-width: 10rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag :value="data.brand" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableBrands" placeholder="Any Brand" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="VIP Level" filterField="vip_level" :showFilterMatchModes="false" style="min-width: 12rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag :value="data.vip_level" severity="info" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableVipLevels" placeholder="Any VIP Level" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="Customer Email" filterField="customer_email" :showFilterMatchModes="false" style="min-width: 18rem">
                <template #body="{ data }">
                    {{ isAdmin ? data.customer_email || '-' : maskEmail(data.customer_email) }}
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableCustomerEmails" placeholder="Any Customer Email" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="Agent Email" filterField="agent_email" :showFilterMatchModes="false" style="min-width: 18rem">
                <template #body="{ data }">
                    {{ data.agent_email || '-' }}
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableAgentEmails" placeholder="Any Agent Email" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="CSAT Score" field="csat_score" filterField="csat_score" style="min-width: 4rem">
                <template #body="{ data }">
                    <Tag :value="data.csat_score" severity="contrast" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="availableCsatScores" placeholder="Filter by CSAT Score" showClear>
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </Select>
                </template>
            </Column>

            <Column header="Chat Tags" filterField="_chatTagsString" :showFilterMatchModes="false" style="min-width: 30rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag v-for="tag in data.chat_tags" :key="tag" :value="tag" severity="secondary" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="availableChatTags" placeholder="Filter by Chat Tags" display="chip" :filter="true" showClear @change="filterCallback()">
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </MultiSelect>
                </template>
            </Column>

            <Column header="Chat Transcript" field="chat_transcript" filterField="chat_transcript" style="min-width: 12rem">
                <template #body="{ data }">
                    <Button v-if="data.chat_transcript" label="View" icon="pi pi-external-link" @click="openDialog('Chat', data.chat_transcript, data.timestamp)" size="small" severity="info" rounded aria-label="View chat transcript" />
                    <span v-else>—</span>
                </template>

                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Chat Transcript" />
                </template>
            </Column>

            <Column header="Email Transcript" field="email_transcript" filterField="email_transcript" style="min-width: 13rem">
                <template #body="{ data }">
                    <Button v-if="data.email_transcript" label="View" icon="pi pi-external-link" @click="openDialog('Email', data.email_transcript, data.timestamp)" size="small" severity="info" rounded aria-label="View email transcript" />
                    <span v-else>—</span>
                </template>

                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Email Transcript" />
                </template>
            </Column>

            <Column header="Sentiment" field="sentiment" filterField="sentiment" style="min-width: 4rem">
                <template #body="{ data }">
                    <Tag :value="data.sentiment" severity="help" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="availableSentiments" placeholder="Filter by Sentiment" showClear>
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </Select>
                </template>
            </Column>

            <Column header="Sentiment Reason" field="sentiment_reason" filterField="sentiment_reason" style="min-width: 14rem">
                <template #body="{ data }">
                    {{ data.sentiment_reason }}
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Sentiment Reason" />
                </template>
            </Column>

            <Column header="Summary" field="summary" filterField="summary" style="min-width: 25rem">
                <template #body="{ data }">
                    {{ data.summary }}
                </template>
                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Summary" />
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
