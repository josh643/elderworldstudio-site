import fs from 'node:fs';
import path from 'node:path';
export const env = (k: string, d = '') => (process.env[k] ?? d).trim();
export const envNum = (k: string, d: number) => { const v = Number(process.env[k]); return Number.isFinite(v) && process.env[k] !== '' && process.env[k] != null ? v : d; };
// journald picks up stdout; one JSON line per event, never secrets.
export function log(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}) {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }) + '\n');
}
export function writeAtomic(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid; fs.writeFileSync(tmp, data, { mode: 0o640 }); fs.renameSync(tmp, file);
}
export function readJson<T>(file: string, d: T): T { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return d; } }
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const DATA = env('EWS_WORLD_DATA', '/var/lib/ews-world');
