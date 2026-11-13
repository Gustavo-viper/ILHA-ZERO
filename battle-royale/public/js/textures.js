// Texturas procedurais (geradas no navegador, sem baixar imagens).
import * as THREE from 'three';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ruído de valor periódico (tileável) em grade S
function tileNoise(S, cells, seed) {
  const r = rng(seed), g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const fx = (x / S) * cells, fy = (y / S) * cells, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)];
    const c = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
    out[y * S + x] = (a + (b - a) * su) * (1 - sv) + (c + (d - c) * su) * sv;
  }
  return out;
}
function fbm(S, base, oct, seed) {
  const out = new Float32Array(S * S); let amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) { const n = tileNoise(S, base << o, seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; norm += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
function canvas(S) { const c = document.createElement('canvas'); c.width = c.height = S; return c; }
function finish(cv, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// pinta pixels a partir de uma função (x,y,i) -> [r,g,b,a]
function paint(S, fn) {
  const cv = canvas(S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const i = y * S + x, c = fn(x, y, i); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = c[3] ?? 255; }
  ctx.putImageData(img, 0, 0);
  return { cv, ctx };
}
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(255, v));

export function makeTextures(size = 512) {
  const S = size, T = {};
  const n1 = fbm(S, 4, 6, 11), n2 = fbm(S, 16, 4, 23), n3 = fbm(S, 8, 5, 37);
  const r = rng(99);

  // ---- grama do chão (capim seco/oliva, como campos abertos) ----
  {
    const { cv, ctx } = paint(S, (x, y, i) => {
      const t = n1[i], f = n2[i];
      const g = [mix(98, 150, t) * (0.75 + f * 0.5), mix(110, 140, t) * (0.75 + f * 0.5), mix(48, 62, t) * (0.7 + f * 0.4)];
      return g.map(clamp);
    });
    // fiapos de capim
    for (let k = 0; k < S * 9; k++) {
      const x = r() * S, y = r() * S, len = 3 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
      const dry = r();
      ctx.strokeStyle = `rgba(${(140 + dry * 70) | 0},${(130 + dry * 40) | 0},${(60 + dry * 20) | 0},${0.25 + r() * 0.35})`;
      ctx.lineWidth = 0.6 + r() * 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    }
    T.grass = finish(cv);
  }
  // ---- terra / chão batido ----
  {
    const { cv, ctx } = paint(S, (x, y, i) => {
      const t = n3[i], f = n2[i];
      return [mix(92, 140, t) * (0.8 + f * 0.35), mix(74, 110, t) * (0.8 + f * 0.35), mix(52, 76, t) * (0.8 + f * 0.3)].map(clamp);
    });
    for (let k = 0; k < S * 2; k++) { const x = r() * S, y = r() * S, s = 0.6 + r() * 2.2, v = 60 + r() * 110; ctx.fillStyle = `rgba(${v},${v * 0.92},${v * 0.8},${0.35 + r() * 0.5})`; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); }
    T.dirt = finish(cv);
  }
  // ---- rocha ----
  {
    const { cv, ctx } = paint(S, (x, y, i) => { const t = n1[i] * 0.6 + n2[i] * 0.4; const v = mix(85, 160, t); return [v, v * 0.98, v * 0.93].map(clamp); });
    ctx.strokeStyle = 'rgba(40,40,38,.35)';
    for (let k = 0; k < 40; k++) { ctx.lineWidth = 0.5 + r(); ctx.beginPath(); let x = r() * S, y = r() * S; ctx.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; ctx.lineTo(x, y); } ctx.stroke(); }
    T.rock = finish(cv);
  }
  // ---- areia ----
  T.sand = finish(paint(S, (x, y, i) => { const t = n2[i] * 0.7 + n1[i] * 0.3; return [mix(196, 226, t), mix(178, 206, t), mix(128, 156, t)].map(clamp); }).cv);

  // ---- parede de tábuas de madeira pintada (desbotada) — tingida pela cor da casa ----
  {
    const cv = canvas(S), ctx = cv.getContext('2d');
    const boards = 8, bh = S / boards;
    for (let b = 0; b < boards; b++) {
      const v = 200 + r() * 40; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(0, b * bh, S, bh);
      // veios
      for (let k = 0; k < 30; k++) { const yy = b * bh + r() * bh; ctx.strokeStyle = `rgba(90,80,70,${0.05 + r() * 0.08})`; ctx.lineWidth = 0.5 + r() * 1.5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(S * 0.3, yy + (r() - 0.5) * 4, S * 0.6, yy + (r() - 0.5) * 4, S, yy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(30,25,20,.55)'; ctx.fillRect(0, b * bh + bh - 3, S, 3); // fresta
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0, b * bh, S, 1.5);
    }
    // tinta descascando / sujeira
    const img = ctx.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < S * S; i++) { const dirt = n3[i]; const peel = n2[i] > 0.68 ? 0.55 : 1; const k = (0.72 + dirt * 0.4) * peel; d[i * 4] = clamp(d[i * 4] * k + (peel < 1 ? 40 : 0)); d[i * 4 + 1] = clamp(d[i * 4 + 1] * k + (peel < 1 ? 25 : 0)); d[i * 4 + 2] = clamp(d[i * 4 + 2] * k); }
    // escorrido na parte de baixo
    ctx.putImageData(img, 0, 0);
    const gr = ctx.createLinearGradient(0, S * 0.7, 0, S); gr.addColorStop(0, 'rgba(60,50,35,0)'); gr.addColorStop(1, 'rgba(60,50,35,.35)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
    T.wood = finish(cv);
  }
  // ---- reboco / concreto ----
  {
    const { cv, ctx } = paint(S, (x, y, i) => { const v = mix(185, 235, n2[i] * 0.6 + n1[i] * 0.4) * (n3[i] > 0.7 ? 0.82 : 1); return [v, v * 0.98, v * 0.94].map(clamp); });
    for (let k = 0; k < 25; k++) { const x = r() * S, w = 2 + r() * 6; const g = ctx.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(70,60,50,.18)'); g.addColorStop(1, 'rgba(70,60,50,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, w, S * (0.2 + r() * 0.5)); }
    T.plaster = finish(cv);
  }
  // ---- telha cerâmica ----
  {
    const cv = canvas(S), ctx = cv.getContext('2d'); const rows = 10, cols = 8, rh = S / rows, cw = S / cols;
    ctx.fillStyle = '#5a2e1c'; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ox = (y % 2) * cw / 2, v = 0.75 + r() * 0.35;
      const g = ctx.createLinearGradient(0, y * rh, 0, y * rh + rh); g.addColorStop(0, `rgb(${170 * v},${82 * v},${50 * v})`); g.addColorStop(1, `rgb(${110 * v},${50 * v},${30 * v})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x * cw + ox - cw / 2 + 1, y * rh, cw - 2, rh - 1, 6) : ctx.rect(x * cw + ox - cw / 2 + 1, y * rh, cw - 2, rh - 1); ctx.fill();
      ctx.fillRect(x * cw + ox + cw / 2 + 1 - S, y * rh, 0, 0);
    }
    const img = ctx.getImageData(0, 0, S, S), d = img.data; for (let i = 0; i < S * S; i++) { const k = 0.75 + n1[i] * 0.4; d[i * 4] = clamp(d[i * 4] * k); d[i * 4 + 1] = clamp(d[i * 4 + 1] * k); d[i * 4 + 2] = clamp(d[i * 4 + 2] * k); }
    ctx.putImageData(img, 0, 0);
    T.tiles = finish(cv);
  }
  // ---- telha de zinco ondulada com ferrugem ----
  {
    const { cv } = paint(S, (x, y, i) => {
      const wave = Math.sin((x / S) * Math.PI * 2 * 14) * 0.5 + 0.5;
      const rust = Math.max(0, n3[i] - 0.55) * 2.2;
      const v = mix(110, 175, wave) * (0.85 + n2[i] * 0.3);
      return [mix(v, 130, rust), mix(v, 70, rust), mix(v * 1.03, 40, rust)].map(clamp);
    });
    T.metal = finish(cv);
  }
  // ---- tecido camuflado ----
  {
    const n = fbm(256, 6, 4, 77), m = fbm(256, 6, 4, 91);
    T.camo = finish(paint(256, (x, y, i) => {
      const a = n[i], b = m[i];
      const c = a > 0.58 ? [74, 70, 52] : b > 0.6 ? [128, 116, 88] : a < 0.38 ? [46, 44, 36] : [150, 140, 112];
      const k = 0.9 + ((x * 7 + y * 13) % 5) / 40; return c.map((v) => clamp(v * k));
    }).cv);
  }
  // ---- nuvens (alfa) ----
  {
    const C = 512, n = fbm(C, 4, 6, 555), sh = fbm(C, 8, 4, 777);
    T.clouds = finish(paint(C, (x, y, i) => { const c = Math.max(0, (n[i] - 0.5) * 3.2); const a = Math.min(1, c) * 255; const v = 255 - sh[i] * 50 * Math.min(1, c * 1.5); return [v, v, Math.min(255, v + 6), a]; }).cv);
  }
  // ---- lâminas de capim (alfa recortado) ----
  {
    const C = 256, cv = canvas(C), ctx = cv.getContext('2d');
    for (let k = 0; k < 34; k++) {
      const x = 10 + r() * (C - 20), h = C * (0.45 + r() * 0.55), lean = (r() - 0.5) * 50, w = 3 + r() * 4, dry = r();
      const g = ctx.createLinearGradient(0, C, 0, C - h);
      g.addColorStop(0, `rgb(${(60 + dry * 30) | 0},${(70 + dry * 20) | 0},${30})`);
      g.addColorStop(1, `rgb(${(170 + dry * 60) | 0},${(160 + dry * 30) | 0},${(80 + dry * 10) | 0})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w / 2, C); ctx.quadraticCurveTo(x + lean * 0.3, C - h * 0.6, x + lean, C - h); ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.3, C - h * 0.6, x + w / 2, C); ctx.fill();
    }
    const t = finish(cv, false); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; T.grassBlade = t;
  }
  // ---- folhagem (alfa) para copas ----
  {
    const C = 256, cv = canvas(C), ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgb(170,180,150)'; ctx.fillRect(0, 0, C, C);
    for (let k = 0; k < 1400; k++) { const x = r() * C, y = r() * C, s = 2 + r() * 5, v = 0.55 + r() * 0.5; ctx.fillStyle = `rgb(${(210 * v) | 0},${(230 * v) | 0},${(180 * v) | 0})`; ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.6, r() * 3, 0, 7); ctx.fill(); }
    T.foliage = finish(cv);
  }
  // ---- casca de árvore ----
  T.bark = finish(paint(128, (x, y, i) => { const s = Math.sin(x * 0.5 + Math.sin(y * 0.08) * 3) * 0.5 + 0.5; const v = 50 + s * 45; return [v * 1.1, v * 0.85, v * 0.6].map(clamp); }).cv);
  return T;
}
