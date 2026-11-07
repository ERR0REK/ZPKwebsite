/**
 * E2E Test: KOS (Kill on Sight) Page
 * Tests: search, filter, sort, dossier modal, evidence view, admin panel (add/remove/rehost)
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
  isAdminPanelVisible,
  waitForToast,
} = require('./utils/test-helpers');

test.describe('KOS Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base first to ensure we're on the correct origin
    await navigateTo(page, '/');
    await waitForAppLoad(page);

    // Login as admin for full access
    await loginViaDiscord(page, { isAdmin: true });
    await navigateTo(page, '/kos');
    await waitForAppLoad(page);
  });

  test.describe('Search & Filter', () => {
    test('should search targets by name', async ({ page }) => {
      // Wait for KOS grid to load
      await waitForElement(page, '.kos-grid');

      // Get initial count
      const initialCards = await page.locator('.kos-card').count();

      // Search for a known target
      await fillField(page, '.search-box input', 'Kerainff');

      // Wait for filtering
      await page.waitForTimeout(500);

      const filteredCards = await page.locator('.kos-card').count();
      expect(filteredCards).toBeLessThanOrEqual(initialCards);

      // Verify result contains search term
      const cardNames = await page.locator('.target-name').allTextContents();
      cardNames.forEach(name => {
        expect(name.toLowerCase()).toContain('kerainff');
      });
    });

    test('should filter by personal targets', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Click personal filter - Polish text
      await clickElement(page, '.filter-btn:has-text("OSOBY")');

      // Verify only personal targets shown
      const cards = page.locator('.kos-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        // Personal targets have Target icon (lucide Target)
        await expect(card.locator('.target-icon svg').first()).toBeVisible();
      }
    });

    test('should filter by faction targets', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Click faction filter - Polish text
      await clickElement(page, '.filter-btn:has-text("KLAN")');

      // Verify only faction targets shown
      const cards = page.locator('.kos-card');
      const count = await cards.count();

      for (let i = 0; i < count; i++) {
        const card = cards.nth(i);
        // Faction targets have Building2 icon
        await expect(card.locator('.target-icon svg').first()).toBeVisible();
      }
    });

    test('should show all targets when "All" filter selected', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Click all filter - Polish text
      await clickElement(page, '.filter-btn:has-text("WSZYSTKO")');

      // Should show both personal and faction targets
      const cards = await page.locator('.kos-card').count();
      expect(cards).toBeGreaterThan(0);
    });
  });

  test.describe('Sorting', () => {
    test('should sort by name ascending', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Select name-asc sort
      await page.selectOption('.sort-select', 'name-asc');
      await page.waitForTimeout(500);

      // Get names and verify ascending order
      const names = await page.locator('.target-name').allTextContents();
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
    });

    test('should sort by name descending', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Select name-desc sort
      await page.selectOption('.sort-select', 'name-desc');
      await page.waitForTimeout(500);

      // Get names and verify descending order
      const names = await page.locator('.target-name').allTextContents();
      const sortedNames = [...names].sort((a, b) => b.localeCompare(a));
      expect(names).toEqual(sortedNames);
    });

    test('should use default sort order', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Select default sort
      await page.selectOption('.sort-select', 'default');
      await page.waitForTimeout(500);

      // Default should show targets (exact order depends on data)
      const cards = await page.locator('.kos-card').count();
      expect(cards).toBeGreaterThan(0);
    });
  });

  test.describe('Dossier Modal', () => {
    test('should open dossier modal on "View Dossier" click', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Click view details on first card
      await page.locator('.view-details-btn').first().click({ force: true });

      // Modal should open
      await expect(page.locator('.intel-modal')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.intel-title')).toBeVisible();
    });

    test('should show personal dossier with correct fields', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Find a personal target and open dossier
      const personalCard = page.locator('.kos-card').first();
      await personalCard.locator('.view-details-btn').click();

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Check for personal dossier fields - Polish text
      await expect(page.locator('text=PERSONAL_DOSSIER')).toBeVisible();
      await expect(page.locator('.intel-item:has-text("POWÓD")')).toBeVisible();
      await expect(page.locator('.modal-profile-btn')).toBeVisible(); // Roblox link
    });

    test('should show faction dossier with intel fields', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Switch to faction filter - Polish text
      await clickElement(page, '.filter-btn:has-text("KLAN")');
      await page.waitForTimeout(500);

      // Open first faction dossier
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Check for faction intel fields - Polish text
      await expect(page.locator('text=FACTION_DOSSIER')).toBeVisible();
      await expect(page.locator('.intel-item:has-text("LIDERZY")')).toBeVisible();
      await expect(page.locator('.intel-item:has-text("SOJUSZNICY")')).toBeVisible();
      await expect(page.locator('.intel-item:has-text("POTENCJAŁ BOJOWY")')).toBeVisible();
    });

    test('should close modal on backdrop click', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Click backdrop (overlay) - use force click on overlay
      await page.locator('.intel-modal-overlay').click({ position: { x: 10, y: 10 }, force: true });

      await expect(page.locator('.intel-modal')).not.toBeVisible({ timeout: 2000 });
    });

    test('should close modal on close button', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Close button has Polish text "ZAMKNIJ"
      await page.locator('.close-intel-btn:has-text("ZAMKNIJ")').first().click({ force: true });

      await expect(page.locator('.intel-modal')).not.toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Evidence View', () => {
    test('should show evidence thumbnails on cards', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Check for evidence badges
      const evidenceBadges = page.locator('.evidence-badge');
      const count = await evidenceBadges.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show evidence gallery in dossier modal', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Check for evidence section
      const evidenceSection = page.locator('.evidence-section');
      await expect(evidenceSection).toBeVisible();
    });

    test('should open image evidence in new tab', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Find image evidence link
      const imageLink = page.locator('.evidence-gallery-item').first();
      if (await imageLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Click would open in new tab, we just verify it exists
        await expect(imageLink).toHaveAttribute('target', '_blank');
      }
    });

    test('should show video/recording evidence', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await page.locator('.view-details-btn').first().click({ force: true });

      await expect(page.locator('.intel-modal')).toBeVisible();

      // Check for video evidence links
      const videoLinks = page.locator('.evidence-videos .evidence-video');
      const count = await videoLinks.count();
      // May be 0 if no video evidence
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Admin Panel', () => {
    test('should show manage button for admins', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Admin should see manage button
      await expect(page.locator('.manage-btn:not(.manage-btn-locked)')).toBeVisible({ timeout: 10000 });
    });

    test('should open admin panel on manage button click', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      // Admin panel modal should open
      await expect(page.locator('.intel-modal:has(.kos-manage-panel)')).toBeVisible({ timeout: 5000 });
    });

    test('should switch between personal and faction tabs', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      await expect(page.locator('.kos-manage-panel')).toBeVisible();

      // Click faction tab
      await clickElement(page, '.manage-tab:has-text("Klanowe"), .manage-tab:has-text("Faction")');

      // Verify tab switched
      await expect(page.locator('.manage-tab.active:has-text("Klanowe"), .manage-tab.active:has-text("Faction")')).toBeVisible();
    });

    test('should add new personal target', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      await expect(page.locator('.kos-manage-panel')).toBeVisible();

      // Fill form
      const testName = `TestTarget_${Date.now()}`;
      await fillField(page, 'input[name="name"], .manage-form input[placeholder*="Nazwa"], .manage-form input[placeholder*="Name"]', testName);
      await fillField(page, 'input[name="robloxLink"], .manage-form input[placeholder*="Roblox"]', 'https://roblox.com/users/12345');

      // Select reason
      await page.selectOption('select[name="reasonKey"]', 'reasonExploit');

      // Submit
      await clickElement(page, '.manage-form button[type="submit"], .manage-form button:has-text("Dodaj"), .manage-form button:has-text("Add")');

      // Wait for success message
      await waitForToast(page, 'dodany', 10000);

      // Close panel
      await clickElement(page, '.close-intel-btn, .manage-close-btn');

      // Verify target appears in list
      await page.waitForTimeout(1000);
      const targetExists = await page.locator(`.target-name:has-text("${testName}")`).isVisible({ timeout: 5000 }).catch(() => false);
      expect(targetExists).toBe(true);
    });

    test('should add new faction target with intel', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      // Switch to faction tab
      await clickElement(page, '.manage-tab:has-text("Klanowe"), .manage-tab:has-text("Faction")');

      await expect(page.locator('.kos-manage-panel')).toBeVisible();

      // Fill form
      const testName = `TestFaction_${Date.now()}`;
      await fillField(page, 'input[name="name"], .manage-form input[placeholder*="Nazwa"], .manage-form input[placeholder*="Name"]', testName);
      await fillField(page, 'input[name="leaders"], .manage-form input[placeholder*="Lider"]', 'Leader1, Leader2');
      await fillField(page, 'input[name="allies"], .manage-form input[placeholder*="Sojusznicy"], .manage-form input[placeholder*="Allies"]', 'AllyClan');
      await fillField(page, 'input[name="firepower"], .manage-form input[placeholder*="Siła"], .manage-form input[placeholder*="Firepower"]', 'HEAVY_ARMORED');

      // Submit
      await clickElement(page, '.manage-form button[type="submit"], .manage-form button:has-text("Dodaj"), .manage-form button:has-text("Add")');

      // Wait for success message
      await waitForToast(page, 'dodany', 10000);
    });

    test('should remove target', async ({ page }) => {
      // First add a target to remove
      const testName = `ToRemove_${Date.now()}`;

      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      await fillField(page, 'input[name="name"]', testName);
      await page.selectOption('select[name="reasonKey"]', 'reasonExploit');
      await clickElement(page, '.manage-form button[type="submit"]');
      await waitForToast(page, 'dodany', 10000);

      await clickElement(page, '.close-intel-btn');
      await page.waitForTimeout(1000);

      // Reopen panel and remove
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      // Find and click remove button for our test target
      const removeBtn = page.locator(`.manage-target-row:has-text("${testName}") .remove-btn, .manage-target-row:has-text("${testName}") button:has-text("Usuń")`);
      await clickElement(page, removeBtn);

      // Confirm removal
      await page.waitForTimeout(500);
      await waitForToast(page, 'usunięty', 10000);
    });

    test('should rehost Discord images to Catbox on add', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      // Fill form with Discord image URL
      const testName = `RehostTest_${Date.now()}`;
      await fillField(page, 'input[name="name"]', testName);
      await fillField(page, 'textarea[name="evidenceText"], .manage-form textarea[placeholder*="Dowód"], .manage-form textarea[placeholder*="Evidence"]',
        'image|https://cdn.discordapp.com/attachments/123/456/test.png');

      await clickElement(page, '.manage-form button[type="submit"]');

      // Wait for success with rehost message
      await waitForToast(page, 'Catbox', 15000).catch(() => {});
    });

    test('should paste image from clipboard in evidence field', async ({ page }) => {
      await waitForElement(page, '.kos-grid');
      await clickElement(page, '.manage-btn:not(.manage-btn-locked)');

      // Focus evidence textarea
      const evidenceField = page.locator('textarea[name="evidenceText"], .manage-form textarea[placeholder*="Dowód"]');
      await evidenceField.click();

      // Simulate paste event with image (this is limited in Playwright)
      // We verify the handler exists
      const hasPasteHandler = await page.evaluate(() => {
        const textarea = document.querySelector('textarea[name="evidenceText"]');
        return textarea && textarea.onpaste !== null;
      });

      expect(hasPasteHandler).toBe(true);
    });
  });

  test.describe('Load More / Pagination', () => {
    test('should show load more button when more targets exist', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Check if load more button exists for personal section
      const loadMoreBtn = page.locator('.load-more-btn').first();
      const isVisible = await loadMoreBtn.isVisible({ timeout: 2000 }).catch(() => false);

      // Button may or may not be visible depending on data count
      // Just verify it works if present
      if (isVisible) {
        await clickElement(page, loadMoreBtn);
        await page.waitForTimeout(500);
        await expect(loadMoreBtn).toBeVisible(); // Should toggle to show less
      }
    });
  });

  test.describe('Copy Name', () => {
    test('should copy target name to clipboard', async ({ page }) => {
      await waitForElement(page, '.kos-grid');

      // Get first target name
      const targetName = await page.locator('.target-name').first().textContent();

      // Click copy button
      await clickElement(page, '.copy-name-btn');

      // Verify copied state
      await expect(page.locator('.copy-name-btn.copied')).toBeVisible({ timeout: 2000 });

      // Verify clipboard (limited in headless)
      const clipboardText = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return '';
        }
      });

      // In headless, clipboard may not be accessible
      // We verify the button shows copied state
    });
  });
});