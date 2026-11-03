// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8877',
    trace: 'off',
  },
  webServer: {
    command: 'node tools/e2e-shop-server.mjs',
    url: 'http://127.0.0.1:8877/build/',
    reuseExistingServer: !process.env.CI,
  },
});
