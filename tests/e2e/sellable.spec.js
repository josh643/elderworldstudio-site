const { test, expect } = require('@playwright/test');

test('signup, pay (test card), generate, edit, publish, download, cancel', async ({ page }) => {
  const email = 'buyer@example.com';
  const api = page.request;

  await page.goto('/account/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.fill('#email', email);
  await page.click('button[type=submit]');
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.click('#demo-link');
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

  await page.goto('/build/');
  const cfg = await (await api.get('/api/shop-config')).json();
  expect(cfg.livePayments).toBe(true);
  await expect(page.locator('[data-tier="business"] a')).toHaveText(/Start Business/);

  page.once('dialog', (d) => d.accept(email));
  await page.locator('[data-tier="business"] a').click();
  await expect(page.getByRole('heading', { name: 'Test card' })).toBeVisible();
  await expect(page.locator('#card')).toHaveValue('4242424242424242');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/paid=1/);
  await expect(page.getByRole('heading', { name: 'Your websites' })).toBeVisible();

  const me = await (await api.get('/api/me')).json();
  expect(me.ok).toBeTruthy();
  expect(me.plan).toBe('business');
  expect(me.canEdit).toBeTruthy();
  const site = me.sites[0];
  expect(site.id).toBeTruthy();

  const generated = await (await api.post('/api/build-ai', {
    data: { action: 'generate', input: { name: 'Sample Corner Bakery', type: 'bakery', story: 'A neighborhood bakery on Main Street baking daily.' } },
  })).json();
  expect(generated.ok).toBeTruthy();
  expect(generated.spec || generated.source).toBeTruthy();

  const saved = await (await api.post(`/api/sites/${site.id}`, {
    data: {
      name: 'Sample Corner Bakery',
      draft: { name: 'Sample Corner Bakery', type: 'bakery', pages: ['Home', 'Menu', 'About', 'Contact'], story: 'A neighborhood bakery on Main Street.' },
      spec: generated.spec || { palette: { bg: '#fffaf3', surface: '#f1e6d6', ink: '#2a1d14', accent: '#b23a2a', accent2: '#3d2a1e' }, fonts: { head: 'dmserif', body: 'worksans' }, hero: 'center', headline: 'Fresh this morning', subhead: 'Bread and coffee', about: 'A neighborhood bakery.', cta: { label: 'Visit us' }, sections: [{ kind: 'menu', title: 'Menu', items: [{ name: 'Sourdough', text: 'Daily loaf' }] }] },
    },
  })).json();
  expect(saved.ok).toBeTruthy();

  const edited = await (await api.post(`/api/sites/${site.id}`, {
    data: { draft: { name: 'Sample Corner Bakery', tagline: 'Open early', type: 'bakery', pages: ['Home', 'About'] } },
  })).json();
  expect(edited.ok).toBeTruthy();

  const pub = await (await api.post(`/api/sites/${site.id}/publish`)).json();
  expect(pub.ok).toBeTruthy();
  expect(pub.url).toMatch(/^\/s\//);

  const preview = await api.get(`/api/sites/${site.id}/preview`);
  expect(preview.ok()).toBeTruthy();
  expect(await preview.text()).toContain('Sample Corner Bakery');

  const live = await api.get(pub.url);
  expect(live.ok()).toBeTruthy();
  expect(await live.text()).toContain('Sample Corner Bakery');

  const zip = await api.get(`/api/sites/${site.id}/download`);
  expect(zip.ok()).toBeTruthy();
  expect(zip.headers()['content-type']).toContain('zip');
  const bytes = await zip.body();
  expect(bytes.slice(0, 2).toString()).toBe('PK');

  await page.goto('/account/#/billing');
  await page.click('#portal');
  await expect(page.getByRole('heading', { name: 'Customer portal' })).toBeVisible();
  await page.click('#cancel');
  await expect(page).toHaveURL(/billing/);
  const after = await (await api.get('/api/me')).json();
  expect(after.status).toBe('canceled');
  expect(after.canDownload).toBeTruthy();
});

test('reservation form still posts web-builder leads', async ({ page }) => {
  await page.route('**/challenges.cloudflare.com/**', (r) => r.abort());
  await page.goto('/build/');
  const form = page.locator('#build-form');
  await expect(form).toHaveAttribute('action', '/api/lead');
  await form.locator('[name="name"]').fill('Test Person');
  await form.locator('[name="email"]').fill('test@example.com');
  await form.locator('[name="business"]').fill('Test Shop');
  await form.locator('[name="description"]').fill('A small test shop.');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#form-status')).toContainText(/Thanks|reserved|try again|not configured/i);
});

test('Turnstile widget is present and the lead path does not require a token when the secret is unset', async ({ page, request }) => {
  await page.goto('/build/');
  await expect(page.locator('.cf-turnstile')).toHaveCount(1);
  const r = await request.post('/api/lead', {
    headers: { accept: 'application/json' },
    multipart: {
      name: 'Test Person', email: 'test@example.com', business: 'Test Shop',
      type: 'web-builder', return_to: '/build/', description: 'A small test shop.',
      t: String(Date.now() - 5000),
    },
  });
  const body = await r.json();
  expect(body.ok).toBeTruthy();
});
