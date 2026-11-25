// Telas: Oficina, Garagem, Tuning (com dinamômetro), Arrancada (lista de rivais) e Loja.
import { PECAS, LISTA_PECAS, UPGRADES, LISTA_UPGRADES, EQUIPAMENTOS, RIVAIS, CORES, TURBOS } from './data.js';
import { S, salvar, carroAtivo, precoPeca, tempoPeca, precoUpgrade, valorCarro,   aplicarTroca, avaliarEntrega, entregar, encerrarDia, comprarFerroVelho, venderCarro, comprarUpgrade, aplicarDetonacao,
  custoDiario, novoCarro, INICIO_DIA, FIM_DIA } from './estado.js';
import { modelo, specs, curva, simularTempo, mapaPadrao, clamp } from './fisica.js';
import { desenharVitrine } from './desenho.js';
import { fotografar } from './carro3d.js';
import { abrirOficina3D } from './oficina3d.js';
import { $, dinheiro, hora, esc, barra, estrelas, aviso, abrirModal, fecharModal, confirmar } from './ui.js';
import { dinheiro as somDinheiro, erro, motorLigar, motorRpm, motorDesligar } from './som.js';
import { iniciarCorrida } from './corrida.js';

let atualizar = () => {};
export function configurar(fn) { atualizar = fn; }
const ui = { servico: null };

function desenharVitrines(el) {
  el.querySelectorAll('canvas[data-carro]').forEach(cv => {
    const id = cv.dataset.carro;
    const c = S.carros.find(x => x.uid === id) || S.servicos.find(s => s.carro.uid === id)?.carro || S.ferroVelho.find(o => o.carro.uid === id)?.carro;
    if (c && !fotografar(cv, c)) desenharVitrine(cv, c);
  });
}
const media = c => Math.round(LISTA_PECAS.reduce((s, p) => s + c.partes[p], 0) / LISTA_PECAS.length);
export const cilindros = c => ({ corsario: 8, raio: 6 }[c.modelo] || 4);

