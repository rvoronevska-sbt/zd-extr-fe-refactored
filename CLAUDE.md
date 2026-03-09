# CLAUDE.md — Zendesk Extractor Frontend

## Project Purpose

**zd-extr-fe** is a Vue 3 SPA for extracting, filtering, and visualizing Zendesk support ticket data. It provides:

- Advanced multi-criteria filtering (brand, topic, CSAT, sentiment, agent/customer email, date range, chat tags, transcript search)
- Analytics dashboard with charts (topic distribution, sentiment breakdown)
- VIP customer tracking table
- CSV export with size warnings
- Firebase email/password authentication
- Dark/light mode toggle
- Deployed to GitHub Pages at `/zd-extr-fe/`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Vue 3 + `<script setup>` (Composition API) |
| Routing | Vue Router 4 |
| State | Pinia 3 |
| UI | PrimeVue 4 (Aura theme), PrimeIcons 7 |
| Styling | Tailwind CSS 4 + tailwindcss-primeui, SCSS |
| Charts | Chart.js 3 (via PrimeVue `<Chart>`) |
| Auth | Firebase 12 (primary), Django JWT (secondary) |
| HTTP | Axios + JWT refresh interceptor |
| Build | Vite 6 (base: `/zd-extr-fe/`) |
| Deploy | gh-pages (`npm run deploy`) |

---

## Key Architecture Decisions

1. **Client-side filtering only** — All ticket data is fetched once on load. Every filter change operates on the local dataset; no API calls are made per filter.

2. **Module-level cache in `useArrayMultiSelects.js`** — The composable stores data at module scope (not component scope), so it is shared across all component instances. `_lazyInit()` fires exactly once per session.

3. **Pinia `tableStore` as the data bridge** — `TableDoc.vue` writes its filtered results to `tableStore.filteredTickets`. `ChartDoc.vue` and `StatsWidget.vue` read from this store to stay in sync without prop drilling.

4. **Firebase is primary auth** — `VITE_USE_FIREBASE=true` in `.env`. Django JWT auth (`authApi.js`) is implemented but secondary. Route guards await `initializeAuth()` before every navigation.

5. **Mock data fallback** — Set `VITE_USE_MOCK_DATA=true` in `.env` to load `src/services/mock-ticket-summaries.json` instead of hitting the API.

6. **Code splitting** — Vite chunks are split into: `framework`, `primevue`, `firebase`, `charts`, `vendor`.

---

## Project Structure

```
src/
├── main.js                       # Entry: Pinia, Router, PrimeVue, font preload, data init
├── App.vue                       # Root: GlobalLoader + router-view
├── router/index.js               # 4 routes (/login, /, /error, /access-denied) + auth guards
├── stores/
│   ├── auth.js                   # Firebase/Django auth state (isAuthenticated, user, loading)
│   └── tableStore.js             # Filtered tickets + memoized chart aggregations
├── composables/
│   ├── useArrayMultiSelects.js   # Core: data load, normalize, filter option sets, lazy init
│   ├── useCSVExport.js           # CSV generation with >10k row / >2 MB warnings
│   ├── useChartAggregations.js   # Chart data computation from filtered tickets
│   └── useCustomerNormalizer.js  # Data normalization helpers
├── services/
│   ├── authApi.js                # Axios instance with auto-refresh on 401
│   ├── TicketService.js          # Ticket fetch (live API or mock)
│   └── mock-ticket-summaries.json
├── views/
│   ├── HomeView.vue              # Layout shell: AppTopbar + AppFooter + <slot>
│   ├── Dashboard.vue             # StatsWidget + TableDoc + VipTableDoc + ChartDoc
│   ├── uikit/TableDoc.vue        # Main DataTable with multi-select/date/text filters
│   ├── uikit/ChartDoc.vue        # Topic/sentiment bar+line charts
│   ├── uikit/VipTableDoc.vue     # VIP customer table
│   └── pages/auth/Login.vue      # Email/password login form
├── components/
│   ├── StatsWidget.vue           # 8-metric cards (CSAT, sentiment, VIP, compliance…)
│   ├── Logo.vue                  # Theme-aware SVG logo (dark/light)
│   ├── GlobalLoader.vue          # Full-screen auth loading overlay
│   └── FloatingConfigurator.vue  # Theme toggle button (login page)
├── layout/
│   ├── AppTopbar.vue             # Header: Logo, dark mode toggle, logout
│   ├── AppFooter.vue
│   └── composables/layout.js     # Dark mode state (useLayout composable)
├── firebase/index.js             # Firebase SDK lazy init
├── utils/stringUtils.js          # formatDate(), cleanMarkdown()
└── assets/layout/                # SCSS: _topbar, _core, variables (_light, _dark, _common)
```

---

## Coding Conventions

### Vue Style
- Always use `<script setup>` — never Options API
- Async operations use `async/await` with `try/catch`
- Lazy Firebase imports: `const { signInWithEmailAndPassword } = await import('firebase/auth')`

### Coding Conventions
Functions: camelCase

### Naming Convention
| Type | Convention | Example |
|---|---|---|
| Variables / functions | camelCase | `filteredTickets`, `toggleDarkMode` |
| Vue component files | PascalCase | `StatsWidget.vue`, `TableDoc.vue` |
| Composables | `use` prefix | `useArrayMultiSelects`, `useCSVExport` |
| API / data fields | snake_case | `ticket_id`, `csat_score`, `customer_email` |
| Internal/private | `_` prefix | `_lazyInit()`, `_chatTagsString` |

