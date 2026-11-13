// Mundo procedural determinístico — o MESMO código roda no servidor (Node) e no navegador.
// Gera: ilha (relevo), cidades com casas "entráveis", árvores, rochas, pontos de loot,
// e fornece física de colisão + raycast usados pelos jogadores e bots.

export const MAP_SIZE = 1600;           // metros (ilha de 1,6 km x 1,6 km)
export const HALF = MAP_SIZE / 2;
export const GRID_RES = 4;              // resolução do heightmap (m)
export const GRID_N = MAP_SIZE / GRID_RES + 1;
export const WATER_LEVEL = 0;
export const PLAYER_RADIUS = 0.4;
export const PLAYER_HEIGHT = 1.8;
export const STEP_HEIGHT = 0.45;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint16Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rng() * 2 - 1;
  const fade = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = vals[perm[perm[X] + Y]], b = vals[perm[perm[X + 1] + Y]];
    const c = vals[perm[perm[X] + Y + 1]], d = vals[perm[perm[X + 1] + Y + 1]];
    const u = fade(xf), v = fade(yf);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  return function fbm(x, y, oct = 5) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.rng = rng;
    const fbm = makeNoise(seed);
    const fbm2 = makeNoise(seed * 7 + 3);
    this.fbm2 = fbm2;

    // ---------- Heightmap ----------
    const N = GRID_N;
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = i * GRID_RES - HALF, z = j * GRID_RES - HALF;
        const d = Math.hypot(x, z) / HALF + fbm2(x / 260, z / 260, 3) * 0.18;
        const mask = smooth(1.0, 0.72, d);
        const n = fbm(x / 330, z / 330, 5) * 0.5 + 0.5;
        const ridge = 1 - Math.abs(fbm2(x / 520 + 9, z / 520 - 4, 4));
        h[j * N + i] = Math.pow(n, 1.6) * 55 * mask + ridge * ridge * 22 * mask + (mask * 14 - 9);
      }
    }
    this.h = h;

    // ---------- Cidades ----------
    this.towns = [];
    let tries = 0;
    while (this.towns.length < 7 && tries++ < 400) {
      const x = (rng() * 2 - 1) * HALF * 0.68, z = (rng() * 2 - 1) * HALF * 0.68;
      const y = this.heightAt(x, z);
      if (y < 3 || y > 40) continue;
      if (this.towns.some((t) => Math.hypot(t.x - x, t.z - z) < 260)) continue;
      const r = 55 + rng() * 25;
      this.towns.push({ x, z, y: Math.max(2.5, y), r, name: TOWN_NAMES[this.towns.length % TOWN_NAMES.length] });
    }
    for (const t of this.towns) this._flatten(t.x, t.z, t.r, t.y);

    // ---------- Colisores ----------
    this.boxes = [];   // AABB {x0,y0,z0,x1,y1,z1,kind}
    this.circles = []; // cilindros {x,z,r,y0,y1,kind}
    this.houses = [];
    this.lootSpawns = [];

    for (const t of this.towns) this._buildTown(t, rng);

    // Containers / caixas espalhadas (cobertura)
    for (let i = 0; i < 140; i++) {
      const x = (rng() * 2 - 1) * HALF * 0.8, z = (rng() * 2 - 1) * HALF * 0.8;
      const y = this.heightAt(x, z);
      if (y < 1.5 || this._nearTown(x, z, 10) || this._slope(x, z) > 0.25) continue;
      const big = rng() < 0.4;
      const w = big ? 6 : 1.4, d = big ? 2.4 : 1.4, hh = big ? 2.6 : 1.4;
      const rot = rng() < 0.5;
      const bw = rot ? d : w, bd = rot ? w : d;
      this.boxes.push({ x0: x - bw / 2, z0: z - bd / 2, x1: x + bw / 2, z1: z + bd / 2, y0: y - 0.5, y1: y + hh, kind: big ? 'container' : 'crate', color: (rng() * 4) | 0 });
      if (rng() < 0.6) this.lootSpawns.push({ x: x + (bw / 2 + 0.9), y: this.heightAt(x + bw / 2 + 0.9, z), z });
    }

    // ---------- Vegetação ----------
    this.trees = [];
    for (let i = 0; i < 6000 && this.trees.length < 1800; i++) {
      const x = (rng() * 2 - 1) * HALF, z = (rng() * 2 - 1) * HALF;
      const y = this.heightAt(x, z);
      if (y < 2 || y > 62) continue;
      if (this._nearTown(x, z, 8)) continue;
      const dens = fbm2(x / 140, z / 140, 3);
      if (dens < -0.05 && rng() < 0.85) continue;
      const s = 0.8 + rng() * 0.7;
      const type = y > 30 || rng() < 0.55 ? 0 : 1; // 0 pinheiro, 1 árvore folhosa
      this.trees.push({ x, y, z, s, type, rot: rng() * Math.PI * 2 });
      this.circles.push({ x, z, r: 0.35 * s, y0: y - 1, y1: y + 7 * s, kind: 'tree' });
    }
    this.rocks = [];
    for (let i = 0; i < 700 && this.rocks.length < 380; i++) {
      const x = (rng() * 2 - 1) * HALF, z = (rng() * 2 - 1) * HALF;
      const y = this.heightAt(x, z);
      if (y < 0.5 || this._nearTown(x, z, 6)) continue;
      const s = 0.6 + Math.pow(rng(), 2) * 2.6;
      this.rocks.push({ x, y, z, s, rot: rng() * 6.28 });
      this.circles.push({ x, z, r: s * 0.85, y0: y - 1, y1: y + s * 1.1, kind: 'rock' });
    }
    this.bushes = [];
    for (let i = 0; i < 5000 && this.bushes.length < 2500; i++) {
      const x = (rng() * 2 - 1) * HALF, z = (rng() * 2 - 1) * HALF;
      const y = this.heightAt(x, z);
      if (y < 1.5 || y > 50 || this._nearTown(x, z, 2)) continue;
      this.bushes.push({ x, y, z, s: 0.5 + rng() * 0.8 });
    }

    // Loot espalhado no campo
    for (let i = 0; i < 160; i++) {
      const x = (rng() * 2 - 1) * HALF * 0.85, z = (rng() * 2 - 1) * HALF * 0.85;
      const y = this.heightAt(x, z);
      if (y < 1) continue;
      this.lootSpawns.push({ x, y, z });
    }

    this._buildGrid();
  }

  _nearTown(x, z, pad) { return this.towns.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + pad); }
  _slope(x, z) { return Math.abs(this.heightAt(x + 2, z) - this.heightAt(x - 2, z)) / 4 + Math.abs(this.heightAt(x, z + 2) - this.heightAt(x, z - 2)) / 4; }

  _flatten(cx, cz, r, y) {
    const N = GRID_N, R = r + 40;
    const i0 = Math.max(0, Math.floor((cx - R + HALF) / GRID_RES)), i1 = Math.min(N - 1, Math.ceil((cx + R + HALF) / GRID_RES));
    const j0 = Math.max(0, Math.floor((cz - R + HALF) / GRID_RES)), j1 = Math.min(N - 1, Math.ceil((cz + R + HALF) / GRID_RES));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i * GRID_RES - HALF, z = j * GRID_RES - HALF;
      const w = smooth(R, r, Math.hypot(x - cx, z - cz));
      this.h[j * N + i] = this.h[j * N + i] * (1 - w) + y * w;
    }
  }

  _buildTown(t, rng) {
    const placed = [];
    const count = 9 + ((rng() * 7) | 0);
    for (let k = 0, guard = 0; k < count && guard < 300; guard++) {
      const a = rng() * Math.PI * 2, dist = Math.sqrt(rng()) * (t.r - 12);
      const x = t.x + Math.cos(a) * dist, z = t.z + Math.sin(a) * dist;
      const big = rng() < 0.2;
      const w = big ? 16 + rng() * 6 : 8 + rng() * 5, d = big ? 12 + rng() * 4 : 7 + rng() * 4;
      if (placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + 5 && Math.abs(p.z - z) < (p.d + d) / 2 + 5)) continue;
      const floors = big ? 1 : rng() < 0.35 ? 2 : 1;
      const house = { x, z, w, d, y: t.y, floors, door: (rng() * 4) | 0, color: (rng() * 5) | 0, big };
      placed.push(house);
      this._buildHouse(house, rng);
      k++;
    }
  }

  // Casa oca: piso, 4 paredes (uma com porta), teto, (opcional) segundo andar com escada.
  _buildHouse(H, rng) {
    const T = 0.3, FH = 3.2, DOOR_W = 1.6, DOOR_H = 2.3;
    const x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2;
    const y0 = H.y, top = y0 + 0.2 + FH * H.floors;
    const id = this.houses.length;
    const add = (b) => { b.house = id; this.boxes.push(b); };
    add({ x0, z0, x1, z1, y0: y0 - 2, y1: y0 + 0.2, kind: 'floor' });
    // paredes: lado 0=norte(z0) 1=sul(z1) 2=oeste(x0) 3=leste(x1)
    const wall = (side) => {
      const along = side < 2;
      const a0 = along ? x0 : z0, a1 = along ? x1 : z1;
      const fixed = side === 0 ? z0 : side === 1 ? z1 - T : side === 2 ? x0 : x1 - T;
      const mk = (s0, s1, yy0, yy1) => along
        ? add({ x0: s0, x1: s1, z0: fixed, z1: fixed + T, y0: yy0, y1: yy1, kind: 'wall' })
        : add({ z0: s0, z1: s1, x0: fixed, x1: fixed + T, y0: yy0, y1: yy1, kind: 'wall' });
      if (side === H.door) {
        const mid = (a0 + a1) / 2;
        mk(a0, mid - DOOR_W / 2, y0, top);
        mk(mid + DOOR_W / 2, a1, y0, top);
        mk(mid - DOOR_W / 2, mid + DOOR_W / 2, y0 + 0.2 + DOOR_H, top);
        // janelas: aberturas no outro lado não — mantém simples
      } else {
        // parede com janela (abertura acima da cintura) — dá pra atirar de dentro
        const mid = (a0 + a1) / 2, ww = 1.4;
        const wy0 = y0 + 0.2 + 1.1, wy1 = y0 + 0.2 + 2.2;
        mk(a0, mid - ww / 2, y0, top);
        mk(mid + ww / 2, a1, y0, top);
        mk(mid - ww / 2, mid + ww / 2, y0, wy0);
        mk(mid - ww / 2, mid + ww / 2, wy1, top);
        H['win' + side] = { mid, ww, wy0, wy1 };
      }
    };
    for (let s = 0; s < 4; s++) wall(s);
    add({ x0: x0 - 0.3, z0: z0 - 0.3, x1: x1 + 0.3, z1: z1 + 0.3, y0: top, y1: top + 0.3, kind: 'roof' });
    const spawnsY = [y0 + 0.2];
    if (H.floors === 2) {
      // piso do 2º andar com abertura para escada (escada = rampa de degraus)
      const fy = y0 + 0.2 + FH;
      const sw = 1.4, sx0 = x1 - T - sw, slen = Math.min(H.d - 1.2, 6.5);
      add({ x0: x0, x1: sx0, z0, z1, y0: fy - 0.25, y1: fy, kind: 'floor2' });
      add({ x0: sx0, x1: x1, z0: z0 + slen + 0.2, z1, y0: fy - 0.25, y1: fy, kind: 'floor2' });
      const steps = 12;
      for (let s = 0; s < steps; s++) {
        const sz = z0 + T + (slen - T) * (s / steps), ez = sz + (slen - T) / steps;
        add({ x0: sx0, x1: x1 - T, z0: sz, z1: ez, y0: y0 + 0.2, y1: y0 + 0.2 + FH * ((s + 1) / steps), kind: 'stair' });
      }
      spawnsY.push(fy);
    }
    H.top = top;
    this.houses.push(H);
    for (const sy of spawnsY) {
      const n = 1 + ((rng() * 3) | 0);
      for (let k = 0; k < n; k++) {
        this.lootSpawns.push({ x: x0 + 1.2 + rng() * (H.w - 3.6), y: sy, z: z0 + 1.2 + rng() * (H.d - 2.4), indoor: true });
      }
    }
  }

  _buildGrid() {
    const C = 16; this.cell = C;
    const n = Math.ceil(MAP_SIZE / C) + 2; this.gn = n;
    this.grid = Array.from({ length: n * n }, () => []);
    const put = (ref, x0, z0, x1, z1) => {
      const i0 = this._ci(x0), i1 = this._ci(x1), j0 = this._ci(z0), j1 = this._ci(z1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grid[j * n + i].push(ref);
    };
    this.boxes.forEach((b, k) => put(k, b.x0, b.z0, b.x1, b.z1));
    this.circles.forEach((c, k) => put(~k, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r)); // ~k (negativo) = círculo
  }
  _ci(v) { return Math.max(0, Math.min(this.gn - 1, Math.floor((v + HALF) / this.cell) + 1)); }

  nearby(x, z, r, out = new Set()) {
    const n = this.gn, i0 = this._ci(x - r), i1 = this._ci(x + r), j0 = this._ci(z - r), j1 = this._ci(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (const k of this.grid[j * n + i]) out.add(k);
    return out;
  }

  heightAt(x, z) {
    const fx = Math.max(0, Math.min(GRID_N - 1.001, (x + HALF) / GRID_RES));
    const fz = Math.max(0, Math.min(GRID_N - 1.001, (z + HALF) / GRID_RES));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, N = GRID_N, h = this.h;
    const a = h[j * N + i], b = h[j * N + i + 1], c = h[(j + 1) * N + i], d = h[(j + 1) * N + i + 1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  // Altura do chão sob (x,z) considerando terreno + topo de caixas alcançáveis a partir de y.
  groundAt(x, z, y, r = PLAYER_RADIUS) {
    let g = this.heightAt(x, z);
    for (const k of this.nearby(x, z, r)) {
      if (k < 0) continue;
      const b = this.boxes[k];
      if (x + r * 0.5 > b.x0 && x - r * 0.5 < b.x1 && z + r * 0.5 > b.z0 && z - r * 0.5 < b.z1 && b.y1 <= y + STEP_HEIGHT && b.y1 > g) g = b.y1;
    }
    return g;
  }

  // Física de personagem compartilhada (jogador local e bots).
  moveBody(p, dt) {
    const r = PLAYER_RADIUS;
    p.x += p.vx * dt; p.z += p.vz * dt;
    for (let it = 0; it < 2; it++) {
      for (const k of this.nearby(p.x, p.z, r + 1)) {
        if (k >= 0) {
          const b = this.boxes[k];
          if (b.y1 <= p.y + STEP_HEIGHT || b.y0 >= p.y + PLAYER_HEIGHT) continue;
          const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
          let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 < 1e-8) { // dentro da caixa: empurra pelo menor eixo
              const ox = Math.min(p.x - b.x0, b.x1 - p.x), oz = Math.min(p.z - b.z0, b.z1 - p.z);
              if (ox < oz) p.x = p.x - b.x0 < b.x1 - p.x ? b.x0 - r : b.x1 + r; else p.z = p.z - b.z0 < b.z1 - p.z ? b.z0 - r : b.z1 + r;
            } else { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; }
          }
        } else {
          const c = this.circles[~k];
          if (c.y1 <= p.y + STEP_HEIGHT || c.y0 >= p.y + PLAYER_HEIGHT) continue;
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
          if (d < m && d > 1e-6) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; }
        }
      }
    }
    const lim = HALF - 2;
    p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));

    p.vy -= 22 * dt;
    let ny = p.y + p.vy * dt;
    // teto
    if (p.vy > 0) {
      for (const k of this.nearby(p.x, p.z, r)) {
        if (k < 0) continue; const b = this.boxes[k];
        if (p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1 && b.y0 >= p.y + PLAYER_HEIGHT - 0.05 && ny + PLAYER_HEIGHT > b.y0) { ny = b.y0 - PLAYER_HEIGHT; p.vy = 0; }
      }
    }
    const g = this.groundAt(p.x, p.z, p.y);
    if (ny <= g) { ny = g; p.vy = 0; p.onGround = true; } else p.onGround = ny - g < 0.05;
    // água: flutua
    if (ny < WATER_LEVEL - 1.3) { ny = WATER_LEVEL - 1.3; p.vy = Math.max(0, p.vy); p.swimming = true; } else p.swimming = ny < WATER_LEVEL - 0.9;
    p.y = ny;
  }

  // Raycast contra terreno, caixas e troncos. Retorna distância do primeiro impacto (ou maxDist).
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let best = maxDist;
    const seen = new Set();
    const step = 8;
    for (let t = 0; t <= Math.min(best, maxDist) + step; t += step) this.nearby(ox + dx * t, oz + dz * t, 1, seen);
    for (const k of seen) {
      if (k >= 0) {
        const b = this.boxes[k];
        const t = rayBox(ox, oy, oz, dx, dy, dz, b);
        if (t >= 0 && t < best) best = t;
      } else {
        const c = this.circles[~k];
        const t = rayCyl(ox, oy, oz, dx, dy, dz, c);
        if (t >= 0 && t < best) best = t;
      }
    }
    // terreno: marcha + bisseção
    const st = 1.5; let prev = 0;
    for (let t = st; t < best; t += st) {
      if (oy + dy * t < this.heightAt(ox + dx * t, oz + dz * t)) {
        let a = prev, b = t;
        for (let i = 0; i < 8; i++) { const m = (a + b) / 2; if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) b = m; else a = m; }
        best = Math.min(best, b); break;
      }
      prev = t;
    }
    return best;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.3;
  }

  randomLandPoint(rng, inner = 0.7) {
    for (let i = 0; i < 200; i++) {
      const x = (rng() * 2 - 1) * HALF * inner, z = (rng() * 2 - 1) * HALF * inner;
      if (this.heightAt(x, z) > 2) return { x, z };
    }
    return { x: 0, z: 0 };
  }
}

