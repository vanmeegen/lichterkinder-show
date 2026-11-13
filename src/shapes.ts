// Formen für Feuerwerks-Bursts. Alle als Einheits-Vektoren (Radius ~1).
export type V3 = [number, number, number];
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sphere(n: number, rng: Rng): V3[] {
  const out: V3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), th = ga * i;
    const s = 0.88 + 0.12 * rng();
    out.push([Math.cos(th) * r * s, y * s, Math.sin(th) * r * s]);
  }
  return out;
}

export function ring(n: number, rng: Rng): V3[] {
  const tiltX = (rng() - 0.5) * 1.6, tiltZ = (rng() - 0.5) * 0.8;
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let x = Math.cos(a), y = Math.sin(a), z = 0;
    // kippen
    const y2 = y * Math.cos(tiltX) - z * Math.sin(tiltX), z2 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
    const x3 = x * Math.cos(tiltZ) - y2 * Math.sin(tiltZ), y3 = x * Math.sin(tiltZ) + y2 * Math.cos(tiltZ);
    out.push([x3, y3, z2]);
  }
  return out;
}

function outline(verts: [number, number][], per: number, closed = true): V3[] {
  const out: V3[] = [];
  const m = verts.length;
  for (let i = 0; i < (closed ? m : m - 1); i++) {
    const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % m];
    for (let k = 0; k < per; k++) { const t = k / per; out.push([ax + (bx - ax) * t, ay + (by - ay) * t, 0]); }
  }
  return out;
}

export function star(): V3[] {
  const v: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.42, a = Math.PI / 2 + (i * Math.PI) / 5;
    v.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return [...outline(v, 16), ...outline(v.map(([x, y]) => [x * 0.45, y * 0.45] as [number, number]), 6)];
}

export function heart(n = 170): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push([x / 17, y / 17 + 0.15, 0]);
  }
  for (let i = 0; i < 40; i++) { const t = (i / 40) * Math.PI * 2; const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); out.push([x / 17 * 0.5, y / 17 * 0.5 + 0.08, 0]); }
  return out;
}

export function tree(): V3[] {
  const tiers: V3[] = [];
  const lv = [[-1, 0.15, 0.5], [-0.25, 0.75, 0.38], [0.45, 1.25, 0.26]];
  for (const [y0, , w] of lv) {
    const top = y0 + 0.75;
    tiers.push(...outline([[0, top], [w * 2.1, y0], [-w * 2.1, y0]], 22));
  }
  tiers.push(...outline([[-0.12, -1], [-0.12, -1.3], [0.12, -1.3], [0.12, -1]], 5, false));
  return tiers.map(([x, y, z]) => [x, y * 0.85 + 0.15, z]);
}

export function flake(): V3[] {
  const out: V3[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    for (let r = 0; r <= 1; r += 1 / 18) out.push([dx * r, dy * r, 0]);
    for (const r0 of [0.45, 0.72]) for (const s of [-1, 1]) for (let r = 0.04; r <= 0.3; r += 0.05)
      out.push([dx * r0 + (dx * 0.55 + s * nx * 0.8) * r, dy * r0 + (dy * 0.55 + s * ny * 0.8) * r, 0]);
  }
  return out;
}

export function bell(): V3[] {
  const v: [number, number][] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; const y = 0.9 - t * 1.7; const w = 0.28 + 0.55 * t ** 2.2; v.push([w, y]); }
  const left = v.map(([x, y]) => [-x, y] as [number, number]).reverse();
  const pts = outline([...v, ...left], 5);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push([Math.cos(a) * 0.13, -1.0 + Math.sin(a) * 0.13, 0]); }
  return pts;
}

/** Text als Punktwolke (Breite ~2, zentriert). */
export function textPoints(text: string, step = 4): V3[] {
  const c = document.createElement('canvas');
  c.width = 1400; c.height = 260;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.font = '900 190px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 190;
  while (g.measureText(text).width > c.width - 40 && size > 40) { size -= 8; g.font = `900 ${size}px "Arial Black", Arial, sans-serif`; }
  g.fillText(text, c.width / 2, c.height / 2);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const out: V3[] = [];
  const w = g.measureText(text).width;
  for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
    if (d[(y * c.width + x) * 4 + 3] > 128) out.push([((x - c.width / 2) / w) * 2, (-(y - c.height / 2) / w) * 2, 0]);
  }
  return out;
}
