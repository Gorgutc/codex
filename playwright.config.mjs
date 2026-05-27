import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/quality',
  timeout: 45_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