function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity;
  const ax = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
  for (const [o, d, lo, hi] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1;
  }
  if (tmax < 0) return -1;
  return tmin >= 0 ? tmin : -1; // origem dentro => ignora
}

function rayCyl(ox, oy, oz, dx, dy, dz, c) {
  const fx = ox - c.x, fz = oz - c.z;
  const a = dx * dx + dz * dz; if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - c.r * c.r;
  const disc = b * b - 4 * a * cc; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); if (t < 0) return -1;
  const y = oy + dy * t; if (y < c.y0 || y > c.y1) return -1;
  return t;
}

// Interseção raio x hitbox de jogador (corpo = cilindro, cabeça = esfera). Retorna {t, part} ou null.
export function rayPlayer(ox, oy, oz, dx, dy, dz, p) {
  let best = null;
  // cabeça
  const hx = p.x, hy = p.y + (p.crouch ? 1.15 : 1.62), hz = p.z, hr = 0.24;
  const lx = ox - hx, ly = oy - hy, lz = oz - hz;
  const b = lx * dx + ly * dy + lz * dz, c = lx * lx + ly * ly + lz * lz - hr * hr, disc = b * b - c;
  if (disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0) best = { t, part: 'head' }; }
  const t2 = rayCyl(ox, oy, oz, dx, dy, dz, { x: p.x, z: p.z, r: 0.38, y0: p.y, y1: p.y + (p.crouch ? 1.0 : 1.45) });
  if (t2 >= 0 && (!best || t2 < best.t)) best = { t: t2, part: 'body' };
  return best;
}

export const TOWN_NAMES = ['Porto Alto', 'Vila Serena', 'Pedra Negra', 'Campo Verde', 'Farol Sul', 'Usina Velha', 'Mirante', 'Baía Azul'];
