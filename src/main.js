import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from './App.vue';
import router from './router';

import Aura from '@primeuix/themes/aura';
import PrimeVue from 'primevue/config';
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';

import { useAuthStore } from '@/stores/auth';

import '@/assets/tailwind.css';
import '@/assets/styles.scss';

import primeiconsFontUrl from 'primeicons/fonts/primeicons.woff2?url';

import { useArrayMultiSelects } from '@/composables/useArrayMultiSelects';

const app = createApp(App);

const pinia = createPinia();
app.use(pinia);

app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark'
        }
    },
    locale: {
        matchAll: 'Match All (AND)', // instead of "Match All"
        matchAny: 'Match Any (OR)' // instead of "Match Any"
        // addRule: 'Add another condition',
        // removeRule: 'Remove condition',
        // clear: 'Reset',
        // apply: 'Filter'
    }
});

app.use(ToastService);
app.use(ConfirmationService);

const authStore = useAuthStore();
authStore.initializeAuth();

const { _lazyInit } = useArrayMultiSelects();
_lazyInit(); // fire-and-forget — loads data in the background

// ── Preload PrimeIcons font early ─────────────────────────────────
const preloadLink = document.createElement('link');
preloadLink.rel = 'preload';
preloadLink.as = 'font';
preloadLink.type = 'font/woff2';
preloadLink.href = primeiconsFontUrl;
preloadLink.crossOrigin = 'anonymous'; // required for preload to trigger in most browsers
document.head.appendChild(preloadLink);

app.mount('#app');