// ───────────────────────── OFICINA ─────────────────────────
export function telaOficina(el) {
  const pct = (S.hora - INICIO_DIA) / (FIM_DIA - INICIO_DIA) * 100;
  let html = `<div class="cartao">
    <div class="linha"><div><b>Dia ${S.dia}</b> · <span class="relogio">${hora(S.hora)}</span> <span class="fraco">(fecha às 18:00)</span></div>
    <button class="btn peq" data-acao="encerrar">Encerrar dia 🌙</button></div>
    <div class="tempo-barra"><i style="width:${pct}%"></i></div>
  </div>`;
  if (S.tutorial) {
    html += `<div class="cartao destaque"><h3>Como funciona</h3>
      <p>1. Leia os <b>sintomas</b> do cliente e leve o carro para o <b>elevador 3D</b>.</p>
      <p>2. Toque nas peças suspeitas para <b>inspecionar</b>. Para trocar, <b>solte os parafusos</b> um a um, tire a peça, monte a nova e aperte cada parafuso no torque certo. Algumas peças só saem depois de outras (ex.: pneu → pastilha → disco).</p>
      <p>3. <b>Entregue</b> o carro. O cliente paga peça + mão de obra das peças gastas (abaixo de 50%). Trocar peça boa queima sua fama!</p>
      <p>4. Com o dinheiro, prepare seu carro em <b>Tuning</b> e vença as <b>Arrancadas</b>.</p>
      <button class="btn peq" data-acao="fechar-tut">Entendi</button></div>`;
  }
  if (!S.servicos.length) {
    html += `<div class="cartao"><h2>Pátio vazio 👍</h2><p>Todos os clientes de hoje foram atendidos. Encerre o dia para receber novos carros,
      ou aproveite para mexer no seu carro.</p><p class="fraco">Aluguel diário da oficina: ${dinheiro(custoDiario())}</p></div>`;
    el.innerHTML = html;
    return;
  }
  if (!S.servicos.find(s => s.id === ui.servico)) ui.servico = S.servicos[0].id;
  const serv = S.servicos.find(s => s.id === ui.servico);
  if (S.servicos.length > 1) {
    html += `<div class="botoes" style="margin:0 0 10px">${S.servicos.map(s =>
      `<button class="btn peq ${s.id === serv.id ? 'pri' : ''}" data-acao="ver" data-id="${s.id}">${esc(s.cliente)} · ${esc(modelo(s.carro.modelo).nome)}</button>`).join('')}</div>`;
  }
  const m = modelo(serv.carro.modelo);
  html += `<div class="cartao">
    <canvas class="vitrine" data-carro="${serv.carro.uid}"></canvas>
    <div class="linha" style="margin-top:8px"><div><b>${esc(serv.cliente)}</b> trouxe um <b>${esc(m.nome)}</b></div></div>
    <p class="fraco" style="margin-top:8px">Reclamações do cliente:</p>
    <ul class="sintomas">${serv.sintomas.map(s => `<li>“${esc(s)}”</li>`).join('')}</ul>
    <button class="btn pri largo" data-acao="3d" style="margin-top:10px;padding:14px">🔧 Levar para o elevador (oficina 3D)</button>
  </div>`;
  const nFora = Object.keys(serv.carro.fora || {}).length;
  const vistas = LISTA_PECAS.filter(p => serv.conhecido[p]);
  if (vistas.length) {
    html += `<h3>Diagnóstico</h3><div class="grade">${vistas.map(p => `<div class="peca ${p in serv.trocadas ? 'trocada' : ''}">
      <div class="nome">${PECAS[p].icone} ${PECAS[p].nome}</div>${barra(serv.carro.partes[p])}
      <div class="linha"><span class="fraco">${serv.carro.partes[p]}%</span>${p in serv.trocadas ? '<span class="etiqueta verde">nova</span>' : serv.carro.fora?.[p] ? '<span class="etiqueta vermelha">fora</span>' : ''}</div></div>`).join('')}</div>`;
  }
  html += `<div class="botoes"><button class="btn ok largo" data-acao="entregar" ${nFora ? 'disabled' : ''}>Entregar carro ao cliente ✅</button></div>
    ${nFora ? `<p class="fraco" style="color:var(--laranja)">${nFora} peça(s) estão fora do carro: monte tudo antes de entregar.</p>` : ''}`;
  el.innerHTML = html;
  desenharVitrines(el);

  el.onclick = async e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const a = b.dataset.acao;
    if (a === 'fechar-tut') { S.tutorial = false; salvar(); atualizar(); }
    else if (a === 'ver') { ui.servico = b.dataset.id; atualizar(); }
    else if (a === 'encerrar') {
      const ok = S.servicos.length ? await confirmar('Encerrar o dia?', `${S.servicos.length} cliente(s) vão embora sem atendimento e sua fama cai. Aluguel: ${dinheiro(custoDiario())}.`, 'Encerrar')
        : await confirmar('Encerrar o dia?', `Aluguel da oficina: ${dinheiro(custoDiario())}.`, 'Encerrar');
      if (!ok) return;
      const r = encerrarDia();
      abrirModal(`<h2>🌙 Fim do dia</h2>
        <table class="recibo"><tr><td>Aluguel e contas</td><td>-${dinheiro(r.aluguel)}</td></tr>
        ${r.abandonados ? `<tr class="ruim"><td>${r.abandonados} cliente(s) foram embora</td><td>-${r.perda.toFixed(2)} ★</td></tr>` : ''}</table>
        ${S.dinheiro < 0 ? '<p style="color:var(--vermelho)">Você está no vermelho! Venda um carro ou atenda mais clientes.</p>' : ''}
        <p>Chegaram ${S.servicos.length} cliente(s) novos e o ferro-velho tem ofertas novas.</p>
        <button class="btn pri largo" id="ok">Abrir a oficina ☀️</button>`);
      $('#ok').onclick = () => { fecharModal(); atualizar(); };
      atualizar();
    }
    else if (a === '3d') abrirOficina3D(serv.carro, serv, atualizar);
    else if (a === 'entregar') {
      const prev = avaliarEntrega(serv);
      const lucro = prev.total - serv.gastoPecas;
      const cx = abrirModal(`<h2>Entregar o ${esc(m.nome)}?</h2>
        <table class="recibo">${prev.linhas.map(l => `<tr class="${l.ruim ? 'ruim' : ''}"><td>${esc(l.txt)}</td><td>${l.valor ? dinheiro(l.valor) : '—'}</td></tr>`).join('') || '<tr><td>Nenhum serviço feito</td><td>—</td></tr>'}
        <tfoot><tr><td>Cliente paga</td><td>${dinheiro(prev.total)}</td></tr>
        <tr><td>Você gastou em peças</td><td>-${dinheiro(serv.gastoPecas)}</td></tr>
        <tr><td>Lucro</td><td style="color:${lucro >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${dinheiro(lucro)}</td></tr></tfoot></table>
        <div class="botoes"><button class="btn" id="nao">Voltar</button><button class="btn ok" id="sim">Entregar</button></div>`);
      cx.querySelector('#nao').onclick = fecharModal;
      cx.querySelector('#sim').onclick = () => {
        const r = entregar(serv);
        if (!r) { fecharModal(); aviso('Monte as peças que estão fora antes de entregar.'); return; }
        somDinheiro();
        abrirModal(`<h2>${r.resolvido ? '😃 Cliente satisfeito!' : '😠 Cliente insatisfeito'}</h2>
          <p>Recebido: <b style="color:var(--verde)">${dinheiro(r.total)}</b></p>
          <p>Fama: <b style="color:${r.rep >= 0 ? 'var(--verde)' : 'var(--vermelho)'}">${r.rep >= 0 ? '+' : ''}${r.rep.toFixed(2)} ★</b> ${estrelas(S.rep)}</p>
          <button class="btn pri largo" id="ok">Continuar</button>`);
        $('#ok').onclick = () => { fecharModal(); atualizar(); };
        atualizar();
      };
    }
  };
}

