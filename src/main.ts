import * as THREE from 'three';
import { Stage } from './scene';
import { Lyrics } from './lyrics';
import { Editor } from './editor';
import { Clock, CountdownClock, SpotifyClock, FileClock, storeAudio, loadAudio } from './clock';
import { SpotifyPlayer, handleRedirect, login, logout, isLoggedIn, getClientId, setClientId, redirectUri } from './spotify';
import { loadSheet, saveSheet, Sheet, sectionsOf, effectCues, fmtTime, SONG_DURATION, Cue, setSongDuration, trackUri, setTrack } from './cues';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- Zustand ----------
let sheet: Sheet = loadSheet();
const prefs = JSON.parse(localStorage.getItem('lk-prefs') || '{}');
let latency: number = prefs.latency ?? 0;
type Source = 'spotify' | 'file' | 'demo';
let source: Source = prefs.source ?? 'file';
let chosen: boolean = !!prefs.source;
let showLyrics: boolean = prefs.lyrics ?? true;
const savePrefs = () => localStorage.setItem('lk-prefs', JSON.stringify({ latency, source: chosen ? source : undefined, lyrics: showLyrics }));

const sp = new SpotifyPlayer();
const demo = new CountdownClock();
const fileClock = new FileClock();
const spClock = new SpotifyClock(sp);
const clockFor = (s: Source): Clock => (s === 'spotify' ? spClock : s === 'file' ? fileClock : demo);
let clock: Clock = clockFor(source);
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
    stage.kids.martinTimes = effects.filter(c => c.type === 'martin').map(c => c.t);
    buildFrostEmojis();
    lyrics.reset();
    paintSeekBar();
  }, 250);
}
stage.fireworks.rebuild(sheet);
stage.kids.herzTimes = effects.filter(c => c.type === 'herz').map(c => c.t);
stage.kids.martinTimes = effects.filter(c => c.type === 'martin').map(c => c.t);

// ---------- Hilfen ----------
let toastTimer = 0;
function toast(s: string, ms = 2200) {
  const el = $('toast'); el.textContent = s; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el.classList.remove('show'), ms);
}
function status(s: string) { $('status').textContent = s; }
sp.onStatus = status;
const onDuration = (d: number) => { if (setSongDuration(d)) sheetChanged(); };
sp.onDuration = onDuration;
fileClock.onDuration = onDuration;

const songTime = () => clock.time() - latency / 1000;

async function setSource(s: Source) {
  await clock.pause().catch(() => {});
  source = s; chosen = true; clock = clockFor(s); started = false; savePrefs(); syncSettingsUi();
}
/** Prüft, ob die gewählte Quelle startklar ist; sonst Auswahl bzw. Einstellungen zeigen. */
function ready(): boolean {
  if (!chosen) { $('chooser').classList.remove('hidden'); return false; }
  if (source === 'spotify' && !isLoggedIn()) { openSettings(); toast('Bitte zuerst bei Spotify anmelden – oder unter „Abspielquelle“ ohne Spotify starten', 4500); return false; }
  if (source === 'file' && !fileClock.hasFile()) { $('chooser').classList.remove('hidden'); return false; }
  return true;
}
async function startOrToggle() {
  try {
    if (!ready()) return;
    if (!started) { started = true; status(source === 'spotify' ? 'Verbinde mit Spotify…' : 'Demo'); }
    await clock.toggle();
  } catch (e: any) { toast(e.message || String(e), 4000); status(''); started = false; }
}
async function playFrom(t: number) {
  if (!ready()) throw new Error('nicht bereit');
  started = true;
  if (source === 'spotify') await sp.playFrom(t);
  else if (source === 'file') { await fileClock.seek(t); if (!fileClock.playing()) await fileClock.toggle(); }
  else { await demo.seek(t); if (t < 0.05) await demo.toggle(); else await demo.startNow(); }
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
  $('file-box').style.display = source === 'file' ? '' : 'none';
  $('demo-box').style.display = source === 'demo' ? '' : 'none';
  $('file-name').textContent = fileClock.name ? '🎵 ' + fileClock.name : 'Noch keine Datei gewählt.';
  ($('set-client') as HTMLInputElement).value = getClientId();
  ($('set-track') as HTMLInputElement).value = 'https://open.spotify.com/track/' + trackUri().split(':')[2];
  $('redirect-uri').textContent = redirectUri();
  ($('set-bpm') as HTMLInputElement).value = String(sheet.bpm); $('bpm-val').textContent = String(sheet.bpm);
  ($('set-lyrics') as HTMLInputElement).checked = showLyrics;
  $('btn-login').textContent = isLoggedIn() ? 'Neu anmelden' : 'Bei Spotify anmelden';
}
$('btn-settings').onclick = () => { syncSettingsUi(); $('settings').classList.toggle('hidden'); };
$('btn-close-settings').onclick = () => $('settings').classList.add('hidden');
$('set-source').onchange = () => setSource(($('set-source') as HTMLSelectElement).value as Source);
async function useFile(input: HTMLInputElement) {
  const f = input.files?.[0]; if (!f) return;
  fileClock.setFile(f, f.name); storeAudio(f, f.name);
  if (source !== 'file' || !chosen) await setSource('file');
  syncSettingsUi(); toast('🎵 ' + f.name);
  input.value = '';
}
$('audio-file').onchange = () => useFile($('audio-file') as HTMLInputElement);
$('chooser-file').onchange = async () => {
  $('chooser').classList.add('hidden');
  await useFile($('chooser-file') as HTMLInputElement);
  if (fileClock.hasFile()) toast('🎵 Musik geladen – jetzt ▶ Start drücken', 3500);
};
document.querySelectorAll<HTMLButtonElement>('#chooser button[data-src]').forEach(b => b.onclick = async () => {
  $('chooser').classList.add('hidden');
  await setSource(b.dataset.src as Source);
  if (ready()) startOrToggle();
});
$('chooser').onclick = e => { if (e.target === $('chooser')) $('chooser').classList.add('hidden'); };
$('set-track').onchange = () => {
  const uri = setTrack(($('set-track') as HTMLInputElement).value);
  toast(uri ? 'Lied gespeichert ✔' : 'Das ist kein Spotify-Lied-Link');
  syncSettingsUi(); started = false;
};
$('set-client').onchange = () => setClientId(($('set-client') as HTMLInputElement).value);
$('btn-login').onclick = () => { setClientId(($('set-client') as HTMLInputElement).value); login().catch(e => toast(e.message)); };
$('btn-logout').onclick = () => { logout(); syncSettingsUi(); toast('Abgemeldet'); };
function setLatency(v: number) {
  latency = Math.max(-400, Math.min(600, Math.round(v / 10) * 10));
  ($('sync-range') as HTMLInputElement).value = String(latency);
  $('sync-val').textContent = (latency > 0 ? '+' : '') + latency + ' ms';
  savePrefs();
}
$('set-latency').oninput = () => setLatency(+($('set-latency') as HTMLInputElement).value);
$('sync-range').oninput = () => setLatency(+($('sync-range') as HTMLInputElement).value);
$('sync-minus').onclick = e => { e.preventDefault(); setLatency(latency - 20); };
$('sync-plus').onclick = e => { e.preventDefault(); setLatency(latency + 20); };
setLatency(latency);

