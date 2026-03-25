import { computed } from 'vue';
import { applyTicketFilters } from '@/utils/ticketFilters';

/**
 * Derives faceted multiselect options from the full ticket dataset.
 * Each available* computed applies all active filters EXCEPT its own field,
 * so the dropdown only shows values that exist in the currently narrowed data.
 *
 * Performance: base-filtered dataset is computed once, then each facet
 * only applies the other multiselects (not the full filter pipeline again).
 *
 * @param {Ref<Object>} filters  - The filters ref from TableDoc
 * @param {Ref<Array>}  tickets  - fullProcessedTickets from useTicketData
 */
export function useFacetedFilterOptions(filters, tickets) {
    // All non-multiselect filter params (date, text, single-select)
    const baseFilterParams = computed(() => ({
        globalFilter: filters.value.global?.value || '',
        ticketid: filters.value.ticketid?.value,
        topic: filters.value.topic?.value,
        csat_score: filters.value.csat_score?.value,
        sentiment: filters.value.sentiment?.value,
        sentiment_reason: filters.value.sentiment_reason?.value,
        chat_transcript: filters.value.chat_transcript?.value,
        email_transcript: filters.value.email_transcript?.value,
        summary: filters.value.summary?.value,
        startDate: filters.value.timestamp?.constraints?.[0]?.value,
        endDate: filters.value.timestamp?.constraints?.[1]?.value
    }));

    // All currently active multiselect values
    const activeMultiselects = computed(() => ({
        brand: filters.value.brand?.value ?? [],
        vip_level: filters.value.vip_level?.value ?? [],
        customer_email: filters.value.customer_email?.value ?? [],
        agent_email: filters.value.agent_email?.value ?? [],
        _chatTagsString: filters.value._chatTagsString?.value ?? []
    }));

    // Step 1: Apply base (non-multiselect) filters once — shared by all facets
    const baseFiltered = computed(() => applyTicketFilters(tickets.value, baseFilterParams.value));

    // Step 2: For each facet, apply only the OTHER multiselects, then extract unique values
    function facetedOptions(excludeField, extractFn, clearValue = []) {
        const multiselectParams = { ...activeMultiselects.value, [excludeField]: clearValue };
        const subset = applyTicketFilters(baseFiltered.value, multiselectParams);
        const values = subset.flatMap(extractFn).filter(Boolean);
        return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    const availableBrands = computed(() => facetedOptions('brand', (t) => [t.brand]));
    const availableVipLevels = computed(() => facetedOptions('vip_level', (t) => [t.vip_level]));
    const availableCustomerEmails = computed(() => facetedOptions('customer_email', (t) => [t.customer_email]));
    const availableAgentEmails = computed(() => facetedOptions('agent_email', (t) => [t.agent_email]));
    const availableChatTags = computed(() => facetedOptions('_chatTagsString', (t) => t.chat_tags ?? []));
    const availableSentiments = computed(() => facetedOptions('sentiment', (t) => [t.sentiment], null));
    const availableCsatScores = computed(() => facetedOptions('csat_score', (t) => [t.csat_score], null));

    return {
        availableBrands,
        availableVipLevels,
        availableCustomerEmails,
        availableAgentEmails,
        availableChatTags,
        availableSentiments,
        availableCsatScores
    };
}
