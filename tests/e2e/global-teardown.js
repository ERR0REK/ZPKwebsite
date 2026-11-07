/**
 * Global Teardown for Playwright E2E Tests
 * Cleans up test data and generates final report
 */

const fs = require('fs');
const path = require('path');

async function globalTeardown(config) {
  console.log('🧹 Starting global teardown...');

  const resultsDir = path.join(__dirname, '../playwright-results');

  try {
    // 1. Collect test results
    const resultsFile = path.join(resultsDir, 'playwright-results.json');
    let summary = { passed: 0, failed: 0, skipped: 0, total: 0 };

    if (fs.existsSync(resultsFile)) {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      summary = {
        passed: results.suites?.reduce((acc, s) => acc + (s.specs?.filter(sp => sp.ok).length || 0), 0) || 0,
        failed: results.suites?.reduce((acc, s) => acc + (s.specs?.filter(sp => !sp.ok && !sp.skipped).length || 0), 0) || 0,
        skipped: results.suites?.reduce((acc, s) => acc + (s.specs?.filter(sp => sp.skipped).length || 0), 0) || 0,
        total: results.suites?.reduce((acc, s) => acc + (s.specs?.length || 0), 0) || 0,
      };
    }

    // 2. Generate summary report
    const summaryReport = {
      timestamp: new Date().toISOString(),
      environment: config.projects[0].use.baseURL || 'unknown',
      summary,
      artifacts: {
        reportDir: 'playwright-report',
        resultsFile: 'playwright-results.json',
      }
    };

    fs.writeFileSync(
      path.join(resultsDir, 'test-summary.json'),
      JSON.stringify(summaryReport, null, 2)
    );

    console.log('📊 Test Summary:', summary);
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('⚠️ Teardown warning:', error.message);
    // Don't throw - teardown should not fail the test run
  }
}

module.exports = globalTeardown;