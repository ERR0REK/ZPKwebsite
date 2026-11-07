/**
 * Global Setup for Playwright E2E Tests
 * Prepares test environment, handles authentication, and sets up test data
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function globalSetup(config) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Get baseURL from Playwright config
  const baseURL = config.projects[0]?.use?.baseURL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const isLocal = baseURL.includes('localhost');

  // Create test results directory
  const resultsDir = path.join(__dirname, '../playwright-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Launch browser for setup tasks
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // 1. Verify site accessibility
    console.log(`📡 Checking site availability: ${baseURL}`);
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ Site is accessible');

    // 2. Check for required page elements
    await page.waitForSelector('body', { timeout: 10000 });

    // 3. Clear any existing test data in localStorage
    await page.evaluate(() => {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('zpk_') || key.startsWith('i18next') || key.startsWith('selectedLanguage'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      // Also clear sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('ZPK_')) {
          sessionStorage.removeItem(key);
        }
      }
    });

    // 4. Save test configuration for use in tests
    const testConfig = {
      baseURL,
      isLocal,
      isProduction: !isLocal,
      timestamp: Date.now(),
    };
    fs.writeFileSync(
      path.join(resultsDir, 'test-config.json'),
      JSON.stringify(testConfig, null, 2)
    );

    console.log('✅ Global setup completed');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = globalSetup;