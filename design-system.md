# Reflect a Day — Design System Rulebook

**This file is the source of truth.** Update it before changing UI. Code must match what is written here.

**Figma reference:** [UI board, node 1:17](https://www.figma.com/design/qfz0uFWGLmGOK8KsmFr7Mm/Untitled?node-id=1-17)

**Last aligned with code:** `cursor/figma-ui-redesign` branch — plain HTML/CSS/JS shell.

---

## 1. Tech Stack & Tooling

| Area | Choice |
|------|--------|
| **Framework** | None — vanilla HTML + ES modules |
| **Server** | Node.js + Express (`server/`) |
| **Styling** | CSS custom properties in `public/css/tokens.css`; components in `public/css/style.css` |
| **Icons** | Figma-exported SVG in `public/assets/` + CSS shapes for simple geometry |
| **Font** | Google Fonts — Rubik 300 / 400 / 500 |
| **State (prototype)** | Plain JS modules in `public/js/` — no React, no build step |
| **Mock / live data** | API-backed (`/api/records`, `/api/sessions`); list rendering in `public/js/past.js` |

### Implementation files (quick map)

| Layer | Path |
|-------|------|
| Tokens | `public/css/tokens.css` |
| Components | `public/css/style.css` |
| Markup | `public/index.html` |
| Session / disc / keyboard | `public/js/app.js` |
| Past list + detail overlay | `public/js/past.js` |
| Settings overlay | `public/js/settings.js` |
| Icons | `public/assets/setting-icon.svg`, `public/assets/discard-icon.svg` |

---

## 2. Global Tokens

### Colors

| Token | Hex | Role |
|-------|-----|------|
| `--color-bg` | `#f5f5f5` | Page, panels, inputs |
| `--color-text` | `#000000` | Primary text |
| `--color-border` | `#000000` | All structural borders (1px) |
| `--color-accent` | `#fd580c` | Links, role labels, record icon, disc dot |
| `--color-quote` | `#c04a11` | Notable quotes on cards |
| `--color-tag` | `#ff702e` | Keyword pills, primary buttons |
| `--color-disc` | `#e8e8e4` | Session disc outer ring |
| `--color-disc-core` | `#323232` | Disc hub, save icon block |
| `--color-key-bg` | `#eeeeee` | Shortcut chips (T, S, Delete) |
| `--color-danger` | `#c0392b` | Reserved semantic red |

**Figma-only icon fills** (do not substitute in CSS):

| Asset | Colors | File |
|-------|--------|------|
| Setting | `#0A0A0A`, `#333333`, `#929292`, `#FD580C` | `setting-icon.svg` |
| Discard | `#B20000` | `discard-icon.svg` |

### Typography

**Family:** `--font-family: "Rubik", …`

Two content sizes only — use **weight** for emphasis, not extra sizes.

| Role | Size | Weight | Line height | Token / selector |
|------|------|--------|-------------|------------------|
| Display | `clamp(2.5rem, 8vw, 5rem)` | 300 | 1 | `--title-size` → `.app-title` |
| Section | `clamp(1.75rem, 4vw, 3rem)` | 300 | 1.1 | `--sidebar-title-size` → `.past-panel-title` |
| **Body** | **20px** | 400 or 500 | 1.45 | `--font-size-body` |
| **Caption** | **16px** | 300 | 1.4 | `--font-size-caption` |
| UI link | 24px | 400 | — | `.text-link` (panel refresh) |
| Setting label | 24px | 500 | — | `.setting-label` |

**Body (20px) applies to:** card summary, quote, tags, Delete pill, transcript labels + messages, overlay summary/highlights, action shortcut chips, pill buttons.

**Caption (16px) applies to:** card dates, disc date/status, action cell labels, overlay status copy, past overlay title + Close, empty states.

### Spacing

| Token | px |
|-------|-----|
| `--space-xs` | 6 |
| `--space-sm` | 12 |
| `--space-md` | 16 |
| `--space-lg` | 24 |
| `--space-xl` | 36 |

App shell padding: `--space-lg`.

### Layout

| Token | Value | Purpose |
|-------|-------|---------|
| `--disc-size` | `min(318px, 64vw)` | Session disc (80% of original 397px Figma) |
| `--action-width` | `219px` | Action stack column |
| `--app-viewport-height` | `100vh` | Lock app to viewport |
| `--session-top-height` | `444px` | Session row (+20% over 370px Figma base) |
| `--session-top-padding-left` | `48px` | Left inset for disc in bordered session row |
| `--transcript-height` | `207px` | Live transcript minimum height; grows to align with past panel |
| `--session-top-max` | `min(424px, calc(100vh - 207px - 280px))` | Session row cap on short viewports |

**Desktop (≥901px):** 1440×900 target — no body scroll. Main grid = session column (max ~756px) + past panel (flex 1). Equal column height; scroll only inside `.live-transcript` and `.past-list`.

**Mobile (≤900px):** Stacked; body scroll OK. Transcript max ~280px; past panel max ~420px.

---

## 3. Component Library

Each row links **design → markup → styles → behavior**.

### Shell

| Component | HTML | CSS | JS |
|-----------|------|-----|-----|
| **App shell** | `.app` | `.app`, `body` overflow hidden | — |
| **App header** | `.app-header`, `.app-title` | `.app-header`, `.app-title` | — |
| **Setting trigger** | `#settings-btn.setting-trigger` | `.setting-trigger`, `.setting-label`, `.setting-icon` | `settings.js` → opens `#settings-overlay` |
| **Main grid** | `.main-grid` | `.main-grid` | — |

### Session (left column)

| Component | HTML | CSS | JS |
|-----------|------|-----|-----|
| **Session column** | `#session-column` | `.session-column`, `.blocked` | `app.js` blocks when past overlay open |
| **Session top** | `.session-top` | `.session-top` — 1px border, disc zone + action stack | — |
| **Disc zone** | `.disc-zone` | `.disc-zone` — flex center; disc vertically centered in row | — |
| **Session disc** | `#record-btn.session-disc` | `.session-disc`, `.disc-rotate`, `.disc-outer`, `.disc-line`, `.disc-core`, `.disc-dot`, `.disc-meta` | `app.js` — click + **T** key; spin + status |
| **Disc date** | `#disc-date` | `.disc-meta` (caption) | `formatDiscDate()` |
| **Disc status** | `#disc-status` | `.disc-meta` (caption) | `setStatus()`, `updateDiscStatus()` |
| **Action stack** | `.action-stack` | `.action-stack` — outer border + **1px horizontal separator** between each cell (`.action-cell + .action-cell`) | — |
| **Record cell** | `#record-action-btn` | `.action-cell`, `.action-icon-record`, `.action-key` | Same as disc / **T** |
| **End & save** | `#end-session-btn` | `.action-icon-save` (48px square) | `endSession()`, **S** key |
| **Discard** | `#discard-session-btn` | `.action-icon-discard` → `discard-icon.svg` | `discardSession()` |
| **Live transcript** | `#transcript.live-transcript` | `.live-transcript`, `.transcript-placeholder`, `.message-block`, `.message-role` | `app.js` `renderTranscript()` — empty state shows placeholder copy |

### Past reflections (right column)

| Component | HTML | CSS | JS |
|-----------|------|-----|-----|
| **Past panel** | `.past-panel` | `.past-panel`, `.past-panel-header` | — |
| **Refresh** | `#refresh-records-btn` | `.text-link` | `app.js` `refreshRecords()` |
| **Reflection card** | `.reflection-card` | `.reflection-card`, `.reflection-date`, `.reflection-summary`, `.reflection-quote` | `past.js` `loadRecordsList()` |
| **Tag row** | `.tag-row` | `.tag-pill`, `.tag-delete` | Delete → `deleteRecord()` |
| **Empty state** | `#records-message` | `.past-panel-empty` | Hidden when list has items |

### Overlays

| Component | HTML | CSS | JS |
|-----------|------|-----|-----|
| **Settings** | `#settings-overlay` | `.overlay`, `.overlay-panel`, `.overlay-section` | `settings.js` |
| **Past detail** | `#past-overlay` | `.overlay-panel-wide` | `past.js` `createPastView()` |
| **Overlay header** | `.overlay-header` | `#past-title` = caption; settings `#settings-title` = display clamp | Close buttons = caption `.text-link` |
| **Hear this** | `#hear-this-btn` | `.pill-btn` | `playNarration()` |
| **Q&A** | `#past-qa`, `#ask-past-checkbox` | `.past-qa`, `.past-qa-messages` | `submitQuestion()` |
| **Full transcript** | `#past-transcript` | `.past-transcript` | `renderTranscript()` |

### Shared primitives

| Primitive | CSS | Rules |
|-----------|-----|--------|
| **Text link** | `.text-link` | Accent color, 24px; underline on hover |
| **Tag pill** | `.tag-pill` | Tag bg, body 20px, padding `4px 12px` |
| **Pill button** | `.pill-btn` | Tag bg + 1px black border, body 20px medium |
| **Overlay section** | `.overlay-section` | 1px border, `--space-md` padding |
| **Prompt tab** | `.prompt-tab.active` | Tag background when selected |

---

## 4. UX & Interaction Rules

### Session disc

- **Idle:** disc still; status e.g. `Ready`.
- **Recording:** `.disc-rotate` spins **continuously**; date + status text rotate **with** the disc (inside `.disc-rotate`).
- **Stop recording:** spin stops; disc **returns to home angle** (shortest path to 0°).
- **Thinking / speaking:** no spin; `.thinking` dims core; `.speaking` keeps accent dot.

### Keyboard

| Key | Action |
|-----|--------|
| **T** | Start session → start recording → send (push-to-talk) |
| **S** | End session and save (when session active) |

### Action cells

- **Disabled:** `opacity: 0.45` only — never use separator lines to imply disabled.
- **Separators:** 1px black line **between** cells (Figma), not through icon content — use adjacent-sibling `border-top`, not overlapping layout.
- **Layout:** icon 48×48 + shortcut chip; `overflow: hidden` so content never overlaps.

### Past reflections

- **Card click** → open detail overlay (blocked during live session).
- **Delete pill** → `stopPropagation`; confirm; `DELETE /api/records/:id`.
- **Hover card:** `rgba(0,0,0,0.02)` background.

### Scroll

- **Desktop:** `body { overflow: hidden }` — scroll inside transcript and past list only.
- **Mobile:** page may scroll; panels have max-heights.

### Motion summary

| Element | Behavior |
|---------|----------|
| Disc | Continuous rotation while recording; reset on stop |
| Disabled | Opacity 0.45 |
| Links | Underline on hover |
| Delete tag | `brightness(0.95)` on hover |

---

## 5. Hard Constraints

1. **Light theme only** — background `#f5f5f5`; no dark mode.
2. **Black grid** — borders are `1px solid #000000`; no card drop shadows on main shell.
3. **Two text sizes for content** — body 20px, caption 16px; do not add a third size for card/panel copy.
4. **Figma icons** — use exported SVG for Setting and Discard; do not redraw in CSS.
5. **Action stack separators** — horizontal 1px lines between Record / End / Discard cells; outer border on `.action-stack`.
6. **No page scroll on desktop** — fit 1440×900; internal panels scroll.
7. **Disc text rotates with disc** — `#disc-date` and `#disc-status` live inside `.disc-rotate`.
8. **Removed from main UI** — status pill, eyebrow tagline, “Latest summary” block, keyboard hint paragraph.

---

## Change checklist

When the Design Director requests a UI change:

1. Update **this file** (Phase 2 — rulebook).
2. Update `public/css/tokens.css` if tokens change.
3. Update `public/css/style.css` and/or `public/index.html`.
4. Wire behavior in the **JS file** from the component table above.
5. If Figma assets change, re-export to `public/assets/` and note colors in §2.

**Typography quick check:** summary, bullets, quote, and tags on the same card must all be **20px**. Dates and labels **16px**.
