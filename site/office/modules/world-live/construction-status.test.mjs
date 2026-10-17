import assert from 'node:assert/strict';
import test from 'node:test';
import { ago, constructionStatus } from './construction-status.mjs';

const entity = { job: 'arcade', lot: 11, tenant: 'Elder Arcade', at: Date.now() - 10 * 60 * 1000 };
const stateFor = work => ({ updated: new Date().toISOString(), work: [{ task: 'Build Elder Arcade Lot 11', ...work }] });

test('reports a live crew only for a matched, active pipeline stage', () => {
  assert.deepEqual(constructionStatus(entity, stateFor({ stage: 'build', blocked: false }), { approved: true }), { running: true, reason: '' });
});

test('reports a blocked pipeline with the budget reason', () => {
  assert.deepEqual(constructionStatus(entity, stateFor({ stage: 'build', blocked: true, task: 'Elder Arcade waiting on daily budget cap' }), { approved: true }), { running: false, reason: 'daily budget' });
});

test('reports a waiting pipeline with the repo lock reason', () => {
  assert.deepEqual(constructionStatus(entity, stateFor({ stage: 'waiting', task: 'Elder Arcade waiting on repo lock' }), { approved: true }), { running: false, reason: 'repo lock' });
});

test('reports a waiting pipeline with the approval reason', () => {
  assert.deepEqual(constructionStatus(entity, stateFor({ stage: 'waiting', task: 'Elder Arcade waiting for approval' }), { approved: true }), { running: false, reason: 'approval' });
});

test('treats cancelled and skipped work as paused', () => {
  assert.equal(constructionStatus(entity, stateFor({ stage: 'build', task: 'Elder Arcade cancelled' }), { approved: true }).reason, 'cancellation');
  assert.equal(constructionStatus(entity, stateFor({ stage: 'build', task: 'Elder Arcade skipped' }), { approved: true }).reason, 'pipeline restart');
  assert.equal(constructionStatus(entity, stateFor({ stage: 'cancelled' }), { approved: true }).reason, 'cancellation');
  assert.equal(constructionStatus(entity, stateFor({ stage: 'skipped' }), { approved: true }).reason, 'pipeline restart');
});

test('uses an explicit blocked reason and only recognizes active stages', () => {
  assert.equal(constructionStatus(entity, stateFor({ stage: 'build', blocked: true, blockedReason: 'repository lock held' }), { approved: true }).reason, 'repo lock');
  assert.equal(constructionStatus(entity, stateFor({ stage: 'deploying' }), { approved: true }).running, false);
  assert.equal(constructionStatus(entity, stateFor({ stage: 'QA' }), { approved: true }).running, true);
});

test('treats unapproved layout and unmatched or stale state as paused', () => {
  assert.equal(constructionStatus({ ...entity, hold: true }, null, { approved: false }).reason, 'approval');
  assert.equal(constructionStatus(entity, { updated: new Date().toISOString(), work: [] }, { approved: true }).reason, 'pipeline status');
  assert.equal(constructionStatus(entity, { updated: '2000-01-01T00:00:00Z', work: [{ task: 'Elder Arcade', stage: 'build' }] }, { approved: true }).reason, 'pipeline status update');
});

test('uses the latest progress timestamp in compact elapsed text', () => {
  const now = Date.now();
  assert.equal(ago(now - 10 * 60 * 1000, now), '10m ago');
  assert.equal(ago(now - 2 * 60 * 60 * 1000, now), '2h ago');
  assert.equal(ago(null, now), 'time unavailable');
});