// ───────────────────────── GARAGEM ─────────────────────────
export function telaGaragem(el) {
  let html = `<h2>Sua garagem <span class="fraco">(${S.carros.length}/4 vagas)</span></h2>
    <p class="fraco">Conserte e prepare carros do ferro-velho para correr ou revender com lucro. O carro marcado como “ativo” é o que vai para o tuning e a arrancada.</p>`;
  for (const c of S.carros) {
    const m = modelo(c.modelo), sp = specs(c), cv = curva(sp).picoCv;
    const ativo = c.uid === S.ativo;
    html += `<div class="cartao ${ativo ? 'destaque' : ''}">
      <canvas class="vitrine pequena" data-carro="${c.uid}"></canvas>
      <div class="linha" style="margin-top:6px"><b>${esc(m.nome)}</b>${ativo ? '<span class="etiqueta verde">ativo</span>' : ''}</div>
      <div class="stats"><div><b>${Math.round(cv)}</b><small>cv</small></div><div><b>${media(c)}%</b><small>conservação</small></div><div><b>${c.recorde ? c.recorde.toFixed(2) + 's' : '—'}</b><small>recorde ¼ milha</small></div></div>
      <div class="botoes">
        ${ativo ? '' : `<button class="btn peq pri" data-acao="ativar" data-id="${c.uid}">Usar este</button>`}
        <button class="btn peq" data-acao="abrir" data-id="${c.uid}">🔧 Elevador 3D</button>
        ${S.carros.length > 1 ? `<button class="btn peq perigo" data-acao="vender" data-id="${c.uid}">Vender ${dinheiro(valorCarro(c))}</button>` : ''}
      </div>`;
    const fora = Object.keys(c.fora || {}).length;
    if (fora) html += `<p style="color:var(--laranja)">${fora} peça(s) fora do carro.</p>`;
    html += `</div>`;
  }
  el.innerHTML = html;
  desenharVitrines(el);
  el.onclick = async e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const c = S.carros.find(x => x.uid === b.dataset.id);
    if (b.dataset.acao === 'ativar') { S.ativo = c.uid; salvar(); atualizar(); }
    else if (b.dataset.acao === 'abrir') abrirOficina3D(c, null, atualizar);
    else if (b.dataset.acao === 'vender') {
      if (await confirmar('Vender carro?', `Vender o ${esc(modelo(c.modelo).nome)} por ${dinheiro(valorCarro(c))}?`, 'Vender')) {
        somDinheiro(); aviso(`Vendido por ${dinheiro(venderCarro(c.uid))}`); atualizar();
      }
    }
  };
}

