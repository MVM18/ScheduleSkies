# Schedule Skies — Project Summary

This document summarizes the **Schedule Skies** project for submissions, onboarding, or stakeholders. It is written in short paragraphs and bullet lists. Replace placeholder team lines with your actual names and duties as required by your course.

---

## Project description

**Schedule Skies** is a web application built to help people **plan trips and events** with awareness of **weather**, **traffic**, and **location context**, with a practical focus on travel in the **Philippines (especially Cebu)**. The product combines a traditional planner (events, dates, itineraries) with a **dashboard** of environmental signals and an **AI assistant** so users can adjust plans before they leave.

**What the app does, in practice:**

- **Authenticates users** so each person has a private workspace tied to a Supabase account.
- **Stores and organizes events** (the main “Plan” schedule): titles, categories, venues, dates/times, optional itineraries and activities, and optional **sharing** and **group budgets** for collaboration.
- **Surfaces real-time style information** on the dashboard: current weather, forecast windows, traffic incidents, notifications, upcoming items from the database, and suggested places.
- **Offers maps** for geographic exploration using industry map SDKs layered with the app’s own screens.
- **Explains and visualizes activity** on the **Profile** page with **charts** derived from Plan events (for example how many events are upcoming versus completed, and counts by category).
- **Supports AI workflows**: a **landing-page itinerary demo** (prompt in → structured plan out, with optional handoff to Plan) and a **floating assistant** that answers travel questions using server-side AI and local context (events, weather, location).
- **Supports collaboration** through **share links** so others can view a shared event in a read-oriented guest experience.

The repository also references formal **Team 7** documents (`Team_7_SRS.pdf`, `Team_7_STD.pdf`, `Team_7_SPMP.pdf`) for requirements, design, and project management. A small optional **`backend/`** Express project exists separately; the **main product** is the **Next.js** application at the repository root.

---

## Team composition

Course materials in this repo identify the work as **Team 7** and point to SRS, STD, and SPMP PDFs for requirements and governance. **Individual student names, IDs, and official role titles are not stored in the source code**, so the list below is a **template of typical roles** you should map to real teammates on your roster.

**Common roles (assign one primary owner each, with others as backup where needed):**

- **Project lead / integrator** — Owns milestones, merges branches, checks that demo paths work end-to-end, and coordinates with the instructor’s rubric.
- **Frontend developer** — Builds and styles React pages (`pages/`, `components/`), client state, and responsive layout; wires forms and modals to APIs.
- **Backend / API developer** — Implements and secures `pages/api/*` routes, environment variables, and integration with Supabase and third-party keys.
- **Database & Supabase administrator** — Maintains SQL scripts, RLS policies, storage buckets, and auth settings; documents how others run migrations.
- **AI & external APIs** — Configures Gemini, weather, traffic, and places keys; tunes prompts and error handling for `/api/ai-assistant` and itinerary demo flows.
- **QA / documentation** — Tests login, plan CRUD, sharing, profile, and map flows; keeps this summary and README instructions accurate.

*Edit this section to add each member’s name, student number, and assigned bullets above.*

---

## Technology used

The stack is chosen so the team can ship a full-stack product quickly: a **React** UI on **Next.js** for routing and API routes, **Supabase** for auth and data, and hosted **HTTP APIs** for weather, maps, traffic, and AI. Below, each item states **what it is for** in this project.

**Core framework and UI**

- **Next.js** — Hosts all routes (`pages/`), server-side API handlers (`pages/api/`), production build, and static optimization; replaces a separate backend for most features.
- **React** — Component model for every screen (dashboard, plan, map, profile, landing, auth).
- **JavaScript (`.js` / `.jsx`)** — Primary language; TypeScript config exists mainly for editor and lint tooling.

**Data, auth, and server access**

- **Supabase (`@supabase/supabase-js`)** — **Function:** user sign-up, sign-in, sessions, row-level data for events, profiles, notifications, sharing, and budgets; browser client in `lib/supabaseClient.js`, server access in `lib/supabaseServiceRole.js` with JWT checks and optional service role for privileged routes (for example account deletion and some uploads).
- **`supabase` CLI package** — **Function:** optional local tooling against the Supabase project (not required at runtime in the browser).

**Visualization and UX helpers**

- **Recharts** — **Function:** profile analytics charts (distribution of Plan events by status and category).
- **React Icons** — **Function:** consistent iconography across navigation, plan cards, and profile actions.
- **Axios** — **Function:** HTTP calls from components or scripts where fetch wrappers are not used exclusively.
- **`pdf-parse`** — **Function:** parsing PDF content when an ingestion or demo path needs text extraction from uploaded documents.

