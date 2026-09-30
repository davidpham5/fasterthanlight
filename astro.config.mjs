import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fasterthanlight.studio',
  output: 'static',
  // Emit scripts as files (never inline) so the CSP can use script-src 'self'.
  vite: { build: { assetsInlineLimit: 0 } },
});