### Patterns
- **Composables** for all reusable reactive logic (not mixins, not global utils)
- **Services** (`src/services/`) for external API calls only
- **Utils** (`src/utils/`) for pure functions (no Vue reactivity)
- **`safeArray`** pattern for null-safety: `const safeArray = (arr) => arr ?? []`
- **Empty string normalization**: convert `''` → `'none'` for consistent filtering
- **Tag normalization**: lowercase + sort arrays before storing
- **Filter debounce**: 500ms to throttle rapid input changes

### Formatting
- Prettier: **4-space indent**, **250-char line width** (see `.prettierrc.json`)
- Run `npm run lint` to auto-fix ESLint issues before committing

---

## Styling Conventions

- **Dark mode**: add/remove `.app-dark` class on `document.documentElement`
  - Uses View Transition API: `document.startViewTransition(() => { ... })`
  - PrimeVue Aura preset handles color switching automatically
- **CSS variables** for theming (use these, don't hardcode colors):
  - `--surface-card`, `--surface-ground`, `--surface-border`, `--surface-hover`, `--surface-overlay`
  - `--text-color`, `--text-color-secondary`
  - `--primary-color`, `--primary-contrast-color`
  - `--transition-duration`, `--content-border-radius`
- **Tailwind** for layout and spacing (`grid`, `flex`, `gap-*`, `p-*`, breakpoints `lg:`, `xl:`)
- **SCSS `<style scoped>`** for component-specific overrides
- **`:deep(.p-*)`** to override PrimeVue internals from scoped styles
- **Responsive**: Tailwind breakpoints + `@media (max-width: 991px)` in SCSS files

---

## Common Tasks

### Adding a new filter to TableDoc

1. Add a `ref` for the filter value in `src/views/uikit/TableDoc.vue`
2. Extend the `filteredTickets` computed property with a new filter clause
3. If using custom multi-select logic, register a new operator in `PrimeVue FilterService` (see existing `containsAny` registration)
4. Add the `<Column>` with a `:filterField` and `#filter` slot template in the `<DataTable>`
5. Filtered results auto-sync to `tableStore` — charts and stats will update automatically

### Adding a new chart

1. Add aggregation logic in `src/composables/useChartAggregations.js` based on `tableStore.filteredTickets`
2. In `src/views/uikit/ChartDoc.vue`, add computed `chartData` and `chartOptions` objects
3. Use PrimeVue's `<Chart type="bar|line|doughnut" :data="chartData" :options="chartOptions" />`
4. Dark mode: update chart colors inside a `watch` on `isDarkTheme`

### Adding a new stats metric

1. Add computed logic in `src/components/StatsWidget.vue` using `useArrayMultiSelects()` data
2. Add a card in the Tailwind 12-column grid:
   ```html
   <div class="col-span-12 lg:col-span-6 xl:col-span-3">
     <!-- metric card -->
   </div>
   ```

### Adding a new page/route

1. Create the view in `src/views/`
2. Add the route in `src/router/index.js`
3. If auth-protected, add `meta: { requiresAuth: true }` — the existing route guard handles it
4. If it needs the layout shell (topbar/footer), make it a child of the `HomeView` route

---

## Debugging Guide

### Data not loading / stale data
- `useArrayMultiSelects._lazyInit()` fires once. If data seems stale, the module cache may need a hard refresh (page reload in dev)
- Switch to mock data: set `VITE_USE_MOCK_DATA=true` in `.env`, restart dev server
- Check `src/services/TicketService.js` for API URL and auth headers
- Check browser Network tab for failed requests; `fetchError` ref in the composable stores error state

### Filters not working
- Verify the filter ref is included in the `filteredTickets` computed property chain
- Custom multi-select filters rely on `FilterService.register('containsAny', ...)` — confirm registration runs before the DataTable mounts
- Check that normalized data uses `'none'` (string) for empty fields, not `null`/`''`

### Auth issues
- Auth state: `useAuthStore()` — inspect `isAuthenticated`, `loading`, `user` in Vue DevTools
- Route guard calls `initializeAuth()` which awaits Firebase `onAuthStateChanged` — if this hangs, check Firebase config in `.env`
- Django JWT: `authApi.js` interceptor auto-retries on 401. If looping, check `/api/auth/refresh/` endpoint
- Firebase errors: verify all `VITE_FIREBASE_*` env vars match the Firebase console project settings

### Dark mode not toggling
- Check that `useLayout().toggleDarkMode()` is called in `AppTopbar.vue`
- The `.app-dark` class should appear on `<html>` — inspect with browser DevTools
- PrimeVue theme switching depends on `darkModeSelector: '.app-dark'` in `main.js` PrimeVue config

### Build / deployment issues
- Base URL must be `/zd-extr-fe/` in `vite.config.mjs` — do not change for GitHub Pages
- `npm run deploy` runs `npm run build` then `gh-pages -d dist`
- Never commit `.env` — Firebase credentials must be set per-environment
- If chunks are too large, check `vite.config.mjs` manual chunks config

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_USE_FIREBASE` | `true` to use Firebase auth |
| `VITE_USE_MOCK_DATA` | `true` to load local mock JSON instead of API |
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

API proxy (dev only): `/api/` → `http://56.228.5.130` (configured in `vite.config.mjs`)
