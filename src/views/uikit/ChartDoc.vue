<script setup>
import { useTopicCharts } from '@/composables/useChartAggregations';
import { useLayout } from '@/layout/composables/layout';
import { onMounted, ref, watch } from 'vue';

const { layoutConfig, isDarkTheme } = useLayout();

const { barDataTotalNegative, barDataNegativeOnly, lineDataPercent } = useTopicCharts();

const chartOptions = ref(null);

onMounted(() => setChartOptions());
watch([() => layoutConfig.primary, isDarkTheme], setChartOptions);

function setChartOptions() {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color');
    const textSecondary = style.getPropertyValue('--text-color-secondary');
    const surfaceBorder = style.getPropertyValue('--surface-border');

    chartOptions.value = {
        plugins: {
            legend: { labels: { color: textColor } }
        },
        scales: {
            x: { ticks: { color: textSecondary }, grid: { display: false } },
            y: { ticks: { color: textSecondary }, grid: { color: surfaceBorder } }
        }
    };
}
</script>

<template>
    <div class="card">
        <h2 class="font-semibold text-xl mb-6">Bar Chart – Topics Distribution</h2>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Chart 1: Total + Negative -->
            <div class="col-span-3 lg:col-span-3">
                <h3 class="font-medium text-center mb-3">Number of Chats</h3>
                <Chart type="bar" :data="barDataTotalNegative" :options="chartOptions" />
            </div>

            <!-- Chart 2: Negative only -->
            <div class="col-span-3 lg:col-span-3">
                <h3 class="font-medium text-center mb-3">Negative Chats by Topic</h3>
                <Chart type="bar" :data="barDataNegativeOnly" :options="chartOptions" />
            </div>

            <!-- Chart 3: % Negative (line) -->
            <div class="col-span-3 lg:col-span-3">
                <h3 class="font-medium text-center mb-3">% Negative Chats per Topic</h3>
                <Chart type="line" :data="lineDataPercent" :options="chartOptions" />
            </div>
        </div>

        <p v-if="!barDataTotalNegative.labels?.length" class="text-center text-500 mt-8">No data available after filtering</p>
    </div>
</template>
