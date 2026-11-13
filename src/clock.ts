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
