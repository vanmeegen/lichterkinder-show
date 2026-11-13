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
export const SONG_BPM = 80, SONG_OFFSET = 3.334, SONG_END = 235.5;
export function defaultCues(): Cue[] {
  return [
    { t: 0, type: 'ruhig' }, { t: 3.33, type: 'strophe' }, { t: 27.33, type: 'refrain' }, { t: 49.83, type: 'rap' },
    { t: 75.33, type: 'refrain' }, { t: 100.83, type: 'rap' }, { t: 123.33, type: 'refrain' }, { t: 147.33, type: 'strophe' },
    { t: 171.33, type: 'refrain' }, { t: 195.33, type: 'ruhig' }, { t: 198.33, type: 'refrain' }, { t: 222.33, type: 'strophe' },
    { t: 228.33, type: 'ruhig' },
    { t: 15.33, type: 'stern' }, { t: 27.33, type: 'lichter' }, { t: 39.33, type: 'herz' },
    { t: 75.33, type: 'lichter' }, { t: 87.33, type: 'schnee' },
    { t: 123.33, type: 'lichter' }, { t: 135.33, type: 'herz' },
    { t: 148.83, type: 'martin' }, { t: 160.83, type: 'frieren' },
    { t: 171.33, type: 'glocken' }, { t: 183.33, type: 'stern' },
    { t: 198.33, type: 'lichterkinder' }, { t: 210.33, type: 'herz' }, { t: 216.33, type: 'lichter' },
  ];
}
export function emptySheet(): Sheet { return { lines: [], cues: defaultCues(), bpm: SONG_BPM, offset: SONG_OFFSET, end: SONG_END }; }

export function loadSheet(): Sheet {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && Array.isArray(s.lines) && Array.isArray(s.cues)) {
      if (!s.cues.length) { s.cues = defaultCues(); s.bpm = SONG_BPM; s.offset = SONG_OFFSET; s.end = SONG_END; }
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
  let all = [...fx, ...auto];
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
