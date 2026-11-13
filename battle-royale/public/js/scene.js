// Construção da cena 3D e aplicação dos níveis gráficos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js';
import { MAP_SIZE, HALF, WATER_LEVEL, GRID_N, GRID_RES } from './shared/world.js';
import { TIERS } from './quality.js';
import { makeTextures } from './textures.js';

const SECTORS = 4;
const FOG_COLOR = new THREE.Color(0xb4c9de);
let TEX = null; // texturas procedurais (criadas uma vez)

// Material "duplo": Lambert (barato) para PCs fracos, Standard (PBR) para os demais.
const matPairs = [];
function M(color, o = {}) {
  const base = { color, vertexColors: !!o.vc, map: o.map || null, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, flatShading: !!o.flat, alphaTest: o.alphaTest ?? 0 };
  const lo = new THREE.MeshLambertMaterial({ ...base, emissive: o.emissive || 0x000000 });
  const hi = new THREE.MeshStandardMaterial({ ...base, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.emissive || 0x000000 });
  const pair = { lo, hi };
  matPairs.push(pair);
  return pair;
}
function setMap(pair, map) { pair.lo.map = map; pair.hi.map = map; pair.lo.needsUpdate = pair.hi.needsUpdate = true; }
function mesh(geo, pair) { const m = new THREE.Mesh(geo, pair.lo); m.userData.mp = pair; return m; }
function imesh(geo, pair, n) { const m = new THREE.InstancedMesh(geo, pair.lo, n); m.userData.mp = pair; return m; }
function colorize(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function merge(list) { const out = mergeGeometries(list.map((g) => (g.index ? g : g))); list.forEach((g) => g.dispose()); return out; }

// Caixa com UV em coordenadas do mundo (textura não estica em paredes grandes)
function boxUV(x0, y0, z0, x1, y1, z1, color, ts = 2.5) {
  const pos = [], nor = [], uv = [], idx = [];
  const face = (p, n, u) => { const b = pos.length / 3; for (let k = 0; k < 4; k++) { pos.push(...p[k]); nor.push(...n); uv.push(...u[k]); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const U = (a, b) => [a / ts, b / ts];
  face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [U(-z1, y0), U(-z0, y0), U(-z0, y1), U(-z1, y1)]);
  face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)]);
  face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [U(x0, z1), U(x1, z1), U(x1, z0), U(x0, z0)]);
  face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)]);
  face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)]);
  face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [U(-x1, y0), U(-x0, y0), U(-x0, y1), U(-x1, y1)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return colorize(g, color);
}
// polígono plano (lista de pontos, normal calculada) com UV dado
// `out` = direção para onde a face deve apontar (garante normal/iluminação corretas)
function quadGeo(pts, uvs, color, out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2]);
  const n = b.clone().sub(a).cross(c.clone().sub(a));
  const flip = out && n.dot(out) < 0;
  g.setIndex(pts.length === 4 ? (flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) : (flip ? [0, 2, 1] : [0, 1, 2]));
  g.computeVertexNormals();
  return colorize(g, color);
}

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

    // texturas (menores nos níveis baixos para gerar rápido e gastar pouca memória)
    if (!TEX) TEX = makeTextures(tierId <= 1 ? 256 : 512);
    this.tex = TEX;
    initSharedMaterials(TEX);

    // luzes: sol de meio da tarde + céu azul / chão terroso
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5a3c, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
    this.sunDir = new THREE.Vector3(0.5, 0.7, 0.3).normalize();
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 600; this.sun.shadow.bias = -0.0003; this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);

    // céu: domo com degradê (azul profundo no alto, claro no horizonte) + brilho do sol + nuvens
    this.sky = makeSkyDome(this.sunDir);
    this.scene.add(this.sky);
    this.sky.material.uniforms.uClouds.value = TEX.clouds;

    this.buildTerrain(T.terrainSeg);
    this.buildWater();
    this.buildBuildings();
    this.buildVegetation();
    this.buildGrassData();
    this.buildZone();
    this.buildPlane();
    this.fx = new FX(this.scene);

    this.envMap = null;
    this.tierId = tierId;
    this.scale = 1;
    this.composer = null;
    this.time = 0;
    addEventListener('resize', () => this.resize());
  }

  // ---------------- terreno ----------------
  // Cada vértice guarda pesos (grama, terra, rocha, areia). Nos níveis PBR um shader mistura
  // 4 texturas em 2 escalas (quebra a repetição); nos níveis baixos usa só cor por vértice.
  buildTerrain(seg) {
    const W = this.world;
    const g = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, n = pos.count, col = new Float32Array(n * 3), spl = new Float32Array(n * 4);
    const c = new THREE.Color(), cs = { grass: new THREE.Color(0x8a8a4c), grass2: new THREE.Color(0x667a38), dirt: new THREE.Color(0x7d6a4c), rock: new THREE.Color(0x85827a), sand: new THREE.Color(0xcdb989) };
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = W.heightAt(x, z);
      pos.setY(i, y);
      const slope = Math.abs(W.heightAt(x + 3, z) - W.heightAt(x - 3, z)) / 6 + Math.abs(W.heightAt(x, z + 3) - W.heightAt(x, z - 3)) / 6;
      const nz = W.fbm2(x / 45, z / 45, 3) * 0.5 + 0.5;
      let sand = y < 2.4 ? 1 : y < 3.4 ? 3.4 - y : 0;
      let rock = Math.min(1, Math.max(0, (slope - 0.42) * 3)) + (y > 58 ? Math.min(1, (y - 58) / 8) : 0);
      let dirt = Math.max(0, (nz - 0.66) * 3);
      for (const t of W.towns) { const d = Math.hypot(x - t.x, z - t.z); if (d < t.r * 1.05) dirt = Math.max(dirt, 0.65 * (1 - d / (t.r * 1.05)) + (W.fbm2(x / 9, z / 9, 2) > 0.1 ? 0.35 : 0)); }
      rock = Math.min(1, rock); sand = Math.min(1, sand); dirt = Math.min(1, dirt) * (1 - rock) * (1 - sand);
      const grass = Math.max(0, 1 - rock - sand - dirt);
      spl.set([grass, dirt, rock, sand], i * 4);
      c.copy(cs.grass).lerp(cs.grass2, W.fbm2(x / 120, z / 120, 2) * 0.5 + 0.5).multiplyScalar(grass)
        .add(new THREE.Color().copy(cs.dirt).multiplyScalar(dirt)).add(new THREE.Color().copy(cs.rock).multiplyScalar(rock)).add(new THREE.Color().copy(cs.sand).multiplyScalar(sand));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
    g.computeVertexNormals();
    if (!this.terrainMats) {
      const det = TEX.dirt.clone(); det.needsUpdate = true; det.repeat.set(MAP_SIZE / 5, MAP_SIZE / 5);
      const pair = M(0xffffff, { vc: true, map: det, rough: 0.95 });
      pair.lo.color.setScalar(1.35); // a textura de terra escurece; compensa no Lambert
      const hi = pair.hi; hi.vertexColors = false; hi.map = null; hi.color.setScalar(1);
      hi.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { tG: { value: TEX.grass }, tD: { value: TEX.dirt }, tR: { value: TEX.rock }, tS: { value: TEX.sand } });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWP; varying vec3 vWN;')
          .replace('#include <fog_vertex>', '#include <fog_vertex>\nvSplat = splat; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normal;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tG, tD, tR, tS; varying vec4 vSplat; varying vec3 vWP; varying vec3 vWN;\nvec3 tri(sampler2D t, float s){ vec3 b = abs(vWN); b = pow(b, vec3(4.0)); b /= (b.x+b.y+b.z); return texture2D(t, vWP.zy/s).rgb*b.x + texture2D(t, vWP.xz/s).rgb*b.y + texture2D(t, vWP.xy/s).rgb*b.z; }')
          .replace('#include <map_fragment>', `
            vec4 w = vSplat / max(0.001, vSplat.x + vSplat.y + vSplat.z + vSplat.w);
            vec2 uv1 = vWP.xz / 6.0, uv2 = vWP.xz / 37.0;
            vec3 gC = mix(texture2D(tG, uv1).rgb, texture2D(tG, uv2).rgb, 0.45);
            vec3 dC = mix(texture2D(tD, uv1 * 1.3).rgb, texture2D(tD, uv2).rgb, 0.35);
            vec3 rC = tri(tR, 9.0);
            vec3 sC = texture2D(tS, uv1).rgb;
            float macro = texture2D(tD, vWP.xz / 260.0).r;
            vec3 tcol = gC * w.x + dC * w.y + rC * w.z + sC * w.w;
            diffuseColor.rgb *= tcol * (0.8 + macro * 0.45);`);
      };
      hi.customProgramCacheKey = () => 'terrain-splat';
      this.terrainMats = pair;
    }
    this.terrain = mesh(g, this.terrainMats);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.terrainSeg = seg;
  }

  buildWater() {
    const g = new THREE.PlaneGeometry(MAP_SIZE * 4, MAP_SIZE * 4, 1, 1); g.rotateX(-Math.PI / 2);
    this.water = mesh(g, M(0x2b6e86, { transparent: true, opacity: 0.88, rough: 0.05, metal: 0.25 }));
    this.water.position.y = WATER_LEVEL; this.water.renderOrder = 1;
    this.scene.add(this.water);
  }

  // Casas: paredes de tábuas pintadas ou reboco, rodapé de concreto, molduras de janela/porta
  // e telhado de duas águas (telha cerâmica ou zinco). Tudo fundido em poucas malhas.
  buildBuildings() {
    const W = this.world;
    const woodColors = [0x7fa3a3, 0x7f9a6a, 0xb7a88a, 0x8fa2b8, 0x9b6f55].map((h) => new THREE.Color(h));
    const plasterColors = [0xe8e2d4, 0xc9c4b8, 0xd8c8a8].map((h) => new THREE.Color(h));
    const G = { wood: [], plaster: [], tiles: [], metal: [], cont: [], trim: [] };
    const contColors = [0x9a3b2a, 0x2d5f8f, 0x4a6b3a, 0xb08a2c];
    for (const b of W.boxes) {
      if (b.kind === 'container') { G.cont.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, contColors[b.color], 2.5)); continue; }
      if (b.kind === 'crate') { G.wood.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, 0x9a7a4a, 1.4)); continue; }
      const H = W.houses[b.house];
      const isWood = H.color % 2 === 1 || H.color === 4;
      if (b.kind === 'floor' || b.kind === 'floor2' || b.kind === 'stair') { G.wood.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, 0x8a6a48, 2)); continue; }
      if (b.kind === 'roof') { G.trim.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, 0x4a4038, 3)); continue; }
      if (isWood) G.wood.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, woodColors[(b.house * 7) % woodColors.length], 2.2));
      else G.plaster.push(boxUV(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, plasterColors[(b.house * 3) % plasterColors.length], 3));
    }
    for (const H of W.houses) {
      const x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2;
      // rodapé de concreto
      G.plaster.push(boxUV(x0 - 0.06, H.y - 0.6, z0 - 0.06, x1 + 0.06, H.y + 0.35, z1 + 0.06, 0x8f8a80, 2));
      // molduras de janela e porta (madeira escura)
      const T = 0.3, frame = 0.09;
      for (let s = 0; s < 4; s++) {
        const along = s < 2, fixed = s === 0 ? z0 - 0.04 : s === 1 ? z1 - T - 0.04 : s === 2 ? x0 - 0.04 : x1 - T - 0.04;
        const mk = (a0, a1, y0, y1) => G.trim.push(along ? boxUV(a0, y0, fixed, a1, y1, fixed + T + 0.08, 0xe6e0d0, 1) : boxUV(fixed, y0, a0, fixed + T + 0.08, y1, a1, 0xe6e0d0, 1));
        const win = H['win' + s];
        if (win) {
          const a = win.mid - win.ww / 2, b2 = win.mid + win.ww / 2;
          mk(a - frame, a, win.wy0 - frame, win.wy1 + frame); mk(b2, b2 + frame, win.wy0 - frame, win.wy1 + frame);
          mk(a - frame, b2 + frame, win.wy0 - frame, win.wy0); mk(a - frame, b2 + frame, win.wy1, win.wy1 + frame);
          mk(win.mid - 0.03, win.mid + 0.03, win.wy0, win.wy1); // travessa
        } else if (s === H.door) {
          const mid = along ? H.x : H.z, a = mid - 0.8, b2 = mid + 0.8, top = H.y + 0.2 + 2.3;
          mk(a - frame, a, H.y + 0.2, top + frame); mk(b2, b2 + frame, H.y + 0.2, top + frame); mk(a - frame, b2 + frame, top, top + frame);
        }
      }
      // telhado de duas águas (cumeeira no eixo mais longo)
      const ov = 0.45, top = H.top + 0.3, alongX = H.w >= H.d;
      const half = (alongX ? H.d : H.w) / 2 + ov, rise = half * 0.55, len0 = (alongX ? x0 : z0) - ov, len1 = (alongX ? x1 : z1) + ov;
      const c = alongX ? H.z : H.x;
      const P = (l, side, y) => alongX ? [l, y, c + side] : [c + side, y, l];
      const roofG = H.color % 3 === 0 ? G.metal : G.tiles;
      const slopeLen = Math.hypot(half, rise) / 2.5, L0 = len0 / 2.5, L1 = len1 / 2.5;
      const roofCol = roofG === G.metal ? 0xb8b4ac : 0xd09070;
      const upOut = (side) => new THREE.Vector3(...P(0, side, 1)).sub(new THREE.Vector3(...P(0, 0, 0))).setY(0).normalize().add(new THREE.Vector3(0, 1, 0));
      roofG.push(quadGeo([P(len0, -half, top), P(len1, -half, top), P(len1, 0, top + rise), P(len0, 0, top + rise)], [[L0, 0], [L1, 0], [L1, slopeLen], [L0, slopeLen]], roofCol, upOut(-1)));
      roofG.push(quadGeo([P(len1, half, top), P(len0, half, top), P(len0, 0, top + rise), P(len1, 0, top + rise)], [[L1, 0], [L0, 0], [L0, slopeLen], [L1, slopeLen]], roofCol, upOut(1)));
      // oitões (triângulos nas pontas)
      const wallArr = H.color % 2 === 1 || H.color === 4 ? G.wood : G.plaster;
      const gc = H.color % 2 === 1 || H.color === 4 ? woodColors[(this.world.houses.indexOf(H) * 7) % woodColors.length] : plasterColors[(this.world.houses.indexOf(H) * 3) % plasterColors.length];
      const e0 = (alongX ? x0 : z0) + 0.01, e1 = (alongX ? x1 : z1) - 0.01, h2 = half - ov;
      const endOut = (e) => new THREE.Vector3(...P(e, 0, 0)).sub(new THREE.Vector3(H.x, 0, H.z)).setY(0);
      wallArr.push(quadGeo([P(e0, h2, top), P(e0, -h2, top), P(e0, 0, top + rise * (h2 / half))], [[h2 / 2.2, top / 2.2], [-h2 / 2.2, top / 2.2], [0, (top + rise) / 2.2]], gc, endOut(e0)));
      wallArr.push(quadGeo([P(e1, -h2, top), P(e1, h2, top), P(e1, 0, top + rise * (h2 / half))], [[-h2 / 2.2, top / 2.2], [h2 / 2.2, top / 2.2], [0, (top + rise) / 2.2]], gc, endOut(e1)));
    }
    this.buildings = [];
    const mats = {
      wood: M(0xffffff, { vc: true, map: TEX.wood, rough: 0.92 }),
      plaster: M(0xffffff, { vc: true, map: TEX.plaster, rough: 0.95 }),
      tiles: M(0xffffff, { vc: true, map: TEX.tiles, rough: 0.8, side: THREE.DoubleSide }),
      metal: M(0xffffff, { vc: true, map: TEX.metal, rough: 0.55, metal: 0.45, side: THREE.DoubleSide }),
      cont: M(0xffffff, { vc: true, map: TEX.metal, rough: 0.6, metal: 0.4 }),
      trim: M(0xffffff, { vc: true, map: TEX.wood, rough: 0.9 }),
    };
    for (const k of Object.keys(G)) {
      if (!G[k].length) continue;
      const m = mesh(merge(G[k]), mats[k]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m); this.buildings.push(m);
    }
  }

  // Árvores/rochas/arbustos instanciados por setores (permite culling + controle de densidade)
  buildVegetation() {
    const W = this.world;
    const trunkG = colorize(new THREE.CylinderGeometry(0.14, 0.32, 4.2, 7).translate(0, 2.1, 0), 0xffffff);
    // pinheiro: 5 camadas de cone levemente irregulares
    const layers = [];
    for (let k = 0; k < 5; k++) { const r = 2.3 - k * 0.38, h = 2.6 - k * 0.2; const cg = new THREE.ConeGeometry(r, h, 9, 2); const p = cg.attributes.position; for (let i = 0; i < p.count; i++) { if (p.getY(i) < h / 2 - 0.01) { const j = hash3(p.getX(i) + k, p.getY(i), p.getZ(i)); p.setX(i, p.getX(i) * (0.9 + j * 0.25)); p.setZ(i, p.getZ(i) * (0.9 + j * 0.25)); p.setY(i, p.getY(i) - j * 0.25); } } cg.translate(0, 3.0 + k * 1.15, 0); cg.computeVertexNormals(); layers.push(colorize(cg, 0xffffff)); }
    const pineG = merge(layers);
    const blobs = [];
    for (const [x, y, z, r] of [[0, 5.0, 0, 2.2], [1.2, 4.3, 0.5, 1.6], [-1.1, 4.5, -0.4, 1.7], [0.2, 6.0, -0.8, 1.5], [-0.4, 5.5, 1.1, 1.5]]) blobs.push(colorize(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), 0xffffff));
    const leafG = merge(blobs);
    const rockG = new THREE.DodecahedronGeometry(1, 1); { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.8 + hash3(p.getX(i), p.getY(i), p.getZ(i)) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); } rockG.computeVertexNormals(); }
    const bushG = new THREE.IcosahedronGeometry(0.8, 1); bushG.translate(0, 0.45, 0);
    const mTrunk = M(0x6b5340, { map: TEX.bark, rough: 1 }), mPine = M(0xffffff, { map: TEX.foliage, rough: 0.9 }), mLeaf = M(0xffffff, { map: TEX.foliage, rough: 0.9 }), mRock = M(0xa09d95, { map: TEX.rock, rough: 0.95 }), mBush = M(0x7a9a50, { map: TEX.foliage, rough: 0.95 });
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
      this.scene.add(im); list.push({ mesh: im, full: items.length });
      return im;
    };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const trees = bucket(W.trees), rocks = bucket(W.rocks), bushes = bucket(W.bushes);
    for (let s = 0; s < SECTORS * SECTORS; s++) {
      const tr = shuffle(trees[s]);
      const tset = (t) => { p3.set(t.x, t.y - 0.2, t.z); q.setFromAxisAngle(up, t.rot); s3.set(t.s, t.s * (1.05 + (t.rot % 0.3)), t.s); };
      const pines = tr.filter((t) => t.type === 0), leafs = tr.filter((t) => t.type === 1);
      fill(trunkG, mTrunk, pines, tset, this.veg, true);
      fill(trunkG, mTrunk, leafs, tset, this.veg, true);
      const pm = fill(pineG, mPine, pines, tset, this.veg, true);
      if (pm) pines.forEach((t, i) => pm.setColorAt(i, color.setHSL(0.25 + Math.random() * 0.06, 0.38, 0.3 + Math.random() * 0.1)));
      const lm = fill(leafG, mLeaf, leafs, tset, this.veg, true);
      if (lm) leafs.forEach((t, i) => lm.setColorAt(i, color.setHSL(0.2 + Math.random() * 0.07, 0.42, 0.38 + Math.random() * 0.1)));
      fill(rockG, mRock, shuffle(rocks[s]), (r) => { p3.set(r.x, r.y - r.s * 0.2, r.z); q.setFromAxisAngle(up, r.rot); s3.set(r.s, r.s, r.s * 0.9); }, this.veg, true);
      fill(bushG, mBush, shuffle(bushes[s]), (b) => { p3.set(b.x, b.y, b.z); q.identity(); s3.set(b.s, b.s, b.s); }, this.bushMeshes, false);
    }
  }

  // ---------------- capim alto (GPU) ----------------
  // Mapa de altura+densidade numa textura; milhares de tufos instanciados ao redor da câmera,
  // posicionados no shader (custo de CPU zero) e balançando com o vento.
  buildGrassData() {
    const W = this.world, N = GRID_N, data = new Float32Array(N * N * 2);
    const blocked = new Uint8Array(N * N);
    const mark = (x0, z0, x1, z1) => { for (let j = Math.max(0, Math.floor((z0 + HALF) / GRID_RES)); j <= Math.min(N - 1, Math.ceil((z1 + HALF) / GRID_RES)); j++) for (let i = Math.max(0, Math.floor((x0 + HALF) / GRID_RES)); i <= Math.min(N - 1, Math.ceil((x1 + HALF) / GRID_RES)); i++) blocked[j * N + i] = 1; };
    for (const H of W.houses) mark(H.x - H.w / 2 - 1, H.z - H.d / 2 - 1, H.x + H.w / 2 + 1, H.z + H.d / 2 + 1);
    for (const b of W.boxes) if (b.kind === 'container' || b.kind === 'crate') mark(b.x0, b.z0, b.x1, b.z1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = i * GRID_RES - HALF, z = j * GRID_RES - HALF, k = j * N + i, y = W.h[k];
      const slope = Math.abs(W.heightAt(x + 3, z) - W.heightAt(x - 3, z)) / 6 + Math.abs(W.heightAt(x, z + 3) - W.heightAt(x, z - 3)) / 6;
      let d = y > 3.2 && y < 56 && slope < 0.45 && !blocked[k] ? 1 : 0;
      if (d) { const nz = W.fbm2(x / 45, z / 45, 3) * 0.5 + 0.5; if (nz > 0.7) d = 0.25; for (const t of W.towns) { const dd = Math.hypot(x - t.x, z - t.z); if (dd < t.r) d *= 0.35 + 0.65 * (dd / t.r); } d *= 0.7 + (W.fbm2(x / 20, z / 20, 2) * 0.5 + 0.5) * 0.6; }
      data[k * 2] = y; data[k * 2 + 1] = Math.min(1, d);
    }
    this.hdTex = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.FloatType);
    this.hdTex.minFilter = this.hdTex.magFilter = THREE.NearestFilter; this.hdTex.needsUpdate = true;
    this.grass = null;
  }

  buildGrass(count, radius) {
    if (this.grass) { this.scene.remove(this.grass); this.grass.geometry.dispose(); this.grass = null; }
    if (!count) return;
    const S = radius * 2;
    // tufo = 3 planos cruzados
    const base = new THREE.PlaneGeometry(1.1, 1, 1, 3); base.translate(0, 0.5, 0);
    const planes = [0, Math.PI / 3, (2 * Math.PI) / 3].map((a) => base.clone().rotateY(a));
    const tuft = mergeGeometries(planes); base.dispose();
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = tuft.index; geo.attributes.position = tuft.attributes.position; geo.attributes.uv = tuft.attributes.uv;
    const off = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { off[i * 3] = Math.random() * S; off[i * 3 + 1] = Math.random() * S; off[i * 3 + 2] = Math.random(); }
    geo.setAttribute('offset', new THREE.InstancedBufferAttribute(off, 3));
    geo.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uHD: { value: null }, uCam: { value: new THREE.Vector2() }, uS: { value: S }, uR: { value: radius }, uHalf: { value: HALF }, uRes: { value: GRID_RES }, uN: { value: GRID_N }, uTime: { value: 0 }, uSun: { value: new THREE.Color(1.0, 0.92, 0.78) }, uAmb: { value: new THREE.Color(0.42, 0.45, 0.42) } }]),
      vertexShader: `
        attribute vec3 offset; uniform sampler2D uHD; uniform vec2 uCam; uniform float uS, uR, uHalf, uRes, uN, uTime;
        varying vec2 vUv; varying float vTint;
        #include <fog_pars_vertex>
        vec2 hd(vec2 p) {
          vec2 f = clamp((p + uHalf) / uRes, vec2(0.0), vec2(uN - 1.001)); ivec2 i = ivec2(floor(f)); vec2 t = fract(f);
          vec2 a = texelFetch(uHD, i, 0).rg, b = texelFetch(uHD, i + ivec2(1, 0), 0).rg, c = texelFetch(uHD, i + ivec2(0, 1), 0).rg, d = texelFetch(uHD, i + ivec2(1, 1), 0).rg;
          return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
        }
        void main() {
          vec2 wp = offset.xy + uS * floor((uCam - offset.xy) / uS + 0.5);
          vec2 h = hd(wp);
          float dist = length(wp - uCam);
          float s = h.y * (1.0 - smoothstep(uR * 0.6, uR, dist)) * (0.55 + offset.z * 0.8);
          if (s < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float a = offset.z * 6.2831;
          vec3 p = position; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
          p.xz *= s; p.y *= s * (0.8 + offset.z * 0.7);
          float w = sin(uTime * 1.6 + wp.x * 0.13 + wp.y * 0.09) * 0.16 + sin(uTime * 3.3 + wp.x * 0.6 + wp.y * 0.4) * 0.05;
          p.x += w * uv.y * uv.y; p.z += w * 0.5 * uv.y * uv.y;
          vec4 mvPosition = viewMatrix * vec4(wp.x + p.x, h.x + p.y - 0.05, wp.y + p.z, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          vUv = uv; vTint = offset.z;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uSun, uAmb; varying vec2 vUv; varying float vTint;
        #include <fog_pars_fragment>
        void main() {
          vec4 c = texture2D(uMap, vUv);
          if (c.a < 0.5) discard;
          vec3 col = c.rgb * mix(vec3(0.86, 1.0, 0.8), vec3(1.0, 0.98, 0.82), vTint);
          col = mix(vec3(dot(col, vec3(0.3, 0.59, 0.11))), col, 0.72) * (uAmb + uSun * (0.3 + 0.6 * vUv.y));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      fog: true, side: THREE.DoubleSide,
    });
    mat.uniforms.uMap.value = TEX.grassBlade; mat.uniforms.uHD.value = this.hdTex;
    this.grass = new THREE.Mesh(geo, mat); this.grass.frustumCulled = false;
    this.scene.add(this.grass);
  }

  buildZone() {
    const g = new THREE.CylinderGeometry(1, 1, 600, 96, 1, true);
    const m = new THREE.MeshBasicMaterial({ color: 0x3b7bff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.zoneMesh = new THREE.Mesh(g, m); this.zoneMesh.position.y = 200; this.zoneMesh.renderOrder = 2;
    this.scene.add(this.zoneMesh);
  }

  buildPlane() {
    const g = new THREE.Group();
    const skin = M(0xb9bfc4, { rough: 0.45, metal: 0.55 }), dark = M(0x3a4048, { rough: 0.6 });
    const body = mesh(new THREE.CapsuleGeometry(2.1, 22, 6, 14).rotateX(Math.PI / 2), skin);
    const wing = mesh(new THREE.BoxGeometry(36, 0.45, 5.5), skin); wing.position.set(0, 0.6, -1);
    const tail = mesh(new THREE.BoxGeometry(0.45, 6, 4), skin); tail.position.set(0, 3.5, 11.5);
    const tw = mesh(new THREE.BoxGeometry(13, 0.4, 3), skin); tw.position.set(0, 1, 11.5);
    g.add(body, wing, tail, tw);
    for (const x of [-6, -11, 6, 11]) { const e = mesh(new THREE.CylinderGeometry(0.9, 1.1, 4.2, 12).rotateX(Math.PI / 2), dark); e.position.set(x, -0.2, -3.2); g.add(e); const prop = mesh(new THREE.BoxGeometry(4.2, 0.25, 0.1), dark); prop.position.set(x, -0.2, -5.4); prop.userData.prop = true; g.add(prop); }
    g.visible = false;
    this.plane = g; this.scene.add(g);
  }

  // ---------------- qualidade ----------------
  applyTier(tierId, scale) {
    const T = TIERS[tierId], r = this.renderer, prev = this.tierId;
    this.tierId = tierId;
    for (const o of this.scene.children) o.traverse?.((m) => { if (m.userData.mp) m.material = T.pbr ? m.userData.mp.hi : m.userData.mp.lo; });
    // sombras
    r.shadowMap.enabled = T.shadows > 0;
    this.sun.castShadow = T.shadows > 0;
    if (T.shadows > 0 && this.sun.shadow.mapSize.x !== T.shadows) {
      this.sun.shadow.mapSize.set(T.shadows, T.shadows);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      const ext = T.shadows >= 4096 ? 100 : T.shadows >= 2048 ? 75 : 55;
      Object.assign(this.sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext }); this.sun.shadow.camera.updateProjectionMatrix();
    }
    this.sun.shadow.radius = 3;
    for (const p of matPairs) { p.lo.needsUpdate = true; p.hi.needsUpdate = true; }
    this.camera.far = T.view + 200; this.camera.updateProjectionMatrix();
    this.scene.fog.near = T.view * (0.25 + (1 - T.fogDensity) * 0.3); this.scene.fog.far = T.view;
    this.sky.visible = T.sky;
    this.scene.background = T.sky ? null : FOG_COLOR.clone();
    if (T.pbr && tierId >= 3) {
      if (!this.envMap) {
        const pm = new THREE.PMREMGenerator(r); const sc = new THREE.Scene(); sc.add(makeSkyDome(this.sunDir, 900));
        this.envMap = pm.fromScene(sc, 0, 0.1, 2000).texture; pm.dispose();
      }
      this.scene.environment = this.envMap; this.scene.environmentIntensity = 0.25;
      this.hemi.intensity = 0.85; r.toneMappingExposure = 0.95;
    } else { this.scene.environment = null; this.hemi.intensity = T.pbr ? 1.2 : 1.5; r.toneMappingExposure = 1.0; }
    this.sun.intensity = T.pbr ? 3.0 : 2.0;
    for (const v of this.veg) v.mesh.count = Math.max(0, Math.floor(v.full * T.veg));
    for (const v of this.bushMeshes) { v.mesh.count = Math.floor(v.full * T.bushes); v.mesh.visible = T.bushes > 0; }
    if (T.terrainSeg > this.terrainSeg) { this.scene.remove(this.terrain); this.terrain.geometry.dispose(); this.buildTerrain(T.terrainSeg); this.terrain.material = T.pbr ? this.terrainMats.hi : this.terrainMats.lo; }
    // capim: quantidade e raio por nível
    const grassCfg = [[0, 0], [5000, 22], [16000, 32], [38000, 45], [70000, 58], [110000, 72]][tierId];
    if (!this.grass || this.grassCount !== grassCfg[0]) { this.buildGrass(grassCfg[0], grassCfg[1]); this.grassCount = grassCfg[0]; }
    this._alt = null;
    this.setScale(scale);
    this.buildComposer(T);
    return prev;
  }

  fixMaterials(obj) {
    const pbr = TIERS[Math.max(0, this.tierId)].pbr;
    obj.traverse((m) => { if (m.userData.mp) m.material = pbr ? m.userData.mp.hi : m.userData.mp.lo; });
  }

  maxScale() {
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
      if (T.bloom) { c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.4, 0.92)); this.post.push('Bloom'); }
      c.addPass(new OutputPass());
      c.addPass(new ShaderPass(GradeShader)); this.post.push('Gradação de cor');
      if (T.smaa) { c.addPass(new SMAAPass(w * r.getPixelRatio(), h * r.getPixelRatio())); this.post.push('SMAA'); }
      this.composer = c;
    } catch (e) { console.warn('Pós-processamento indisponível:', e); this.composer = null; this.post = ['(desativado: erro)']; }
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.setScale(Math.min(this.scale, this.maxScale()));
  }

  setAltitudeView(high) {
    if (this._alt === high) return; this._alt = high;
    const T = TIERS[this.tierId], v = high ? Math.max(T.view, 750) : T.view;
    this.camera.far = v + 200; this.camera.updateProjectionMatrix();
    this.scene.fog.near = v * (0.25 + (1 - T.fogDensity) * 0.3); this.scene.fog.far = v;
  }

  render(focus, dt = 0.016) {
    this.time += dt;
    if (this.sun.castShadow) {
      const s = 4; const fx = Math.round(focus.x / s) * s, fz = Math.round(focus.z / s) * s;
      this.sun.target.position.set(fx, focus.y, fz);
      this.sun.position.set(fx + this.sunDir.x * 300, focus.y + this.sunDir.y * 300, fz + this.sunDir.z * 300);
    }
    if (this.grass) { const u = this.grass.material.uniforms; u.uCam.value.set(this.camera.position.x, this.camera.position.z); u.uTime.value = this.time; }
    this.sky.material.uniforms.uTime.value = this.time;
    if (this.plane.visible) this.plane.children.forEach((c) => { if (c.userData.prop) c.rotation.z += dt * 40; });
    this.water.position.x = Math.round(this.camera.position.x / 50) * 50; this.water.position.z = Math.round(this.camera.position.z / 50) * 50;
    this.sky.position.copy(this.camera.position);
    this.renderer.info.reset();
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  drawingSize() { const v = new THREE.Vector2(); this.renderer.getDrawingBufferSize(v); return v; }
}

function makeSkyDome(sunDir, radius = 4000) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uClouds: { value: TEX ? TEX.clouds : null }, uTime: { value: 0 }, uSun: { value: sunDir.clone().normalize() }, uTop: { value: new THREE.Color(0x2f6fc4) }, uMid: { value: new THREE.Color(0x6fa3dc) }, uHor: { value: new THREE.Color(0xc4d6e8) } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uSun, uTop, uMid, uHor; uniform sampler2D uClouds; uniform float uTime; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.18, h)); c = mix(c, uTop, smoothstep(0.15, 0.85, h));
        if (d.y < 0.0) c = uHor * 0.92;
        float s = max(dot(d, uSun), 0.0);
        c += vec3(1.0, 0.9, 0.7) * (pow(s, 8.0) * 0.25 + pow(s, 900.0) * 6.0);
        if (d.y > 0.01) {
          vec2 cuv = d.xz / (d.y + 0.08) * 0.35 + vec2(uTime * 0.004, uTime * 0.0017);
          vec4 cl = texture2D(uClouds, cuv);
          float a = cl.a * smoothstep(0.02, 0.25, d.y);
          vec3 ccol = mix(vec3(0.72, 0.76, 0.82), vec3(1.0), cl.r) * (1.0 + pow(s, 6.0) * 0.4);
          c = mix(c, ccol, a * 0.95);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), m); s.renderOrder = -2; s.frustumCulled = false;
  return s;
}

// Gradação de cor "cinematográfica": contraste, saturação, tom levemente quente e vinheta
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.12);
      c = (c - 0.5) * 1.07 + 0.5;
      c *= mix(vec3(0.97, 0.99, 1.04), vec3(1.04, 1.0, 0.94), smoothstep(0.3, 0.9, l));
      float v = smoothstep(0.95, 0.35, length(vUv - 0.5)); c *= mix(0.82, 1.0, v);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
};

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
// Cada parte do corpo é UMA malha (peças fundidas com cor por vértice): ~8 draw calls por
// personagem, leve até em PC fraco, mas com capacete, colete, bolsos, mochila, botas e luvas.
const hash3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const charMat = M(0xffffff, { vc: true, rough: 0.85 });
const camoMat = M(0xffffff, { vc: true, rough: 0.9 });
const gunMat = M(0xffffff, { vc: true, rough: 0.45, metal: 0.55 });
const chuteMat = M(0xffffff, { vc: true, side: THREE.DoubleSide, rough: 0.7 });
function initSharedMaterials(T) { setMap(camoMat, T.camo); }

const SKIN = [0xe0b48f, 0xc68e64, 0x8d5a3b, 0xf0c8a8];
const BOX = (w, h, d, x, y, z, col, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return colorize(g, col); };
const CAP = (r, len, x, y, z, col) => colorize(new THREE.CapsuleGeometry(r, len, 4, 8).translate(x, y, z), col);
const CYL = (r1, r2, h, x, y, z, col, rotX = 0, rotZ = 0) => { const g = new THREE.CylinderGeometry(r1, r2, h, 10); if (rotX) g.rotateX(rotX); if (rotZ) g.rotateZ(rotZ); g.translate(x, y, z); return colorize(g, col); };
const SPH = (r, x, y, z, col, sx = 1, sy = 1, sz = 1, thetaLen = Math.PI) => { const g = new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, thetaLen); g.scale(sx, sy, sz); g.translate(x, y, z); return colorize(g, col); };

// modelos de arma (originais, montados com primitivas) — apontam para -Z
export function weaponGeo(type) {
  const blk = 0x26282b, mt = 0x3b3f44, wood = 0x6b4a2e, tan = 0x8a7a5a;
  const p = [];
  if (type === 'pistol') {
    p.push(BOX(0.04, 0.05, 0.2, 0, 0.03, -0.08, mt), BOX(0.036, 0.11, 0.05, 0, -0.04, 0.0, blk, 0.25), BOX(0.03, 0.02, 0.06, 0, -0.005, -0.06, blk));
  } else if (type === 'shotgun') {
    p.push(CYL(0.022, 0.022, 0.75, 0, 0.02, -0.42, mt, Math.PI / 2), CYL(0.018, 0.018, 0.6, 0, -0.03, -0.38, blk, Math.PI / 2), BOX(0.06, 0.07, 0.22, 0, 0, -0.02, blk),
      BOX(0.07, 0.06, 0.16, 0, -0.03, -0.42, wood), BOX(0.05, 0.1, 0.32, 0, -0.04, 0.22, wood, -0.15), BOX(0.04, 0.09, 0.05, 0, -0.08, 0.05, blk, 0.3));
  } else if (type === 'sniper') {
    p.push(CYL(0.016, 0.02, 0.85, 0, 0.02, -0.6, mt, Math.PI / 2), BOX(0.06, 0.07, 0.42, 0, 0, -0.1, wood), BOX(0.055, 0.12, 0.36, 0, -0.04, 0.24, wood, -0.12),
      CYL(0.03, 0.03, 0.34, 0, 0.1, -0.08, blk, Math.PI / 2), CYL(0.04, 0.035, 0.06, 0, 0.1, -0.27, blk, Math.PI / 2), BOX(0.02, 0.05, 0.04, 0, 0.065, -0.08, blk), BOX(0.035, 0.06, 0.05, 0.035, 0.03, 0.02, mt));
  } else { // ar / smg — fuzil compacto com carregador, coronha e mira
    const smg = type === 'smg';
    const L = smg ? 0.8 : 1;
    p.push(BOX(0.055, 0.085, 0.42 * L, 0, 0, -0.08, blk), CYL(0.014, 0.014, 0.4 * L, 0, 0.02, -0.45 * L, mt, Math.PI / 2), BOX(0.06, 0.06, 0.24 * L, 0, 0.005, -0.36 * L, smg ? blk : tan),
      BOX(0.045, 0.16, 0.06, 0, -0.11, -0.12, blk, smg ? 0 : -0.25), BOX(0.04, 0.1, 0.05, 0, -0.09, 0.07, blk, 0.35), BOX(0.05, 0.08, 0.25 * L, 0, -0.01, 0.24 * L, smg ? blk : tan, -0.05),
      BOX(0.02, 0.03, 0.12, 0, 0.065, -0.1, blk), CYL(0.024, 0.024, 0.1, 0, 0.09, -0.08, blk, Math.PI / 2));
  }
  return merge(p);
}
const weaponGeoCache = {};
function wgeo(t) { return weaponGeoCache[t] || (weaponGeoCache[t] = weaponGeo(t)); }

export function makeCharacter(color) {
  const r = (k) => hash3(color % 997, k, 3.3);
  const shirt = [0x4f8a8c, 0x3f5f8a, 0xb8a888, 0x5a6240, 0x7a7a74, 0xd8d4c8, 0x2e3034, 0x8a4a3a][Math.floor(r(6) * 8)];
  const skin = SKIN[Math.floor(r(1) * SKIN.length)];
  const vest = [0x3d4232, 0x4a4436, 0x2f3337, 0x5a5440][Math.floor(r(2) * 4)];
  const helmet = [0x4b5a3a, 0x6b6450, 0x3e4448, 0x5c5a48][Math.floor(r(3) * 4)];
  const pack = [0x4f5a36, 0x5a4a34, 0x3a3f42][Math.floor(r(4) * 3)];
  const pants = [0xb8b0a0, 0x9a9a8a, 0x8a8f9a][Math.floor(r(5) * 3)];
  const strap = 0x2a2a26;

  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.92; root.add(hips);
  // tronco: camisa + colete com bolsos + cinto + mochila com saco de dormir
  const torso = mesh(merge([
    CAP(0.2, 0.32, 0, 0.33, 0, shirt).scale(1.05, 1, 0.68),
    BOX(0.44, 0.36, 0.3, 0, 0.36, 0, vest),
    BOX(0.1, 0.11, 0.05, -0.13, 0.28, -0.17, vest), BOX(0.1, 0.11, 0.05, 0, 0.28, -0.17, vest), BOX(0.1, 0.11, 0.05, 0.13, 0.28, -0.17, vest),
    BOX(0.46, 0.06, 0.31, 0, 0.06, 0, strap),
    BOX(0.36, 0.44, 0.2, 0, 0.36, 0.25, pack), BOX(0.3, 0.16, 0.06, 0, 0.26, 0.37, pack),
    CYL(0.07, 0.07, 0.4, 0, 0.62, 0.27, 0x6e6a58, 0, Math.PI / 2),
    BOX(0.05, 0.42, 0.04, -0.13, 0.42, -0.16, strap), BOX(0.05, 0.42, 0.04, 0.13, 0.42, -0.16, strap),
    CAP(0.06, 0.06, 0, 0.67, 0, skin),
  ]), charMat);
  hips.add(torso);
  // cabeça: rosto + capacete com aba e alça
  const head = mesh(merge([
    SPH(0.115, 0, 0, 0, skin, 0.95, 1.12, 1),
    SPH(0.142, 0, 0.035, 0.005, helmet, 1.05, 0.92, 1.1, Math.PI * 0.52),
    CYL(0.155, 0.16, 0.025, 0, 0.012, 0.005, helmet),
    BOX(0.02, 0.12, 0.02, -0.105, -0.05, 0, strap), BOX(0.02, 0.12, 0.02, 0.105, -0.05, 0, strap),
    BOX(0.12, 0.03, 0.02, 0, 0.0, -0.115, 0x1c1c1c),
  ]), charMat);
  head.position.y = 0.86; hips.add(head);
  // pernas: calça camuflada + joelheira + bota
  const leg = () => { const g = new THREE.Group(); g.add(mesh(merge([CAP(0.085, 0.62, 0, -0.38, 0, pants), BOX(0.13, 0.12, 0.05, 0, -0.42, -0.07, 0x3a3a34), BOX(0.13, 0.12, 0.26, 0, -0.84, -0.04, 0x2b2622), BOX(0.135, 0.03, 0.27, 0, -0.9, -0.04, 0x171513)]), camoMat)); return g; };
  const legL = leg(), legR = leg(); legL.position.set(-0.12, 0, 0); legR.position.set(0.12, 0, 0); hips.add(legL, legR);
  // braços: manga + luva
  const arm = () => { const g = new THREE.Group(); g.add(mesh(merge([CAP(0.065, 0.4, 0, -0.26, 0, shirt), BOX(0.09, 0.1, 0.1, 0, -0.55, 0, 0x2d2a26)]), charMat)); return g; };
  const armL = arm(), armR = arm(); armL.position.set(-0.29, 0.58, 0); armR.position.set(0.29, 0.58, 0); hips.add(armL, armR);
  // arma na mão (troca o modelo conforme o tipo)
  const gun = new THREE.Group(); gun.position.set(0.12, 0.4, -0.3); hips.add(gun);
  const guns = {};
  for (const t of ['pistol', 'smg', 'ar', 'shotgun', 'sniper']) { const m = mesh(wgeo(t), gunMat); m.visible = false; gun.add(m); guns[t] = m; }
  // paraquedas: velame + cordas
  const chuteG = [];
  const canopy = new THREE.SphereGeometry(3.4, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.8); canopy.scale(1.25, 0.6, 0.9);
  const cn = canopy.attributes.position.count, cc = new Float32Array(cn * 3);
  for (let i = 0; i < cn; i++) { const a = Math.atan2(canopy.attributes.position.getZ(i), canopy.attributes.position.getX(i)); const stripe = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 12) % 2; const c = new THREE.Color(stripe ? 0xe8e4d8 : 0x3f5a8a); cc.set([c.r, c.g, c.b], i * 3); }
  canopy.setAttribute('color', new THREE.BufferAttribute(cc, 3)); canopy.translate(0, 3.2, 0); chuteG.push(canopy);
  for (const [x, z] of [[-3, -1.2], [3, -1.2], [-3, 1.2], [3, 1.2], [0, -1.5], [0, 1.5]]) {
    const dir = new THREE.Vector3(x, 3.0, z), len = dir.length();
    const g = new THREE.CylinderGeometry(0.012, 0.012, len, 3); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    chuteG.push(colorize(g, 0xdddddd));
  }
  const chute = mesh(merge(chuteG), chuteMat); chute.position.y = 1.4; chute.visible = false; root.add(chute);
  root.userData = { hips, legL, legR, armL, armR, gun, guns, chute, head, phase: 0 };
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}

export function poseCharacter(ch, st, dt) {
  const u = ch.userData;
  u.phase += dt * (st.speed > 0.3 ? 2 + st.speed * 1.4 : 0);
  const sw = st.speed > 0.3 ? Math.sin(u.phase) * Math.min(0.9, 0.25 + st.speed * 0.1) : 0;
  u.chute.visible = st.state === 'chute';
  const falling = st.state === 'air';
  for (const k in u.guns) u.guns[k].visible = k === st.weapon && st.state !== 'chute' && !falling;
  if (st.dead) { u.hips.rotation.x = -Math.PI / 2 * 0.95; u.hips.position.y = 0.25; u.legL.rotation.x = u.legR.rotation.x = 0; return; }
  u.hips.rotation.x = falling ? -1.2 : st.crouch ? -0.25 : 0.04 * Math.abs(sw);
  u.hips.position.y = st.crouch ? 0.58 : 0.92 + Math.abs(Math.cos(u.phase)) * 0.03 * Math.min(1, st.speed / 4);
  u.head.rotation.x = falling ? 1.0 : -(st.pitch || 0) * 0.5;
  u.legL.rotation.x = falling ? 0.3 : st.crouch ? -1.25 + sw * 0.3 : sw;
  u.legR.rotation.x = falling ? 0.1 : st.crouch ? -0.35 - sw * 0.3 : -sw;
  const hasGun = !!st.weapon;
  if (falling) { u.armL.rotation.set(0, 0, -1.2); u.armR.rotation.set(0, 0, 1.2); }
  else if (st.state === 'chute') { u.armL.rotation.set(Math.PI * 0.92, 0, 0.25); u.armR.rotation.set(Math.PI * 0.92, 0, -0.25); }
  else if (hasGun) {
    const p = -Math.PI / 2 + (st.pitch || 0);
    if (st.weapon === 'pistol') { u.armR.rotation.set(p, 0, 0.12); u.armL.rotation.set(p, 0, 0.42); u.gun.position.set(0.04, 0.42, -0.55); }
    else { u.armR.rotation.set(p + 0.35, 0, -0.1); u.armL.rotation.set(p, 0, 0.55); u.gun.position.set(0.12, 0.42, -0.3); }
    u.gun.rotation.x = st.pitch || 0;
  } else { u.armL.rotation.set(-sw, 0, 0.08); u.armR.rotation.set(sw, 0, -0.08); }
}

// ---------------- loot ----------------
const lootMats = { ammo: M(0x8a7a3a, { rough: 0.6, metal: 0.3 }), bandage: M(0xeeeeea, {}), medkit: M(0xd8d8d0, {}), cross: M(0xc02a2a, {}), armor: M(0x4a5038, { rough: 0.9 }), helmet: M(0x4e5a3a, { rough: 0.6 }) };
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.45, depthWrite: false, fog: false });
const lootGeo = {
  box: new THREE.BoxGeometry(0.35, 0.22, 0.25), med: new THREE.BoxGeometry(0.42, 0.3, 0.16), cross: new THREE.BoxGeometry(0.26, 0.07, 0.17), cross2: new THREE.BoxGeometry(0.07, 0.24, 0.17),
  vest: (() => merge([colorize(new THREE.BoxGeometry(0.46, 0.55, 0.16), 0xffffff), ...[-0.13, 0, 0.13].map((x) => colorize(new THREE.BoxGeometry(0.11, 0.12, 0.06).translate(x, -0.1, -0.1), 0xdddddd))]))(),
  helmet: (() => { const g = new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52); g.scale(1.05, 0.9, 1.1); return g; })(),
  ring: new THREE.RingGeometry(0.45, 0.58, 24).rotateX(-Math.PI / 2),
};
export function makeLoot(type) {
  const g = new THREE.Group();
  let m;
  if (['pistol', 'smg', 'ar', 'shotgun', 'sniper'].includes(type)) { m = mesh(wgeo(type), gunMat); m.rotation.z = Math.PI / 2 * 0.0; m.scale.setScalar(1.3); }
  else if (type === 'ammo') m = mesh(lootGeo.box, lootMats.ammo);
  else if (type === 'bandage') m = mesh(lootGeo.box, lootMats.bandage);
  else if (type === 'medkit') { m = new THREE.Group(); m.add(mesh(lootGeo.med, lootMats.medkit), mesh(lootGeo.cross, lootMats.cross), mesh(lootGeo.cross2, lootMats.cross)); m.children[1].position.z = m.children[2].position.z = -0.01; }
  else if (type.startsWith('armor')) m = mesh(lootGeo.vest, lootMats.armor);
  else m = mesh(lootGeo.helmet, lootMats.helmet);
  m.position.y = 0.3; g.add(m);
  const ring = new THREE.Mesh(lootGeo.ring, ringMat); ring.position.y = 0.03; g.add(ring);
  g.userData.spin = m;
  return g;
}
