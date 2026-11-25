// Utilitários de interface: modal, avisos, formatação e o minigame do aperto.
import { chave, bip, erro } from './som.js';
import { S } from './estado.js';

export const $ = sel => document.querySelector(sel);
export const dinheiro = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
export const hora = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function corCond(c) { return c >= 70 ? 'var(--verde)' : c >= 45 ? 'var(--amarelo)' : c >= 30 ? 'var(--laranja)' : 'var(--vermelho)'; }
export function barra(c) { return `<div class="barra"><i style="width:${c}%;background:${corCond(c)}"></i></div>`; }
export function estrelas(r) {
  const cheias = Math.round(r * 2) / 2;
  let s = '';
  for (let i = 1; i <= 5; i++) s += cheias >= i ? '★' : cheias >= i - 0.5 ? '⯪' : '☆';
  return s;
}

let timerAviso = 0;
export function aviso(txt, ms = 2200) {
  const el = $('#aviso');
  el.textContent = txt; el.classList.remove('oculto');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.add('oculto'), ms);
}

let aoFechar = null;
export function abrirModal(html, fechar) {
  $('#modal-caixa').innerHTML = html;
  $('#modal').classList.remove('oculto');
  aoFechar = fechar || null;
  return $('#modal-caixa');
}
export function fecharModal() {
  $('#modal').classList.add('oculto');
  $('#modal-caixa').innerHTML = '';
  const f = aoFechar; aoFechar = null;
  if (f) f();
}

export function confirmar(titulo, texto, rotulo = 'Confirmar') {
  return new Promise(res => {
    const cx = abrirModal(`<h2>${titulo}</h2><p>${texto}</p>
      <div class="botoes"><button class="btn" data-r="0">Cancelar</button><button class="btn pri" data-r="1">${rotulo}</button></div>`);
    cx.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = b.dataset.r === '1'; fecharModal(); res(r); });
  });
}

// Minigame: aperte no momento em que a agulha passa pela faixa verde, 3 parafusos.
export function minigameAperto(nomePeca) {
  return new Promise(res => {
    const facil = !!S.equip.chave;
    const cx = abrirModal(`<h2>Trocando: ${esc(nomePeca)}</h2>
      <p class="fraco">Toque em <b>APERTAR</b> (ou espaço) quando a agulha estiver na faixa verde. Centro = torque perfeito.</p>
      <div class="parafusos"><span>🔩</span><span>🔩</span><span>🔩</span></div>
      <div class="aperto"><div class="zona"></div><div class="perfeito"></div><div class="agulha"></div></div>
      <button class="btn pri largo" id="btn-apertar" style="padding:16px;font-size:1.1rem">APERTAR</button>`);
    const zona = cx.querySelector('.zona'), perf = cx.querySelector('.perfeito'), ag = cx.querySelector('.agulha');
    const parafusos = [...cx.querySelectorAll('.parafusos span')];
    let i = 0, notas = [], pos = 0, dir = 1, centro = 0, larg = 0, raf = 0, ultimo = performance.now();
    const vel = facil ? 0.75 : 1.05;
    function novaZona() {
      larg = (facil ? 0.24 : 0.18) - i * 0.02;
      centro = 0.2 + Math.random() * 0.6;
      zona.style.left = (centro - larg / 2) * 100 + '%'; zona.style.width = larg * 100 + '%';
      perf.style.left = (centro - larg / 8) * 100 + '%'; perf.style.width = larg / 4 * 100 + '%';
      parafusos.forEach((p, k) => p.className = k < i ? 'feito' : k === i ? 'atual' : '');
    }
    function loop(t) {
      const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
      pos += dir * vel * (1 + i * 0.25) * dt;
      if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
      ag.style.left = pos * 100 + '%';
      raf = requestAnimationFrame(loop);
    }
    function apertar() {
      const d = Math.abs(pos - centro) / (larg / 2);
      const nota = d <= 0.25 ? 1 : d <= 1 ? 1 - (d - 0.25) * 0.4 : Math.max(0.2, 0.6 - (d - 1) * 0.5);
      notas.push(nota);
      if (nota >= 0.98) bip(1200, 0.08, 'triangle', 0.1); else if (nota >= 0.7) chave(); else erro();
      i++;
      if (i >= 3) {
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', tecla);
        const q = notas.reduce((a, b) => a + b, 0) / notas.length;
        parafusos.forEach(p => p.className = 'feito');
        setTimeout(() => { fecharModal(); res(q); }, 250);
      } else novaZona();
    }
    function tecla(e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); apertar(); } }
    cx.querySelector('#btn-apertar').onclick = apertar;
    document.addEventListener('keydown', tecla);
    novaZona();
    raf = requestAnimationFrame(loop);
  });
}

export function rotuloQualidade(q) {
  return q >= 0.95 ? 'Serviço perfeito!' : q >= 0.8 ? 'Bem apertado.' : q >= 0.6 ? 'Ficou razoável.' : 'Ficou meio torto...';
}
