// Spotify: Anmeldung (PKCE, ohne Geheimnis) + Web Playback SDK (der Browser wird selbst zum Player).
import { TRACK_URI } from './cues';

const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state';
const LS = { client: 'lk-client-id', verifier: 'lk-pkce', token: 'lk-token' };

interface Token { access: string; refresh: string; exp: number; }

export function redirectUri() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}
export function getClientId() { return localStorage.getItem(LS.client) || ''; }
export function setClientId(id: string) { localStorage.setItem(LS.client, id.trim()); }

function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function login() {
  const id = getClientId();
  if (!id) throw new Error('Bitte zuerst die Client-ID eintragen.');
  const rnd = crypto.getRandomValues(new Uint8Array(48));
  const verifier = b64url(rnd.buffer);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem(LS.verifier, verifier);
  const p = new URLSearchParams({
    response_type: 'code', client_id: id, scope: SCOPES, redirect_uri: redirectUri(),
    code_challenge_method: 'S256', code_challenge: challenge,
  });
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}

export function logout() { localStorage.removeItem(LS.token); }

function readToken(): Token | null {
  try { return JSON.parse(localStorage.getItem(LS.token) || 'null'); } catch { return null; }
}
function storeToken(j: any, old?: Token | null) {
  const t: Token = { access: j.access_token, refresh: j.refresh_token || old?.refresh || '', exp: Date.now() + (j.expires_in - 60) * 1000 };
  localStorage.setItem(LS.token, JSON.stringify(t));
  return t;
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
  });
  if (!r.ok) throw new Error('Spotify-Anmeldung fehlgeschlagen (' + r.status + ')');
  return r.json();
}

/** Nach dem Rücksprung von Spotify: Code gegen Token tauschen. */
export async function handleRedirect(): Promise<string | null> {
  const q = new URLSearchParams(location.search);
  const err = q.get('error');
  const code = q.get('code');
  if (!code && !err) return null;
  history.replaceState(null, '', redirectUri());
  if (err) return 'Spotify: ' + err;
  const j = await tokenRequest({
    grant_type: 'authorization_code', code: code!, redirect_uri: redirectUri(), client_id: getClientId(),
    code_verifier: localStorage.getItem(LS.verifier) || '',
  });
  storeToken(j);
  return 'Mit Spotify angemeldet ✔';
}

export function isLoggedIn() { return !!readToken(); }

export async function getToken(): Promise<string> {
  let t = readToken();
  if (!t) throw new Error('Nicht bei Spotify angemeldet');
  if (Date.now() > t.exp) {
    const j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: getClientId() });
    t = storeToken(j, t);
  }
  return t.access;
}

async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch('https://api.spotify.com/v1' + path, {
    method, headers: { Authorization: 'Bearer ' + (await getToken()), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && r.status !== 204) throw Object.assign(new Error('Spotify-API ' + r.status), { status: r.status });
  return r;
}

// ---------- Web Playback SDK ----------
declare global { interface Window { onSpotifyWebPlaybackSDKReady?: () => void; Spotify?: any; } }

let sdkPromise: Promise<void> | null = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = new Promise(res => {
    window.onSpotifyWebPlaybackSDKReady = () => res();
    const s = document.createElement('script');
    s.src = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export class SpotifyPlayer {
  player: any = null;
  deviceId = '';
  private anchorPos = 0;      // s
  private anchorAt = 0;       // performance.now()
  private paused = true;
  private started = false;
  onStatus: (s: string) => void = () => {};

  async init() {
    if (this.player) return;
    await loadSdk();
    const P = window.Spotify.Player;
    this.player = new P({ name: 'Lichterkinder-Show', volume: 1.0, getOAuthToken: (cb: (t: string) => void) => { getToken().then(cb).catch(e => this.onStatus(e.message)); } });
    const ready = new Promise<void>((res, rej) => {
      this.player.addListener('ready', ({ device_id }: any) => { this.deviceId = device_id; this.onStatus('Spotify bereit'); res(); });
      this.player.addListener('not_ready', () => this.onStatus('Spotify-Verbindung unterbrochen'));
      this.player.addListener('initialization_error', ({ message }: any) => rej(new Error('Browser wird nicht unterstützt: ' + message)));
      this.player.addListener('authentication_error', () => rej(new Error('Anmeldung abgelaufen – bitte neu anmelden')));
      this.player.addListener('account_error', () => rej(new Error('Spotify Premium wird benötigt')));
      this.player.addListener('playback_error', ({ message }: any) => this.onStatus('Wiedergabefehler: ' + message));
    });
    this.player.addListener('player_state_changed', (st: any) => this.applyState(st));
    const ok = await this.player.connect();
    if (!ok) throw new Error('Spotify-Player konnte nicht verbinden');
    await ready;
    setInterval(() => this.poll(), 700);
  }

  private applyState(st: any) {
    if (!st) return;
    const pos = st.position / 1000;
    const predicted = this.time();
    this.paused = st.paused;
    // kleine Abweichungen weich korrigieren, große sofort
    if (Math.abs(pos - predicted) > 0.25 || st.paused) { this.anchorPos = pos; this.anchorAt = performance.now(); }
    else { this.anchorPos = predicted + (pos - predicted) * 0.5; this.anchorAt = performance.now(); }
  }
  private async poll() {
    if (!this.player || !this.started) return;
    this.applyState(await this.player.getCurrentState());
  }

  time() { return this.paused ? this.anchorPos : this.anchorPos + (performance.now() - this.anchorAt) / 1000; }
  playing() { return !this.paused; }

  async playFrom(sec: number) {
    await this.init();
    try { await this.player.activateElement(); } catch { /* nur für manche Browser nötig */ }
    try {
      await api(`/me/player/play?device_id=${this.deviceId}`, 'PUT', { uris: [TRACK_URI], position_ms: Math.round(sec * 1000) });
    } catch (e: any) {
      if (e.status === 404) {
        await api('/me/player', 'PUT', { device_ids: [this.deviceId], play: false });
        await new Promise(r => setTimeout(r, 600));
        await api(`/me/player/play?device_id=${this.deviceId}`, 'PUT', { uris: [TRACK_URI], position_ms: Math.round(sec * 1000) });
      } else throw e;
    }
    this.started = true;
    this.anchorPos = sec; this.anchorAt = performance.now(); this.paused = false;
  }
  async toggle() {
    if (!this.started) return this.playFrom(0);
    await this.player.togglePlay();
  }
  async seek(sec: number) {
    if (!this.started) return this.playFrom(sec);
    await this.player.seek(Math.round(sec * 1000));
    this.anchorPos = sec; this.anchorAt = performance.now();
  }
  async pause() { if (this.started) await this.player.pause(); }
}