// ───────────────────────── TUNING + DINAMÔMETRO ─────────────────────────
let animDino = 0;
function desenharDino(cv, sp, varrer = 1, alerta = false) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b0e13'; ctx.fillRect(0, 0, w, h);
  const c = curva(sp);
  const maxV = Math.max(100, Math.ceil(Math.max(c.picoCv, c.picoTq) / 50) * 50);
  const pad = { e: 36, d: 10, t: 14, b: 24 };
  const X = r => pad.e + (r - 1000) / (sp.redline - 1000) * (w - pad.e - pad.d);
  const Y = v => h - pad.b - v / maxV * (h - pad.t - pad.b);
  ctx.strokeStyle = '#232a36'; ctx.fillStyle = '#5d6878'; ctx.font = '10px system-ui'; ctx.lineWidth = 1;
  for (let v = 0; v <= maxV; v += maxV / 5) { ctx.beginPath(); ctx.moveTo(pad.e, Y(v)); ctx.lineTo(w - pad.d, Y(v)); ctx.stroke(); ctx.fillText(Math.round(v), 4, Y(v) + 3); }
  for (let r = 2000; r <= sp.redline; r += 1000) { ctx.fillText(r / 1000 + 'k', X(r) - 6, h - 8); }
  const limite = 1000 + (sp.redline - 1000) * varrer;
  const linha = (campo, cor) => {
    ctx.strokeStyle = cor; ctx.lineWidth = 2.5; ctx.beginPath();
    c.pts.filter(p => p.rpm <= limite).forEach((p, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(p.rpm), Y(p[campo])));
    ctx.stroke();
  };
  linha('tq', '#63b3ed'); linha('cv', '#f6993f');
  ctx.fillStyle = '#f6993f'; ctx.fillText('● cv', w - 90, 14); ctx.fillStyle = '#63b3ed'; ctx.fillText('● Nm', w - 50, 14);
  if (varrer >= 1) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui';
    ctx.fillText(`${Math.round(c.picoCv)} cv @ ${c.rpmCv} rpm · ${Math.round(c.picoTq)} Nm`, pad.e + 4, pad.t + 12);
  }
  if (alerta) { ctx.fillStyle = '#f56565'; ctx.font = 'bold 14px system-ui'; ctx.fillText('⚠ DETONAÇÃO!', pad.e + 4, pad.t + 30); }
}

