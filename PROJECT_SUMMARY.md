# Schedule Skies — Project Summary

This document summarizes the **Schedule Skies** repository based on the current codebase and documentation. It is intended for course submissions, onboarding, or stakeholders. Update **Team composition** with your official roster if names are required by your instructor.

---

## 1. Project description

**Schedule Skies** is a web application for **travel and event planning** with emphasis on **weather-aware** and **traffic-aware** scheduling (notably around **Cebu, Philippines**). Users can:

- Sign up and sign in with **Supabase Auth**.
- Build and manage **events** on a **Plan** page (categories, venues, dates/times, itineraries, drag-and-drop, sharing, and optional **group budgets / expenses**).
- View a **dashboard** with weather, forecast cards, traffic incidents, notifications, upcoming plans, and suggested places.
- Explore an interactive **map** (TomTom / Leaflet stack).
- Use an **AI assistant** (“SkyBot”) grounded in Gemini plus local context (events, weather, location).
- Run an **AI itinerary demo** on the landing page (prompt → structured plan → optional import into Plan).
- Manage **profile** settings, **plan analytics** (charts from Plan events), **avatar** upload, theme (light/dark), password reset via email, and **account deletion** (service role).
- Open **shared event** links for collaborators (`/shared/[token]`).

Supporting documentation in the repo references **Team 7** deliverables (SRS, STD, SPMP PDFs). A separate **`backend/`** Express server exists for legacy or experimental API use; the **primary app** is the **Next.js** project at the repository root.

---

## 2. Team composition

| Item | Detail |
|------|--------|
| **Referenced in repo** | README files mention **Team 7** artifacts: `Team_7_SRS.pdf` (requirements), `Team_7_STD.pdf` (design), `Team_7_SPMP.pdf` (project plan). |
| **Names & roles in code** | **Not listed** in source files. Add a table below with student names, IDs, and responsibilities (e.g. frontend, backend, database, QA) per your course requirements. |
| **Suggested placeholder** | *Replace this row with your actual team roster.* |

---

## 3. Technology used

### Core application (root `package.json`)

