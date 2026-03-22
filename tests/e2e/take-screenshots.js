/**
 * take-screenshots.js — Automated screenshot capture for the WekezaGlobal
 * Developer Ecosystem.
 *
 * Covers ALL pages and key interactions:
 *   01-registration  — Registration form + success
 *   02-login         — Login form + dashboard redirect
 *   03-api-key-mgmt  — API keys list + create + key shown + webhooks
 *   04-sandbox       — Sandbox playground: health, wallet, FX, risk, identity
 *   05-monitoring    — Developer analytics (overview / events / changelog)
 *   06-portal        — Developer Portal + all other UI pages
 *
 * Usage:
 *   node tests/e2e/take-screenshots.js [BASE_UI_URL] [BASE_API_URL]
 *
 * Requirements:
 *   npm install playwright
 *   npx playwright install chromium
 *   WekezaGlobal backend running on localhost:3001
 *   WekezaGlobal frontend running on localhost:3000
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_UI  = process.argv[2] || 'http://localhost:3000';
const API_URL  = process.argv[3] || 'http://localhost:3001';

const SCREENSHOTS_DIR = path.join(__dirname, '../../screenshots/developer-ecosystem');

const TIMESTAMP_MS = Date.now();
const TEST_EMAIL    = `e2e-screenshot-${TIMESTAMP_MS}@fintech-test.io`;
const TEST_PASSWORD = 'E2eTest@Pass123';
const TEST_NAME     = `Screenshot Developer ${TIMESTAMP_MS}`;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function takeScreenshots() {
  // ── Pre-register so we have credentials for UI login ─────────────────────
  console.log('\n[Pre-req] Registering test developer via API...');
  const http = require('http');
  const registerPayload = JSON.stringify({
    full_name: TEST_NAME,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    phone_number: '+254700999001',
    account_type: 'startup',
  });

  const jwt = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/auth/register', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(registerPayload) },
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body).access_token); } catch { reject(new Error(`Registration failed (HTTP ${res.statusCode})`)); }
      });
    });
    req.on('error', reject);
    req.write(registerPayload);
    req.end();
  });
  console.log('  ✓ Registered and obtained JWT');

  // ── Create API key via API so we can show it on the UI page ──────────────
  await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ name: 'My Fintech App' });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/v1/api-keys', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  console.log('  ✓ API key created');

  // ── Register a webhook ────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const payload = JSON.stringify({ url: 'https://webhook.site/screenshot', events: ['deposit', 'settlement_completed'] });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/v1/webhooks', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
  console.log('  ✓ Webhook registered');

  // ── Launch browser ────────────────────────────────────────────────────────
  console.log('\n[Browser] Launching Chromium 1440×900...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let shotCount = 0;
  async function shot(dir, filename, description) {
    shotCount++;
    const dirPath = path.join(SCREENSHOTS_DIR, dir);
    ensureDir(dirPath);
    await page.screenshot({ path: path.join(dirPath, filename), fullPage: true });
    console.log(`  [${String(shotCount).padStart(2, '0')}] ✓  ${description}`);
  }

  // ── 01 REGISTRATION ───────────────────────────────────────────────────────
  console.log('\n[01] Registration Flow');
  await page.goto(`${BASE_UI}/register`);
  await delay(1500);
  await shot('01-registration', '01-registration-form.png', 'Registration page (empty form)');

  try {
    await page.fill('[name="full_name"], [placeholder*="name" i]', `${TEST_NAME} Registration Flow`);
    await page.fill('[type="email"]', `e2e2-${TIMESTAMP_MS}@test.io`);
    const pwdFields = await page.locator('[type="password"]').all();
    for (const f of pwdFields) await f.fill(TEST_PASSWORD);
    await delay(300);
    await shot('01-registration', '02-registration-form-filled.png', 'Registration form — filled');
    // Submit
    await page.locator('[type="submit"]').click();
    await delay(2000);
    await shot('01-registration', '03-registration-result.png', 'After registration submit');
  } catch (e) {
    console.log('  [WARN]', e.message);
  }

  // ── 02 LOGIN ──────────────────────────────────────────────────────────────
  console.log('\n[02] Login Flow');
  await page.goto(`${BASE_UI}/login`);
  await delay(1500);
  await shot('02-login', '01-login-form.png', 'Login page (empty)');

  try {
    await page.fill('[type="email"]', TEST_EMAIL);
    await page.fill('[type="password"]', TEST_PASSWORD);
    await delay(300);
    await shot('02-login', '02-login-form-filled.png', 'Login form — filled');
    await page.locator('[type="submit"]').click();
    await page.waitForURL(/dashboard/, { timeout: 8000 }).catch(() => {});
    await delay(2500);
    await shot('02-login', '03-dashboard-after-login.png', 'Dashboard — immediately after login');
  } catch (e) {
    console.log('  [WARN]', e.message);
  }

  // ── 03 API KEY MANAGEMENT ─────────────────────────────────────────────────
  console.log('\n[03] API Key Management');
  await page.goto(`${BASE_UI}/api-keys`);
  await delay(2500);
  await shot('03-api-key-management', '01-api-keys-list.png', 'API Keys — list (existing key visible)');

  try {
    const nameInput = page.locator('[placeholder*="Key Name"], [placeholder*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Production Key');
      await delay(200);
      await shot('03-api-key-management', '02-create-key-form.png', 'API Keys — create form filled');
      await page.locator('button:has-text("Create Key"), button:has-text("+ Create"), button[type="submit"]').last().click();
      await delay(2000);
      await shot('03-api-key-management', '03-key-created-shown.png', 'API Keys — new key created (raw key shown)');
    }
  } catch (e) {
    console.log('  [WARN]', e.message);
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE_UI}/webhooks`);
  await delay(2000);
  await shot('03-api-key-management', '04-webhooks-list.png', 'Webhooks — list page (registered hook)');

  // ── 04 SANDBOX TESTING ────────────────────────────────────────────────────
  console.log('\n[04] Sandbox Testing Playground');
  await page.goto(`${BASE_UI}/sandbox`);
  await delay(2500);
  await shot('04-sandbox-testing', '01-sandbox-landing.png', 'Sandbox Playground — landing (health endpoint)');

  // Execute health check
  try {
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '02-sandbox-health-response.png', 'Sandbox — health check response');

    // Wallet deposit
    await page.selectOption('select', { label: 'Wallet — Deposit' }).catch(() =>
      page.locator('select').selectOption({ index: 1 })
    );
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '03-sandbox-wallet-deposit.png', 'Sandbox — wallet deposit response');

    // FX convert
    await page.selectOption('select', { label: 'FX — Convert' }).catch(() =>
      page.locator('select').selectOption({ index: 3 })
    );
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '04-sandbox-fx-convert.png', 'Sandbox — FX convert response (USD→KES)');

    // Partner risk
    await page.selectOption('select', { label: 'Partner — Risk Assessment' }).catch(() =>
      page.locator('select').selectOption({ index: 9 })
    );
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '05-sandbox-partner-risk.png', 'Sandbox — Partner Risk Assessment response');

    // Partner identity
    await page.selectOption('select', { label: 'Partner — Identity Verify' }).catch(() =>
      page.locator('select').selectOption({ index: 10 })
    );
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '06-sandbox-identity-verify.png', 'Sandbox — Partner Identity Verification response');

    // Developer analytics via sandbox
    await page.selectOption('select', { label: 'Developer Analytics' }).catch(() =>
      page.locator('select').selectOption({ index: 11 })
    );
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click();
    await delay(2500);
    await shot('04-sandbox-testing', '07-sandbox-dev-analytics.png', 'Sandbox — Developer Analytics via JWT');

    // Sandbox account open
    await page.selectOption('select', { label: 'Sandbox — Open Account' }).catch(() => {});
    await delay(400);
    await page.locator('button:has-text("Execute"), button:has-text("▶")').click().catch(() => {});
    await delay(2000);
    await shot('04-sandbox-testing', '08-sandbox-open-account.png', 'Sandbox — Open Bank Account response');
  } catch (e) {
    console.log('  [WARN] Sandbox interactions:', e.message);
  }

  // ── 05 DEVELOPER ANALYTICS ────────────────────────────────────────────────
  console.log('\n[05] Developer Analytics Dashboard');
  await page.goto(`${BASE_UI}/developer/analytics`);
  await delay(3000);
  await shot('05-monitoring', '01-analytics-overview.png', 'Developer Analytics — overview (stats + key usage table)');

  // Scroll to show key usage bars
  await page.evaluate(() => window.scrollTo(0, 400));
  await delay(500);
  await shot('05-monitoring', '02-analytics-key-usage-table.png', 'Developer Analytics — key usage table with bars');

  // Events tab
  try {
    await page.click('button:has-text("Event Stream"), button:has-text("events"), button:has-text("⚡")');
    await delay(1500);
    await shot('05-monitoring', '03-analytics-event-stream.png', 'Developer Analytics — event stream tab');
  } catch (e) {}

  // Changelog tab
  try {
    await page.click('button:has-text("Changelog"), button:has-text("changelog"), button:has-text("📝")');
    await delay(1500);
    await shot('05-monitoring', '04-analytics-changelog.png', 'Developer Analytics — changelog tab');
  } catch (e) {}

  // ── 06 DEVELOPER PORTAL ───────────────────────────────────────────────────
  console.log('\n[06] Developer Portal');
  await page.goto(`${BASE_UI}/developer`);
  await delay(3000);
  await shot('06-developer-portal', '01-portal-hero-stats.png', 'Developer Portal — hero stats');
  await page.evaluate(() => window.scrollTo(0, 500));
  await delay(500);
  await shot('06-developer-portal', '02-portal-getting-started.png', 'Developer Portal — getting started guide');
  await page.evaluate(() => window.scrollTo(0, 1200));
  await delay(500);
  await shot('06-developer-portal', '03-portal-api-domains.png', 'Developer Portal — API domains');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await delay(500);
  await shot('06-developer-portal', '04-portal-auth-reference.png', 'Developer Portal — auth reference');

  // ── Changelog standalone page ─────────────────────────────────────────────
  await page.goto(`${BASE_UI}/developer/changelog`);
  await delay(2000);
  await shot('06-developer-portal', '05-api-changelog-page.png', 'API Changelog — standalone page');

  // ── 07 OTHER PAGES ────────────────────────────────────────────────────────
  console.log('\n[07] Other Platform Pages');

  const pages = [
    ['/dashboard',           '06-dashboard.png',            'Dashboard'],
    ['/wallets',             '07-wallets.png',              'Wallets'],
    ['/fx',                  '08-fx-exchange.png',          'FX Exchange'],
    ['/settlements',         '09-settlements.png',          'Settlements'],
    ['/cards',               '10-cards.png',                'Cards'],
    ['/kyc',                 '11-kyc.png',                  'KYC'],
    ['/credit',              '12-credit-score.png',         'Credit Score'],
    ['/notifications',       '13-notifications.png',        'Notifications'],
    ['/subscriptions',       '14-subscriptions.png',        'Subscriptions'],
    ['/collection-accounts', '15-collection-accounts.png',  'Collection Accounts'],
  ];

  for (const [route, filename, label] of pages) {
    await page.goto(`${BASE_UI}${route}`);
    await delay(2000);
    await shot('06-developer-portal', filename, label);
  }

  // ── API JSON endpoints (browser view) ────────────────────────────────────
  console.log('\n[08] API JSON Endpoint Views');
  const apiPage = await ctx.newPage();
  const apiEndpoints = [
    ['/health',                     '01-api-health.png',       'API Health'],
    ['/v1/sandbox/health',          '02-sandbox-health.png',   'Sandbox Health'],
    ['/v1/core-banking/health',     '03-core-banking-health.png', 'Core Banking Health (disabled status)'],
  ];

  // We need a JWT for protected endpoints — use the one we got earlier
  // Just capture what's visible in browser (no auth needed for these)
  for (const [path_, filename, label] of apiEndpoints) {
    try {
      await apiPage.goto(`${API_URL}${path_}`);
      await delay(800);
      await apiPage.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-sandbox-testing', filename), fullPage: true });
      console.log(`  [API] ✓  ${label}`);
      shotCount++;
    } catch (e) {
      console.log(`  [WARN] ${label}:`, e.message);
    }
  }
  await apiPage.close();

  // ── Done ──────────────────────────────────────────────────────────────────
  await browser.close();

  console.log(`\n✅  All done! ${shotCount} screenshots saved to:`);
  console.log(`    ${SCREENSHOTS_DIR}`);
  console.log('');

  // Print directory tree
  function listFiles(dir, prefix = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      console.log(`  ${prefix}${e.name}`);
      if (e.isDirectory()) listFiles(path.join(dir, e.name), prefix + '  ');
    }
  }
  if (fs.existsSync(SCREENSHOTS_DIR)) {
    console.log('Screenshot directory structure:');
    listFiles(SCREENSHOTS_DIR);
  }
}

takeScreenshots().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
