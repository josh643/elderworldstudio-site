// train_events rows -> JSONL. Each line keeps the EWS training envelope used by the call-center export
// (/var/lib/ews-agent/training/conversations/*.jsonl: ts, channel, brand, contact_hash, turns[{role,text}], outcome, thread, source, license)
// plus the builder fields prompt / spec / feedback, so both feed one dataset. source is always 'web'.
import fs from 'node:fs';
export function toTriples(rows) {
  const outcome = {}; for (const r of rows) if (r.event === 'final') outcome[r.session] = r.outcome;
  return rows.filter(r => r.event !== 'final' && r.spec).map(r => {
    const business = JSON.parse(r.input || '{}'), spec = JSON.parse(r.spec), diff = r.diff ? JSON.parse(r.diff) : null;
    const ask = r.request ? r.request : `Design a website for a ${business.type || 'small'} business (${business.vibe || business.style || 'no vibe given'}). ${business.story || ''}`.trim();
    return { ts: r.created, channel: 'web-builder', brand: 'ews', contact_hash: '', thread: r.session, source: 'web', license: 'owned (EWS web builder, opt-in consent)',
      turns: [{ role: 'user', text: ask }, { role: 'agent', text: JSON.stringify(spec) }], outcome: outcome[r.session] || 'unknown',
      prompt: { business, change_request: r.request || null, kind: r.event }, spec, feedback: { diff } };
  });
}
if (process.argv[2]) { const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const rows = (Array.isArray(d) ? d[0] : d).results || []; for (const t of toTriples(rows)) console.log(JSON.stringify(t)); }
