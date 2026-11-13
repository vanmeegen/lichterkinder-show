// Die Lichterkinder: eigene, knuffige Bohnen-Figuren mit Mütze, Schal, Laterne – und Armen mit Ellbogen.
import * as THREE from 'three';

export interface Mood {
  t: number;            // Liedzeit (s)
  beat: number;         // Schläge seit dem ersten Schlag
  energy: number;       // 0 ruhig … 1 Refrain
  rap: number;          // 0 … 1 Rap-Teil (alle synchron)
  rapT: number;         // Sekunden seit Beginn des Rap-Teils (−1 außerhalb)
  rapLen: number;       // Länge des Rap-Teils
  since: Record<string, number>; // Sekunden seit letztem Effekt je Typ
  look: THREE.Vector3;  // wohin geschaut wird (letzter Knall)
}

const BODY = [0xff5a5a, 0x3fb6ff, 0xffc93a, 0x6be07a, 0xff7ad9, 0x9b7bff, 0xff9a3c, 0x38d9c9, 0xf25c8a];
const HAT = [0x2a9d4b, 0xd62828, 0x2563eb, 0xd62828, 0x10b981, 0xf59e0b, 0x7c3aed, 0xe11d48, 0x1d4ed8];
const SCARF = [0xffd166, 0xffffff, 0xff6b6b, 0x4cc9f0, 0xffd166, 0xff6b6b, 0x4cc9f0, 0xffffff, 0x80ed99];
const LANTERN = [0xffb347, 0xff6b6b, 0xffe066, 0x7cf0ff, 0xff8fd8, 0xffb347, 0xb4ff7c, 0xffe066, 0xff9a5a];
const BREAKER = 4; // das Kind in der Mitte tanzt Breakdance

let gradientMap: THREE.Texture | null = null;
function toon(color: number) {
  if (!gradientMap) {
    const d = new Uint8Array([90, 170, 255]);
    gradientMap = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap });
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _swing = new THREE.Euler();
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ss = (x: number) => { x = cl(x); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Armhaltung: Schulter (x vor/zurück, z seitlich) und Ellbogen (x, z). Links: z negativ = nach außen/oben. */
interface Arm { sx: number; sz: number; ex: number; ez: number; }
interface Pose { L: Arm; R: Arm; }
const arm = (sx: number, sz: number, ex = 0, ez = 0): Arm => ({ sx, sz, ex, ez });
const mixArm = (a: Arm, b: Arm, k: number): Arm => ({ sx: lerp(a.sx, b.sx, k), sz: lerp(a.sz, b.sz, k), ex: lerp(a.ex, b.ex, k), ez: lerp(a.ez, b.ez, k) });
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({ L: mixArm(a.L, b.L, k), R: mixArm(a.R, b.R, k) });
/** Rechte Seite gespiegelt angeben: z-Werte drehen das Vorzeichen. */
const mirror = (a: Arm): Arm => ({ sx: a.sx, sz: -a.sz, ex: a.ex, ez: -a.ez });

interface Kid {
  root: THREE.Group; spinner: THREE.Group; body: THREE.Group;
  shL: THREE.Group; elL: THREE.Group; shR: THREE.Group; elR: THREE.Group;
  eyes: THREE.Mesh[]; pupils: THREE.Mesh[]; lanternGroup: THREE.Group; tip: THREE.Group; hang: THREE.Group; lanternMat: THREE.MeshBasicMaterial;
  lanternBase: THREE.Color; phase: number; idx: number; mouth: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh;
  baseX: number; baseZ: number; baseRotY: number; shades: THREE.Group; bodyMat: THREE.MeshToonMaterial; rapMouth: THREE.Group;
}

const heartShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.05, -0.28, -0.5, 0.0, -0.5, 0.22);
  s.bezierCurveTo(-0.5, 0.45, -0.18, 0.5, 0, 0.3);
  s.bezierCurveTo(0.18, 0.5, 0.5, 0.45, 0.5, 0.22);
  s.bezierCurveTo(0.5, 0.0, 0.05, -0.28, 0, -0.35);
  return s;
})();

