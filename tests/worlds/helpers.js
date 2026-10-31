export async function waitReady(page, timeout = 60_000) {
  await page.waitForFunction(() => window.__ewsWorlds?.ready === true, null, { timeout });
}

export function noPageErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  return errors;
}

export function serious(errors) {
  return errors.filter(e => !/404|Failed to load resource|favicon|freyja|office\/state|office\/world|layout-status|webgl|WebGL/i.test(e));
}
