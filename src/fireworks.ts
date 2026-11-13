// GPU-Feuerwerk: Der komplette Ablauf wird vorab berechnet und als ein großer Partikel-Puffer
// hochgeladen. Der Shader zeigt nur, was zur aktuellen Liedzeit sichtbar ist – Vorspulen und Pause sind dadurch exakt.
import * as THREE from 'three';
import { Sheet, sectionsOf, effectCues, SONG_DURATION, Cue } from './cues';
import * as S from './shapes';

type Col = [number, number, number];
const C: Record<string, Col> = {
  red: [1, 0.16, 0.16], gold: [1, 0.72, 0.22], green: [0.2, 1, 0.38], white: [1, 0.96, 0.88], ice: [0.45, 0.78, 1],
  pink: [1, 0.36, 0.72], orange: [1, 0.48, 0.12], purple: [0.7, 0.35, 1], cyan: [0.3, 1, 0.95], silver: [0.85, 0.9, 1],
};
const MIX = ['red', 'gold', 'green', 'white', 'ice', 'pink', 'orange', 'purple', 'cyan'];

export type Shape = 'sphere' | 'ring' | 'star' | 'heart' | 'tree' | 'flake' | 'bell' | 'willow' | 'text' | 'comet' | 'palm';

export interface Burst {
  t: number; x: number; y: number; z: number; R: number; shape: Shape;
  c1: Col; c2: Col; life: number; grav: number; text?: string; launch: number; crackle: boolean; big?: boolean;
}

const TRAIL = [0, 0.035, 0.07, 0.11];
const LAUNCH = 1.15;
const DRAG = 1.9;

export const FLOOR_Y = 0;
const BACK_Z = -58;

/** Ablauf aller Bursts aus Abschnitten und Effekt-Markern. */
export function buildSchedule(sheet: Sheet): Burst[] {
  const rng = S.mulberry32(20261224);
  const r = (a: number, b: number) => a + (b - a) * rng();
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const out: Burst[] = [];

  const add = (t: number, shape: Shape, opt: Partial<Burst> = {}) => {
    if (t < 1.4 || t > SONG_DURATION - 0.8) return;
    let c1: Col = C[pick(MIX)], c2: Col = C[pick(MIX)];
    if (shape === 'heart') { c1 = C.red; c2 = C.pink; }
    if (shape === 'tree') { c1 = C.green; c2 = C.gold; }
    if (shape === 'flake') { c1 = C.white; c2 = C.ice; }
    if (shape === 'bell' || shape === 'willow' || shape === 'palm') { c1 = C.gold; c2 = C.orange; }
    if (shape === 'star') { c1 = rng() < 0.5 ? C.gold : C.ice; c2 = C.white; }
    const R = opt.R ?? r(9, 13);
    out.push({
      t, x: r(-34, 34), y: r(22, 34), z: BACK_Z + r(-8, 8), R, shape, c1, c2,
      life: shape === 'willow' ? 4.2 : shape === 'text' ? 5.2 : shape === 'palm' ? 3.4 : 2.7,
      grav: shape === 'willow' ? 3.4 : shape === 'text' ? 0.35 : 1.4,
      launch: LAUNCH, crackle: rng() < 0.3, ...opt,
    });
  };

  // ---------- Grundfeuerwerk je Abschnitt ----------
  const plan = {
    ruhig: { iv: 3.4, R: [7, 10], shapes: ['ring', 'star', 'flake', 'sphere'] as Shape[] },
    strophe: { iv: 1.55, R: [8, 12], shapes: ['sphere', 'ring', 'flake', 'star', 'palm', 'tree'] as Shape[] },
    refrain: { iv: 0.5, R: [10, 16], shapes: ['sphere', 'sphere', 'ring', 'star', 'heart', 'tree', 'flake', 'willow', 'palm'] as Shape[] },
  };
  for (const sec of sectionsOf(sheet)) {
    const p = plan[sec.kind];
    let t = Math.max(sec.t0, sec.kind === 'ruhig' && sec.t0 < 1 ? 7.5 : sec.t0);
    const end = Math.min(sec.t1, SONG_DURATION - 1.5);
    if (sec.kind === 'refrain') {
      // Eröffnungs-Salve über die ganze Breite
      for (let i = 0; i < 7; i++) add(sec.t0 + i * 0.09, 'sphere', { x: -36 + i * 12, y: r(24, 32), R: r(12, 15) });
    }
    while (t < end) {
      add(t, pick(p.shapes), { R: r(p.R[0], p.R[1]) });
      if (sec.kind === 'refrain' && rng() < 0.25) add(t + 0.05, 'sphere', { R: r(7, 10), y: r(16, 22) });
      t += p.iv * r(0.7, 1.3);
    }
  }

  // ---------- Effekte zu Text/Markern ----------
  // Rund um Effekte das Grundfeuerwerk ausdünnen, damit Herz, Stern & Co. klar erkennbar sind.
  const fxCues = effectCues(sheet);
  const quiet = (t: number) => fxCues.some(c => c.type === 'lichterkinder' ? t > c.t - 1.5 && t < c.t + 5 : t > c.t - 0.8 && t < c.t + 2.2);
  for (let i = out.length - 1; i >= 0; i--) if (quiet(out[i].t) && rng() < 0.8) out.splice(i, 1);
  for (const c of fxCues) addEffect(c, add, r);

  // ---------- Finale ----------
  const fin = SONG_DURATION - 9;
  for (let k = 0; k < 26; k++) add(fin + k * 0.22, pick(['sphere', 'ring', 'palm', 'willow', 'star'] as Shape[]), { R: r(13, 18) });
  add(SONG_DURATION - 5.6, 'text', { text: 'Frohe Weihnachten', x: 0, y: 25, z: BACK_Z + 4, R: 34, c1: C.gold, c2: C.white, crackle: true, big: true });
  for (let i = 0; i < 5; i++) add(SONG_DURATION - 5.6 + 0.4, 'willow', { x: -40 + i * 20, y: 38, R: 15 });

  out.sort((a, b) => a.t - b.t);
  return out;
}

