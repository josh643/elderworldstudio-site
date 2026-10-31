import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.PUBLIC_PORT || 4173);

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `WORLD_MODERATORS=e2e-mod PUBLIC_BIND=127.0.0.1 PUBLIC_PORT=${PORT} EWS_WORLD_DATA=.worlds-data-e2e node incoming/world-server/ews-world-src/worlds-host.mjs`,
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
