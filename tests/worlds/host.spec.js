import { test, expect } from '@playwright/test';

test('self-hosted host answers /healthz and serves worlds + office', async ({ request }) => {
  const h = await request.get('/healthz');
  expect(h.ok()).toBeTruthy();
  const j = await h.json();
  expect(j.ok).toBe(true);
  expect(j.service).toBe('ews-worlds');
  expect(j.standalone).toBe(true);
  expect(j.modsConfigured).toBe(true);

  expect((await request.get('/worlds/')).ok()).toBeTruthy();
  expect((await request.get('/office/')).ok()).toBeTruthy();
  expect((await request.get('/office/office.js')).ok()).toBeTruthy();
  expect((await request.get('/packages/ews-render/src/index.js')).ok()).toBeTruthy();
  expect((await request.get('/worlds/render-lab/')).ok()).toBeTruthy();
});