// Zeitleiste zum Springen
let seeking = false;
const seekEl = $('seek') as HTMLInputElement;
seekEl.oninput = () => { seeking = true; $('time').textContent = `${fmtTime(+seekEl.value)} / ${fmtTime(SONG_DURATION)}`; };
seekEl.onchange = async () => {
  const v = +seekEl.value; seeking = false;
  if (!started) { if (!ready()) return; started = true; }
  await clock.seek(v + latency / 1000);
};
function paintSeekBar() {
  const col: Record<string, string> = { refrain: '#c2410c', rap: '#7c3aed', strophe: '#1d4ed8', ruhig: '#334155' };
  const stops = sections.map(s => `${col[s.kind]} ${(s.t0 / SONG_DURATION) * 100}% ${(Math.min(s.t1, SONG_DURATION) / SONG_DURATION) * 100}%`).join(', ');
  seekEl.style.setProperty('--seek-bg', `linear-gradient(90deg, ${stops})`);
  seekEl.max = String(SONG_DURATION);
}
paintSeekBar();
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
  else if (e.key === '[') setLatency(latency - 20);
  else if (e.key === ']') setLatency(latency + 20);
});

let lastMove = performance.now();
addEventListener('pointermove', () => { lastMove = performance.now(); });

// ---------- Herz-/Licht-Bildschirmeffekt ----------
const tint = document.createElement('div');
tint.style.cssText = 'position:fixed;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:0;';
document.body.insertBefore(tint, $('lyrics'));

// ---------- 🥶-Emojis beim Frieren ----------
interface Pop { el: HTMLSpanElement; t: number; x: number; y: number; rot: number; }
let pops: Pop[] = [];
function buildFrostEmojis() {
  const layer = $('fx-layer'); layer.innerHTML = ''; pops = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const c of effects.filter(e => e.type === 'frieren')) {
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('span');
      el.className = 'pop-emoji';
      el.textContent = i % 3 === 0 ? '❄️' : i % 5 === 1 ? '🧊' : '🥶';
      layer.appendChild(el);
      pops.push({ el, t: c.t + i * 0.12 + rnd() * 0.15, x: 6 + rnd() * 88, y: 35 + rnd() * 45, rot: (rnd() - 0.5) * 40 });
    }
  }
}
function updateFrostEmojis(t: number) {
  for (const p of pops) {
    const a = t - p.t;
    if (a < 0 || a > 3.2) { p.el.style.opacity = '0'; continue; }
    const pop = a < 0.25 ? a / 0.25 * 1.3 : a < 0.4 ? 1.3 - (a - 0.25) / 0.15 * 0.3 : 1;
    const shake = Math.sin(a * 60) * 4 * Math.min(1, a);
    p.el.style.opacity = String(Math.min(1, (3.2 - a) / 0.6));
    p.el.style.transform = `translate(-50%,-50%) translate(${shake}px, ${-a * 40}px) rotate(${p.rot + shake}deg) scale(${pop})`;
    p.el.style.left = p.x + 'vw'; p.el.style.top = p.y + 'vh';
  }
}
buildFrostEmojis();

