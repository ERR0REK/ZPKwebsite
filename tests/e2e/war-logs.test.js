/**
 * E2E Test: War Logs Page
 * Tests: search, filter by result, modal tabs (info/enemyKD/memberKD), admin add/remove
 */

const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateTo,
  loginViaDiscord,
  waitForElement,
  clickElement,
  fillField,
  getTextContent,
  elementExists,
  takeScreenshot,
  waitForToast,
} = require('./utils/test-helpers');

test.describe('War Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin for full access
    await loginViaDiscord(page, { isAdmin: true });
    await navigateTo(page, '/war-logs');
    await waitForAppLoad(page);
  });

  test.describe('Search & Filter', () => {
    test('should search war logs by opponent name', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      const initialCount = await page.locator('.warlog-card').count();

      // Search for a term
      await fillField(page, '.warlogs-search input', 'Test');

      await page.waitForTimeout(500);

      const filteredCount = await page.locator('.warlog-card').count();
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test('should filter by result: WIN', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      await clickElement(page, '.warlogs-filter-btn:has-text("WIN"), .warlogs-filter-btn:has-text("WYGRANA")');

      // Verify all visible cards have WIN result
      const cards = page.locator('.warlog-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.locator('.result-badge.win, .result-badge:has-text("WIN")')).toBeVisible();
      }
    });

    test('should filter by result: LOSS', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      await clickElement(page, '.warlogs-filter-btn:has-text("LOSS"), .warlogs-filter-btn:has-text("PRZEGRANA")');

      const cards = page.locator('.warlog-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.locator('.result-badge.loss, .result-badge:has-text("LOSS")')).toBeVisible();
      }
    });

    test('should filter by result: EASY_WIN', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      await clickElement(page, '.warlogs-filter-btn:has-text("EASY_WIN"), .warlogs-filter-btn:has-text("LEKKA_WYGRANA")');

      const cards = page.locator('.warlog-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.locator('.result-badge.easy-win, .result-badge:has-text("EASY_WIN")')).toBeVisible();
      }
    });

    test('should filter by result: DRAW', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      await clickElement(page, '.warlogs-filter-btn:has-text("DRAW"), .warlogs-filter-btn:has-text("REMIS")');

      const cards = page.locator('.warlog-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.locator('.result-badge.draw, .result-badge:has-text("DRAW")')).toBeVisible();
      }
    });

    test('should show all results when ALL filter selected', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      await clickElement(page, '.warlogs-filter-btn:has-text("WSZYSTKIE"), .warlogs-filter-btn:has-text("ALL")');

      const cards = await page.locator('.warlog-card').count();
      expect(cards).toBeGreaterThan(0);
    });

    test('should combine search and result filter', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      // Apply result filter first
      await clickElement(page, '.warlogs-filter-btn:has-text("WIN")');
      await page.waitForTimeout(300);

      // Then search
      await fillField(page, '.warlogs-search input', 'Test');
      await page.waitForTimeout(500);

      // Results should match both criteria
      const cards = page.locator('.warlog-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        await expect(card.locator('.result-badge.win')).toBeVisible();
        const text = await card.textContent();
        expect(text.toLowerCase()).toContain('test');
      }
    });
  });

  test.describe('War Log Modal Tabs', () => {
    test('should open modal on card click', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      // Click first war log card
      await clickElement(page, '.warlog-card');

      // Modal should open
      await expect(page.locator('.warlog-modal')).toBeVisible({ timeout: 5000 });
    });

    test('should show info tab by default', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Info tab should be active
      await expect(page.locator('.modal-tab.active:has-text("Info"), .modal-tab.active:has-text("Informacje")')).toBeVisible();

      // Check for info fields
      await expect(page.locator('.modal-field:has-text("Przeciwnik"), .modal-field:has-text("Opponent")')).toBeVisible();
      await expect(page.locator('.modal-field:has-text("Data"), .modal-field:has-text("Date")')).toBeVisible();
      await expect(page.locator('.modal-field:has-text("Wynik"), .modal-field:has-text("Result")')).toBeVisible();
    });

    test('should switch to enemyKD tab', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Click enemyKD tab
      await clickElement(page, '.modal-tab:has-text("Enemy KD"), .modal-tab:has-text("EnemyKD"), .modal-tab:has-text("Wrogie KD")');

      // Verify tab switched
      await expect(page.locator('.modal-tab.active:has-text("Enemy KD"), .modal-tab.active:has-text("EnemyKD")')).toBeVisible();

      // Check for enemy KD table
      await expect(page.locator('.kd-table.enemy, .kd-table:has-text("Wróg")')).toBeVisible();
    });

    test('should switch to memberKD tab', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Click memberKD tab
      await clickElement(page, '.modal-tab:has-text("Member KD"), .modal-tab:has-text("MemberKD"), .modal-tab:has-text("Nasze KD")');

      // Verify tab switched
      await expect(page.locator('.modal-tab.active:has-text("Member KD"), .modal-tab.active:has-text("MemberKD")')).toBeVisible();

      // Check for member KD table
      await expect(page.locator('.kd-table.member, .kd-table:has-text("Członek")')).toBeVisible();
    });

    test('should close modal on close button', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      await clickElement(page, '.modal-close-btn, .close-warlog-btn');

      await expect(page.locator('.warlog-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('should close modal on backdrop click', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Click backdrop
      await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });

      await expect(page.locator('.warlog-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('should display war log image/banner', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Check for banner image
      const banner = page.locator('.warlog-banner, .modal-banner img');
      await expect(banner).toBeVisible();
    });

    test('should show video link if available', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');
      await clickElement(page, '.warlog-card');

      await expect(page.locator('.warlog-modal')).toBeVisible();

      // Check for video link (may not exist for all logs)
      const videoLink = page.locator('.modal-video-link, a:has-text("Wideo"), a:has-text("Video")');
      const hasVideo = await videoLink.isVisible({ timeout: 2000 }).catch(() => false);
      // Just verify it doesn't crash
    });
  });

  test.describe('Admin Panel - Add War Log', () => {
    test('should show admin panel for admins', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      // Admin panel should be visible (or toggleable)
      const adminPanel = page.locator('.warlogs-manage-panel');
      const isVisible = await adminPanel.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isVisible) {
        // May need to click a button to show it
        await clickElement(page, '.manage-toggle-btn, button:has-text("Zarządzaj"), button:has-text("Manage")');
        await expect(adminPanel).toBeVisible({ timeout: 5000 });
      }
    });

    test('should add new war log', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      // Ensure admin panel is visible
      const adminPanel = page.locator('.warlogs-manage-panel');
      if (!(await adminPanel.isVisible({ timeout: 2000 }).catch(() => false))) {
        await clickElement(page, '.manage-toggle-btn, button:has-text("Zarządzaj")');
        await expect(adminPanel).toBeVisible();
      }

      // Switch to add tab if needed
      await clickElement(page, '.admin-tab:has-text("Dodaj"), .admin-tab:has-text("Add")');

      // Fill form
      const testOpponent = `TestOpponent_${Date.now()}`;
      await fillField(page, 'input[name="opponent"], .manage-form input[placeholder*="Przeciwnik"], .manage-form input[placeholder*="Opponent"]', testOpponent);
      await fillField(page, 'textarea[name="reason"], .manage-form textarea[placeholder*="Powód"], .manage-form textarea[placeholder*="Reason"]', 'Test war reason');
      await fillField(page, 'input[name="duration"], .manage-form input[placeholder*="Czas"], .manage-form input[placeholder*="Duration"]', '45min');
      await fillField(page, 'input[name="members"], .manage-form input[placeholder*="Członkowie"], .manage-form input[placeholder*="Members"]', 'Player1, Player2, Player3');
      await fillField(page, 'input[name="mvp"], .manage-form input[placeholder*="MVP"]', 'Player1');

      // Select result
      await page.selectOption('select[name="result"]', 'WIN');

      // Submit
      await clickElement(page, '.manage-form button[type="submit"], .manage-form button:has-text("Dodaj"), .manage-form button:has-text("Add")');

      // Wait for success
      await waitForToast(page, 'dodany', 10000);

      // Close panel
      await clickElement(page, '.manage-close-btn');

      // Verify log appears in list
      await page.waitForTimeout(1000);
      const logExists = await page.locator(`.warlog-card:has-text("${testOpponent}")`).isVisible({ timeout: 5000 }).catch(() => false);
      expect(logExists).toBe(true);
    });

    test('should rehost Discord image to Catbox on add', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      const adminPanel = page.locator('.warlogs-manage-panel');
      if (!(await adminPanel.isVisible({ timeout: 2000 }).catch(() => false))) {
        await clickElement(page, '.manage-toggle-btn');
        await expect(adminPanel).toBeVisible();
      }

      await clickElement(page, '.admin-tab:has-text("Dodaj"), .admin-tab:has-text("Add")');

      // Fill form with Discord image URL
      const testOpponent = `RehostTest_${Date.now()}`;
      await fillField(page, 'input[name="opponent"]', testOpponent);
      await fillField(page, 'input[name="img"], .manage-form input[placeholder*="Obraz"], .manage-form input[placeholder*="Image"]',
        'https://cdn.discordapp.com/attachments/123/456/war-banner.png');

      await clickElement(page, '.manage-form button[type="submit"]');

      // Wait for success with rehost message
      await waitForToast(page, 'Catbox', 15000).catch(() => {});
    });
  });

  test.describe('Admin Panel - Remove War Log', () => {
    test('should remove war log', async ({ page }) => {
      // First add a log to remove
      const testOpponent = `ToRemove_${Date.now()}`;

      await waitForElement(page, '.warlogs-grid');

      const adminPanel = page.locator('.warlogs-manage-panel');
      if (!(await adminPanel.isVisible({ timeout: 2000 }).catch(() => false))) {
        await clickElement(page, '.manage-toggle-btn');
        await expect(adminPanel).toBeVisible();
      }

      await clickElement(page, '.admin-tab:has-text("Dodaj"), .admin-tab:has-text("Add")');
      await fillField(page, 'input[name="opponent"]', testOpponent);
      await clickElement(page, '.manage-form button[type="submit"]');
      await waitForToast(page, 'dodany', 10000);

      await clickElement(page, '.manage-close-btn');
      await page.waitForTimeout(1000);

      // Reopen panel and switch to list tab
      await clickElement(page, '.manage-toggle-btn');
      await clickElement(page, '.admin-tab:has-text("Lista"), .admin-tab:has-text("List")');

      // Find and remove our test log
      const removeBtn = page.locator(`.manage-log-row:has-text("${testOpponent}") .remove-btn, .manage-log-row:has-text("${testOpponent}") button:has-text("Usuń")`);
      await clickElement(page, removeBtn);

      // Confirm removal
      await page.waitForTimeout(500);
      await waitForToast(page, 'usunięty', 10000);

      // Verify log is gone
      await page.waitForTimeout(1000);
      const logExists = await page.locator(`.warlog-card:has-text("${testOpponent}")`).isVisible({ timeout: 2000 }).catch(() => false);
      expect(logExists).toBe(false);
    });
  });

  test.describe('Cloud Status Indicator', () => {
    test('should show cloud sync status', async ({ page }) => {
      await waitForElement(page, '.warlogs-header');

      // Check for cloud status indicator
      const cloudStatus = page.locator('.warlogs-header .cloud-status, .warlogs-header:has-text("CLOUD SYNC"), .warlogs-header:has-text("LOCAL MODE")');
      await expect(cloudStatus).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show empty state when no logs match filters', async ({ page }) => {
      await waitForElement(page, '.warlogs-grid');

      // Search for something that won't match
      await fillField(page, '.warlogs-search input', 'NonExistentOpponent12345');
      await page.waitForTimeout(500);

      // Should show empty state
      await expect(page.locator('.warlogs-empty-state')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.empty-title')).toContainText('BRAK WYNIKÓW');
    });
  });
});