// Detecção automática de hardware + níveis gráficos + resolução dinâmica.
// Ideia: começar num nível estimado pelo hardware (GPU, núcleos, RAM, tela) e depois
// AJUSTAR EM TEMPO REAL pela taxa de quadros medida — assim um Celeron com DDR3 roda
// liso e uma RTX sobe sozinha até o nível Extremo (supersampling até 8K).

export const TIERS = [
  { id: 0, key: 'batata', name: 'Batata (PC muito fraco)', scaleMax: 0.6, scaleMin: 0.35, view: 260, shadows: 0, terrainSeg: 128, veg: 0.25, bushes: 0, sky: false, pbr: false, bloom: false, ao: false, ssr: false, smaa: false, aa: false, target: 30, fogDensity: 1 },
  { id: 1, key: 'baixo', name: 'Baixo', scaleMax: 0.8, scaleMin: 0.4, view: 420, shadows: 0, terrainSeg: 192, veg: 0.45, bushes: 0.3, sky: false, pbr: false, bloom: false, ao: false, ssr: false, smaa: false, aa: false, target: 40, fogDensity: 0.8 },
  { id: 2, key: 'medio', name: 'Médio', scaleMax: 1.0, scaleMin: 0.5, view: 650, shadows: 1024, terrainSeg: 256, veg: 0.7, bushes: 0.6, sky: true, pbr: true, bloom: false, ao: false, ssr: false, smaa: false, aa: true, target: 55, fogDensity: 0.6 },
  { id: 3, key: 'alto', name: 'Alto', scaleMax: 1.25, scaleMin: 0.6, view: 900, shadows: 2048, terrainSeg: 320, veg: 1, bushes: 1, sky: true, pbr: true, bloom: true, ao: false, ssr: false, smaa: false, aa: true, target: 58, fogDensity: 0.45 },
  { id: 4, key: 'ultra', name: 'Ultra', scaleMax: 1.5, scaleMin: 0.7, view: 1300, shadows: 4096, terrainSeg: 400, veg: 1, bushes: 1, sky: true, pbr: true, bloom: true, ao: true, ssr: false, smaa: true, aa: true, target: 58, fogDensity: 0.3 },
  { id: 5, key: 'extremo', name: 'Extremo (RT-style + até 8K)', scaleMax: 2.0, scaleMin: 0.8, view: 1600, shadows: 4096, terrainSeg: 400, veg: 1, bushes: 1, sky: true, pbr: true, bloom: true, ao: true, ssr: true, smaa: true, aa: true, target: 58, fogDensity: 0.25, supersample8k: true },
];

export function detectHardware() {
  const info = { gpu: 'desconhecida', vendor: '', cores: navigator.hardwareConcurrency || 2, mem: navigator.deviceMemory || null, webgl2: false, maxTex: 0, maxRB: 0, screenW: Math.round(screen.width * (devicePixelRatio || 1)), screenH: Math.round(screen.height * (devicePixelRatio || 1)), dpr: devicePixelRatio || 1, mobile: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) };
  try {
    const c = document.createElement('canvas');
    let gl = c.getContext('webgl2'); info.webgl2 = !!gl;
    if (!gl) gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      info.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      info.vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      info.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      info.maxRB = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      const vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS); info.maxViewport = vp ? Math.min(vp[0], vp[1]) : info.maxRB;
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } else info.noWebGL = true;
  } catch (e) { info.noWebGL = true; }
  info.score = scoreGPU(info.gpu);
  info.tier = pickTier(info);
  return info;
}