export function telaTuning(el) {
  cancelAnimationFrame(animDino);
  const c = carroAtivo();
  const m = modelo(c.modelo), sp = specs(c), cv = curva(sp), est = simularTempo(sp);
  let html = `<div class="cartao"><canvas class="vitrine" data-carro="${c.uid}"></canvas>
    <div class="linha" style="margin-top:6px"><b>${esc(m.nome)}</b><span class="fraco">${m.tracao === 'T' ? 'tração traseira' : 'tração dianteira'}</span></div>
    <div class="stats"><div><b>${Math.round(cv.picoCv)}</b><small>cv</small></div><div><b>${Math.round(cv.picoTq)}</b><small>Nm</small></div><div><b>${Math.round(sp.peso)}</b><small>kg</small></div>
    <div><b>${est.t100 ? est.t100.toFixed(1) + 's' : '—'}</b><small>0-100 (estim.)</small></div><div><b>${est.tempo.toFixed(2)}s</b><small>¼ milha (estim.)</small></div><div><b>${Math.round(est.vmax)}</b><small>km/h final</small></div></div>
    ${media(c) < 50 ? '<p style="color:var(--laranja)">⚠ Peças gastas estão roubando potência e aderência. Veja a mecânica na Garagem.</p>' : ''}
  </div>
  <div class="cartao"><h3 style="margin-top:0">Dinamômetro</h3><canvas id="dino"></canvas>`;
  if (c.ups.ecu) {
    const mapa = c.ecu || mapaPadrao(c);
    const t = c.ups.turbo ? TURBOS[c.ups.turbo - 1] : null;
    html += `<p class="fraco">Mapa da injeção: mais pressão, avanço e mistura pobre dão potência, mas podem causar <b>detonação</b> e estragar o motor.</p>
      ${t ? `<div class="controle"><label>Pressão do turbo <b id="v-boost">${mapa.boost.toFixed(2)} bar</b></label><input type="range" id="r-boost" min="0" max="${t.max}" step="0.05" value="${mapa.boost}"></div>` : ''}
      <div class="controle"><label>Avanço de ignição <b id="v-ign">${mapa.ign > 0 ? '+' : ''}${mapa.ign}°</b></label><input type="range" id="r-ign" min="-6" max="8" step="1" value="${mapa.ign}"></div>
      <div class="controle"><label>Mistura (AFR) <b id="v-afr">${mapa.afr.toFixed(1)}:1</b></label><input type="range" id="r-afr" min="10.5" max="15.5" step="0.1" value="${mapa.afr}"></div>
      <div class="controle"><label>Risco de detonação <b id="v-det"></b></label><div class="detona"><b id="lim"></b><i id="det"></i></div></div>
      <div class="botoes"><button class="btn peq" data-acao="mapa-seguro">Mapa seguro</button></div>`;
  } else {
    html += `<p class="fraco">Instale a <b>injeção programável</b> para ajustar o mapa do motor aqui.</p>`;
  }
  html += `<div class="botoes"><button class="btn pri largo" data-acao="dino">▶ Puxada no dinamômetro</button></div></div>
    <div class="cartao"><h3 style="margin-top:0">Peças de preparação</h3>`;
  for (const u of LISTA_UPGRADES) {
    const info = UPGRADES[u], n = c.ups[u], max = info.niveis.length;
    const preco = n < max ? precoUpgrade(u, n, c) : 0;
    const nomeNivel = u === 'turbo' && n > 0 ? ` (${TURBOS[n - 1].nome})` : '';
    html += `<div class="upg"><div class="ic">${info.icone}</div><div class="info"><b>${info.nome}${nomeNivel}</b><div class="fraco">${info.desc}</div>
      <div class="niveis">${info.niveis.map((_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div></div>
      ${n < max ? `<button class="btn peq ${S.dinheiro >= preco ? 'pri' : ''}" data-acao="up" data-u="${u}">${dinheiro(preco)}</button>` : '<span class="etiqueta verde">máx</span>'}</div>`;
  }
  html += `</div>`;
  if (S.equip.pintura) {
    html += `<div class="cartao"><h3 style="margin-top:0">Pintura (R$ 300)</h3><div class="cores">${CORES.map(k =>
      `<button style="background:${k}" class="${c.cor === k ? 'sel' : ''}" data-acao="cor" data-cor="${k}" aria-label="cor ${k}"></button>`).join('')}</div></div>`;
  }
  el.innerHTML = html;
  desenharVitrines(el);
  const dino = el.querySelector('#dino');
  desenharDino(dino, sp);

  const atualizarDetona = () => {
    const s2 = specs(c);
    const det = el.querySelector('#det'); if (!det) return;
    const escala = 2.4;
    det.style.left = clamp(s2.detonacao / escala, 0, 1) * 100 + '%';
    el.querySelector('#lim').style.left = clamp(s2.limite / escala, 0, 1) * 100 + '%';
    const v = el.querySelector('#v-det');
    v.textContent = s2.detonacao > s2.limite ? 'PERIGO' : s2.detonacao > s2.limite * 0.85 ? 'no limite' : 'seguro';
    v.style.color = s2.detonacao > s2.limite ? 'var(--vermelho)' : s2.detonacao > s2.limite * 0.85 ? 'var(--amarelo)' : 'var(--verde)';
    desenharDino(dino, s2);
  };
  if (c.ups.ecu) {
    if (!c.ecu) c.ecu = mapaPadrao(c);
    const liga = (id, campo, fmt) => {
      const r = el.querySelector('#r-' + id); if (!r) return;
      r.oninput = () => { c.ecu[campo] = +r.value; el.querySelector('#v-' + id).textContent = fmt(+r.value); atualizarDetona(); };
      r.onchange = () => salvar();
    };
    liga('boost', 'boost', v => v.toFixed(2) + ' bar');
    liga('ign', 'ign', v => (v > 0 ? '+' : '') + v + '°');
    liga('afr', 'afr', v => v.toFixed(1) + ':1');
    atualizarDetona();
  }

  el.onclick = async e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    const a = b.dataset.acao;
    if (a === 'up') {
      const u = b.dataset.u, preco = precoUpgrade(u, c.ups[u], c);
      if (!(await confirmar(UPGRADES[u].nome, `Instalar no ${esc(m.nome)} por ${dinheiro(preco)}?`, 'Instalar'))) return;
      const r = comprarUpgrade(c, u);
      if (!r.ok) { erro(); aviso(r.msg); } else { somDinheiro(); aviso('Instalado!'); }
      atualizar();
    } else if (a === 'cor') {
      if (S.dinheiro < 300) { erro(); aviso('Falta dinheiro.'); return; }
      S.dinheiro -= 300; c.cor = b.dataset.cor; c.gasto += 100; salvar(); atualizar();
    } else if (a === 'mapa-seguro') {
      c.ecu = mapaPadrao(c); salvar(); atualizar();
    } else if (a === 'dino') {
      b.disabled = true;
      const s2 = specs(c);
      motorLigar(cilindros(c));
      const t0 = performance.now(), dur = 3500;
      const quadro = t => {
        const k = clamp((t - t0) / dur, 0, 1);
        motorRpm(1000 + (s2.redline - 1000) * k, 1);
        desenharDino(dino, s2, k);
        if (k < 1) { animDino = requestAnimationFrame(quadro); return; }
        motorDesligar();
        const dano = aplicarDetonacao(c, s2);
        desenharDino(dino, specs(c), 1, dano > 0);
        b.disabled = false;
        if (dano) { erro(); aviso(`Detonação! O motor perdeu ${dano}% de vida.`, 3500); setTimeout(atualizar, 1500); }
        else aviso(`${Math.round(curva(s2).picoCv)} cv na roda. Motor inteiro!`);
      };
      animDino = requestAnimationFrame(quadro);
    }
  };
}

