import * as THREE from 'three';
import { Stage } from './scene';
import { Lyrics } from './lyrics';
import { Editor } from './editor';
import { Clock, DemoClock, SpotifyClock } from './clock';
import { SpotifyPlayer, handleRedirect, login, logout, isLoggedIn, getClientId, setClientId, redirectUri } from './spotify';
import { loadSheet, saveSheet, Sheet, sectionsOf, effectCues, fmtTime, SONG_DURATION, Cue } from './cues';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Zustand ----------
let sheet: Sheet = loadSheet();
const prefs = JSON.parse(localStorage.getItem('lk-prefs') || '{}');
let latency: number = prefs.latency ?? 150;
let source: 'spotify' | 'demo' = prefs.source ?? 'spotify';
let showLyrics: boolean = prefs.lyrics ?? true;
const savePrefs = () => localStorage.setItem('lk-prefs', JSON.stringify({ latency, source, lyrics: showLyrics }));

const sp = new SpotifyPlayer();
const demo = new DemoClock();
let clock: Clock = source === 'spotify' ? new SpotifyClock(sp) : demo;
let started = false;

const stage = new Stage($<HTMLCanvasElement>('gl'));
const lyrics = new Lyrics();
lyrics.visible = showLyrics;

let sections = sectionsOf(sheet);
let effects: Cue[] = effectCues(sheet);
let rebuildTimer = 0;
function sheetChanged() {
  clearTimeout(rebuildTimer);
  rebuildTimer = window.setTimeout(() => {
    sections = sectionsOf(sheet); effects = effectCues(sheet);
    stage.fireworks.rebuild(sheet);
    stage.kids.herzTimes = effects.filter(c => c.type === 'herz').map(c => c.t);
    lyrics.reset();
  }, 250);
}
stage.fireworks.rebuild(sheet);
stage.kids.herzTimes = effects.filter(c => c.type === 'herz').map(c => c.t);

// ---------- Hilfen ----------
let toastTimer = 0;
function toast(s: string, ms = 2200) {
  const el = $('toast'); el.textContent = s; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}
function status(s: string) { $('status').textContent = s; }
sp.onStatus = status;

const songTime = () => clock.time() - latency / 1000;

async function startOrToggle() {
  try {
    if (source === 'spotify' && !isLoggedIn()) { openSettings(); toast('Bitte zuerst bei Spotify anmelden'); return; }
    if (!started) { started = true; status(source === 'spotify' ? 'Verbinde mit Spotify…' : 'Demo'); }
    await clock.toggle();
  } catch (e: any) { toast(e.message || String(e), 4000); status(''); started = false; }
}
async function playFrom(t: number) {
  if (source === 'spotify' && !isLoggedIn()) { toast('Bitte zuerst bei Spotify anmelden'); throw new Error('login'); }
  started = true;
  if (source === 'spotify') await sp.playFrom(t);
  else { await demo.seek(t); if (!demo.playing()) await demo.toggle(); }
}

// ---------- Editor ----------
const editor = new Editor(
  () => sheet, s => { sheet = s; sheetChanged(); }, songTime,
  t => playFrom(t), () => clock.pause(), t => { started = true; return clock.seek(t); }, toast,
);

// ---------- Einstellungen ----------
function openSettings() { $('settings').classList.remove('hidden'); }
function syncSettingsUi() {
  ($('set-source') as HTMLSelectElement).value = source;
  $('spotify-box').style.display = source === 'spotify' ? '' : 'none';
  ($('set-client') as HTMLInputElement).value = getClientId();
  $('redirect-uri').textContent = redirectUri();
  ($('set-latency') as HTMLInputElement).value = String(latency); $('lat-val').textContent = String(latency);
  ($('set-bpm') as HTMLInputElement).value = String(sheet.bpm); $('bpm-val').textContent = String(sheet.bpm);
  ($('set-lyrics') as HTMLInputElement).checked = showLyrics;
  $('btn-login').textContent = isLoggedIn() ? 'Neu anmelden' : 'Bei Spotify anmelden';
}
$('btn-settings').onclick = () => { syncSettingsUi(); $('settings').classList.toggle('hidden'); };
$('btn-close-settings').onclick = () => $('settings').classList.add('hidden');
$('set-source').onchange = async () => {
  await clock.pause().catch(() => {});
  source = ($('set-source') as HTMLSelectElement).value as typeof source;
  clock = source === 'spotify' ? new SpotifyClock(sp) : demo;
  started = false; savePrefs(); syncSettingsUi();
};
$('set-client').onchange = () => setClientId(($('set-client') as HTMLInputElement).value);
$('btn-login').onclick = () => { setClientId(($('set-client') as HTMLInputElement).value); login().catch(e => toast(e.message)); };
$('btn-logout').onclick = () => { logout(); syncSettingsUi(); toast('Abgemeldet'); };
$('set-latency').oninput = () => { latency = +($('set-latency') as HTMLInputElement).value; $('lat-val').textContent = String(latency); savePrefs(); };
$('set-bpm').oninput = () => { sheet = { ...sheet, bpm: +($('set-bpm') as HTMLInputElement).value }; $('bpm-val').textContent = String(sheet.bpm); saveSheet(sheet); };
$('set-lyrics').onchange = () => { showLyrics = ($('set-lyrics') as HTMLInputElement).checked; lyrics.visible = showLyrics; savePrefs(); };