function addEffect(c: Cue, add: (t: number, s: Shape, o?: Partial<Burst>) => void, r: (a: number, b: number) => number) {
  const t = c.t;
  switch (c.type) {
    case 'herz':
      add(t, 'heart', { x: 0, y: 30, R: 17, big: true, crackle: false });
      add(t + 0.35, 'heart', { x: -27, y: 26, R: 11 });
      add(t + 0.35, 'heart', { x: 27, y: 26, R: 11 });
      for (let i = 0; i < 6; i++) add(t + 1 + i * 0.15, 'heart', { x: -35 + i * 14, y: r(17, 21), R: 5.5 });
      break;
    case 'lichter':
      for (let i = 0; i < 9; i++) add(t + Math.abs(i - 4) * 0.12, 'palm', { x: -40 + i * 10, y: r(20, 26), R: 10, c1: [1, 0.8, 0.35], c2: [1, 1, 0.85] });
      add(t + 0.7, 'sphere', { x: 0, y: 33, R: 18, c1: [1, 0.85, 0.4], c2: [1, 1, 1], crackle: true, big: true });
      break;
    case 'stern':
      add(t, 'star', { x: 0, y: 32, R: 16, big: true });
      add(t + 0.25, 'star', { x: -24, y: 27, R: 10 });
      add(t + 0.45, 'star', { x: 24, y: 27, R: 10 });
      for (let i = 0; i < 4; i++) add(t + 0.2 + i * 0.35, 'comet', { x: -45 + i * 6, y: 40 - i * 2, R: 30, launch: 0.01 });
      break;
    case 'schnee':
      add(t, 'flake', { x: 0, y: 30, R: 16, big: true });
      for (let i = 0; i < 4; i++) add(t + 0.3 + i * 0.2, 'flake', { x: -33 + i * 22, y: r(22, 28), R: 8 });
      break;
    case 'glocken':
      add(t, 'bell', { x: -16, y: 29, R: 12 });
      add(t + 0.3, 'bell', { x: 16, y: 29, R: 12 });
      break;
    case 'lichterkinder':
      add(t, 'text', { text: 'Lichterkinder', x: 0, y: 24, z: BACK_Z + 4, R: 36, c1: [1, 0.6, 0.25], c2: [1, 1, 0.8], crackle: true, big: true });
      for (let i = 0; i < 11; i++) add(t - 0.05 + i * 0.07, 'palm', { x: -45 + i * 9, y: r(12, 15), R: r(6, 8) });
      for (let i = 0; i < 6; i++) add(t + 1.6 + i * 0.12, 'willow', { x: -40 + i * 16, y: r(36, 40), R: 14 });
      for (let i = 0; i < 6; i++) add(t + 3.2 + i * 0.1, 'heart', { x: -35 + i * 14, y: r(20, 24), R: 7 });
      break;
  }
}

