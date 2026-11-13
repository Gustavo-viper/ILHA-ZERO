// Construção da cena 3D e aplicação dos níveis gráficos.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { MAP_SIZE, HALF, WATER_LEVEL } from './shared/world.js';
import { TIERS } from './quality.js';

const SECTORS = 4;
const FOG_COLOR = new THREE.Color(0xb9cfe0);

// Material "duplo": Lambert (barato) para PCs fracos, Standard (PBR) para os demais.
const matPairs = [];
function M(color, o = {}) {
  const base = { color, vertexColors: !!o.vc, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, flatShading: !!o.flat };
  const lo = new THREE.MeshLambertMaterial({ ...base, emissive: o.emissive || 0x000000 });
  const hi = new THREE.MeshStandardMaterial({ ...base, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.emissive || 0x000000 });
  if (o.flat) { lo.flatShading = true; }
  const pair = { lo, hi };
  matPairs.push(pair);
  return pair;
}
function mesh(geo, pair) { const m = new THREE.Mesh(geo, pair.lo); m.userData.mp = pair; return m; }
function imesh(geo, pair, n) { const m = new THREE.InstancedMesh(geo, pair.lo, n); m.userData.mp = pair; return m; }

export class GameScene {
  constructor(canvas, world, hw, tierId) {
    this.world = world; this.hw = hw; this.canvas = canvas;
    const T = TIERS[tierId];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: T.aa, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(FOG_COLOR, 200, 900);
    this.scene.background = FOG_COLOR.clone();

    // luzes
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a5236, 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    this.sunDir = new THREE.Vector3(0.45, 0.75, 0.35).normalize();
    this.sun.shadow.camera.left = -90; this.sun.shadow.camera.right = 90; this.sun.shadow.camera.top = 90; this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 600; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    // céu (shader atmosférico)
    this.sky = new Sky(); this.sky.scale.setScalar(4500);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 2.2; u.rayleigh.value = 1.1; u.mieCoefficient.value = 0.003; u.mieDirectionalG.value = 0.85;
    u.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
    this.sky.material.fog = false;
    this.scene.add(this.sky);

    this.noiseTex = makeNoiseTexture();
    this.buildTerrain(T.terrainSeg);
    this.buildWater();
    this.buildBuildings();
    this.buildVegetation();
    this.buildZone();
    this.buildPlane();
    this.fx = new FX(this.scene);

    this.envMap = null;
    this.tierId = tierId;
    this.scale = 1;
    this.composer = null;
    addEventListener('resize', () => this.resize());
  }

