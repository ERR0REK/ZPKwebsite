/**
 * Test Helper Utilities for ZPK Website E2E Tests
 * Provides common functions for authentication, navigation, and assertions
 */

const { expect } = require('@playwright/test');

/**
 * Wait for the application to fully load
 */
async function waitForAppLoad(page) {
  // Wait for React app to mount
  await page.waitForSelector('#root', { timeout: 10000 });
  // Wait for any loading screens to disappear
  await page.waitForFunction(
    () => !document.querySelector('.loading-screen, .route-fallback'),
    { timeout: 15000 }
  ).catch(() => {
    // Loading screen might not exist, continue
  });
}

/**
 * Check if we're on a dev site
 * Matches the app's logic in src/utils/siteEnv.js:
 * Only dev-zpkwebsite.netlify.app is considered a dev site.
 * Localhost is NOT a dev site.
 */
async function isDevSite(page) {
  return page.evaluate(() => {
    return window.location.hostname === 'dev-zpkwebsite.netlify.app' ||
           document.querySelector('.dev-banner-full') !== null;
  });
}

/**
 * Navigate to a page and wait for load
 */
async function navigateTo(page, path) {
  // App uses HashRouter, so paths need # prefix
  const hashPath = path.startsWith('#') ? path : '#' + path;
  await page.goto(hashPath, { waitUntil: 'domcontentloaded' });
  // Wait for React to mount
  await page.waitForSelector('#root', { timeout: 10000 });
  // Wait a bit for any hydration
  await page.waitForTimeout(300);
}

/**
 * Login via Discord OAuth (simulated for testing)
 * In production tests, this would use a test Discord account
 * For local tests, we can mock the session
 */
async function loginViaDiscord(page, options = {}) {
  const { isAdmin = false, isDevMember = false } = options;

  // For E2E tests, we'll inject a valid session directly
  // since we can't easily automate Discord OAuth in CI
  await page.evaluate((sessionData) => {
    const session = {
      access_token: 'test-token-' + Date.now(),
      user_id: sessionData.isAdmin ? '687701665771814939' : '111111111111111111',
      username: sessionData.isAdmin ? 'TestAdmin' : 'TestUser',
      avatar: null,
      is_admin: sessionData.isAdmin,
      is_clan_member: false,
      is_dev_member: sessionData.isDevMember,
      is_main_member: true,
      timestamp: Date.now()
    };
    // Use the correct session key from the app
    localStorage.setItem('ZPK_auth_session', JSON.stringify(session));
  }, { isAdmin, isDevMember });

  // Reload to apply session
  await page.reload({ waitUntil: 'networkidle' });
  await waitForAppLoad(page);
}

/**
 * Logout by clearing session
 */
