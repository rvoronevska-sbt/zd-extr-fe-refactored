import { useAuthStore } from '@/stores/auth';
import { createRouter, createWebHistory } from 'vue-router';
import Login from '@/views/pages/auth/Login.vue';
import HomeView from '@/views/HomeView.vue';
import AccessDenied from '@/views/pages/auth/Access.vue';
import Error from '@/views/pages/auth/Error.vue';

const routes = [
    { path: '/login', name: 'login', component: Login, meta: { requiresGuest: true, hideNavbar: true } },
    { path: '/', name: 'home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/error', name: 'error', component: Error, meta: { hideNavbar: true } },
    { path: '/access-denied', name: 'access-denied', component: AccessDenied, meta: { hideNavbar: true } }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: () => ({ top: 0 })
});

router.beforeEach(async (to) => {
    const authStore = useAuthStore();

    if (authStore.isLoading) {
        await new Promise((resolve) => {
            const unwatch = authStore.$subscribe(() => {
                if (!authStore.isLoading) {
                    unwatch();
                    resolve();
                }
            });
        });
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: to.path !== '/' ? { redirect: to.fullPath } : {} };
    }

    if (to.meta.requiresGuest && authStore.isAuthenticated) {
        return { name: 'home' };
    }

    return true;
});

export default router;
