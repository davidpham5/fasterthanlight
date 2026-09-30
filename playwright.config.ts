import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build. Run `npm run build` first.
export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4329' },
  webServer: {
    // Dedicated port so a dev/preview server on 4321 never gets reused by tests.
    command: 'npx astro preview --port 4329 --ignore-lock',
    url: 'http://localhost:4329',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
