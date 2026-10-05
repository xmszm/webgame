import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined);
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 90_000,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'evidence/e2e-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:3140', headless: true, launchOptions: { executablePath }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm start', env: { PORT: '3140', HOST: '127.0.0.1' }, url: 'http://127.0.0.1:3140/health', reuseExistingServer: false, timeout: 30_000 },
});
