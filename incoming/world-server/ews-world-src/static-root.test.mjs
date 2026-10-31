import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveStaticRoot } from './static-root.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const SITE = path.join(REPO, 'site');

test('empty STATIC_ROOT defaults to the repo site directory', () => {
  const want = path.resolve(SITE);
  assert.equal(resolveStaticRoot('', REPO), want);
  assert.equal(resolveStaticRoot('   ', REPO), want);
  assert.equal(resolveStaticRoot(undefined, REPO), want);
  assert.equal(resolveStaticRoot(null, REPO), want);
});

test('set STATIC_ROOT is honored when non-empty', () => {
  assert.equal(resolveStaticRoot('/var/www/worlds', REPO), path.resolve('/var/www/worlds'));
});

test('office.css does not stretch nested HUD canvases', () => {
  const css = fs.readFileSync(path.join(REPO, 'site/office/office.css'), 'utf8');
  assert.match(css, /\.office-root\s*>\s*canvas/);
  assert.doesNotMatch(css, /\.office-root\s+canvas\s*\{/);
});

async function waitHealth(port, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (r.ok) return r.json();
    } catch { /* still booting */ }
    await new Promise(r => setTimeout(r, 80));
  }
  throw new Error('host did not become healthy on ' + port);
}

function runHost(env) {
  const child = spawn(process.execPath, [path.join(HERE, 'worlds-host.mjs')], {
    cwd: REPO,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.errText = '';
  child.stdout.on('data', c => { child.errText += c; });
  child.stderr.on('data', c => { child.errText += c; });
  child.exited = new Promise(resolve => child.once('exit', (code, sig) => resolve({ code, sig })));
  return child;
}

test('STATIC_ROOT= empty string still serves /worlds/ from site/', async () => {
  const port = 18080 + Math.floor(Math.random() * 400);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ews-static-root-'));
  const child = runHost({
    PUBLIC_BIND: '127.0.0.1',
    PUBLIC_PORT: String(port),
    STATIC_ROOT: '',
    EWS_WORLD_DATA: data,
    WORLD_MODERATORS: 'e2e-mod',
    WORLDS_REPO: REPO,
  });
  try {
    const died = child.exited.then(info => { throw new Error('host exited early ' + JSON.stringify(info) + '\n' + child.errText); });
    const hz = await Promise.race([waitHealth(port), died]);
    assert.equal(path.resolve(hz.staticRoot), path.resolve(SITE));
    const page = await fetch(`http://127.0.0.1:${port}/worlds/`);
    assert.equal(page.status, 200, 'empty STATIC_ROOT must not 404 /worlds/');
    const html = await page.text();
    assert.match(html, /Elderverse|ews-worlds|office\.js/i);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([child.exited, new Promise(r => setTimeout(r, 1500))]);
  }
});

test('a real STATIC_ROOT override is used (regression: empty vs set)', async () => {
  const port = 18480 + Math.floor(Math.random() * 400);
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ews-static-root-'));
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'ews-empty-root-'));
  const child = runHost({
    PUBLIC_BIND: '127.0.0.1',
    PUBLIC_PORT: String(port),
    STATIC_ROOT: empty,
    EWS_WORLD_DATA: data,
    WORLD_MODERATORS: 'e2e-mod',
    WORLDS_REPO: REPO,
  });
  try {
    const died = child.exited.then(info => { throw new Error('host exited early ' + JSON.stringify(info) + '\n' + child.errText); });
    const hz = await Promise.race([waitHealth(port), died]);
    assert.equal(path.resolve(hz.staticRoot), path.resolve(empty));
    const page = await fetch(`http://127.0.0.1:${port}/worlds/`);
    assert.equal(page.status, 404);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([child.exited, new Promise(r => setTimeout(r, 1500))]);
  }
});
