<script setup>
import { FilterMatchMode, FilterOperator, FilterService } from '@primevue/core/api';
import { computed, ref, watch } from 'vue';

import { useArrayMultiSelects } from '@/composables/useArrayMultiSelects';
import { useCSVExport } from '@/composables/useCSVExport';

import { useTableStore } from '@/stores/tableStore';

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
const { allChatTags, allTopics, allBrands, allVipLevels, allCustomerEmails, allAgentEmails, fullProcessedTickets } = useArrayMultiSelects(); // full dataset – no param

// ────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────
const dataTable = ref(null);
const loading = ref(false);

// Constants (kept for CSAT & Sentiment – others moved to dynamic)
const csatOptions = ['bad', 'good', 'unoffered'];
const sentimentOptions = ['neutral', 'positive', 'very negative', 'very positive'];

// Filters model – matches all column filterFields
const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    timestamp: {
        operator: FilterOperator.AND,
        constraints: [
            { value: null, matchMode: FilterMatchMode.DATE_AFTER },
            { value: null, matchMode: FilterMatchMode.DATE_BEFORE }
        ]
    },
    ticketid: { value: null, matchMode: FilterMatchMode.EQUALS },
    topic: { value: [], matchMode: 'containsAny' },
    brand: { value: [], matchMode: 'containsAny' },
    vip_level: { value: [], matchMode: 'containsAny' },
    customer_email: { value: [], matchMode: 'containsAny' },
    agent_email: { value: [], matchMode: 'containsAny' },
    csat_score: { value: null, matchMode: FilterMatchMode.EQUALS },
    _chatTagsString: { value: [], matchMode: 'containsAny' },
    chat_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
    email_transcript: { value: null, matchMode: FilterMatchMode.CONTAINS },
    sentiment: { value: null, matchMode: FilterMatchMode.EQUALS },
    summary: { value: null, matchMode: FilterMatchMode.CONTAINS }
});

// Pagination state
const lazyParams = ref({
    page: 1,
    limit: 5
});

// Inline debounce – no dependencies
const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn(...args);
            timer = null;
        }, delay);
    };
};

// ────────────────────────────────────────────────
// Filtered & paginated data (computed – full dataset filtering)
// ────────────────────────────────────────────────
const filteredTickets = computed(() => {
    let data = [...fullProcessedTickets.value];

    // Global search
    if (filters.value.global?.value) {
        const searchLower = filters.value.global.value.toLowerCase();
        data = data.filter((item) => {
            const stringMatch = [
                String(item.ticketid || ''),
                item.topic || '',
                item.brand || '',
                item.vip_level || '',
                item.customer_email || '',
                item.agent_email || '',
                item.csat_score || '',
                item.sentiment || '',
                item.summary || '',
                item.chat_transcript || '',
                item.email_transcript || ''
            ].some((val) => val.toLowerCase().includes(searchLower));

            const tagsMatch = item.chat_tags?.some((tag) => tag.toLowerCase().includes(searchLower)) || false;

            return stringMatch || tagsMatch;
        });
    }

    // Ticket ID – (equals)
    if (filters.value.ticketid?.value != null) {
        const ticketIdFilter = String(filters.value.ticketid.value).trim();
        if (ticketIdFilter) {
            data = data.filter((item) => String(item.ticketid) === ticketIdFilter);
        }
    }

    // Safe array filters
    const safeArray = (arr) => arr ?? [];

    if (safeArray(filters.value.brand?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value.brand.value).includes(item.brand));
    }

    if (safeArray(filters.value.topic?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value.topic.value).some((t) => item.topic?.includes(t)));
    }

    // VIP Level (contains any)
    if (safeArray(filters.value.vip_level?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value.vip_level.value).includes(item.vip_level));
    }

    if (safeArray(filters.value.customer_email?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value.customer_email.value).some((email) => item.customer_email?.toLowerCase().includes(email.toLowerCase())));
    }

    if (safeArray(filters.value.agent_email?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value.agent_email.value).some((email) => item.agent_email?.toLowerCase().includes(email.toLowerCase())));
    }

    if (safeArray(filters.value._chatTagsString?.value).length > 0) {
        data = data.filter((item) => safeArray(filters.value._chatTagsString.value).some((selected) => item.chat_tags?.includes(selected)));
    }

    // Single values
    if (filters.value.csat_score?.value) {
        data = data.filter((item) => item.csat_score === filters.value.csat_score.value);
    }

    // Text contains
    if (filters.value.chat_transcript?.value) {
        const searchLower = filters.value.chat_transcript.value.toLowerCase();
        data = data.filter((item) => item.chat_transcript?.toLowerCase().includes(searchLower));
    }

    if (filters.value.email_transcript?.value) {
        const searchLower = filters.value.email_transcript.value.toLowerCase();
        data = data.filter((item) => item.email_transcript?.toLowerCase().includes(searchLower));
    }

    if (filters.value.summary?.value) {
        const searchLower = filters.value.summary.value.toLowerCase();
        data = data.filter((item) => item.summary?.toLowerCase().includes(searchLower));
    }

    // Sentiment equals
    if (filters.value.sentiment?.value && filters.value.sentiment.value.trim()) {
        const sentimentFilter = filters.value.sentiment.value.trim().toLowerCase();
        data = data.filter((item) => {
            const itemSentiment = item.sentiment?.trim().toLowerCase();
            return itemSentiment === sentimentFilter;
        });
    }

    // Date range
    if (filters.value.timestamp.constraints[0]?.value) {
        const start = new Date(filters.value.timestamp.constraints[0].value);
        data = data.filter((item) => new Date(item.timestamp) >= start);
    }
    if (filters.value.timestamp.constraints[1]?.value) {
        const end = new Date(filters.value.timestamp.constraints[1].value);
        data = data.filter((item) => new Date(item.timestamp) < end);
    }

    return data;
});