export class Kids {
  group = new THREE.Group();
  kids: Kid[] = [];
  hearts: THREE.Mesh[] = [];
  light: THREE.PointLight;
  herzTimes: number[] = [];
  martinTimes: number[] = [];
  mantel = new THREE.Group(); halves: THREE.Group[] = []; slash!: THREE.Mesh;

  private buildMantel() {
    const red = toon(0xc81e2a), lining = toon(0xffd166);
    const gold = new THREE.LineBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3).multiplyScalar(1.6) });
    for (const side of [-1, 1]) {
      const pts: [number, number][] = [[0, 1.0], [0.42, 1.0], [0.55, 0.75], [1.25, -1.05]];
      for (let i = 1; i <= 6; i++) { const x = 1.25 - (1.25 * i) / 6; pts.push([x, -1.1 - 0.1 * Math.sin(i * 1.7)]); }
      const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * side, y)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false });
      const half = new THREE.Group();
      half.add(new THREE.Mesh(geo, [red, lining] as any));
      const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map(([x, y]) => new THREE.Vector3(x * side, y, 0.06))), gold);
      half.add(outline);
      const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3).multiplyScalar(1.8) }));
      clasp.position.set(0.32 * side, 0.85, 0.08); half.add(clasp);
      this.halves.push(half); this.mantel.add(half);
    }
    this.slash = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 3.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.7).multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.slash.position.z = 0.15; this.mantel.add(this.slash);
    this.mantel.visible = false;
    this.group.add(this.mantel);
  }

  private updateMantel(t: number) {
    let a = 99;
    for (const mt of this.martinTimes) if (t >= mt && t - mt < 10) a = t - mt;
    this.mantel.visible = a < 10;
    if (!this.mantel.visible) return;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const cl = (x: number) => Math.min(1, Math.max(0, x));
    const appear = ease(cl(a / 0.8));
    // 1) Mantel erscheint wehend über den Kindern
    this.mantel.position.set(0, 4.4 + (1 - appear) * 2, 6.2);
    this.mantel.scale.setScalar(0.3 + 0.9 * appear);
    this.mantel.rotation.set(0, (1 - appear) * Math.PI * 2, Math.sin(a * 2.5) * 0.05 * appear);
    // 2) Lichtschnitt von oben nach unten
    const sl = cl((a - 0.9) / 0.35);
    this.slash.visible = a > 0.9 && a < 1.6;
    this.slash.scale.y = Math.max(0.01, sl);
    this.slash.position.y = 1.5 - 1.5 * sl;
    (this.slash.material as THREE.MeshBasicMaterial).opacity = a < 1.25 ? 1 : cl((1.6 - a) / 0.35);
    // 3) Hälften gehen auseinander, 4) fliegen zu zwei Kindern
    const split = ease(cl((a - 1.25) / 0.9));
    const fly = ease(cl((a - 3.0) / 1.4));
    const fade = cl((10 - a) / 1.2);
    this.halves.forEach((h, i) => {
      const side = i ? 1 : -1;
      const kid = this.kids[i ? 5 : 3];
      const sx = side * 0.9 * split, sy = Math.sin(a * 3 + i) * 0.08 * split;
      const local = new THREE.Vector3(sx, sy, 0);
      const target = new THREE.Vector3(kid.root.position.x - this.mantel.position.x - side * 0.05, kid.root.position.y + 1.05 - this.mantel.position.y, kid.root.position.z - 0.3 - this.mantel.position.z).divideScalar(this.mantel.scale.x);
      h.position.copy(local.lerp(target, fly));
      h.rotation.set(0, 0, side * 0.12 * split * (1 - fly) + Math.sin(a * 2 + i) * 0.04);
      h.scale.setScalar((1 - 0.3 * fly) * (a > 8.8 ? fade : 1));
    });
  }

  constructor() {
    const n = BODY.length;
    for (let i = 0; i < n; i++) {
      const x = -7.6 + (15.2 * i) / (n - 1);
      this.kids.push(this.makeKid(i, x, 7.2 - 0.04 * x * x));
    }
    this.light = new THREE.PointLight(0xffc27a, 2.2, 14, 0);
    this.light.position.set(0, 2.6, 9.5);
    this.group.add(this.light);
    this.buildMantel();
    const hg = new THREE.ExtrudeGeometry(heartShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    hg.center();
    for (let i = 0; i < 27; i++) {
      const m = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.2, 0.45).multiplyScalar(1.1), transparent: true, depthWrite: false }));
      m.visible = false; this.hearts.push(m); this.group.add(m);
    }
  }

  private makeKid(i: number, x: number, z: number): Kid {
    const root = new THREE.Group(); root.position.set(x, 0, z); root.scale.setScalar(0.88);
    const baseRotY = -x * 0.025; root.rotation.y = baseRotY;
    // spinner dreht um die Körpermitte (für Breakdance), body hängt darunter
    const spinner = new THREE.Group(); spinner.position.y = 0.95; root.add(spinner);
    const body = new THREE.Group(); body.position.y = -0.95; spinner.add(body);
    const bodyMat = toon(BODY[i]);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.62, 8, 24), bodyMat);
    torso.position.y = 0.95; body.add(torso);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), toon(new THREE.Color(BODY[i]).lerp(new THREE.Color(0xffffff), 0.45).getHex()));
    belly.scale.set(1, 1.05, 0.45); belly.position.set(0, 0.72, 0.28); body.add(belly);

    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const black = new THREE.MeshBasicMaterial({ color: 0x111122 });
    const eyes: THREE.Mesh[] = [], pupils: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), white);
      e.scale.set(1, 1.2, 0.55); e.position.set(s * 0.15, 1.3, 0.37); body.add(e); eyes.push(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 10), black);
      p.position.set(0, 0, 0.09); e.add(p); pupils.push(p);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), white);
      hl.position.set(0.025, 0.03, 0.05); p.add(hl);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.85 }));
      cheek.scale.set(1.3, 0.8, 0.4); cheek.position.set(s * 0.26, 1.15, 0.36); body.add(cheek);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 16, Math.PI), black);
    mouth.rotation.z = Math.PI; mouth.position.set(0, 1.155, 0.452); body.add(mouth);
    // offener Mund zum Rappen
    const rapMouth = new THREE.Group(); rapMouth.position.set(0, 1.12, 0.446); rapMouth.visible = false; body.add(rapMouth);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshBasicMaterial({ color: 0x3a0a14 }));
    hole.scale.set(1, 0.7, 1); rapMouth.add(hole);
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), new THREE.MeshBasicMaterial({ color: 0xff6f8f }));
    tongue.position.set(0, -0.025, 0.002); tongue.scale.set(1.2, 0.6, 1); rapMouth.add(tongue);

    const hatMat = toon(HAT[i]);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    hat.scale.set(1, 1.15, 1); hat.position.y = 1.45; body.add(hat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), hatMat);
    tip.position.set(0.12, 2.0, -0.02); tip.rotation.z = -0.5; body.add(tip);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.085, 10, 28), toon(0xffffff));
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.47; body.add(rim);
    const bommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), toon(0xffffff));
    bommel.position.set(0.28, 2.16, -0.02); body.add(bommel);

    const scarfMat = toon(SCARF[i]);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 10, 28), scarfMat);
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.9; scarf.scale.set(1.04, 1.04, 1); body.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.06), scarfMat);
    tail.position.set(-0.2, 0.68, 0.42); tail.rotation.z = 0.15; body.add(tail);

    // Arme mit Ober- und Unterarm
    const upperGeo = new THREE.CapsuleGeometry(0.085, 0.17, 6, 12), foreGeo = new THREE.CapsuleGeometry(0.078, 0.15, 6, 12);
    const armOf = (s: number) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.42, 1.04, 0.02);
      const up = new THREE.Mesh(upperGeo, bodyMat); up.position.y = -0.13; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.083, 10, 8), bodyMat); el.add(joint);
      const fo = new THREE.Mesh(foreGeo, bodyMat); fo.position.y = -0.12; el.add(fo);
      const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), scarfMat); mitten.position.y = -0.27; el.add(mitten);
      body.add(sh); return { sh, el };
    };
    const { sh: shL, el: elL } = armOf(-1), { sh: shR, el: elR } = armOf(1);

    const legMat = toon(new THREE.Color(BODY[i]).multiplyScalar(0.7).getHex());
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.12, 6, 12), legMat);
    legL.position.set(-0.18, 0.2, 0); body.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; body.add(legR);

    // Laterne an Stab in der rechten Hand
    // Stab zeigt schräg nach vorn-oben, die Laterne hängt an einer Schnur und baumelt
    const lanternGroup = new THREE.Group(); lanternGroup.position.y = -0.27; elR.add(lanternGroup);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.72, 6), toon(0x6b4423));
    stick.rotation.x = 2.356; stick.position.set(0, -0.255, 0.255); lanternGroup.add(stick);
    const stickTip = new THREE.Group(); stickTip.position.set(0, -0.51, 0.51); lanternGroup.add(stickTip);
    const hang = new THREE.Group(); stickTip.add(hang);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 4), new THREE.MeshBasicMaterial({ color: 0x222233 }));
    string.position.y = -0.12; hang.add(string);
    const lanternBase = new THREE.Color(LANTERN[i]);
    const lanternMat = new THREE.MeshBasicMaterial({ color: lanternBase.clone().multiplyScalar(2.2) });
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), lanternMat);
    lantern.scale.set(1, 1.15, 1); lantern.position.y = -0.43; hang.add(lantern);
    for (const yy of [0.19, -0.19]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), toon(0x333344));
      cap.position.y = yy; lantern.add(cap);
    }

    // Große, kantige schwarze Sonnenbrille mit dickem Rahmen
    const shades = new THREE.Group();
    const frameMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    const lensMat = new THREE.MeshBasicMaterial({ color: 0x14141c });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0x9aa4c8, transparent: true, opacity: 0.55 });
    const lensShape = (w: number, h: number) => {
      const p = new THREE.Shape();
      p.moveTo(-w / 2, h / 2); p.lineTo(w / 2, h / 2); p.lineTo(w / 2 - 0.035, -h / 2); p.lineTo(-w / 2 + 0.05, -h / 2); p.closePath();
      return p;
    };
    for (const sx of [-1, 1]) {
      const side = new THREE.Group(); side.position.set(sx * 0.165, 0, 0); side.rotation.y = sx * 0.22; side.scale.x = sx; shades.add(side);
      const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(lensShape(0.3, 0.19), { depth: 0.03, bevelEnabled: false }), frameMat);
      frame.position.z = -0.015; side.add(frame);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lensShape(0.25, 0.14)), lensMat);
      lens.position.set(0.005, -0.005, 0.017); side.add(lens);
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.014), glintMat);
      glint.position.set(0.02, 0.045, 0.019); glint.rotation.z = -0.12; side.add(glint);
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), frameMat);
      temple.position.set(-0.155, 0.07, -0.17); side.add(temple);
    }
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.045, 0.04), frameMat); brow.position.set(0, 0.085, 0.0); shades.add(brow);
    shades.position.set(0, 1.3, 0.43); shades.visible = false; body.add(shades);

    this.group.add(root);
    return { root, spinner, body, shL, elL, shR, elR, eyes, pupils, lanternGroup, tip: stickTip, hang, lanternMat, lanternBase, phase: (i * 0.37) % 1, idx: i,
      mouth, legL, legR, baseX: x, baseZ: z, baseRotY, shades, bodyMat, rapMouth };
  }

  /** Hip-Hop-Choreografie: alle 2 Takte ein neuer Move, weich überblendet. */
  private rapPose(beat: number, idx: number): Pose {
    const bump = 0.5 + 0.5 * Math.cos(2 * Math.PI * beat);            // 1 genau auf dem Schlag, weich
    const moves: ((b: number) => Pose)[] = [
      // 0: Zeigen & Pumpen – rechte Hand zeigt nach vorn und wippt, linke Hand in der Hüfte
      () => ({ L: arm(0.1, -0.55, 0, 1.9), R: mirror(arm(-1.35, 0.15, -0.35 - 0.55 * bump, 0)) }),
      // 1: Raise the Roof – beide Hände drücken im Takt nach oben
      () => ({ L: arm(0, -1.25 - 0.3 * bump, 0, -1.45), R: mirror(arm(0, -1.25 - 0.3 * bump, 0, -1.45)) }),
      // 2: Arme verschränkt, cool zur Seite lehnen
      () => ({ L: arm(-0.75, 0.42, -1.55, 0.35), R: mirror(arm(-0.75, 0.42, -1.45, 0.35)) }),
      // 3: Armwelle von links nach rechts
      (b) => {
        const w = (o: number) => Math.sin(Math.PI * b - o);
        return { L: arm(0, -1.45 + 0.25 * w(0), 0, 0.9 * w(0.6)), R: mirror(arm(0, -1.45 - 0.25 * w(1.6), 0, -0.9 * w(2.2))) };
      },
    ];
    const seg = beat / 8, k = Math.floor(seg), f = seg - k;
    const cur = moves[((k % 4) + 4) % 4](beat), prev = moves[(((k - 1) % 4) + 4) % 4](beat);
    void idx;
    return f < 0.06 ? mixPose(prev, cur, ss(f / 0.06)) : cur;
  }

  update(m: Mood) {
    const { t, beat, energy } = m;
    const herz = m.since.herz ?? 99, licht = m.since.lichter ?? 99, lk = m.since.lichterkinder ?? 99, stern = m.since.stern ?? 99;
    const fr = m.since.frieren ?? 99;
    const n = this.kids.length;
    for (const k of this.kids) {
      const ph = k.phase;
      // ---------- Grundbewegung ----------
      const b = Math.abs(Math.sin(Math.PI * (beat + ph * 0.25)));
      let y = (0.03 + 0.06 * energy) * b + (energy > 0.8 ? 0.18 * Math.pow(b, 3) : 0);
      let x = k.baseX, zPos = k.baseZ, rotY = k.baseRotY, spin = 0;
      let bodyRz = Math.sin(Math.PI * 0.5 * (beat + ph)) * (0.05 + 0.08 * energy), bodyRx = 0;
      let squash = 1 + 0.07 * (b - 0.5) * (0.5 + energy);

      // Arme normal: links locker/winkend, rechts Laterne vor sich
      let pose: Pose = {
        L: arm(0, -0.2 - 0.3 * energy * (0.5 + 0.5 * Math.sin(t * 6 + ph * 6)), -0.25, 0),
        R: mirror(arm(-1.0 - 0.25 * Math.sin(Math.PI * 0.5 * (beat + ph)), -0.15, -0.3, 0)),
      };
      if (energy > 0.8 && m.rap <= 0) pose.L = arm(0, -2.4 - 0.35 * Math.sin(t * 8 + ph * 5), 0, -0.4 * Math.sin(t * 8 + ph * 5));

      // ---------- Effekte ----------
      let armsUp = 0;
      if (lk < 7) {
        const w = Math.max(0, Math.sin(Math.PI * cl((lk - (k.idx / n) * 0.9) / 0.9)));
        y += 0.7 * w; armsUp = Math.min(1, lk / 0.4) * (lk < 6 ? 1 : 6.6 - lk);
        spin = ss((lk - 1.2 - k.idx * 0.08) / 0.8) * Math.PI * 2;
      }
      if (licht < 4) { const f = Math.min(1, licht / 0.3) * Math.min(1, (4 - licht) / 0.5); pose.R = mixArm(pose.R, mirror(arm(-2.9, 0, 0, 0)), f); }
      if (herz < 3.6) {
        const f = Math.min(1, herz / 0.35) * Math.min(1, (3.6 - herz) / 0.4);
        pose = mixPose(pose, { L: arm(0.25, -2.75, 0, -0.95), R: mirror(arm(0.25, -2.75, 0, -0.95)) }, f);
      }
      if (armsUp > 0) pose = mixPose(pose, { L: arm(0, -2.8, 0, 0.2), R: mirror(arm(0, -2.6, 0, 0.2)) }, cl(armsUp));
      const frz = fr < 4.5 ? Math.min(1, fr / 0.3) * Math.min(1, (4.5 - fr) / 0.6) : 0;
      if (frz > 0) {
        pose = mixPose(pose, { L: arm(-0.7, 0.45, -1.1, 0.9), R: mirror(arm(-0.7, 0.45, -1.1, 0.9)) }, frz);
        bodyRz += Math.sin(t * 70 + ph * 10) * 0.045 * frz;
        x += Math.sin(t * 55 + ph * 7) * 0.025 * frz;
      }
      k.bodyMat.emissive.setRGB(0.05, 0.25, 0.55).multiplyScalar(frz * 0.8);

      // ---------- Rap: alle exakt gleichzeitig, weicher Groove ----------
      const rp = m.rap;
      let spinnerRx = 0, spinnerRz = 0, extraSpin = 0;
      if (rp > 0) {
        const bump = 0.5 + 0.5 * Math.cos(2 * Math.PI * beat);
        const sway = Math.sin(Math.PI * beat / 2);
        y = lerp(y, 0.03 * (1 - bump), rp);
        squash = lerp(squash, 1 - 0.05 * bump, rp);
        bodyRx = lerp(bodyRx, 0.13 * bump, rp);                              // Kopfnicken auf jeden Schlag
        bodyRz = lerp(bodyRz, 0.09 * sway, rp);
        rotY = lerp(rotY, 0.22 * sway, rp);                                  // lässig mitdrehen
        x += 0.2 * sway * rp;                                                // Seitschritt im Takt
        pose = mixPose(pose, this.rapPose(beat, k.idx), rp);

        // Breakdance in der Mitte
        if (k.idx === BREAKER && m.rapT >= 0 && m.rapLen > 16) {
          const r = this.breakdance(m.rapT, m.rapLen);
          zPos += r.forward; y = lerp(y, r.y, r.on); spinnerRx = r.rx; spinnerRz = r.rz; extraSpin = r.spin;
          if (r.on > 0) pose = mixPose(pose, r.pose, r.on);
          bodyRx *= 1 - r.on; bodyRz *= 1 - r.on; x = lerp(x, k.baseX, r.on);
        }
      }

      // ---------- anwenden ----------
      k.root.position.set(x, y, zPos);
      k.root.rotation.y = rotY + extraSpin;
      k.spinner.rotation.set(spinnerRx, 0, spinnerRz);
      k.body.rotation.set(bodyRx, spin, bodyRz);
      k.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      k.legL.position.y = 0.2 + 0.05 * Math.max(0, Math.sin(Math.PI * beat)) * (1 - rp);
      k.legR.position.y = 0.2 + 0.05 * Math.max(0, -Math.sin(Math.PI * beat)) * (1 - rp);
      k.shL.rotation.set(pose.L.sx, 0, pose.L.sz); k.elL.rotation.set(pose.L.ex, 0, pose.L.ez);
      k.shR.rotation.set(pose.R.sx, 0, pose.R.sz); k.elR.rotation.set(pose.R.ex, 0, pose.R.ez);

      const blink = ((t + ph * 7.3) % 4.1) < 0.12 ? 0.12 : 1;
      const surprise = Math.exp(-(stern < 99 ? stern : 99) * 1.2) * 0.25;
      for (const e of k.eyes) e.scale.set(1 + surprise, 1.2 * blink * (1 + surprise), 0.55);
      const dx = THREE.MathUtils.clamp((m.look.x - k.root.position.x) / 60, -1, 1);
      for (const p of k.pupils) p.position.set(dx * 0.035, 0.035, 0.09);
      k.mouth.scale.setScalar(1 + 0.5 * energy * b);
      k.mouth.visible = rp < 0.3;
      k.rapMouth.visible = rp >= 0.3;
      if (rp >= 0.3) { const open = 0.5 + 0.5 * Math.abs(Math.sin(Math.PI * beat * 2 + ph)); k.rapMouth.scale.set(1, 0.45 + 0.75 * open, 1); }
      k.shades.visible = rp > 0.3;
      for (const e of k.eyes) e.visible = rp <= 0.3; // Augen-Glanzpunkte nicht durch die Brille
      k.shades.scale.setScalar(Math.min(1, rp * 1.6));

      // Laterne: beim Rap weggesteckt
      const lsc = 1 - ss(rp * 1.5);
      k.lanternGroup.visible = lsc > 0.02; k.lanternGroup.scale.setScalar(Math.max(0.001, lsc));
      const glow = 1.0 + 0.1 * Math.sin(t * 5 + ph * 9) + (licht < 4 ? 1.3 * Math.exp(-licht * 0.8) : 0) + energy * 0.2;
      k.lanternMat.color.copy(k.lanternBase).multiplyScalar(glow);
      // Pendel: Laterne hängt immer nach unten und schwingt – stärker, wenn getanzt wird
      if (k.lanternGroup.visible) {
        const amp = 0.18 + 0.25 * energy;
        const w = 2 * Math.PI * 0.85;
        _swing.set(amp * 0.6 * Math.sin(w * t + ph * 5 + 1), 0, amp * Math.sin(w * t + ph * 5));
        k.root.updateMatrixWorld(true);
        k.tip.getWorldQuaternion(_q);
        k.hang.quaternion.copy(_q.invert()).multiply(_q2.setFromEuler(_swing));
      }
    }
    this.updateMantel(t);
    this.light.intensity = 1.2 + 0.08 * Math.sin(t * 7) + (licht < 4 ? 1.8 * Math.exp(-licht) : 0);

    let hi = 0;
    for (const ht of this.herzTimes) {
      const a = t - ht;
      if (a < 0 || a > 4.5) continue;
      for (let j = 0; j < 9 && hi < this.hearts.length; j++) {
        const kid = this.kids[j];
        const aa = a - j * 0.12;
        const h = this.hearts[hi++];
        if (aa < 0) { h.visible = false; continue; }
        h.visible = true;
        h.position.set(kid.root.position.x + Math.sin(aa * 2.2 + j) * 0.4, 2.4 + aa * 1.6, kid.root.position.z);
        const s = Math.min(1, aa / 0.3) * 0.75;
        h.scale.setScalar(s); h.rotation.y = Math.sin(aa * 3 + j) * 0.6;
        (h.material as THREE.MeshBasicMaterial).opacity = Math.min(1, (4.5 - aa) / 1.2);
      }
    }
    for (; hi < this.hearts.length; hi++) this.hearts[hi].visible = false;
  }

  /** Ablauf für den Breakdancer: vortreten, Backspin, Headspin, Freeze, zurück. */
  private breakdance(rt: number, len: number) {
    const T = { step: 2.2, down: 3.4, back: 3.9, head: 9.6, headIn: 10.0, freeze: 13.0, up: 15.2, ret: 16.4 };
    const scale = Math.min(1, (len - 2) / 17);
    const u = rt / scale;               // bei kürzeren Rap-Teilen etwas gestrafft
    const on = ss((u - T.step) / 0.8) * (1 - ss((u - T.up) / 1.0));
    const forward = 0.9 * ss((u - T.step) / 1.0) * (1 - ss((u - T.up) / 1.2));
    const lying = ss((u - T.down) / 0.5) * (1 - ss((u - T.head) / 0.4));
    const upside = ss((u - T.head) / 0.4) * (1 - ss((u - T.freeze) / 0.5));
    const frz = ss((u - T.freeze) / 0.5) * (1 - ss((u - T.up) / 0.6));
    // Drehung: Backspin 1,5 Umdrehungen/s, Headspin 2/s – endet genau nach vorn
    const back = cl(u - T.back, 0, T.head - T.back), head = cl(u - T.headIn, 0, T.freeze - T.headIn);
    const spin = 2 * Math.PI * (1.5 * back + 2 * head);
    const rx = -1.35 * lying;
    const rz = Math.PI * upside + 1.9 * frz;
    const y = lying * -0.48 + upside * 0.22 + frz * -0.12;
    const pose: Pose = lying > 0.5
      ? { L: arm(0, -1.5, 0, 0), R: mirror(arm(0, -1.5, 0, 0)) }                       // Arme ausgestreckt beim Backspin
      : upside > 0.5
        ? { L: arm(0, -2.2, 0, 0.4), R: mirror(arm(0, -2.2, 0, 0.4)) }                  // Arme abstützen beim Headspin
        : frz > 0.5
          ? { L: arm(0, -2.9, 0, 0), R: mirror(arm(-0.5, -1.2, -1.4, 0)) }              // Freeze: ein Arm am Boden
          : { L: arm(-0.6, -0.4, -1.2, 0), R: mirror(arm(-0.6, -0.4, -1.2, 0)) };       // Anlauf
    return { on, forward, rx, rz, y, spin: spin * on, pose };
  }
}
