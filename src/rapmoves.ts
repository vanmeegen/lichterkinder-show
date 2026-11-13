// 20 Solo-Moves für den Rap-Teil. Jeder Move bekommt die Schläge seit Beginn des 2-Takt-Abschnitts (0…8)
// und liefert Armhaltung plus Körperbewegung. Links: Schulter-z negativ = nach außen/oben; rechts wird gespiegelt.

export interface Arm { sx: number; sz: number; ex: number; ez: number; }
export interface Pose { L: Arm; R: Arm; }
export interface Solo {
  pose: Pose;
  y?: number; rx?: number; rz?: number; ry?: number; spin?: number; dx?: number; dz?: number; squash?: number;
}

export const arm = (sx: number, sz: number, ex = 0, ez = 0): Arm => ({ sx, sz, ex, ez });
export const mirror = (a: Arm): Arm => ({ sx: a.sx, sz: -a.sz, ex: a.ex, ez: -a.ez });
const both = (a: Arm): Pose => ({ L: a, R: mirror(a) });
const cl = (x: number) => Math.min(1, Math.max(0, x));
const ss = (x: number) => { x = cl(x); return x * x * (3 - 2 * x); };
const lerpArm = (a: Arm, b: Arm, k: number): Arm => ({ sx: a.sx + (b.sx - a.sx) * k, sz: a.sz + (b.sz - a.sz) * k, ex: a.ex + (b.ex - a.ex) * k, ez: a.ez + (b.ez - a.ez) * k });
const lerpPose = (a: Pose, b: Pose, k: number): Pose => ({ L: lerpArm(a.L, b.L, k), R: lerpArm(a.R, b.R, k) });
/** Zwischen Haltungen pro Schlag wechseln, mit kurzem, knackigem Übergang. */
const snap = (poses: Pose[], b: number, per = 1, tr = 0.15): Pose => {
  const i = Math.floor(b / per), f = (b / per) - i;
  const cur = poses[i % poses.length], prev = poses[(i + poses.length - 1) % poses.length];
  return lerpPose(prev, cur, ss(f / tr));
};

const HIP: Arm = arm(0.1, -0.55, 0, 1.9);
const CROSS: Arm = arm(-0.75, 0.42, -1.5, 0.35);

