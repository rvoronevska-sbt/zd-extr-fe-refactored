<script setup>
import Logo from '@/components/Logo.vue';
import { useLayout } from '@/layout/composables/layout';
import { useAuthStore } from '@/stores/auth';
import Button from 'primevue/button';
import { nextTick } from 'vue';
import { useRouter } from 'vue-router';

const { toggleDarkMode, isDarkTheme } = useLayout();
const authStore = useAuthStore();
const router = useRouter();

async function handleLogout() {
    try {
        await authStore.logout();

        await nextTick();

        // Preferred: let router handle base path
        router.replace({ name: 'login' });
    } catch (err) {
        console.error('[Logout] Error:', err);

        // Fallback hard redirect if router fails
        window.location.href = `${import.meta.env.BASE_URL}login`;
    }
}
</script>

<template>
    <header class="layout-topbar backdrop-blur-2xl">
        <div class="layout-topbar-logo-container">
            <Logo />
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu flex items-center gap-4">
                <button id="mode-toggle-button" aria-label="Toggle dark/light mode" type="button" class="p-2 rounded-full hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors" @click="toggleDarkMode">
                    <i :class="['pi text-xl', isDarkTheme ? 'pi-moon' : 'pi-sun']"></i>
                </button>

                <div class="layout-topbar-actions relative z-50">
                    <!-- added relative + z-50 -->
                    <div class="layout-config-menu flex items-center gap-4">
                        <!-- Dark mode button unchanged -->

                        <Button
                            id="logout-button"
                            label="Log out"
                            icon="pi pi-sign-out"
                            class="p-button-danger p-button-rounded p-button-raised !pointer-events-auto"
                            @click="handleLogout"
                            severity="danger"
                            :loading="authStore.isLoading"
                            style="z-index: 100"
                        />
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>
