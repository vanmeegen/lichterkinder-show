// Die Lichterkinder: eigene, knuffige Bohnen-Figuren mit Mütze, Schal und Laterne.
import * as THREE from 'three';

export interface Mood {
  t: number;            // Liedzeit (s)
  beat: number;         // Schläge seit Start
  energy: number;       // 0 ruhig … 1 Refrain
  rap: number;          // 0 … 1 Rap-Teil (alle synchron)
  since: Record<string, number>; // Sekunden seit letztem Effekt je Typ
  look: THREE.Vector3;  // wohin geschaut wird (letzter Knall)
}

const BODY = [0xff5a5a, 0x3fb6ff, 0xffc93a, 0x6be07a, 0xff7ad9, 0x9b7bff, 0xff9a3c, 0x38d9c9, 0xf25c8a];
const HAT = [0x2a9d4b, 0xd62828, 0x2563eb, 0xd62828, 0x10b981, 0xf59e0b, 0x7c3aed, 0xe11d48, 0x1d4ed8];
const SCARF = [0xffd166, 0xffffff, 0xff6b6b, 0x4cc9f0, 0xffd166, 0xff6b6b, 0x4cc9f0, 0xffffff, 0x80ed99];
const LANTERN = [0xffb347, 0xff6b6b, 0xffe066, 0x7cf0ff, 0xff8fd8, 0xffb347, 0xb4ff7c, 0xffe066, 0xff9a5a];

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

