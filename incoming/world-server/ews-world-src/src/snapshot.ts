// Nightly snapshot: flush live state, gzip to /var/lib/ews-world/snapshots (keep 14), optional offsite copy to R2
// (S3 API, only if R2_* vars are set in /etc/ews-world/env; none are configured today, so nothing is sent and nothing is billed).
// The CT itself is in vzdump job pve-mini-nightly-usb (02:30 daily, all guests), so the 02:10 snapshot rides that backup.
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { env, envNum, log, DATA } from './util.js';

const KEY = env('WORLD_KEY'), PORT = envNum('ADMIN_PORT', 8790), DIR = DATA + '/snapshots', KEEP = envNum('SNAPSHOT_KEEP', 14);
async function r2Put(name: string, buf: Buffer) {
  const ep = env('R2_ENDPOINT'), bucket = env('R2_BUCKET'), ak = env('R2_ACCESS_KEY_ID'), sk = env('R2_SECRET_ACCESS_KEY');
  if (!ep || !bucket || !ak || !sk) return 'skipped (no R2 configured; offsite = vzdump pve-mini-nightly-usb)';
  const host = new URL(ep).host, keyPath = `/${bucket}/ews-world/${name}`, now = new Date(), amz = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), d = amz.slice(0, 8);
  const h = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex'), mac = (k: crypto.BinaryLike, s: string) => crypto.createHmac('sha256', k).update(s).digest();
  const ph = h(buf), canon = ['PUT', keyPath, '', `host:${host}`, `x-amz-content-sha256:${ph}`, `x-amz-date:${amz}`, '', 'host;x-amz-content-sha256;x-amz-date', ph].join('\n');
  const scope = `${d}/auto/s3/aws4_request`, sts = ['AWS4-HMAC-SHA256', amz, scope, h(canon)].join('\n');
  const sig = crypto.createHmac('sha256', mac(mac(mac(mac('AWS4' + sk, d), 'auto'), 's3'), 'aws4_request')).update(sts).digest('hex');
  const r = await fetch(`https://${host}${keyPath}`, { method: 'PUT', body: new Uint8Array(buf), headers: { 'x-amz-date': amz, 'x-amz-content-sha256': ph, authorization: `AWS4-HMAC-SHA256 Credential=${ak}/${scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${sig}` } });
  if (!r.ok) throw new Error('R2 PUT ' + r.status); return 'r2 ok';
}
(async () => {
  try { await fetch(`http://127.0.0.1:${PORT}/admin/snapshot`, { method: 'POST', headers: { authorization: 'Bearer ' + KEY }, signal: AbortSignal.timeout(10000) }); }
  catch { log('warn', 'live flush failed; snapshotting last saved state'); }
  const src = DATA + '/state.json'; if (!fs.existsSync(src)) { log('error', 'no state.json'); process.exit(1); }
  fs.mkdirSync(DIR, { recursive: true });
  const name = 'world-' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.json.gz', buf = zlib.gzipSync(fs.readFileSync(src));
  fs.writeFileSync(DIR + '/' + name, buf, { mode: 0o640 });
  const all = fs.readdirSync(DIR).filter(f => /^world-\d+\.json\.gz$/.test(f)).sort(); for (const f of all.slice(0, Math.max(0, all.length - KEEP))) fs.unlinkSync(DIR + '/' + f);
  let off = ''; try { off = await r2Put(name, buf); } catch (e: any) { off = 'r2 failed: ' + String(e?.message || e); }
  log('info', 'snapshot written', { file: name, bytes: buf.length, kept: Math.min(all.length, KEEP), offsite: off });
})();