const paginatedTickets = computed(() => {
    const start = (lazyParams.value.page - 1) * lazyParams.value.limit;
    return filteredTickets.value.slice(start, start + lazyParams.value.limit);
});

const totalRecords = computed(() => filteredTickets.value.length);

// ────────────────────────────────────────────────
// Watchers
// ────────────────────────────────────────────────

// 1. Debounced page reset when filters change
const debouncedResetPage = debounce(() => {
    lazyParams.value.page = 1;
}, 300);

// Deep watch on all filters – reset page on any change
watch(
    () => filters.value,
    () => debouncedResetPage(),
    { deep: true }
);

// 2. Sync full filtered data to Pinia store (for VipTable & Charts)
watch(
    filteredTickets,
    (newFiltered) => {
        tableStore.setFilteredCustomers(newFiltered);
    },
    { immediate: true }
);

// ────────────────────────────────────────────────
// Export & format
// ────────────────────────────────────────────────
const { exportToCSV } = useCSVExport(dataTable, paginatedTickets, paginatedTickets, formatDate);

function formatDate(value) {
    if (!value || !(value instanceof Date)) return '';
    return value.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ────────────────────────────────────────────────
// Event handlers
// ────────────────────────────────────────────────
function onPage(event) {
    lazyParams.value.page = event.page + 1;
    lazyParams.value.limit = event.rows;
}

function onFilter() {
    lazyParams.value.page = 1;
}

// Quick date presets
const setQuickDateFilter = (period) => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);

    if (period === 'today') start.setHours(0, 0, 0, 0);
    else if (period === 'week') (start.setDate(start.getDate() - 7), start.setHours(0, 0, 0, 0));
    else if (period === 'month') (start.setDate(start.getDate() - 30), start.setHours(0, 0, 0, 0));

    filters.value.timestamp.constraints[0].value = start;
    filters.value.timestamp.constraints[1].value = end;

    lazyParams.value.page = 1;
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
    // Reset global
    filters.value.global.value = null;

    // Reset date constraints completely
    if (filters.value.timestamp?.constraints) {
        filters.value.timestamp.constraints[0].value = null; // From / ≥
        filters.value.timestamp.constraints[1].value = null; // To / <
    } else {
        // Re-init if somehow missing
        filters.value.timestamp = {
            operator: FilterOperator.AND,
            constraints: [
                { value: null, matchMode: FilterMatchMode.DATE_AFTER },
                { value: null, matchMode: FilterMatchMode.DATE_BEFORE }
            ]
        };
    }

    // Reset all other filters
    Object.keys(filters.value).forEach((key) => {
        if (key === 'global' || key === 'timestamp') return; // already handled

        const f = filters.value[key];
        if (f?.constraints) {
            f.constraints.forEach((c) => (c.value = null));
        } else if (Array.isArray(f?.value)) {
            f.value = [];
        } else {
            f.value = null;
        }
    });

    // Reset pagination to page 1
    lazyParams.value.page = 1;
}
</script>