| Area | Technology |
|------|------------|
| **Framework** | [Next.js](https://nextjs.org/) (App-style routing under `pages/`) |
| **UI** | [React](https://react.dev/) 18 |
| **Language** | JavaScript (`.js` / `.jsx`); `tsconfig.json` present for tooling |
| **Auth & database** | [Supabase](https://supabase.com/) — `@supabase/supabase-js`, optional `supabase` CLI package |
| **Charts** | [Recharts](https://recharts.org/) (profile plan analytics) |
| **Maps** | [Leaflet](https://leafletjs.com/) + [React Leaflet](https://react-leaflet.js.org/); [TomTom Web SDK](https://developer.tomtom.com/) (`@tomtom-international/web-sdk-maps`, `web-sdk-services`) |
| **HTTP** | [Axios](https://axios-http.com/) |
| **Icons** | [React Icons](https://react-icons.github.io/react-icons/) |
| **PDF** | `pdf-parse` (where used for ingestion flows) |
| **Lint / build** | ESLint, `eslint-config-next`, `@svgr/webpack` for SVGs |

### External services (via environment variables)

| Service | Typical env vars (see `.env.local` / deployment config) |
|---------|------------------------------------------------------------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only) |
| **Google Gemini** | `GEMINI_API_KEY`, backups / `GOOGLE_GEMINI_*`, optional `NEXT_PUBLIC_GEMINI_API_KEY` |
| **OpenWeatherMap** | `NEXT_PUBLIC_WEATHER_API_KEY` |
| **TomTom** | `NEXT_PUBLIC_TRAFFIC_API_KEY` (traffic + geocode usage in components) |
| **Google Places** | `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (e.g. place photos) |
| **Geoapify** | `NEXT_PUBLIC_GEOAPIFY_API_KEY` (map-related) |
| **App URL** | `NEXT_PUBLIC_BASE_URL` (share links, etc.) |

### Styling & assets

- Global and page-specific **CSS** under `styles/` (e.g. `globals.css`, `dashboard.css`, `plan.css`, `profile.module.css`, `landing.module.css`, `auth.module.css`).
- Static assets under `public/` (logos, images).

### Database / SQL helpers (repo root)

- `SUPABASE_SCHEMA_UPDATES.sql`, `SUPABASE_PROFILE_EXTENDED_COLUMNS.sql`, `SUPABASE_AUTH_GUIDE.md`, `IMPLEMENTATION_GUIDE.md` — schema and setup notes.

### Optional legacy backend

- **`backend/`** — small **Express** API (`express`, `cors`, `axios`) with `nodemon` for development; not required to run the main Next.js app.

---

## 4. Function list

Functions are grouped by **user-facing pages**, **API routes**, and **shared libraries/components**.

### 4.1 Pages (`pages/`)

| Route / file | Purpose |
|--------------|---------|
| **`/`** (`index.js`) | Landing: marketing content, AI itinerary **demo** (Gemini-backed), session-aware navigation, import path to Plan. |
| **`/login`**, **`/signup`** | Supabase email/password authentication. |
| **`/auth/reset-password`** | Complete password reset after email link (then sign-out redirect). |
| **`/dashboard`** | Weather overview, multi-day forecast, traffic, notifications, upcoming plans, suggested places. |
| **`/plan`** | Full **event CRUD**, filters, itinerary modal & activities, **share** modal, **budget** modal, map pick / import flows, weather snippet, AI suggestions panel, Supabase realtime where used. |
| **`/map`** | Full-screen map experience (TomTom / Leaflet integration). |
| **`/profile`** | Tabs: **Analytics** (Recharts from Plan `events`), **Profile** (display name), **Account** (theme, password reset email, delete account); avatar upload/remove. |
| **`/shared/[token]`** | Guest / collaborator view of a shared event and activities (token-based). |

**Global:** `_app.js` — global styles, auth gate for protected routes, optional **AiAssistant** widget.

### 4.2 API routes (`pages/api/`)

| Endpoint | Purpose |
|----------|---------|
| **`/api/health`** | Health check. |
| **`/api/trips`** | Trips listing / persistence (legacy or demo trips table). |
| **`/api/profile`** | GET profile + aggregated **event summaries**; PUT **display name** (minimal columns for broad `profiles` schemas). |
| **`/api/profile/avatar`** | POST upload / DELETE remove profile image (Supabase Storage `avatars`). |
| **`/api/saved-locations`** | CRUD for `saved_locations` (still available for other clients; not primary profile UI). |
| **`/api/saved-itineraries`** | CRUD for `saved_itineraries` (saved trip drafts table). |
| **`/api/delete-account`** | Deletes profile row and auth user (requires **service role**). |
| **`/api/ai-assistant`** | Server-side **Gemini** proxy for SkyBot chat. |
| **`/api/itinerary-demo`** | Landing-page itinerary generation (Gemini). |
| **`/api/places`**, **`/api/place-photo`** | Places / photo helpers (Google or related). |
| **`/api/share/create`**, **`/api/share/get`**, **`/api/share/revoke`**, **`/api/share/activity`** | Event sharing, fetch share payload, revoke, collaborator activity. |
| **`/api/budget/manage`**, **`/api/budget/expense`**, **`/api/budget/settle`** | Group budgets, expenses, settlements for events. |

### 4.3 Notable components (`components/`)

| Component | Role |
|-----------|------|
| **`Sidebar.jsx`**, **`TopMenu.jsx`**, **`Navbar.jsx`**, **`Hero.jsx`**, **`Features.jsx`** | Navigation and marketing UI. |
| **`WeatherOverview.jsx`**, **`ForecastCards.jsx`** | OpenWeather-driven dashboard widgets. |
| **`TrafficInfo.jsx`** | TomTom traffic / reverse geocode. |
| **`Notifications.jsx`** | Supabase-backed user notifications. |
| **`UpcomingPlans.jsx`**, **`SuggestedPlaces.jsx`** | Dashboard planning and Google Places imagery. |
| **`AiAssistant.jsx`** | Floating assistant UI calling `/api/ai-assistant`. |
| **`ShareModal.jsx`**, **`BudgetModal.jsx`** | Plan page modals. |
| **`Map_Screen/Map.jsx`** | Map screen (Geoapify / weather keys). |
| **`ProfileEventCharts.jsx`** | Recharts visualizations for profile analytics. |

### 4.4 Libraries (`lib/`)

| File | Role |
|------|------|
| **`supabaseClient.js`** | Browser Supabase client (`detectSessionInUrl` for recovery flows). |
| **`supabaseServiceRole.js`** | Server-only: JWT verification + service role or user-scoped client for API routes. |
| **`aiContext.js`**, **`getLocation.js`** | Context for AI (weather, location). |
| **`itineraryImportShared.js`** | Shared helpers for itinerary import / copy / routing. |

### 4.5 Scripts & quality

- **`npm run dev`** — Next.js development server.  
- **`npm run build`** / **`npm start`** — Production build and serve.  
- **`npm run lint`** — ESLint.

---

*Generated from repository scan. Amend Team composition and any course-specific details as needed.*
