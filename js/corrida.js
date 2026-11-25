// Tela da arrancada de 1/4 de milha.
import { RIVAIS } from './data.js';
import { S, salvar, novoCarro, aplicarDetonacao, desgastarCorrida } from './estado.js';
import { specs, criarSim, passo, trocar, nitro, criarPiloto, pilotar, rotacoesTroca, rotacaoLargada, DISTANCIA } from './fisica.js';
import { desenharCarro } from './desenho.js';
import { $, dinheiro, esc, abrirModal, fecharModal, aviso } from './ui.js';
import { motorLigar, motorRpm, motorDesligar, bip, dinheiro as somDinheiro, erro } from './som.js';

const COMPRIMENTO = 4.2;

export function iniciarCorrida(carro, idxRival, aoSair) {
  const cilindros = c => ({ corsario: 8, raio: 6 }[c.modelo] || 4);
  const rival = idxRival === null ? null : RIVAIS[idxRival];
  if (rival) { S.dinheiro -= rival.entrada; salvar(); }

  const sp = specs(carro);
  const eu = criarSim(sp);
  const trocasIdeais = rotacoesTroca(sp), largadaIdeal = rotacaoLargada(sp);
  let rc = null, ele = null, piloto = null;
  if (rival) {
    rc = novoCarro(rival.modelo, rival.cond || 100, rival.cond || 100);
    Object.assign(rc.ups, rival.ups);
    if (rival.ecu) rc.ecu = { ...rival.ecu };
    const spR = specs(rc);
    ele = criarSim(spR);
    piloto = criarPiloto(spR, 0.86 + idxRival * 0.02);
  }

  document.body.classList.add('correndo');
  const tela = $('#tela');
  tela.classList.add('cheia');
  tela.onclick = null;
  tela.innerHTML = `<canvas id="pista"></canvas>
    <button id="btn-sair">✕ Sair</button>
    <div class="controles-corrida">
      <button id="btn-gas">ACELERAR</button>
      <div class="meio-corrida">${sp.nitro ? '<button id="btn-nitro">NITRO</button>' : ''}<button id="btn-troca">MARCHA ▲</button></div>
    </div>`;
  const cv = $('#pista'), ctx = cv.getContext('2d');
  let w = 0, h = 0;
  function redimensionar() {
    const dpr = window.devicePixelRatio || 1;
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);

  let gas = false, fase = 'pre', tFase = 0, verdeEm = 2.6 + Math.random() * 0.7, raf = 0, ultimo = performance.now(), acum = 0;
  let msg = null, encerrado = false, resultado = null;
  const flutuar = (txt, cor) => { msg = { txt, cor, t: 1.2 }; };

  const btnGas = $('#btn-gas');
  const gasOn = e => { e.preventDefault(); gas = true; btnGas.classList.add('on'); };
  const gasOff = e => { e.preventDefault(); gas = false; btnGas.classList.remove('on'); };
  btnGas.addEventListener('pointerdown', gasOn);
  btnGas.addEventListener('pointerup', gasOff);
  btnGas.addEventListener('pointercancel', gasOff);
  btnGas.addEventListener('pointerleave', gasOff);
  const fazerTroca = () => {
    const rpm = eu.rpm, ideal = trocasIdeais[eu.marcha];
    if (!trocar(eu)) return;
    bip(300, 0.04, 'square', 0.05);
    if (ideal) {
      const d = rpm - ideal;
      if (Math.abs(d) < 300) flutuar('TROCA PERFEITA!', '#48bb78');
      else if (d < 0) flutuar('Cedo demais', '#f6e05e');
      else flutuar('Passou do ponto', '#f6993f');
    }
  };
  const fazerNitro = () => { if (nitro(eu)) { bip(90, 0.4, 'sawtooth', 0.1); $('#btn-nitro').disabled = true; } };
  atualizar.ultLuz = -1;
  $('#btn-troca').addEventListener('pointerdown', e => { e.preventDefault(); fazerTroca(); });
  if (sp.nitro) $('#btn-nitro').addEventListener('pointerdown', e => { e.preventDefault(); fazerNitro(); });
  $('#btn-sair').onclick = () => sair(true);
  const tecla = e => {
    if (e.repeat && e.type === 'keydown' && e.code !== 'Space' && e.code !== 'ArrowUp') return;
    const down = e.type === 'keydown';
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); gas = down; btnGas.classList.toggle('on', down); }
    else if (down && (e.code === 'ArrowRight' || e.code === 'Enter' || e.code === 'ShiftLeft' || e.code === 'ShiftRight')) { e.preventDefault(); fazerTroca(); }
    else if (down && e.code === 'KeyN') fazerNitro();
  };
  window.addEventListener('keydown', tecla);
  window.addEventListener('keyup', tecla);
  motorLigar(cilindros(carro));

  function sair(desistiu) {
    if (encerrado) return;
    encerrado = true;
    cancelAnimationFrame(raf);
    motorDesligar();
    window.removeEventListener('keydown', tecla);
    window.removeEventListener('keyup', tecla);
    window.removeEventListener('resize', redimensionar);
    document.body.classList.remove('correndo');
    tela.classList.remove('cheia');
    if (desistiu && rival && !resultado) aviso('Você desistiu e perdeu a entrada.');
    aoSair();
  }

  function finalizar() {
    fase = 'fim';
    motorDesligar();
    const meu = eu.fim;
    const dele = ele ? ele.fim : null;
    const venceu = rival ? meu < dele : null;
    desgastarCorrida(carro);
    const dano = aplicarDetonacao(carro, sp);
    const novoRecorde = !carro.recorde || meu < carro.recorde;
    if (novoRecorde) carro.recorde = meu;
    S.stats.corridas++;
    let premio = 0;
    if (venceu) {
      premio = rival.premio; S.dinheiro += premio; S.stats.vitorias++;
      S.rivalVencido = Math.max(S.rivalVencido, idxRival);
      S.rep = Math.min(5, S.rep + 0.05);
      somDinheiro();
    } else if (rival) erro();
    salvar();
    resultado = { meu, dele, venceu, premio };
    setTimeout(() => {
      abrirModal(`<h2>${rival ? (venceu ? '🏆 Vitória!' : '😤 Derrota') : '🏁 Treino'}</h2>
        <table class="recibo">
          <tr><td>Seu tempo</td><td><b>${meu.toFixed(3)} s</b>${novoRecorde ? ' 🆕' : ''}</td></tr>
          ${rival ? `<tr><td>${esc(rival.nome)}</td><td>${dele.toFixed(3)} s</td></tr>` : ''}
          <tr><td>0 a 100 km/h</td><td>${eu.t100 ? eu.t100.toFixed(2) + ' s' : '—'}</td></tr>
          <tr><td>Velocidade final</td><td>${Math.round(eu.vmax * 3.6)} km/h</td></tr>
          ${venceu ? `<tr><td>Prêmio</td><td style="color:var(--verde)">${dinheiro(premio)}</td></tr>` : ''}
          ${rival && !venceu ? `<tr class="ruim"><td>Entrada perdida</td><td>-${dinheiro(rival.entrada)}</td></tr>` : ''}
          ${dano ? `<tr class="ruim"><td>Detonação danificou o motor</td><td>-${dano}%</td></tr>` : ''}
        </table>
        <div class="botoes"><button class="btn pri largo" id="ok">Voltar</button></div>`);
      $('#ok').onclick = () => { fecharModal(); sair(false); };
    }, 900);
  }

  function atualizar(dt) {
    tFase += dt;
    if (fase === 'pre') {
      passo(eu, dt, gas);
      if (ele) passo(ele, dt, pilotar(ele, piloto));
      if (tFase >= verdeEm) {
        fase = 'corrida'; tFase = 0;
        eu.largou = true; eu.deslize = eu.rpm;
        bip(990, 0.25, 'square', 0.1);
        const d = eu.rpm - largadaIdeal;
        if (!gas || eu.rpm < 1500) flutuar('Largou dormindo!', '#f6e05e');
        else if (Math.abs(d) < 700) flutuar('Ótima largada!', '#48bb78');
        else if (d > 0) flutuar('Patinou demais', '#f6993f');
        else flutuar('Giro baixo', '#f6e05e');
      } else {
        const luzes = Math.floor((tFase - (verdeEm - 1.5)) / 0.5);
        if (luzes >= 0 && luzes !== atualizar.ultLuz) { atualizar.ultLuz = luzes; bip(440, 0.12, 'square', 0.07); }
      }
    } else if (fase === 'corrida') {
      if (ele && !ele.largou && tFase >= piloto.reacao) { ele.largou = true; ele.deslize = ele.rpm; }
      passo(eu, dt, gas);
      if (ele) passo(ele, dt, pilotar(ele, piloto));
      if (eu.fim !== null) {
        if (ele && ele.fim === null) {
          while (ele.fim === null && ele.t < 60) passo(ele, 1 / 120, pilotar(ele, piloto));
        }
        finalizar();
      } else if (eu.t > 60) { eu.fim = 60; finalizar(); }
    } else if (fase === 'fim') {
      eu.v *= Math.max(0, 1 - dt * 1.2); eu.x += eu.v * dt;
      eu.rpm += (900 - eu.rpm) * dt * 3;
      if (ele) { ele.v *= Math.max(0, 1 - dt * 1.2); ele.x += ele.v * dt; }
    }
    if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
    motorRpm(eu.rpm, gas ? 1 : 0.3);
  }

  function desenhar() {
    const ppm = h > w ? Math.min(w / 13, h / 20) : Math.max(14, Math.min(w / 24, h / 14));
    const L = COMPRIMENTO * ppm;
    const camX = eu.x - (w * 0.55) / ppm;
    const lay = layout();
    const yPista2 = lay.pista, yPista1 = yPista2 - Math.max(50, L * 0.75), yHorizonte = yPista1 - Math.max(40, L * 0.6);
    // céu
    const g = ctx.createLinearGradient(0, 0, 0, yHorizonte);
    g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#3a2f4a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, yHorizonte);
    // prédios com paralaxe
    for (let camada = 0; camada < 2; camada++) {
      const f = camada ? 0.35 : 0.15, base = yHorizonte + 4;
      ctx.fillStyle = camada ? '#1c2232' : '#151a27';
      const larg = 60 + camada * 30, desloc = (camX * ppm * f) % larg;
      for (let i = -1; i < w / larg + 2; i++) {
        const idx = Math.floor((camX * ppm * f) / larg) + i;
        const alt = 30 + ((idx * 9301 + 49297 + camada * 77) % 233280) / 233280 * (70 + camada * 40);
        ctx.fillRect(i * larg - desloc, base - alt, larg - 6, alt);
        ctx.fillStyle = '#f6e05e22';
        for (let j = 8; j < alt - 8; j += 14) ctx.fillRect(i * larg - desloc + 8, base - alt + j, 6, 5);
        ctx.fillStyle = camada ? '#1c2232' : '#151a27';
      }
    }
    // chão e pista
    ctx.fillStyle = '#1f2a1f'; ctx.fillRect(0, yHorizonte, w, h - yHorizonte);
    ctx.fillStyle = '#2b2f36'; ctx.fillRect(0, yHorizonte + 10, w, yPista2 - yHorizonte + 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, yHorizonte + 10, w, 3); ctx.fillRect(0, yPista2 + 25, w, 3);
    // marcas de distância
    ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
    const ini = Math.floor(camX / 10) * 10;
    for (let d = ini; d < camX + w / ppm + 10; d += 10) {
      const x = (d - camX) * ppm;
      ctx.fillStyle = '#f6e05e88';
      ctx.fillRect(x, (yPista1 + yPista2) / 2 - 1, ppm * 4, 3);
      if (d % 100 === 0 && d >= 0 && d <= 400) {
        ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, yHorizonte + 2, 3, 12);
        ctx.fillText(`${d} m`, x, yHorizonte - 2);
      }
    }
    // largada e chegada
    const linhaX = d => (d - camX) * ppm;
    ctx.fillStyle = '#fff'; ctx.fillRect(linhaX(0) - 2, yHorizonte + 12, 4, yPista2 - yHorizonte + 14);
    const xf = linhaX(DISTANCIA);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#000' : '#fff';
      ctx.fillRect(xf + j * 6, yHorizonte + 12 + i * ((yPista2 - yHorizonte + 14) / 12), 6, (yPista2 - yHorizonte + 14) / 12);
    }
    // carros
    if (ele) desenharCarro(ctx, rc, (ele.x - camX) * ppm - L, yPista1, L, { roda: ele.roda, fumaca: ele.patinando && ele.v < 25, nitro: ele.nitroT > 0 });
    desenharCarro(ctx, carro, (eu.x - camX) * ppm - L, yPista2, L, { roda: eu.roda, fumaca: eu.patinando && eu.v < 25, nitro: eu.nitroT > 0 });
    // árvore de largada
    if (fase === 'pre' || (fase === 'corrida' && tFase < 1)) {
      const cx = w / 2, cy = h * 0.12;
      ctx.fillStyle = '#111c'; ctx.fillRect(cx - 70, cy - 20, 140, 40);
      for (let i = 0; i < 4; i++) {
        let cor = '#333';
        if (fase === 'corrida') cor = i === 3 ? '#48ff88' : '#333';
        else if (tFase >= verdeEm - 1.5 + i * 0.5 && i < 3) cor = '#ffb020';
        ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx - 48 + i * 32, cy, 12, 0, Math.PI * 2); ctx.fill();
      }
      if (fase === 'pre') {
        ctx.fillStyle = '#fff'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
        ctx.fillText('Segure ACELERAR para girar o motor', cx, cy + 40);
        ctx.fillStyle = '#63b3ed'; ctx.fillText('Largue com o ponteiro na faixa azul', cx, cy + 58);
      }
    }
    painel();
    if (msg) {
      ctx.globalAlpha = Math.min(1, msg.t * 2);
      ctx.fillStyle = msg.cor; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(msg.txt, w / 2, h * 0.27);
      ctx.globalAlpha = 1;
    }
  }

  // Retrato: conta-giros acima dos botões e pista acima dele. Paisagem: conta-giros no canto.
  function layout() {
    const retrato = h > w;
    const botoes = 128 + 14 + (sp.nitro ? 68 : 0);
    if (retrato) {
      const r = Math.min(70, w * 0.17);
      const cy = h - 142 - r - 16;
      return { r, cx: w / 2, cy, pista: Math.min(h * 0.55, cy - r - 50) };
    }
    const r = Math.min(62, h * 0.15);
    return { r, cx: w - r - 24, cy: r + 64, pista: Math.min(h * 0.62, h - botoes + 100) };
  }

  function painel() {
    const { r, cx, cy } = layout();
    const red = sp.redline, max = red + 1000;
    const ang = rpm => Math.PI * 0.8 + (rpm / max) * Math.PI * 1.4;
    ctx.fillStyle = '#000b'; ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#444'; ctx.beginPath(); ctx.arc(cx, cy, r, ang(0), ang(max)); ctx.stroke();
    ctx.strokeStyle = '#e53e3e'; ctx.beginPath(); ctx.arc(cx, cy, r, ang(red), ang(max)); ctx.stroke();
    if (!eu.largou) { ctx.strokeStyle = '#63b3ed'; ctx.beginPath(); ctx.arc(cx, cy, r, ang(largadaIdeal - 600), ang(largadaIdeal + 600)); ctx.stroke(); }
    else if (trocasIdeais[eu.marcha]) { ctx.strokeStyle = '#48bb78'; ctx.beginPath(); ctx.arc(cx, cy, r, ang(trocasIdeais[eu.marcha] - 300), ang(trocasIdeais[eu.marcha] + 300)); ctx.stroke(); }
    ctx.fillStyle = '#aaa'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    for (let k = 0; k <= max; k += 1000) {
      const a = ang(k); ctx.fillText(k / 1000, cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16) + 3);
    }
    const a = ang(Math.min(max, eu.rpm));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke();
    // luz de troca
    const ideal = trocasIdeais[eu.marcha];
    const acesa = eu.largou && ideal && eu.rpm >= ideal - 300;
    ctx.fillStyle = acesa ? (eu.rpm > red - 150 ? '#ff3b3b' : '#48ff88') : '#222';
    ctx.beginPath(); ctx.arc(cx, cy - r - 22, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui';
    ctx.fillText(eu.largou ? eu.marcha + 1 : 'N', cx, cy + 10);
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(`${Math.round(eu.v * 3.6)} km/h`, cx, cy + r - 6);
    // topo: tempo e distância
    ctx.textAlign = 'left'; ctx.font = 'bold 16px system-ui'; ctx.fillStyle = '#fff';
    ctx.fillText(`${eu.t.toFixed(2)} s`, 12, 26);
    ctx.font = '13px system-ui'; ctx.fillStyle = '#cbd5e0';
    ctx.fillText(`${Math.min(402, Math.round(eu.x))} / 402 m`, 12, 46);
    if (rival) {
      const dif = ele.x - eu.x;
      ctx.fillText(`${esc(rival.nome)}: ${dif > 0 ? '+' : ''}${dif.toFixed(1)} m`, 12, 64);
    }
    if (eu.patinando && eu.largou) { ctx.fillStyle = '#f6993f'; ctx.fillText('PATINANDO', 12, 82); }
    if (eu.limitador) { ctx.fillStyle = '#f56565'; ctx.fillText('CORTE DE GIRO', 12, 100); }
  }

  function loop(t) {
    if (encerrado) return;
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
    acum += dt;
    while (acum >= 1 / 120) { atualizar(1 / 120); acum -= 1 / 120; }
    desenhar();
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
}

