import { defineConfig } from '@playwright/test';

/**
 * UX audit smoke suite (Sprint 0).
 *
 * Guards the "Do Not Break" checklist in docs/ux-audit/do-not-break.md.
 * Runs against a fresh `npm run dev:audit` server (HMR disabled) on :3000.
 */
export default defineConfig({
  testDir: './scripts/ux-audit/tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: 'npm run dev:audit',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { DISABLE_HMR: 'true' },
  },
});
