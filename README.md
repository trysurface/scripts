# Surface Tag

Client-side scripts that embed [Surface](https://withsurface.com) forms into third-party websites. Loaded as a `<script>` tag on customer sites via CDN.

## Getting Started

```bash
pnpm install
pnpm run build
```

## Scripts

| Command | Description |
|---|---|
| `pnpm run build` | Bundle `src/` into `surface_tag.js` |
| `pnpm run dev` | Watch mode with sourcemaps |
| `pnpm run typecheck` | TypeScript type checking |

## Development

Source code is TypeScript in `src/`. [esbuild](https://esbuild.github.io/) bundles it into a single `surface_tag.js` IIFE. The CDN auto-minifies it as `surface_tag.min.js` via [jsdelivr](https://www.jsdelivr.com/).

```bash
# Terminal 1
pnpm run dev

# Terminal 2
cd test && ./serve.sh
```

Open `http://localhost:8000/test/index.html` to test all embed types.

## Embedding Types

- **Popup** -- modal overlay triggered by button click
- **Slideover** -- full-height side panel
- **Inline** -- embedded iframe within the page
- **Widget** -- floating button that opens a popup
- **Input Trigger** -- popup/slideover triggered by email form submission

See [docs](https://docs.withsurface.com/docs/surface-tag/installation) for integration guides.

## Test Checklist

1. All five embedding types render and function correctly
2. Tag script size: ~61 KiB uncompressed, ~9.8 KiB minified (CDN)
3. Identity API call completes in <0.5s on slow 4G; no issues if blocked/failed
4. PostMessage to iframe: query params, prefilled email, cookies, URL/origin/referrer
5. Form loading speed on withsurface.com
