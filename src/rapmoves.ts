// 20 komplette Solo-Choreografien für den Rap-Teil – jede mit mindestens einem großen Trick
// (Drehungen, Sprünge, Saltos, Bodenarbeit). Ein Abschnitt bekommt b = Schläge seit Abschnittsbeginn
// und g = Schlag im Lied (für Akzente genau auf dem Takt).
// Arme: links Schulter-z negativ = nach außen/oben; rechts wird gespiegelt angegeben.
// srx/srz drehen um die Körpermitte (Saltos, Rad, Bodenmoves), spin dreht um die senkrechte Achse.

export interface Arm { sx: number; sz: number; ex: number; ez: number; }
export interface Pose { L: Arm; R: Arm; }
export interface Solo {
  pose: Pose;
  y?: number; rx?: number; rz?: number; ry?: number; spin?: number; dx?: number; dz?: number; squash?: number;
  srx?: number; srz?: number;
  legL?: number; legR?: number; spread?: number; // Beine anheben (0…1) und spreizen (0…1)
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
const bump = (g: number) => 0.5 + 0.5 * Math.cos(2 * Math.PI * g);
const swing = (g: number, per = 2) => Math.sin((2 * Math.PI * g) / per);
const arc = (b: number, d: number, h: number) => h * Math.sin(Math.PI * cl(b / d));   // Sprungbogen
const TAU = Math.PI * 2;

const HIP = arm(0.1, -0.55, 0, 1.9);
const CROSS = arm(-0.75, 0.42, -1.5, 0.35);
const UP = arm(0, -2.75, 0, 0.1);
const V = arm(-0.2, -2.35, 0, 0);
const OUT = arm(0, -1.5, 0, 0);
const TUCK = arm(-1.4, 0.3, -1.6, 0);
const FWD = arm(-1.5, -0.1, 0, 0);
const MIC = arm(-1.0, 0.8, -1.95, 0.35);
const GROUND = arm(0, -2.9, 0, 0); // Arm zum Boden (bei kopfüber/seitlich)

// ---------- Bausteine ----------
const backflip = (b: number, d = 1.5): Solo => ({ pose: both(TUCK), y: arc(b, d, 1.25), srx: -TAU * ss(b / d), squash: 0.9 });
const frontflip = (b: number, d = 1.5): Solo => ({ pose: both(TUCK), y: arc(b, d, 1.25), srx: TAU * ss(b / d), squash: 0.9 });
const cartwheel = (b: number, dir: number, d = 2): Solo => ({ pose: both(arm(0, -2.6)), srz: -dir * TAU * ss(b / d), dx: dir * (1.1 * ss(b / d) - 0.55), y: arc(b, d, 0.55), spread: 1 });
const spinJump = (b: number, turns: number, d = 1.5, h = 0.9): Solo => ({ pose: both(arm(-0.4, 0.4, -1.5)), y: arc(b, d, h), spin: TAU * turns * ss(b / d), squash: 0.95 });
const prep = (b: number): Solo => ({ pose: both(arm(0.4, -0.4, -0.3)), squash: 1 - 0.18 * Math.sin(Math.PI * cl(b)), y: -0.08 * Math.sin(Math.PI * cl(b)) });
const land = (b: number, p: Pose = both(V)): Solo => ({ pose: p, squash: 1 - 0.15 * Math.exp(-b * 4), y: 0.05 });

export function mixArm(a: Arm, b: Arm, k: number): Arm { return { sx: L(a.sx, b.sx, k), sz: L(a.sz, b.sz, k), ex: L(a.ex, b.ex, k), ez: L(a.ez, b.ez, k) }; }
export function mixPose(a: Pose, b: Pose, k: number): Pose { return { L: mixArm(a.L, b.L, k), R: mixArm(a.R, b.R, k) }; }
const wrap = (a: number) => { a = a % TAU; return a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a; };
const angMix = (a: number, b: number, k: number) => { const wa = wrap(a); return wa + wrap(wrap(b) - wa) * k; };
export function mixSolo(a: Solo, b: Solo, k: number): Solo {
  const n = (x?: number, d = 0) => x ?? d;
  return {
    pose: mixPose(a.pose, b.pose, k),
    y: L(n(a.y), n(b.y), k), rx: L(n(a.rx), n(b.rx), k), rz: L(n(a.rz), n(b.rz), k), ry: L(n(a.ry), n(b.ry), k),
    spin: angMix(n(a.spin), n(b.spin), k), dx: L(n(a.dx), n(b.dx), k), dz: L(n(a.dz), n(b.dz), k), squash: L(n(a.squash, 1), n(b.squash, 1), k),
    srx: angMix(n(a.srx), n(b.srx), k), srz: angMix(n(a.srz), n(b.srz), k),
    legL: L(n(a.legL), n(b.legL), k), legR: L(n(a.legR), n(b.legR), k), spread: L(n(a.spread), n(b.spread), k),
  };
}

export const ROUTINES: Routine[] = [
  { name: 'Breakdance', steps: [
    { beats: 2, f: (b, g) => ({ pose: both(arm(-0.6, -0.4, -1.2)), squash: 0.88, y: -0.05 * bump(g), srx: -0.3 * ss(b / 2), legL: bump(g) * 0.5 }) },
    { beats: 4, f: b => ({ pose: both(OUT), srx: -1.35, y: -0.48, spin: TAU * 0.8 * b, legL: 1, legR: 1, spread: 1 }) },
    { beats: 4, f: b => ({ pose: both(arm(0, -2.2, 0, 0.4)), srz: Math.PI, y: 0.22, spin: TAU * 0.9 * b, spread: 1 }) },
    { beats: 2, f: () => ({ pose: LR(GROUND, arm(-0.5, -1.2, -1.4)), srz: 1.9, y: -0.12, legL: 1 }) },
    { beats: 2, f: b => ({ pose: both(V), srx: -1.35 * (1 - ss(b / 0.8)), y: L(-0.48, 0, ss(b / 0.8)) + arc(b - 0.8, 0.8, 0.4) }) }, // Kip-up
  ] },
  { name: 'Flickflack-Serie', steps: [
    { beats: 2, f: (b, g) => ({ pose: both(arm(-0.3 * swing(g, 1), -0.3, -1.2)), dz: 0.3 * b / 2, y: 0.06 * bump(2 * g), legL: bump(2 * g), legR: 1 - bump(2 * g) }) },
    { beats: 1, f: prep },
    { beats: 2, f: b => ({ ...backflip(b, 1.6), dz: 0.3 - 0.6 * ss(b / 1.6) }) },
    { beats: 2, f: b => ({ ...backflip(b, 1.6), dz: -0.3 - 0.6 * ss(b / 1.6) }) },
    { beats: 2, f: b => ({ ...spinJump(b, 1, 1.4, 0.7), dz: -0.9 }) },
    { beats: 2, f: b => ({ ...land(b), dz: -0.9 }) },
  ] },
  { name: 'Radschlagen', steps: [
    { beats: 1, f: prep },
    { beats: 2, f: b => cartwheel(b, 1) },
    { beats: 2, f: b => ({ ...cartwheel(b, -1), dx: 0.55 - 1.1 * ss(b / 2) }) },
    { beats: 2, f: b => ({ ...cartwheel(b, 1), dx: -0.55 + 1.1 * ss(b / 2) }) },
    { beats: 2, f: b => ({ pose: both(TUCK), y: arc(b, 1.4, 0.9), spin: Math.PI * ss(b / 1.4), srx: -TAU * ss(b / 1.4), dx: 0.55 }) }, // Rondat mit Salto
    { beats: 2, f: b => ({ ...land(b), dx: 0.55, spin: Math.PI }) },
  ] },
  { name: 'Moonwalk', steps: [
    { beats: 4, f: (b, g) => { const s = Math.floor(2 * g) % 2; return { pose: LR(arm(0.3 * swing(g, 1), -0.25, -0.6), arm(-0.3 * swing(g, 1), -0.25, -0.6)), dz: 0.5 - 0.35 * b, legL: s ? 0.6 : 0, legR: s ? 0 : 0.6, rx: -0.08 }; } },
    { beats: 2, f: b => ({ pose: LR(arm(-0.2, -2.5, -0.3, -1.3), arm(0, -0.6)), spin: TAU * 2 * ss(b / 1.5), y: 0.06, dz: -0.9, legL: 0.4 }) },
    { beats: 4, f: (b, g) => { const s = Math.floor(2 * g) % 2; return { pose: LR(arm(-0.3, -0.5, -0.8), arm(-0.3, -0.5, -0.8)), dx: 0.6 - 0.3 * b, dz: -0.9, ry: -0.6, legL: s ? 0.6 : 0, legR: s ? 0 : 0.6 }; } },
    { beats: 2, f: b => ({ pose: LR(arm(-0.3, -2.5, -0.4, -1.4), HIP), dx: -0.6, dz: -0.9, rz: -0.12, legR: 0.5 * ss(b), y: 0.05 + 0.1 * ss(b) }) },
  ] },
  { name: 'Electric (Popping)', steps: [
    { beats: 4, f: (b, g) => { const q = Math.floor(4 * g); const tw = (k: number) => Math.sin(q * 12.9898 + k) * 0.5; return { pose: LR(arm(-0.6 + tw(1), -0.9 + tw(2), -1.2 + tw(3)), arm(-0.6 + tw(4), -0.9 + tw(5), -1.2 + tw(6))), rz: 0.1 * tw(7), rx: 0.1 * tw(8), squash: 1 + 0.06 * tw(9) }; } },
    { beats: 4, f: (b, g) => { const w = (o: number) => ss(Math.sin(Math.PI * g - o) * 0.5 + 0.5); return { pose: LR(arm(0, -1.55, 0, -1.4 * w(0)), arm(0, -1.55, 0, 1.4 * w(1.5))), rz: 0.15 * (w(0.75) - 0.5), y: 0.04 * w(0.75) }; } },
    { beats: 3, f: b => { const shake = Math.sin(b * 90) * 0.06; return { pose: both(arm(0, -2.6 + shake * 3, 0, shake * 4)), spin: TAU * 1.5 * ss(b / 3), rz: shake, y: 0.1 + shake, squash: 1 + shake }; } },
    { beats: 2, f: () => ({ pose: LR(arm(-1.55, 0, -1.55), arm(0, -1.55, 0, -1.55)), ry: 0.5, squash: 0.95 }) },
  ] },
  { name: 'Windmill', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-0.8, -0.3, -0.8)), squash: L(1, 0.7, ss(b / 2)), y: -0.2 * ss(b / 2) }) },
    { beats: 6, f: b => { const a = TAU * 0.9 * b; return { pose: LR(arm(0, -1.5 - 0.6 * Math.sin(a)), arm(0, -1.5 + 0.6 * Math.sin(a))), srx: -1.3, srz: 0.55 * Math.sin(a), y: -0.45, spin: a, legL: 1, legR: 1, spread: 1 }; } },
    { beats: 2, f: () => ({ pose: LR(GROUND, arm(-1.4, 0.3, -1.6)), srz: 1.3, srx: -0.3, y: -0.3, legL: 1, legR: 0.6 }) }, // Turtle-Freeze
    { beats: 2, f: b => ({ ...spinJump(b, 1, 1.4, 0.8) }) },
    { beats: 1, f: b => land(b) },
  ] },
  { name: 'Tornado-Sprünge', steps: [
    { beats: 1, f: prep },
    { beats: 2, f: b => spinJump(b, 1, 1.5, 0.85) },
    { beats: 1, f: prep },
    { beats: 2, f: b => ({ ...spinJump(b, -1, 1.5, 0.85) }) },
    { beats: 1, f: prep },
    { beats: 3, f: b => ({ ...spinJump(b, 2, 2.2, 1.3), pose: both(arm(0, -2.8)) }) },
    { beats: 2, f: b => land(b) },
  ] },
  { name: 'Salto & Spagat', steps: [
    { beats: 2, f: (b, g) => ({ pose: both(arm(-0.6, -0.6, -1.0)), dz: -0.4 + 0.4 * b / 2, y: 0.08 * bump(2 * g), legL: bump(2 * g), legR: 1 - bump(2 * g) }) },
    { beats: 1, f: prep },
    { beats: 2, f: b => frontflip(b, 1.6) },
    { beats: 2, f: b => ({ pose: both(OUT), y: arc(b, 1.2, 0.9), spread: ss(b / 0.6) * (1 - ss((b - 0.8) / 0.4)), legL: 0.8 * Math.sin(Math.PI * cl(b / 1.2)), legR: 0.8 * Math.sin(Math.PI * cl(b / 1.2)) }) },
    { beats: 3, f: b => ({ pose: both(arm(0, -2.3)), y: -0.38 * ss(b / 0.5), squash: L(1, 0.78, ss(b / 0.5)), spread: 1 }) },
    { beats: 2, f: b => ({ pose: both(V), y: arc(b, 1, 0.5) }) },
  ] },
  { name: 'Air Flare', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-0.8, -0.3, -0.8)), squash: L(1, 0.75, ss(b)), y: -0.15 * ss(b) }) },
    { beats: 6, f: b => ({ pose: LR(GROUND, arm(0, -1.6)), srz: 1.2 + 0.25 * Math.sin(TAU * b), srx: -0.4, y: 0.15 + 0.35 * Math.abs(Math.sin(Math.PI * b)), spin: TAU * 0.75 * b, spread: 1, legL: 1, legR: 1 }) },
    { beats: 2, f: b => ({ pose: both(OUT), srz: 1.2 * (1 - ss(b / 1.2)), y: arc(b, 1.2, 0.6), spin: TAU * ss(b / 1.2) }) },
    { beats: 2, f: b => land(b) },
  ] },
  { name: 'Kopfstand-Kreisel', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-0.6, -0.4, -1.2)), squash: 0.85, srz: Math.PI * ss((b - 0.8) / 1.2), y: 0.22 * ss((b - 0.8) / 1.2) }) },
    { beats: 4, f: b => ({ pose: both(arm(0, -2.2, 0, 0.5)), srz: Math.PI, y: 0.22, spin: TAU * 0.6 * b, spread: 0.5 }) },
    { beats: 3, f: b => ({ pose: both(arm(0, -1.5 + Math.sin(TAU * b) * 0.6)), srz: Math.PI, y: 0.22, spin: TAU * (2.4 + 1.2 * b), spread: 1 }) },
    { beats: 2, f: b => ({ pose: LR(GROUND, arm(-1.4, 0.3, -1.6)), srz: L(Math.PI, 1.6, ss(b / 0.6)), y: -0.1 }) },
    { beats: 2, f: b => ({ pose: both(V), srz: 1.6 * (1 - ss(b / 0.7)), y: arc(b - 0.6, 1, 0.5) }) },
  ] },
  { name: 'Trampolin', steps: [
    { beats: 2, f: b => ({ pose: both(arm(0, -1.0 - 1.2 * Math.sin(Math.PI * (b % 1)))), y: 0.35 * Math.sin(Math.PI * (b % 1)) }) },
    { beats: 2, f: b => ({ pose: both(arm(0, -1.5 - 1.2 * Math.sin(Math.PI * (b % 1)))), y: 0.7 * Math.sin(Math.PI * (b % 1)), spin: Math.PI * Math.floor(b) + Math.PI * ss((b % 1) * 2 - 0.5) }) },
    { beats: 2, f: b => ({ ...spinJump(b, 2, 1.8, 1.3), pose: both(UP) }) },
    { beats: 2, f: b => ({ pose: both(TUCK), y: arc(b, 1.8, 1.5), srx: -TAU * ss(b / 1.8) }) },
    { beats: 2, f: b => land(b, both(arm(0, -2.6, 0, -0.6))) },
  ] },
  { name: 'Wurm & Rolle', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-1.2, -0.3)), srx: 1.4 * ss(b / 1.2), y: -0.45 * ss(b / 1.2) }) },
    { beats: 4, f: (b, g) => ({ pose: both(arm(-2.5, -0.4, 0.8)), srx: 1.4 + 0.3 * Math.sin(Math.PI * g), y: -0.45 + 0.1 * Math.sin(Math.PI * g + 1), dz: 0.15 * b }) },
    { beats: 3, f: b => ({ pose: both(arm(-2.5, -0.3)), srx: 1.4, srz: TAU * 1.5 * ss(b / 3) * 0 + TAU * ss(b / 3), dx: 0.9 * ss(b / 3), y: -0.45, dz: 0.6 }) },
    { beats: 2, f: b => ({ pose: both(V), srx: 1.4 * (1 - ss(b / 0.8)), y: L(-0.45, 0, ss(b / 0.8)) + arc(b - 0.8, 0.8, 0.45), dx: 0.9, dz: 0.6 }) },
    { beats: 2, f: b => ({ ...spinJump(b, 1, 1.4, 0.7), dx: 0.9, dz: 0.6 }) },
  ] },
  { name: 'Beinkreisel', steps: [
    { beats: 2, f: b => ({ pose: both(arm(-0.6, -0.4, -1)), squash: L(1, 0.62, ss(b)), y: -0.28 * ss(b) }) },
    { beats: 6, f: b => ({ pose: LR(GROUND, arm(-0.4, -1.3)), squash: 0.62, y: -0.28, spin: TAU * 0.8 * b, rz: 0.35, legL: 1, spread: 1 }) },
    { beats: 2, f: b => ({ ...spinJump(b, 1.5, 1.5, 1.0), pose: both(arm(0, -2.7)) }) },
    { beats: 2, f: b => land(b, LR(HIP, arm(-0.3, -2.6))) },
  ] },
  { name: 'Tutting & Gleiten', steps: [
    { beats: 4, f: (b, g) => { const i = Math.floor(2 * g) % 4; const P = [LR(arm(0, -1.55, 0, -1.55), arm(-1.55, 0, -1.55)), LR(arm(-1.55, 0, -1.55), arm(0, -1.55, 0, -1.55)), both(arm(0, -1.55, 0, 1.55)), both(arm(-1.55, 0.4, -1.55, 0.6))]; return { pose: P[i], ry: [0.3, -0.3, 0, 0][i] }; } },
    { beats: 4, f: (b, g) => { const s = Math.floor(2 * g) % 2; return { pose: both(arm(-0.3, -0.7, -0.6)), dx: 0.7 * Math.sin(Math.PI * b / 4 * 2), ry: -0.7 * Math.cos(Math.PI * b / 2), legL: s ? 0.5 : 0, legR: s ? 0 : 0.5 }; } },
    { beats: 3, f: b => ({ pose: both(arm(0, -1.55, 0, -1.55)), spin: TAU * 3 * ss(b / 2.5), y: 0.05 }) },
    { beats: 2, f: () => ({ pose: LR(arm(-1.55, 0, -1.55), arm(0, -2.6)), rz: 0.15 }) },
  ] },
  { name: 'Disco-Spagat', steps: [
    { beats: 4, f: (b, g) => { const s = Math.floor(g / 2) % 2; return { pose: s ? LR(arm(-0.4, -2.6), HIP) : LR(HIP, arm(-0.4, -2.6)), rz: s ? -0.2 : 0.2, dx: s ? 0.25 : -0.25, legL: s ? 0.4 : 0, legR: s ? 0 : 0.4 }; } },
    { beats: 3, f: b => ({ pose: LR(arm(-0.4, -2.6), arm(0, -0.8)), spin: TAU * 3 * ss(b / 2.6), y: 0.06 }) },
    { beats: 3, f: b => ({ pose: both(arm(0, -2.4)), y: -0.4 * ss(b / 0.6), squash: L(1, 0.75, ss(b / 0.6)), spread: 1 }) },
    { beats: 2, f: b => ({ pose: LR(arm(-0.4, -2.7), HIP), y: arc(b, 0.9, 0.55), rz: 0.25 }) },
  ] },
  { name: 'Freeze-Serie', steps: [
    { beats: 1, f: prep },
    { beats: 2, f: b => ({ pose: LR(GROUND, arm(-1.4, 0.3, -1.6)), srz: 1.3 * ss(b / 0.5), y: -0.3 * ss(b / 0.5), legL: 1 }) },          // Baby-Freeze
    { beats: 2, f: b => ({ pose: LR(arm(-1.4, 0.3, -1.6), GROUND), srz: -1.6 * ss(b / 0.5), srx: -0.5, y: -0.2, legR: 1 }) },          // Chair-Freeze
    { beats: 2, f: b => ({ pose: both(arm(0, -2.2, 0, 0.5)), srz: Math.PI * ss(b / 0.6), y: 0.22 * ss(b / 0.6), spread: 1 }) },        // Kopfstand
    { beats: 2, f: b => ({ pose: both(TUCK), srz: Math.PI, srx: TAU * ss(b / 1.4) * 0, y: L(0.22, 0.6, Math.sin(Math.PI * cl(b / 1.4))), spin: TAU * ss(b / 1.4) }) },
    { beats: 2, f: b => ({ pose: both(V), srz: Math.PI * (1 - ss(b / 0.7)), y: arc(b, 1.2, 0.6) }) },
  ] },
  { name: 'Knieslide', steps: [
    { beats: 4, f: (b, g) => ({ pose: LR(arm(-0.9, -0.9, -0.3), arm(-0.6, 0.55, -1.3, 0.5 * Math.sin(4 * Math.PI * g))), rx: 0.12 * bump(g), ry: -0.3, legL: 0.3 * bump(g) }) },
    { beats: 2, f: b => ({ ...spinJump(b, 1, 1.6, 1.0), pose: LR(arm(-0.9, -0.9, -0.3), arm(0, -2.6)) }) },
    { beats: 3, f: b => ({ pose: LR(arm(-1.2, -1.2, -0.3), arm(-0.5, 0.5, -1.3, 0.4 * Math.sin(8 * b))), rx: -0.5 * ss(b / 0.5), y: -0.3 * ss(b / 0.5), dz: 1.0 * ss(b / 1.8) - 0.4, squash: 0.85 }) },
    { beats: 2, f: b => ({ pose: both(V), y: arc(b, 1.0, 0.6), dz: 0.6 }) },
  ] },
  { name: 'Ninja', steps: [
    { beats: 4, f: (b, g) => { const s = Math.floor(g) % 2; const k = Math.sin(Math.PI * (g % 1)); return { pose: LR(arm(-1.5, 0.1, -0.2), arm(0.4, -0.5, -1.2)), rz: (s ? 0.35 : -0.35) * k, legL: s ? k : 0, legR: s ? 0 : k, spread: 0.5 * k }; } },
    { beats: 2, f: b => ({ pose: both(OUT), spin: TAU * ss(b / 1.4), y: arc(b, 1.4, 0.6), legR: Math.sin(Math.PI * cl(b / 1.4)), spread: 0.6 }) },
    { beats: 1, f: prep },
    { beats: 2, f: b => backflip(b, 1.6) },
    { beats: 2, f: b => ({ pose: both(arm(-1.3, 0.35, -1.6, 0.3)), rx: 0.5 * Math.sin(Math.PI * cl(b / 2)) }) },
  ] },
  { name: 'Pirouetten & Sprung', steps: [
    { beats: 3, f: b => ({ pose: both(arm(0, -2.6, 0, -0.7)), spin: TAU * 3 * ss(b / 3), y: 0.12, legL: 0.6 }) },
    { beats: 3, f: b => ({ pose: LR(arm(-1.6, -0.3), arm(1.0, -0.8)), dx: -1 + 2 * ss(b / 2), y: arc(b, 2, 1.0), rx: 0.3, spread: Math.sin(Math.PI * cl(b / 2)) }) },
    { beats: 3, f: b => ({ pose: both(arm(0, -2.6, 0, -0.7)), spin: -TAU * 2 * ss(b / 2.4), y: 0.12, dx: 1, legR: 0.6 }) },
    { beats: 2, f: b => ({ pose: both(arm(0.2, -0.9, -0.5)), rx: 0.5 * Math.sin(Math.PI * cl(b / 2)), dx: 1 }) },
  ] },
  { name: 'Siegerfeier', steps: [
    { beats: 2, f: (b, g) => { const s = Math.floor(g) % 2; const up = arm(0, -2.7 + 0.4 * (1 - bump(g)), -0.3); return { pose: s ? LR(up, arm(-0.5, -0.3, -1.2)) : LR(arm(-0.5, -0.3, -1.2), up), y: 0.05 * bump(g) }; } },
    { beats: 2, f: b => cartwheel(b, 1) },
    { beats: 1, f: b => ({ ...prep(b), dx: 0.55 }) },
    { beats: 2, f: b => ({ ...backflip(b, 1.6), dx: 0.55 }) },
    { beats: 2, f: b => ({ ...spinJump(b, 1, 1.5, 0.9), pose: both(arm(0, -2.8)), dx: 0.55 }) },
    { beats: 2, f: (b, g) => ({ pose: both(arm(0, -2.4, 0, 0.3 * Math.sin(12 * b))), dx: 0.55, y: 0.05, rz: 0.06 * Math.sin(12 * b) }) },
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
      if (i > 0 && b < 0.35) return mixSolo(r.steps[i - 1].f(r.steps[i - 1].beats, g), cur, ss(b / 0.35));
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

/** Wer tanzt in Rap-Teil `rapNo`, Solo `slot` welche Choreografie (count = 2 oder 3 gleichzeitig). */
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
