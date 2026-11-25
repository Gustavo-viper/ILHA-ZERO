// Ponto de entrada: navegação, HUD, menu e service worker.
import { S, carregar, novoJogo, salvar, apagarSave } from './estado.js';
import { telaOficina, telaGaragem, telaTuning, telaCorrida, telaLoja, configurar } from './telas.js';
import { $, dinheiro, hora, estrelas, abrirModal, fecharModal, confirmar } from './ui.js';
import { som } from './som.js';

const TELAS = { oficina: telaOficina, garagem: telaGaragem, tuning: telaTuning, corrida: telaCorrida, loja: telaLoja };
let aba = 'oficina';

function hud() {
  $('#hud-dinheiro').textContent = dinheiro(S.dinheiro);
  $('#hud-dinheiro').style.color = S.dinheiro < 0 ? 'var(--vermelho)' : '';
  $('#hud-rep').textContent = estrelas(S.rep);
  $('#hud-rep').title = `Reputação ${S.rep.toFixed(2)} de 5`;
  $('#hud-dia').textContent = `Dia ${S.dia} · ${hora(S.hora)}`;
}

function atualizar() {
  if (document.body.classList.contains('correndo')) return;
  const tela = $('#tela');
  const rolagem = tela.scrollTop;
  TELAS[aba](tela);
  tela.scrollTop = rolagem;
  hud();
}
configurar(atualizar);

document.querySelectorAll('#abas button').forEach(b => b.onclick = () => {
  aba = b.dataset.aba;
  document.querySelectorAll('#abas button').forEach(x => x.classList.toggle('ativa', x === b));
  $('#tela').scrollTop = 0;
  atualizar();
});


$('#btn-menu').onclick = () => {
  const cx = abrirModal(`<h2>Menu</h2>
    <p class="fraco">Serviços: ${S.stats.servicos} · Faturado: ${dinheiro(S.stats.faturado)} · Rachas: ${S.stats.vitorias}/${S.stats.corridas} vitórias</p>
    <div class="botoes" style="flex-direction:column">
      <button class="btn" id="m-som">${som.ligado ? '🔊 Som ligado' : '🔇 Som desligado'}</button>
      <button class="btn" id="m-ajuda">❓ Como jogar</button>
      <button class="btn perigo" id="m-novo">🗑️ Começar de novo</button>
      <button class="btn pri" id="m-fechar">Fechar</button>
    </div>
    <p class="fraco" style="margin-top:12px">O progresso é salvo automaticamente neste aparelho. Instale pelo menu do navegador (“Adicionar à tela inicial”) para jogar offline.</p>`);
  cx.querySelector('#m-som').onclick = () => { som.ligado = !som.ligado; S.som = som.ligado; salvar(); fecharModal(); };
  cx.querySelector('#m-fechar').onclick = fecharModal;
  cx.querySelector('#m-ajuda').onclick = () => { S.tutorial = true; salvar(); fecharModal(); aba = 'oficina'; document.querySelector('[data-aba=oficina]').click(); };
  cx.querySelector('#m-novo').onclick = async () => {
    fecharModal();
    if (await confirmar('Começar de novo?', 'Todo o progresso será apagado.', 'Apagar tudo')) { apagarSave(); novoJogo(); atualizar(); }
  };
};

if (!carregar()) novoJogo();
som.ligado = S.som !== false;
atualizar();
window.addEventListener('resize', () => { clearTimeout(window._rz); window._rz = setTimeout(atualizar, 200); });
document.addEventListener('visibilitychange', () => { if (document.hidden) salvar(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