export const RAP_MOVES: { name: string; f: (b: number) => Solo }[] = [
  { name: 'Zeigen im Wechsel', f: b => {
    const bump = 0.5 + 0.5 * Math.cos(2 * Math.PI * b);
    const point = arm(-1.35, -0.15, -0.3 - 0.55 * bump, 0);
    const side = Math.floor(b) % 2;
    return { pose: side ? { L: point, R: mirror(HIP) } : { L: HIP, R: mirror(point) }, rx: 0.15 * bump, ry: side ? 0.25 : -0.25 };
  } },
  { name: 'Dach hochdrücken (doppelt)', f: b => {
    const p = 0.5 + 0.5 * Math.cos(4 * Math.PI * b);
    return { pose: both(arm(0, -1.2 - 0.35 * p, 0, -1.45)), y: 0.06 * p, squash: 1 - 0.05 * p };
  } },
  { name: 'Armwelle', f: b => {
    const w = (o: number) => Math.sin(2 * Math.PI * b / 2 - o);
    return { pose: { L: arm(0, -1.5 + 0.3 * w(0), 0, 1.0 * w(0.7)), R: mirror(arm(0, -1.5 - 0.3 * w(1.8), 0, -1.0 * w(2.5))) }, rz: 0.12 * w(1.2) };
  } },
  { name: 'Dab', f: b => {
    const up = arm(0, -2.35, 0, 0), face = arm(-1.2, 0.65, -1.7, 0.45);
    const k = ss(((b % 2) - 0) / 0.2), side = Math.floor(b / 2) % 2;
    const pose = side ? { L: up, R: mirror(face) } : { L: face, R: mirror(up) };
    return { pose: lerpPose(both(arm(0, -0.3, -0.3)), pose, k), rx: 0.3 * k, rz: (side ? -0.3 : 0.3) * k };
  } },
  { name: 'Armschwingen', f: b => {
    const s = Math.sin(Math.PI * b);
    return { pose: { L: arm(-0.35, 0.85 * s, -0.4, 0), R: mirror(arm(-0.35, -0.85 * s, -0.4, 0)) }, rz: -0.12 * s, dx: 0.12 * s };
  } },
  { name: 'Hüpfen mit V-Armen', f: b => {
    const j = Math.abs(Math.sin(Math.PI * b));
    return { pose: both(arm(0, -2.45 - 0.2 * j, 0, 0.2)), y: 0.4 * j, squash: 1 + 0.08 * (j - 0.5) };
  } },
  { name: 'Pirouette', f: b => {
    const w = (s: number) => ss((b - s) / 1.0);
    const spin = 2 * Math.PI * (w(2.5) + w(6.5));
    return { pose: both(arm(0, -1.45, 0, -0.3)), spin, y: 0.08 * Math.sin(Math.PI * cl(b % 4 - 2.5)) };
  } },
  { name: 'Schulter-Shimmy', f: b => {
    const s = Math.sin(4 * Math.PI * b);
    return { pose: { L: arm(-0.3 + 0.35 * s, -0.75, -1.3, 0), R: mirror(arm(-0.3 - 0.35 * s, -0.75, -1.3, 0)) }, rz: 0.1 * s, rx: 0.1 };
  } },
  { name: 'Klatschen', f: b => {
    const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * b);
    return { pose: both(arm(-1.3, -0.35 + 0.75 * c, -0.3, 0)), rx: 0.12 * c };
  } },
  { name: 'Mikrofon', f: b => {
    const bump = 0.5 + 0.5 * Math.cos(2 * Math.PI * b);
    return { pose: { L: arm(-1.0, 0.8, -1.95, 0.35), R: mirror(arm(-1.4 - 0.7 * bump, -0.2, -0.1, 0)) }, rx: 0.18 * bump, ry: -0.2 };
  } },
  { name: 'Roboter', f: b => ({
    pose: snap([
      { L: arm(0, -1.55, 0, -1.55), R: mirror(arm(0, -0.2, 0, 0)) },
      { L: arm(-1.55, 0, 0, 0), R: mirror(arm(-1.55, 0, -1.55, 0)) },
      { L: arm(0, -0.2, 0, 0), R: mirror(arm(0, -1.55, 0, -1.55)) },
      both(arm(-1.55, 0, -1.55, 0)),
    ], b, 1, 0.08),
    ry: [0.4, 0, -0.4, 0][Math.floor(b) % 4],
  }) },
  { name: 'Cool zurücklehnen', f: b => {
    const bump = 0.5 + 0.5 * Math.cos(2 * Math.PI * b);
    return { pose: { L: CROSS, R: mirror(CROSS) }, rx: -0.28 + 0.06 * bump, ry: 0.3 * Math.sin(Math.PI * b / 4) };
  } },
  { name: 'Seitwärts gleiten', f: b => {
    const s = Math.sin(Math.PI * b / 4);
    const a = Math.sin(Math.PI * b);
    return { pose: { L: arm(-0.6 * a, -0.35, -0.6, 0), R: mirror(arm(0.6 * a, -0.35, -0.6, 0)) }, dx: 0.5 * s, ry: -0.5 * Math.cos(Math.PI * b / 4) };
  } },
  { name: 'Winken über dem Kopf', f: b => {
    const s = Math.sin(Math.PI * b);
    return { pose: { L: arm(0, -2.65 + 0.35 * s, 0, 0.55 * s), R: mirror(arm(0, -2.65 - 0.35 * s, 0, -0.55 * s)) }, rz: -0.1 * s };
  } },
  { name: 'Brust-Pop', f: b => {
    const p = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * b), 4);
    return { pose: both(arm(0.45 * p, -0.7, -0.2, 0.5)), rx: -0.25 * p, dz: 0.12 * p, squash: 1 + 0.06 * p };
  } },
  { name: 'Seitsprünge', f: b => {
    const j = Math.abs(Math.sin(Math.PI * b));
    const side = Math.floor(b) % 2 ? 1 : -1;
    return { pose: both(arm(0, -1.8, 0, -0.4)), y: 0.3 * j, dx: 0.35 * Math.sin(Math.PI * b / 2), rz: -0.15 * side * j };
  } },
  { name: 'Disco-Zeigen', f: b => {
    const side = Math.floor(b / 2) % 2;
    const sky = arm(-0.4, -2.6, 0, 0), floor = arm(-0.6, 0.3, 0, 0);
    const k = ss((b % 2) / 0.25);
    const pose = side ? { L: sky, R: mirror(HIP) } : { L: HIP, R: mirror(sky) };
    const pose2 = side ? { L: floor, R: mirror(HIP) } : { L: HIP, R: mirror(floor) };
    return { pose: lerpPose(pose2, pose, (b % 1) < 0.5 ? k : 1 - ss(((b % 1) - 0.5) / 0.3)), rz: side ? -0.2 : 0.2 };
  } },
  { name: 'DJ-Scratch', f: b => {
    const s = Math.sin(4 * Math.PI * b);
    return { pose: { L: arm(-0.1, -1.95, 0, -2.2), R: mirror(arm(-1.05, -0.15, -0.9, 0.55 * s)) }, rx: 0.15, rz: 0.12, ry: 0.15 };
  } },
  { name: 'Schulterzucken', f: b => {
    const p = 0.5 + 0.5 * Math.cos(2 * Math.PI * b);
    return { pose: both(arm(-0.35, -0.55 - 0.25 * p, -1.35, -0.55 * p)), y: 0.05 * p, squash: 1 + 0.05 * p, rz: 0.08 * Math.sin(Math.PI * b) };
  } },
  { name: 'B-Boy-Stand', f: b => {
    const side = Math.floor(b / 2) % 2 ? 1 : -1;
    const k = ss((b % 2) / 0.25);
    return { pose: { L: CROSS, R: mirror(CROSS) }, rz: 0.16 * side * k, ry: 0.45 * side * k, rx: 0.08 };
  } },
];

export function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wer macht in welchem 2-Takt-Abschnitt welchen Move – fest vorberechnet (Vorspulen bleibt gleich). */
export function soloPlan(rapNo: number, seg: number, count: number, exclude: number, nKids: number): { kid: number; move: number }[] {
  const r = mulberry(4242 + rapNo * 97);
  const moves = RAP_MOVES.map((_, i) => i);
  for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
  const offset = rapNo * 5;
  const rk = mulberry(777 + rapNo * 31 + seg * 13);
  const pool = Array.from({ length: nKids }, (_, i) => i).filter(i => i !== exclude);
  const out: { kid: number; move: number }[] = [];
  for (let j = 0; j < count; j++) {
    const ki = Math.floor(rk() * pool.length);
    const kid = pool.splice(ki, 1)[0];
    out.push({ kid, move: moves[(offset + seg * count + j) % moves.length] });
  }
  return out;
}
