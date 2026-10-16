// Freyja's voice: plays Piper audio rendered on our own server (pre-rendered lines in /office/audio/freyja/*.mp3,
// dynamic replies via /api/office/tts?h=). The visitor's device does no speech synthesis. Push-to-talk uses the
// browser's speech RECOGNITION (input only) with typed fallback.
let cur = null;
export function stop() { if (cur) { cur.pause(); cur = null; } }
export const lang = () => (window.EWS_LANG === 'es' ? 'es' : 'en');
export function playLine(name, onEnd) { return playUrl(`/office/audio/freyja/${lang()}/${name}.mp3`, onEnd); }
function playUrl(u, onEnd) { stop(); const a = new Audio(u); a.preload = 'auto'; cur = a; a.onended = () => { if (cur === a) cur = null; onEnd?.(); }; a.play().catch(() => onEnd?.()); return a; }
export async function playReply(h, onStart, ready) {           // poll briefly while CT111 renders (usually 1-4 s); give up after 15 s, text is already shown
  if (!h) return; if (!ready) await new Promise(z => setTimeout(z, 1500));   /* store is a Durable Object now (no cached misses): poll every 0.7 s */
  for (let i = 0; i < 30; i++) {
    const r = await fetch('/api/office/tts?h=' + h).catch(() => null);
    if (r && r.status === 200) { const b = URL.createObjectURL(await r.blob()); onStart?.(); playUrl(b); return true; }
    await new Promise(z => setTimeout(z, 700));
  } return false;
}
export function mic(onText, onState) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return null;
  return () => { const r = new SR(); r.lang = lang() === 'es' ? 'es-MX' : 'en-US'; r.interimResults = false; r.maxAlternatives = 1; onState?.(true); stop(); playLine('listening');
    r.onresult = e => onText(e.results[0][0].transcript); r.onerror = () => { onState?.(false); playLine('sorry'); }; r.onend = () => onState?.(false); r.start(); return r; };
}
