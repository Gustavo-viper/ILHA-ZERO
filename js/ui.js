// Utilitários de interface: modal, avisos, formatação e o minigame do aperto.

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
