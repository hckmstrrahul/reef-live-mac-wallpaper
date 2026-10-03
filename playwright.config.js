import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.js",
  workers: 1,
  timeout: 90000,
  use: {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4187",
    reuseExistingServer: true,
  },
});
