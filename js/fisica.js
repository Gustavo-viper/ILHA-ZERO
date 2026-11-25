// Modelo do motor, dinamômetro e física da arrancada.
import { MODELOS, TURBOS } from './data.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const RAIO_RODA = 0.31;
const EFICIENCIA = 0.86;
export const DISTANCIA = 402.336; // 1/4 de milha

export function modelo(id) { return MODELOS.find(m => m.id === id); }

// Curva de torque relativa (pico = 1) em função da rotação.
function torqueRel(m, rpm) {
  const picoTq = m.pico * 0.74;
  const d = (rpm - picoTq) / m.redline;
  return Math.max(0.25, 1 - 2.1 * d * d);
}

// Escala o torque para que o pico de potência dê o cv de fábrica.
const escalaCache = {};
function torqueBase(m) {
  if (escalaCache[m.id]) return escalaCache[m.id];
  let max = 0;
  for (let r = 1000; r <= m.redline; r += 25) max = Math.max(max, torqueRel(m, r) * r / 7022);
  return (escalaCache[m.id] = m.hp / max);
}

function suave(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

export function mapaPadrao(carro) {
  const t = carro.ups.turbo > 0 ? TURBOS[carro.ups.turbo - 1] : null;
  return { boost: t ? +(t.max * 0.5).toFixed(2) : 0, ign: 0, afr: t ? 11.8 : 13.0 };
}

// Tudo o que é preciso para simular o carro, considerando peças e upgrades.
export function specs(carro) {
  const m = modelo(carro.modelo);
  const u = carro.ups, p = carro.partes;
  const condMotor = (p.motor * 0.5 + p.velas * 0.2 + p.filtroAr * 0.15 + p.oleo * 0.15) / 100;
  const turbo = u.turbo > 0 ? TURBOS[u.turbo - 1] : null;
  const mapa = u.ecu > 0 && carro.ecu ? carro.ecu : mapaPadrao(carro);
  const boost = turbo ? clamp(mapa.boost, 0, turbo.max) : 0;
  const ign = clamp(mapa.ign, -6, 8);
  const afr = clamp(mapa.afr, 10.5, 15.5);
  const melhorAfr = boost > 0 ? 12.5 : 13.1;
  const multIgn = 1 + 0.012 * ign - 0.0015 * Math.max(0, ign - 4) ** 2;
  const multAfr = 1 - 0.03 * (afr - melhorAfr) ** 2;
  const mult = (0.55 + 0.45 * condMotor)
    * (1 + [0, 0.08, 0.18, 0.30][u.motor])
    * (1 + 0.04 * u.admissao) * (1 + 0.05 * u.escape)
    * (0.88 + 0.12 * p.escapamento / 100)
    * multIgn * multAfr;
  const detonacao = boost * 0.6 + Math.max(0, ign) * 0.08 + Math.max(0, afr - 11.8) * 0.25 * (1 + boost);
  const limite = 1 + 0.3 * u.motor;
  const peso = m.peso * (1 - [0, 0.06, 0.12][u.peso]) + (turbo ? 25 : 0) + (u.nitro ? 15 : 0);
  const gripPneu = [1.0, 1.12, 1.25, 1.42][u.pneus] * (0.6 + 0.4 * p.pneus / 100);
  const fracTracao = (m.tracao === 'T' ? 0.56 : 0.52) + 0.035 * u.suspensao * (m.tracao === 'T' ? 1 : -0.3) * (0.5 + p.amortecedores / 200);
  return {
    m, mult, boost, ign, afr, turbo, detonacao, limite,
    tqBase: torqueBase(m),
    redline: m.redline + u.motor * 250,
    peso,
    tracao: gripPneu * peso * 9.81 * fracTracao,
    troca: [0.5, 0.32, 0.18][u.cambio],
    nitro: u.nitro > 0,
    embreagem: 0.55 + 0.45 * Math.min(1, p.embreagem / 60),
    marchas: m.marchas, final: m.final, cd: m.cd, area: m.area,
  };
}

export function torque(sp, rpm) {
  if (rpm < 700) return 0;
  let t = torqueRel(sp.m, Math.min(rpm, sp.m.redline)) * sp.tqBase * sp.mult;
  if (rpm > sp.m.redline) t *= 1 - (rpm - sp.m.redline) / 2500; // acima do original cai
  if (sp.turbo) t *= 1 + sp.boost * 0.85 * suave(sp.turbo.enche[0] * sp.redline, sp.turbo.enche[1] * sp.redline, rpm);
  return t;
}
export const potencia = (sp, rpm) => torque(sp, rpm) * rpm / 7022;

export function curva(sp) {
  const pts = [];
  let picoCv = 0, picoTq = 0, rpmCv = 0;
  for (let r = 1000; r <= sp.redline; r += 100) {
    const tq = torque(sp, r), cv = tq * r / 7022;
    pts.push({ rpm: r, tq, cv });
    if (cv > picoCv) { picoCv = cv; rpmCv = r; }
    picoTq = Math.max(picoTq, tq);
  }
  return { pts, picoCv, picoTq, rpmCv };
}

// Rotação ideal de troca para cada marcha (onde a força na próxima marcha passa a ser maior).
export function rotacoesTroca(sp) {
  const res = [];
  for (let g = 0; g < sp.marchas.length - 1; g++) {
    const a = sp.marchas[g], b = sp.marchas[g + 1];
    let ideal = sp.redline - 100;
    for (let r = 2500; r < sp.redline; r += 50) {
      if (torque(sp, r) * a < torque(sp, r * b / a) * b) { ideal = r; break; }
    }
    res.push(ideal);
  }
  return res;
}

// Rotação de largada que coloca a força perto do limite de aderência.
export function rotacaoLargada(sp) {
  const g = sp.marchas[0] * sp.final;
  let melhor = 2500;
  for (let r = 1500; r < sp.redline; r += 50) {
    melhor = r;
    if (torque(sp, r) * g * EFICIENCIA / RAIO_RODA * sp.embreagem > sp.tracao * 1.05) break;
  }
  return clamp(melhor, 1800, sp.redline - 300);
}

export function criarSim(sp) {
  return { sp, v: 0, x: 0, marcha: 0, rpm: 900, deslize: 0, trocaT: 0, nitroT: 0, nitroUsado: false, t: 0,
    largou: false, patinando: false, fim: null, vmax: 0, t100: null, roda: 0, limitador: false };
}

export function passo(s, dt, gas) {
  const sp = s.sp;
  if (!s.largou) {
    s.rpm += gas ? 7000 * dt : -5000 * dt;
    if (s.rpm > sp.redline) s.rpm = sp.redline - 400; // corte de giro
    s.rpm = Math.max(900, s.rpm);
    s.limitador = s.rpm > sp.redline - 450;
    return;
  }
  s.t += dt;
  const g = sp.marchas[s.marcha] * sp.final;
  const rpmRoda = s.v / RAIO_RODA * 60 / (2 * Math.PI) * g;
  let forca = 0;
  if (s.trocaT > 0) {
    s.trocaT -= dt;
    s.rpm += (Math.max(rpmRoda, 1000) - s.rpm) * Math.min(1, dt * 12);
  } else {
    if (gas && s.marcha === 0 && rpmRoda < 1600) s.deslize = Math.max(s.deslize, 1600);
    let rpm = Math.max(rpmRoda, s.deslize, 800);
    s.limitador = rpm >= sp.redline;
    let tq = gas && !s.limitador ? torque(sp, rpm) : -15;
    if (s.nitroT > 0 && gas) { tq *= 1.4; s.nitroT -= dt; }
    forca = tq * g * EFICIENCIA / RAIO_RODA * sp.embreagem;
    if (forca > sp.tracao) {
      s.patinando = true;
      forca = sp.tracao * 0.82;
      s.deslize = Math.min(sp.redline, rpm + 2500 * dt);
    } else {
      s.patinando = false;
      s.deslize = Math.max(0, s.deslize - (s.deslize > rpmRoda ? 1800 : 5000) * dt);
    }
    if (rpm >= sp.redline) s.deslize = Math.min(s.deslize, sp.redline - 200);
    s.rpm = rpm;
  }
  const arrasto = 0.5 * 1.2 * sp.cd * sp.area * s.v * s.v + 0.015 * sp.peso * 9.81;
  s.v = Math.max(0, s.v + (forca - arrasto) / sp.peso * dt);
  s.x += s.v * dt;
  s.roda += s.v * dt / RAIO_RODA + (s.patinando ? 30 * dt : 0);
  s.vmax = Math.max(s.vmax, s.v);
  if (s.t100 === null && s.v >= 100 / 3.6) s.t100 = s.t;
  if (s.fim === null && s.x >= DISTANCIA) s.fim = s.t;
}

export function trocar(s) {
  if (!s.largou || s.trocaT > 0 || s.marcha >= s.sp.marchas.length - 1) return false;
  s.marcha++;
  s.trocaT = s.sp.troca;
  s.deslize = 0;
  return true;
}

export function nitro(s) {
  if (!s.sp.nitro || s.nitroUsado || !s.largou) return false;
  s.nitroUsado = true; s.nitroT = 3;
  return true;
}

// Piloto automático usado pelos rivais (e pelo teste rápido de tempo).
export function criarPiloto(sp, habilidade = 1) {
  return { trocas: rotacoesTroca(sp).map(r => r * (0.97 + 0.03 * habilidade)), largada: rotacaoLargada(sp) * (0.9 + 0.1 * habilidade), reacao: 0.12 + (1 - habilidade) * 0.25 };
}
export function pilotar(s, p) {
  if (!s.largou) return s.rpm < p.largada;
  if (s.trocaT <= 0 && s.marcha < p.trocas.length && s.rpm >= p.trocas[s.marcha]) trocar(s);
  if (s.sp.nitro && !s.nitroUsado && s.marcha >= 1 && s.trocaT <= 0) nitro(s);
  return true;
}

// Simulação completa sem tela (para estimar tempo).
export function simularTempo(sp) {
  const s = criarSim(sp), p = criarPiloto(sp, 1);
  for (let i = 0; i < 120; i++) passo(s, 1 / 60, pilotar(s, p));
  s.largou = true;
  while (s.fim === null && s.t < 60) passo(s, 1 / 120, pilotar(s, p));
  return { tempo: s.fim ?? 60, vmax: s.vmax * 3.6, t100: s.t100 };
}