// ---------- Bedienleiste ----------
$('btn-play').onclick = () => startOrToggle();
$('btn-restart').onclick = () => playFrom(0).catch(() => {});
$('btn-editor').onclick = () => (editor.isOpen() ? editor.close() : editor.open());
$('btn-full').onclick = () => toggleFull();
function toggleFull() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }

addEventListener('keydown', e => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
  if (editor.key(e)) { e.preventDefault(); return; }
  if (e.code === 'Space') { e.preventDefault(); startOrToggle(); }
  else if (e.key === 'f' || e.key === 'F') toggleFull();
  else if (e.key === 'ArrowRight') clock.seek(clock.time() + 5);
  else if (e.key === 'ArrowLeft') clock.seek(Math.max(0, clock.time() - 5));
});

let lastMove = performance.now();
addEventListener('pointermove', () => { lastMove = performance.now(); });

// ---------- Herz-/Licht-Bildschirmeffekt ----------
const tint = document.createElement('div');
tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;';
document.body.insertBefore(tint, $('lyrics'));

// ---------- Hauptschleife ----------
function mood(t: number) {
  const sec = sections.find(s => t >= s.t0 && t < s.t1) ?? sections[0];
  const target = sec.kind === 'refrain' ? 1 : sec.kind === 'strophe' ? 0.45 : 0.12;
  // weicher Übergang 1,5 s
  const prev = sections[sections.indexOf(sec) - 1];
  const pv = prev ? (prev.kind === 'refrain' ? 1 : prev.kind === 'strophe' ? 0.45 : 0.12) : target;
  const k = Math.min(1, (t - sec.t0) / 1.5);
  const energy = pv + (target - pv) * k;
  const since: Record<string, number> = {};
  for (const c of effects) if (c.t <= t) since[c.type] = t - c.t;
  return { t, beat: (t * sheet.bpm) / 60, energy, since };
}

function frame() {
  const raw = started ? songTime() : 0;
  const t = Math.max(0, raw);
  const m = mood(t);
  const f = stage.fireworks.flash(t);
  const schnee = m.since.schnee ?? 99;
  stage.render({ ...m, look: f.pos }, 0.8 + (schnee < 6 ? 1.2 * Math.exp(-schnee * 0.4) : 0));

  lyrics.update(sheet, t);
  $('title-card').classList.toggle('hide', started && t > 9);
  $('time').textContent = `${fmtTime(t)} / ${fmtTime(SONG_DURATION)}`;
  $('btn-play').textContent = clock.playing() ? '⏸ Pause' : '▶ Start';
  const idle = clock.playing() && performance.now() - lastMove > 3000 && !editor.isOpen() && $('settings').classList.contains('hidden');
  $('toolbar').classList.toggle('idle', idle);
  document.body.style.cursor = idle ? 'none' : '';

  const herz = m.since.herz ?? 99, licht = m.since.lichter ?? 99, lk = m.since.lichterkinder ?? 99;
  if (herz < 3) { tint.style.background = 'radial-gradient(ellipse at center, transparent 35%, rgba(255,40,110,.55))'; tint.style.opacity = String(Math.exp(-herz * 1.1) * 0.45); }
  else if (licht < 3) { tint.style.background = 'radial-gradient(ellipse at 50% 100%, rgba(255,200,90,.6), transparent 60%)'; tint.style.opacity = String(Math.exp(-licht * 1.1) * 0.45); }
  else if (lk < 4) { tint.style.background = 'radial-gradient(ellipse at 50% 40%, rgba(255,255,220,.8), transparent 55%)'; tint.style.opacity = String(Math.exp(-lk * 2.2) * 0.4); }
  else tint.style.opacity = '0';

  requestAnimationFrame(frame);
}

// ---------- Start ----------
(async () => {
  try { const msg = await handleRedirect(); if (msg) toast(msg, 3000); } catch (e: any) { toast(e.message, 4000); }
  syncSettingsUi();
  if (source === 'spotify' && !isLoggedIn()) status('Noch nicht bei Spotify angemeldet (⚙️)');
  // Testhilfe: ?t=123 springt im Demo-Modus an eine Stelle
  const q = new URLSearchParams(location.search).get('t');
  if (q) { source = 'demo'; clock = demo; started = true; await demo.seek(+q); latency = 0; if (new URLSearchParams(location.search).has('play')) await demo.toggle(); }
  requestAnimationFrame(frame);
})();

(window as any).THREE = THREE;
