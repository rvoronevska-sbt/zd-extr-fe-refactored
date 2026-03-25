<script setup>
import { useTopicCharts } from '@/composables/useChartAggregations';
import { useLayout } from '@/layout/composables/layout';
import { onBeforeMount, onMounted, ref, watch, computed } from 'vue';

const { layoutConfig, isDarkTheme } = useLayout();

const { barDataTotalNegative, barDataNegativeOnly, lineDataPercent, hasChartData, totalTopicCount } = useTopicCharts();

// Fixed chart area height + space for 45° rotated x-axis labels
const CHART_HEIGHT = 500;
// Width grows with topic count so every bar is visible; minimum 900px
const topicCount = computed(() => barDataTotalNegative.value?.labels?.length ?? 0);
const chartWidth = computed(() => Math.max(900, topicCount.value * 48));

const chartOptions = ref(null);

onBeforeMount(() => setChartOptions());
onMounted(() => setChartOptions());
watch([() => layoutConfig.primary, isDarkTheme], setChartOptions);

function setChartOptions() {
    const style = getComputedStyle(document.documentElement);
    const textColor = style.getPropertyValue('--text-color');
    const textSecondary = style.getPropertyValue('--text-color-secondary');
    const surfaceBorder = style.getPropertyValue('--surface-border');

    chartOptions.value = {
        responsive: false,
        indexAxis: 'x',
        plugins: {
            legend: { labels: { color: textColor } }
        },
        datasets: {
            bar: {
                barThickness: 20,
                maxBarThickness: 28
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textSecondary,
                    maxRotation: 45,
                    minRotation: 45,
                    autoSkip: false
                },
                grid: { color: surfaceBorder }
            },
            y: {
                ticks: { color: textSecondary },
                grid: { color: surfaceBorder }
            }
        }
    };
}
</script>

<template>
    <div class="card pt-2 my-8" v-if="hasChartData">
        <h2 class="font-semibold text-xl mb-6">
            Bar Chart – Topics Distribution
            <span v-if="totalTopicCount > 100" class="text-sm font-normal text-color-secondary ml-2">(top 100 of {{ totalTopicCount }} topics)</span>
        </h2>

        <div v-if="chartOptions" class="grid grid-cols-1 gap-8">
            <!-- Chart 1: Total + Negative -->
            <div>
                <h3 class="font-medium text-center mb-3">Number of Chats</h3>
                <div class="w-full overflow-x-auto">
                    <Chart type="bar" :data="barDataTotalNegative" :options="chartOptions" :width="chartWidth" :height="CHART_HEIGHT" />
                </div>
            </div>

            <!-- Chart 2: Negative only -->
            <div>
                <h3 class="font-medium text-center mb-3">Negative Chats by Topic</h3>
                <div class="w-full overflow-x-auto">
                    <Chart type="bar" :data="barDataNegativeOnly" :options="chartOptions" :width="chartWidth" :height="CHART_HEIGHT" />
                </div>
            </div>

            <!-- Chart 3: % Negative (line) -->
            <div>
                <h3 class="font-medium text-center mb-3">% Negative Chats per Topic</h3>
                <div class="w-full overflow-x-auto">
                    <Chart type="line" :data="lineDataPercent" :options="chartOptions" :width="chartWidth" :height="CHART_HEIGHT" />
                </div>
            </div>
        </div>
    </div>
</template>
