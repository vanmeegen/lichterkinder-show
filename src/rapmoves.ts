// 20 komplette Solo-Choreografien für den Rap-Teil. Jede besteht aus mehreren Abschnitten (in Schlägen).
// Ein Abschnitt bekommt b = Schläge seit Abschnittsbeginn und g = Schlag im Lied (für Akzente genau auf dem Takt).
// Arme: links Schulter-z negativ = nach außen/oben; rechts wird gespiegelt angegeben (mirror).

export interface Arm { sx: number; sz: number; ex: number; ez: number; }
export interface Pose { L: Arm; R: Arm; }
export interface Solo {
  pose: Pose;
  y?: number; rx?: number; rz?: number; ry?: number; spin?: number; dx?: number; dz?: number; squash?: number;
  srx?: number; srz?: number; // Drehung um die Körpermitte (Boden-Moves)
}
type Step = { beats: number; f: (b: number, g: number) => Solo };
export interface Routine { name: string; steps: Step[]; }

export const arm = (sx: number, sz: number, ex = 0, ez = 0): Arm => ({ sx, sz, ex, ez });
export const mirror = (a: Arm): Arm => ({ sx: a.sx, sz: -a.sz, ex: a.ex, ez: -a.ez });
const both = (a: Arm): Pose => ({ L: a, R: mirror(a) });
const LR = (l: Arm, r: Arm): Pose => ({ L: l, R: mirror(r) });
const cl = (x: number) => Math.min(1, Math.max(0, x));
const ss = (x: number) => { x = cl(x); return x * x * (3 - 2 * x); };
const L = (a: number, b: number, k: number) => a + (b - a) * k;
const bump = (g: number) => 0.5 + 0.5 * Math.cos(2 * Math.PI * g);          // 1 genau auf dem Schlag
const hit = (g: number) => Math.pow(bump(g), 4);                            // kurzer Akzent
const swing = (g: number, per = 2) => Math.sin((2 * Math.PI * g) / per);   // Pendel über `per` Schläge
const TAU = Math.PI * 2;

const HIP = arm(0.1, -0.55, 0, 1.9);
const CROSS = arm(-0.75, 0.42, -1.5, 0.35);
const DOWN = arm(0, -0.25, -0.25, 0);
const UP = arm(0, -2.75, 0, 0.1);
const OUT = arm(0, -1.5, 0, 0);
const FWD = arm(-1.5, -0.1, 0, 0);
const MIC = arm(-1.0, 0.8, -1.95, 0.35);
const EAR = arm(-0.1, -1.95, 0, -2.2);

