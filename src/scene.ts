// Winterlandschaft, Licht, Nachbearbeitung (Bloom) und Kamera.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Fireworks } from './fireworks';
import { Kids, Mood } from './kids';
import { mulberry32 } from './shapes';

const rng = mulberry32(7);
const r = (a: number, b: number) => a + (b - a) * rng();

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`;
const skyFrag = `
uniform float uTime; uniform vec3 uFlash; varying vec3 vDir;
void main(){
  float h = clamp(vDir.y, -0.2, 1.);
  vec3 top = vec3(0.008, 0.012, 0.05), mid = vec3(0.03, 0.04, 0.13), low = vec3(0.16, 0.09, 0.24);
  vec3 c = mix(low, mid, smoothstep(-0.02, 0.18, h));
  c = mix(c, top, smoothstep(0.18, 0.75, h));
  // Polarlicht
  float az = atan(vDir.x, -vDir.z);
  float band = sin(az * 3.0 + uTime * 0.07 + sin(az * 7.0 - uTime * 0.11) * 0.8);
  float ah = smoothstep(0.12, 0.3, h) * smoothstep(0.62, 0.32, h + band * 0.06);
  float curtain = pow(0.5 + 0.5 * sin(az * 28. + band * 4. + uTime * 0.3), 3.);
  c += mix(vec3(0.05, 0.5, 0.35), vec3(0.35, 0.15, 0.6), smoothstep(0.25, 0.55, h)) * ah * (0.08 + 0.1 * curtain) * (0.6 + 0.4 * band);
  c += uFlash * (0.25 + 0.75 * (1. - smoothstep(0., 0.6, h))) * 0.22;
  gl_FragColor = vec4(c, 1.);
}`;

const starVert = `
uniform float uTime; attribute float aPh; attribute float aSize; varying float vA;
void main(){ vA = 0.45 + 0.55 * sin(uTime * (1.2 + aPh) + aPh * 30.); vec4 mv = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize; }`;
const starFrag = `varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; gl_FragColor = vec4(vec3(1., .97, .9) * vA * pow(1. - d, 2.) * 1.4, 1.); }`;

const snowVert = `
uniform float uTime; uniform float uScale; attribute vec4 aS; varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y - uTime * aS.x, 34.) - 1.;
  p.x += sin(uTime * 0.6 + aS.y) * 0.9;
  p.z += cos(uTime * 0.45 + aS.y) * 0.5;
  vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
  gl_PointSize = aS.z * uScale / -mv.z; vA = aS.w;
}`;
const snowFrag = `uniform float uAmount; varying float vA; void main(){ float d = length(gl_PointCoord - .5) * 2.; if (d > 1.) discard; gl_FragColor = vec4(vec3(.92,.96,1.) * pow(1.-d, 1.5) * vA * uAmount, 1.); }`;

function hillHeight(x: number, z: number) {
  if (z > -12) return 0;
  const f = Math.min(1, (-12 - z) / 25);
  return f * (3 + 3.5 * Math.sin(x * 0.045 + 1.3) + 2 * Math.sin(x * 0.11 + z * 0.05) + 1.2 * Math.sin(x * 0.27)) + Math.max(0, (-60 - z) * 0.12);
}

function pineGeometry(snow: boolean) {
  const parts: THREE.BufferGeometry[] = [];
  const tiers = [[0, 1.6, 1.0], [0.9, 1.3, 1.0], [1.7, 1.0, 0.9], [2.4, 0.7, 0.8]];
  for (const [y, rad, h] of tiers) {
    const g = new THREE.ConeGeometry(rad, h * 1.4, 9); g.translate(0, y + h * 0.7 + 0.4, 0);
    parts.push(g);
    if (snow) { const s = new THREE.ConeGeometry(rad * 0.55, h * 0.55, 9); s.translate(0, y + h * 1.2 + 0.45, 0); parts.push(s); }
  }
  const trunk = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 6); trunk.translate(0, 0.3, 0); parts.push(trunk);
  return mergeGeometries(parts.map(p => p.toNonIndexed()));
}

export class Stage {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1200);
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  fireworks = new Fireworks();
  kids = new Kids();
  sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  stars: THREE.Points;
  snow: THREE.Points;
  flashLight = new THREE.PointLight(0xffffff, 0, 0, 0);
  hemi = new THREE.HemisphereLight(0x5566aa, 0x1a1a33, 0.9);
  bulbs: THREE.InstancedMesh; bulbBase: THREE.Color[] = []; bulbPh: number[] = [];
  garland: THREE.InstancedMesh; garlandBase: THREE.Color[] = [];
  windowsMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.3).multiplyScalar(1.6) });
  treeStars: THREE.Mesh[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const s = this.scene;
    s.fog = new THREE.FogExp2(0x0a0c22, 0.006);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: new THREE.Color() } }, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    s.add(this.sky);

    // Sterne
    const N = 2600, sp: number[] = [], ph: number[] = [], sz: number[] = [];
    for (let i = 0; i < N; i++) {
      const az = r(0, Math.PI * 2), el = Math.asin(r(0.04, 1));
      sp.push(Math.cos(el) * Math.sin(az) * 500, Math.sin(el) * 500, -Math.cos(el) * Math.cos(az) * 500);
      ph.push(r(0, 1)); sz.push(rng() < 0.05 ? r(3, 4.5) : r(1.2, 2.5));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sg.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
    sg.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: starVert, fragmentShader: starFrag, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    this.stars.frustumCulled = false; s.add(this.stars);

    // Mond
    const moon = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.82).multiplyScalar(1.4), fog: false }));
    moon.position.set(300, 215, -470); moon.lookAt(0, 0, 0); s.add(moon);

    // Boden mit Hügeln
    const ground = new THREE.PlaneGeometry(500, 260, 160, 90);
    ground.rotateX(-Math.PI / 2); ground.translate(0, 0, -100);
    const pos = ground.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, hillHeight(pos.getX(i), pos.getZ(i)) + Math.sin(pos.getX(i) * 0.8) * Math.cos(pos.getZ(i) * 0.7) * 0.05);
    ground.computeVertexNormals();
    s.add(new THREE.Mesh(ground, new THREE.MeshLambertMaterial({ color: 0xc8d4f0 })));

    // Wald im Hintergrund (instanziert)
    const forest = new THREE.InstancedMesh(pineGeometry(true), new THREE.MeshLambertMaterial({ color: 0x0f3324, vertexColors: false }), 160);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < 160; i++) {
      let x = r(-130, 130), z = r(-120, -22);
      if (Math.abs(x) < 25 && z > -45) x += Math.sign(x || 1) * 25;
      const k = r(1.2, 2.6);
      m4.compose(new THREE.Vector3(x, hillHeight(x, z) - 0.2, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r(0, 6)), sc.set(k, k * r(0.9, 1.3), k));
      forest.setMatrixAt(i, m4);
    }
    s.add(forest);

    // Dorf mit erleuchteten Fenstern
    for (let i = 0; i < 7; i++) {
      const x = -60 + i * 20 + r(-4, 4), z = r(-48, -40), y = hillHeight(x, z);
      const house = new THREE.Group();
      const w = r(3, 4.5), h = r(2.2, 3);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), new THREE.MeshLambertMaterial({ color: 0x5b3a2e }));
      body.position.y = h / 2; house.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 1.8, 4), new THREE.MeshLambertMaterial({ color: 0xeef3ff }));
      roof.position.y = h + 0.9; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75; house.add(roof);
      for (const wx of [-w / 4, w / 4]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), this.windowsMat);
        win.position.set(wx, h * 0.55, 1.51); house.add(win);
      }
      house.position.set(x, y - 0.1, z); house.rotation.y = r(-0.2, 0.2); s.add(house);
    }

    // Geschmückte Tannen vorn
    const bulbPos: THREE.Vector3[] = [];
    const palette = [0xff3b3b, 0xffc93a, 0x3bff7a, 0x5ac8ff, 0xff6bd5, 0xffffff];
    const bigTrees = [[-13.5, 1.5, 2.3], [13.5, 1.5, 2.3], [-20, -5, 1.8], [20, -5, 1.8], [-27, -10, 1.6], [27, -10, 1.6]];
    const decoGeo = pineGeometry(true);
    for (const [x, z, k] of bigTrees) {
      const t = new THREE.Mesh(decoGeo, new THREE.MeshLambertMaterial({ color: 0x145c34 }));
      t.position.set(x, 0, z); t.scale.set(k, k, k); s.add(t);
      for (let i = 0; i < 70; i++) {
        const u = rng();
        const yy = 0.6 + u * 3.0;
        const rad = (1.55 - u * 1.1) * 0.95;
        const a = r(-Math.PI * 0.9, Math.PI * 0.9) + Math.PI / 2 + Math.atan2(17 - z, -x);
        bulbPos.push(new THREE.Vector3(x + Math.cos(a) * rad * k, yy * k, z + Math.sin(a) * rad * k));
      }
      const star = new THREE.Mesh(this.starGeo(), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.3).multiplyScalar(1.3) }));
      star.position.set(x, 4.25 * k, z); star.scale.setScalar(0.35 * k); s.add(star); this.treeStars.push(star);
    }
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial(), bulbPos.length);
    bulbPos.forEach((p, i) => {
      this.bulbs.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z));
      const c = new THREE.Color(palette[i % palette.length]); this.bulbBase.push(c); this.bulbPh.push(rng() * 6.28);
      this.bulbs.setColorAt(i, c);
    });
    s.add(this.bulbs);

    // Lichterkette oben im Bild
    const gp: THREE.Vector3[] = [];
    for (let seg = 0; seg < 3; seg++) {
      const x0 = -9 + seg * 6, x1 = x0 + 6;
      for (let i = 0; i < 12; i++) { const u = i / 12; const x = x0 + (x1 - x0) * u; gp.push(new THREE.Vector3(x * 1.1, 5.5 - Math.sin(u * Math.PI) * 0.5, 11.5)); }
    }
    this.garland = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial(), gp.length);
    gp.forEach((p, i) => { this.garland.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)); const c = new THREE.Color(palette[i % 5]); this.garlandBase.push(c); this.garland.setColorAt(i, c); });
    s.add(this.garland);
    const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(gp), new THREE.LineBasicMaterial({ color: 0x0a1a10 }));
    s.add(wire);

    // Schnee
    const SN = 5000, snp: number[] = [], sa: number[] = [];
    for (let i = 0; i < SN; i++) { snp.push(r(-45, 45), r(0, 34), r(-40, 16)); sa.push(r(0.6, 1.8), r(0, 6.28), r(0.06, 0.16), r(0.35, 0.9)); }
    const sng = new THREE.BufferGeometry();
    sng.setAttribute('position', new THREE.Float32BufferAttribute(snp, 3));
    sng.setAttribute('aS', new THREE.Float32BufferAttribute(sa, 4));
    this.snow = new THREE.Points(sng, new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uAmount: { value: 1 } }, vertexShader: snowVert, fragmentShader: snowFrag, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    this.snow.frustumCulled = false; s.add(this.snow);

    // Licht
    s.add(this.hemi);
    const moonLight = new THREE.DirectionalLight(0xaabbff, 0.8); moonLight.position.set(150, 175, -100); s.add(moonLight);
    const front = new THREE.DirectionalLight(0xffe2c0, 0.35); front.position.set(-5, 8, 30); s.add(front);
    s.add(this.flashLight);

    s.add(this.fireworks.points);
    s.add(this.kids.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(s, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), 0.7, 0.5, 0.78);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  starGeo() {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? 0.42 : 1, a = Math.PI / 2 + i * Math.PI / 5; i ? sh.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : sh.moveTo(rr * Math.cos(a), rr * Math.sin(a)); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); g.center(); return g;
  }

  /** Sichtfeld so wählen, dass die Breite einer 16:9-Ansicht immer ganz zu sehen ist.
   *  Schmalere/quadratische Bildschirme zeigen dafür mehr Himmel und Boden statt seitlich abzuschneiden. */
  baseFov() {
    const aspect = this.camera.aspect, ref = 16 / 9, base = 50;
    if (aspect >= ref) return base;
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(base / 2)) * ref / aspect);
    return Math.min(100, THREE.MathUtils.radToDeg(half * 2));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(m: Mood, snowAmount: number) {
    const t = m.t;
    const f = this.fireworks.flash(t);
    const H = this.renderer.domElement.height;
    const scale = H / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    this.fireworks.setTime(t, scale);
    (this.snow.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    (this.snow.material as THREE.ShaderMaterial).uniforms.uScale.value = scale;
    (this.snow.material as THREE.ShaderMaterial).uniforms.uAmount.value = snowAmount;
    this.sky.material.uniforms.uTime.value = t;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    this.sky.material.uniforms.uFlash.value.copy(f.col).multiplyScalar(0.18 / Math.max(1, (f.col.r + f.col.g + f.col.b) / 3));

    this.flashLight.color.copy(f.col).multiplyScalar(1 / Math.max(0.001, Math.max(f.col.r, f.col.g, f.col.b)));
    this.flashLight.intensity = Math.min(2.2, (f.col.r + f.col.g + f.col.b) * 0.5);
    this.flashLight.position.copy(f.pos);
    this.hemi.intensity = 0.75 + Math.min(0.45, (f.col.r + f.col.g + f.col.b) * 0.07);

    // Lichter funkeln, schneller bei viel Energie und bei „Lichter“
    const licht = m.since.lichter ?? 99;
    const boost = 1 + (licht < 4 ? 2.2 * Math.exp(-licht * 0.7) : 0);
    const c = new THREE.Color();
    for (let i = 0; i < this.bulbBase.length; i++) {
      const on = 0.5 + 0.5 * Math.sin(t * (1.5 + 2.5 * m.energy) + this.bulbPh[i]);
      this.bulbs.setColorAt(i, c.copy(this.bulbBase[i]).multiplyScalar((0.5 + 1.1 * on) * boost));
    }
    this.bulbs.instanceColor!.needsUpdate = true;
    for (let i = 0; i < this.garlandBase.length; i++) {
      const chase = Math.sin(Math.PI * 2 * (t * (0.6 + m.energy) - i / 6)) > -0.1 ? 1 : 0.2;
      this.garland.setColorAt(i, c.copy(this.garlandBase[i]).multiplyScalar((0.45 + 1.2 * chase) * boost));
    }
    this.garland.instanceColor!.needsUpdate = true;
    this.treeStars.forEach((st, i) => { st.rotation.y = t * 0.8 + i; st.scale.setScalar((0.35 + 0.04 * Math.sin(t * 3 + i)) * (i < 2 ? 2.3 : i < 4 ? 1.8 : 1.6) * (1 + (boost - 1) * 0.15)); });
    this.windowsMat.color.setRGB(1, 0.7, 0.3).multiplyScalar(1.1 * Math.min(1.6, boost));

    this.kids.update(m);

    // Kamera
    const lk = m.since.lichterkinder ?? 99;
    const zoom = lk < 8 ? Math.sin(Math.min(1, lk / 1.2) * Math.PI / 2) * Math.min(1, (8 - lk) / 3) : 0;
    this.camera.fov = this.baseFov() * (1 - 0.1 * zoom);
    this.camera.updateProjectionMatrix();
    const sh = Math.min(1.5, f.shake);
    this.camera.position.set(Math.sin(t * 0.13) * 0.9 + (Math.random() - 0.5) * 0.12 * sh, 2.4 + Math.sin(t * 0.21) * 0.15 + (Math.random() - 0.5) * 0.1 * sh, 17);
    const tall = Math.max(0, (16 / 9) / this.camera.aspect - 1); // schmalere Bildschirme: Blick etwas höher, Kinder rücken nach unten
    this.camera.lookAt(Math.sin(t * 0.09) * 1.5, 6.0 + Math.min(2.5, 1.6 * tall) + 1.5 * zoom, -20);
    this.bloom.strength = 0.65 + 0.15 * m.energy + 0.15 * zoom;

    this.composer.render();
  }
}