  // ---------------- terreno ----------------
  buildTerrain(seg) {
    const W = this.world;
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    const c = new THREE.Color(), sand = new THREE.Color(0xd8c590), grass = new THREE.Color(0x5f8f3a), grass2 = new THREE.Color(0x7aa547), dirt = new THREE.Color(0x7b6a4a), rock = new THREE.Color(0x7d7d78), snow = new THREE.Color(0xf2f4f6), sea = new THREE.Color(0xa99566);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = W.heightAt(x, z);
      pos.setY(i, y);
      const slope = Math.abs(W.heightAt(x + 3, z) - W.heightAt(x - 3, z)) / 6 + Math.abs(W.heightAt(x, z + 3) - W.heightAt(x, z - 3)) / 6;
      const n = W.fbm2(x / 60, z / 60, 2) * 0.5 + 0.5;
      if (y < -0.5) c.copy(sea); else if (y < 2.2) c.copy(sand);
      else { c.copy(grass).lerp(grass2, n); if (n > 0.72) c.lerp(dirt, (n - 0.72) * 2.2); }
      if (slope > 0.45) c.lerp(rock, Math.min(1, (slope - 0.45) * 2.5));
      if (y > 62) c.lerp(snow, Math.min(1, (y - 62) / 8));
      for (const t of W.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r) c.lerp(dirt, 0.35 * (1 - d / t.r)); }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const tex = this.noiseTex.clone(); tex.needsUpdate = true; tex.repeat.set(MAP_SIZE / 6, MAP_SIZE / 6);
    this.terrain = mesh(g, M(0xffffff, { vc: true, map: tex, rough: 0.95 }));
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.terrainSeg = seg;
  }

  buildWater() {
    const g = new THREE.PlaneGeometry(MAP_SIZE * 4, MAP_SIZE * 4, 1, 1); g.rotateX(-Math.PI / 2);
    this.water = mesh(g, M(0x1f6f8f, { transparent: true, opacity: 0.86, rough: 0.06, metal: 0.2 }));
    this.water.position.y = WATER_LEVEL; this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  // Caixas do mundo fundidas em poucas malhas (poucas draw calls = bom pra PC fraco)
  buildBuildings() {
    const W = this.world;
    const wallColors = [0xd9cbb0, 0xb9c6cf, 0xcf9f7f, 0xe6e0d0, 0x9fb59a].map((h) => new THREE.Color(h));
    const groups = { wall: [], roof: [], cont: [] };
    const contColors = [0xb3452f, 0x2f6fb3, 0x3c8a4a, 0xc79a2c].map((h) => new THREE.Color(h));
    for (const b of W.boxes) {
      const g = new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
      g.translate((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      let color, grp;
      if (b.kind === 'roof') { color = new THREE.Color(0x7a3b2e); grp = 'roof'; }
      else if (b.kind === 'container') { color = contColors[b.color]; grp = 'cont'; }
      else if (b.kind === 'crate') { color = new THREE.Color(0x8a6a3f); grp = 'cont'; }
      else if (b.kind === 'floor' || b.kind === 'floor2' || b.kind === 'stair') { color = new THREE.Color(0x8b7355); grp = 'wall'; }
      else { color = wallColors[W.houses[b.house].color]; grp = 'wall'; }
      const n = g.attributes.position.count, cc = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { cc[i * 3] = color.r; cc[i * 3 + 1] = color.g; cc[i * 3 + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      g.deleteAttribute('uv');
      groups[grp].push(g);
    }
    this.buildings = [];
    const mats = { wall: M(0xffffff, { vc: true, rough: 0.9 }), roof: M(0xffffff, { vc: true, rough: 0.7 }), cont: M(0xffffff, { vc: true, rough: 0.55, metal: 0.35 }) };
    for (const k of Object.keys(groups)) {
      if (!groups[k].length) continue;
      const m = mesh(mergeGeometries(groups[k]), mats[k]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m); this.buildings.push(m);
      groups[k].forEach((g) => g.dispose());
    }
  }

  // Árvores/rochas/arbustos instanciados por setores (permite culling + controle de densidade)
  buildVegetation() {
    const W = this.world;
    const trunkG = new THREE.CylinderGeometry(0.17, 0.3, 3, 6); trunkG.translate(0, 1.5, 0);
    const pineG = mergeGeometries([new THREE.ConeGeometry(2.0, 4.2, 7).translate(0, 4.2, 0), new THREE.ConeGeometry(1.5, 3.4, 7).translate(0, 6.2, 0)]);
    const leafG = new THREE.IcosahedronGeometry(2.4, 0); leafG.scale(1, 0.85, 1); leafG.translate(0, 4.6, 0);
    const rockG = new THREE.DodecahedronGeometry(1, 0); rockG.scale(1, 0.7, 1);
    const bushG = new THREE.IcosahedronGeometry(0.8, 0); bushG.translate(0, 0.45, 0);
    const mTrunk = M(0x5b4128, { rough: 1 }), mPine = M(0x2f5e2c, { rough: 0.9, flat: true }), mLeaf = M(0x4f8a35, { rough: 0.9, flat: true }), mRock = M(0x8a8a84, { rough: 0.95, flat: true }), mBush = M(0x3f7a2c, { rough: 0.95, flat: true });
    this.veg = []; // {mesh, full}
    this.bushMeshes = [];
    const sec = (x, z) => { const s = MAP_SIZE / SECTORS; return Math.min(SECTORS - 1, Math.floor((x + HALF) / s)) + Math.min(SECTORS - 1, Math.floor((z + HALF) / s)) * SECTORS; };
    const bucket = (arr) => { const b = Array.from({ length: SECTORS * SECTORS }, () => []); for (const it of arr) b[sec(it.x, it.z)].push(it); return b; };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();
    const fill = (geo, pair, items, setter, list, shadow) => {
      if (!items.length) return;
      const im = imesh(geo, pair, items.length);
      items.forEach((it, i) => { setter(it); m4.compose(p3, q, s3); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = shadow; im.receiveShadow = true;
      im.frustumCulled = true;
      this.scene.add(im); list.push({ mesh: im, full: items.length });
      return im;
    };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const trees = bucket(W.trees), rocks = bucket(W.rocks), bushes = bucket(W.bushes);
    for (let s = 0; s < SECTORS * SECTORS; s++) {
      const tr = shuffle(trees[s]);
      const tset = (t) => { p3.set(t.x, t.y - 0.2, t.z); q.setFromAxisAngle(up, t.rot); s3.set(t.s, t.s, t.s); };
      const pines = tr.filter((t) => t.type === 0), leafs = tr.filter((t) => t.type === 1);
      fill(trunkG, mTrunk, pines, tset, this.veg, true);
      fill(trunkG, mTrunk, leafs, tset, this.veg, true);
      fill(pineG, mPine, pines, tset, this.veg, true);
      const lm = fill(leafG, mLeaf, leafs, tset, this.veg, true);
      if (lm) leafs.forEach((t, i) => lm.setColorAt(i, color.setHSL(0.24 + Math.random() * 0.08, 0.45, 0.32 + Math.random() * 0.1)));
      fill(rockG, mRock, shuffle(rocks[s]), (r) => { p3.set(r.x, r.y - r.s * 0.2, r.z); q.setFromAxisAngle(up, r.rot); s3.set(r.s, r.s, r.s * 0.9); }, this.veg, true);
      fill(bushG, mBush, shuffle(bushes[s]), (b) => { p3.set(b.x, b.y, b.z); q.identity(); s3.set(b.s, b.s, b.s); }, this.bushMeshes, false);
    }
    // a árvore e o tronco precisam ter a MESMA contagem; guardo pares por setor ao aplicar a densidade
  }

  buildZone() {
    const g = new THREE.CylinderGeometry(1, 1, 600, 96, 1, true);
    const m = new THREE.MeshBasicMaterial({ color: 0x3b7bff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.zoneMesh = new THREE.Mesh(g, m); this.zoneMesh.position.y = 200; this.zoneMesh.renderOrder = 2;
    this.scene.add(this.zoneMesh);
  }

  buildPlane() {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(2.2, 1.6, 26, 10).rotateX(Math.PI / 2), M(0xc9ced4, { rough: 0.4, metal: 0.6 }));
    const wing = mesh(new THREE.BoxGeometry(34, 0.5, 5), M(0xaab1b8, { rough: 0.4, metal: 0.6 }));
    const tail = mesh(new THREE.BoxGeometry(0.5, 6, 4), M(0xb3452f, {}));
    tail.position.set(0, 3, 11); wing.position.set(0, -0.5, -1);
    const tw = mesh(new THREE.BoxGeometry(12, 0.4, 3), M(0xaab1b8, {})); tw.position.set(0, 0.5, 11);
    g.add(body, wing, tail, tw);
    for (const x of [-9, 9]) { const e = mesh(new THREE.CylinderGeometry(1, 1, 4, 8).rotateX(Math.PI / 2), M(0x333a40, {})); e.position.set(x, -1, -3); g.add(e); }
    g.visible = false;
    this.plane = g; this.scene.add(g);
  }

  // ---------------- qualidade ----------------
  applyTier(tierId, scale) {
    const T = TIERS[tierId], r = this.renderer, prev = this.tierId;
    this.tierId = tierId;
    // materiais
    for (const o of this.scene.children.concat(this.extraMeshes || [])) o.traverse?.((m) => { if (m.userData.mp) m.material = T.pbr ? m.userData.mp.hi : m.userData.mp.lo; });
    // sombras
    r.shadowMap.enabled = T.shadows > 0;
    this.sun.castShadow = T.shadows > 0;
    if (T.shadows > 0 && this.sun.shadow.mapSize.x !== T.shadows) {
      this.sun.shadow.mapSize.set(T.shadows, T.shadows);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      const ext = T.shadows >= 4096 ? 110 : T.shadows >= 2048 ? 85 : 60;
      Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); this.sun.shadow.camera.updateProjectionMatrix();
    }
    for (const p of matPairs) { p.lo.needsUpdate = true; p.hi.needsUpdate = true; }
    // distância de visão + neblina
    this.camera.far = T.view + 200; this.camera.updateProjectionMatrix();
    this.scene.fog.near = T.view * (0.25 + (1 - T.fogDensity) * 0.3); this.scene.fog.far = T.view;
    // céu
    this.sky.visible = T.sky;
    this.scene.background = T.sky ? null : FOG_COLOR.clone();
    // reflexos/iluminação do ambiente (PBR)
    if (T.pbr && tierId >= 3) {
      if (!this.envMap) {
        const pm = new THREE.PMREMGenerator(r); const sc = new THREE.Scene(); const sk = new Sky(); sk.scale.setScalar(1000);
        Object.assign(sk.material.uniforms, {}); sk.material.uniforms.sunPosition.value.copy(this.sunDir).multiplyScalar(1000);
        for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sk.material.uniforms[k].value = this.sky.material.uniforms[k].value;
        sc.add(sk); this.envMap = pm.fromScene(sc, 0, 0.1, 2000).texture; pm.dispose();
      }
      this.scene.environment = this.envMap; this.scene.environmentIntensity = 0.22;
      this.hemi.intensity = 0.8; this.renderer.toneMappingExposure = 0.9;
    } else { this.scene.environment = null; this.hemi.intensity = T.pbr ? 1.25 : 1.45; this.renderer.toneMappingExposure = 1.0; }
    this.sun.intensity = T.pbr ? 2.6 : 1.9;
    // vegetação: densidade (tronco e copa usam a mesma ordem embaralhada → mesma contagem)
    for (const v of this.veg) v.mesh.count = Math.max(0, Math.floor(v.full * T.veg));
    for (const v of this.bushMeshes) { v.mesh.count = Math.floor(v.full * T.bushes); v.mesh.visible = T.bushes > 0; }
    // terreno mais detalhado se o nível pedir e for maior que o atual
    if (T.terrainSeg > this.terrainSeg) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); this.buildTerrain(T.terrainSeg); this.terrain.material = T.pbr ? this.terrain.userData.mp.hi : this.terrain.userData.mp.lo; }
    this._alt = null;
    this.setScale(scale);
    this.buildComposer(T);
    return prev;
  }

  // aplica o material do nível atual em objetos criados depois (jogadores, loot)
  fixMaterials(obj) {
    const pbr = TIERS[Math.max(0, this.tierId)].pbr;
    obj.traverse((m) => { if (m.userData.mp) m.material = pbr ? m.userData.mp.hi : m.userData.mp.lo; if (m.isMesh && !this.sun.castShadow) m.castShadow = m.castShadow; });
  }

  maxScale() {
    // limite físico: tamanho máximo do framebuffer da GPU; e no Extremo, mira 8K (7680x4320)
    const T = TIERS[this.tierId];
    const lim = Math.min(this.hw.maxViewport || 8192, this.hw.maxRB || 8192) / Math.max(innerWidth, innerHeight * 16 / 9);
    const dpr = devicePixelRatio || 1;
    if (T.supersample8k) return Math.max(T.scaleMin, Math.min(4, 7680 / innerWidth, lim));
    if (this.tierId >= 3) return Math.min(2.5, T.scaleMax * Math.max(1, dpr), lim);
    return Math.min(T.scaleMax, dpr, lim);
  }

  setScale(s) {
    this.scale = s;
    const pr = Math.max(0.25, s);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight, false);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(innerWidth, innerHeight); }
  }

  buildComposer(T) {
    if (this.composer) { this.composer.passes.forEach((p) => p.dispose && p.dispose()); this.composer.dispose(); this.composer = null; }
    this.post = [];
    if (!(T.bloom || T.ao || T.ssr || T.smaa)) return;
    try {
      const r = this.renderer, w = innerWidth, h = innerHeight;
      const c = new EffectComposer(r);
      c.setPixelRatio(r.getPixelRatio()); c.setSize(w, h);
      if (T.ssr) {
        const ssr = new SSRPass({ renderer: r, scene: this.scene, camera: this.camera, width: w, height: h, selects: null, groundReflector: null });
        ssr.thickness = 0.02; ssr.infiniteThick = false; ssr.maxDistance = 60; ssr.opacity = 0.5; ssr.blur = true; ssr.distanceAttenuation = true; ssr.fresnel = true;
        c.addPass(ssr); this.post.push('Reflexos SSR (ray-march)');
      } else c.addPass(new RenderPass(this.scene, this.camera));
      if (T.ao) { const ao = new GTAOPass(this.scene, this.camera, w, h); ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1, thickness: 1, scale: 1 }); ao.blendIntensity = 0.85; c.addPass(ao); this.post.push('GTAO'); }
      if (T.bloom) { c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.4, 0.9)); this.post.push('Bloom'); }
      c.addPass(new OutputPass());
      if (T.smaa) { c.addPass(new SMAAPass(w * r.getPixelRatio(), h * r.getPixelRatio())); this.post.push('SMAA'); }
      this.composer = c;
    } catch (e) { console.warn('Pós-processamento indisponível:', e); this.composer = null; this.post = ['(desativado: erro)']; }
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.setScale(Math.min(this.scale, this.maxScale()));
  }

  // no avião/queda livre a visão precisa alcançar o chão mesmo nos níveis baixos
  setAltitudeView(high) {
    if (this._alt === high) return; this._alt = high;
    const T = TIERS[this.tierId], v = high ? Math.max(T.view, 750) : T.view;
    this.camera.far = v + 200; this.camera.updateProjectionMatrix();
    this.scene.fog.near = v * (0.25 + (1 - T.fogDensity) * 0.3); this.scene.fog.far = v;
  }

  render(focus) {
    // sombra acompanha o jogador
    if (this.sun.castShadow) {
      const s = 4; const fx = Math.round(focus.x / s) * s, fz = Math.round(focus.z / s) * s;
      this.sun.target.position.set(fx, focus.y, fz);
      this.sun.position.set(fx + this.sunDir.x * 300, focus.y + this.sunDir.y * 300, fz + this.sunDir.z * 300);
    }
    this.water.position.x = Math.round(this.camera.position.x / 50) * 50; this.water.position.z = Math.round(this.camera.position.z / 50) * 50;
    this.sky.position.copy(this.camera.position);
    this.renderer.info.reset();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  drawingSize() { const v = new THREE.Vector2(); this.renderer.getDrawingBufferSize(v); return v; }
}

function makeNoiseTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const v = 205 + Math.random() * 50; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------------- efeitos (traçantes, impactos, clarão) ----------------
class FX {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, fog: false });
    for (let i = 0; i < 40; i++) { const g = tg.clone(); const l = new THREE.Line(g, this.tracerMat.clone()); l.visible = false; l.frustumCulled = false; scene.add(l); this.tracers.push({ l, t: 0 }); }
    this.puffs = [];
    const pm = new THREE.SpriteMaterial({ color: 0xcfc6b0, transparent: true, opacity: 0.8, depthWrite: false });
    const bm = new THREE.SpriteMaterial({ color: 0xb01010, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(pm.clone()); s.visible = false; scene.add(s); this.puffs.push({ s, t: 0, base: pm, blood: bm }); }
    const fm = new THREE.SpriteMaterial({ map: flashTexture(), color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.flashes = [];
    for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(fm); s.visible = false; scene.add(s); this.flashes.push({ s, t: 0 }); }
    this.ti = 0; this.pi = 0; this.fi = 0;
  }
  tracer(a, b) {
    const T = this.tracers[this.ti++ % this.tracers.length];
    const p = T.l.geometry.attributes.position; p.setXYZ(0, a[0], a[1], a[2]); p.setXYZ(1, b[0], b[1], b[2]); p.needsUpdate = true;
    T.l.visible = true; T.t = 0.07; T.l.material.opacity = 0.9;
  }
  puff(p, blood) {
    const P = this.puffs[this.pi++ % this.puffs.length];
    P.s.material.color.set(blood ? 0xb01010 : 0xcfc6b0);
    P.s.position.set(p[0], p[1], p[2]); P.s.scale.setScalar(0.3); P.s.visible = true; P.t = 0.45; P.s.material.opacity = 0.85;
  }
  flash(p) {
    const F = this.flashes[this.fi++ % this.flashes.length];
    F.s.position.copy(p); F.s.scale.setScalar(0.9 + Math.random() * 0.5); F.s.visible = true; F.t = 0.05;
  }
  update(dt) {
    for (const T of this.tracers) if (T.l.visible) { T.t -= dt; T.l.material.opacity = Math.max(0, T.t / 0.07); if (T.t <= 0) T.l.visible = false; }
    for (const P of this.puffs) if (P.s.visible) { P.t -= dt; P.s.scale.addScalar(dt * 1.6); P.s.material.opacity = Math.max(0, P.t / 0.45) * 0.85; if (P.t <= 0) P.s.visible = false; }
    for (const F of this.flashes) if (F.s.visible) { F.t -= dt; if (F.t <= 0) F.s.visible = false; }
  }
}
function flashTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(255,200,90,.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
}

