// Palavrário — lógica do jogo, telas, loja, contas e progresso.
(function () {
  'use strict';
  const CATS = window.CATEGORIAS;
  const G = window.Gerador;
  const CUSTO = { letra: 10, palavra: 25, verificar: 5 };
  const $app = document.getElementById('app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const catDe = (id) => CATS.find((c) => c.id === id);
  const dataStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoje = () => dataStr(new Date());
  const diasAtras = (n) => dataStr(new Date(Date.now() - n * 864e5));
  const fmtTempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ================================================================ níveis por mundo (proporcional ao tamanho do tema)
  const niveisDe = (catId) => Math.max(3, Math.min(10, Math.round(catDe(catId).palavras.length / 9)));
  const totalNiveis = () => CATS.reduce((s, c) => s + niveisDe(c.id), 0);
  // cruzadas crescem do nível 1 ao último; a soma dos níveis cabe no vocabulário do tema (≈ sem repetir)
  function paramsNivel(catId, n) {
    const tam = catDe(catId).palavras.length, N = niveisDe(catId);
    const fator = tam < 60 ? 0.8 : 0.92;   // temas pequenos: cruzadas um pouco menores para não repetir
    const max = Math.max(7, Math.min(16, Math.floor((2 * fator * tam) / N - 6)));
    const alvo = Math.round(6 + (max - 6) * (N > 1 ? (n - 1) / (N - 1) : 1));
    return { alvo, maxDim: alvo <= 9 ? 11 : alvo <= 12 ? 13 : 15 };
  }

  // ================================================================ loja: catálogo
  const TEMAS = [
    { id: 'classico', nome: 'Clássico', preco: 0, desc: 'Azul e laranja, claro e limpo',
      v: { bg: '#eef3fb', bg2: '#ffffff', txt: '#1d2a3a', muted: '#66758a', line: '#d6dfeb', pri: '#2f6fd1', pri2: '#ffb02e', celbg: '#ffffff', celsel: '#ffe58a', celword: '#dbe9ff', celok: '#cdf3e0', fundo: 'linear-gradient(160deg,#e6efff 0%,#f6efff 55%,#fff4e6 100%)' } },
    { id: 'noite', nome: 'Noite', preco: 0, desc: 'Tema escuro, descansa os olhos',
      v: { bg: '#0f1621', bg2: '#18222f', txt: '#e8eef6', muted: '#93a2b5', line: '#2a3747', pri: '#5b95ff', pri2: '#ffb02e', celbg: '#1f2b3a', celsel: '#6b5a17', celword: '#23406b', celok: '#1d4a37', fundo: 'linear-gradient(160deg,#0d1420,#151f30 60%,#1a1426)' } },
    { id: 'oceano', nome: 'Oceano', preco: 150, desc: 'Tons de mar e areia',
      v: { bg: '#e6f6f8', bg2: '#ffffff', txt: '#123a44', muted: '#5d7f88', line: '#cde6ea', pri: '#0f8aa6', pri2: '#ffb347', celbg: '#ffffff', celsel: '#ffe9a8', celword: '#cdeef3', celok: '#c9f2df', fundo: 'linear-gradient(170deg,#d2f1f7 0%,#e8f6ff 50%,#fff3dc 100%)' } },
    { id: 'floresta', nome: 'Floresta', preco: 150, desc: 'Verde, musgo e madeira',
      v: { bg: '#eef6ea', bg2: '#ffffff', txt: '#203320', muted: '#647a60', line: '#d5e6cd', pri: '#2f8f4e', pri2: '#f2b134', celbg: '#ffffff', celsel: '#fbe7a6', celword: '#d7eecd', celok: '#c6efd7', fundo: 'linear-gradient(165deg,#dff0d5 0%,#eef6e2 55%,#f6efdc 100%)' } },
    { id: 'pordosol', nome: 'Pôr do sol', preco: 200, desc: 'Laranja, rosa e dourado',
      v: { bg: '#fff1e8', bg2: '#ffffff', txt: '#3d2219', muted: '#8a6a5f', line: '#f3d9cc', pri: '#e2603f', pri2: '#ffc145', celbg: '#ffffff', celsel: '#ffe6a3', celword: '#ffe0cf', celok: '#d4f2df', fundo: 'linear-gradient(160deg,#ffe2cf 0%,#ffd6e3 55%,#ffe9b8 100%)' } },
    { id: 'doce', nome: 'Doce', preco: 200, desc: 'Cores de confeitaria',
      v: { bg: '#fff0f6', bg2: '#ffffff', txt: '#3b2033', muted: '#8a6680', line: '#f4d5e5', pri: '#d6478a', pri2: '#4fc7b8', celbg: '#ffffff', celsel: '#fff0a8', celword: '#ffd9ea', celok: '#cdf3ea', fundo: 'linear-gradient(160deg,#ffe0ef 0%,#e8f6ff 55%,#fff6d8 100%)' } },
    { id: 'papel', nome: 'Jornal antigo', preco: 250, desc: 'Papel envelhecido e tinta',
      v: { bg: '#f3ecdc', bg2: '#fbf7ee', txt: '#2b2418', muted: '#7d7058', line: '#e2d6bb', pri: '#7a5c2e', pri2: '#c0392b', celbg: '#fffdf7', celsel: '#f6e3a0', celword: '#efe3c8', celok: '#dcebc8', fundo: 'linear-gradient(160deg,#efe6d2,#f7f1e3)' } },
    { id: 'galaxia', nome: 'Galáxia', preco: 300, desc: 'Roxo profundo e estrelas',
      v: { bg: '#120f2a', bg2: '#1c1840', txt: '#ece9ff', muted: '#a49fd0', line: '#332d66', pri: '#8f7cff', pri2: '#ffcf5a', celbg: '#241f52', celsel: '#5a4a10', celword: '#2f2a6e', celok: '#1e4a46', fundo: 'radial-gradient(circle at 20% 15%,#3a2a7a 0,transparent 40%),radial-gradient(circle at 85% 70%,#5a1f6e 0,transparent 45%),#100c26' } },
    { id: 'neon', nome: 'Neon', preco: 400, desc: 'Brilho de fliperama',
      v: { bg: '#0b0b12', bg2: '#15151f', txt: '#f2f2ff', muted: '#9a9ab8', line: '#2a2a3d', pri: '#00c8ff', pri2: '#ff3df2', celbg: '#1b1b29', celsel: '#4a2448', celword: '#1f3240', celok: '#10372f', fundo: 'linear-gradient(160deg,#0b0b12,#1a0b24 60%,#0b1a24)' } },
  ];
  const AVATARES = [
    ['🙂', 0], ['🦊', 60], ['🐼', 60], ['🐸', 60], ['🐢', 80], ['🦉', 80], ['🐙', 100], ['🦁', 100],
    ['🐝', 120], ['🦖', 150], ['🦄', 180], ['🐲', 200], ['🤖', 200], ['🧑‍🚀', 250], ['🧙', 300], ['👑', 500],
  ];
  const ITENS = [
    { id: 'letra', ic: '💡', nome: 'Pacote de letras', desc: '5 dicas de letra (sai mais barato que avulso)', preco: 40, qtd: 5 },
    { id: 'palavra', ic: '📖', nome: 'Pacote de palavras', desc: '3 revelações de palavra inteira', preco: 60, qtd: 3 },
    { id: 'verificar', ic: '🔍', nome: 'Pacote de verificações', desc: '5 verificações de erros', preco: 20, qtd: 5 },
    { id: 'congelar', ic: '🧊', nome: 'Proteção de sequência', desc: 'Se você ficar um dia sem jogar, a sequência de dias não zera', preco: 80, qtd: 1 },
  ];

  // ================================================================ salvamento
  const CHAVE = 'cruzadas_saber_v1';
  function novoSave() {
    return {
      v: 2, xp: 0, nivel: 1, moedas: 150,
      progresso: {}, aprendidas: {}, conquistas: {}, conqResg: {}, vistas: {},
      stats: { cruzadas: 0, palavras: 0, semDica: 0, tresEstrelas: 0, melhorTempo: 0, tempoTotal: 0, diarios: 0, dicas: 0, longas: 0, missoes: 0, temas: {}, gastas: 0, compras: 0 },
      missoes: { data: '', lista: [] },
      diario: { feitos: {} },
      dias: { ultimo: '', seq: 0, melhor: 0 },
      cfg: { som: true, erros: false, pular: false, teclado: 'auto' },
      loja: { temas: ['classico', 'noite'], tema: 'classico', avatares: ['🙂'], avatar: '🙂', itens: { letra: 0, palavra: 0, verificar: 0, congelar: 0 } },
      atual: null,
    };
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (e) { S = null; }
  function migrarCampos() {
    const b = novoSave();
    if (!S) { S = b; return; }
    const versao = S.v || 1;
    S = Object.assign(b, S);
    S.stats = Object.assign(novoSave().stats, S.stats);
    S.cfg = Object.assign(novoSave().cfg, S.cfg);
    S.dias = Object.assign(novoSave().dias, S.dias);
    S.loja = Object.assign(novoSave().loja, S.loja);
    S.loja.itens = Object.assign(novoSave().loja.itens, S.loja.itens);
    S.vistas = S.vistas || {};
    if (versao < 2) {
      // na v1 as conquistas já pagavam na hora: marca como resgatadas
      S.conqResg = {}; for (const k in S.conquistas) S.conqResg[k] = true;
      if (S.cfg.escuro) S.loja.tema = 'noite';
      delete S.cfg.escuro;
      S.v = 2;
      for (const k in S.aprendidas) S.vistas[k] = S.vistas[k] || S.aprendidas[k];
    }
  }
  migrarCampos();
  function salvar() {
    S.ts = Date.now();
    try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* armazenamento indisponível */ }
    agendarSync();
  }

  // ================================================================ conta (login e senha) e progresso na nuvem
  const CHAVE_CONTA = 'palavrario_conta';
  let conta = null;
  try { conta = JSON.parse(localStorage.getItem(CHAVE_CONTA) || 'null'); } catch (e) { conta = null; }
  const temServidor = location.protocol.startsWith('http') && !/claude\.ai|claudeusercontent|github\.io/.test(location.hostname);
  let syncTimer = null, syncStatus = '';
  async function chamar(metodo, url, corpo) {
    const r = await fetch(url, { method: metodo, headers: Object.assign({ 'content-type': 'application/json' }, conta ? { authorization: 'Bearer ' + conta.token } : {}), body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && conta && !url.endsWith('/login') && !url.endsWith('/cadastro')) { sairConta(true); }
    if (!r.ok) throw new Error(j.erro || 'Erro de conexão');
    return j;
  }
  function agendarSync() {
    if (!conta || !temServidor) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(enviarProgresso, 2500);
  }
  async function enviarProgresso() {
    if (!conta) return;
    S.dono = conta.usuario;
    try { await chamar('PUT', '/api/progresso', { progresso: S }); syncStatus = 'Sincronizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { syncStatus = 'Sem conexão — seu progresso fica salvo aqui e sobe depois.'; }
  }
  function usarProgresso(p) {
    S = p; migrarCampos(); S.dono = conta ? conta.usuario : S.dono; localStorage.setItem(CHAVE, JSON.stringify(S)); aplicarTema();
  }
  const progressoVazio = (p) => !p || ((p.stats || {}).cruzadas || 0) === 0 && (p.xp || 0) === 0 && (p.nivel || 1) === 1 && Object.keys(p.aprendidas || {}).length === 0;
  // Decide qual progresso vale ao conectar: nunca apaga progresso real sem perguntar.
  function reconciliar(remoto, aoTerminar) {
    const fim = () => { if (aoTerminar) aoTerminar(); };
    if (!remoto || progressoVazio(remoto)) { enviarProgresso(); return fim(); }
    if (progressoVazio(S)) { usarProgresso(remoto); toast('☁️ Progresso da sua conta carregado.'); return fim(); }
    if (S.dono === conta.usuario) {
      if ((remoto.ts || 0) > (S.ts || 0)) { usarProgresso(remoto); toast('☁️ Progresso atualizado com a sua conta.'); } else enviarProgresso();
      return fim();
    }
    const r = remoto.stats || {};
    confirmar('Qual progresso manter?', `Na conta: nível ${remoto.nivel}, ${r.cruzadas || 0} cruzadas. Neste aparelho: nível ${S.nivel}, ${S.stats.cruzadas} cruzadas.`,
      () => { usarProgresso(remoto); toast('☁️ Progresso da conta carregado.'); fim(); }, 'Usar o da conta',
      () => { enviarProgresso(); toast('Progresso deste aparelho salvo na conta.'); fim(); }, 'Usar o deste aparelho');
  }
  function sairConta(expirou) {
    if (conta && !expirou) chamar('POST', '/api/sair').catch(() => {});
    conta = null; localStorage.removeItem(CHAVE_CONTA); delete S.dono;
    if (expirou) { toast('Sua sessão expirou. Entre de novo.'); if (telaAtual !== 'boasvindas') { guardarAtual(); ir('boasvindas'); } }
  }
  async function puxarDaNuvem() {
    if (!conta || !temServidor) return;
    try {
      const r = await chamar('GET', '/api/progresso');
      reconciliar(r.progresso, () => { if (telaAtual !== 'jogo') ir(telaAtual); });
    } catch (e) { syncStatus = 'Sem conexão com o servidor agora.'; }
  }

  function aplicarTema() {
    const t = TEMAS.find((x) => x.id === S.loja.tema) || TEMAS[0];
    const r = document.documentElement.style;
    for (const [k, v] of Object.entries(t.v)) r.setProperty('--' + k, v);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', t.v.pri);
  }
  aplicarTema();

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

  // ================================================================ confete
  function confete(qtd = 140) {
    const cv = document.getElementById('confete'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cores = ['#ffb02e', '#2f6fd1', '#e0483e', '#1f9d68', '#b0479b', '#13a3a3', '#ffd84d'];
    const ps = Array.from({ length: qtd }, () => ({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.4, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: cores[(Math.random() * cores.length) | 0] }));
    let t = 0;
    (function passo() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
      if (++t < 200) requestAnimationFrame(passo); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

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
  function confirmar(titulo, texto, sim, rotulo = 'Confirmar', nao = null, rotuloNao = 'Cancelar') {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="janela"><h2 style="font-size:24px">${esc(titulo)}</h2><p style="text-align:center;font-weight:600">${esc(texto)}</p><div class="acoes"><button class="btn" data-a="nao">${esc(rotuloNao)}</button><button class="btn pri" data-a="sim">${esc(rotulo)}</button></div></div>`;
    m.onclick = (e) => { const a = e.target.dataset.a; if (a) { m.remove(); if (a === 'sim') sim(); else if (nao) nao(); } };
    document.body.appendChild(m);
  }

  // ================================================================ XP e moedas
  const xpParaProximo = (n) => 120 + (n - 1) * 80;
  function ganharXP(q) {
    S.xp += q;
    while (S.xp >= xpParaProximo(S.nivel)) {
      S.xp -= xpParaProximo(S.nivel); S.nivel++; S.moedas += 50;
      toast(`⭐ Você subiu para o nível ${S.nivel}! +50 moedas`); sfx.fim();
    }
  }
  function gastar(q) {
    if (S.moedas < q) { toast(`Moedas insuficientes: faltam ${q - S.moedas} 🪙. Jogue, cumpra missões e resgate conquistas!`); sfx.erro(); return false; }
    S.moedas -= q; S.stats.gastas += q; return true;
  }

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
    { id: 'novas', ev: 'newword', alvos: [10, 15], premio: 50, txt: (n) => `Aprenda ${n} palavras novas para o dicionário` },
  ];
  function garantirMissoes() {
    if (S.missoes.data === hoje() && S.missoes.lista.length) return;
    const rng = G.rngDe(G.hashTexto('missoes' + hoje()));
    const escolhidas = G.embaralhar(MISSOES, rng).slice(0, 3);
    S.missoes = {
      data: hoje(),
      lista: escolhidas.map((m) => ({ id: m.id, ev: m.ev, alvo: m.alvos[Math.floor(rng() * m.alvos.length)], prog: 0, premio: m.premio, cat: m.id === 'tema' ? CATS[Math.floor(rng() * CATS.length)].id : null, resgatada: false })),
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

  // ================================================================ conquistas (desbloqueia → resgata moedas)
  const totalAprendidas = () => Object.keys(S.aprendidas).length;
  const mundosCompletos = () => CATS.filter((c) => Object.keys(S.progresso[c.id] || {}).length >= niveisDe(c.id)).length;
  const CONQUISTAS = [
    { id: 'primeira', ic: '🎉', nome: 'Primeiros passos', desc: 'Complete sua primeira cruzada', ok: () => S.stats.cruzadas >= 1, premio: 30 },
    { id: 'c10', ic: '📗', nome: 'Aquecendo', desc: 'Complete 10 cruzadas', ok: () => S.stats.cruzadas >= 10, premio: 80 },
    { id: 'c50', ic: '📘', nome: 'Viciado em cruzadas', desc: 'Complete 50 cruzadas', ok: () => S.stats.cruzadas >= 50, premio: 200 },
    { id: 'c100', ic: '📕', nome: 'Mestre das cruzadas', desc: 'Complete 100 cruzadas', ok: () => S.stats.cruzadas >= 100, premio: 400 },
    { id: 'p100', ic: '🔤', nome: 'Cem palavras', desc: 'Acerte 100 palavras', ok: () => S.stats.palavras >= 100, premio: 60 },
    { id: 'p500', ic: '🔠', nome: 'Quinhentas palavras', desc: 'Acerte 500 palavras', ok: () => S.stats.palavras >= 500, premio: 200 },
    { id: 'p1000', ic: '🏅', nome: 'Mil palavras', desc: 'Acerte 1000 palavras', ok: () => S.stats.palavras >= 1000, premio: 400 },
    { id: 'a50', ic: '📚', nome: 'Estudante', desc: 'Aprenda 50 palavras diferentes', ok: () => totalAprendidas() >= 50, premio: 60 },
    { id: 'a250', ic: '🎓', nome: 'Sabichão', desc: 'Aprenda 250 palavras diferentes', ok: () => totalAprendidas() >= 250, premio: 200 },
    { id: 'a500', ic: '🧠', nome: 'Enciclopédia ambulante', desc: 'Aprenda 500 palavras diferentes', ok: () => totalAprendidas() >= 500, premio: 400 },
    { id: 'a1000', ic: '👑', nome: 'Dicionário completo', desc: 'Aprenda 1000 palavras diferentes', ok: () => totalAprendidas() >= 1000, premio: 1000 },
    { id: 's1', ic: '💪', nome: 'Sem ajuda', desc: 'Complete uma cruzada sem usar nenhuma ajuda', ok: () => S.stats.semDica >= 1, premio: 40 },
    { id: 's10', ic: '🦾', nome: 'Independente', desc: 'Complete 10 cruzadas sem ajuda', ok: () => S.stats.semDica >= 10, premio: 150 },
    { id: 'rapido', ic: '⚡', nome: 'Relâmpago', desc: 'Complete uma cruzada em menos de 2 minutos', ok: () => S.stats.melhorTempo > 0 && S.stats.melhorTempo <= 120, premio: 80 },
    { id: 'e10', ic: '🌟', nome: 'Colecionador de estrelas', desc: 'Ganhe 3 estrelas em 10 cruzadas', ok: () => S.stats.tresEstrelas >= 10, premio: 120 },
    { id: 'm1', ic: '🗺️', nome: 'Conquistador', desc: 'Complete todos os níveis de um mundo', ok: () => mundosCompletos() >= 1, premio: 120 },
    { id: 'm5', ic: '🧭', nome: 'Desbravador', desc: 'Complete 5 mundos', ok: () => mundosCompletos() >= 5, premio: 300 },
    { id: 'mtodos', ic: '🌎', nome: 'Volta ao mundo do saber', desc: 'Complete todos os mundos da campanha', ok: () => mundosCompletos() >= CATS.length, premio: 1000 },
    { id: 'temas', ic: '🧩', nome: 'Curioso', desc: 'Jogue cruzadas de 10 temas diferentes', ok: () => Object.keys(S.stats.temas).length >= 10, premio: 80 },
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
    { id: 'compra1', ic: '🛍️', nome: 'Primeira compra', desc: 'Compre qualquer coisa na loja', ok: () => S.stats.compras >= 1, premio: 30 },
    { id: 'tema3', ic: '🎨', nome: 'Decorador', desc: 'Tenha 4 temas visuais', ok: () => S.loja.temas.length >= 4, premio: 100 },
    { id: 'avatar5', ic: '🎭', nome: 'Colecionador de avatares', desc: 'Tenha 5 avatares', ok: () => S.loja.avatares.length >= 5, premio: 100 },
    { id: 'gastar1000', ic: '💸', nome: 'Grande cliente', desc: 'Gaste 1000 moedas na loja e em ajudas', ok: () => S.stats.gastas >= 1000, premio: 200 },
    { id: 'rico', ic: '💰', nome: 'Poupador', desc: 'Tenha 1000 moedas ao mesmo tempo', ok: () => S.moedas >= 1000, premio: 100 },
  ];
  function verificarConquistas() {
    const novas = [];
    for (const c of CONQUISTAS) {
      if (S.conquistas[c.id] || !c.ok()) continue;
      S.conquistas[c.id] = Date.now(); novas.push(c);
      toast(`🏆 Conquista desbloqueada: ${c.nome}! Resgate ${c.premio} 🪙 em Conquistas`, 3500);
    }
    if (novas.length) { sfx.moeda(); salvar(); }
    return novas;
  }
  const conquistasProntas = () => CONQUISTAS.filter((c) => S.conquistas[c.id] && !S.conqResg[c.id]).length;

  // ================================================================ campanha
  function estrelasMundo(id) { return Object.values(S.progresso[id] || {}).reduce((a, b) => a + b, 0); }
  function mundoLiberado(i) { return i === 0 || Object.keys(S.progresso[CATS[i - 1].id] || {}).length >= Math.ceil(niveisDe(CATS[i - 1].id) * 0.6); }
  function nivelLiberado(catId, n) { return n === 1 || !!(S.progresso[catId] || {})[n - 1]; }
  function proximoNivel() {
    for (let i = 0; i < CATS.length; i++) {
      if (!mundoLiberado(i)) break;
      for (let n = 1; n <= niveisDe(CATS[i].id); n++) if (!(S.progresso[CATS[i].id] || {})[n]) return { cat: CATS[i].id, n };
    }
    return { cat: CATS[0].id, n: 1 };
  }

  // Escolhe palavras priorizando as que o jogador nunca viu (e depois as vistas há mais tempo)
  function candidatas(lista, alvo, rng) {
    const mix = G.embaralhar(lista, rng);
    const ineditas = mix.filter((p) => !S.vistas[p.w]);
    const vistas = mix.filter((p) => S.vistas[p.w]).sort((a, b) => S.vistas[a.w] - S.vistas[b.w]);
    // só inéditas enquanto houver o suficiente para montar uma boa grade
    if (ineditas.length >= Math.ceil(alvo * 1.6)) return ineditas.slice(0, Math.max(Math.ceil(alvo * 2.5), 18));
    // senão: todas as inéditas + as vistas há mais tempo (revisão)
    return ineditas.concat(vistas.slice(0, Math.max(0, Math.ceil(alvo * 2.2) - ineditas.length)));
  }

  // ================================================================ telas
  let telaAtual = 'inicio';
  function topo(titulo, voltar = 'inicio', arg = '') {
    return `<div class="topo">
      ${voltar ? `<button class="voltar" data-ir="${voltar}" data-arg="${arg}">← Voltar</button>` : ''}
      <h2>${titulo}</h2>
      <div class="nivelbox"><div class="avatar">${S.loja.avatar}<span class="lv">${S.nivel}</span></div><div><small style="font-weight:800">Nível ${S.nivel} · ${S.xp}/${xpParaProximo(S.nivel)} XP</small><div class="xpbar"><i style="width:${(S.xp / xpParaProximo(S.nivel) * 100).toFixed(0)}%"></i></div></div></div>
      <button class="chip moedas" data-ir="loja" style="border:0">🪙 <span id="moedasTopo">${S.moedas}</span></button>
      <span class="chip" title="Dias seguidos jogando">🔥 ${S.dias.ultimo === hoje() || S.dias.ultimo === diasAtras(1) ? S.dias.seq : 0}${S.loja.itens.congelar ? ` · 🧊${S.loja.itens.congelar}` : ''}</span>
      ${temServidor ? `<button class="chip" data-ir="conta" style="border:0">${conta ? '☁️ ' + esc(conta.usuario) : '👤 Entrar'}</button>` : ''}
    </div>`;
  }
  const TELAS = {};
  const NAV = [['inicio', '🏠', 'Início'], ['mapa', '🗺️', 'Mapa'], ['loja', '🛍️', 'Loja'], ['conquistas', '🏆', 'Prêmios'], ['mais', '☰', 'Mais']];
  const DONO_NAV = { mundo: 'mapa', livre: 'inicio', missoes: 'inicio', dicionario: 'mais', stats: 'mais', config: 'mais', conta: 'mais' };
  function desenharNav() {
    const el = document.getElementById('nav');
    if (telaAtual === 'jogo' || telaAtual === 'boasvindas') { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const ativo = DONO_NAV[telaAtual] || telaAtual, cp = conquistasProntas();
    el.innerHTML = NAV.map(([t, ic, nome]) => `<button data-nav="${t}" class="${t === ativo ? 'on' : ''}">${t === 'conquistas' && cp ? `<i class="badge">${cp}</i>` : ''}<span>${ic}</span>${nome}</button>`).join('');
  }
  document.getElementById('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b) ir(b.dataset.nav); });
  const precisaEntrar = () => temServidor && !conta;
  function ir(t, arg) {
    if (precisaEntrar() && t !== 'boasvindas') t = 'boasvindas';
    pararCronometro();
    telaAtual = t;
    window.scrollTo(0, 0);
    TELAS[t](arg);
    desenharNav();
  }
  $app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) { if (telaAtual === 'jogo') guardarAtual(); ir(b.dataset.ir, b.dataset.arg || undefined); }
  });

  function logoHTML() {
    // "CRUZADAS" na horizontal cruzando "SABER" na vertical (A em comum)
    const linhas = 5, cols = 8, colX = 4;
    let h = `<div class="logo" style="grid-template-columns:repeat(${cols},auto)">`, k = 0;
    for (let l = 0; l < linhas; l++) for (let c = 0; c < cols; c++) {
      let ch = '', cls = 'x';
      if (l === 1) { ch = 'CRUZADAS'[c]; cls = c === colX ? 'b' : ''; }
      else if (c === colX) { ch = 'SABER'[l]; cls = 'b'; }
      h += `<div class="t ${cls}" style="animation-delay:${ch ? (k++) * 0.05 : 0}s">${ch}</div>`;
    }
    return h + '</div>';
  }

  TELAS.inicio = function () {
    garantirMissoes();
    const prox = proximoNivel(), pc = catDe(prox.cat);
    const diarioFeito = !!S.diario.feitos[hoje()];
    const mp = missoesProntas();
    const apr = totalAprendidas(), tot = window.TODAS_PALAVRAS.length;
    $app.innerHTML = `<div class="tela">${topo('', '')}
      <div class="marca"><img src="logo.svg" alt=""><div><h1>Palavr<span>ário</span></h1><small>CRUZADAS DO SABER · ${tot} PALAVRAS</small></div></div>
      <div class="painelinicio">
        ${S.atual
          ? `<button class="jogar" id="retomar"><div class="play">⏯</div><div><b>Continuar</b><small>${esc(S.atual.titulo)}</small></div></button>`
          : `<button class="jogar" id="jogar"><div class="play">▶</div><div><b>Jogar</b><small>${pc.icone} ${esc(pc.nome)} · nível ${prox.n}</small></div></button>`}
        <div class="atalhos">
          <button class="atalho" id="diario"><span class="ic">📅</span>Diário<small>${diarioFeito ? '✅ feito' : '+50 🪙'}</small></button>
          <button class="atalho" data-ir="livre"><span class="ic">🎲</span>Livre<small>escolha o tema</small></button>
          <button class="atalho" data-ir="missoes">${mp ? `<span class="badge">${mp}</span>` : ''}<span class="ic">🎯</span>Missões<small>${S.missoes.lista.filter((m) => m.prog >= m.alvo).length}/3 hoje</small></button>
        </div>
        <div class="resumo"><div>📚 ${apr} de ${tot} palavras aprendidas</div><div class="prog"><i style="width:${(apr / tot * 100).toFixed(1)}%"></i></div></div>
        ${S.atual ? `<button class="atalho" id="jogar" style="grid-template-columns:auto 1fr;justify-items:start;padding:10px 14px"><span class="ic">▶️</span>Nova cruzada da campanha: ${pc.icone} ${esc(pc.nome)} · nível ${prox.n}</button>` : ''}
      </div></div>`;
    document.getElementById('jogar').onclick = () => iniciarCampanha(prox.cat, prox.n);
    document.getElementById('diario').onclick = iniciarDiario;
    const r = document.getElementById('retomar'); if (r) r.onclick = retomar;
  };

  TELAS.mais = function () {
    const it = (t, ic, nome, desc) => `<button class="item" data-ir="${t}" style="width:100%;border:0;text-align:left"><div class="ic">${ic}</div><div class="tx"><b>${nome}</b><small>${desc}</small></div><span style="font-weight:900;color:var(--muted)">›</span></button>`;
    $app.innerHTML = `<div class="tela">${topo('Mais', '')}
      ${it('missoes', '🎯', 'Missões diárias', `${S.missoes.lista.filter((m) => m.prog >= m.alvo).length}/3 concluídas hoje`)}
      ${it('dicionario', '📚', 'Meu dicionário', `${totalAprendidas()} palavras aprendidas`)}
      ${it('stats', '📊', 'Estatísticas', 'Seu desempenho')}
      ${temServidor ? it('conta', '👤', 'Minha conta', conta ? `Conectado como ${esc(conta.usuario)}` : 'Crie login e senha para salvar na nuvem') : ''}
      ${it('config', '⚙️', 'Configurações', 'Som, ajudas, teclado')}
    </div>`;
  };

  TELAS.conta = function (aba) {
    aba = aba || 'entrar';
    if (!temServidor) { $app.innerHTML = `<div class="tela">${topo('Minha conta', 'mais')}<div class="formconta"><b>Login disponível na versão online do jogo.</b><small>Aqui o progresso fica salvo só neste navegador.</small></div></div>`; return; }
    if (conta) {
      $app.innerHTML = `<div class="tela">${topo('Minha conta', 'mais')}
        <div class="formconta" style="text-align:center">
          <div style="font-size:54px">${S.loja.avatar}</div>
          <b style="font-size:22px">${esc(conta.usuario)}</b>
          <small style="color:var(--muted);font-weight:700">Nível ${S.nivel} · ${totalAprendidas()} palavras · ${S.moedas} 🪙</small>
          <small style="color:var(--muted);font-weight:700" id="syncst">${esc(syncStatus || 'Seu progresso é salvo na nuvem automaticamente.')}</small>
          <button class="btn pri" id="sync">☁️ Sincronizar agora</button>
          <button class="btn" id="sair">Sair da conta</button>
        </div></div>`;
      document.getElementById('sync').onclick = async () => { await enviarProgresso(); document.getElementById('syncst').textContent = syncStatus; toast(syncStatus); };
      document.getElementById('sair').onclick = () => confirmar('Sair da conta?', 'O progresso continua neste aparelho e na sua conta.', () => { sairConta(); ir('boasvindas'); toast('Você saiu da conta.'); }, 'Sair');
      return;
    }
    formularioConta(aba, false);
  };

  // Formulário de entrar/criar conta. entrada = true: é a primeira tela do jogo (tela cheia, sem menu).
  function formularioConta(aba, entrada) {
    const cad = aba === 'criar';
    const cabecalho = entrada
      ? `<div class="marca" style="margin:18px 0 6px"><img src="logo.svg" alt=""><div><h1>Palavr<span>ário</span></h1><small>CRUZADAS DO SABER · ${window.TODAS_PALAVRAS.length} PALAVRAS</small></div></div>
         <p style="text-align:center;color:var(--muted);font-weight:800;margin:0 0 12px">Aprenda brincando: campanha, desafio diário, missões e conquistas.</p>`
      : topo('Minha conta', 'mais');
    $app.innerHTML = `<div class="tela">${cabecalho}
      <div class="abas" style="justify-content:center"><button class="btn ${!cad ? 'on' : ''}" data-aba="entrar">Entrar</button><button class="btn ${cad ? 'on' : ''}" data-aba="criar">Criar conta</button></div>
      <form class="formconta" id="fconta" autocomplete="on">
        <div style="text-align:center">${entrada ? '' : '<img src="logo.svg" alt="" style="width:56px"><br>'}<b>${cad ? 'Crie sua conta e jogue em qualquer aparelho' : 'Entre para continuar seu progresso'}</b></div>
        <label for="cu">Usuário</label><input id="cu" name="username" autocomplete="username" autocapitalize="none" placeholder="ex.: maria.silva" maxlength="20" required>
        <label for="cs">Senha</label><input id="cs" name="password" type="password" autocomplete="${cad ? 'new-password' : 'current-password'}" minlength="6" required placeholder="mínimo 6 caracteres">
        ${cad ? '<label for="cs2">Confirme a senha</label><input id="cs2" type="password" autocomplete="new-password" minlength="6" required>' : ''}
        <div class="erro" id="cerro"></div>
        <button class="btn pri" type="submit">${cad ? 'Criar conta' : 'Entrar'}</button>
        <small style="color:var(--muted);font-weight:700;text-align:center">A senha é guardada de forma protegida (criptografada) no servidor.</small>
      </form></div>`;
    $app.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => formularioConta(b.dataset.aba, entrada)));
    document.getElementById('fconta').onsubmit = async (e) => {
      e.preventDefault();
      const erro = document.getElementById('cerro');
      const usuario = document.getElementById('cu').value.trim().toLowerCase(), senha = document.getElementById('cs').value;
      if (cad && senha !== document.getElementById('cs2').value) { erro.textContent = 'As senhas não conferem.'; return; }
      erro.textContent = 'Aguarde…';
      try {
        const r = await chamar('POST', cad ? '/api/cadastro' : '/api/login', { usuario, senha });
        conta = { token: r.token, usuario: r.usuario };
        localStorage.setItem(CHAVE_CONTA, JSON.stringify(conta));
        localStorage.setItem('palavrario_ja_entrou', '1');
        sfx.moeda();
        if (cad) { await enviarProgresso(); toast('Conta criada! Seu progresso agora fica salvo na nuvem.'); ir('inicio'); }
        else { toast(`Bem-vindo, ${r.usuario}!`); reconciliar(r.progresso, () => ir('inicio')); }
      } catch (er) { erro.textContent = er.message; sfx.erro(); }
    };
    if (entrada) document.getElementById('cu').focus();
  }

  // Primeira tela da versão online: entrar ou criar conta
  TELAS.boasvindas = function (aba) {
    formularioConta(aba || (localStorage.getItem('palavrario_ja_entrou') ? 'entrar' : 'criar'), true);
  };

  TELAS.mapa = function () {
    $app.innerHTML = `<div class="tela">${topo('Mapa dos mundos', '')}
      <p style="color:var(--muted);margin:0 4px 14px;font-weight:700">Complete 60% dos níveis de um mundo para liberar o próximo.</p>
      <div class="mundos">${CATS.map((c, i) => {
        const lib = mundoLiberado(i), feitos = Object.keys(S.progresso[c.id] || {}).length, tot = niveisDe(c.id);
        return `<button class="mundo ${lib ? '' : 'trancado'}" style="--cor:${c.cor}" data-ic="${c.icone}" ${lib ? `data-ir="mundo" data-arg="${c.id}"` : 'disabled'}>
          <div class="ic">${lib ? c.icone : '🔒'}</div><b>${i + 1}. ${esc(c.nome)}</b>
          <small>${feitos}/${tot} níveis · ⭐ ${estrelasMundo(c.id)}/${tot * 3}</small>
          <div class="prog"><i style="width:${feitos / tot * 100}%"></i></div></button>`;
      }).join('')}</div></div>`;
  };

  TELAS.mundo = function (catId) {
    const c = catDe(catId), tot = niveisDe(catId);
    $app.innerHTML = `<div class="tela" style="--mundo:${c.cor}">${topo(`${c.icone} ${esc(c.nome)}`, 'mapa')}
      <p style="color:var(--muted);margin:0 4px 14px;font-weight:700">${c.palavras.length} palavras neste tema · ${tot} níveis. As cruzadas trazem primeiro as palavras que você ainda não viu.</p>
      <div class="niveis">${Array.from({ length: tot }, (_, k) => {
        const n = k + 1, est = (S.progresso[catId] || {})[n] || 0, lib = nivelLiberado(catId, n);
        return `<button class="nivel ${lib ? '' : 'trancado'}" data-n="${n}" ${lib ? '' : 'disabled'}>${lib ? n : '🔒'}<small>${'★'.repeat(est)}${'☆'.repeat(3 - est)}</small></button>`;
      }).join('')}</div></div>`;
    $app.querySelectorAll('.nivel[data-n]').forEach((b) => (b.onclick = () => iniciarCampanha(catId, +b.dataset.n)));
  };

  TELAS.livre = function () {
    let tam = 'media';
    $app.innerHTML = `<div class="tela">${topo('Jogo livre')}
      <b style="margin-left:4px">Tamanho da cruzada</b>
      <div class="tamanhos"><button class="btn" data-t="pequena">Pequena (8)</button><button class="btn on" data-t="media">Média (12)</button><button class="btn" data-t="grande">Grande (18)</button></div>
      <b style="margin-left:4px">Escolha o tema</b>
      <div class="mundos" style="margin-top:10px">
        <button class="mundo" style="--cor:#5b6475" data-ic="🌈" data-cat="todas"><div class="ic">🌈</div><b>Todos os temas</b><small>${window.TODAS_PALAVRAS.length} palavras misturadas</small></button>
        ${CATS.map((c) => { const vistos = c.palavras.filter((p) => S.vistas[p.w]).length; return `<button class="mundo" style="--cor:${c.cor}" data-ic="${c.icone}" data-cat="${c.id}"><div class="ic">${c.icone}</div><b>${esc(c.nome)}</b><small>${c.palavras.length} palavras · ${c.palavras.length - vistos} inéditas</small></button>`; }).join('')}
      </div></div>`;
    $app.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { tam = b.dataset.t; $app.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); }));
    $app.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
      const cfg = { pequena: [8, 11], media: [12, 13], grande: [18, 15] }[tam];
      const cat = b.dataset.cat, lista = cat === 'todas' ? window.TODAS_PALAVRAS : catDe(cat).palavras;
      novoJogo({ modo: 'livre', cat, titulo: `Jogo livre — ${cat === 'todas' ? 'Todos os temas' : catDe(cat).nome}`, seed: (Math.random() * 1e9) | 0, alvo: Math.min(cfg[0], Math.floor(lista.length * 0.6)), maxDim: cfg[1] });
    }));
  };

  TELAS.loja = function (aba) {
    aba = aba || 'temas';
    const L = S.loja;
    let corpo = '';
    if (aba === 'temas') {
      corpo = TEMAS.map((t) => {
        const tem = L.temas.includes(t.id), eq = L.tema === t.id, v = t.v;
        return `<div class="produto ${eq ? 'equipado' : ''}">
          <div class="vitrine" style="background:${v.fundo}"><div class="mini">${[v.pri, v.pri2, v.celword, v.celok].map((c) => `<i style="background:${c}"></i>`).join('')}</div></div>
          <b>${esc(t.nome)}</b><small>${esc(t.desc)}</small>
          ${eq ? '<span class="chip">✅ Em uso</span>' : tem ? `<button class="btn verde" data-eq-tema="${t.id}">Usar</button>` : `<button class="btn amar" data-comp-tema="${t.id}">🪙 ${t.preco}</button>`}
        </div>`;
      }).join('');
    } else if (aba === 'avatares') {
      corpo = AVATARES.map(([a, p]) => {
        const tem = L.avatares.includes(a), eq = L.avatar === a;
        return `<div class="produto ${eq ? 'equipado' : ''}"><div class="vitrine" style="background:var(--bg)">${a}</div>
          ${eq ? '<span class="chip">✅ Em uso</span>' : tem ? `<button class="btn verde" data-eq-av="${a}">Usar</button>` : `<button class="btn amar" data-comp-av="${a}">🪙 ${p}</button>`}</div>`;
      }).join('');
    } else {
      corpo = ITENS.map((it) => `<div class="produto"><div class="vitrine" style="background:var(--bg)">${it.ic}</div>
        <b>${esc(it.nome)}</b><small>${esc(it.desc)}</small><span class="chip">Você tem: ${L.itens[it.id]}</span>
        <button class="btn amar" data-comp-item="${it.id}">🪙 ${it.preco}</button></div>`).join('');
    }
    $app.innerHTML = `<div class="tela">${topo('🛍️ Loja', '')}
      <div class="abas">${[['temas', '🎨 Temas'], ['avatares', '🎭 Avatares'], ['itens', '🎒 Ajudas e itens']].map(([k, t]) => `<button class="btn ${aba === k ? 'on' : ''}" data-aba="${k}">${t}</button>`).join('')}</div>
      <div class="loja">${corpo}</div>
      <p style="color:var(--muted);margin:16px 4px;font-weight:700">Ganhe moedas completando cruzadas, missões diárias, conquistas e subindo de nível.</p></div>`;
    $app.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => TELAS.loja(b.dataset.aba)));
    const comprou = (msg) => { S.stats.compras++; sfx.moeda(); confete(60); toast(msg); verificarConquistas(); salvar(); TELAS.loja(aba); };
    $app.querySelectorAll('[data-comp-tema]').forEach((b) => (b.onclick = () => {
      const t = TEMAS.find((x) => x.id === b.dataset.compTema);
      confirmar(`Comprar tema ${t.nome}?`, `Custa ${t.preco} moedas.`, () => { if (!gastar(t.preco)) return; L.temas.push(t.id); L.tema = t.id; aplicarTema(); comprou(`🎨 Tema ${t.nome} comprado e aplicado!`); }, 'Comprar');
    }));
    $app.querySelectorAll('[data-eq-tema]').forEach((b) => (b.onclick = () => { L.tema = b.dataset.eqTema; aplicarTema(); salvar(); TELAS.loja(aba); }));
    $app.querySelectorAll('[data-comp-av]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.compAv, p = AVATARES.find((x) => x[0] === a)[1];
      confirmar(`Comprar avatar ${a}?`, `Custa ${p} moedas.`, () => { if (!gastar(p)) return; L.avatares.push(a); L.avatar = a; comprou(`🎭 Novo avatar: ${a}`); }, 'Comprar');
    }));
    $app.querySelectorAll('[data-eq-av]').forEach((b) => (b.onclick = () => { L.avatar = b.dataset.eqAv; salvar(); TELAS.loja(aba); }));
    $app.querySelectorAll('[data-comp-item]').forEach((b) => (b.onclick = () => {
      const it = ITENS.find((x) => x.id === b.dataset.compItem);
      if (!gastar(it.preco)) return;
      L.itens[it.id] += it.qtd; comprou(`${it.ic} ${it.nome} comprado! (+${it.qtd})`);
    }));
  };

  TELAS.missoes = function () {
    garantirMissoes();
    $app.innerHTML = `<div class="tela">${topo('🎯 Missões diárias')}
      <p style="color:var(--muted);margin:0 4px 12px;font-weight:700">Novas missões todos os dias. Complete e resgate moedas e XP.</p>
      ${S.missoes.lista.map((m, i) => `<div class="item ${m.prog >= m.alvo && !m.resgatada ? 'pronta' : ''}"><div class="ic">${m.resgatada ? '✅' : m.prog >= m.alvo ? '🎁' : '🎯'}</div>
        <div class="tx"><b>${esc(txtMissao(m))}</b><small>${m.prog}/${m.alvo} · prêmio: ${m.premio} 🪙 + ${m.premio} XP</small><div class="prog"><i style="width:${m.prog / m.alvo * 100}%"></i></div></div>
        ${m.resgatada ? '<span class="chip">Resgatada</span>' : `<button class="btn amar" data-m="${i}" ${m.prog >= m.alvo ? '' : 'disabled'}>Resgatar</button>`}</div>`).join('')}</div>`;
    $app.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => {
      const m = S.missoes.lista[+b.dataset.m];
      if (m.resgatada || m.prog < m.alvo) return;
      m.resgatada = true; S.moedas += m.premio; ganharXP(m.premio); S.stats.missoes++;
      sfx.moeda(); confete(50); toast(`+${m.premio} moedas e +${m.premio} XP`);
      verificarConquistas(); salvar(); TELAS.missoes();
    }));
  };

  TELAS.conquistas = function () {
    const prontas = conquistasProntas();
    const ord = CONQUISTAS.slice().sort((a, b) => (S.conquistas[b.id] && !S.conqResg[b.id] ? 1 : 0) - (S.conquistas[a.id] && !S.conqResg[a.id] ? 1 : 0));
    $app.innerHTML = `<div class="tela">${topo(`🏆 Conquistas (${Object.keys(S.conquistas).length}/${CONQUISTAS.length})`, '')}
      ${prontas > 1 ? `<div class="acoes" style="margin-bottom:12px"><button class="btn amar" id="todas">🎁 Resgatar todas (${prontas})</button></div>` : ''}
      ${ord.map((c) => {
        const des = !!S.conquistas[c.id], res = !!S.conqResg[c.id];
        return `<div class="item ${des ? (res ? '' : 'pronta') : 'bloq'}"><div class="ic">${c.ic}</div><div class="tx"><b>${esc(c.nome)}</b><small>${esc(c.desc)} · ${c.premio} 🪙</small></div>
          ${!des ? '<span class="chip">🔒</span>' : res ? '<span class="chip">✅</span>' : `<button class="btn amar" data-c="${c.id}">Resgatar ${c.premio} 🪙</button>`}</div>`;
      }).join('')}</div>`;
    const resgatar = (c) => { S.conqResg[c.id] = true; S.moedas += c.premio; };
    $app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
      const c = CONQUISTAS.find((x) => x.id === b.dataset.c); resgatar(c);
      sfx.moeda(); confete(70); toast(`+${c.premio} moedas!`); verificarConquistas(); salvar(); TELAS.conquistas();
    }));
    const t = document.getElementById('todas');
    if (t) t.onclick = () => { let soma = 0; for (const c of CONQUISTAS) if (S.conquistas[c.id] && !S.conqResg[c.id]) { resgatar(c); soma += c.premio; } sfx.moeda(); confete(120); toast(`+${soma} moedas!`); verificarConquistas(); salvar(); TELAS.conquistas(); };
  };

  TELAS.dicionario = function () {
    $app.innerHTML = `<div class="tela dic">${topo(`📚 Meu dicionário (${totalAprendidas()}/${window.TODAS_PALAVRAS.length})`)}
      <input class="busca" id="busca" placeholder="Buscar palavra aprendida…">
      <p style="color:var(--muted);margin:10px 4px;font-weight:700">Cada palavra que você acerta sem revelar entra aqui com o seu significado.</p>
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
  };

  TELAS.stats = function () {
    const st = S.stats;
    const box = (v, t) => `<div class="stat"><b>${v}</b><small>${t}</small></div>`;
    const min = Math.round(st.tempoTotal / 60);
    $app.innerHTML = `<div class="tela">${topo('📊 Estatísticas')}<div class="stats">
      ${box(st.cruzadas, 'cruzadas completas')}${box(st.palavras, 'palavras acertadas')}${box(totalAprendidas(), 'palavras no dicionário')}
      ${box(Object.keys(S.vistas).length + '/' + window.TODAS_PALAVRAS.length, 'palavras já vistas')}
      ${box(st.semDica, 'cruzadas sem ajuda')}${box(st.tresEstrelas, 'vezes com 3 estrelas')}${box(st.melhorTempo ? fmtTempo(st.melhorTempo) : '—', 'melhor tempo')}
      ${box(min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}min` : `${min} min`, 'tempo total jogando')}
      ${box(st.diarios, 'desafios diários')}${box(S.dias.melhor, 'maior sequência de dias')}${box(st.dicas, 'ajudas usadas')}
      ${box(mundosCompletos() + '/' + CATS.length, 'mundos completos')}${box(Object.keys(S.conquistas).length + '/' + CONQUISTAS.length, 'conquistas')}${box(st.gastas, 'moedas gastas')}
    </div></div>`;
  };

  TELAS.config = function () {
    const sw = (k, t) => `<div class="opcao"><span>${t}</span><input type="checkbox" data-k="${k}" ${S.cfg[k] ? 'checked' : ''} style="width:22px;height:22px"></div>`;
    $app.innerHTML = `<div class="tela">${topo('⚙️ Configurações')}
      ${sw('som', '🔊 Sons')}
      ${sw('erros', '❌ Mostrar letras erradas automaticamente (não conta como ajuda)')}
      ${sw('pular', '⏭️ Pular casas já preenchidas ao digitar')}
      <div class="opcao"><span>⌨️ Teclado na tela</span><select id="tecl"><option value="auto">Automático (celular/tablet)</option><option value="sempre">Sempre</option><option value="nunca">Nunca</option></select></div>
      <div class="opcao"><span>🎨 Tema visual e avatar</span><button class="btn" data-ir="loja">Abrir loja</button></div>
      <div class="opcao"><span>🗑️ Apagar todo o progresso</span><button class="btn" id="reset" style="background:var(--bad);color:#fff">Apagar</button></div>
      <p style="color:var(--muted);margin:16px 4px;font-weight:700">Seu progresso fica salvo neste navegador.</p></div>`;
    $app.querySelectorAll('[data-k]').forEach((i) => (i.onchange = () => { S.cfg[i.dataset.k] = i.checked; salvar(); }));
    const t = document.getElementById('tecl'); t.value = S.cfg.teclado; t.onchange = () => { S.cfg.teclado = t.value; salvar(); };
    document.getElementById('reset').onclick = () => confirmar('Apagar progresso?', 'Todo o seu progresso, moedas, compras e conquistas serão apagados.', () => { S = novoSave(); salvar(); aplicarTema(); ir('inicio'); toast('Progresso apagado.'); }, 'Apagar');
  };

  // ================================================================ jogo
  let J = null;
  let cron = null;
  function pararCronometro() { if (cron) { clearInterval(cron); cron = null; } }

  function iniciarCampanha(catId, n) {
    const c = catDe(catId), p = paramsNivel(catId, n);
    novoJogo({ modo: 'campanha', cat: catId, n, titulo: `${c.icone} ${c.nome} — nível ${n}`, seed: (Math.random() * 1e9) | 0, alvo: p.alvo, maxDim: p.maxDim });
  }
  function iniciarDiario() {
    if (S.diario.feitos[hoje()]) { toast('Você já completou o desafio de hoje! Volte amanhã.'); return; }
    novoJogo({ modo: 'diario', cat: 'todas', titulo: `📅 Desafio diário — ${hoje().split('-').reverse().join('/')}`, seed: G.hashTexto('diario' + hoje()), alvo: 14, maxDim: 14, fixo: true });
  }
  function novoJogo(o) {
    const lista = o.cat === 'todas' ? window.TODAS_PALAVRAS : catDe(o.cat).palavras;
    // desafio diário é igual para todos; os demais priorizam palavras inéditas para o jogador
    const pool = o.fixo ? lista : candidatas(lista, o.alvo, G.rngDe(o.seed));
    const cz = G.gerarCruzada(pool, { alvo: o.alvo, maxDim: o.maxDim, seed: o.seed });
    const agora = Date.now();
    cz.palavras.forEach((p) => (S.vistas[p.w] = agora));
    J = Object.assign({}, o, { cz, ent: cz.grade.map((r) => r.map(() => '')), rev: {}, resolvidas: {}, palavrasRev: {}, dicas: 0, tempo: 0, sel: null });
    salvar();
    abrirJogo();
  }
  function guardarAtual() {
    if (!J || J.concluida) return;
    S.atual = { modo: J.modo, cat: J.cat, n: J.n, titulo: J.titulo, seed: J.seed, alvo: J.alvo, maxDim: J.maxDim, fixo: J.fixo, cz: J.cz, ent: J.ent, rev: J.rev, resolvidas: J.resolvidas, palavrasRev: J.palavrasRev, dicas: J.dicas, tempo: J.tempo };
    salvar();
  }
  function retomar() {
    const a = S.atual; if (!a) return;
    let cz = a.cz;
    if (!cz) { const lista = a.cat === 'todas' ? window.TODAS_PALAVRAS : catDe(a.cat).palavras; cz = G.gerarCruzada(lista, { alvo: a.alvo, maxDim: a.maxDim, seed: a.seed }); }
    J = Object.assign({}, a, { cz, sel: null });
    if (!J.ent || J.ent.length !== cz.altura) J.ent = cz.grade.map((r) => r.map(() => ''));
    abrirJogo();
  }

  const palavrasEm = (l, c) => J.cz.palavras.filter((p) => p.dir ? (p.c === c && l >= p.l && l < p.l + p.w.length) : (p.l === l && c >= p.c && c < p.c + p.w.length));
  const celulas = (p) => Array.from({ length: p.w.length }, (_, k) => [p.l + (p.dir ? k : 0), p.c + (p.dir ? 0 : k)]);
  const palavraAtual = () => { if (!J.sel) return null; const ps = palavrasEm(J.sel.l, J.sel.c); return ps.find((p) => p.dir === J.sel.dir) || ps[0]; };
  const temToque = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse), (any-pointer: coarse), (hover: none)').matches || Math.min(innerWidth, screen.width || innerWidth) <= 900;
  const tecladoVisivel = () => S.cfg.teclado === 'sempre' || (S.cfg.teclado !== 'nunca' && temToque());
  function alternarTeclado() {
    S.cfg.teclado = tecladoVisivel() ? 'nunca' : 'sempre'; salvar();
    const t = document.getElementById('teclado'); if (t) t.classList.toggle('hidden', !tecladoVisivel());
    const b = document.getElementById('hTecl'); if (b) b.classList.toggle('ativo', tecladoVisivel());
    ajustarTamanho(); redesenhar();
  }
  const corDoJogo = () => (J.cat && J.cat !== 'todas' ? catDe(J.cat).cor : 'var(--pri)');

  function rotuloAjuda(tipo, ic, nome) {
    const n = S.loja.itens[tipo];
    return `${ic}<span class="txt"> ${nome}</span> ${n > 0 ? '×' + n : CUSTO[tipo] + '🪙'}`;
  }
  function atualizarBotoesAjuda() {
    const b1 = document.getElementById('hLetra'); if (!b1) return;
    b1.innerHTML = rotuloAjuda('letra', '💡', 'Letra');
    document.getElementById('hPalavra').innerHTML = rotuloAjuda('palavra', '📖', 'Palavra');
    document.getElementById('hVer').innerHTML = rotuloAjuda('verificar', '🔍', 'Verificar');
    const m = document.getElementById('moedasTopo'); if (m) m.textContent = S.moedas;
  }

  function abrirJogo() {
    telaAtual = 'jogo'; desenharNav(); window.scrollTo(0, 0);
    const cz = J.cz;
    $app.innerHTML = `<div class="tela modojogo" style="--mundo:${corDoJogo()}">
      <div class="barrajogo">
        <button class="voltar" id="sairjogo" aria-label="Voltar">←</button>
        <div class="tit">${esc(J.titulo)}</div>
        <span class="chip">⏱️ <span id="tempo">${fmtTempo(J.tempo)}</span></span>
        <span class="chip opc">✅ <span id="cont">0</span>/${cz.palavras.length}</span>
        <span class="chip moedas">🪙 <span id="moedasTopo">${S.moedas}</span></span>
      </div>
      <div class="jogo">
        <div class="painel">
          <div class="barraprog"><i id="barra" style="width:0%"></i></div>
          <div class="dicaatual"><button class="seta" id="ant">‹</button><div class="t" id="dica"></div><button class="seta" id="prox">›</button></div>
          <div class="gradebox"><div class="grade" id="grade" style="grid-template-columns:repeat(${cz.largura}, var(--cel))"></div></div>
          <div class="ajudas">
            <button class="btn so-celular" id="verdicas">📋</button>
            <button class="btn amar" id="hLetra"></button>
            <button class="btn amar" id="hPalavra"></button>
            <button class="btn" id="hVer"></button>
            <button class="btn ${tecladoVisivel() ? 'ativo' : ''}" id="hTecl" title="Mostrar ou esconder o teclado">⌨️</button>
          </div>
          <div class="teclado ${tecladoVisivel() ? '' : 'hidden'}" id="teclado">
            ${['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((r, i) => `<div class="linha">${[...r].map((k) => `<button data-k="${k}">${k}</button>`).join('')}${i === 2 ? '<button class="larga" data-k="⌫">⌫</button>' : ''}</div>`).join('')}
          </div>
        </div>
        <div class="painel listas lateral" id="listas">${listasHTML()}</div>
      </div></div>`;
    document.getElementById('sairjogo').onclick = () => { guardarAtual(); ir(J.modo === 'campanha' ? 'mundo' : 'inicio', J.modo === 'campanha' ? J.cat : undefined); };
    document.getElementById('verdicas').onclick = abrirGaveta;
    const grade = document.getElementById('grade');
    const nums = {};
    for (const p of cz.palavras) nums[p.l + ',' + p.c] = p.num;
    let html = '';
    for (let l = 0; l < cz.altura; l++) for (let c = 0; c < cz.largura; c++) {
      html += cz.grade[l][c] ? `<div class="c" data-l="${l}" data-c="${c}">${nums[l + ',' + c] ? `<span class="n">${nums[l + ',' + c]}</span>` : ''}<span class="x"></span></div>` : '<div class="c v"></div>';
    }
    grade.innerHTML = html;
    grade.onclick = (e) => { const d = e.target.closest('.c[data-l]'); if (d) clicarCelula(+d.dataset.l, +d.dataset.c); };
    ligarListas(document.getElementById('listas'));
    document.getElementById('ant').onclick = () => irPalavra(-1);
    document.getElementById('prox').onclick = () => irPalavra(1);
    document.getElementById('hLetra').onclick = ajudaLetra;
    document.getElementById('hPalavra').onclick = ajudaPalavra;
    document.getElementById('hVer').onclick = ajudaVerificar;
    document.getElementById('hTecl').onclick = alternarTeclado;
    document.getElementById('teclado').onclick = (e) => { const k = e.target.closest('[data-k]'); if (k) { k.dataset.k === '⌫' ? apagar() : digitar(k.dataset.k); } };
    atualizarBotoesAjuda();
    ajustarTamanho();
    selecionarPalavra(cz.palavras.find((p) => !J.resolvidas[p.id]) || cz.palavras[0]);
    pararCronometro();
    cron = setInterval(() => { if (document.hidden) return; J.tempo++; const t = document.getElementById('tempo'); if (t) t.textContent = fmtTempo(J.tempo); if (J.tempo % 10 === 0) guardarAtual(); }, 1000);
  }

  function listasHTML() {
    const li = (p) => `<li data-p="${p.id}"><b>${p.num}</b><span>${esc(p.dica)} <small style="color:var(--muted)">(${p.w.length})</small></span></li>`;
    return `<h3>➡️ Horizontais</h3><ul class="lista">${J.cz.palavras.filter((p) => !p.dir).map(li).join('')}</ul>
      <h3>⬇️ Verticais</h3><ul class="lista">${J.cz.palavras.filter((p) => p.dir).map(li).join('')}</ul>`;
  }
  function ligarListas(el) { el.querySelectorAll('.lista li').forEach((x) => (x.onclick = () => { selecionarPalavra(J.cz.palavras[+x.dataset.p]); fecharGaveta(); })); }
  function abrirGaveta() {
    fecharGaveta();
    const g = document.createElement('div'); g.className = 'gaveta'; g.id = 'gaveta';
    g.innerHTML = `<div class="folha listas" style="--mundo:${corDoJogo()}"><div style="display:flex;justify-content:space-between;align-items:center"><b>📋 Todas as dicas</b><button class="btn" id="fechagav">✕</button></div>${listasHTML()}</div>`;
    g.onclick = (e) => { if (e.target === g) fecharGaveta(); };
    document.body.appendChild(g);
    document.getElementById('fechagav').onclick = fecharGaveta;
    ligarListas(g); redesenhar();
  }
  function fecharGaveta() { const g = document.getElementById('gaveta'); if (g) g.remove(); }

  function ajustarTamanho() {
    const box = document.querySelector('.gradebox'); if (!box || !J) return;
    const larg = Math.min(box.clientWidth, document.documentElement.clientWidth - 40) - 8;
    const tec = document.getElementById('teclado');
    const fixo = tec && getComputedStyle(tec).position === 'fixed';
    const altTec = tecladoVisivel() && tec ? tec.offsetHeight : 0;
    document.documentElement.style.setProperty('--altTecl', (fixo ? altTec + 8 : 0) + 'px');
    const ajudas = document.querySelector('.ajudas');
    const abaixo = (ajudas ? ajudas.offsetHeight + 20 : 70) + altTec + (fixo ? 8 : 12);
    const usado = box.getBoundingClientRect().top + window.scrollY + abaixo;   // barra + dica acima; ajudas + teclado abaixo
    const alt = Math.max(200, innerHeight - usado);
    const t = Math.max(20, Math.min(46, Math.floor(Math.min(larg / J.cz.largura, alt / J.cz.altura)) - 3));
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
    else { const d = J.sel ? J.sel.dir : 0; J.sel = { l, c, dir: ps.some((p) => p.dir === d) ? d : ps[0].dir }; }
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
  const tudoResolvido = () => Object.keys(J.resolvidas).length === J.cz.palavras.length;

  function digitar(ch) {
    if (!J || !J.sel || J.concluida) return;
    const { l, c } = J.sel;
    if (!bloqueada(l, c)) { J.ent[l][c] = ch; sfx.tecla(); }
    const resolveu = checarEm(l, c);
    const p = palavraAtual();
    if (resolveu && p && J.resolvidas[p.id]) irPalavra(1);
    else mover(1);
    redesenhar();
    if (tudoResolvido()) concluir();
  }
  function apagar() {
    if (!J || !J.sel) return;
    const { l, c } = J.sel;
    if (J.ent[l][c] && !bloqueada(l, c)) J.ent[l][c] = '';
    else { mover(-1); if (!bloqueada(J.sel.l, J.sel.c)) J.ent[J.sel.l][J.sel.c] = ''; }
    redesenhar();
  }

  function checarEm(l, c) {
    let algum = false;
    for (const p of palavrasEm(l, c)) {
      if (J.resolvidas[p.id]) continue;
      const cs = celulas(p);
      if (cs.every(([ll, cc]) => J.ent[ll][cc] === J.cz.grade[ll][cc])) { J.resolvidas[p.id] = true; algum = true; palavraResolvida(p); }
      else if (S.cfg.erros && cs.every(([ll, cc]) => J.ent[ll][cc])) sfx.erro();
    }
    return algum;
  }
  function palavraResolvida(p) {
    sfx.certa();
    S.stats.palavras++; eventoMissao('word');
    if (p.w.length >= 9) { S.stats.longas++; eventoMissao('longword'); }
    if (!J.palavrasRev[p.id]) {
      ganharXP(10);
      const nova = !S.aprendidas[p.w];
      S.aprendidas[p.w] = Date.now();
      if (nova) eventoMissao('newword');
      const el = document.querySelector(`.c[data-l="${p.l}"][data-c="${p.c}"]`);
      flutuar(nova ? '+10 XP · nova palavra!' : '+10 XP', el);
    }
    setTimeout(() => celulas(p).forEach(([l, c], i) => { const el = document.querySelector(`.c[data-l="${l}"][data-c="${c}"]`); if (el) { el.classList.remove('pulo'); void el.offsetWidth; el.style.animationDelay = i * 0.04 + 's'; el.classList.add('pulo'); } }), 10);
    guardarAtual();
  }

  // ---------------------------------------------------------------- ajudas (usa item da mochila; senão, moedas)
  function usarAjuda(tipo) {
    if (S.loja.itens[tipo] > 0) { S.loja.itens[tipo]--; J.dicas++; S.stats.dicas++; return true; }
    if (!gastar(CUSTO[tipo])) return false;
    J.dicas++; S.stats.dicas++; return true;
  }
  function ajudaLetra() {
    const p = palavraAtual(); if (!p || J.resolvidas[p.id]) return;
    let alvo = (J.sel && !bloqueada(J.sel.l, J.sel.c) && J.ent[J.sel.l][J.sel.c] !== J.cz.grade[J.sel.l][J.sel.c]) ? [J.sel.l, J.sel.c] : null;
    if (!alvo) alvo = celulas(p).find(([l, c]) => J.ent[l][c] !== J.cz.grade[l][c]);
    if (!alvo || !usarAjuda('letra')) return;
    const [l, c] = alvo;
    J.ent[l][c] = J.cz.grade[l][c]; J.rev[l + ',' + c] = true;
    checarEm(l, c); redesenhar(); atualizarBotoesAjuda(); salvar();
    if (tudoResolvido()) concluir();
  }
  function ajudaPalavra() {
    const p = palavraAtual(); if (!p || J.resolvidas[p.id] || !usarAjuda('palavra')) return;
    J.palavrasRev[p.id] = true;
    for (const [l, c] of celulas(p)) { J.ent[l][c] = J.cz.grade[l][c]; J.rev[l + ',' + c] = true; }
    for (const [l, c] of celulas(p)) checarEm(l, c);
    redesenhar(); atualizarBotoesAjuda(); salvar();
    if (tudoResolvido()) concluir(); else irPalavra(1);
  }
  function ajudaVerificar() {
    let erradas = 0;
    for (let l = 0; l < J.cz.altura; l++) for (let c = 0; c < J.cz.largura; c++) if (J.ent[l][c] && J.ent[l][c] !== J.cz.grade[l][c]) erradas++;
    if (!erradas) { toast('Nenhuma letra errada até agora! 👏'); return; }
    if (!usarAjuda('verificar')) return;
    J.mostrarErros = Date.now();
    toast(`${erradas} letra(s) errada(s) marcada(s) em vermelho.`);
    redesenhar(); atualizarBotoesAjuda(); salvar();
    setTimeout(() => { if (J) { J.mostrarErros = 0; redesenhar(); } }, 4000);
  }

  function redesenhar() {
    if (!J || telaAtual !== 'jogo') return;
    const atual = palavraAtual();
    const naPal = {};
    if (atual) for (const [l, c] of celulas(atual)) naPal[l + ',' + c] = true;
    const ok = {};
    for (const p of J.cz.palavras) if (J.resolvidas[p.id]) for (const [l, c] of celulas(p)) ok[l + ',' + c] = true;
    const mostrarErros = S.cfg.erros || J.mostrarErros;
    document.querySelectorAll('#grade .c[data-l]').forEach((el) => {
      const l = +el.dataset.l, c = +el.dataset.c, k = l + ',' + c, v = J.ent[l][c];
      el.querySelector('.x').textContent = v;
      el.classList.toggle('pal', !!naPal[k]);
      el.classList.toggle('sel', !!J.sel && J.sel.l === l && J.sel.c === c);
      el.classList.toggle('ok', !!ok[k]);
      el.classList.toggle('rev', !!J.rev[k] && !ok[k]);
      el.classList.toggle('erro', !!(mostrarErros && v && v !== J.cz.grade[l][c]));
    });
    document.querySelectorAll('.lista li').forEach((el) => {
      const id = +el.dataset.p;
      el.classList.toggle('feita', !!J.resolvidas[id]);
      el.classList.toggle('atual', !!atual && atual.id === id);
    });
    const li = atual && document.querySelector(`#listas .lista li[data-p="${atual.id}"]`);
    if (li && matchMedia('(min-width: 901px)').matches) li.scrollIntoView({ block: 'nearest' });
    document.getElementById('dica').innerHTML = atual ? `<b>${atual.num} ${atual.dir ? '⬇️ Vertical' : '➡️ Horizontal'}</b> · ${esc(atual.dica)} <small style="color:var(--muted)">(${atual.w.length} letras)</small>` : '';
    const n = Object.keys(J.resolvidas).length;
    document.getElementById('cont').textContent = n;
    document.getElementById('barra').style.width = (n / J.cz.palavras.length * 100) + '%';
  }

  addEventListener('keydown', (e) => {
    if (telaAtual !== 'jogo' || !J || !J.sel || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal')) return;
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const k = e.key;
    if (/^[a-zA-ZçÇ]$/.test(k)) { e.preventDefault(); digitar(window.normalizar(k)); }
    else if (k === 'Backspace') { e.preventDefault(); apagar(); }
    else if (k === 'Enter' || k === 'Tab') { e.preventDefault(); irPalavra(e.shiftKey ? -1 : 1); }
    else if (k === ' ') { e.preventDefault(); if (palavrasEm(J.sel.l, J.sel.c).length > 1) { J.sel.dir = 1 - J.sel.dir; redesenhar(); } }
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
  function atualizarSequencia() {
    if (S.dias.ultimo === hoje()) return;
    if (S.dias.ultimo === diasAtras(1)) S.dias.seq++;
    else if (S.dias.ultimo === diasAtras(2) && S.loja.itens.congelar > 0) { S.loja.itens.congelar--; S.dias.seq++; toast('🧊 Sua proteção de sequência foi usada: a sequência continua!'); }
    else S.dias.seq = 1;
    S.dias.ultimo = hoje(); S.dias.melhor = Math.max(S.dias.melhor, S.dias.seq);
  }
  function concluir() {
    if (J.concluida) return;
    fecharGaveta();
    J.concluida = true; pararCronometro(); S.atual = null;
    const est = J.dicas === 0 ? 3 : J.dicas <= 3 ? 2 : 1;
    const xp = 50 + est * 25 + (J.modo === 'diario' ? 50 : 0);
    const moedas = 15 + est * 10 + (J.modo === 'diario' ? 50 : 0);
    ganharXP(xp); S.moedas += moedas;
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
    atualizarSequencia();
    const novas = verificarConquistas();
    salvar(); sfx.fim(); confete();
    const proximo = J.modo === 'campanha' ? (J.n < niveisDe(J.cat) ? { cat: J.cat, n: J.n + 1 } : proximoNivel()) : null;
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="janela">
      <h2>${est === 3 ? 'Perfeito! 🎉' : est === 2 ? 'Muito bem!' : 'Cruzada completa!'}</h2>
      <div class="estrelas">${[0, 1, 2].map((i) => `<span style="animation-delay:${0.2 + i * 0.25}s">${i < est ? '⭐' : '☆'}</span>`).join('')}</div>
      <p style="text-align:center;color:var(--muted);margin:0;font-weight:700">${esc(J.titulo)} · ⏱️ ${fmtTempo(J.tempo)} · ${J.dicas} ajuda(s)</p>
      <div class="premios"><span class="chip">+${xp} XP</span><span class="chip moedas">+${moedas} 🪙</span>${novas.map((c) => `<span class="chip">🏆 ${esc(c.nome)}</span>`).join('')}</div>
      <div class="aprendidas"><b>📚 Palavras desta cruzada</b>${J.cz.palavras.map((p) => `<div><b style="color:var(--pri)">${esc(p.d)}</b> — ${esc(p.dica)}</div>`).join('')}</div>
      <div class="acoes">
        <button class="btn" data-a="inicio">Início</button>
        ${novas.length ? '<button class="btn amar" data-a="conq">🏆 Resgatar conquistas</button>' : ''}
        ${J.modo === 'campanha' ? '<button class="btn" data-a="mapa">Mapa</button>' : ''}
        ${proximo ? '<button class="btn pri" data-a="prox">Próximo nível ▶</button>' : J.modo === 'livre' ? '<button class="btn pri" data-a="outra">Outra cruzada</button>' : ''}
      </div></div>`;
    m.onclick = (e) => {
      const a = e.target.dataset.a; if (!a) return;
      m.remove();
      if (a === 'inicio') ir('inicio');
      else if (a === 'conq') ir('conquistas');
      else if (a === 'mapa') ir('mundo', J.cat);
      else if (a === 'prox') iniciarCampanha(proximo.cat, proximo.n);
      else if (a === 'outra') novoJogo({ modo: 'livre', cat: J.cat, titulo: J.titulo, seed: (Math.random() * 1e9) | 0, alvo: J.alvo, maxDim: J.maxDim });
    };
    document.body.appendChild(m);
  }

  addEventListener('beforeunload', () => { if (telaAtual === 'jogo') guardarAtual(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && telaAtual === 'jogo') guardarAtual(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

  window.__CRUZ = { get S() { return S; }, get J() { return J; }, digitar, ir, novoJogo, candidatas };
  garantirMissoes();
  ir('inicio');
  puxarDaNuvem();
})();
