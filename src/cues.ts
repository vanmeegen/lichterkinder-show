// Datenmodell: Textzeilen + Effekt-Marker. Liegt nur im Browser (localStorage) bzw. in einer Export-Datei.

// Standard: die vom Nutzer gewählte Version. Über ⚙️ änderbar (Spotify-Link einfügen).
export const DEFAULT_TRACK = 'spotify:track:0iLyAlInsomkzvxAMYlS6R';
export function trackUri(): string { return localStorage.getItem('lk-track') || DEFAULT_TRACK; }
export function setTrack(linkOrUri: string): string | null {
  const m = linkOrUri.match(/track[/:]([A-Za-z0-9]{22})/);
  if (!m) return null;
  const uri = 'spotify:track:' + m[1];
  localStorage.setItem('lk-track', uri);
  return uri;
}
/** Länge des Liedes; wird vom Player (Spotify bzw. Datei) automatisch aktualisiert. */
export let SONG_DURATION = +(localStorage.getItem('lk-duration') || 241.16);
export function setSongDuration(d: number): boolean {
  if (!(d > 10) || Math.abs(d - SONG_DURATION) < 0.3) return false;
  SONG_DURATION = d; localStorage.setItem('lk-duration', String(d)); return true;
}

export type CueType =
  | 'herz' | 'lichter' | 'stern' | 'schnee' | 'glocken' | 'lichterkinder'
  | 'martin' | 'frieren'
  | 'refrain' | 'strophe' | 'ruhig' | 'rap';

export const CUE_LABEL: Record<CueType, string> = {
  herz: '❤️ Herz', lichter: '💡 Lichter', stern: '⭐ Stern', schnee: '❄️ Schnee', glocken: '🔔 Glocken',
  lichterkinder: '🎆 Lichterkinder', martin: '🧥 St. Martin', frieren: '🥶 Frieren', rap: '🎤 Rap', refrain: '🎉 Refrain', strophe: '🎵 Strophe', ruhig: '🌙 Ruhig',
};

export interface Line { t: number | null; text: string; }
export interface Cue { t: number; type: CueType; }
export interface Sheet { lines: Line[]; cues: Cue[]; bpm: number; offset?: number; end?: number; }

const KEY = 'lk-sheet-v1';

// Aus der Audio-Analyse der Datei „01 - Lichterkinder.mp3“ (Album „Laternen- und Herbstlieder“, 4:01):
// konstant 80 BPM, erster Schlag bei 3,334 s, Abschnitte auf dem Taktraster, Musik endet ~3:55.
// Feinanalyse auf die Bassdrum: Raster 60 ms früher als die erste Schätzung.
export const SONG_BPM = 80, SONG_OFFSET = 3.275, SONG_END = 235.5;
const SHIFT = -0.06;
export function defaultCues(): Cue[] {
  const sec: Cue[] = [
    { t: 0, type: 'ruhig' }, { t: 3.33, type: 'strophe' }, { t: 27.33, type: 'refrain' }, { t: 49.08, type: 'rap' },
    { t: 75.33, type: 'refrain' }, { t: 100.08, type: 'rap' }, { t: 123.33, type: 'refrain' }, { t: 146.58, type: 'rap' },
    { t: 171.33, type: 'refrain' }, { t: 195.33, type: 'ruhig' }, { t: 198.33, type: 'refrain' }, { t: 222.33, type: 'strophe' },
    { t: 228.33, type: 'ruhig' },
  ];
  const fx: Cue[] = [];
  // Refrain (4 Zeilen à 2 Takte): Lichterkinder → Sterne → Freude (goldene Glocken) → Herzen
  for (const r of [27.33, 75.33, 123.33, 171.33, 198.33]) {
    fx.push({ t: r, type: 'lichterkinder' }, { t: r + 6, type: 'stern' }, { t: r + 12, type: 'glocken' }, { t: r + 18, type: 'herz' });
  }
  fx.push({ t: 3.33, type: 'lichter' }, { t: 9.33, type: 'stern' }, { t: 21.33, type: 'herz' });
  // Rap 1 (8 Zeilen à 1 Takt): kalte Nacht, Ritt durch den Schnee, „ich friere“, Mantel teilen, für beide gereicht
  fx.push({ t: 49.83, type: 'schnee' }, { t: 55.83, type: 'schnee' }, { t: 64.83, type: 'frieren' }, { t: 67.83, type: 'martin' }, { t: 70.83, type: 'herz' });
  // Rap 2: kalte Nacht, Licht anzünden, teilen wie Sankt Martin, Lächeln, Lichter zeigen
  fx.push({ t: 100.83, type: 'schnee' }, { t: 112.83, type: 'lichter' }, { t: 115.83, type: 'martin' }, { t: 118.83, type: 'herz' }, { t: 121.83, type: 'lichter' });
  // Schlussstrophe: Laternen und Lichter, Sterne, dunkel und kalt
  fx.push({ t: 147.33, type: 'lichter' }, { t: 153.33, type: 'stern' }, { t: 159.33, type: 'schnee' });
  return [...sec, ...fx].map(c => ({ ...c, t: c.t === 0 ? 0 : Math.round((c.t + SHIFT) * 100) / 100 }));
}