interface Kid {
  root: THREE.Group; body: THREE.Group; armL: THREE.Group; armR: THREE.Group;
  eyes: THREE.Mesh[]; pupils: THREE.Mesh[]; lantern: THREE.Mesh; lanternMat: THREE.MeshBasicMaterial;
  lanternBase: THREE.Color; phase: number; idx: number; mouth: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh;
  baseX: number; shades: THREE.Group; bodyMat: THREE.MeshToonMaterial;
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
    root.rotation.y = -x * 0.025;
    const body = new THREE.Group(); root.add(body);
    const bodyMat = toon(BODY[i]);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.62, 8, 24), bodyMat);
    torso.position.y = 0.95; body.add(torso);
    // Bauch etwas heller
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), toon(new THREE.Color(BODY[i]).lerp(new THREE.Color(0xffffff), 0.45).getHex()));
    belly.scale.set(1, 1.05, 0.45); belly.position.set(0, 0.72, 0.28); body.add(belly);

    // Gesicht
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
    mouth.rotation.z = Math.PI; mouth.position.set(0, 1.14, 0.41); body.add(mouth);

    // Mütze mit Bommel
    const hatMat = toon(HAT[i]);
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    hat.scale.set(1, 1.15, 1); hat.position.y = 1.45; body.add(hat);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 16), hatMat);
    tip.position.set(0.12, 2.0, -0.02); tip.rotation.z = -0.5; body.add(tip);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.085, 10, 28), toon(0xffffff));
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.47; body.add(rim);
    const bommel = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 2), toon(0xffffff));
    bommel.position.set(0.28, 2.16, -0.02); body.add(bommel);

    // Schal
    const scarfMat = toon(SCARF[i]);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 10, 28), scarfMat);
    scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.0; body.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.06), scarfMat);
    tail.position.set(-0.2, 0.78, 0.4); tail.rotation.z = 0.15; body.add(tail);

    // Arme
    const armOf = (s: number) => {
      const g = new THREE.Group(); g.position.set(s * 0.42, 1.02, 0.02);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 6, 12), bodyMat);
      arm.position.y = -0.22; g.add(arm);
      const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), scarfMat);
      mitten.position.y = -0.46; g.add(mitten);
      body.add(g); return g;
    };
    const armL = armOf(-1), armR = armOf(1);

    // Beine
    const legMat = toon(new THREE.Color(BODY[i]).multiplyScalar(0.7).getHex());
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.12, 6, 12), legMat);
    legL.position.set(-0.18, 0.2, 0); root.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; root.add(legR);

    // Laterne an Stab in der rechten Hand
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), toon(0x6b4423));
    stick.position.set(0, -0.62, 0.25); stick.rotation.x = 1.0; armR.add(stick);
    const lanternBase = new THREE.Color(LANTERN[i]);
    const lanternMat = new THREE.MeshBasicMaterial({ color: lanternBase.clone().multiplyScalar(2.2) });
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), lanternMat);
    lantern.scale.set(1, 1.15, 1); lantern.position.set(0, -0.62, 0.58); armR.add(lantern);
    for (const yy of [0.19, -0.19]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), toon(0x333344));
      cap.position.y = yy; lantern.add(cap);
    }

    // Sonnenbrille für den Rap-Teil
    const shades = new THREE.Group();
    const glassMat = new THREE.MeshBasicMaterial({ color: 0x0b0b14 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.15, 0.05), glassMat);
      g.position.set(sx * 0.15, 0, 0); shades.add(g);
      const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(sx * 0.15 - 0.06, 0.035, 0.03); shine.rotation.z = 0.5; shades.add(shine);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.04), glassMat); shades.add(bridge);
    shades.position.set(0, 1.31, 0.45); shades.visible = false; body.add(shades);

    this.group.add(root);
    return { root, body, armL, armR, eyes, pupils, lantern, lanternMat, lanternBase, phase: (i * 0.37) % 1, idx: i, mouth, legL, legR, baseX: x, shades, bodyMat };
  }

  update(m: Mood) {
    const { t, beat, energy } = m;
    const herz = m.since.herz ?? 99, licht = m.since.lichter ?? 99, lk = m.since.lichterkinder ?? 99, stern = m.since.stern ?? 99;
    const n = this.kids.length;
    for (const k of this.kids) {
      const ph = k.phase;
      // Wippen / Springen im Takt
      const b = Math.abs(Math.sin(Math.PI * (beat + ph * 0.25)));
      let jump = (0.03 + 0.06 * energy) * b + (energy > 0.8 ? 0.18 * Math.pow(b, 3) : 0);
      // La-Ola + Drehung beim Lichterkinder-Höhepunkt
      let spin = 0, armsUp = 0;
      if (lk < 7) {
        const w = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (lk - k.idx / n * 0.9) / 0.9))));
        jump += 0.7 * w; armsUp = Math.max(armsUp, Math.min(1, lk / 0.4) * (lk < 6 ? 1 : 6.6 - lk));
        const sp = Math.min(1, Math.max(0, (lk - 1.2 - k.idx * 0.08) / 0.8));
        spin = sp * Math.PI * 2;
      }
      k.root.position.y = jump;
      k.body.rotation.y = spin;
      const squash = 1 + 0.07 * (b - 0.5) * (0.5 + energy);
      k.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      k.body.rotation.z = Math.sin(Math.PI * 0.5 * (beat + ph)) * (0.05 + 0.08 * energy);
      k.legL.position.y = 0.2 + 0.05 * Math.max(0, Math.sin(Math.PI * beat));
      k.legR.position.y = 0.2 + 0.05 * Math.max(0, -Math.sin(Math.PI * beat));

      // Arme
      let lz = -0.25 - 0.3 * energy * (0.5 + 0.5 * Math.sin(t * 6 + ph * 6)); // links winken
      let lx = 0;
      let rx = -1.0 - 0.25 * Math.sin(Math.PI * 0.5 * (beat + ph)), rz = 0.15;      // rechts Laterne vor sich
      if (energy > 0.8) { lz = -2.4 - 0.35 * Math.sin(t * 8 + ph * 5); }
      if (licht < 4) { const f = Math.min(1, licht / 0.3) * Math.min(1, (4 - licht) / 0.5); rx = rx * (1 - f) - 2.9 * f; }
      if (herz < 3.6) {
        const f = Math.min(1, herz / 0.35) * Math.min(1, (3.6 - herz) / 0.4);
        lz = lz * (1 - f) - 2.75 * f; lx = 0.35 * f; rz = rz * (1 - f) + 2.75 * f; rx = rx * (1 - f) + 0.35 * f;
      }
      if (armsUp > 0) { lz = lz * (1 - armsUp) - 2.8 * armsUp; rz = rz * (1 - armsUp) + 2.5 * armsUp; rx = rx * (1 - armsUp); }
      // Frieren: Arme um den Körper, zittern
      const fr = m.since.frieren ?? 99;
      const frz = fr < 4.5 ? Math.min(1, fr / 0.3) * Math.min(1, (4.5 - fr) / 0.6) : 0;
      if (frz > 0) {
        lz = lz * (1 - frz) + 0.95 * frz; lx = lx * (1 - frz) - 0.7 * frz; rz = rz * (1 - frz) - 0.95 * frz; rx = rx * (1 - frz) - 0.7 * frz;
        k.body.rotation.z += Math.sin(t * 70 + ph * 10) * 0.045 * frz;
        k.root.position.x = k.baseX + Math.sin(t * 55 + ph * 7) * 0.025 * frz;
      } else k.root.position.x = k.baseX;
      k.bodyMat.emissive.setRGB(0.05, 0.25, 0.55).multiplyScalar(frz * 0.8);

      // Rap: alle exakt gleichzeitig – Kopfnicken, Seitschritt, Hand nach vorn im Takt
      const rp = m.rap;
      if (rp > 0) {
        const fb = beat - Math.floor(beat);
        const hit = Math.exp(-fb * 7);
        const half = Math.sin(Math.PI * beat / 2);
        k.root.position.y = k.root.position.y * (1 - rp) + 0.05 * hit * rp;
        k.root.position.x += 0.22 * half * rp;
        k.body.rotation.x = 0.2 * hit * rp;
        k.body.rotation.z = k.body.rotation.z * (1 - rp) + 0.1 * half * rp;
        k.body.rotation.y = k.body.rotation.y * (1 - rp) + (0.18 * half - k.root.rotation.y) * rp;
        const rlx = -1.55 + 0.5 * hit, rlz = 0.3;      // Hand nach vorn, wippt auf jedem Schlag
        const rrx = -0.5, rrz = 0.75;                    // Laterne lässig zur Seite
        lx = lx * (1 - rp) + rlx * rp; lz = lz * (1 - rp) + rlz * rp;
        rx = rx * (1 - rp) + rrx * rp; rz = rz * (1 - rp) + rrz * rp;
        k.mouth.scale.setScalar(1 + 0.8 * hit * rp);
      } else k.body.rotation.x = 0;
      k.shades.visible = rp > 0.35;
      k.shades.scale.setScalar(Math.min(1, rp * 1.6));
      k.armL.rotation.set(lx, 0, lz); k.armR.rotation.set(rx, 0, rz);

      // Augen: blinzeln und dem Feuerwerk nachschauen
      const blink = ((t + ph * 7.3) % 4.1) < 0.12 ? 0.12 : 1;
      const surprise = Math.exp(-(stern < 99 ? stern : 99) * 1.2) * 0.25;
      for (const e of k.eyes) e.scale.set(1 + surprise, 1.2 * blink * (1 + surprise), 0.55);
      const dx = THREE.MathUtils.clamp((m.look.x - k.root.position.x) / 60, -1, 1);
      for (const p of k.pupils) p.position.set(dx * 0.035, 0.035, 0.09);
      if (m.rap <= 0) k.mouth.scale.setScalar(1 + 0.5 * energy * b);

      // Laterne
      const glow = 1.0 + 0.1 * Math.sin(t * 5 + ph * 9) + (licht < 4 ? 1.3 * Math.exp(-licht * 0.8) : 0) + energy * 0.2;
      k.lanternMat.color.copy(k.lanternBase).multiplyScalar(glow);
      k.lantern.rotation.z = Math.sin(t * 3 + ph * 4) * 0.25;
    }
    this.updateMantel(t);
    this.light.intensity = 1.2 + 0.08 * Math.sin(t * 7) + (licht < 4 ? 1.8 * Math.exp(-licht) : 0);

    // Schwebende Herzen
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
}
