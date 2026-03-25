<script setup>
import { defineAsyncComponent } from 'vue';
import StatsWidget from '@/components/StatsWidget.vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();

const TableDoc = defineAsyncComponent(() => import('./uikit/TableDoc.vue'));
const VipTableDoc = defineAsyncComponent(() => import('./uikit/VipTableDoc.vue'));
</script>

<template>
    <!-- Info card -->
    <div class="dt-info-card card mt-16 mb-8 p-4!">
        <p class="inline-block dt-info-p rounded-xl py-2 px-3">
            <span v-if="authStore.user?.displayName" class="text-surface-700 dark:text-surface-200 font-medium text-sm"> Welcome, {{ authStore.user.displayName }}! </span>
        </p>
    </div>
    <div class="grid grid-cols-12 gap-8 mt-8">
        <StatsWidget />
    </div>
    <TableDoc />
    <VipTableDoc />
</template>
