const RUNNING = new Set(['plan', 'build', 'self-check', 'qa']);

function aliases(entity) {
  return [entity.job, entity.tenant, entity.name, entity.id, entity.lot != null ? `lot ${entity.lot}` : '']
    .map(value => String(value || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(value => value.length >= 3);
}

function reasonFrom(value, fallback) {
  const text = String(value || '').toLowerCase();
  if (/budget|daily cap/.test(text)) return 'daily budget';
  if (/repo(?:sitory)?\s+lock|lock/.test(text)) return 'repo lock';
  if (/approval|approve/.test(text)) return 'approval';
  if (/cancel/.test(text)) return 'cancellation';
  if (/skip/.test(text)) return 'pipeline restart';
  if (/review/.test(text)) return 'review';
  return fallback;
}

function matchingWork(entity, state) {
  const tags = aliases(entity);
  if (!tags.length) return null;
  return (state?.work || []).find(work => {
    const task = String(work.task || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');
    return tags.some(tag => task.includes(tag));
  }) || null;
}

export function ago(timestamp, now = Date.now()) {
  const at = Number(timestamp);
  if (!Number.isFinite(at) || at <= 0) return 'time unavailable';
  const minutes = Math.max(0, Math.floor((now - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m ago` : `${hours}h ago`;
}

export function constructionStatus(entity, state, layout) {
  if (entity.hold || (layout && !layout.approved)) {
    const reason = reasonFrom(layout?.why, 'approval');
    return { running: false, reason };
  }

  const work = matchingWork(entity, state);
  if (!work) return { running: false, reason: 'pipeline status' };

  const stateAge = Date.now() - Date.parse(state?.updated || '');
  if (!Number.isFinite(stateAge) || stateAge > 120000 || stateAge < -60000) {
    return { running: false, reason: 'pipeline status update' };
  }

  const stage = String(work.stage || '').toLowerCase();
  const task = [work.task, work.reason, work.blockedReason, work.blocked_reason, work.waitingOn, work.waiting_on, work.status]
    .filter(Boolean).join(' ');
  if (/\b(cancelled|canceled|skipped)\b/i.test(`${stage} ${task}`)) {
    return { running: false, reason: reasonFrom(`${stage} ${task}`, 'pipeline restart') };
  }
  if (work.blocked) return { running: false, reason: reasonFrom(task, 'pipeline to resume') };
  if (stage === 'waiting') return { running: false, reason: reasonFrom(task, 'pipeline to resume') };
  if (stage === 'review') return { running: false, reason: 'review' };
  if (stage === 'ready') return { running: false, reason: 'release' };
  if (stage === 'released') return { running: false, reason: 'release complete' };
  if (RUNNING.has(stage)) return { running: true, reason: '' };
  return { running: false, reason: 'pipeline status' };
}
