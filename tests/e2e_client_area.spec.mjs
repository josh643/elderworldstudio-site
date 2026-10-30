import { test, expect } from '@playwright/test';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8811';
const SHOTS = process.env.SHOTS_DIR;
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true }); };
test('sign-in, dashboard, support, settings, sign-out (demo mode)', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/account/#/dashboard');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible(); // guarded
  await shot(page, '01-login');
  await page.fill('#email', 'nope'); await page.click('button[type=submit]');
  await expect(page.locator('#msg')).toContainText('valid email');
  await page.fill('#email', 'demo@example.com'); await page.click('button[type=submit]');
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await shot(page, '02-check-email');
  await page.click('#demo-link');
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
  await expect(page.locator('#products .card')).toHaveCount(5);
  await expect(page.locator('[data-kind=receptionist] .badge')).toHaveText('Not active');
  await expect(page.locator('[data-kind=web_builder] .badge')).toContainText('Trial');
  await shot(page, '03-dashboard');
  await page.click('#acct-nav >> text=Sites'); await expect(page.locator('table.t')).toContainText('Sample Corner Bakery'); await shot(page, '04-sites');
  await page.click('#acct-nav >> text=Billing'); await expect(page.locator('#portal')).toBeDisabled(); await expect(page.locator('table.t')).toContainText('$349.00'); await shot(page, '05-billing');
  await page.click('#acct-nav >> text=Support');
  await page.fill('#subj', 'x'); await page.fill('#body', 'short'); await page.click('#tf button'); await expect(page.locator('#tmsg')).toHaveClass('err');
  await page.fill('#subj', 'Update opening hours'); await page.fill('#body', 'Please change Saturday hours to 9-3.'); await page.click('#tf button');
  await expect(page.locator('#tmsg')).toHaveText(/request was sent/); await expect(page.locator('#tickets')).toContainText('Update opening hours'); await shot(page, '06-support');
  await page.click('#acct-nav >> text=Settings'); await page.fill('#fn', 'Alex Kim'); await page.click('#pf button'); await expect(page.locator('#pmsg')).toHaveText('Saved.'); await shot(page, '07-settings');
  await page.reload(); await page.goto(BASE + '/account/#/dashboard'); await expect(page.getByRole('heading', { name: 'Welcome, Alex' })).toBeVisible();
  await page.click('#signout'); await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.goto(BASE + '/account/#/billing'); await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('mobile layout has no horizontal overflow', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(BASE + '/account/'); await page.fill('#email', 'm@example.com'); await page.click('button[type=submit]'); await page.click('#demo-link');
  await expect(page.locator('#products .card')).toHaveCount(5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await shot(page, '08-dashboard-mobile');
});
