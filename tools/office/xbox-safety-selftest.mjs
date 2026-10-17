#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import words from '../../site/office/data/profanity-words.js';
import { filterChatText, xboxChatDisabled, xboxTheaterTitles } from '../../site/office/data/chat-safety.js';
import { mountChatSafetyControls } from '../../site/office/data/chat-safety-controls.js';

class TestElement {
  constructor(tag) { this.tagName = tag; this.children = []; this.style = {}; this.dataset = {}; }
  append(...nodes) { this.children.push(...nodes); }
  querySelectorAll(selector) { return selector === 'button' ? this.children.filter(x => x.tagName === 'button') : []; }
  click() { return this.onclick?.(); }
}

for (const word of words) assert.ok(!filterChatText(word).toLowerCase().includes(word), `filter left ${word} visible`);
assert.ok(!filterChatText(`hello ${words.join(' ')} goodbye`).split(' ').some(word => words.includes(word.toLowerCase())));
assert.equal(xboxChatDisabled({ communications: false, childAccount: false }), true);
assert.equal(xboxChatDisabled({ communications: true, childAccount: true }), true);
assert.equal(xboxChatDisabled({ communications: true, childAccount: false }), false);

const theater = [
  { title: 'Everyone', rating: 'E' }, { title: 'TenPlus', rating: 'E10+' }, { title: 'Teen', rating: 'T' },
  { title: 'Mature', rating: 'M' }, { title: 'Restricted', rating: 'R' }, { title: 'Unrated', rating: 'Unknown' },
];
assert.deepEqual(xboxTheaterTitles(theater).map(x => x.title), ['Everyone', 'TenPlus', 'Teen']);
assert.deepEqual(xboxTheaterTitles(theater, { childAccount: true, childAllowList: ['Everyone', 'TenPlus', 'Teen'] }).map(x => x.title), ['Everyone', 'TenPlus']);
assert.deepEqual(xboxTheaterTitles([{ title: 'No field' }]), []);

const site = JSON.parse(await readFile(new URL('../../site/office/data/site.json', import.meta.url), 'utf8'));
assert.ok(site.games.length && site.games.every(game => typeof game.rating === 'string' && game.rating.length), 'every theater title needs a rating field');
assert.deepEqual(xboxTheaterTitles(site.games), [], 'unknown rated titles are excluded in Xbox mode');

globalThis.document = { createElement: tag => new TestElement(tag) };
const saved = new Map();
globalThis.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, String(value)) };
const calls = [];
globalThis.fetch = async (_url, options) => { calls.push(JSON.parse(options.body)); return { json: async () => ({ ok: true }) }; };
const state = { muted: false, blocked: false, status: '' }, parent = new TestElement('main');
const controls = mountChatSafetyControls(parent, { target: { id: 'receptionist', name: 'Freyja' }, reporter: 'tester-123', excerpt: filterChatText('bad shit'),
  muteKey: 'mutedFreyja', blockKey: 'blockedFreyja', onMute: value => { state.muted = value; }, onBlocked: () => { state.blocked = true; }, onStatus: value => { state.status = value; } });
assert.deepEqual(controls.buttons.map(button => button.textContent), ['Report Freyja', 'Mute Freyja', 'Block Freyja']);
await controls.buttons[0].click();
assert.equal(calls[0].type, 'chat.report');
assert.ok(!calls[0].excerpt.includes('shit'), 'report excerpt must already be filtered');
await controls.buttons[1].click();
assert.equal(state.muted, true, 'mute button must update local state');
assert.equal(JSON.parse(localStorage.getItem('ews-chat-safety')).mutedFreyja, true);
await controls.buttons[2].click();
assert.equal(calls[1].type, 'chat.block');
assert.equal(state.blocked, true, 'block button must invoke its completion action');
assert.equal(JSON.parse(localStorage.getItem('ews-chat-safety')).blockedFreyja, true);
const untrustedTarget = new TestElement('main');
const filteredTarget = mountChatSafetyControls(untrustedTarget, { target: { id: 'player-2', name: 'bad shit' }, reporter: 'tester-123' });
assert.ok(filteredTarget.buttons.every(button => !button.textContent.toLowerCase().includes('shit')), 'player names must be filtered before display');

const freyja = await readFile(new URL('../../functions/api/office/freyja.js', import.meta.url), 'utf8');
const world = await readFile(new URL('../../workers/office-limiter/world.js', import.meta.url), 'utf8');
const engine = await readFile(new URL('../../site/office/core/engine.js', import.meta.url), 'utf8');
const receptionist = await readFile(new URL('../../site/office/modules/receptionist/index.js', import.meta.url), 'utf8');
assert.match(freyja, /filterChatText\(/, 'server message path must filter text');
assert.match(world, /filterChatText\(/, 'Durable Object report path must filter text');
assert.match(engine, /ctx\.xboxChatEnabled = \(\) => !xboxChatDisabled\(privileges\)/, 'Xbox identity privileges must drive chat access');
assert.match(receptionist, /if \(ctx\.xbox && !ctx\.xboxChatEnabled\(\)\) return/, 'Xbox privilege changes must hide the chat path');

const { world: worldRoute } = await import('../../workers/office-limiter/world.js');
const values = new Map(), storage = { get: async key => values.get(key), put: async (key, value) => values.set(key, value) };
storage.transaction = fn => fn(storage);
const stateDO = { storage };
const callDO = (path, data, extraHeaders = {}) => worldRoute(stateDO, new Request('https://rl/world/' + path, { method: 'POST', headers: { 'content-type': 'application/json', ...extraHeaders }, body: JSON.stringify(data) }));
for (let n = 0; n < 3; n++) assert.equal((await callDO('chat/report', { reporter: 'tester-123', target: { id: 'receptionist', name: 'Freyja' }, excerpt: 'shit' })).status, 200);
assert.equal((await callDO('chat/report', { reporter: 'tester-123', target: { id: 'receptionist', name: 'Freyja' }, excerpt: 'repeat' })).status, 429, 'report writes must be rate-limited');
for (let n = 0; n < 3; n++) assert.equal((await callDO('chat/report', { reporter: `another-${n}`, target: { id: 'receptionist', name: 'Freyja' } }, { 'cf-connecting-ip': '203.0.113.7' })).status, 200);
assert.equal((await callDO('chat/report', { reporter: 'new-reporter', target: { id: 'receptionist', name: 'Freyja' } }, { 'cf-connecting-ip': '203.0.113.7' })).status, 429, 'report limits must also resist reporter ID resets');
const reports = values.get('chat:needs-anna');
assert.equal(reports[0].status, 'needs-anna');
assert.ok(!reports[0].excerpt.includes('shit'), 'Durable Object log must filter report text');
assert.equal((await callDO('chat/block', { reporter: 'tester-123', target: { id: 'receptionist', name: 'Freyja' } })).status, 200);
assert.equal((await (await callDO('chat/check', { player: 'receptionist', target: 'tester-123' })).json()).blocked, true, 'block must apply in both directions');
console.log('Xbox safety self-test PASS: controls, filtering, child chat gate, and theater rating gates.');
