// Browser tests for ASHWGA. Serves ../../ashwga as a static site (as Render does)
// and runs every spec in Chromium; phones are emulated inside the tests.
const { defineConfig } = require('@playwright/test');
const path = require('path');

const PORT = 8014;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
    // Set PW_CHROMIUM_EXECUTABLE to use a Chromium that is already installed.
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } : {},
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --directory "${path.resolve(__dirname, '../../ashwga')}"`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    stderr: 'ignore', // python's per-request log lines
  },
});
