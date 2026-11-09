const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8792',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: process.env.CHROMIUM_EXECUTABLE_PATH ? ['--no-sandbox', '--no-zygote', '--disable-dev-shm-usage'] : []
    }
  },
  webServer: {
    command: 'HOST=127.0.0.1 PYTHONDONTWRITEBYTECODE=1 python3 serwer/server.py 8792',
    url: 'http://127.0.0.1:8792/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