// ---------------- personagens ----------------
const charGeo = {
  torso: new THREE.BoxGeometry(0.56, 0.62, 0.3).translate(0, 0.31, 0),
  head: new THREE.SphereGeometry(0.17, 10, 8),
  limb: new THREE.BoxGeometry(0.17, 0.72, 0.18).translate(0, -0.36, 0),
  arm: new THREE.BoxGeometry(0.13, 0.6, 0.14).translate(0, -0.3, 0),
  pack: new THREE.BoxGeometry(0.4, 0.45, 0.2),
  gun: new THREE.BoxGeometry(0.07, 0.12, 0.75).translate(0, 0, -0.3),
  chute: new THREE.SphereGeometry(3.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6),
};
const skinMat = M(0xe0b48f, { rough: 0.8 });
const darkMat = M(0x2a2a2a, { rough: 0.5, metal: 0.4 });
const pantsMat = M(0x3b4552, { rough: 0.9 });
const packMat = M(0x4a5a2d, { rough: 0.9 });
const chuteMat = M(0xff7b2e, { side: THREE.DoubleSide, rough: 0.7 });
const shirtMats = new Map();
export function makeCharacter(color) {
  if (!shirtMats.has(color)) shirtMats.set(color, M(color, { rough: 0.85 }));
  const shirt = shirtMats.get(color);
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.9; root.add(hips);
  const torso = mesh(charGeo.torso, shirt); hips.add(torso);
  const head = mesh(charGeo.head, skinMat); head.position.y = 0.8; hips.add(head);
  const pack = mesh(charGeo.pack, packMat); pack.position.set(0, 0.35, 0.24); hips.add(pack);
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.14, 0, 0); legR.position.set(0.14, 0, 0);
  legL.add(mesh(charGeo.limb, pantsMat)); legR.add(mesh(charGeo.limb, pantsMat)); hips.add(legL, legR);
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-0.36, 0.58, 0); armR.position.set(0.36, 0.58, 0);
  armL.add(mesh(charGeo.arm, shirt)); armR.add(mesh(charGeo.arm, shirt)); hips.add(armL, armR);
  const gun = mesh(charGeo.gun, darkMat); gun.position.set(0.18, 0.38, -0.32); hips.add(gun);
  const chute = mesh(charGeo.chute, chuteMat); chute.position.y = 4.2; chute.visible = false; root.add(chute);
  root.userData = { hips, legL, legR, armL, armR, gun, chute, head, phase: 0 };
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return root;
}
export function poseCharacter(ch, st, dt) {
  const u = ch.userData;
  u.phase += dt * (st.speed > 0.3 ? 2 + st.speed * 1.4 : 0);
  const sw = st.speed > 0.3 ? Math.sin(u.phase) * Math.min(0.9, 0.25 + st.speed * 0.1) : 0;
  u.chute.visible = st.state === 'chute';
  const falling = st.state === 'air';
  if (st.dead) { u.hips.rotation.x = -Math.PI / 2 * 0.95; u.hips.position.y = 0.25; u.legL.rotation.x = u.legR.rotation.x = 0; return; }
  u.hips.rotation.x = falling ? -1.2 : 0;
  u.hips.position.y = st.crouch ? 0.55 : 0.9;
  u.legL.rotation.x = falling ? 0.3 : st.crouch ? -1.2 + sw * 0.3 : sw;
  u.legR.rotation.x = falling ? 0.1 : st.crouch ? -0.5 - sw * 0.3 : -sw;
  const hasGun = !!st.weapon;
  u.gun.visible = hasGun;
  if (falling) { u.armL.rotation.set(0, 0, -1.2); u.armR.rotation.set(0, 0, 1.2); }
  else if (st.state === 'chute') { u.armL.rotation.set(Math.PI, 0, 0.2); u.armR.rotation.set(Math.PI, 0, -0.2); u.gun.visible = false; }
  else if (hasGun) { const p = -Math.PI / 2 + (st.pitch || 0); u.armR.rotation.set(p, 0, 0); u.armL.rotation.set(p, 0, 0.55); u.gun.rotation.x = st.pitch || 0; }
  else { u.armL.rotation.set(-sw, 0, 0); u.armR.rotation.set(sw, 0, 0); }
  if (st.weapon === 'sniper' || st.weapon === 'ar') u.gun.scale.set(1, 1, 1.35); else if (st.weapon === 'pistol') u.gun.scale.set(1, 1, 0.45); else u.gun.scale.set(1, 1, 1);
}

