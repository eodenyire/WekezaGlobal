/**
 * take-screenshots.js — Automated screenshot capture for the developer portal
 *
 * Uses Playwright to capture screenshots of major developer ecosystem modules:
 *   - Developer registration
 *   - Login
 *   - API key management
 *   - Sandbox testing
 *
 * Usage:
 *   node tests/e2e/take-screenshots.js [BASE_URL]
 *
 * Requirements:
 *   npm install -D playwright
 *   npx playwright install chromium
 *   WekezaGlobal stack running (./scripts/bring-up.sh)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_URL  = process.argv[3] || 'http://localhost:3001';
const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots/developer-ecosystem');

const TIMESTAMP_MS = Date.now();
const TEST_EMAIL    = `e2e-screenshot-${TIMESTAMP_MS}@fintech-test.io`;
const TEST_PASSWORD = 'E2eTest@Pass123';
const TEST_NAME     = `Screenshot Developer ${TIMESTAMP_MS}`;

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log(`Taking screenshots — Base URL: ${BASE_URL}`);
  console.log(`Screenshots will be saved to: ${SCREENSHOTS_DIR}`);
  console.log('');

  // ── 1. Registration ─────────────────────────────────────────────────────────

  console.log('[Step 1] Developer Registration...');
  ensureDir(path.join(SCREENSHOTS_DIR, '01-registration'));

  await page.goto(`${BASE_URL}/register`);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '01-registration', '01-registration-form.png'),
    fullPage: true,
  });
  console.log('  Saved: 01-registration/01-registration-form.png');

  // Fill and submit registration form (if it exists)
  try {
    await page.fill('[name="full_name"], [placeholder*="name" i]', TEST_NAME);
    await page.fill('[name="email"], [type="email"]', TEST_EMAIL);
    await page.fill('[name="password"], [type="password"]', TEST_PASSWORD);
    await page.click('[type="submit"], button:has-text("Register")');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-registration', '02-registration-success.png'),
      fullPage: true,
    });
    console.log('  Saved: 01-registration/02-registration-success.png');
  } catch (e) {
    console.log('  [WARN] Could not complete registration form:', e.message);
  }

  // ── 2. Login ─────────────────────────────────────────────────────────────────

  console.log('[Step 2] Login...');
  ensureDir(path.join(SCREENSHOTS_DIR, '02-login'));

  await page.goto(`${BASE_URL}/login`);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '02-login', '01-login-form.png'),
    fullPage: true,
  });
  console.log('  Saved: 02-login/01-login-form.png');

  try {
    await page.fill('[name="email"], [type="email"]', TEST_EMAIL);
    await page.fill('[name="password"], [type="password"]', TEST_PASSWORD);
    await page.click('[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-login', '02-dashboard-after-login.png'),
      fullPage: true,
    });
    console.log('  Saved: 02-login/02-dashboard-after-login.png');
  } catch (e) {
    console.log('  [WARN] Could not complete login:', e.message);
  }

  // ── 3. API Key Management ────────────────────────────────────────────────────

  console.log('[Step 3] API Key Management...');
  ensureDir(path.join(SCREENSHOTS_DIR, '03-api-key-management'));

  try {
    await page.goto(`${BASE_URL}/api-keys`);
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-api-key-management', '01-api-keys-list.png'),
      fullPage: true,
    });
    console.log('  Saved: 03-api-key-management/01-api-keys-list.png');

    // Click "Create" or "New Key" button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Key"), button:has-text("Generate")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03-api-key-management', '02-create-key-dialog.png'),
        fullPage: true,
      });
      console.log('  Saved: 03-api-key-management/02-create-key-dialog.png');

      // Fill key name
      const nameInput = page.locator('[name="name"], [placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('My Fintech App');
        await page.locator('[type="submit"], button:has-text("Create"), button:has-text("Generate")').last().click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, '03-api-key-management', '03-key-created.png'),
          fullPage: true,
        });
        console.log('  Saved: 03-api-key-management/03-key-created.png');
      }
    }
  } catch (e) {
    console.log('  [WARN] API key management screenshots failed:', e.message);
  }

  // ── 4. Sandbox Testing ───────────────────────────────────────────────────────

  console.log('[Step 4] Sandbox Testing — capturing API responses...');
  ensureDir(path.join(SCREENSHOTS_DIR, '04-sandbox-testing'));

  // Take screenshots of sandbox API responses directly
  const sandboxPage = await context.newPage();
  try {
    await sandboxPage.goto(`${API_URL}/v1/sandbox/health`);
    await sandboxPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-sandbox-testing', '01-sandbox-health.png'),
      fullPage: true,
    });
    console.log('  Saved: 04-sandbox-testing/01-sandbox-health.png');
  } catch (e) {
    console.log('  [WARN] Sandbox health screenshot failed:', e.message);
  }
  await sandboxPage.close();

  // ── 5. Monitoring ────────────────────────────────────────────────────────────

  console.log('[Step 5] Monitoring dashboards...');
  ensureDir(path.join(SCREENSHOTS_DIR, '05-monitoring'));

  const monitorPage = await context.newPage();
  try {
    // Prometheus targets
    await monitorPage.goto('http://localhost:9090/targets');
    await monitorPage.waitForTimeout(2000);
    await monitorPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-monitoring', '01-prometheus-targets.png'),
      fullPage: true,
    });
    console.log('  Saved: 05-monitoring/01-prometheus-targets.png');
  } catch (e) {
    console.log('  [INFO] Prometheus not reachable (OK in non-running env):', e.message);
  }

  try {
    // Grafana login
    await monitorPage.goto('http://localhost:3003/login');
    await monitorPage.waitForTimeout(1500);
    await monitorPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-monitoring', '02-grafana-login.png'),
      fullPage: true,
    });
    console.log('  Saved: 05-monitoring/02-grafana-login.png');
  } catch (e) {
    console.log('  [INFO] Grafana not reachable (OK in non-running env):', e.message);
  }
  await monitorPage.close();

  // ── 6. Developer Portal Overview ─────────────────────────────────────────────

  console.log('[Step 6] Developer portal overview...');
  ensureDir(path.join(SCREENSHOTS_DIR, '06-developer-portal'));

  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '06-developer-portal', '01-portal-home.png'),
    fullPage: true,
  });
  console.log('  Saved: 06-developer-portal/01-portal-home.png');

  await browser.close();

  console.log('');
  console.log('============================================================');
  console.log('  Screenshot capture complete.');
  console.log(`  Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log('============================================================');
}

takeScreenshots().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
