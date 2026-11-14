// Echte Bewegungsaufnahmen (Motion Capture) für die Rap-Soli.
// Quelle: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), frei nutzbar; BVH-Fassung von B. Hahne.
// Umgerechnet auf die Bohnen-Figuren: Hüftbahn, Oberkörper-Orientierung, Ober-/Unterarm- und Oberschenkel-Richtungen.
import * as THREE from 'three';

export interface MocapFrame {
  h: THREE.Vector3;          // Hüfte in Standhüfthöhen (Stand: y = 1), horizontal um den Bühnenpunkt zentriert
  q: THREE.Quaternion;       // Oberkörper-Orientierung (X = linke Körperseite, Y = hoch, Z = Blick)
  aL: THREE.Vector3; fL: THREE.Vector3; aR: THREE.Vector3; fR: THREE.Vector3; lL: THREE.Vector3; lR: THREE.Vector3;
}
interface Routine { name: string; n: number; d: Float32Array; standing: Uint8Array; }

const STRIDE = 25;
let routines: Routine[] = [];
let fps = 30;
let credit = '';

export async function loadMocap(url = './mocap.json') {
  try {
    const j = await (await fetch(url)).json();
    fps = j.fps; credit = j.credit;
    routines = j.routines.map((r: any) => {
      const bin = atob(r.data);
      const i16 = new Int16Array(new Uint8Array([...bin].map(c => c.charCodeAt(0))).buffer);
      const d = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) d[i] = i16[i] / 1000;
      // Frames, in denen die Figur ruhig aufrecht steht (gute Stellen zum Abbrechen)
      const standing = new Uint8Array(r.n);
      const q = new THREE.Quaternion(), up = new THREE.Vector3();
      for (let f = 0; f < r.n; f++) {
        const o = f * STRIDE;
        q.set(d[o + 3], d[o + 4], d[o + 5], d[o + 6]).normalize();
        up.set(0, 1, 0).applyQuaternion(q);
        standing[f] = up.y > 0.9 && Math.abs(d[o + 1] - 1) < 0.08 ? 1 : 0;
      }
      return { name: r.name, n: r.n, d, standing };
    });
  } catch (e) { console.warn('Mocap nicht geladen', e); routines = []; }
}

export const mocapReady = () => routines.length > 0;
export const mocapCount = () => routines.length;
export const mocapCredit = () => credit;
export const mocapName = (i: number) => routines[i % routines.length]?.name ?? '';
export const mocapDuration = (i: number) => (routines[i % routines.length]?.n ?? 0) / fps;

/** Letzter ruhiger Stand-Zeitpunkt ≤ maxSec – dort wird abgebrochen, falls die Zeit nicht reicht (nie mitten im Sprung). */
export function mocapCut(i: number, maxSec: number) {
  const r = routines[i % routines.length]; if (!r) return 0;
  const last = Math.min(r.n - 1, Math.floor(maxSec * fps));
  if (last >= r.n - 1) return (r.n - 1) / fps;
  for (let f = last; f > 0; f--) if (r.standing[f]) return f / fps;
  return last / fps;
}

const tmpQa = new THREE.Quaternion(), tmpQb = new THREE.Quaternion();
const v3 = (d: Float32Array, o: number, out: THREE.Vector3) => out.set(d[o], d[o + 1], d[o + 2]);

/** Frame zur Zeit t (s), linear/sphärisch interpoliert. */
export function mocapSample(i: number, t: number, out: MocapFrame): MocapFrame {
  const r = routines[i % routines.length];
  const x = Math.max(0, Math.min(r.n - 1.001, t * fps));
  const f0 = Math.floor(x), k = x - f0, a = f0 * STRIDE, b = (f0 + 1) * STRIDE;
  const d = r.d;
  out.h.set(d[a] + (d[b] - d[a]) * k, d[a + 1] + (d[b + 1] - d[a + 1]) * k, d[a + 2] + (d[b + 2] - d[a + 2]) * k);
  tmpQa.set(d[a + 3], d[a + 4], d[a + 5], d[a + 6]).normalize();
  tmpQb.set(d[b + 3], d[b + 4], d[b + 5], d[b + 6]).normalize();
  out.q.slerpQuaternions(tmpQa, tmpQb, k);
  const vecs: (keyof MocapFrame)[] = ['aL', 'fL', 'aR', 'fR', 'lL', 'lR'];
  vecs.forEach((key, j) => {
    const o = 7 + j * 3, v = out[key] as THREE.Vector3;
    v3(d, a + o, v).lerp(new THREE.Vector3(d[b + o], d[b + o + 1], d[b + o + 2]), k).normalize();
  });
  return out;
}

export const newFrame = (): MocapFrame => ({
  h: new THREE.Vector3(), q: new THREE.Quaternion(), aL: new THREE.Vector3(), fL: new THREE.Vector3(),
  aR: new THREE.Vector3(), fR: new THREE.Vector3(), lL: new THREE.Vector3(), lR: new THREE.Vector3(),
});