// Pontuação 0..5 a partir do nome da GPU
export function scoreGPU(name) {
  const g = String(name).toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/.test(g)) return 0;
  if (/gma|mali-[34]|mali-t[67]|adreno \(tm\) [2-4]\d\d|adreno [2-4]\d\d|powervr|videocore|sgx/.test(g)) return 0;
  // Intel integradas antigas (Celeron/Pentium/Core 2ª-6ª gen)
  if (/intel/.test(g) && /hd graphics/.test(g) && !/iris/.test(g)) return /hd graphics (4[0-9]{2}|5[0-9]{2}|6[0-9]{2}|4[4-6]00|5[0-9]00|6000)\b/.test(g) ? 1 : 0;
  if (/intel.*uhd/.test(g)) return 1;
  if (/iris\(r\) xe|iris xe/.test(g)) return 2;
  if (/iris/.test(g)) return 1;
  if (/intel.*arc/.test(g)) return /a7[0-9]{2}|b5[0-9]{2}|b7/.test(g) ? 4 : 3;
  if (/apple m\d (max|ultra)/.test(g)) return 5;
  if (/apple m[2-9]/.test(g)) return 4;
  if (/apple m1|apple gpu|apple/.test(g)) return 3;
  if (/rtx\s?50\d0|rtx\s?40[6-9]0|rtx\s?30[7-9]0|rx\s?7[89]00|rx\s?9070|rx\s?6[89]00/.test(g)) return 5;
  if (/rtx|rx\s?[67][0-9]{3}|radeon pro w/.test(g)) return 4;
  if (/gtx\s?16|gtx\s?10[6-8]0|gtx\s?9[78]0|rx\s?5[5-7]00|rx\s?5[78]0|rx\s?4[78]0|vega (56|64)|titan/.test(g)) return 3;
  if (/gtx|rx\s?[45][0-9]{2}|r9|radeon\(tm\) graphics|radeon graphics|vega|mx\s?[1-5]\d0/.test(g)) return 2;
  if (/geforce|radeon|nvidia|amd/.test(g)) return 1;
  if (/adreno|mali/.test(g)) return 1;
  return 1;
}

export function pickTier(info) {
  if (info.noWebGL) return 0;
  let t = info.score;
  if (info.cores <= 2) t = Math.min(t, 1);          // Celeron / Pentium dual-core
  else if (info.cores <= 4) t = Math.min(t, 3);
  if (info.mem && info.mem <= 2) t = Math.min(t, 0); // ~2 GB RAM
  else if (info.mem && info.mem <= 4) t = Math.min(t, 1);
  if (!info.webgl2) t = Math.min(t, 1);
  if (info.mobile) t = Math.min(t, 2);
  // Extremo só faz sentido em GPU de ponta (a parte 8K depende de tela/limite de buffer)
  if (t === 5 && info.cores < 6) t = 4;
  return Math.max(0, Math.min(5, t));
}

// Resolução dinâmica + troca automática de nível guiada por FPS.
export class AutoTuner {
  constructor(opts) {
    this.onScale = opts.onScale; this.onTier = opts.onTier; this.maxFn = opts.maxFn;
    this.tier = opts.tier; this.auto = true; this.dynRes = true;
    this.scale = this.max() * 0.85;
    this.frames = 0; this.acc = 0; this.fps = 60; this.low = 0; this.high = 0;
    this.failedUp = new Set();
    this.grace = 3; // segundos ignorados após mudanças (shaders compilando)
  }
  max() { return this.maxFn ? this.maxFn() : TIERS[this.tier].scaleMax; }
  setTier(t, user = false) {
    if (user) this.auto = false;
    this.tier = t; this.scale = Math.min(this.max(), Math.max(TIERS[t].scaleMin, this.scale));
    this.grace = 3; this.low = this.high = 0;
  }
  frame(dt) {
    this.frames++; this.acc += dt;
    if (this.acc < 1) return;
    this.fps = this.frames / this.acc; this.frames = 0; this.acc = 0;
    if (this.grace > 0) { this.grace--; return; }
    const T = TIERS[this.tier];
    const target = T.target;
    if (this.dynRes) {
      if (this.fps < target - 4 && this.scale > T.scaleMin) { this.scale = Math.max(T.scaleMin, this.scale * (this.fps < target * 0.6 ? 0.82 : 0.92)); this.onScale(this.scale); }
      else if (this.fps >= target + 1 && this.scale < this.max()) { this.scale = Math.min(this.max(), this.scale * 1.04); this.onScale(this.scale); }
    }
    if (!this.auto) return;
    // desce de nível se mesmo na resolução mínima não segura o FPS
    if (this.fps < target * 0.7 && (this.scale <= T.scaleMin + 0.001 || !this.dynRes)) this.low++; else this.low = Math.max(0, this.low - 1);
    if (this.low >= 4 && this.tier > 0) { this.failedUp.add(this.tier); this.low = 0; this.onTier(this.tier - 1, 'down'); return; }
    // sobe de nível se sobra desempenho com a resolução no máximo
    if (this.fps >= 57 && this.scale >= this.max() - 0.001) this.high++; else this.high = 0;
    if (this.high >= 8 && this.tier < 5 && !this.failedUp.has(this.tier + 1)) { this.high = 0; this.onTier(this.tier + 1, 'up'); }
  }
}
