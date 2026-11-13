// Cruzadas do Saber — lógica do jogo, telas e progresso.
(function () {
  'use strict';
  const CATS = window.CATEGORIAS;
  const G = window.Gerador;
  const NIVEIS_POR_MUNDO = 10;
  const CUSTO = { letra: 10, palavra: 25, verificar: 5 };
  const $app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const catDe = (id) => CATS.find((c) => c.id === id);
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ontem = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fmtTempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ================================================================ salvamento
  const CHAVE = 'cruzadas_saber_v1';
  function novoSave() {
    return {
      v: 1, xp: 0, nivel: 1, moedas: 150,
      progresso: {}, aprendidas: {}, conquistas: {},
      stats: { cruzadas: 0, palavras: 0, semDica: 0, tresEstrelas: 0, melhorTempo: 0, tempoTotal: 0, diarios: 0, dicas: 0, longas: 0, missoes: 0, temas: {} },
      missoes: { data: '', lista: [] },
      diario: { feitos: {} },
      dias: { ultimo: '', seq: 0, melhor: 0 },
      cfg: { som: true, escuro: false, erros: false, pular: false, teclado: 'auto' },
      atual: null,
    };
  }
  let S;
  try { S = Object.assign(novoSave(), JSON.parse(localStorage.getItem(CHAVE) || 'null') || {}); } catch (e) { S = novoSave(); }
  const base = novoSave();
  S.stats = Object.assign(base.stats, S.stats); S.cfg = Object.assign(base.cfg, S.cfg); S.dias = Object.assign(base.dias, S.dias);
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível */ } }
  document.body.classList.toggle('escuro', !!S.cfg.escuro);

  // ================================================================ som (sintetizado)
  let actx = null;
  function tom(freq, dur = 0.08, tipo = 'sine', vol = 0.12, atraso = 0) {
    if (!S.cfg.som) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + atraso, o = actx.createOscillator(), g = actx.createGain();
      o.type = tipo; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* sem áudio */ }
  }
  const sfx = {
    tecla: () => tom(620, 0.04, 'triangle', 0.05),
    certa: () => { tom(660, 0.1, 'sine', 0.12); tom(880, 0.14, 'sine', 0.12, 0.08); },
    fim: () => [523, 659, 784, 1047].forEach((f, i) => tom(f, 0.22, 'triangle', 0.13, i * 0.12)),
    erro: () => tom(180, 0.18, 'sawtooth', 0.06),
    moeda: () => { tom(988, 0.07, 'square', 0.05); tom(1319, 0.12, 'square', 0.05, 0.07); },
  };

  // ================================================================ notificações
  function toast(txt, ms = 2600) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = txt;
    document.getElementById('toasts').appendChild(d);
    setTimeout(() => d.remove(), ms);
  }
  function flutuar(txt, el) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const d = document.createElement('div'); d.className = 'flutua'; d.textContent = txt;
    d.style.left = r.left + r.width / 2 - 20 + 'px'; d.style.top = r.top - 10 + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
  }
  function confirmar(titulo, texto, sim) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="janela"><h2 style="font-size:22px">${esc(titulo)}</h2><p style="text-align:center">${esc(texto)}</p><div class="acoes"><button class="btn" data-a="nao">Cancelar</button><button class="btn pri" data-a="sim">Confirmar</button></div></div>`;
    m.onclick = (e) => { const a = e.target.dataset.a; if (a) { m.remove(); if (a === 'sim') sim(); } };
    document.body.appendChild(m);
  }

  // ================================================================ XP, moedas, níveis
  const xpParaProximo = (n) => 120 + (n - 1) * 80;
  function ganharXP(q) {
    S.xp += q;
    while (S.xp >= xpParaProximo(S.nivel)) {
      S.xp -= xpParaProximo(S.nivel); S.nivel++; S.moedas += 50;
      toast(`⭐ Você subiu para o nível ${S.nivel}! +50 moedas`); sfx.fim();
    }
  }
  function ganharMoedas(q) { S.moedas += q; }

  // ================================================================ missões diárias
  const MISSOES = [
    { id: 'cruzadas', ev: 'puzzle', alvos: [2, 3], premio: 50, txt: (n) => `Complete ${n} cruzadas` },
    { id: 'palavras', ev: 'word', alvos: [20, 30, 40], premio: 50, txt: (n) => `Acerte ${n} palavras` },
    { id: 'semdica', ev: 'nohint', alvos: [1], premio: 60, txt: () => 'Complete uma cruzada sem usar ajuda' },
    { id: 'rapida', ev: 'fast', alvos: [1], premio: 50, txt: () => 'Complete uma cruzada em menos de 4 minutos' },
    { id: 'diario', ev: 'daily', alvos: [1], premio: 50, txt: () => 'Jogue o desafio diário' },
    { id: 'estrelas', ev: 'stars', alvos: [5, 8], premio: 50, txt: (n) => `Ganhe ${n} estrelas` },
    { id: 'longas', ev: 'longword', alvos: [2, 3], premio: 50, txt: (n) => `Acerte ${n} palavras com 9 letras ou mais` },
    { id: 'tema', ev: 'theme', alvos: [1], premio: 50, txt: (n, cat) => `Complete uma cruzada do tema "${cat.nome}"` },
  ];
  function garantirMissoes() {
    if (S.missoes.data === hoje() && S.missoes.lista.length) return;
    const rng = G.rngDe(G.hashTexto('missoes' + hoje()));
    const escolhidas = G.embaralhar(MISSOES, rng).slice(0, 3);
    S.missoes = {
      data: hoje(),
      lista: escolhidas.map((m) => {
        const alvo = m.alvos[Math.floor(rng() * m.alvos.length)];
        const cat = m.id === 'tema' ? CATS[Math.floor(rng() * CATS.length)].id : null;
        return { id: m.id, ev: m.ev, alvo, prog: 0, premio: m.premio, cat, resgatada: false };
      }),
    };
    salvar();
  }
  function txtMissao(m) { const d = MISSOES.find((x) => x.id === m.id); return d.txt(m.alvo, catDe(m.cat) || {}); }
  function eventoMissao(ev, qtd = 1, extra) {
    garantirMissoes();
    for (const m of S.missoes.lista) {
      if (m.ev !== ev || m.prog >= m.alvo) continue;
      if (ev === 'theme' && m.cat !== extra) continue;
      m.prog = Math.min(m.alvo, m.prog + qtd);
      if (m.prog >= m.alvo) toast(`🎯 Missão concluída: ${txtMissao(m)} — resgate o prêmio!`);
    }
  }
  const missoesProntas = () => { garantirMissoes(); return S.missoes.lista.filter((m) => m.prog >= m.alvo && !m.resgatada).length; };

  // ================================================================ conquistas
  const totalAprendidas = () => Object.keys(S.aprendidas).length;
  const mundosCompletos = () => CATS.filter((c) => Object.keys((S.progresso[c.id] || {})).length >= NIVEIS_POR_MUNDO).length;
  const CONQUISTAS = [
    { id: 'primeira', ic: '🎉', nome: 'Primeiros passos', desc: 'Complete sua primeira cruzada', ok: () => S.stats.cruzadas >= 1, premio: 30 },
    { id: 'c10', ic: '📗', nome: 'Aquecendo', desc: 'Complete 10 cruzadas', ok: () => S.stats.cruzadas >= 10, premio: 60 },
    { id: 'c50', ic: '📘', nome: 'Viciado em cruzadas', desc: 'Complete 50 cruzadas', ok: () => S.stats.cruzadas >= 50, premio: 150 },
    { id: 'c100', ic: '📕', nome: 'Mestre das cruzadas', desc: 'Complete 100 cruzadas', ok: () => S.stats.cruzadas >= 100, premio: 300 },
    { id: 'p100', ic: '🔤', nome: 'Cem palavras', desc: 'Acerte 100 palavras', ok: () => S.stats.palavras >= 100, premio: 50 },
    { id: 'p500', ic: '🔠', nome: 'Quinhentas palavras', desc: 'Acerte 500 palavras', ok: () => S.stats.palavras >= 500, premio: 150 },
    { id: 'p1000', ic: '🏅', nome: 'Mil palavras', desc: 'Acerte 1000 palavras', ok: () => S.stats.palavras >= 1000, premio: 300 },
    { id: 'a50', ic: '📚', nome: 'Estudante', desc: 'Aprenda 50 palavras diferentes no dicionário', ok: () => totalAprendidas() >= 50, premio: 50 },
    { id: 'a250', ic: '🎓', nome: 'Sabichão', desc: 'Aprenda 250 palavras diferentes', ok: () => totalAprendidas() >= 250, premio: 150 },
    { id: 'a500', ic: '🧠', nome: 'Enciclopédia ambulante', desc: 'Aprenda 500 palavras diferentes', ok: () => totalAprendidas() >= 500, premio: 300 },
    { id: 'a1000', ic: '👑', nome: 'Dicionário completo', desc: 'Aprenda 1000 palavras diferentes', ok: () => totalAprendidas() >= 1000, premio: 1000 },
    { id: 's1', ic: '💪', nome: 'Sem ajuda', desc: 'Complete uma cruzada sem usar nenhuma ajuda', ok: () => S.stats.semDica >= 1, premio: 40 },
    { id: 's10', ic: '🦾', nome: 'Independente', desc: 'Complete 10 cruzadas sem ajuda', ok: () => S.stats.semDica >= 10, premio: 150 },
    { id: 'rapido', ic: '⚡', nome: 'Relâmpago', desc: 'Complete uma cruzada em menos de 2 minutos', ok: () => S.stats.melhorTempo > 0 && S.stats.melhorTempo <= 120, premio: 80 },
    { id: 'e10', ic: '🌟', nome: 'Colecionador de estrelas', desc: 'Ganhe 3 estrelas em 10 cruzadas', ok: () => S.stats.tresEstrelas >= 10, premio: 100 },
    { id: 'm1', ic: '🗺️', nome: 'Conquistador', desc: 'Complete todos os níveis de um mundo', ok: () => mundosCompletos() >= 1, premio: 100 },
    { id: 'm5', ic: '🧭', nome: 'Desbravador', desc: 'Complete 5 mundos', ok: () => mundosCompletos() >= 5, premio: 300 },
    { id: 'mtodos', ic: '🌎', nome: 'Volta ao mundo do saber', desc: 'Complete todos os mundos da campanha', ok: () => mundosCompletos() >= CATS.length, premio: 1000 },
    { id: 'temas', ic: '🎨', nome: 'Curioso', desc: 'Jogue cruzadas de 10 temas diferentes', ok: () => Object.keys(S.stats.temas).length >= 10, premio: 80 },
    { id: 'd1', ic: '📅', nome: 'Compromisso', desc: 'Complete um desafio diário', ok: () => S.stats.diarios >= 1, premio: 40 },
    { id: 'd7', ic: '🗓️', nome: 'Hábito saudável', desc: 'Complete 7 desafios diários', ok: () => S.stats.diarios >= 7, premio: 150 },
    { id: 'seq3', ic: '🔥', nome: 'Em chamas', desc: 'Jogue 3 dias seguidos', ok: () => S.dias.melhor >= 3, premio: 60 },
    { id: 'seq7', ic: '🔥', nome: 'Uma semana inteira', desc: 'Jogue 7 dias seguidos', ok: () => S.dias.melhor >= 7, premio: 150 },
    { id: 'seq30', ic: '☄️', nome: 'Imparável', desc: 'Jogue 30 dias seguidos', ok: () => S.dias.melhor >= 30, premio: 600 },
    { id: 'n5', ic: '🥉', nome: 'Nível 5', desc: 'Alcance o nível 5', ok: () => S.nivel >= 5, premio: 50 },
    { id: 'n10', ic: '🥈', nome: 'Nível 10', desc: 'Alcance o nível 10', ok: () => S.nivel >= 10, premio: 120 },
    { id: 'n25', ic: '🥇', nome: 'Nível 25', desc: 'Alcance o nível 25', ok: () => S.nivel >= 25, premio: 400 },
    { id: 'longas', ic: '📏', nome: 'Palavras gigantes', desc: 'Acerte 20 palavras com 9 letras ou mais', ok: () => S.stats.longas >= 20, premio: 80 },
    { id: 'missoes', ic: '🎯', nome: 'Missão cumprida', desc: 'Resgate 10 missões diárias', ok: () => S.stats.missoes >= 10, premio: 120 },
    { id: 'rico', ic: '💰', nome: 'Poupador', desc: 'Junte 1000 moedas', ok: () => S.moedas >= 1000, premio: 0 },
  ];
  function verificarConquistas() {
    const novas = [];
    for (const c of CONQUISTAS) {
      if (S.conquistas[c.id] || !c.ok()) continue;
      S.conquistas[c.id] = Date.now(); S.moedas += c.premio; novas.push(c);
      toast(`🏆 Conquista: ${c.nome}${c.premio ? ` (+${c.premio} moedas)` : ''}`, 3500);
    }
    if (novas.length) { sfx.moeda(); salvar(); }
    return novas;
  }

  // ================================================================ campanha
  function estrelasMundo(id) { return Object.values(S.progresso[id] || {}).reduce((a, b) => a + b, 0); }
  function mundoLiberado(i) { return i === 0 || Object.keys(S.progresso[CATS[i - 1].id] || {}).length >= 6; }
  function nivelLiberado(catId, n) { return n === 1 || !!(S.progresso[catId] || {})[n - 1]; }
  function proximoNivel() {
    for (let i = 0; i < CATS.length; i++) {
      if (!mundoLiberado(i)) break;
      for (let n = 1; n <= NIVEIS_POR_MUNDO; n++) if (!(S.progresso[CATS[i].id] || {})[n]) return { cat: CATS[i].id, n };
    }
    return { cat: CATS[0].id, n: 1 };
  }
  function paramsNivel(n) {
    const alvo = 6 + n;                       // 7 a 16 palavras
    return { alvo, maxDim: alvo <= 9 ? 11 : alvo <= 12 ? 13 : 15 };
  }

  // ================================================================ telas
  let telaAtual = 'inicio';
  function topo(titulo, voltar = 'inicio') {
    return `<div class="topo">
      ${voltar ? `<button class="voltar" data-ir="${voltar}">← Voltar</button>` : ''}
      <h2>${titulo}</h2>
      <div class="nivelbox"><div class="avatar">${S.nivel}</div><div><small>Nível ${S.nivel} · ${S.xp}/${xpParaProximo(S.nivel)} XP</small><div class="xpbar"><i style="width:${(S.xp / xpParaProximo(S.nivel) * 100).toFixed(0)}%"></i></div></div></div>
      <span class="chip">🪙 ${S.moedas}</span>
      <span class="chip" title="Dias seguidos jogando">🔥 ${S.dias.ultimo === hoje() || S.dias.ultimo === ontem() ? S.dias.seq : 0}</span>
    </div>`;
  }
  function ir(t, arg) {
    pararCronometro();
    telaAtual = t;
    window.scrollTo(0, 0);
    ({ inicio: telaInicio, mapa: telaMapa, mundo: telaMundo, missoes: telaMissoes, conquistas: telaConquistas, dicionario: telaDicionario, stats: telaStats, config: telaConfig, livre: telaLivre })[t](arg);
  }
  $app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) { if (telaAtual === 'jogo') guardarAtual(); ir(b.dataset.ir, b.dataset.arg); }
  });

  function telaInicio() {
    garantirMissoes();
    const prox = proximoNivel(), pc = catDe(prox.cat);
    const diarioFeito = !!S.diario.feitos[hoje()];
    const prontas = missoesProntas();
    $app.innerHTML = `<div class="tela">${topo('Início', '')}
      <div class="hero"><h1>Cruzadas do <span>Saber</span></h1><p>${window.TODAS_PALAVRAS.length} palavras para aprender em ${CATS.length} temas</p></div>
      <div class="menu">
        ${S.atual ? `<button class="card destaque" id="retomar"><div class="ic">⏯️</div><b>Continuar cruzada</b><small>${esc(S.atual.titulo)} — volte de onde parou</small></button>` : ''}
        <button class="card ${S.atual ? '' : 'destaque'}" id="jogar"><div class="ic">▶️</div><b>Jogar campanha</b><small>Próximo: ${pc.icone} ${esc(pc.nome)} — nível ${prox.n}</small></button>
        <button class="card" data-ir="mapa"><div class="ic">🗺️</div><b>Mapa dos mundos</b><small>${CATS.length} mundos, ${CATS.length * NIVEIS_POR_MUNDO} níveis com até 3 estrelas</small></button>
        <button class="card" id="diario"><div class="ic">📅</div><b>Desafio diário</b><small>${diarioFeito ? '✅ Concluído hoje! Volte amanhã' : 'Uma cruzada nova por dia com prêmio extra'}</small></button>
        <button class="card" data-ir="livre"><div class="ic">🎲</div><b>Jogo livre</b><small>Escolha o tema e o tamanho</small></button>
        <button class="card" data-ir="missoes">${prontas ? `<span class="badge">${prontas}</span>` : ''}<div class="ic">🎯</div><b>Missões diárias</b><small>${S.missoes.lista.filter((m) => m.prog >= m.alvo).length}/3 concluídas hoje</small></button>
        <button class="card" data-ir="conquistas"><div class="ic">🏆</div><b>Conquistas</b><small>${Object.keys(S.conquistas).length}/${CONQUISTAS.length} desbloqueadas</small></button>
        <button class="card" data-ir="dicionario"><div class="ic">📚</div><b>Meu dicionário</b><small>${totalAprendidas()} palavras aprendidas</small></button>
        <button class="card" data-ir="stats"><div class="ic">📊</div><b>Estatísticas</b><small>Seu desempenho</small></button>
        <button class="card" data-ir="config"><div class="ic">⚙️</div><b>Configurações</b><small>Som, tema escuro, ajudas</small></button>
      </div></div>`;
    document.getElementById('jogar').onclick = () => iniciarCampanha(prox.cat, prox.n);
    document.getElementById('diario').onclick = iniciarDiario;
    const r = document.getElementById('retomar'); if (r) r.onclick = retomar;
  }

  function telaMapa() {
    $app.innerHTML = `<div class="tela">${topo('Mapa dos mundos')}
      <p style="color:var(--muted);margin:0 4px 12px">Complete 6 níveis de um mundo para liberar o próximo.</p>
      <div class="mundos">${CATS.map((c, i) => {
        const lib = mundoLiberado(i), feitos = Object.keys(S.progresso[c.id] || {}).length;
        return `<button class="mundo ${lib ? '' : 'trancado'}" style="--cor:${c.cor}" ${lib ? `data-ir="mundo" data-arg="${c.id}"` : 'disabled'}>
          <div class="ic">${lib ? c.icone : '🔒'}</div><b>${i + 1}. ${esc(c.nome)}</b>
          <small style="color:var(--muted)">${feitos}/${NIVEIS_POR_MUNDO} níveis · ⭐ ${estrelasMundo(c.id)}/${NIVEIS_POR_MUNDO * 3}</small>
          <div class="prog"><i style="width:${feitos / NIVEIS_POR_MUNDO * 100}%"></i></div></button>`;
      }).join('')}</div></div>`;
  }

  function telaMundo(catId) {
    const c = catDe(catId);
    $app.innerHTML = `<div class="tela">${topo(`${c.icone} ${esc(c.nome)}`, 'mapa')}
      <p style="color:var(--muted);margin:0 4px 12px">${c.palavras.length} palavras neste tema. Quanto maior o nível, maior a cruzada.</p>
      <div class="niveis">${Array.from({ length: NIVEIS_POR_MUNDO }, (_, k) => {
        const n = k + 1, est = (S.progresso[catId] || {})[n] || 0, lib = nivelLiberado(catId, n);
        return `<button class="nivel ${est ? 'feito' : ''} ${lib ? '' : 'trancado'}" data-n="${n}" ${lib ? '' : 'disabled'}>${lib ? n : '🔒'}<small>${'★'.repeat(est)}${'☆'.repeat(3 - est)}</small></button>`;
      }).join('')}</div></div>`;
    $app.querySelectorAll('.nivel[data-n]').forEach((b) => (b.onclick = () => iniciarCampanha(catId, +b.dataset.n)));
  }

  function telaLivre() {
    let tam = 'media';
    $app.innerHTML = `<div class="tela">${topo('Jogo livre')}
      <b style="margin-left:4px">Tamanho da cruzada</b>
      <div class="tamanhos"><button class="btn" data-t="pequena">Pequena (8)</button><button class="btn on" data-t="media">Média (12)</button><button class="btn" data-t="grande">Grande (18)</button></div>
      <b style="margin-left:4px">Escolha o tema</b>
      <div class="mundos" style="margin-top:10px">
        <button class="mundo" style="--cor:#666" data-cat="todas"><div class="ic">🌈</div><b>Todos os temas</b><small style="color:var(--muted)">${window.TODAS_PALAVRAS.length} palavras misturadas</small></button>
        ${CATS.map((c) => `<button class="mundo" style="--cor:${c.cor}" data-cat="${c.id}"><div class="ic">${c.icone}</div><b>${esc(c.nome)}</b><small style="color:var(--muted)">${c.palavras.length} palavras</small></button>`).join('')}
      </div></div>`;
    $app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tam = b.dataset.t; $app.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); }));
    $app.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
      const cfg = { pequena: [8, 11], media: [12, 13], grande: [18, 15] }[tam];
      const cat = b.dataset.cat, lista = cat === 'todas' ? window.TODAS_PALAVRAS : catDe(cat).palavras;
      const titulo = `Jogo livre — ${cat === 'todas' ? 'Todos os temas' : catDe(cat).nome}`;
      novoJogo({ modo: 'livre', cat, titulo, seed: (Math.random() * 1e9) | 0, alvo: Math.min(cfg[0], lista.length), maxDim: cfg[1] });
    }));
  }

  function telaMissoes() {
    garantirMissoes();
    $app.innerHTML = `<div class="tela">${topo('Missões diárias')}
      <p style="color:var(--muted);margin:0 4px 12px">Novas missões todos os dias. Complete e resgate moedas e XP.</p>
      ${S.missoes.lista.map((m, i) => `<div class="item"><div class="ic">${m.resgatada ? '✅' : m.prog >= m.alvo ? '🎁' : '🎯'}</div>
        <div class="tx"><b>${esc(txtMissao(m))}</b><small>${m.prog}/${m.alvo} · prêmio: ${m.premio} moedas + ${m.premio} XP</small><div class="prog"><i style="width:${m.prog / m.alvo * 100}%"></i></div></div>
        ${m.resgatada ? '<span class="chip">Resgatada</span>' : `<button class="btn amar" data-m="${i}" ${m.prog >= m.alvo ? '' : 'disabled'}>Resgatar</button>`}</div>`).join('')}</div>`;
    $app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
      const m = S.missoes.lista[+b.dataset.m];
      if (m.resgatada || m.prog < m.alvo) return;
      m.resgatada = true; ganharMoedas(m.premio); ganharXP(m.premio); S.stats.missoes++;
      sfx.moeda(); toast(`+${m.premio} moedas e +${m.premio} XP`);
      verificarConquistas(); salvar(); telaMissoes();
    }));
  }

  function telaConquistas() {
    $app.innerHTML = `<div class="tela">${topo(`Conquistas (${Object.keys(S.conquistas).length}/${CONQUISTAS.length})`)}
      ${CONQUISTAS.map((c) => `<div class="item ${S.conquistas[c.id] ? '' : 'bloq'}"><div class="ic">${c.ic}</div><div class="tx"><b>${esc(c.nome)}</b><small>${esc(c.desc)}${c.premio ? ` · ${c.premio} moedas` : ''}</small></div>${S.conquistas[c.id] ? '<span class="chip">✅</span>' : '<span class="chip">🔒</span>'}</div>`).join('')}</div>`;
  }

  function telaDicionario() {
    $app.innerHTML = `<div class="tela dic">${topo(`Meu dicionário (${totalAprendidas()}/${window.TODAS_PALAVRAS.length})`)}
      <input class="busca" id="busca" placeholder="Buscar palavra aprendida…">
      <p style="color:var(--muted);margin:10px 4px">Cada palavra que você acerta sem revelar entra aqui com o seu significado.</p>
      <div id="dicl"></div></div>`;
    const render = () => {
      const q = window.normalizar(document.getElementById('busca').value || '');
      document.getElementById('dicl').innerHTML = CATS.map((c) => {
        const apr = c.palavras.filter((p) => S.aprendidas[p.w]);
        const vis = q ? apr.filter((p) => p.w.includes(q)) : apr;
        if (q && !vis.length) return '';
        return `<h3><span>${c.icone} ${esc(c.nome)}</span><small style="color:var(--muted)">${apr.length}/${c.palavras.length}</small></h3>
          ${vis.sort((a, b) => a.w.localeCompare(b.w)).map((p) => `<div class="pal"><b>${esc(p.d)}</b> — ${esc(p.dica)}</div>`).join('') || '<div class="pal" style="color:var(--muted)">Nenhuma palavra aprendida ainda neste tema.</div>'}`;
      }).join('');
    };
    document.getElementById('busca').oninput = render; render();
  }

  function telaStats() {
    const st = S.stats;
    const box = (v, t) => `<div class="stat"><b>${v}</b><small>${t}</small></div>`;
    $app.innerHTML = `<div class="tela">${topo('Estatísticas')}<div class="stats">
      ${box(st.cruzadas, 'cruzadas completas')}${box(st.palavras, 'palavras acertadas')}${box(totalAprendidas(), 'palavras no dicionário')}
      ${box(st.semDica, 'cruzadas sem ajuda')}${box(st.tresEstrelas, 'vezes com 3 estrelas')}${box(st.melhorTempo ? fmtTempo(st.melhorTempo) : '—', 'melhor tempo')}
      ${box(fmtTempo(st.tempoTotal).replace(/^(\d+):/, (m, a) => a >= 60 ? `${Math.floor(a / 60)}h ${a % 60}min ` : `${a}min `).replace(/min (\d\d)$/, 'min'), 'tempo total jogando')}
      ${box(st.diarios, 'desafios diários')}${box(S.dias.melhor, 'maior sequência de dias')}${box(st.dicas, 'ajudas usadas')}
      ${box(mundosCompletos() + '/' + CATS.length, 'mundos completos')}${box(Object.keys(S.conquistas).length + '/' + CONQUISTAS.length, 'conquistas')}
    </div></div>`;
  }

  function telaConfig() {
    const sw = (k, t) => `<div class="opcao"><span>${t}</span><input type="checkbox" data-k="${k}" ${S.cfg[k] ? 'checked' : ''} style="width:22px;height:22px"></div>`;
    $app.innerHTML = `<div class="tela">${topo('Configurações')}
      ${sw('som', '🔊 Sons')}${sw('escuro', '🌙 Tema escuro')}
      ${sw('erros', '❌ Mostrar letras erradas automaticamente (ajuda — não conta como dica)')}
      ${sw('pular', '⏭️ Pular casas já preenchidas ao digitar')}
      <div class="opcao"><span>⌨️ Teclado na tela</span><select id="tecl"><option value="auto">Automático (celular/tablet)</option><option value="sempre">Sempre</option><option value="nunca">Nunca</option></select></div>
      <div class="opcao"><span>🗑️ Apagar todo o progresso</span><button class="btn" id="reset" style="background:var(--bad);color:#fff">Apagar</button></div>
      <p style="color:var(--muted);margin:16px 4px">Seu progresso fica salvo neste navegador.</p></div>`;
    $app.querySelectorAll('[data-k]').forEach((i) => (i.onchange = () => { S.cfg[i.dataset.k] = i.checked; document.body.classList.toggle('escuro', !!S.cfg.escuro); salvar(); }));
    const t = document.getElementById('tecl'); t.value = S.cfg.teclado; t.onchange = () => { S.cfg.teclado = t.value; salvar(); };
    document.getElementById('reset').onclick = () => confirmar('Apagar progresso?', 'Todo o seu progresso, moedas e conquistas serão apagados.', () => { S = novoSave(); salvar(); document.body.classList.remove('escuro'); ir('inicio'); toast('Progresso apagado.'); });
  }

  // ================================================================ jogo
  let J = null; // estado da cruzada atual
  let cron = null;
  function pararCronometro() { if (cron) { clearInterval(cron); cron = null; } }

  function iniciarCampanha(catId, n) {
    const c = catDe(catId), p = paramsNivel(n);
    novoJogo({ modo: 'campanha', cat: catId, n, titulo: `${c.icone} ${c.nome} — nível ${n}`, seed: G.hashTexto(catId + ':' + n), alvo: Math.min(p.alvo, c.palavras.length), maxDim: p.maxDim });
  }
  function iniciarDiario() {
    if (S.diario.feitos[hoje()]) { toast('Você já completou o desafio de hoje! Volte amanhã.'); return; }
    novoJogo({ modo: 'diario', cat: 'todas', titulo: `📅 Desafio diário — ${hoje().split('-').reverse().join('/')}`, seed: G.hashTexto('diario' + hoje()), alvo: 14, maxDim: 14 });
  }
  function novoJogo(o) {
    const lista = o.cat === 'todas' ? window.TODAS_PALAVRAS : catDe(o.cat).palavras;
    const cz = G.gerarCruzada(lista, { alvo: o.alvo, maxDim: o.maxDim, seed: o.seed });
    J = Object.assign({}, o, { cz, ent: cz.grade.map((r) => r.map(() => '')), rev: {}, resolvidas: {}, palavrasRev: {}, dicas: 0, tempo: 0, sel: null });
    abrirJogo();
  }
  function guardarAtual() {
    if (!J || J.concluida) return;
    S.atual = { modo: J.modo, cat: J.cat, n: J.n, titulo: J.titulo, seed: J.seed, alvo: J.alvo, maxDim: J.maxDim, ent: J.ent, rev: J.rev, resolvidas: J.resolvidas, palavrasRev: J.palavrasRev, dicas: J.dicas, tempo: J.tempo };
    salvar();
  }
  function retomar() {
    const a = S.atual; if (!a) return;
    const lista = a.cat === 'todas' ? window.TODAS_PALAVRAS : catDe(a.cat).palavras;
    const cz = G.gerarCruzada(lista, { alvo: a.alvo, maxDim: a.maxDim, seed: a.seed });
    J = Object.assign({}, a, { cz, sel: null });
    if (!J.ent || J.ent.length !== cz.altura) J.ent = cz.grade.map((r) => r.map(() => ''));
    abrirJogo();
  }

  const palavrasEm = (l, c) => J.cz.palavras.filter((p) => p.dir ? (p.c === c && l >= p.l && l < p.l + p.w.length) : (p.l === l && c >= p.c && c < p.c + p.w.length));
  const celulas = (p) => Array.from({ length: p.w.length }, (_, k) => [p.l + (p.dir ? k : 0), p.c + (p.dir ? 0 : k)]);
  const palavraAtual = () => { if (!J.sel) return null; const ps = palavrasEm(J.sel.l, J.sel.c); return ps.find((p) => p.dir === J.sel.dir) || ps[0]; };
  const tecladoVisivel = () => S.cfg.teclado === 'sempre' || (S.cfg.teclado === 'auto' && matchMedia('(pointer: coarse)').matches);

  function abrirJogo() {
    telaAtual = 'jogo';
    const cz = J.cz;
    const hz = cz.palavras.filter((p) => !p.dir), vt = cz.palavras.filter((p) => p.dir);
    const li = (p) => `<li data-p="${p.id}"><b>${p.num}</b><span>${esc(p.dica)} <small style="color:var(--muted)">(${p.w.length})</small></span></li>`;
    $app.innerHTML = `<div class="tela">${topo(esc(J.titulo), J.modo === 'campanha' ? 'mundo' : 'inicio').replace('data-ir="mundo"', `data-ir="mundo" data-arg="${J.cat}"`)}
      <div class="jogo">
        <div class="painel">
          <div class="dicaatual"><button class="seta" id="ant">‹</button><div class="t" id="dica">Toque em uma casa para começar</div><button class="seta" id="prox">›</button></div>
          <div class="gradebox"><div class="grade" id="grade" style="grid-template-columns:repeat(${cz.largura}, var(--cel))"></div></div>
          <div class="acoes">
            <span class="chip">⏱️ <span id="tempo">0:00</span></span>
            <span class="chip">✅ <span id="cont">0</span>/${cz.palavras.length}</span>
            <button class="btn amar" id="hLetra">💡 Letra (${CUSTO.letra}🪙)</button>
            <button class="btn amar" id="hPalavra">📖 Palavra (${CUSTO.palavra}🪙)</button>
            <button class="btn" id="hVer">🔍 Verificar (${CUSTO.verificar}🪙)</button>
          </div>
          <div class="teclado ${tecladoVisivel() ? '' : 'hidden'}" id="teclado">
            ${['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((r, i) => `<div class="linha">${[...r].map((k) => `<button data-k="${k}">${k}</button>`).join('')}${i === 2 ? '<button class="larga" data-k="⌫">⌫</button>' : ''}</div>`).join('')}
          </div>
        </div>
        <div class="painel listas">
          <h3>➡️ Horizontais</h3><ul class="lista">${hz.map(li).join('')}</ul>
          <h3>⬇️ Verticais</h3><ul class="lista">${vt.map(li).join('')}</ul>
        </div>
      </div></div>`;
    const grade = document.getElementById('grade');
    let html = '';
    const nums = {};
    for (const p of cz.palavras) nums[p.l + ',' + p.c] = p.num;
    for (let l = 0; l < cz.altura; l++) for (let c = 0; c < cz.largura; c++) {
      html += cz.grade[l][c] ? `<div class="c" data-l="${l}" data-c="${c}">${nums[l + ',' + c] ? `<span class="n">${nums[l + ',' + c]}</span>` : ''}<span class="x"></span></div>` : '<div class="c v"></div>';
    }
    grade.innerHTML = html;
    grade.onclick = (e) => { const d = e.target.closest('.c[data-l]'); if (d) clicarCelula(+d.dataset.l, +d.dataset.c); };
    $app.querySelectorAll('.lista li').forEach((el) => (el.onclick = () => { const p = J.cz.palavras[+el.dataset.p]; selecionarPalavra(p); }));
    document.getElementById('ant').onclick = () => irPalavra(-1);
    document.getElementById('prox').onclick = () => irPalavra(1);
    document.getElementById('hLetra').onclick = ajudaLetra;
    document.getElementById('hPalavra').onclick = ajudaPalavra;
    document.getElementById('hVer').onclick = ajudaVerificar;
    document.getElementById('teclado').onclick = (e) => { const k = e.target.closest('[data-k]'); if (k) { k.dataset.k === '⌫' ? apagar() : digitar(k.dataset.k); } };
    ajustarTamanho();
    // seleciona a primeira palavra não resolvida
    const primeira = cz.palavras.find((p) => !J.resolvidas[p.id]) || cz.palavras[0];
    selecionarPalavra(primeira);
    pararCronometro();
    cron = setInterval(() => { if (document.hidden) return; J.tempo++; const t = document.getElementById('tempo'); if (t) t.textContent = fmtTempo(J.tempo); if (J.tempo % 10 === 0) guardarAtual(); }, 1000);
    redesenhar();
  }

  function ajustarTamanho() {
    const box = document.querySelector('.gradebox'); if (!box || !J) return;
    const larg = Math.min(box.clientWidth, document.documentElement.clientWidth - 48) - 8;
    const alt = Math.max(260, innerHeight - (tecladoVisivel() ? 360 : 250));
    const t = Math.max(22, Math.min(46, Math.floor(Math.min(larg / J.cz.largura, alt / J.cz.altura)) - 2));
    document.documentElement.style.setProperty('--cel', t + 'px');
  }
  addEventListener('resize', () => { if (telaAtual === 'jogo') ajustarTamanho(); });

  function selecionarPalavra(p) {
    const cs = celulas(p);
    const vazia = cs.find(([l, c]) => !J.ent[l][c]) || cs[0];
    J.sel = { l: vazia[0], c: vazia[1], dir: p.dir };
    redesenhar();
  }
  function clicarCelula(l, c) {
    const ps = palavrasEm(l, c);
    if (J.sel && J.sel.l === l && J.sel.c === c && ps.length > 1) J.sel.dir = 1 - J.sel.dir;
    else J.sel = { l, c, dir: ps.some((p) => p.dir === (J.sel ? J.sel.dir : 0)) ? (J.sel ? J.sel.dir : 0) : ps[0].dir };
    redesenhar();
  }
  function irPalavra(delta) {
    const lista = J.cz.palavras, atual = palavraAtual();
    let i = atual ? atual.id : -1;
    for (let k = 0; k < lista.length; k++) {
      i = (i + delta + lista.length) % lista.length;
      if (!J.resolvidas[lista[i].id]) { selecionarPalavra(lista[i]); return; }
    }
  }
  const bloqueada = (l, c) => !!J.rev[l + ',' + c] || palavrasEm(l, c).some((p) => J.resolvidas[p.id]);

  function mover(passo) {
    const p = palavraAtual(); if (!p) return;
    const cs = celulas(p);
    let i = cs.findIndex(([l, c]) => l === J.sel.l && c === J.sel.c);
    for (let k = 0; k < cs.length; k++) {
      i += passo;
      if (i < 0 || i >= cs.length) return;
      const [l, c] = cs[i];
      if (passo > 0 && S.cfg.pular && (J.ent[l][c] || bloqueada(l, c)) && k < cs.length - 1) continue;
      J.sel.l = l; J.sel.c = c; return;
    }
  }

  function digitar(ch) {
    if (!J || !J.sel || J.concluida) return;
    const { l, c } = J.sel;
    if (!bloqueada(l, c)) { J.ent[l][c] = ch; sfx.tecla(); }
    const resolveu = checarEm(l, c);
    const p = palavraAtual();
    if (resolveu && p && J.resolvidas[p.id]) irPalavra(1);
    else mover(1);
    redesenhar();
    if (Object.keys(J.resolvidas).length === J.cz.palavras.length) concluir();
  }
  function apagar() {
    if (!J || !J.sel) return;
    const { l, c } = J.sel;
    if (J.ent[l][c] && !bloqueada(l, c)) J.ent[l][c] = '';
    else { mover(-1); if (!bloqueada(J.sel.l, J.sel.c)) J.ent[J.sel.l][J.sel.c] = ''; }
    redesenhar();
  }

  // verifica as palavras que passam pela casa; devolve true se alguma foi resolvida agora
  function checarEm(l, c) {
    let algum = false;
    for (const p of palavrasEm(l, c)) {
      if (J.resolvidas[p.id]) continue;
      const cs = celulas(p);
      if (cs.every(([ll, cc]) => J.ent[ll][cc] === J.cz.grade[ll][cc])) {
        J.resolvidas[p.id] = true; algum = true;
        palavraResolvida(p);
      } else if (S.cfg.erros && cs.every(([ll, cc]) => J.ent[ll][cc])) {
        sfx.erro();
      }
    }
    return algum;
  }
  function palavraResolvida(p) {
    sfx.certa();
    S.stats.palavras++; eventoMissao('word');
    if (p.w.length >= 9) { S.stats.longas++; eventoMissao('longword'); }
    const revelou = J.palavrasRev[p.id];
    if (!revelou) {
      ganharXP(10);
      const nova = !S.aprendidas[p.w];
      S.aprendidas[p.w] = Date.now();
      const el = document.querySelector(`.c[data-l="${p.l}"][data-c="${p.c}"]`);
      flutuar(nova ? '+10 XP · nova palavra!' : '+10 XP', el);
    }
    setTimeout(() => celulas(p).forEach(([l, c]) => { const el = document.querySelector(`.c[data-l="${l}"][data-c="${c}"]`); if (el) { el.classList.remove('pulo'); void el.offsetWidth; el.classList.add('pulo'); } }), 10);
    guardarAtual();
  }

  // ---------------------------------------------------------------- ajudas
  function pagar(custo) {
    if (S.moedas < custo) { toast(`Moedas insuficientes (precisa de ${custo}). Complete missões e cruzadas para ganhar mais!`); sfx.erro(); return false; }
    S.moedas -= custo; J.dicas++; S.stats.dicas++; return true;
  }
  function ajudaLetra() {
    const p = palavraAtual(); if (!p || J.resolvidas[p.id]) return;
    const cs = celulas(p);
    let alvo = (J.sel && !bloqueada(J.sel.l, J.sel.c) && J.ent[J.sel.l][J.sel.c] !== J.cz.grade[J.sel.l][J.sel.c]) ? [J.sel.l, J.sel.c] : null;
    if (!alvo) alvo = cs.find(([l, c]) => J.ent[l][c] !== J.cz.grade[l][c]);
    if (!alvo || !pagar(CUSTO.letra)) return;
    const [l, c] = alvo;
    J.ent[l][c] = J.cz.grade[l][c]; J.rev[l + ',' + c] = true;
    checarEm(l, c); redesenhar(); atualizarTopo();
    if (Object.keys(J.resolvidas).length === J.cz.palavras.length) concluir();
  }
  function ajudaPalavra() {
    const p = palavraAtual(); if (!p || J.resolvidas[p.id] || !pagar(CUSTO.palavra)) return;
    J.palavrasRev[p.id] = true;
    for (const [l, c] of celulas(p)) { J.ent[l][c] = J.cz.grade[l][c]; J.rev[l + ',' + c] = true; }
    for (const [l, c] of celulas(p)) checarEm(l, c);
    redesenhar(); atualizarTopo();
    if (Object.keys(J.resolvidas).length === J.cz.palavras.length) concluir(); else irPalavra(1);
  }
  function ajudaVerificar() {
    let erradas = 0;
    for (let l = 0; l < J.cz.altura; l++) for (let c = 0; c < J.cz.largura; c++) if (J.ent[l][c] && J.ent[l][c] !== J.cz.grade[l][c]) erradas++;
    if (!erradas) { toast('Nenhuma letra errada até agora! 👏'); return; }
    if (!pagar(CUSTO.verificar)) return;
    J.mostrarErros = Date.now();
    toast(`${erradas} letra(s) errada(s) marcada(s) em vermelho.`);
    redesenhar(); atualizarTopo();
    setTimeout(() => { if (J) { J.mostrarErros = 0; redesenhar(); } }, 4000);
  }
  function atualizarTopo() {
    const ch = $app.querySelector('.topo .chip'); if (ch) ch.textContent = `🪙 ${S.moedas}`;
  }

  function redesenhar() {
    if (!J || telaAtual !== 'jogo') return;
    const atual = palavraAtual();
    const naPal = {};
    if (atual) for (const [l, c] of celulas(atual)) naPal[l + ',' + c] = true;
    const resolvidasCel = {};
    for (const p of J.cz.palavras) if (J.resolvidas[p.id]) for (const [l, c] of celulas(p)) resolvidasCel[l + ',' + c] = true;
    const mostrarErros = S.cfg.erros || J.mostrarErros;
    document.querySelectorAll('#grade .c[data-l]').forEach((el) => {
      const l = +el.dataset.l, c = +el.dataset.c, k = l + ',' + c, v = J.ent[l][c];
      el.querySelector('.x').textContent = v;
      el.classList.toggle('pal', !!naPal[k]);
      el.classList.toggle('sel', !!J.sel && J.sel.l === l && J.sel.c === c);
      el.classList.toggle('ok', !!resolvidasCel[k]);
      el.classList.toggle('rev', !!J.rev[k] && !resolvidasCel[k]);
      el.classList.toggle('erro', !!(mostrarErros && v && v !== J.cz.grade[l][c]));
    });
    $app.querySelectorAll('.lista li').forEach((el) => {
      const id = +el.dataset.p;
      el.classList.toggle('feita', !!J.resolvidas[id]);
      el.classList.toggle('atual', !!atual && atual.id === id);
    });
    const li = atual && $app.querySelector(`.lista li[data-p="${atual.id}"]`);
    if (li && matchMedia('(min-width: 901px)').matches) li.scrollIntoView({ block: 'nearest' });
    document.getElementById('dica').innerHTML = atual ? `<b>${atual.num} ${atual.dir ? 'Vertical' : 'Horizontal'}</b> · ${esc(atual.dica)} <small style="color:var(--muted)">(${atual.w.length} letras)</small>` : '';
    document.getElementById('cont').textContent = Object.keys(J.resolvidas).length;
  }

  // teclado físico
  addEventListener('keydown', (e) => {
    if (telaAtual !== 'jogo' || !J || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const k = e.key;
    if (/^[a-zA-ZçÇ]$/.test(k)) { e.preventDefault(); digitar(window.normalizar(k)); }
    else if (k === 'Backspace') { e.preventDefault(); apagar(); }
    else if (k === 'Enter' || k === 'Tab') { e.preventDefault(); irPalavra(e.shiftKey ? -1 : 1); }
    else if (k === ' ') { e.preventDefault(); const ps = palavrasEm(J.sel.l, J.sel.c); if (ps.length > 1) { J.sel.dir = 1 - J.sel.dir; redesenhar(); } }
    else if (k.startsWith('Arrow')) {
      e.preventDefault();
      const d = { ArrowLeft: [0, -1, 0], ArrowRight: [0, 1, 0], ArrowUp: [-1, 0, 1], ArrowDown: [1, 0, 1] }[k];
      let l = J.sel.l, c = J.sel.c;
      for (let i = 0; i < 20; i++) {
        l += d[0]; c += d[1];
        if (l < 0 || c < 0 || l >= J.cz.altura || c >= J.cz.largura) break;
        if (J.cz.grade[l][c]) { const ps = palavrasEm(l, c); J.sel = { l, c, dir: ps.some((p) => p.dir === d[2]) ? d[2] : ps[0].dir }; break; }
      }
      redesenhar();
    }
  });

  // ---------------------------------------------------------------- fim da cruzada
  function concluir() {
    if (J.concluida) return;
    J.concluida = true; pararCronometro(); S.atual = null;
    const est = J.dicas === 0 ? 3 : J.dicas <= 3 ? 2 : 1;
    const xp = 50 + est * 25 + (J.modo === 'diario' ? 50 : 0);
    const moedas = 15 + est * 10 + (J.modo === 'diario' ? 50 : 0);
    ganharXP(xp); ganharMoedas(moedas);
    const st = S.stats;
    st.cruzadas++; st.tempoTotal += J.tempo;
    if (!st.melhorTempo || J.tempo < st.melhorTempo) st.melhorTempo = J.tempo;
    if (J.dicas === 0) { st.semDica++; eventoMissao('nohint'); }
    if (est === 3) st.tresEstrelas++;
    if (J.cat !== 'todas') { st.temas[J.cat] = (st.temas[J.cat] || 0) + 1; eventoMissao('theme', 1, J.cat); }
    if (J.modo === 'campanha') { S.progresso[J.cat] = S.progresso[J.cat] || {}; S.progresso[J.cat][J.n] = Math.max(est, S.progresso[J.cat][J.n] || 0); }
    if (J.modo === 'diario') { S.diario.feitos[hoje()] = est; st.diarios++; eventoMissao('daily'); }
    eventoMissao('puzzle'); eventoMissao('stars', est);
    if (J.tempo < 240) eventoMissao('fast');
    // sequência de dias
    if (S.dias.ultimo !== hoje()) { S.dias.seq = S.dias.ultimo === ontem() ? S.dias.seq + 1 : 1; S.dias.ultimo = hoje(); S.dias.melhor = Math.max(S.dias.melhor, S.dias.seq); }
    const novas = verificarConquistas();
    salvar(); sfx.fim();
    const proximo = J.modo === 'campanha' ? (J.n < NIVEIS_POR_MUNDO ? { cat: J.cat, n: J.n + 1 } : proximoNivel()) : null;
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="janela">
      <h2>${est === 3 ? 'Perfeito!' : est === 2 ? 'Muito bem!' : 'Cruzada completa!'}</h2>
      <div class="estrelas">${'⭐'.repeat(est)}${'☆'.repeat(3 - est)}</div>
      <p style="text-align:center;color:var(--muted);margin:0">${esc(J.titulo)} · tempo ${fmtTempo(J.tempo)} · ${J.dicas} ajuda(s)</p>
      <div class="premios"><span class="chip">+${xp} XP</span><span class="chip">+${moedas} 🪙</span>${novas.map((c) => `<span class="chip">🏆 ${esc(c.nome)}</span>`).join('')}</div>
      <div class="aprendidas"><b>📚 Palavras desta cruzada</b>${J.cz.palavras.map((p) => `<div><b style="color:var(--pri)">${esc(p.d)}</b> — ${esc(p.dica)}</div>`).join('')}</div>
      <div class="acoes">
        <button class="btn" data-a="inicio">Início</button>
        ${J.modo === 'campanha' ? '<button class="btn" data-a="mapa">Mapa</button>' : ''}
        ${proximo ? '<button class="btn pri" data-a="prox">Próximo nível ▶</button>' : J.modo === 'livre' ? '<button class="btn pri" data-a="outra">Outra cruzada</button>' : ''}
      </div></div>`;
    m.onclick = (e) => {
      const a = e.target.dataset.a; if (!a) return;
      m.remove();
      if (a === 'inicio') ir('inicio');
      else if (a === 'mapa') ir('mundo', J.cat);
      else if (a === 'prox') iniciarCampanha(proximo.cat, proximo.n);
      else if (a === 'outra') novoJogo(Object.assign({}, J, { seed: (Math.random() * 1e9) | 0 }));
    };
    document.body.appendChild(m);
  }

  addEventListener('beforeunload', () => { if (telaAtual === 'jogo') guardarAtual(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && telaAtual === 'jogo') guardarAtual(); });

  // PWA (funciona offline quando servido por http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

  window.__CRUZ = { get S() { return S; }, get J() { return J; }, digitar, ir };
  garantirMissoes();
  ir('inicio');
})();
