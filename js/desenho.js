// Desenho dos carros em vista lateral (frente para a direita).
import { modelo } from './fisica.js';

// Contorno da carroceria: [x, altura] em frações do comprimento.
const CARROCERIAS = {
  hatch:  { corpo: [[0, .10], [0, .29], [.05, .355], [.46, .36], [.63, .25], [.96, .22], [1, .16], [1, .10]],
            vidro: [[.07, .27], [.09, .335], [.44, .34], [.58, .255]] },
  sedan:  { corpo: [[0, .10], [0, .22], [.2, .245], [.32, .345], [.6, .35], [.73, .245], [.97, .22], [1, .15], [1, .10]],
            vidro: [[.23, .25], [.33, .33], [.59, .335], [.69, .25]] },
  coupe:  { corpo: [[0, .10], [0, .20], [.14, .225], [.34, .31], [.55, .315], [.7, .22], [.98, .19], [1, .13], [1, .10]],
            vidro: [[.2, .228], [.35, .298], [.54, .302], [.65, .225]] },
  muscle: { corpo: [[0, .10], [0, .235], [.17, .245], [.3, .33], [.52, .335], [.62, .25], [.98, .235], [1, .17], [1, .10]],
            vidro: [[.21, .25], [.31, .318], [.51, .322], [.58, .252]] },
  pickup: { corpo: [[0, .10], [0, .25], [.4, .25], [.42, .36], [.62, .36], [.71, .265], [.97, .24], [1, .17], [1, .10]],
            vidro: [[.45, .265], [.46, .345], [.61, .345], [.67, .268]] },
};
const RODAS = [.19, .8];

function escurecer(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

// x,y = canto traseiro no chão; L = comprimento em pixels.
export function desenharCarro(ctx, carro, x, y, L, op = {}) {
  const m = modelo(carro.modelo);
  const forma = CARROCERIAS[m.tipo];
  const ups = carro.ups || {};
  const baixa = (ups.suspensao || 0) * 0.012;
  const raio = 0.085 * L;
  const px = fx => x + fx * L;
  const py = fh => y - (fh - baixa) * L;
  const cor = carro.cor || m.cor;

  ctx.save();
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x + L / 2, y + 2, L * 0.52, L * 0.035, 0, 0, Math.PI * 2); ctx.fill();

  // carroceria
  const grad = ctx.createLinearGradient(0, py(.36), 0, py(.1));
  grad.addColorStop(0, escurecer(cor, 1.25)); grad.addColorStop(.55, cor); grad.addColorStop(1, escurecer(cor, .6));
  ctx.fillStyle = grad;
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = Math.max(1, L / 120);
  ctx.beginPath();
  forma.corpo.forEach(([a, b], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(a), py(b)));
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // vidros
  ctx.fillStyle = 'rgba(30,50,70,.85)';
  ctx.beginPath();
  forma.vidro.forEach(([a, b], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, px(a), py(b)));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();

  // friso, maçaneta, faróis
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, L / 200);
  ctx.beginPath(); ctx.moveTo(px(.03), py(.17)); ctx.lineTo(px(.97), py(.17)); ctx.stroke();
  ctx.fillStyle = '#fefcbf'; ctx.fillRect(px(.975), py(.2), L * .025, L * .03);
  ctx.fillStyle = '#e53e3e'; ctx.fillRect(px(0), py(.25), L * .02, L * .035);

  // faixas de corrida para carros bem preparados
  if ((ups.motor || 0) + (ups.turbo || 0) >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillRect(px(.08), py(.15), L * .84, L * .012);
    ctx.fillRect(px(.08), py(.128), L * .84, L * .006);
  }

  // aerofólio
  if (ups.aerofolio) {
    ctx.fillStyle = escurecer(cor, .5);
    const topo = forma.corpo[2][1];
    ctx.fillRect(px(.02), py(topo + .02), L * .03, L * .03);
    ctx.fillRect(px(.07), py(topo + .02), L * .03, L * .03);
    ctx.fillStyle = '#111';
    ctx.fillRect(px(-.01), py(topo + .055), L * .14, L * .025);
  }

  // escapamento + fogo do nitro
  ctx.fillStyle = '#555';
  ctx.fillRect(px(-.025), py(.12), L * .04, L * .018);
  if (op.nitro) {
    const f = L * (.12 + Math.random() * .08);
    const g2 = ctx.createLinearGradient(px(-.02) - f, 0, px(-.02), 0);
    g2.addColorStop(0, 'rgba(80,160,255,0)'); g2.addColorStop(1, 'rgba(140,210,255,.95)');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.moveTo(px(-.02), py(.14)); ctx.lineTo(px(-.02) - f, py(.111)); ctx.lineTo(px(-.02), py(.1)); ctx.fill();
  }

  // rodas
  for (const rx of RODAS) {
    const cx = px(rx), cy = y - raio;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx, cy, raio * 1.12, Math.PI, 0); ctx.fill(); // caixa de roda
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.arc(cx, cy, raio, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (ups.pneus || 0) >= 2 ? '#d69e2e' : '#a0aec0';
    ctx.beginPath(); ctx.arc(cx, cy, raio * .6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2d3748'; ctx.lineWidth = Math.max(1, L / 150);
    const ang = op.roda || 0;
    for (let i = 0; i < 5; i++) {
      const a = ang + i * Math.PI * 2 / 5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * raio * .58, cy + Math.sin(a) * raio * .58); ctx.stroke();
    }
    ctx.fillStyle = '#2d3748'; ctx.beginPath(); ctx.arc(cx, cy, raio * .15, 0, Math.PI * 2); ctx.fill();
  }

  // fumaça de pneu patinando
  if (op.fumaca) {
    const tracao = m.tracao === 'T' ? RODAS[0] : RODAS[1];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(220,220,220,${0.12 + Math.random() * .2})`;
      ctx.beginPath();
      ctx.arc(px(tracao) - Math.random() * L * .5, y - Math.random() * raio * 2, raio * (0.6 + Math.random()), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// Desenha um carro centralizado num canvas.
export function desenharVitrine(canvas, carro, fundo = true) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || 140;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (fundo) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2a3140'); g.addColorStop(1, '#151a22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a404c'; ctx.fillRect(0, h * .82, w, h * .18);
    ctx.fillStyle = '#f6e05e';
    for (let i = 0; i < w; i += 40) ctx.fillRect(i, h * .82, 20, 3);
  }
  const L = Math.min(w * .82, h * 2.2);
  desenharCarro(ctx, carro, (w - L) / 2, h * .84, L);
}
