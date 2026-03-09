import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || '',
    withCredentials: true
    // timeout: 10000
});

let refreshPromise = null;

let _authStore = null;
const getAuthStore = async () => {
    if (!_authStore) {
        const { useAuthStore } = await import('@/stores/auth');
        _authStore = useAuthStore();
    }
    return _authStore;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Auto-refresh on 401 (Django JWT)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                if (!refreshPromise) {
                    refreshPromise = api.post('/api/token/refresh/', {}, { withCredentials: true }).finally(() => {
                        refreshPromise = null;
                    });
                }
                await refreshPromise;
                return api(originalRequest);
            } catch (refreshError) {
                const authStore = await getAuthStore();
                await authStore.logout();
                window.location.href = `${import.meta.env.BASE_URL}login`;
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