<template>
    <div class="data-table card mt-8">
        <!-- Info card -->
        <div class="dt-info-card card mb-8 p-4">
            <p v-if="paginatedTickets.length > 0">
                Showing <strong>{{ paginatedTickets.length }}</strong> tickets on page {{ lazyParams.page }} (total: <strong>{{ totalRecords }}</strong
                >).
            </p>
            <p v-else>No tickets found on this page.</p>
            <p>Tip: Use filters to narrow results. Export includes current filtered page only.</p>
        </div>

        <div class="font-semibold text-xl mb-4">Filtering & Pagination</div>

        <DataTable
            ref="dataTable"
            :value="paginatedTickets"
            :lazy="true"
            :totalRecords="totalRecords"
            :rows="lazyParams.limit"
            :loading="loading"
            paginator
            :rowsPerPageOptions="[10, 20, 50, 100]"
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
            :paginatorPosition="'both'"
            v-model:filters="filters"
            filterDisplay="menu"
            :globalFilterFields="['ticketid', 'topic', 'brand', 'vip_level', 'customer_email', 'agent_email', 'csat_score', '_chatTagsString', 'chat_transcript', 'email_transcript', 'sentiment', 'summary']"
            :virtualScrollerOptions="{ itemSize: 60 }"
            responsiveLayout="scroll"
            showGridlines
            @page="onPage"
            @filter="onFilter"
        >
            <!-- Header with quick filters, clear, export, global search -->
            <template #header>
                <div class="flex justify-between">
                    <Button type="button" icon="pi pi-filter-slash" label="Clear" outlined @click="clearFilter()" />
                    <div class="flex flex-wrap gap-3 items-center">
                        <!-- Quick date filters -->
                        <div class="flex gap-2">
                            <Button label="Today" icon="pi pi-calendar" outlined size="small" @click="setQuickDateFilter('today')" />
                            <Button label="Last 7 Days" outlined size="small" @click="setQuickDateFilter('week')" />
                            <Button label="Last 30 Days" outlined size="small" @click="setQuickDateFilter('month')" />
                        </div>
                    </div>
                    <Button type="button" icon="pi pi-download" label="Export to CSV" outlined @click="exportToCSV()" />
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

            <Column header="Topic" filterField="topic" :showFilterMatchModes="false" style="min-width: 15rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag :value="data.topic" severity="warn" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="allTopics" placeholder="Any Topic" display="chip" :filter="true" showClear @change="filterCallback()" />
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
                    <MultiSelect v-model="filterModel.value" :options="allBrands" placeholder="Any Brand" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="VIP Level" filterField="vip_level" :showFilterMatchModes="false" style="min-width: 12rem">
                <template #body="{ data }">
                    <div class="flex flex-wrap gap-1">
                        <Tag :value="data.vip_level" severity="info" />
                    </div>
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="allVipLevels" placeholder="Any VIP Level" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="Customer Email" filterField="customer_email" :showFilterMatchModes="false" style="min-width: 18rem">
                <template #body="{ data }">
                    {{ data.customer_email || '-' }}
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="allCustomerEmails" placeholder="Any Customer Email" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="Agent Email" filterField="agent_email" :showFilterMatchModes="false" style="min-width: 18rem">
                <template #body="{ data }">
                    {{ data.agent_email || '-' }}
                </template>
                <template #filter="{ filterModel, filterCallback }">
                    <MultiSelect v-model="filterModel.value" :options="allAgentEmails" placeholder="Any Agent Email" display="chip" :filter="true" showClear @change="filterCallback()" />
                </template>
            </Column>

            <Column header="CSAT Score" field="csat_score" filterField="csat_score" style="min-width: 4rem">
                <template #body="{ data }">
                    <Tag :value="data.csat_score" severity="contrast" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="csatOptions" placeholder="Filter by CSAT" showClear>
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
                    <MultiSelect v-model="filterModel.value" :options="allChatTags" placeholder="Filter by Chat Tags" display="chip" :filter="true" showClear @change="filterCallback()">
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </MultiSelect>
                </template>
            </Column>

            <Column header="Chat Transcript" field="chat_transcript" filterField="chat_transcript" style="min-width: 30rem; max-width: 30rem">
                <template #body="{ data }">
                    <!-- Make this div scrollable + relative positioning -->
                    <div class="transcript-container relative overflow-auto" :style="{ maxHeight: '125px' }">
                        <p class="whitespace-pre-wrap break-words">
                            {{ data.chat_transcript || '—' }}
                        </p>

                        <!-- Scroll to top button appears when scrolled down -->
                        <ScrollTop target="parent" :threshold="100" icon="pi pi-arrow-up" class="custom-scrolltop" />
                    </div>
                </template>

                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Chat Transcript" />
                </template>
            </Column>

            <Column header="Email Transcript" field="email_transcript" filterField="email_transcript" style="min-width: 30rem; max-width: 30rem">
                <template #body="{ data }">
                    <!-- Make this div scrollable + relative positioning -->
                    <div class="transcript-container relative overflow-auto" :style="{ maxHeight: '125px' }">
                        <p class="whitespace-pre-wrap break-words">
                            {{ data.email_transcript || '—' }}
                        </p>

                        <!-- Scroll to top button appears when scrolled down -->
                        <ScrollTop target="parent" :threshold="100" icon="pi pi-arrow-up" class="custom-scrolltop" />
                    </div>
                </template>

                <template #filter="{ filterModel }">
                    <InputText v-model="filterModel.value" type="text" placeholder="Filter by Chat Transcript" />
                </template>
            </Column>

            <Column header="Sentiment" field="sentiment" filterField="sentiment" style="min-width: 4rem">
                <template #body="{ data }">
                    <Tag :value="data.sentiment" severity="help" />
                </template>
                <template #filter="{ filterModel }">
                    <Select v-model="filterModel.value" :options="sentimentOptions" placeholder="Filter by Sentiment" showClear>
                        <template #option="slotProps">
                            <Tag :value="slotProps.option" />
                        </template>
                    </Select>
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
    </div>
</template>

<style lang="scss">
:deep(.p-datatable-frozen-tbody) {
    font-weight: 700;
}

:deep(.p-datatable-scrollable .p-frozen-column) {
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
