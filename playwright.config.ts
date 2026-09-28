import { defineConfig, devices } from '@playwright/test';

// Not vite preview's default (4173), so a preview you're running by hand is never reused.
const PORT = 4317;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}/` },
  // Smoke tests run against the production build, which is what ships.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'ipad-webkit', use: { ...devices['iPad Mini landscape'] } },
    { name: 'ipad-pro-webkit', use: { ...devices['iPad Pro 11 landscape'] } },
  ],
});