// ---------------- loot ----------------
const lootGeo = { gun: new THREE.BoxGeometry(0.12, 0.16, 0.9), box: new THREE.BoxGeometry(0.35, 0.25, 0.25), vest: new THREE.BoxGeometry(0.5, 0.6, 0.2), helmet: new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), ring: new THREE.RingGeometry(0.45, 0.6, 20).rotateX(-Math.PI / 2) };
const lootMats = { gun: M(0x30343a, { rough: 0.4, metal: 0.6 }), ammo: M(0xd9a21b, { rough: 0.5, metal: 0.4 }), bandage: M(0xf2f2f2, {}), medkit: M(0xe23b3b, {}), armor: M(0x34508a, {}), helmet: M(0x4e6b3a, { rough: 0.5 }) };
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
export function makeLoot(type) {
  const g = new THREE.Group();
  let m;
  if (['pistol', 'smg', 'ar', 'shotgun', 'sniper'].includes(type)) { m = mesh(lootGeo.gun, lootMats.gun); if (type === 'pistol') m.scale.z = 0.4; if (type === 'sniper') m.scale.z = 1.4; }
  else if (type === 'ammo') m = mesh(lootGeo.box, lootMats.ammo);
  else if (type === 'bandage') m = mesh(lootGeo.box, lootMats.bandage);
  else if (type === 'medkit') { m = mesh(lootGeo.box, lootMats.medkit); m.scale.set(1.3, 1.3, 1.3); }
  else if (type.startsWith('armor')) m = mesh(lootGeo.vest, lootMats.armor);
  else m = mesh(lootGeo.helmet, lootMats.helmet);
  m.position.y = 0.3; g.add(m);
  const ring = new THREE.Mesh(lootGeo.ring, ringMat); ring.position.y = 0.03; g.add(ring);
  g.userData.spin = m;
  return g;
}
