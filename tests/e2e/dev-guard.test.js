/**
 * E2E Test: DevGuard - Developer Site Access Control
 * Tests: dev site access with/without dev session, redirect to login
 */

const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateTo,
  loginViaDiscord,
  logout,
  isAuthenticated,
  isDevSite,
  waitForElement,
  clickElement,
  getTextContent,
  takeScreenshot,
} = require('./utils/test-helpers');

test.describe('DevGuard - Developer Site Access', () => {
  test.beforeEach(async ({ page }) => {
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

  test('should detect dev site correctly', async ({ page }) => {
    await navigateTo(page, '/');
    await waitForAppLoad(page);

    const dev = await isDevSite(page);
    // This test documents the current environment
    console.log(`Running on ${dev ? 'DEV' : 'PRODUCTION'} site`);
  });

  test.describe('Access WITHOUT dev session', () => {
    test('should show login page with devMode when accessing dev site root', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Should show login page with devMode warning
      await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.dev-login-warning')).toBeVisible();
      await expect(page.locator('.dev-login-warning')).toContainText('WERSJA DEWELOPERSKA');
    });

    test('should show login page when accessing any dev route', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      const routes = ['/kos', '/war-logs', '/about', '/regulations', '/staff'];

      for (const route of routes) {
        await navigateTo(page, route);
        await waitForAppLoad(page);

        // All routes should redirect to login
        await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.dev-login-warning')).toBeVisible();
      }
    });

    test('should store redirect target in sessionStorage', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      const redirectTarget = await page.evaluate(() =>
        sessionStorage.getItem('ZPK_redirect_target')
      );

      expect(redirectTarget).toBe('/kos');
    });

    test('should not allow access to KOS without dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      // Should be on login page, not KOS
      await expect(page.locator('.login-page')).toBeVisible();
      await expect(page.locator('.kos-page')).not.toBeVisible();
    });

    test('should not allow access to War Logs without dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await navigateTo(page, '/war-logs');
      await waitForAppLoad(page);

      await expect(page.locator('.login-page')).toBeVisible();
      await expect(page.locator('.warlogs-page')).not.toBeVisible();
    });
  });

  test.describe('Access WITH dev session (is_dev_member = true)', () => {
    test('should allow access to dev site root with dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      // Login with dev member session
      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Should see home page, not login
      await expect(page.locator('.home-page, .hero, #root > div:not(.login-page)')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.login-page')).not.toBeVisible();
    });

    test('should allow access to KOS with dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      await expect(page.locator('.kos-page')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.kos-title')).toContainText('KOS DATABASE');
    });

    test('should allow access to War Logs with dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/war-logs');
      await waitForAppLoad(page);

      await expect(page.locator('.warlogs-page')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('h1.glitch-text')).toContainText('WAR LOGS');
    });

    test('should allow access to all pages with dev session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });

      const routes = ['/', '/about', '/regulations', '/staff', '/changelog', '/history', '/qa'];

      for (const route of routes) {
        await navigateTo(page, route);
        await waitForAppLoad(page);

        // Should not be on login page
        await expect(page.locator('.login-page')).not.toBeVisible();
      }
    });
  });

  test.describe('Access WITH regular session (is_dev_member = false)', () => {
    test('should NOT allow access to dev site with regular session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      // Login with regular (non-dev) session
      await loginViaDiscord(page, { isDevMember: false });
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Should still show login page (devMode)
      await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.dev-login-warning')).toBeVisible();
    });

    test('should NOT allow access to KOS with regular session', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: false });
      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      await expect(page.locator('.login-page')).toBeVisible();
      await expect(page.locator('.kos-page')).not.toBeVisible();
    });
  });

  test.describe('Session Expiry on Dev Site', () => {
    test('should redirect to login when dev session expires', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      // Create expired dev session
      await page.evaluate(() => {
        const expiredSession = {
          access_token: 'expired-dev-token',
          user_id: '111111111111111111',
          username: 'TestDev',
          avatar: null,
          is_admin: false,
          is_clan_member: false,
          is_dev_member: true,  // Dev member but expired
          is_main_member: true,
          timestamp: Date.now() - (13 * 60 * 60 * 1000) // 13 hours ago
        };
        localStorage.setItem('zpk_session', JSON.stringify(expiredSession));
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      // Should redirect to login due to expired session
      await expect(page.locator('.login-page')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Dev Banner', () => {
    test('should show dev banner on dev site', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Dev banner should be visible (full or collapsed)
      const banner = page.locator('.dev-banner-full, .dev-badge.visible');
      await expect(banner).toBeVisible({ timeout: 5000 });
    });

    test('dev banner should collapse after 5 seconds', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Wait for banner to collapse (5 seconds + buffer)
      await page.waitForTimeout(6000);

      // Should show badge only
      await expect(page.locator('.dev-badge.visible')).toBeVisible({ timeout: 5000 });
    });

    test('clicking dev badge should expand banner', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      await loginViaDiscord(page, { isDevMember: true });
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Wait for collapse
      await page.waitForTimeout(6000);

      // Click badge
      await clickElement(page, '.dev-badge.visible');

      // Full banner should reappear
      await expect(page.locator('.dev-banner-full')).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Redirect After Login on Dev Site', () => {
    test('should redirect to original target after dev login', async ({ page }) => {
      const dev = await isDevSite(page);
      if (!dev) {
        test.skip('Not running on dev site');
      }

      // Try to access KOS
      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      // Should be on login with redirect stored
      const redirectTarget = await page.evaluate(() =>
        sessionStorage.getItem('ZPK_redirect_target')
      );
      expect(redirectTarget).toBe('/kos');

      // Login with dev session
      await loginViaDiscord(page, { isDevMember: true });

      // Should redirect to KOS
      await expect(page.locator('.kos-page')).toBeVisible({ timeout: 10000 });
    });
  });
});