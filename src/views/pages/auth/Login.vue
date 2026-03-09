<script setup>
import FloatingConfigurator from '@/components/FloatingConfigurator.vue';
import Logo from '@/components/Logo.vue';
import { useAuthStore } from '@/stores/auth';
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const passwordRef = ref(null);
const loading = ref(false);
const formError = ref(''); // local error message (clears on input change)
const shake = ref(false); // subtle shake animation on failure

// Clean up authStore.error when user starts typing again
watch([email, password], () => {
    formError.value = '';
    authStore.error = null;
});

onMounted(async () => {
    await nextTick();

    const input = passwordRef.value?.$el.querySelector('input.p-password-input');
    if (input) {
        input.removeAttribute('aria-expanded');
        input.removeAttribute('aria-haspopup');
        if (input.hasAttribute('aria-controls') && !document.getElementById(input.getAttribute('aria-controls'))) {
            input.removeAttribute('aria-controls');
        }
    }
});

async function handleLogin() {
    // Clear previous errors
    formError.value = '';
    authStore.error = null;
    loading.value = true;

    try {
        const result = await authStore.login(email.value, password.value);

        if (result.success) {
            // Success → redirect
            const redirect = route.query.redirect || '/';
            router.replace(redirect);
        }
    } catch (err) {
        // Failure → show error message + shake effect
        formError.value = authStore.error || err.message || 'Invalid email or password';
        shake.value = true;

        // Remove shake after animation
        setTimeout(() => {
            shake.value = false;
            router.replace({ name: 'error' });
        }, 600);
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <main>
        <FloatingConfigurator />
        <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen overflow-hidden">
            <div class="flex flex-col items-center justify-center">
                <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                    <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                        <div class="text-center mb-8">
                            <Logo class="mx-auto mb-8" />
                            <div class="text-surface-900 dark:text-surface-0 text-3xl font-medium mb-4">Welcome to Zendesk Extractor FE!</div>
                            <span class="text-muted-color font-medium">Sign in to continue</span>
                        </div>

                        <form @submit.prevent="handleLogin" v-if="!authStore.isLoading" class="space-y-6">
                            <!-- Email -->
                            <div>
                                <label for="email1" class="block text-surface-900 dark:text-surface-0 text-xl font-medium mb-2"> Email </label>
                                <InputText id="email1" type="email" placeholder="Email address" class="w-full md:w-[30rem]" v-model="email" required autofocus />
                            </div>

                            <!-- Password -->
                            <div>
                                <label for="password1" class="block text-surface-900 dark:text-surface-0 font-medium text-xl mb-2"> Password </label>
                                <Password id="password1" ref="passwordRef" v-model="password" placeholder="Password" :toggleMask="true" class="w-full md:w-[30rem]" fluid :feedback="false" required />
                            </div>

                            <!-- Error Message -->
                            <div v-if="formError" class="text-red-600 dark:text-red-400 text-center font-medium animate-shake">
                                {{ formError }}
                            </div>

                            <!-- Submit Button -->
                            <Button type="submit" label="Sign In" class="w-full" :loading="loading || authStore.isLoading" :disabled="loading || authStore.isLoading || !email || !password" />
                        </form>

                        <!-- Loading state overlay -->
                        <div v-if="authStore.isLoading" class="text-center mt-8 text-surface-500">Checking authentication...</div>
                    </div>
                </div>
            </div>
        </div>
    </main>
</template>

<style scoped>
@keyframes shake {
    0%,
    100% {
        transform: translateX(0);
    }
    25% {
        transform: translateX(-6px);
    }
    50% {
        transform: translateX(6px);
    }
    75% {
        transform: translateX(-6px);
    }
}

.animate-shake {
    animation: shake 0.6s ease-in-out;
}
</style>
