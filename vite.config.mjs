import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    base: import.meta.env.VITE_BASE ? import.meta.env.VITE_BASE_URL + import.meta.env.VITE_BASE : '/',

    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },

    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
            }
        }
    },

    plugins: [
        vue(),
        tailwindcss(),
        Components({
            resolvers: [PrimeVueResolver()]
        }),
        visualizer({
            open: true, // ← auto opens browser after build
            filename: './dist/stats.html', // where to save the report
            gzipSize: true, // show gzipped sizes (very useful)
            template: 'treemap', // or 'sunburst', 'network', 'flamegraph'
            emitFile: false // false = save to file, true = emit as asset
        })
    ],

    // optimizeDeps: {
    //     noDiscovery: true,
    //     include: ['primevue/config']
    // },

    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;

                    // 1. Vue ecosystem (almost never changes)
                    if (id.includes('vue') || id.includes('@vue') || id.includes('pinia') || id.includes('vue-router')) {
                        return 'framework';
                    }

                    // 2. PrimeVue ecosystem
                    if (id.includes('primevue') || id.includes('primeicons')) {
                        return 'primevue';
                    }

                    // 3. Firebase (large + isolated)
                    if (id.includes('firebase')) {
                        return 'firebase';
                    }

                    // 4. Charts (heavy)
                    if (id.includes('chart.js') || id.includes('recharts')) {
                        return 'charts';
                    }

                    // 5. Everything else
                    return 'vendor';
                    // Your app code stays in default chunks (index-*.js, etc.)
                }
            }
        },
        minify: 'esbuild' // Better minification
    }

    // server: {
    //     proxy: {
    //         '/api': {
    //             target: 'https://56.228.5.130',
    //             changeOrigin: true,
    //             secure: false
    //         }
    //     }
    // }
});