export function mixArm(a: Arm, b: Arm, k: number): Arm { return { sx: L(a.sx, b.sx, k), sz: L(a.sz, b.sz, k), ex: L(a.ex, b.ex, k), ez: L(a.ez, b.ez, k) }; }
export function mixPose(a: Pose, b: Pose, k: number): Pose { return { L: mixArm(a.L, b.L, k), R: mixArm(a.R, b.R, k) }; }
const wrap = (a: number) => { a = a % TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
export function mixSolo(a: Solo, b: Solo, k: number): Solo {
  const n = (x?: number, d = 0) => x ?? d;
  const sa = wrap(n(a.spin)), sb = wrap(n(b.spin));
  return {
    pose: mixPose(a.pose, b.pose, k),
    y: L(n(a.y), n(b.y), k), rx: L(n(a.rx), n(b.rx), k), rz: L(n(a.rz), n(b.rz), k), ry: L(n(a.ry), n(b.ry), k),
    spin: sa + wrap(sb - sa) * k, dx: L(n(a.dx), n(b.dx), k), dz: L(n(a.dz), n(b.dz), k), squash: L(n(a.squash, 1), n(b.squash, 1), k),
    srx: L(n(a.srx), n(b.srx), k), srz: L(n(a.srz), n(b.srz), k),
  };
}

export const ROUTINES: Routine[] = [
  { name: 'Breakdance', steps: [
    { beats: 2, f: (b, g) => ({ pose: both(arm(-0.6, -0.4, -1.2)), squash: 0.9, y: -0.05 * bump(g), srx: -0.25 * ss(b / 2) }) },
    { beats: 5, f: b => ({ pose: both(OUT), srx: -1.35, y: -0.48, spin: TAU * 0.6 * b }) },
    { beats: 4, f: b => ({ pose: both(arm(0, -2.2, 0, 0.4)), srz: Math.PI, y: 0.22, spin: TAU * 0.75 * b }) },
    { beats: 3, f: () => ({ pose: LR(arm(0, -2.9), arm(-0.5, -1.2, -1.4)), srz: 1.9, y: -0.12 }) },
    { beats: 2, f: (b, g) => ({ pose: both(UP), y: 0.2 * Math.abs(Math.sin(Math.PI * g)) }) },
  ] },
  { name: 'Roboter', steps: [
    { beats: 4, f: b => { const i = Math.floor(b) % 4; const P = [LR(arm(0, -1.55, 0, -1.55), DOWN), LR(FWD, arm(-1.55, 0, -1.55)), LR(DOWN, arm(0, -1.55, 0, -1.55)), both(arm(-1.55, 0, -1.55))]; return { pose: P[i], ry: [0.4, 0, -0.4, 0][i] }; } },
    { beats: 4, f: b => ({ pose: LR(arm(-1.55, 0, -1.55), arm(-1.55, 0, -1.55)), dx: [-0.3, -0.15, 0, 0.15][Math.floor(b) % 4] * 2, ry: Math.floor(b) % 2 ? 0.6 : -0.6 }) },
    { beats: 4, f: b => { const k = (o: number) => ss((b % 2) - o); return { pose: LR(arm(0, -1.55, 0, -1.55 * k(0)), arm(0, -1.55, 0, -1.55 * k(0.5))), rz: 0.15 * Math.sign(Math.sin(Math.PI * b)) }; } },
    { beats: 3, f: b => ({ pose: both(mixArm(OUT, arm(0.2, -0.1, 0.1), ss(b / 3))), squash: 1 - 0.15 * ss(b / 3), rx: 0.35 * ss(b / 3) }) },
  ] },
  { name: 'Gleiter', steps: [
    { beats: 4, f: (b, g) => ({ pose: LR(arm(0.5 * swing(g), -0.3, -0.5), arm(-0.5 * swing(g), -0.3, -0.5)), dz: -0.7 * (b / 4), y: 0.04 * bump(g), ry: Math.PI * 0.08 }) },
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-0.5 * swing(g), -0.3, -0.5), arm(0.5 * swing(g), -0.3, -0.5)), dz: -0.7 + 0.7 * (b / 4), dx: 0.4 * Math.sin(Math.PI * b / 4) }) },
    { beats: 2, f: b => ({ pose: both(arm(0, -1.2, 0, -0.5)), spin: TAU * ss(b / 2) }) },
    { beats: 3, f: () => ({ pose: LR(arm(-0.3, -2.4, -0.4, -1.4), OUT), rz: -0.2, rx: -0.1 }) },
  ] },
  { name: 'Party-Rakete', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -1.2 - 0.35 * bump(2 * g), 0, -1.45)), y: 0.06 * bump(2 * g) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -2.3, 0, 0)), y: 0.35 * Math.abs(Math.sin(Math.PI * g)), spin: Math.PI * Math.floor(b / 2) + Math.PI * ss((b % 2) - 0.5) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -2.6 + 0.5 * bump(g), 0, -0.5 * bump(g))), rx: -0.1 }) },
    { beats: 2, f: () => ({ pose: both(arm(-0.3, -2.4)), y: 0.15 }) },
  ] },
  { name: 'Disco-Fieber', steps: [
    { beats: 4, f: (b, g) => { const s = Math.floor(g / 2) % 2; return { pose: s ? LR(arm(-0.4, -2.6), HIP) : LR(HIP, arm(-0.4, -2.6)), rz: s ? -0.2 : 0.2, dx: s ? 0.15 : -0.15 }; } },
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-1.2, 0.3 + 0.3 * swing(g, 1), -1.5), arm(-1.2, 0.3 - 0.3 * swing(g, 1), -1.5)), rz: 0.2 * swing(g), dx: 0.2 * swing(g) }) },
    { beats: 2, f: b => ({ pose: LR(arm(-0.4, -2.6), arm(0, -0.8)), spin: TAU * ss(b / 2) }) },
    { beats: 3, f: () => ({ pose: LR(arm(-0.4, -2.7), HIP), rz: 0.25, ry: -0.3 }) },
  ] },
  { name: 'Shuffle', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.4 * swing(g, 1), -0.35, -0.8)), dx: 0.35 * swing(g, 1), y: 0.05 * Math.abs(swing(g, 1)), squash: 0.95 }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -1.4 - 1.0 * bump(g), 0, -0.8 * (1 - bump(g)))), y: 0.08 * bump(g) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0.4 * swing(g, 1), -0.35, -0.8)), dx: -0.35 * swing(g, 1), spin: b > 2 ? TAU * ss(b - 2) : 0 }) },
    { beats: 2, f: () => ({ pose: LR(HIP, FWD), rx: 0.1, ry: 0.2 }) },
  ] },
  { name: 'Hampelmann', steps: [
    { beats: 6, f: (b, g) => { const o = Math.abs(Math.sin(Math.PI * g)); return { pose: both(arm(0, -0.3 - 2.4 * o)), y: 0.25 * o }; } },
    { beats: 3, f: b => ({ pose: both(arm(-0.6, 0.2, -1.4)), y: 0.55 * Math.sin(Math.PI * cl(b / 1.5)), spin: TAU * ss(b / 1.5), squash: 0.9 }) },
    { beats: 3, f: () => ({ pose: both(arm(0, -2.2)), y: 0.12, squash: 1.05 }) },
  ] },
  { name: 'Welle', steps: [
    { beats: 4, f: (b, g) => { const w = (o: number) => Math.sin(Math.PI * g - o); return { pose: { L: arm(0, -1.5 + 0.3 * w(0), 0, w(0.7)), R: mirror(arm(0, -1.5 - 0.3 * w(1.8), 0, -w(2.5))) } }; } },
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.3, -0.4, -0.6)), rx: 0.25 * Math.sin(Math.PI * g), y: 0.05 * Math.sin(Math.PI * g + 1), squash: 1 + 0.05 * Math.sin(Math.PI * g + 2) }) },
    { beats: 4, f: (b, g) => { const w = (o: number) => Math.sin(2 * Math.PI * g - o); return { pose: { L: arm(-0.2, -2.3 + 0.3 * w(0), 0, 0.8 * w(0.6)), R: mirror(arm(-0.2, -2.3 + 0.3 * w(1.2), 0, 0.8 * w(1.8))) }, rz: 0.1 * w(0.9) }; } },
    { beats: 2, f: b => ({ pose: LR(arm(-1.2, 0.4, -1.4), arm(0.3, -1.2)), rx: 0.6 * Math.sin(Math.PI * cl(b / 2)) }) },
  ] },
  { name: 'DJ', steps: [
    { beats: 4, f: (b, g) => ({ pose: LR(EAR, arm(-1.05, -0.15, -0.9, 0.6 * Math.sin(4 * Math.PI * g))), rx: 0.15 + 0.08 * bump(g), ry: 0.15 }) },
    { beats: 4, f: (b, g) => ({ pose: both(EAR), rx: 0.2 * bump(g), rz: 0.08 * swing(g) }) },
    { beats: 4, f: (b, g) => ({ pose: LR(HIP, arm(-0.4, -2.3 + 0.6 * bump(g), -0.9 * bump(g))), y: 0.05 * bump(g) }) },
    { beats: 2, f: () => ({ pose: both(arm(-0.2, -2.5)), y: 0.12 }) },
  ] },
  { name: 'Luftgitarre', steps: [
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-0.9, -0.9, -0.3), arm(-0.6, 0.55, -1.3, 0.5 * Math.sin(4 * Math.PI * g))), rx: 0.12 * bump(g), ry: -0.3 }) },
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-0.9, -0.9, -0.3), arm(0, -1.4 + 1.8 * Math.sin(Math.PI * g), 0)), rz: 0.1, ry: -0.3 }) },
    { beats: 3, f: (b, g) => ({ pose: LR(arm(-0.9, -0.9, -0.3), arm(-0.6, 0.55, -1.3)), y: 0.4 * Math.abs(Math.sin(Math.PI * g)), squash: 0.95 }) },
    { beats: 3, f: b => ({ pose: LR(arm(-1.2, -1.2, -0.3), arm(-0.5, 0.5, -1.3, 0.3)), rx: -0.45 * ss(b), y: -0.25 * ss(b), dz: 0.5 * ss(b / 1.5) }) },
  ] },
  { name: 'Lässiger Typ', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(CROSS), rx: -0.28 + 0.06 * bump(g), ry: 0.2 }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.35, -0.55 - 0.25 * bump(g), -1.35, -0.55 * bump(g))), y: 0.05 * bump(g), squash: 1 + 0.05 * bump(g) }) },
    { beats: 4, f: (b, g) => { const s = Math.floor(g) % 2; return { pose: s ? LR(arm(-1.5, -0.3), HIP) : LR(HIP, arm(-1.5, -0.3)), ry: s ? 0.3 : -0.3, rx: 0.1 }; } },
    { beats: 2, f: b => ({ pose: both(CROSS), ry: 0.6 * ss(b), rz: 0.1, rx: -0.1 }) },
  ] },
  { name: 'Ballerina', steps: [
    { beats: 4, f: b => ({ pose: both(arm(0, -2.6, 0, -0.7)), spin: TAU * 2 * ss(b / 4), y: 0.12 }) },
    { beats: 4, f: () => ({ pose: LR(arm(-1.6, -0.3), arm(1.0, -0.8)), rx: 0.5, dz: -0.2 }) },
    { beats: 3, f: (b, g) => ({ pose: both(arm(0, -1.8, 0, -0.6)), y: 0.2 * Math.abs(Math.sin(2 * Math.PI * g)) }) },
    { beats: 2, f: b => ({ pose: both(arm(0.2, -0.9, -0.5)), rx: 0.5 * Math.sin(Math.PI * cl(b / 2)), squash: 1 - 0.1 * Math.sin(Math.PI * cl(b / 2)) }) },
  ] },
  { name: 'Twist', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.6, -0.7, -1.3)), ry: 0.5 * swing(g, 1), rz: 0.05 * swing(g, 1) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.6, -0.7, -1.3)), ry: 0.5 * swing(g, 1), squash: 1 - 0.2 * (b / 4), y: -0.1 * (b / 4) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(-0.6, -0.7, -1.3)), ry: 0.5 * swing(g, 1), squash: 0.8 + 0.2 * (b / 4), y: -0.1 + 0.1 * (b / 4) }) },
    { beats: 2, f: () => ({ pose: both(UP), y: 0.15 }) },
  ] },
  { name: 'Kosakentanz', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(CROSS), squash: 0.75, y: -0.12 + 0.03 * bump(2 * g) }) },
    { beats: 4, f: (b, g) => ({ pose: both(CROSS), squash: 0.75, y: -0.1, dx: 0.25 * swing(g, 1), rz: -0.2 * swing(g, 1) }) },
    { beats: 2, f: b => ({ pose: both(OUT), y: 0.5 * Math.sin(Math.PI * cl(b / 1.5)), squash: 1.05 }) },
    { beats: 3, f: (b, g) => ({ pose: both(arm(-1.3, -0.35 + 0.75 * bump(g), -0.3)), squash: 0.8, y: -0.08 }) },
  ] },
  { name: 'Wurm', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-1.2, -0.3)), srx: 1.4 * ss(b / 1.5), y: -0.45 * ss(b / 1.5) }) },
    { beats: 6, f: (b, g) => ({ pose: both(arm(-2.5, -0.4, 0.8)), srx: 1.4 + 0.25 * Math.sin(Math.PI * g), y: -0.45 + 0.08 * Math.sin(Math.PI * g + 1), dz: 0.12 * b }) },
    { beats: 3, f: b => ({ pose: both(arm(-2.5, -0.3)), srx: 1.4, srz: TAU * ss(b / 3), y: -0.45, dz: 0.72 }) },
    { beats: 2, f: b => ({ pose: both(UP), dz: 0.72 * (1 - ss(b / 2)), y: 0.1 }) },
  ] },
  { name: 'Helikopter', steps: [
    { beats: 4, f: b => ({ pose: both(OUT), spin: TAU * (b / 4) }) },
    { beats: 4, f: b => ({ pose: both(arm(0, -1.6)), spin: TAU * 3 * ss(b / 4), y: 0.06 }) },
    { beats: 3, f: b => ({ pose: both(arm(0, -0.9, -0.3, 0.3 * Math.sin(5 * b))), rz: 0.2 * Math.sin(3 * b), rx: 0.12 * Math.sin(2.3 * b) }) },
    { beats: 2, f: () => ({ pose: LR(HIP, arm(-0.3, -2.5)), rz: 0.1 }) },
  ] },
  { name: 'Flatterhuhn', steps: [
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -0.4 - 0.9 * bump(2 * g), -0.4, 2.2)), y: 0.03 * bump(2 * g) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -0.6, -0.4, 2.2)), rx: 0.35 * hit(g), dz: 0.1 * hit(g) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -0.4 - 0.9 * bump(2 * g), -0.4, 2.2)), y: 0.25 * Math.abs(Math.sin(Math.PI * g)), dx: 0.3 * swing(g, 4) }) },
    { beats: 2, f: () => ({ pose: both(arm(0, -1.9)), y: 0.1 }) },
  ] },
  { name: 'MC', steps: [
    { beats: 4, f: (b, g) => ({ pose: LR(MIC, arm(-0.3, -0.5, -0.4)), dx: 0.5 * Math.sin(Math.PI * b / 2), rx: 0.12 * bump(g), ry: 0.3 * Math.cos(Math.PI * b / 2) }) },
    { beats: 4, f: (b, g) => { const s = Math.floor(g) % 2; return { pose: LR(MIC, arm(-1.5 - 0.3 * bump(g), s ? 0.3 : -0.4)), ry: s ? -0.2 : 0.2 }; } },
    { beats: 4, f: (b, g) => ({ pose: LR(MIC, arm(0, -2.6, 0, 0.6 * swing(g))), rz: -0.1 * swing(g) }) },
    { beats: 2, f: b => ({ pose: LR(arm(-0.6, -0.4, -0.2), arm(-0.4, -2.4)), rx: -0.15 * ss(b), ry: 0.2 }) },
  ] },
  { name: 'Sieger', steps: [
    { beats: 4, f: (b, g) => { const s = Math.floor(g) % 2; const up = arm(0, -2.7 + 0.4 * (1 - bump(g)), -0.3); return { pose: s ? LR(up, arm(-0.5, -0.3, -1.2)) : LR(arm(-0.5, -0.3, -1.2), up), y: 0.05 * bump(g) }; } },
    { beats: 4, f: (b, g) => ({ pose: both(arm(0, -2.3)), y: 0.45 * Math.abs(Math.sin(Math.PI * g)), squash: 1 + 0.06 * Math.sin(2 * Math.PI * g) }) },
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-1.0 * swing(g, 1), -0.2, -1.3), arm(1.0 * swing(g, 1), -0.2, -1.3)), y: 0.08 * Math.abs(swing(g, 1)), dz: 0.1 }) },
    { beats: 2, f: b => ({ pose: both(arm(0.3, -0.5)), rx: 0.8 * Math.sin(Math.PI * cl(b / 2)) }) },
  ] },
  { name: 'Kreisel & Freeze', steps: [
    { beats: 4, f: b => ({ pose: both(arm(-0.8, -0.5, -1.0)), dx: 0.35 * Math.sin(Math.PI * b), dz: 0.25 * Math.cos(Math.PI * b), squash: 0.85, y: -0.05 }) },
    { beats: 4, f: b => ({ pose: both(arm(0, -1.4, 0, -0.3)), srx: -1.0, y: -0.4, spin: TAU * 1.5 * ss(b / 4) }) },
    { beats: 2, f: () => ({ pose: LR(arm(0, -2.9), arm(-0.5, -1.2, -1.4)), srz: -1.6, y: -0.15 }) },
    { beats: 2, f: b => ({ pose: both(UP), y: 0.45 * Math.sin(Math.PI * cl(b / 1.2)) }) },
  ] },
];