async function logout(page) {
  await page.evaluate(() => {
    localStorage.removeItem('ZPK_auth_session');
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await waitForAppLoad(page);
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated(page) {
  return page.evaluate(() => {
    const session = localStorage.getItem('ZPK_auth_session');
    if (!session) return false;
    try {
      const data = JSON.parse(session);
      return !!(data && data.user_id && data.access_token);
    } catch {
      return false;
    }
  });
}

/**
 * Wait for element with retry
 */
async function waitForElement(page, selector, options = {}) {
  const { timeout = 10000, state = 'visible' } = options;
  await page.waitForSelector(selector, { timeout, state });
  return page.locator(selector);
}

/**
 * Fill form field with clear
 */
async function fillField(page, selector, value) {
  const field = page.locator(selector);
  await field.clear();
  await field.fill(value);
}

/**
 * Click with force if needed
 */
async function clickElement(page, selector, options = {}) {
  await page.locator(selector).click({ force: true, ...options });
}

/**
 * Get text content safely
 */
async function getTextContent(page, selector) {
  return page.locator(selector).textContent() || '';
}

/**
 * Check if element exists
 */
async function elementExists(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 2000, state: 'attached' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshot with timestamp
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  await page.screenshot({ path: `tests/e2e/screenshots/${filename}`, fullPage: true });
  return filename;
}

/**
 * Mock Ably connection for testing
 */
async function mockAblyConnection(page, status = 'online') {
  await page.evaluate((connStatus) => {
    // Mock the RealtimeContext
    window.__MOCK_ABLY_STATUS__ = connStatus;
    // Dispatch custom event for components listening
    window.dispatchEvent(new CustomEvent('ably-status-change', { detail: connStatus }));
  }, status);
}

/**
 * Simulate keyboard shortcut
 */
async function pressKey(page, key, modifiers = []) {
  await page.keyboard.press(key, { modifiers });
}

/**
 * Test right-click context menu blocking
 */
async function testContextMenuBlocking(page) {
  await page.evaluate(() => {
    // Try to trigger context menu
    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    document.body.dispatchEvent(event);
  });

  // Check if alert was shown
  const alertVisible = await page.locator('.security-breach-overlay').isVisible({ timeout: 1000 }).catch(() => false);
  return alertVisible;
}

/**
 * Test F12 blocking
 */
async function testF12Blocking(page) {
  await page.keyboard.press('F12');

  // Check if alert was shown
  const alertVisible = await page.locator('.security-breach-overlay').isVisible({ timeout: 1000 }).catch(() => false);
  return alertVisible;
}

/**
 * Test Ctrl+Shift+I blocking
 */
async function testDevToolsBlocking(page) {
  await page.keyboard.press('I', { modifiers: ['Control', 'Shift'] });

  // Check if alert was shown
  const alertVisible = await page.locator('.security-breach-overlay').isVisible({ timeout: 1000 }).catch(() => false);
  return alertVisible;
}

/**
 * Test Ctrl+U blocking
 */
async function testViewSourceBlocking(page) {
  await page.keyboard.press('U', { modifiers: ['Control'] });

  // Check if alert was shown
  const alertVisible = await page.locator('.security-breach-overlay').isVisible({ timeout: 1000 }).catch(() => false);
  return alertVisible;
}

/**
 * Wait for Ably connection status
 */
async function waitForAblyStatus(page, expectedStatus, timeout = 10000) {
  await page.waitForFunction(
    (status) => window.__ABLY_STATUS__ === status,
    expectedStatus,
    { timeout }
  );
}

/**
 * Get current language
 */
async function getCurrentLanguage(page) {
  return page.evaluate(() => {
    return localStorage.getItem('i18nextLng') || localStorage.getItem('selectedLanguage') || 'en';
  });
}

/**
 * Change language
 */
async function changeLanguage(page, lang) {
  await page.evaluate((lng) => {
    localStorage.setItem('i18nextLng', lng);
    localStorage.setItem('selectedLanguage', lng);
    // Trigger i18n change if available
    if (window.i18n) {
      window.i18n.changeLanguage(lng);
    }
  }, lang);
  await page.reload({ waitUntil: 'networkidle' });
  await waitForAppLoad(page);
}

/**
 * Wait for toast notification
 */
async function waitForToast(page, expectedText, timeout = 5000) {
  await page.waitForSelector(`.toast:has-text("${expectedText}")`, { timeout });
}

/**
 * Check if admin panel is visible
 */
async function isAdminPanelVisible(page) {
  return page.locator('.kos-manage-panel, .warlogs-manage-panel').isVisible({ timeout: 2000 }).catch(() => false);
}

module.exports = {
  waitForAppLoad,
  isDevSite,
  navigateTo,
  loginViaDiscord,
  logout,
  isAuthenticated,
  waitForElement,
  fillField,
  clickElement,
  getTextContent,
  elementExists,
  takeScreenshot,
  mockAblyConnection,
  pressKey,
  testContextMenuBlocking,
  testF12Blocking,
  testDevToolsBlocking,
  testViewSourceBlocking,
  waitForAblyStatus,
  getCurrentLanguage,
  changeLanguage,
  waitForToast,
  isAdminPanelVisible,
};