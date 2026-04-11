# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Surface Tag** repository -- client-side TypeScript scripts that embed Surface forms into third-party websites. The scripts are served via CDN and loaded as `<script>` tags on customer sites.

**Repository:** `trysurface/scripts`

## Build System

Source code lives in `src/` as TypeScript modules. **esbuild** bundles them into a single IIFE file (`surface_tag.js`) that runs directly in browsers.

```bash
pnpm run build        # Production build -> surface_tag.js
pnpm run dev          # Watch mode with sourcemaps
pnpm run typecheck    # TypeScript type checking (no emit)
```

**Important:** `surface_tag.js` is a build artifact. Always run `pnpm run build` after editing `src/` files. The CDN serves this file via jsdelivr auto-minification (`surface_tag.min.js`).

`surface_embed_v1.js` is an identical copy of the build output.

## Running the Test Suite

```bash
# Terminal 1: watch build
pnpm run dev

# Terminal 2: serve test pages
cd test && ./serve.sh
```

Open `http://localhost:8000/test/index.html` in a browser. Four test pages: popup, slideover, inline, and input-trigger. Test config (form source URL, environment ID) can be overridden via URL parameters -- see `test/config.js`.

No automated tests, linter, or CI pipeline. Testing is manual and browser-based.

## Source Architecture (`src/`)

### Entry Point

`src/index.ts` -- imports all modules, creates the `SurfaceTagStore` singleton, assigns public API to `window`, runs auto-init (reads `site-id` from `<script>` tag).

### Shared Utilities (`src/utils/`)

- `logger.ts` -- `createLogger(prefix)` factory used by all classes (replaces three duplicated log methods)
- `route-observer.ts` -- shared SPA route change detection via pushState/popstate monkey-patching (replaces duplicated code in Store and Embed)
- `beacon.ts` -- `sendBeacon()` with fetch fallback (replaces duplicated implementations)
- `cookies.ts` -- standalone cookie CRUD functions
- `debug.ts`, `hash.ts`, `url.ts`, `dom.ts` -- small focused utilities

### Lead Identification (`src/lead/`)

- `identify.ts` -- `identifyLead()`, localStorage cache with TTL, module-level state for `EnvironmentId`
- `fingerprint.ts` -- `getBrowserFingerprint()`
- `site-id.ts` -- `getSiteIdFromScript()`

### Store (`src/store/`)

- `store.ts` -- `SurfaceStore` class. Singleton state: cookies, URL params, referrer, lead data, partial-fill data. Sends `STORE_UPDATE` / `LEAD_DATA_UPDATE` to iframes.
- `message-listener.ts` -- `postMessage` event handling
- `user-journey.ts` -- page view tracking, Redis API calls
- `journey-cookies.ts` -- journey cookie domain/refresh helpers

### External Form (`src/external-form/`)

- `external-form.ts` -- `SurfaceExternalForm` class for non-iframe form embeds
- `form-handlers.ts` -- form attach/submit/input-change logic

### Embed (`src/embed/`)

- `embed.ts` -- `SurfaceEmbed` class. Main embed controller instantiated as `new SurfaceEmbed(src, type, targetClass, options)`. Supports: popup, slideover, widget, inline, input-trigger.
- `types/popup.ts`, `types/slideover.ts`, `types/inline.ts`, `types/widget.ts` -- embed type implementations as prototype mixins
- `input-trigger/` -- form input collection, validation, and submit handling (4 files)
- `styles/` -- CSS-in-JS generators for each embed type
- `breakpoints.ts`, `popup-dimensions.ts`, `iframe-updater.ts`, `click-handlers.ts`, `preload.ts`, `show-from-url.ts` -- focused sub-modules

### PostMessage Protocol

- **To iframe:** `STORE_UPDATE` (cookies, URL params, partial fill data), `LEAD_DATA_UPDATE` (leadId, sessionId, fingerprint)
- **From iframe:** `SEND_DATA` (iframe requests current store data)

### Key APIs

- `https://forms.withsurface.com/api/v1/lead/identify` -- Lead identification
- `https://forms.withsurface.com/api/v1/lead/track` -- User journey tracking
- `https://forms.withsurface.com/api/v1/externalForm/initialize` -- Form view tracking
- `https://forms.withsurface.com/api/v1/externalForm/formStarted` -- Form start tracking
- `https://app.withsurface.com/api/v1/push-event` -- Event tracking (used by `surface_tracking.js`)

### Other Scripts (not part of the TS build)

- `surface_tracking.js` -- standalone visitor tracking module, independent from embed scripts
- `surface_track_demo.js` -- local dev version of tracking (points to `localhost:3000`)
- `surface_embed_script.js`, `_2.js`, `_3.js`, `_v4.js` -- legacy customer-specific embed scripts
- `surface_embed_slide_fullscreen.js` -- legacy fullscreen slide-over variant

## Debug Mode

Append `?surfaceDebug=true` to any page URL to enable verbose console logging.
