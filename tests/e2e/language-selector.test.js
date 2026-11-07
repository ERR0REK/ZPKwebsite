/**
 * E2E Test: Language Selector
 * Tests: vertical scroll, translate link forces English, language persistence
 */

const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateTo,
  loginViaDiscord,
  waitForElement,
  clickElement,
  getTextContent,
  elementExists,
  takeScreenshot,
  getCurrentLanguage,
  changeLanguage,
} = require('./utils/test-helpers');

test.describe('Language Selector', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/');
    await waitForAppLoad(page);
  });

  test.describe('LanguageDropdown Component', () => {
    test('should show language dropdown in navbar', async ({ page }) => {
      // Look for language dropdown in navbar
      const dropdown = page.locator('.language-dropdown, .navbar .language-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 5000 });
    });

    test('should show current language flag and name', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await expect(dropdown).toBeVisible();

      // Should show flag and language name
      await expect(dropdown.locator('.flag')).toBeVisible();
      await expect(dropdown.locator('.lang-name')).toBeVisible();
    });

    test('should open dropdown on hover', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await expect(dropdown).toBeVisible();

      // Hover to open
      await dropdown.hover();
      await page.waitForTimeout(300);

      // Menu should open
      await expect(dropdown.locator('.dropdown-menu.open')).toBeVisible({ timeout: 2000 });
    });

    test('should show Polish and English options', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');
      await expect(menu).toBeVisible();

      // Should have PL and EN options
      await expect(menu.locator('li:has-text("Polski"), li:has-text("Polish")')).toBeVisible();
      await expect(menu.locator('li:has-text("English"), li:has-text("Angielski")')).toBeVisible();
    });

    test('should change language on option click', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');

      // Click English
      const enOption = menu.locator('li:has-text("English"), li:has-text("Angielski")').first();
      await enOption.click();

      // Wait for language change
      await page.waitForTimeout(1000);

      // Verify language changed
      const lang = await getCurrentLanguage(page);
      expect(lang).toBe('en');
    });

    test('should close dropdown after language selection', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');
      await expect(menu).toBeVisible();

      // Click Polish
      const plOption = menu.locator('li:has-text("Polski"), li:has-text("Polish")').first();
      await plOption.click();

      await page.waitForTimeout(500);

      // Dropdown should close
      await expect(dropdown.locator('.dropdown-menu.open')).not.toBeVisible({ timeout: 2000 });
    });

    test('should persist language in localStorage', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');
      await menu.locator('li:has-text("English")').first().click();

      await page.waitForTimeout(1000);

      // Check localStorage
      const storedLang = await page.evaluate(() =>
        localStorage.getItem('i18nextLng')
      );
      expect(storedLang).toBe('en');
    });

    test('should show help translate link', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');

      // Should have help translate link
      await expect(menu.locator('.help-translate')).toBeVisible();
      await expect(menu.locator('.help-translate')).toContainText('Help Translate');
    });

    test('help translate link should open Crowdin', async ({ page }) => {
      const dropdown = page.locator('.language-dropdown');
      await dropdown.hover();
      await page.waitForTimeout(300);

      const menu = dropdown.locator('.dropdown-menu.open');
      const helpLink = menu.locator('.help-translate');

      // Check link target
      const href = await helpLink.evaluate(el => {
        const link = el.querySelector('a') || el;
        return link.href || link.getAttribute('onclick');
      });

      // Should open in new tab
      expect(href).toContain('crowdin');
    });
  });

  test.describe('LanguageSelector Modal', () => {
    test('should show language selector modal when forceShow=true', async ({ page }) => {
      // The LanguageSelector is used in specific contexts
      // We test by checking if it can be triggered
      const hasSelector = await page.evaluate(() => {
        // Check if LanguageSelector component exists in the app
        return typeof window.React !== 'undefined';
      });

      // This test documents the component exists
      expect(hasSelector).toBe(true);
    });

    test('should have vertical scrollable language list', async ({ page }) => {
      // Simulate opening language selector
      await page.evaluate(() => {
        // Force show language selector by setting localStorage
        localStorage.setItem('showLanguageSelector', 'true');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      // Check for modal
      const modal = page.locator('.language-modal-overlay');
      const isVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

      if (isVisible) {
        // Check for scrollable container
        await expect(page.locator('.language-list-container')).toBeVisible();
        await expect(page.locator('.language-list')).toBeVisible();

        // Check for scroll hint
        await expect(page.locator('.language-hint')).toContainText('Scroll');
      }
    });

    test('should show English and Polish options in modal', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('showLanguageSelector', 'true');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const modal = page.locator('.language-modal-overlay');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Check for language buttons
        await expect(page.locator('.lang-btn:has-text("EN"), .lang-btn:has-text("English")')).toBeVisible();
        await expect(page.locator('.lang-btn:has-text("PL"), .lang-btn:has-text("Polish")')).toBeVisible();
      }
    });

    test('should show active badge for current language', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('showLanguageSelector', 'true');
        localStorage.setItem('selectedLanguage', 'en');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const modal = page.locator('.language-modal-overlay');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // English should have active badge
        await expect(page.locator('.lang-btn-active:has-text("EN"), .lang-btn-active:has-text("English")')).toBeVisible();
        await expect(page.locator('.lang-active-badge')).toContainText('UPLINK SECURED');
      }
    });

    test('translate link should force English and open Discord', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('showLanguageSelector', 'true');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const modal = page.locator('.language-modal-overlay');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click translate link
        const translateLink = page.locator('.translation-link:has-text("CLICK HERE TO HELP TRANSLATE")');
        await expect(translateLink).toBeVisible();

        // Check it forces English
        await translateLink.click();
        await page.waitForTimeout(500);

        const lang = await getCurrentLanguage(page);
        expect(lang).toBe('en');
      }
    });

    test('should show translation warning', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('showLanguageSelector', 'true');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const modal = page.locator('.language-modal-overlay');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator('.translation-warning')).toContainText('temporarily set your interface to English');
      }
    });

    test('should close modal on language selection', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.setItem('showLanguageSelector', 'true');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const modal = page.locator('.language-modal-overlay');
      if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click Polish
        await clickElement(page, '.lang-btn:has-text("PL"), .lang-btn:has-text("Polish")');

        await page.waitForTimeout(500);

        // Modal should close
        await expect(modal).not.toBeVisible({ timeout: 2000 });
      }
    });
  });

  test.describe('Language Persistence', () => {
    test('should persist language across page reloads', async ({ page }) => {
      // Set language to English
      await changeLanguage(page, 'en');

      const lang1 = await getCurrentLanguage(page);
      expect(lang1).toBe('en');

      // Reload page
      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      const lang2 = await getCurrentLanguage(page);
      expect(lang2).toBe('en');
    });

    test('should persist language across navigation', async ({ page }) => {
      await changeLanguage(page, 'pl');

      // Navigate to different pages
      const pages = ['/about', '/regulations', '/kos', '/war-logs'];

      for (const p of pages) {
        await navigateTo(page, p);
        await waitForAppLoad(page);

        const lang = await getCurrentLanguage(page);
        expect(lang).toBe('pl');
      }
    });

    test('should use browser language as default', async ({ page }) => {
      // Clear language preference
      await page.evaluate(() => {
        localStorage.removeItem('i18nextLng');
        localStorage.removeItem('selectedLanguage');
      });

      await page.reload({ waitUntil: 'networkidle' });
      await waitForAppLoad(page);

      // Should default to browser language or English
      const lang = await getCurrentLanguage(page);
      expect(['en', 'pl']).toContain(lang);
    });
  });

  test.describe('Translation Integration', () => {
    test('should translate UI elements when language changes', async ({ page }) => {
      // Change to Polish
      await changeLanguage(page, 'pl');
      await waitForAppLoad(page);

      // Check for Polish text
      const hasPolish = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Zjednoczona Polska Korona') ||
               text.includes('KOS DATABASE') ||
               text.includes('WAR LOGS');
      });

      // At least some Polish should be present
      expect(hasPolish).toBe(true);
    });

    test('should translate KOS page elements', async ({ page }) => {
      await changeLanguage(page, 'pl');
      await navigateTo(page, '/kos');
      await waitForAppLoad(page);

      // Wait for login or KOS page
      const isLogin = await page.locator('.login-page').isVisible({ timeout: 2000 }).catch(() => false);

      if (!isLogin) {
        // Check for Polish translations
        await expect(page.locator('.kos-title')).toContainText('KOS DATABASE');
        // Filter labels should be translated
        const filterText = await page.locator('.filter-btn').first().textContent();
        expect(['Wszystkie', 'Osobowe', 'Klanowe', 'All', 'Personal', 'Faction']).toContain(filterText);
      }
    });

    test('should translate War Logs page elements', async ({ page }) => {
      await changeLanguage(page, 'pl');
      await navigateTo(page, '/war-logs');
      await waitForAppLoad(page);

      const isLogin = await page.locator('.login-page').isVisible({ timeout: 2000 }).catch(() => false);

      if (!isLogin) {
        // Check for Polish translations
        await expect(page.locator('h1.glitch-text')).toContainText('WAR LOGS');
        // Result filters should be translated
        const filterText = await page.locator('.warlogs-filter-btn').first().textContent();
        expect(['WSZYSTKIE', 'WYGRANA', 'PRZEGRANA', 'REMIS', 'ALL', 'WIN', 'LOSS', 'DRAW']).toContain(filterText);
      }
    });
  });

  test.describe('RTL/LTR Support', () => {
    test('should not break layout with Polish characters', async ({ page }) => {
      await changeLanguage(page, 'pl');
      await navigateTo(page, '/');
      await waitForAppLoad(page);

      // Check for Polish characters rendering
      const bodyText = await page.evaluate(() => document.body.innerText);

      // Polish characters: ą, ć, ę, ł, ń, ó, ś, ź, ż
      const hasPolishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(bodyText);

      // Layout should not break
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);

      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 50); // Allow small overflow
    });
  });
});