/** Zeitplan der Textzeilen (nur Zeiten, kein Text): passt auf den Liedtext mit 36 Zeilen
 *  (Refrain 2×, Rap 1, Refrain, Rap 2, Refrain, Schlussstrophe). Wiederholte Refrains am Ende werden ergänzt. */
const LINE_TIMES: number[] = [
  ...[0, 6, 12, 18].map(d => 3.33 + d), ...[0, 6, 12, 18].map(d => 27.33 + d),
  ...Array.from({ length: 8 }, (_, i) => 49.83 + 3 * i),
  ...[0, 6, 12, 18].map(d => 75.33 + d),
  ...Array.from({ length: 8 }, (_, i) => 100.83 + 3 * i),
  ...[0, 6, 12, 18].map(d => 123.33 + d),
  ...[0, 6, 12, 18].map(d => 147.33 + d),
];
const REPEAT_REFRAIN_AT = [171.33, 198.33];
export const TEXT_LINE_COUNT = LINE_TIMES.length;
const LEAD = 0.4; // Zeile etwas vor dem Einsatz zeigen

/** Text in Zeilen zerlegen (Überschriften/Störzeilen weg) und – wenn er zum Lied passt – automatisch timen. */
export function autoTimeLines(raw: string): { lines: Line[]; matched: boolean } {
  const texts = raw.split('\n').map(s => s.trim()).filter(s => s && !/songtext/i.test(s) && !/^[a-z]+_[a-z_]+$/i.test(s));
  if (texts.length !== LINE_TIMES.length) return { lines: texts.map(text => ({ text, t: null })), matched: false };
  const lines: Line[] = texts.map((text, i) => ({ text, t: Math.round((LINE_TIMES[i] + SHIFT - LEAD) * 100) / 100 }));
  for (const r of REPEAT_REFRAIN_AT) for (let k = 0; k < 4; k++) lines.push({ text: texts[k], t: Math.round((r + 6 * k + SHIFT - LEAD) * 100) / 100 });
  return { lines, matched: true };
}
export function emptySheet(): Sheet { return { lines: [], cues: defaultCues(), bpm: SONG_BPM, offset: SONG_OFFSET, end: SONG_END }; }