// ───────────────────────── ARRANCADA ─────────────────────────
export function telaCorrida(el) {
  const c = carroAtivo();
  const sp = specs(c), est = simularTempo(sp);
  let html = `<div class="cartao"><div class="linha"><div><b>Seu carro:</b> ${esc(modelo(c.modelo).nome)}</div><span class="fraco">estim. ${est.tempo.toFixed(2)}s</span></div>
    <p class="fraco">Segure o <b>acelerador</b> antes da luz verde para girar o motor, troque de marcha na hora certa e use o nitro se tiver.
    No teclado: <b>espaço/↑</b> acelera, <b>→/Enter</b> troca marcha, <b>N</b> nitro.</p>
    <button class="btn largo" data-acao="treino">🏁 Treino livre (grátis)</button></div>
    <h3>Rachas</h3>`;
  RIVAIS.forEach((r, i) => {
    const liberado = i <= S.rivalVencido + 1;
    const rc = novoCarro(r.modelo, r.cond || 100, r.cond || 100); Object.assign(rc.ups, r.ups); if (r.ecu) rc.ecu = { ...r.ecu };
    const rt = simularTempo(specs(rc)).tempo;
    html += `<div class="cartao ${liberado ? '' : 'bloqueado'}"><div class="rival"><div class="av">${['🧔', '👵', '🧑‍🔧', '👩‍🎤', '😎', '🎩', '👻'][i]}</div>
      <div style="flex:1"><b>${esc(r.nome)}</b> ${i <= S.rivalVencido ? '<span class="etiqueta verde">vencido</span>' : ''}<div class="fraco">${esc(modelo(r.modelo).nome)} · ~${rt.toFixed(1)}s</div>
      <div class="fraco">“${esc(r.frase)}”</div></div></div>
      <div class="linha" style="margin-top:8px"><span>Entrada <b>${dinheiro(r.entrada)}</b> · Prêmio <b style="color:var(--verde)">${dinheiro(r.premio)}</b></span>
      ${liberado ? `<button class="btn peq pri" data-acao="desafiar" data-i="${i}">Desafiar</button>` : '<span class="fraco">🔒 vença o anterior</span>'}</div></div>`;
  });
  el.innerHTML = html;
  el.onclick = e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    if (Object.keys(c.fora || {}).length) { erro(); aviso('Há peças fora do carro! Monte tudo no Elevador 3D (Garagem).'); return; }
    if (c.partes.motor < 8) { erro(); aviso('O motor está destruído! Faça a retífica na Garagem.'); return; }
    if (b.dataset.acao === 'treino') iniciarCorrida(c, null, atualizar);
    else {
      const i = +b.dataset.i, r = RIVAIS[i];
      if (S.dinheiro < r.entrada) { erro(); aviso('Você não tem dinheiro para a entrada.'); return; }
      iniciarCorrida(c, i, atualizar);
    }
  };
}

