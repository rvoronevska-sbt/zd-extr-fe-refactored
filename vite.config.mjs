import { PrimeVueResolver } from '@primevue/auto-import-resolver';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    // base: process.env.NODE_ENV === 'production' ? 'localhost' : '/',
    base: '/zd-extr-fe/', // Uncomment and set this if deploying to a subdirectory (e.g., GitHub Pages)

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
        {
            // Rewrite primeicons font URL references to /zd-extr-fe/fonts/primeicons/
            // so Vite doesn't bundle them into dist/assets/ (absolute URLs are not processed as assets).
            // The actual files live in public/fonts/primeicons/ — committed to git, frozen from package updates.
            // enforce: 'pre' ensures this runs BEFORE Vite's CSS plugin processes url() references.
            name: 'primeicons-local-fonts',
            enforce: 'pre',
            transform(code, id) {
                if (!id.includes('primeicons') || !id.endsWith('.css')) return null;
                return code.replace(/url\(['"]?\.\/fonts\/(primeicons\.[^'"?)\s]+)[^'")\s]*['"]?\)/g, "url('/zd-extr-fe/fonts/primeicons/$1')");
            },
            // Safety net: remove any primeicons font files that still ended up in dist/assets/.
            // Bundle keys use hashed names (e.g. assets/primeicons-C6QP2o4f.woff2) — match accordingly.
            generateBundle(_, bundle) {
                const primeiconsFontRE = /primeicons[^/]*\.(eot|svg|ttf|woff2?)$/;
                for (const key of Object.keys(bundle)) {
                    if (primeiconsFontRE.test(key)) delete bundle[key];
                }
            }
        }
    ],

    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;

                    if (id.includes('vue') || id.includes('@vue') || id.includes('pinia') || id.includes('vue-router')) {
                        return 'framework';
                    }

                    if (id.includes('primevue') || id.includes('primeicons')) {
                        return 'primevue';
                    }

                    if (id.includes('firebase')) {
                        return 'firebase';
                    }

                    if (id.includes('chart.js') || id.includes('recharts')) {
                        return 'charts';
                    }

                    return 'vendor';
                }
            }
        },
        minify: 'esbuild'
    },

    server: {
        proxy: {
            '/api': {
                target: 'http://56.228.5.130',
                changeOrigin: true
            }
        }
    }
});
