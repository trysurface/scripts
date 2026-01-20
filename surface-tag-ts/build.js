const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/surface_tag.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: false,
  keepNames: true,
  banner: {
    js: `// Surface Tag - Modularized TypeScript Build
// Built from TypeScript modules
`
  }
}).then(() => {
  console.log('✅ Build complete: dist/surface_tag.js');
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
