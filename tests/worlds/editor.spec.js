import { test, expect } from '@playwright/test';

async function session(request) {
  const r = await request.post('/api/worlds/session', { data: { token: 'e2e-mod' } });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

test('moderator edit persists and a second client sees it; visitor is rejected', async ({ request, page, browser }) => {
  const denied = await request.post('/api/worlds/edit', { data: { type: 'prop.place', catalog: 'block', x: 1, z: 1, region: 'town' } });
  expect(denied.status()).toBe(403);

  const { sid } = await session(request);
  const placed = await request.post('/api/worlds/edit', {
    headers: { authorization: `Bearer ${sid}` },
    data: { type: 'prop.place', catalog: 'block', x: 7.5, y: 0, z: 9.25, ry: 0, region: 'town' },
  });
  const body = await placed.json();
  expect(body.ok).toBeTruthy();
  expect(body.id).toMatch(/^p-/);

  const again = await request.get('/api/worlds/editor');
  const state = await again.json();
  expect(state.props[body.id].catalog).toBe('block');
  expect(state.props[body.id].x).toBe(7.5);

  const other = await browser.newPage();
  const seen = await (await other.request.get('/api/worlds/editor')).json();
  expect(seen.props[body.id]).toBeTruthy();
  await other.close();

  await page.goto('/worlds/?autostart=1');
  await page.waitForFunction(() => window.__ewsWorlds?.ready, null, { timeout: 60_000 });
  const live = await page.evaluate(id => window.__ewsWorlds.editor?.state()?.props?.[id], body.id);
  expect(live?.catalog).toBe('block');
});
