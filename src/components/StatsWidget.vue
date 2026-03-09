<script setup>
import { useArrayMultiSelects } from '@/composables/useArrayMultiSelects';
import { computed } from 'vue';
import { VIP_TIERS } from '@/config/enums';

const { fullProcessedTickets } = useArrayMultiSelects();

const stats = computed(() => {
    let csatGood = 0,
        csatBad = 0;
    let negSentiment = 0,
        veryNegSentiment = 0;
    let unratedTickets = 0;
    let vipPlatinum = 0,
        vipGold = 0,
        vipOther = 0;
    let complianceOk = 0,
        complianceIssue = 0,
        complianceMissing = 0;
    const brandSet = new Set();
    const vipLevels = new Set(VIP_TIERS);

    for (const t of fullProcessedTickets.value) {
        const csat = t.csat_score?.toLowerCase();
        const sentiment = t.sentiment?.toLowerCase();
        const vip = t.vip_level?.toLowerCase();
        const summary = t.summary || '';

        if (csat === 'good') csatGood++;
        else if (csat === 'bad') csatBad++;
        else if (csat === 'unoffered') unratedTickets++;

        if (sentiment === 'negative') negSentiment++;
        else if (sentiment === 'very negative') veryNegSentiment++;

        if (t.brand && t.brand !== 'none') brandSet.add(t.brand);

        if (vipLevels.has(vip)) {
            if (vip === 'platinum' || vip === 'diamond') vipPlatinum++;
            else if (vip === 'gold') vipGold++;
            else vipOther++;
        }

        if (/compliance[:\s]+ok/i.test(summary)) complianceOk++;
        else if (/compliance[:\s]+issue/i.test(summary)) complianceIssue++;
        if (!/compliance/i.test(summary)) complianceMissing++;
    }

    const totalTickets = fullProcessedTickets.value.length;
    const ratedTickets = csatGood + csatBad;
    const pctCsat = ratedTickets > 0 ? ((csatGood / ratedTickets) * 100).toFixed(1) : '0';
    const pctSentiment = totalTickets > 0 ? (((negSentiment + veryNegSentiment) / totalTickets) * 100).toFixed(1) : '0';
    const pctUnratedTickets = totalTickets > 0 ? ((unratedTickets / totalTickets) * 100).toFixed(1) : '0';
    const pctComplianceOk = totalTickets > 0 ? ((complianceOk / totalTickets) * 100).toFixed(1) : '0';
    const vipTotal = vipPlatinum + vipGold + vipOther;
    const vipPrimaryDetails = `${vipPlatinum} platinum/diamond`;
    const vipSecondaryDetails = `· ${vipGold} gold`;

    return [
        { title: 'Total Tickets', icon: 'pi pi-ticket', color: 'primary', summaryValue: totalTickets, primaryDetails: totalTickets, secondaryDetails: 'tickets in total' },
        { title: 'CSAT Score', icon: 'pi pi-star', color: 'yellow-500', summaryValue: pctCsat + '%', primaryDetails: `${csatGood} good`, secondaryDetails: `· ${csatBad} bad rated` },
        {
            title: 'Negative Sentiment',
            icon: 'pi pi-face-smile',
            color: 'red-500',
            summaryValue: pctSentiment + '%',
            primaryDetails: `${veryNegSentiment} very negative`,
            secondaryDetails: `· ${negSentiment} negative`
        },
        { title: 'Unrated Tickets', icon: 'pi pi-minus-circle', color: 'gray-500', summaryValue: unratedTickets, primaryDetails: unratedTickets, secondaryDetails: `${pctUnratedTickets}% of all tickets unoffered` },
        { title: 'Active Brands', icon: 'pi pi-building', color: 'blue-500', summaryValue: brandSet.size, primaryDetails: brandSet.size, secondaryDetails: 'brands across all tickets' },
        { title: 'VIP Tickets', icon: 'pi pi-crown', color: 'purple-500', summaryValue: vipTotal, primaryDetails: vipPrimaryDetails, secondaryDetails: vipSecondaryDetails },
        { title: 'Compliance OK', icon: 'pi pi-check-circle', color: 'green-500', summaryValue: complianceOk, primaryDetails: `${pctComplianceOk}%`, secondaryDetails: 'of all tickets compliant' },
        {
            title: 'Compliance Issues',
            icon: 'pi pi-exclamation-triangle',
            color: 'orange-500',
            summaryValue: complianceIssue,
            primaryDetails: `${complianceMissing} missing`,
            secondaryDetails: 'no compliance data'
        }
    ];
});
</script>

<template>
    <div class="col-span-12 lg:col-span-6 xl:col-span-3" v-for="stat in stats" :key="stat.title">
        <div class="stats-widget-cards card mb-0">
            <div class="flex justify-between mb-4">
                <div>
                    <span class="stats-title block text-muted-color font-medium mb-4">{{ stat.title }}</span>
                    <div class="text-surface-900 dark:text-surface-0 font-medium text-xl">
                        {{ stat.summaryValue }}
                    </div>
                </div>
                <div class="stats-icon-box flex items-center justify-center rounded-border w-10 h-10">
                    <i :class="stat.icon" class="text-xl"></i>
                </div>
            </div>
            <span class="text-primary font-medium">{{ stat.primaryDetails }}</span>
            <span class="text-muted-color ml-2">{{ stat.secondaryDetails }}</span>
        </div>
    </div>
</template>
