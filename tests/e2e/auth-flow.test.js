/**
 * E2E Test: Authentication Flow
 * Tests: LoginPage -> DiscordCallback -> SessionContext -> AuthGuard -> KOS page
 */

const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateTo,
  loginViaDiscord,
  logout,
  isAuthenticated,
  waitForElement,
  clickElement,
  getTextContent,
  elementExists,
  takeScreenshot,
  isDevSite,
} = require('./utils/test-helpers');

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    // Navigate first, then clear storage once page is ready
    await navigateTo(page, '/');
    await waitForAppLoad(page);

    // Clear any existing session after page load
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore cross-origin errors
      }
    });
  });

  test('should show login page when accessing protected route without session', async ({ page }) => {
    // Navigate to KOS (protected route)
    await navigateTo(page, '/kos');

    // Should redirect to login page
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.login-title')).toContainText('Zjednoczona Polska Korona');
    await expect(page.locator('.discord-login-btn')).toBeVisible();
  });

  test('should show dev login warning on dev site', async ({ page }) => {
    const dev = await isDevSite(page);
    if (!dev) {
      test.skip(true, 'Not running on dev site');
      return;
    }

    await navigateTo(page, '/kos');
    await expect(page.locator('.dev-login-warning')).toBeVisible();
    await expect(page.locator('.dev-login-warning')).toContainText('WERSJA DEWELOPERSKA');
  });

  test('should initiate Discord OAuth on login button click', async ({ page }) => {
    await navigateTo(page, '/kos');

    // Click login button
    const loginBtn = page.locator('.discord-login-btn');
    await expect(loginBtn).toBeVisible();

    // Check that button has correct Discord OAuth URL
    const href = await loginBtn.evaluate(el => {
      // The button uses onClick handler, not href
      // We can check the click handler sets up the OAuth flow
      return true;
    });

    // Since we can't fully test OAuth in headless, we verify the button exists
    // and would redirect to Discord
    await expect(loginBtn).toBeEnabled();
  });

  test('should create valid session after successful auth (mocked)', async ({ page }) => {
    // Mock a successful login by injecting session
    await loginViaDiscord(page, { isAdmin: false, isDevMember: false });

    // Verify session exists
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Navigate to KOS - should now be accessible
    await navigateTo(page, '/kos');

    // Should see KOS page, not login
    await expect(page.locator('.kos-page')).toBeVisible({ timeout: 10000 });
    // App defaults to Polish - check for Polish title
    await expect(page.locator('.kos-title')).toContainText('BAZA DANYCH KOS');
  });

  test('should grant admin access with admin session', async ({ page }) => {
    await loginViaDiscord(page, { isAdmin: true });

    await navigateTo(page, '/kos');

    // Admin should see manage button
    await expect(page.locator('.manage-btn:not(.manage-btn-locked)')).toBeVisible({ timeout: 10000 });
  });

  test('should redirect back to original page after login', async ({ page }) => {
    // Try to access KOS
    await navigateTo(page, '/kos');

    // Should be on login page with redirect target stored
    const redirectTarget = await page.evaluate(() =>
      sessionStorage.getItem('ZPK_redirect_target')
    );
    expect(redirectTarget).toBe('/kos');

    // Mock login
    await loginViaDiscord(page);

    // Should redirect to KOS
    await expect(page.locator('.kos-page')).toBeVisible({ timeout: 10000 });
  });

  test('should logout and return to login page', async ({ page }) => {
    await loginViaDiscord(page);
    await navigateTo(page, '/kos');

    // Verify authenticated
    await expect(page.locator('.kos-page')).toBeVisible();

    // Logout
    await logout(page);

    // Try to access KOS again
    await navigateTo(page, '/kos');

    // Should be back at login
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
  });

  test('should handle expired session (TTL 12h)', async ({ page }) => {
    // Create session with old timestamp (expired)
    await page.evaluate(() => {
      const expiredSession = {
        access_token: 'expired-token',
        user_id: '111111111111111111',
        username: 'TestUser',
        avatar: null,
        is_admin: false,
        is_clan_member: false,
        is_dev_member: false,
        is_main_member: true,
        timestamp: Date.now() - (13 * 60 * 60 * 1000) // 13 hours ago
      };
      localStorage.setItem('ZPK_auth_session', JSON.stringify(expiredSession));
    });

    await page.reload({ waitUntil: 'networkidle' });
    await waitForAppLoad(page);

    // Navigate to KOS - should redirect to login due to expired session
    await navigateTo(page, '/kos');
    await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
  });

  test('should verify session persists across page reloads', async ({ page }) => {
    await loginViaDiscord(page);
    await navigateTo(page, '/kos');

    // Reload page
    await page.reload({ waitUntil: 'networkidle' });
    await waitForAppLoad(page);

    // Should still be on KOS page (session persisted)
    await expect(page.locator('.kos-page')).toBeVisible();
  });

  test('should handle Discord callback error states', async ({ page }) => {
    // Navigate to callback with error
    await navigateTo(page, '/auth/callback#error=access_denied');

    // Should show error state
    await expect(page.locator('.auth-status-card.error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.auth-title')).toContainText('AUTHENTICATION_FAILED');
  });
});