// ---------------------------------------------------------------------------

const vert = /* glsl */`
uniform float uTime; uniform float uScale;
attribute vec3 aOrigin; attribute vec3 aVel; attribute vec3 aColor; attribute vec3 aColor2;
attribute vec4 aT;   // tBurst, life, lag, kind(0 burst, 1 rocket)
attribute vec4 aP;   // gravity|launch, size, phase, crackle
varying vec3 vColor;
void main(){
  float t = uTime - aT.z;
  vec3 pos = vec3(0.); float alpha = 0.; vec3 col = aColor; float size = aP.y;
  if (aT.w < 0.5) {
    float a = t - aT.x;
    if (a > 0. && a < aT.y) {
      float d = (1. - exp(-${DRAG.toFixed(2)} * a)) / ${DRAG.toFixed(2)};
      pos = aOrigin + aVel * d; pos.y -= 0.5 * aP.x * a * a;
      float u = a / aT.y;
      alpha = pow(1. - u, 1.25) * smoothstep(0., 0.12, a);
      col = mix(aColor, aColor2, smoothstep(.3, .75, u));
      float fl = sin(a * 47. + aP.z * 6.2831);
      alpha *= mix(1., step(0.15, fl) * 1.6, aP.w * smoothstep(.45, .7, u));
      size *= 1. + 0.3 * exp(-a * 5.);
    }
  } else {
    float L = aP.x; float a = t - (aT.x - L);
    if (a > 0. && a < L) {
      float u = a / L; float e = 1. - (1. - u) * (1. - u);
      pos = mix(aVel, aOrigin, e);
      pos.x += sin(u * 11. + aP.z * 6.2831) * 0.35 * (1. - u);
      alpha = 0.7 + 0.3 * sin(a * 60. + aP.z * 20.);
    }
  }
  if (alpha <= 0.001) { gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
  vec4 mv = modelViewMatrix * vec4(pos, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, size * uScale / -mv.z);
  vColor = col * alpha;
}`;

const frag = /* glsl */`
varying vec3 vColor;
void main(){
  vec2 p = gl_PointCoord - .5; float d = length(p) * 2.;
  if (d > 1.) discard;
  float halo = pow(1. - d, 2.0);
  float core = smoothstep(.45, 0., d);
  gl_FragColor = vec4(vColor * halo * 1.5 + vec3(1.) * core * length(vColor) * .4, 1.);
}`;