// ---------- Hauptschleife ----------
function mood(t: number) {
  const sec = sections.find(s => t >= s.t0 && t < s.t1) ?? sections[0];
  const lvl = (k: string) => (k === 'refrain' ? 1 : k === 'rap' ? 0.8 : k === 'strophe' ? 0.45 : 0.12);
  const target = lvl(sec.kind);
  // weicher Übergang 1,5 s
  const prev = sections[sections.indexOf(sec) - 1];
  const pv = prev ? lvl(prev.kind) : target;
  const rapIn = sec.kind === 'rap' ? Math.min(1, (t - sec.t0) / 0.12, (sec.t1 - t) / 0.4) : 0;
  const k = Math.min(1, (t - sec.t0) / 1.5);
  const energy = pv + (target - pv) * k;
  const since: Record<string, number> = {};
  for (const c of effects) if (c.t <= t) since[c.type] = t - c.t;
  const rapT = sec.kind === 'rap' ? t - sec.t0 : -1, rapLen = sec.kind === 'rap' ? Math.min(sec.t1, SONG_DURATION) - sec.t0 : 0;
  const raps = sections.filter(s => s.kind === 'rap');
  const rapNo = Math.max(0, raps.indexOf(sec)), rapBeat = rapT >= 0 ? (rapT * sheet.bpm) / 60 : 0, rapBeats = (rapLen * sheet.bpm) / 60;
  return { t, beat: ((t - (sheet.offset ?? 0)) * sheet.bpm) / 60, energy, rap: Math.max(0, rapIn), rapT, rapLen, rapBeat, rapBeats, rapNo, rapCount: raps.length, since };
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
  if (!seeking) { $('time').textContent = `${fmtTime(t)} / ${fmtTime(SONG_DURATION)}`; seekEl.value = String(t); }
  $('btn-play').textContent = clock.playing() ? '⏸ Pause' : '▶ Start';
  const cd = source === 'demo' ? demo.countdownUntil : 0;
  const cdEl = $('countdown');
  if (cd) { const left = (cd - performance.now()) / 1000; cdEl.textContent = left > 0.6 ? String(Math.ceil(left - 0.6)) : 'Los!'; cdEl.classList.add('on'); }
  else cdEl.classList.remove('on');
  const idle = clock.playing() && performance.now() - lastMove > 3000 && !editor.isOpen() && $('settings').classList.contains('hidden');
  $('toolbar').classList.toggle('idle', idle);
  document.body.style.cursor = idle ? 'none' : '';

  const herz = m.since.herz ?? 99, licht = m.since.lichter ?? 99, lk = m.since.lichterkinder ?? 99;
  if (herz < 3) { tint.style.background = 'radial-gradient(ellipse at center, transparent 35%, rgba(255,40,110,.55))'; tint.style.opacity = String(Math.exp(-herz * 1.1) * 0.45); }
  else if (licht < 3) { tint.style.background = 'radial-gradient(ellipse at 50% 100%, rgba(255,200,90,.6), transparent 60%)'; tint.style.opacity = String(Math.exp(-licht * 1.1) * 0.45); }
  else if (lk < 4) { tint.style.background = 'radial-gradient(ellipse at 50% 40%, rgba(255,255,220,.8), transparent 55%)'; tint.style.opacity = String(Math.exp(-lk * 2.2) * 0.4); }
  else if ((m.since.frieren ?? 99) < 4) { const fr = m.since.frieren; tint.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(120,200,255,.75))'; tint.style.opacity = String(Math.min(1, fr / 0.3) * Math.min(1, (4 - fr) / 1) * 0.6); }
  else if ((m.since.martin ?? 99) < 2) { const mt = m.since.martin; tint.style.background = 'radial-gradient(ellipse at 50% 60%, rgba(255,90,60,.5), transparent 60%)'; tint.style.opacity = String(Math.exp(-mt * 1.5) * 0.5); }
  else tint.style.opacity = '0';
  updateFrostEmojis(t);

  requestAnimationFrame(frame);
}

// ---------- Start ----------
(async () => {
  try { const msg = await handleRedirect(); if (msg) toast(msg, 3000); } catch (e: any) { toast(e.message, 4000); }
  const saved = await loadAudio();
  if (saved) fileClock.setFile(saved.blob, saved.name);
  syncSettingsUi();
  if (source === 'spotify' && !isLoggedIn()) status('Noch nicht bei Spotify angemeldet (⚙️)');
  // Testhilfe: ?t=123 springt im Demo-Modus an eine Stelle
  const q = new URLSearchParams(location.search).get('t');
  if (q) { source = 'demo'; chosen = true; clock = demo; started = true; await demo.seek(+q); latency = 0; if (new URLSearchParams(location.search).has('play')) await demo.toggle(); }
  requestAnimationFrame(frame);
})();

(window as any).THREE = THREE;
