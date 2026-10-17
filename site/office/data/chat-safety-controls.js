import { filterChatText } from './chat-safety.js';

export function mountChatSafetyControls(parent, { target, reporter, excerpt = '', muteKey = '', blockKey = '', onMute = () => {}, onBlocked = () => {}, onStatus = () => {} }) {
  target = { ...target, name: filterChatText(target?.name || target?.id || 'player') };
  const bar = document.createElement('div'); bar.className = 'row chat-safety-actions';
  const readState = () => { try { return JSON.parse(localStorage.getItem('ews-chat-safety') || '{}'); } catch { return {}; } };
  const writeState = patch => { const next = { ...readState(), ...patch }; try { localStorage.setItem('ews-chat-safety', JSON.stringify(next)); } catch {} };
  const button = (label, run) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ob'; b.textContent = label; b.style.minHeight = '48px'; b.onclick = run; bar.append(b); return b; };
  button(`Report ${target.name}`, async () => {
    const result = await fetch('/api/office/world', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'chat.report', reporter, target, excerpt: String(excerpt).slice(0, 240) }) }).then(r => r.json()).catch(() => ({}));
    onStatus(result.ok ? 'Report saved for Anna to review.' : (result.error || 'Report could not be saved.'));
  });
  const muted = () => !!readState()[muteKey];
  const mute = button(`${muted() ? 'Unmute' : 'Mute'} ${target.name}`, () => {
    const value = !muted(); writeState({ [muteKey]: value }); mute.textContent = `${value ? 'Unmute' : 'Mute'} ${target.name}`; onMute(value);
  });
  button(`Block ${target.name}`, async () => {
    const result = await fetch('/api/office/world', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'chat.block', reporter, target }) }).then(r => r.json()).catch(() => ({}));
    if (result.ok) { writeState({ [blockKey]: true }); onBlocked(); }
    else onStatus(result.error || 'Block could not be saved.');
  });
  parent.append(bar);
  return { bar, buttons: [...bar.querySelectorAll('button')] };
}