export class Fireworks {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  bursts: Burst[] = [];
  private textCache = new Map<string, S.V3[]>();

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 500 } },
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(new THREE.BufferGeometry(), this.mat);
    this.points.frustumCulled = false;
  }

  private shapeOf(b: Burst, rng: S.Rng): S.V3[] {
    switch (b.shape) {
      case 'sphere': return S.sphere(b.big ? 420 : 260, rng);
      case 'willow': return S.sphere(200, rng);
      case 'palm': return S.sphere(90, rng).map(([x, y, z]) => [x, Math.abs(y) * 0.6 + 0.4 * Math.sign(y + 0.3), z]);
      case 'ring': return [...S.ring(150, rng), ...S.sphere(40, rng).map(([x, y, z]) => [x * 0.3, y * 0.3, z * 0.3] as S.V3)];
      case 'star': return S.star();
      case 'heart': return S.heart(b.big ? 220 : 150);
      case 'tree': return S.tree();
      case 'flake': return S.flake();
      case 'bell': return S.bell();
      case 'comet': return [[1, -0.25, 0]];
      case 'text': {
        const k = b.text!;
        if (!this.textCache.has(k)) this.textCache.set(k, S.textPoints(k, 5));
        return this.textCache.get(k)!;
      }
    }
  }

  rebuild(sheet: Sheet) {
    this.bursts = buildSchedule(sheet);
    const rng = S.mulberry32(99);
    const O: number[] = [], V: number[] = [], C1: number[] = [], C2: number[] = [], T: number[] = [], P: number[] = [];
    const push = (o: S.V3, v: S.V3, c1: Col, c2: Col, t: number[], p: number[]) => {
      O.push(...o); V.push(...v); C1.push(...c1); C2.push(...c2); T.push(...t); P.push(...p);
    };
    for (const b of this.bursts) {
      const unit = this.shapeOf(b, rng);
      const planar = !['sphere', 'willow', 'palm', 'ring'].includes(b.shape);
      const yaw = planar ? (rng() - 0.5) * 0.5 : 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
      const isComet = b.shape === 'comet';
      const lags = isComet ? Array.from({ length: 26 }, (_, i) => i * 0.03) : b.shape === 'text' ? [0, 0.05] : TRAIL;
      const bright = b.shape === 'text' ? 1.9 : 1.7;
      for (const u of unit) {
        let [x, y, z] = u;
        if (planar) { const x2 = x * cy - z * sy, z2 = x * sy + z * cy; x = x2; z = z2; }
        const jitter = planar ? 1 + (rng() - 0.5) * 0.06 : 1;
        let k = DRAG * b.R * jitter;
        if (b.shape === 'willow') k *= 0.85;
        const vel: S.V3 = [x * k, y * k, z * k];
        const mixc = !planar && rng() < 0.5;
        const c1 = mixc ? b.c2 : b.c1, c2 = b.shape === 'sphere' || b.shape === 'ring' ? (mixc ? b.c1 : C.white) : b.c2;
        const ph = rng();
        lags.forEach((lag, li) => {
          const f = bright * Math.pow(1 - li / (lags.length + 0.5), 1.6);
          const size = (b.shape === 'text' ? 0.42 : isComet ? 0.9 - li * 0.025 : 0.62) * (1 - li * 0.13);
          push([b.x, b.y, b.z], vel, [c1[0] * f, c1[1] * f, c1[2] * f], [c2[0] * f, c2[1] * f, c2[2] * f],
            [b.t, isComet ? 3.0 : b.life, lag, 0], [isComet ? 0.3 : b.grav, size, ph, b.crackle && li === 0 ? 1 : 0]);
        });
      }
      // Rakete
      if (b.launch > 0.05) {
        const start: S.V3 = [b.x * 0.92 + (rng() - 0.5) * 4, FLOOR_Y + 1, b.z + 10];
        for (let i = 0; i < 16; i++) {
          const f = 1.6 * (1 - i / 17);
          push([b.x, b.y, b.z], start, [1 * f, 0.72 * f, 0.35 * f], [1, 1, 1], [b.t, 0, i * 0.022, 1], [b.launch, 0.7 - i * 0.03, rng(), 0]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    const n = O.length / 3;
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aOrigin', new THREE.Float32BufferAttribute(O, 3));
    g.setAttribute('aVel', new THREE.Float32BufferAttribute(V, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(C1, 3));
    g.setAttribute('aColor2', new THREE.Float32BufferAttribute(C2, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(T, 4));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(P, 4));
    this.points.geometry.dispose();
    this.points.geometry = g;
    return n;
  }

  /** Helligkeit/Farbe des Himmelsblitzes und Wucht für Kamerawackeln. */
  flash(t: number) {
    const col = new THREE.Color(0, 0, 0); let shake = 0;
    let pos = new THREE.Vector3(0, 28, BACK_Z); let wsum = 0;
    for (const b of this.bursts) {
      if (b.t > t) break;
      const a = t - b.t;
      if (a > 1.6 || b.shape === 'comet') continue;
      const w = Math.exp(-a * 3.2) * (b.R / 12) * (b.big ? 1.6 : 1);
      col.r += b.c1[0] * w; col.g += b.c1[1] * w; col.b += b.c1[2] * w;
      pos.x += b.x * w; wsum += w;
      if (b.big) shake += Math.exp(-a * 5) * 1.0;
    }
    if (wsum > 0) pos.x = pos.x / (1 + wsum);
    return { col, shake, pos };
  }

  setTime(t: number, scale: number) { this.mat.uniforms.uTime.value = t; this.mat.uniforms.uScale.value = scale; }
}