export function loadSheet(): Sheet {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.lines) && Array.isArray(s.cues)) {
      // leer oder noch der ältere Standard-Ablauf → aktuellen Standard nehmen
      const oldDefault = s.cues.some((c: Cue) => (c.type === 'martin' && [148.83, 33.33, 67.83].some(v => Math.abs(c.t - v) < 0.01)) || (c.type === 'rap' && Math.abs(c.t - 49.77) < 0.01));
      if (oldDefault && s.lines.length === TEXT_LINE_COUNT + 8 && Math.abs((s.lines[0].t ?? 0) - 2.93) < 0.01) s.lines = autoTimeLines(s.lines.slice(0, TEXT_LINE_COUNT).map((l: Line) => l.text).join('\n')).lines;
      if (!s.cues.length || oldDefault) { s.cues = defaultCues(); s.bpm = SONG_BPM; s.offset = SONG_OFFSET; s.end = SONG_END; }
      return { bpm: SONG_BPM, offset: SONG_OFFSET, end: SONG_END, ...s };
    }
  } catch { /* ignore */ }
  return emptySheet();
}
export function saveSheet(s: Sheet) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ---- Schlüsselwörter im Text -> Effekte ----
export const KEYWORDS: { re: RegExp; type: CueType | 'weihnacht' }[] = [
  { re: /^lichterkind/i, type: 'lichterkinder' },
  { re: /^herz/i, type: 'herz' },
  { re: /^(licht|lichter|kerze|leucht|strahl|glanz|funkel|hell)/i, type: 'lichter' },
  { re: /^stern/i, type: 'stern' },
  { re: /^(mantel|martin|bettler)/i, type: 'martin' },
  { re: /^(frier|fror|kalt|kält|frost|bibber|zitter)/i, type: 'frieren' },
  { re: /^(schnee|flock|winter|eis)/i, type: 'schnee' },
  { re: /^(glock|kling|bimm)/i, type: 'glocken' },
  { re: /^(weihnacht|christ|tanne|baum|advent|krippe|engel)/i, type: 'weihnacht' },
];
export function keywordOf(word: string): CueType | 'weihnacht' | null {
  const w = word.replace(/^[^\p{L}]+/u, '');
  for (const k of KEYWORDS) if (k.re.test(w)) return k.type;
  return null;
}

// ---- Abschnitte / Energie ----

export interface Section { t0: number; t1: number; kind: 'ruhig' | 'strophe' | 'refrain' | 'rap'; }

export function sectionsOf(sheet: Sheet): Section[] {
  let sec = sheet.cues.filter(c => c.type === 'refrain' || c.type === 'strophe' || c.type === 'ruhig' || c.type === 'rap');
  if (!sec.length) sec = defaultCues().filter(c => ['refrain', 'strophe', 'ruhig', 'rap'].includes(c.type));
  sec = [...sec].sort((a, b) => a.t - b.t);
  if (sec[0].t > 0.5) sec.unshift({ t: 0, type: 'ruhig' });
  return sec.map((c, i) => ({ t0: c.t, t1: i + 1 < sec.length ? sec[i + 1].t : SONG_DURATION + 5, kind: c.type as Section['kind'] }));
}

/** Effekt-Marker inkl. automatisch aus Text-Schlüsselwörtern erzeugter. */
export function effectCues(sheet: Sheet): Cue[] {
  const fx = sheet.cues.filter(c => !['refrain', 'strophe', 'ruhig', 'rap'].includes(c.type));
  const auto: Cue[] = [];
  const timed = sheet.lines.filter(l => l.t != null) as { t: number; text: string }[];
  timed.forEach((l, i) => {
    const words = l.text.split(/\s+/);
    const dur = Math.min(6, (timed[i + 1]?.t ?? l.t + 4) - l.t);
    words.forEach((w, wi) => {
      const k = keywordOf(w);
      if (k && k !== 'weihnacht') auto.push({ t: l.t + dur * (wi / Math.max(1, words.length)) + 0.1, type: k });
    });
  });
  let all = fx.length ? [...fx] : [...fx, ...auto]; // eigene/fertige Effekte haben Vorrang vor Stichwörtern
  if (!sheet.cues.length && !timed.length) all = defaultCues().filter(c => !['refrain', 'strophe', 'ruhig', 'rap'].includes(c.type));
  all.sort((a, b) => a.t - b.t);
  // gleichartige Effekte innerhalb von 2,5 s zusammenfassen
  const out: Cue[] = [];
  for (const c of all) {
    const prev = [...out].reverse().find(o => o.type === c.type);
    if (prev && c.t - prev.t < 2.5) continue;
    out.push(c);
  }
  return out;
}

export function fmtTime(t: number) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