// ───────────────────────── LOJA ─────────────────────────
export function telaLoja(el) {
  let html = `<h2>Equipamentos da oficina</h2>`;
  for (const [k, e] of Object.entries(EQUIPAMENTOS)) {
    const tem = S.equip[k], bloq = e.requer && !S.equip[e.requer];
    html += `<div class="cartao upg ${bloq ? 'bloqueado' : ''}"><div class="ic">${e.icone}</div><div class="info"><b>${e.nome}</b><div class="fraco">${e.desc}</div></div>
      ${tem ? '<span class="etiqueta verde">comprado</span>' : bloq ? '<span class="fraco">🔒</span>' : `<button class="btn peq ${S.dinheiro >= e.preco ? 'pri' : ''}" data-acao="equip" data-k="${k}">${dinheiro(e.preco)}</button>`}</div>`;
  }
  html += `<h2 style="margin-top:20px">Ferro-velho do Seu Nonato</h2><p class="fraco">Carros baratos e judiados. Ofertas novas todo dia. Garagem: ${S.carros.length}/4.</p>`;
  if (!S.ferroVelho.length) html += `<div class="cartao fraco">Nada por hoje. Volte amanhã.</div>`;
  S.ferroVelho.forEach((o, i) => {
    const m = modelo(o.carro.modelo), cv = curva(specs({ ...o.carro, partes: Object.fromEntries(LISTA_PECAS.map(p => [p, 100])) })).picoCv;
    html += `<div class="cartao"><canvas class="vitrine pequena" data-carro="${o.carro.uid}"></canvas>
      <div class="linha" style="margin-top:6px"><b>${esc(m.nome)}</b><span class="fraco">${Math.round(cv)} cv original</span></div>
      <div class="linha" style="margin-top:6px"><span class="fraco">Conservação ${media(o.carro)}% · novo vale ${dinheiro(m.preco)}</span>
      <button class="btn peq ${S.dinheiro >= o.preco ? 'pri' : ''}" data-acao="comprar" data-i="${i}">${dinheiro(o.preco)}</button></div></div>`;
  });
  el.innerHTML = html;
  desenharVitrines(el);
  el.onclick = async e => {
    const b = e.target.closest('[data-acao]'); if (!b) return;
    if (b.dataset.acao === 'equip') {
      const k = b.dataset.k, eq = EQUIPAMENTOS[k];
      if (S.dinheiro < eq.preco) { erro(); aviso('Falta dinheiro.'); return; }
      if (!(await confirmar(eq.nome, `Comprar por ${dinheiro(eq.preco)}?`, 'Comprar'))) return;
      S.dinheiro -= eq.preco; S.equip[k] = true; salvar(); somDinheiro(); atualizar();
    } else if (b.dataset.acao === 'comprar') {
      const o = S.ferroVelho[+b.dataset.i];
      if (S.dinheiro < o.preco) { erro(); aviso('Falta dinheiro.'); return; }
      if (!(await confirmar('Comprar do ferro-velho?', `${esc(modelo(o.carro.modelo).nome)} por ${dinheiro(o.preco)}. Ele vai para sua garagem.`, 'Comprar'))) return;
      const r = comprarFerroVelho(+b.dataset.i);
      if (r === 'cheia') { erro(); aviso('Garagem cheia: venda um carro antes.'); }
      else if (r) { somDinheiro(); aviso('Carro comprado! Veja na Garagem.'); }
      atualizar();
    }
  };
}

