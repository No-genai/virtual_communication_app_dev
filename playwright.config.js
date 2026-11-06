import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
      ],
    },
  },
  webServer: {
    command: "npm run start",
    env: { DATA_DIR: `/tmp/komorebi-e2e-${process.pid}` },
    url: "http://127.0.0.1:3000/health",
    reuseExistingServer: false,
  },
  reporter: "list",
});
