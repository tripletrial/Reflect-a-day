# Reflect a Day — Phone App Build Plan

This repo is currently:
- **Backend**: Node.js + Express (`server/`) with SQLite via `better-sqlite3`
- **Frontend**: static HTML/CSS + vanilla JS served from `public/`
- **Core feature**: voice-first reflection using **OpenAI Realtime** (ephemeral token minted by server at `POST /api/realtime/token`)

This plan focuses on shipping a phone app with the **lowest-risk path that preserves the existing Realtime audio + UI**, while leaving room for a more “native” app later.

## Goals (what “phone app” means here)

- **Installable on iOS + Android**
- **Microphone capture + real-time voice conversation** works reliably
- **Past reflections** list/detail, narration playback, and “ask about this day” all work
- **Settings + prompt lab** works
- App can talk to a hosted backend (not `localhost`)

Non-goals for the first iteration (can be added later):
- Full offline mode for recording + realtime conversations
- Multi-user accounts / authentication
- Cloud sync across devices

## Recommended approach: Capacitor wrapper around the existing web app

**Why**: the current app is already a complete UI and relies on browser APIs (audio + realtime). Wrapping the existing `public/` app with Capacitor gets you a phone app fastest while reusing 95%+ of code.

**What changes**:
- Add a `mobile/` wrapper project (Capacitor) that points to the hosted web build or bundles the static web assets.
- Add a small amount of “mobile glue”: permissions, safe-area handling, better touch UX, and “always-on” audio constraints.

**When to choose React Native/Expo instead** (later):
- If you need deep native audio pipelines, background recording, CallKit/Android audio focus, widgets, etc.
- If Safari/WebView limitations block OpenAI Realtime audio stability for your target devices.

## High-level architecture

- **Phone app** (Capacitor WebView)
  - Loads the same UI currently in `public/`
  - Uses the same API endpoints under `/api/*`
  - Requests microphone permission from the OS (Capacitor)
- **Backend** (Express)
  - Hosts API (`/api/*`)
  - Serves the static app (optional; can also be hosted separately)
  - Stores data in SQLite (fine for single-instance deployments)

## Milestone 0 — Decide how the backend will be reachable from phones

Phones cannot call `http://localhost:*` on your laptop. Pick one:

- **Option A (simplest)**: deploy the Node server to a single host (Fly.io/Render/Railway/VPS) and point the app at `https://your-domain`.
- **Option B**: keep static hosting separate (CDN) and deploy API as its own service (still needs a stable public URL).

Deliverables:
- Public base URL for API, e.g. `https://api.reflectaday.com`
- CORS / HTTPS decisions (WebView still benefits from HTTPS)

## Milestone 1 — Make the frontend configurable for “API base URL”

Right now, the web UI uses relative calls like `fetch('/api/...')`.
That works if the UI is served by the same origin as the API, but breaks if the phone app loads assets from one place and API from another.

Plan:
- Introduce a single “API base” config in `public/js/*` (one module).
- Default to same-origin for web.
- Allow override via:
  - query param (e.g. `?apiBase=https://...`) for testing
  - build-time injected value (e.g. `window.__API_BASE__`)
  - Capacitor config / environment

Deliverables:
- One “source of truth” for API base URL
- No hardcoded origins in feature modules (`realtime.js`, `past.js`, `settings.js`, etc.)

## Milestone 2 — Add a Capacitor mobile wrapper

Plan:
- Create a `mobile/` directory:
  - `@capacitor/core`, `@capacitor/cli`
  - iOS + Android projects (generated)
- Configure it to either:
  - **Bundle** the web app: copy `public/` into `mobile/www/`, or
  - **Load remote**: point to hosted web UI (faster iteration, requires network)

Minimum mobile glue:
- Microphone permissions
- Safe-area padding for notches (CSS env vars)
- Prevent the screen from sleeping during an active session (optional but recommended)

Deliverables:
- `npm run mobile:ios` / `npm run mobile:android` (or equivalent) to open builds
- App launches and loads UI

## Milestone 3 — Validate audio + OpenAI Realtime in WebView

The hardest part of “phone app” here is **realtime audio**. Validate early.

Checklist:
- Realtime token fetch works (`POST /api/realtime/token`)
- WebRTC session connects from iOS/Android WebView
- Mic capture is stable after screen lock/unlock
- Audio output routes correctly (speaker vs earpiece)
- Handling of interruptions (phone call, Bluetooth connect)

Deliverables:
- A short test matrix doc (devices + OS versions)
- Any necessary fallbacks (e.g. disable some audio processing on mobile)

## Milestone 4 — Mobile UX pass (touch-first)

Current UI appears desktop-first (keyboard shortcuts like **T**/**S**).

Plan:
- Make “Record / Stop” large and thumb-friendly
- Ensure Past Reflections panel works as a mobile sheet
- Improve scrolling performance and focus behaviors
- Ensure the Settings overlay is accessible on small screens

Deliverables:
- Mobile layout adjustments in CSS
- Remove reliance on keyboard-only interactions

## Milestone 5 — App packaging & release pipeline

Plan:
- Add app icon / splash assets
- Set bundle identifiers
- Build signing (Apple/Google)
- Basic crash logging (optional)
- Release to TestFlight / internal testing track

Deliverables:
- Repeatable build steps
- Versioning strategy

## “Next” milestones (optional upgrades)

- **Authentication & sync** (multi-device): add user accounts, move storage from local SQLite to a hosted DB.
- **Offline-first**: cache past records locally; queue uploads; local-only draft sessions.
- **Native rewrite**: React Native/Expo app reusing the same API; keep backend largely unchanged.
- **Background audio**: deeper native audio focus + background modes (more invasive).

## Key risks / constraints to watch

- **OpenAI Realtime + WebView compatibility**: may require device-specific workarounds.
- **SQLite deployment**: fine for single instance; not great for horizontal scaling.
- **Secrets**: ensure `OPENAI_API_KEY` stays server-side only (it currently does; mobile should never embed it).

## Suggested repo structure if we proceed with implementation

- `server/` (unchanged)
- `public/` (minor changes for API base config + mobile CSS)
- `mobile/` (new; Capacitor wrapper)
- `docs/` (this plan + test matrix + release checklist)