**Maps and geography**

- **Leaflet & React Leaflet** — **Function:** interactive map layers and markers in the map experience.
- **TomTom Web SDK (`@tomtom-international/web-sdk-maps` and services)** — **Function:** richer map display and routing-related services where the map page relies on TomTom.

**Quality and assets**

- **ESLint + eslint-config-next** — **Function:** static analysis and Next.js–aware lint rules.
- **`@svgr/webpack`** — **Function:** import SVG files as React components in the bundle.
- **CSS modules and global stylesheets (`styles/`)** — **Function:** layout, themes (including profile light/dark), and page-specific presentation.
- **`public/`** — **Function:** logos, hero imagery, and other static files.

**External services (configured with environment variables)**

- **Google Gemini** — **Function:** powers SkyBot (`/api/ai-assistant`) and the landing itinerary demo; keys are read only on the server in production-minded setups.
- **OpenWeatherMap** — **Function:** current weather and forecasts for the dashboard, plan header context, and AI grounding.
- **TomTom traffic / search APIs** — **Function:** incident lists, congestion context, and reverse geocoding in traffic widgets.
- **Google Places** — **Function:** place photos and discovery helpers for suggested locations.
- **Geoapify** — **Function:** additional geospatial or map-related lookups where the map screen is configured to use it.

**Optional legacy folder**

- **Express (`backend/`)** — **Function:** small standalone API prototype (`express`, `cors`, `axios`); not required to run the main Next.js Schedule Skies app.

---

## Function list

From an **end user’s** perspective, Schedule Skies supports the following kinds of actions. (Technical APIs and component names are implementation details; users experience these through pages and buttons.)

**Account and security**

- **Create an account** and **log in** with email and password (Supabase Auth).
- **Log out** and return to public pages.
- **Request a password reset by email**, follow the link, and **set a new password** on the dedicated reset screen.
- **Delete the entire account** when the app is configured with the required server credentials (permanent removal of the user’s auth record and related cleanup).

**Landing and discovery**

- **Read marketing content** about the product on the home page.
- **Try the AI itinerary demo**: enter a natural-language prompt, receive a structured multi-day style plan, copy or route it toward the Plan experience when import flows are enabled.
- **Navigate** to sign up, log in, or the main app areas depending on whether a session already exists.

**Dashboard**

- **See current weather** and a **multi-day forecast** for the device’s approximate location.
- **Review traffic incidents** and related context for the area.
- **Read in-app notifications** and mark or manage read state where the UI allows.
- **Scan upcoming plans** pulled from the database and **browse suggested places** with imagery when API keys are present.

**Planning (Plan page)**

- **Create, edit, and delete events** with categories (for example food, sightseeing, hotel, leisure), locations, prices, and date/time fields.
- **Filter and search** the event list and switch views that the UI exposes (for example status-oriented filters).
- **Open an itinerary** for an event and **add, edit, or remove activities** with times and locations.
- **Drag events** on the calendar-style interface when that interaction is enabled.
- **Share an event** with collaborators through generated links and flows managed in the share modal.
- **Open group budget tools**: set totals, add expenses, and settle splits when budget features are used.
- **Use AI suggestion panels** tied to the current schedule where configured.
- **Import or continue** AI-generated itineraries when the app offers import from the landing demo or structured prompts.

**Map**

- **Explore an interactive map** with zoom, pan, and map-specific tools wired to TomTom and/or Leaflet as implemented.

**Profile**

- **View analytics charts** summarizing Plan events (totals, upcoming versus completed, category breakdown).
- **See upcoming events** listed from the same Plan data when events exist.
- **Update display name** and save profile preferences that the backend supports for the current database schema.
- **Upload or remove a profile photo** when storage and permissions are configured.
- **Switch light or dark theme** for the profile experience (stored locally on the device).
- **Read in-app explanation** of how “saved trip drafts” differ from Plan events, when that copy is present on the page.

**Collaboration (guest)**

- **Open a shared link** (`/shared/[token]`) to view a shared event and its activities in a collaboration-oriented layout without needing full owner privileges.

**Developer operations (not end-user features, but what the team uses to run the product)**

- **`npm run dev`** — start local development.
- **`npm run build`** / **`npm start`** — production build and serve.
- **`npm run lint`** — run ESLint over the codebase.

---

*Update team names, role assignments, and any course-specific deliverable references as your instructor requires.*
