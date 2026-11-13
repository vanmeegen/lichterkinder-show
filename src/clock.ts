import { SpotifyPlayer } from './spotify';
import { SONG_DURATION } from './cues';

export interface Clock {
  time(): number;
  playing(): boolean;
  toggle(): Promise<void>;
  seek(t: number): Promise<void>;
  pause(): Promise<void>;
}

export class DemoClock implements Clock {
  private pos = 0; private at = 0; private run = false;
  time() { const t = this.run ? this.pos + (performance.now() - this.at) / 1000 : this.pos; return Math.min(t, SONG_DURATION + 3); }
  playing() { return this.run && this.time() < SONG_DURATION + 3; }
  async toggle() { if (this.run) { this.pos = this.time(); this.run = false; } else { if (this.pos >= SONG_DURATION) this.pos = 0; this.at = performance.now(); this.run = true; } }
  async seek(t: number) { this.pos = t; this.at = performance.now(); }
  async pause() { this.pos = this.time(); this.run = false; }
}

export class SpotifyClock implements Clock {
  constructor(public sp: SpotifyPlayer) {}
  time() { return this.sp.time(); }
  playing() { return this.sp.playing(); }
  toggle() { return this.sp.toggle(); }
  seek(t: number) { return this.sp.seek(t); }
  pause() { return this.sp.pause(); }
}

/** Eigene Musikdatei über <audio>. Die Datei wird im Browser (IndexedDB) gemerkt. */
export class FileClock implements Clock {
  audio = new Audio();
  name = '';
  constructor() { this.audio.preload = 'auto'; }
  setFile(blob: Blob, name: string) { this.audio.src = URL.createObjectURL(blob); this.name = name; }
  hasFile() { return !!this.audio.src; }
  time() { return this.audio.currentTime; }
  playing() { return !this.audio.paused && !this.audio.ended; }
  async toggle() { if (this.audio.paused) await this.audio.play(); else this.audio.pause(); }
  async seek(t: number) { this.audio.currentTime = Math.max(0, t); }
  async pause() { this.audio.pause(); }
}

/** Ohne Ton: Countdown, danach läuft die Show nach Uhr. */
export class CountdownClock extends DemoClock {
  countdownUntil = 0;
  async toggle() {
    if (!this.playing() && this.time() < 0.05 && !this.countdownUntil) {
      this.countdownUntil = performance.now() + 3600;
      setTimeout(() => { this.countdownUntil = 0; super.toggle(); }, 3600);
      return;
    }
    if (this.countdownUntil) return;
    return super.toggle();
  }
  async seek(t: number) { this.countdownUntil = 0; return super.seek(t); }
  async startNow() { this.countdownUntil = 0; if (!this.playing()) await super.toggle(); }
}

const DB = 'lk-audio';
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function storeAudio(blob: Blob, name: string) {
  try { const db = await idb(); db.transaction('f', 'readwrite').objectStore('f').put({ blob, name }, 'song'); } catch { /* ignore */ }
}
export async function loadAudio(): Promise<{ blob: Blob; name: string } | null> {
  try {
    const db = await idb();
    return await new Promise(res => { const r = db.transaction('f').objectStore('f').get('song'); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
  } catch { return null; }
}
