# Surface Tag - TypeScript Modularized

This is a modularized TypeScript version of the `surface_tag.js` file.

## Project Structure

```
surface-tag-ts/
├── src/
│   ├── utils/
│   │   ├── hash.ts              # Hash utilities (SHA-256)
│   │   ├── fingerprint.ts       # Browser fingerprinting
│   │   ├── script-utils.ts      # Script tag utilities
│   │   └── logger.ts            # Shared logging utilities (DRY)
│   ├── lead/
│   │   ├── types.ts             # Shared lead types (DRY)
│   │   ├── lead-data.ts         # Lead data storage with TTL
│   │   ├── session.ts           # Session ID generation
│   │   ├── identification.ts    # Lead identification
│   │   └── cookie-sync.ts       # Cookie synchronization
│   ├── form/
│   │   └── external-form.ts     # SurfaceExternalForm class
│   ├── store/
│   │   └── store.ts            # SurfaceStore class
│   ├── embed/
│   │   ├── embed.ts            # SurfaceEmbed class (main)
│   │   ├── embed-config.ts     # Configuration interfaces and constants
│   │   ├── embed-types.ts      # Embed type detection and handling
│   │   ├── embed-styles.ts     # Style generation (popup, widget, slideover)
│   │   ├── shared/
│   │   │   ├── iframe-utils.ts    # Iframe management utilities
│   │   │   ├── html-templates.ts  # Shared HTML templates (DRY)
│   │   │   ├── context-builder.ts # Context builder helper (DRY)
│   │   │   └── index.ts           # Shared exports
│   │   ├── popup/
│   │   │   ├── popup.ts        # Popup embed logic
│   │   │   └── index.ts        # Exports
│   │   ├── slideover/
│   │   │   ├── slideover.ts    # Slideover embed logic
│   │   │   └── index.ts        # Exports
│   │   ├── widget/
│   │   │   ├── widget.ts       # Widget embed logic
│   │   │   └── index.ts        # Exports
│   │   ├── inline/
│   │   │   ├── inline.ts       # Inline embed logic
│   │   │   └── index.ts        # Exports
│   │   └── input-trigger/
│   │       ├── input-trigger.ts # Input trigger logic
│   │       └── index.ts         # Exports
│   └── index.ts                # Main entry point
├── dist/
│   └── surface_tag.js          # Built output (single file)
├── package.json
├── tsconfig.json
└── build.js
```

## Building

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

This will:
- Compile TypeScript to JavaScript
- Bundle all modules into a single `dist/surface_tag.js` file
- The output file maintains the same global API as the original `surface_tag.js`

## Usage

The built `dist/surface_tag.js` file can be used exactly like the original `surface_tag.js`:

```html
<script src="dist/surface_tag.js" site-id="your-site-id"></script>
```

All global classes and functions remain available:
- `SurfaceEmbed`
- `SurfaceExternalForm`
- `SurfaceTagStore`
- `SurfaceIdentifyLead`
- etc.

## Development

Watch mode for development:
```bash
npm run dev
```

## Notes

- The functionality is identical to the original `surface_tag.js`
- All global variables and classes are preserved
- The code is now modularized for better maintainability
- TypeScript provides type safety during development

## DRY Principles Applied

The codebase follows DRY (Don't Repeat Yourself) principles:

- **Shared Types**: `lead/types.ts` contains `LeadData` and `IdentifiedLeadData` interfaces
- **Shared Logger**: `utils/logger.ts` provides reusable logging utilities
- **HTML Templates**: `embed/shared/html-templates.ts` centralizes HTML generation
- **Context Builder**: `embed/shared/context-builder.ts` reduces repetitive context creation