export function routineBeats(r: Routine) { return r.steps.reduce((a, s) => a + s.beats, 0); }

/** Wertet eine Choreografie aus: u = Fortschritt 0…1 über die verfügbare Zeit, g = Liedschlag. */
export function evalRoutine(r: Routine, u: number, g: number): Solo {
  const total = routineBeats(r);
  const pos = cl(u) * total;
  let acc = 0;
  for (let i = 0; i < r.steps.length; i++) {
    const st = r.steps[i];
    if (pos < acc + st.beats || i === r.steps.length - 1) {
      const b = Math.min(st.beats, pos - acc);
      const cur = st.f(b, g);
      if (i > 0 && b < 0.4) return mixSolo(r.steps[i - 1].f(r.steps[i - 1].beats, g), cur, ss(b / 0.4));
      return cur;
    }
    acc += st.beats;
  }
  return r.steps[0].f(0, g);
}

export function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Feste Zufallsreihenfolge der 20 Choreografien – keine kommt im Lied doppelt vor. */
const ORDER = (() => { const r = mulberry(2026); const a = ROUTINES.map((_, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; })();

/** Wer tanzt in Rap-Teil `rapNo`, Solo `slot` welche Choreografie (count = 1 oder 3 gleichzeitig). */
export function soloPlan(rapNo: number, slot: number, count: number, nKids: number): { kid: number; routine: number }[] {
  const rk = mulberry(991 + rapNo * 131 + slot * 17);
  const pool = Array.from({ length: nKids }, (_, i) => i);
  if (slot > 0) for (const p of soloPlan(rapNo, slot - 1, count, nKids)) pool.splice(pool.indexOf(p.kid), 1); // nicht dieselben wie zuvor
  const out: { kid: number; routine: number }[] = [];
  for (let j = 0; j < count; j++) {
    const kid = pool.splice(Math.floor(rk() * pool.length), 1)[0];
    out.push({ kid, routine: ORDER[(rapNo * 6 + slot * count + j) % ORDER.length] });
  }
  return out;
}
