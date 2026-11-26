/* Forge Bank — protótipo de banco digital da Forge Studios.
 * Tudo é SIMULADO e fica salvo só neste navegador (localStorage). Nenhum dinheiro real é movimentado.
 * Valores são guardados em centavos (inteiros) para evitar erro de arredondamento.
 */
(function () {
  'use strict';

  const STORE_KEY = 'forge-bank:v1';
  const SESSION_KEY = 'forge-bank:unlocked';
  const AUTO_LOCK_MS = 5 * 60 * 1000;
  const DAILY_YIELD = 0.0004; // ~15,7% ao ano, composto por dia (simulação)
  const MAX_PIN_TRIES = 3;

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');

  // ---------------------------------------------------------------- utilidades
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = (c) => BRL.format(c / 100);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[rand(0, arr.length - 1)];
  const $ = (sel, root = app) => root.querySelector(sel);
  const $$ = (sel, root = app) => [...root.querySelectorAll(sel)];

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (toastEl.hidden = true), 2600);
  }

  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(salt + ':' + pin);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback (contexto não seguro): FNV-1a simples. Só para o protótipo.
    let h = 0x811c9dc5;
    for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv' + h.toString(16);
  }

  function validCPF(v) {
    const c = digits(v);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    const dv = (n) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
  }
  const fmtCPF = (v) => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  const fmtPhone = (v) => {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  };
  const maskCPF = (v) => { const d = digits(v); return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`; };

  function luhnDigit(partial) {
    let sum = 0;
    for (let i = 0; i < partial.length; i++) {
      let n = Number(partial[partial.length - 1 - i]);
      if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
    }
    return (10 - (sum % 10)) % 10;
  }

  const dayKey = (ts) => new Date(ts).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeOf = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ---------------------------------------------------------------- estado
  let state = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch { return null; }
  }
  function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }

  function addTx(tx) {
    state.tx.unshift({ id: uid(), ts: Date.now(), ...tx });
    state.balance += tx.amount;
    save();
  }

  function accrueSavings() {
    if (!state) return;
    const now = Date.now();
    const days = Math.floor((now - state.savings.updatedAt) / 86400000);
    if (days <= 0) return;
    if (state.savings.amount > 0) {
      const gained = Math.floor(state.savings.amount * (Math.pow(1 + DAILY_YIELD, days) - 1));
      state.savings.amount += gained;
      state.savings.earned += gained;
    }
    state.savings.updatedAt += days * 86400000;
    save();
  }

  function newAccount({ name, cpf, email, phone, pinHash, salt }) {
    const bin = '5' + String(rand(10000, 99999)) + String(rand(100000000, 999999999));
    const cardNumber = bin + luhnDigit(bin);
    const exp = new Date();
    exp.setFullYear(exp.getFullYear() + 5);
    return {
      user: { name, cpf: digits(cpf), email, phone: digits(phone), pinHash, salt, createdAt: Date.now() },
      account: { agency: '0001', number: String(rand(100000, 999999)) + '-' + rand(0, 9) },
      balance: 0,
      tx: [],
      savings: { amount: 0, earned: 0, updatedAt: Date.now() },
      card: {
        number: cardNumber,
        cvv: String(rand(100, 999)),
        exp: String(exp.getMonth() + 1).padStart(2, '0') + '/' + String(exp.getFullYear()).slice(2),
        limit: 250000,
        purchases: [],
        blocked: false,
      },
      pixKeys: [{ type: 'CPF', value: digits(cpf) }],
      contacts: [],
      hideBalance: false,
    };
  }

  const cardUsed = () => state.card.purchases.reduce((s, p) => s + p.amount, 0);

  // ---------------------------------------------------------------- sessão / bloqueio
  const isUnlocked = () => sessionStorage.getItem(SESSION_KEY) === '1';
  function lock() { sessionStorage.removeItem(SESSION_KEY); location.hash = '#/'; render(); }
  let idleTimer;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (isUnlocked()) idleTimer = setTimeout(() => { lock(); toast('Sessão bloqueada por inatividade'); }, AUTO_LOCK_MS);
  }
  ['click', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, resetIdle, { passive: true }));

  // ---------------------------------------------------------------- componentes
  const keypadHTML = () => `
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-k="${n}">${n}</button>`).join('')}
      <button type="button" class="blank" tabindex="-1" aria-hidden="true"></button>
      <button type="button" data-k="0">0</button>
      <button type="button" data-k="del" aria-label="Apagar">⌫</button>
    </div>`;
  const dotsHTML = (n = 6) => `<div class="pin-dots">${'<i></i>'.repeat(n)}</div>`;

  // Liga um teclado numérico + bolinhas; chama onDone(pin) com 6 dígitos.
  function bindPin(root, onDone) {
    let pin = '';
    const dots = $('.pin-dots', root);
    const paint = () => $$('i', dots).forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const press = (k) => {
      if (k === 'del') pin = pin.slice(0, -1);
      else if (pin.length < 6) pin += k;
      paint();
      if (pin.length === 6) { const p = pin; pin = ''; setTimeout(() => { paint(); onDone(p); }, 120); }
    };
    $$('[data-k]', root).forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
    const onKey = (e) => {
      if (!dots.isConnected) return removeEventListener('keydown', onKey);
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    addEventListener('keydown', onKey);
    return { shake() { dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); }, stop() { removeEventListener('keydown', onKey); } };
  }

  // Pede o PIN numa folha inferior. Resolve true se correto.
  function confirmPin(title = 'Digite seu PIN para confirmar') {
    return new Promise((resolve) => {
      const bg = document.createElement('div');
      bg.className = 'sheet-bg';
      bg.innerHTML = `<div class="sheet center" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3><p>PIN de 6 dígitos</p>${dotsHTML()}<p class="error" id="pin-err"></p>${keypadHTML()}
        <button class="btn ghost" style="margin-top:16px" data-cancel>Cancelar</button></div>`;
      document.body.appendChild(bg);
      let tries = 0;
      const close = (ok) => { pad.stop(); bg.remove(); resolve(ok); };
      const pad = bindPin(bg, async (pin) => {
        if ((await hashPin(pin, state.user.salt)) === state.user.pinHash) return close(true);
        tries++;
        pad.shake();
        if (tries >= MAX_PIN_TRIES) { close(false); toast('PIN incorreto 3 vezes. Entre novamente.'); lock(); return; }
        $('#pin-err', bg).textContent = `PIN incorreto. ${MAX_PIN_TRIES - tries} tentativa(s) restante(s).`;
      });
      $('[data-cancel]', bg).addEventListener('click', () => close(false));
      bg.addEventListener('click', (e) => { if (e.target === bg) close(false); });
    });
  }

  // Campo de valor em reais: o usuário digita só números e o campo formata.
  function bindMoney(input, onChange) {
    const set = (cents) => { input.value = cents ? money(cents) : ''; input.dataset.cents = cents; onChange && onChange(cents); };
    input.addEventListener('input', () => set(Math.min(Number(digits(input.value) || 0), 99999999999)));
    set(Number(input.dataset.cents || 0));
    return () => Number(input.dataset.cents || 0);
  }

  const top = (title, back = '#/home') => `<div class="top"><a class="back" href="${back}" aria-label="Voltar">‹</a><h1>${esc(title)}</h1></div>`;

  const nav = (active) => `
    <nav class="nav" aria-label="Navegação principal">
      <a href="#/home" class="${active === 'home' ? 'on' : ''}"><span>⌂</span>Início</a>
      <a href="#/extrato" class="${active === 'extrato' ? 'on' : ''}"><span>≡</span>Extrato</a>
      <a href="#/cartao" class="${active === 'cartao' ? 'on' : ''}"><span>▭</span>Cartão</a>
      <a href="#/perfil" class="${active === 'perfil' ? 'on' : ''}"><span>◉</span>Perfil</a>
    </nav>`;

  function txRow(t) {
    const cls = t.amount >= 0 ? 'in' : 'out';
    const sign = t.amount >= 0 ? '+ ' : '− ';
    return `<div class="row"><div class="ic">${esc(t.icon || '•')}</div>
      <div class="txt"><strong>${esc(t.title)}</strong><small>${esc(t.desc || '')} · ${timeOf(t.ts)}</small></div>
      <div class="amount ${cls}">${sign}${money(Math.abs(t.amount))}</div></div>`;
  }

  function txList(list) {
    if (!list.length) return '<div class="empty">Nenhuma movimentação ainda.</div>';
    let html = '', last = '';
    for (const t of list) {
      const d = dayKey(t.ts);
      if (d !== last) { html += `<div class="day">${esc(d)}</div>`; last = d; }
      html += txRow(t);
    }
    return html;
  }

  // Tela de sucesso genérica (comprovante).
  function success({ title, amount, lines = [], back = '#/home' }) {
    app.innerHTML = `<div class="ok-screen">
      <div class="big-ic">✓</div><h2>${esc(title)}</h2>
      ${amount != null ? `<div class="value">${money(amount)}</div>` : ''}
      <div class="card summary" style="text-align:left;margin-top:18px">
        ${lines.map(([k, v]) => `<div class="row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}
        <div class="row"><span>Data</span><strong>${new Date().toLocaleString('pt-BR')}</strong></div>
        <div class="row"><span>Autenticação</span><strong>${uid().toUpperCase()}</strong></div>
      </div>
      <a class="btn" style="display:block;text-decoration:none" href="${back}">Concluir</a></div>`;
  }

  // ---------------------------------------------------------------- telas
  const views = {};

  views.welcome = () => {
    app.innerHTML = `<div class="splash">
      <div class="brand"><img src="icon.svg" alt=""><b>Forge Bank</b></div>
      <p class="tagline">O banco digital da Forge Studios. Conta, Pix, cartão e caixinha em um só lugar.</p>
      <a class="btn" style="display:block;text-align:center;text-decoration:none" href="#/cadastro">Abrir minha conta</a>
      <p class="demo-note">Protótipo: os dados ficam só neste navegador e nenhum dinheiro real é movimentado.</p></div>`;
  };

  views.cadastro = () => {
    app.innerHTML = `${top('Abrir conta', '#/')}
      <form id="f" novalidate>
        <label class="field"><span>Nome completo</span><input class="input" name="name" autocomplete="name" required></label>
        <label class="field"><span>CPF</span><input class="input" name="cpf" inputmode="numeric" placeholder="000.000.000-00" required></label>
        <label class="field"><span>E-mail</span><input class="input" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Celular</span><input class="input" name="phone" inputmode="tel" placeholder="(00) 00000-0000" required></label>
        <p class="error" id="err"></p>
        <button class="btn">Continuar</button>
      </form>`;
    const f = $('#f');
    f.cpf.addEventListener('input', () => (f.cpf.value = fmtCPF(f.cpf.value)));
    f.phone.addEventListener('input', () => (f.phone.value = fmtPhone(f.phone.value)));
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const err = $('#err');
      const data = { name: f.name.value.trim().replace(/\s+/g, ' '), cpf: f.cpf.value, email: f.email.value.trim(), phone: f.phone.value };
      if (data.name.split(' ').length < 2) return (err.textContent = 'Informe nome e sobrenome.');
      if (!validCPF(data.cpf)) return (err.textContent = 'CPF inválido.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return (err.textContent = 'E-mail inválido.');
      if (digits(data.phone).length < 10) return (err.textContent = 'Celular inválido.');
      views.criarPin(data);
    });
  };

  views.criarPin = (data) => {
    let first = null;
    const draw = (msg, err = '') => {
      app.innerHTML = `${top('Crie seu PIN', '#/cadastro')}<div class="center">
        <p class="muted">${esc(msg)}</p>${dotsHTML()}<p class="error">${esc(err)}</p>${keypadHTML()}</div>`;
      bindPin(app, async (pin) => {
        if (!first) {
          if (/^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin))
            return draw('Escolha 6 dígitos para entrar e confirmar operações.', 'PIN muito fácil. Evite sequências e números repetidos.');
          first = pin;
          return draw('Digite o PIN novamente para confirmar.');
        }
        if (pin !== first) { first = null; return draw('Escolha 6 dígitos para entrar e confirmar operações.', 'Os PINs não conferem. Tente de novo.'); }
        const salt = uid();
        state = newAccount({ ...data, salt, pinHash: await hashPin(pin, salt) });
        addTx({ type: 'bonus', title: 'Bônus de boas-vindas', desc: 'Saldo de demonstração', amount: 100000, icon: '★' });
        sessionStorage.setItem(SESSION_KEY, '1');
        resetIdle();
        location.hash = '#/home';
        toast('Conta aberta! Você ganhou R$ 1.000 de demonstração.');
      });
    };
    draw('Escolha 6 dígitos para entrar e confirmar operações.');
  };

  views.login = () => {
    let tries = 0;
    const first = state.user.name.split(' ')[0];
    app.innerHTML = `<div class="splash center">
      <div class="brand" style="justify-content:center"><img src="icon.svg" alt=""><b>Forge Bank</b></div>
      <p class="muted">Olá, ${esc(first)}. Digite seu PIN.</p>${dotsHTML()}<p class="error" id="err"></p>${keypadHTML()}
      <p style="margin-top:22px"><button class="link" id="forgot">Não é você? Sair desta conta</button></p></div>`;
    const pad = bindPin(app, async (pin) => {
      if ((await hashPin(pin, state.user.salt)) === state.user.pinHash) {
        sessionStorage.setItem(SESSION_KEY, '1');
        resetIdle();
        pad.stop();
        location.hash = '#/home';
        render();
        return;
      }
      tries++;
      pad.shake();
      $('#err').textContent = tries >= MAX_PIN_TRIES ? 'Muitas tentativas. Aguarde alguns segundos.' : 'PIN incorreto.';
      if (tries >= MAX_PIN_TRIES) {
        $$('.keypad button').forEach((b) => (b.disabled = true));
        setTimeout(() => { tries = 0; $$('.keypad button').forEach((b) => (b.disabled = false)); $('#err').textContent = ''; }, 30000);
      }
    });
    $('#forgot').addEventListener('click', () => resetAll('Isso apaga a conta salva neste navegador. Continuar?'));
  };

  function resetAll(msg) {
    if (!confirm(msg)) return;
    localStorage.removeItem(STORE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    state = null;
    location.hash = '#/';
    render();
  }

  views.home = () => {
    accrueSavings();
    const u = state.user;
    const initials = u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    const hide = state.hideBalance;
    const used = cardUsed();
    app.innerHTML = `
      <div class="top">
        <a class="avatar" href="#/perfil" style="text-decoration:none" aria-label="Perfil">${esc(initials)}</a>
        <div class="hello"><small>Olá,</small><strong>${esc(u.name.split(' ')[0])}</strong></div>
        <button class="icon-btn" id="eye" aria-label="${hide ? 'Mostrar' : 'Esconder'} saldo">${hide ? '◌' : '◉'}</button>
        <button class="icon-btn" id="lock" aria-label="Bloquear app">⏻</button>
      </div>
      <div class="card balance">
        <div class="label">Saldo em conta <a class="link" href="#/extrato">Extrato ›</a></div>
        <div class="value">${hide ? 'R$ ••••••' : money(state.balance)}</div>
        <div class="sub">Ag ${state.account.agency} · Conta ${state.account.number}</div>
      </div>
      <div class="actions">
        <a class="action" href="#/pix" style="text-decoration:none"><span class="ic">⇄</span>Pix</a>
        <a class="action" href="#/pagar" style="text-decoration:none"><span class="ic">▤</span>Pagar</a>
        <a class="action" href="#/depositar" style="text-decoration:none"><span class="ic">＋</span>Depositar</a>
        <a class="action" href="#/caixinha" style="text-decoration:none"><span class="ic">◈</span>Caixinha</a>
      </div>
      <div class="mini-grid">
        <a class="card mini" href="#/cartao" style="text-decoration:none;color:inherit">
          <small>Fatura do cartão</small><strong>${hide ? '••••' : money(used)}</strong>
          <div class="bar"><i style="width:${Math.min(100, (used / state.card.limit) * 100)}%"></i></div>
        </a>
        <a class="card mini" href="#/caixinha" style="text-decoration:none;color:inherit">
          <small>Caixinha</small><strong>${hide ? '••••' : money(state.savings.amount)}</strong>
          <small style="margin-top:8px">Rendeu ${hide ? '••' : money(state.savings.earned)}</small>
        </a>
      </div>
      <div class="section-title"><h2>Últimas movimentações</h2><a class="link" href="#/extrato">Ver tudo</a></div>
      <div class="card">${state.tx.length ? state.tx.slice(0, 5).map(txRow).join('') : '<div class="empty">Nenhuma movimentação ainda.</div>'}</div>
      ${nav('home')}`;
    $('#eye').addEventListener('click', () => { state.hideBalance = !state.hideBalance; save(); render(); });
    $('#lock').addEventListener('click', lock);
  };

  views.extrato = () => {
    let filter = 'all';
    const draw = () => {
      const list = state.tx.filter((t) => filter === 'all' || (filter === 'in' ? t.amount > 0 : t.amount < 0));
      const total = (sign) => state.tx.filter((t) => Math.sign(t.amount) === sign).reduce((s, t) => s + t.amount, 0);
      app.innerHTML = `${top('Extrato')}
        <div class="mini-grid" style="margin-bottom:14px">
          <div class="card mini"><small>Entradas</small><strong style="color:var(--green)">${money(total(1))}</strong></div>
          <div class="card mini"><small>Saídas</small><strong>${money(-total(-1))}</strong></div>
        </div>
        <div class="tabs">
          ${[['all', 'Tudo'], ['in', 'Entradas'], ['out', 'Saídas']].map(([k, l]) => `<button class="tab ${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
        </div>
        <div class="card">${txList(list)}</div>${nav('extrato')}`;
      $$('[data-f]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.f; draw(); }));
    };
    draw();
  };

  // ---------- Pix
  views.pix = () => {
    app.innerHTML = `${top('Área Pix')}
      <div class="actions" style="grid-template-columns:repeat(3,1fr)">
        <a class="action" href="#/pix/enviar" style="text-decoration:none"><span class="ic">↗</span>Enviar</a>
        <a class="action" href="#/pix/receber" style="text-decoration:none"><span class="ic">↙</span>Receber</a>
        <a class="action" href="#/pix/chaves" style="text-decoration:none"><span class="ic">⚿</span>Minhas chaves</a>
      </div>
      <div class="section-title"><h2>Contatos recentes</h2></div>
      <div class="card">${state.contacts.length ? state.contacts.map((c, i) => `
        <a class="row" href="#/pix/enviar?c=${i}" style="text-decoration:none;color:inherit"><div class="ic">${esc(c.name[0])}</div>
        <div class="txt"><strong>${esc(c.name)}</strong><small>${esc(c.type)} · ${esc(c.key)}</small></div><span class="muted">›</span></a>`).join('')
        : '<div class="empty">Quem você pagar por Pix aparece aqui.</div>'}</div>
      <p class="demo-note">Pix simulado: o dinheiro não sai do protótipo.</p>`;
  };

  function detectKey(raw) {
    const v = raw.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { type: 'E-mail', key: v.toLowerCase() };
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { type: 'Aleatória', key: v.toLowerCase() };
    const d = digits(v);
    if (d.length === 11 && validCPF(d) && !v.startsWith('+') && !v.startsWith('(')) return { type: 'CPF', key: fmtCPF(d) };
    if (d.length === 14) return { type: 'CNPJ', key: d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') };
    if (d.length === 11 || d.length === 13) return { type: 'Celular', key: '+55 ' + fmtPhone(d.slice(-11)) };
    return null;
  }

  const FAKE_NAMES = ['Ana Ribeiro', 'Bruno Martins', 'Carla Souza', 'Diego Almeida', 'Elisa Fernandes', 'Felipe Costa', 'Gabriela Lima', 'Henrique Rocha', 'Isabela Nunes', 'João Pedro Silva'];
  function nameForKey(key) {
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return FAKE_NAMES[h % FAKE_NAMES.length];
  }

  views.pixEnviar = (params) => {
    const preset = state.contacts[Number(params.get('c'))];
    app.innerHTML = `${top('Enviar Pix', '#/pix')}
      <form id="f" novalidate>
        <label class="field"><span>Chave Pix do destinatário</span>
          <input class="input" name="key" placeholder="CPF, celular, e-mail ou chave aleatória" value="${esc(preset ? preset.key : '')}" autocomplete="off"></label>
        <p class="hint" id="kind">&nbsp;</p>
        <label class="field"><span>Valor</span><input class="input big" name="amount" inputmode="numeric" placeholder="R$ 0,00"></label>
        <p class="hint">Saldo disponível: ${money(state.balance)}</p>
        <div class="chips">${[1000, 5000, 10000, 20000].map((c) => `<button type="button" class="chip" data-v="${c}">${money(c)}</button>`).join('')}</div>
        <label class="field"><span>Mensagem (opcional)</span><input class="input" name="msg" maxlength="60"></label>
        <p class="error" id="err"></p>
        <button class="btn">Revisar</button>
      </form>`;
    const f = $('#f');
    const getAmount = bindMoney(f.amount);
    const showKind = () => { const k = detectKey(f.key.value); $('#kind').textContent = k ? `${k.type} · ${nameForKey(k.key)}` : ' '; };
    f.key.addEventListener('input', showKind);
    showKind();
    $$('[data-v]').forEach((b) => b.addEventListener('click', () => { f.amount.value = b.dataset.v; f.amount.dispatchEvent(new Event('input')); }));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#err');
      const k = detectKey(f.key.value);
      const amount = getAmount();
      if (!k) return (err.textContent = 'Chave Pix inválida.');
      if (state.pixKeys.some((p) => p.value === digits(k.key) || p.value === k.key)) return (err.textContent = 'Essa chave é sua. Use "Receber" para pedir um Pix.');
      if (amount < 1) return (err.textContent = 'Informe um valor.');
      if (amount > state.balance) return (err.textContent = 'Saldo insuficiente.');
      if (amount > 500000 && !confirm(`Valor alto: ${money(amount)}. Deseja continuar?`)) return;
      const name = nameForKey(k.key);
      if (!(await confirmPin(`Enviar ${money(amount)} para ${name}`))) return;
      addTx({ type: 'pix-out', title: `Pix enviado · ${name}`, desc: f.msg.value.trim() || k.type, amount: -amount, icon: '↗' });
      state.contacts = [{ name, type: k.type, key: k.key }, ...state.contacts.filter((c) => c.key !== k.key)].slice(0, 8);
      save();
      success({ title: 'Pix enviado', amount, lines: [['Para', name], ['Chave', `${k.type} · ${k.key}`], ['Instituição', 'Banco simulado']] });
    });
  };

  // QR ilustrativo (não é um QR Code válido): grade determinística a partir do texto.
  function fakeQR(text) {
    let h = 2166136261;
    const n = 25;
    let cells = '';
    const finder = (x, y) => [[0, 0], [n - 7, 0], [0, n - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      h ^= text.charCodeAt((x * n + y) % text.length) + x * 7 + y * 13;
      h = Math.imul(h, 16777619) >>> 0;
      if (h & 1) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    const fp = (fx, fy) => `<rect x="${fx}" y="${fy}" width="7" height="7"/><rect x="${fx + 1}" y="${fy + 1}" width="5" height="5" fill="#fff"/><rect x="${fx + 2}" y="${fy + 2}" width="3" height="3"/>`;
    return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="#14110f">${cells}${fp(0, 0)}${fp(n - 7, 0)}${fp(0, n - 7)}</svg>`;
  }

  views.pixReceber = () => {
    const key = state.pixKeys[0];
    app.innerHTML = `${top('Receber Pix', '#/pix')}
      <label class="field"><span>Valor a receber (opcional)</span><input class="input big" id="amt" inputmode="numeric" placeholder="R$ 0,00"></label>
      <div class="card center">
        <div class="qr" id="qr"></div>
        <p class="muted" style="font-size:13px">QR ilustrativo do protótipo</p>
        <p style="margin:6px 0 2px"><strong>${esc(key ? key.type : '')}</strong></p>
        <p class="muted" style="word-break:break-all">${esc(key ? (key.type === 'CPF' ? fmtCPF(key.value) : key.value) : 'Cadastre uma chave')}</p>
        <button class="btn ghost" id="copy">Copiar chave</button>
      </div>
      <button class="btn" id="sim">Simular recebimento</button>
      <p class="demo-note">Como é um protótipo, use "Simular recebimento" para ver o Pix entrando na conta.</p>`;
    const getAmount = bindMoney($('#amt'), (c) => { $('#qr').innerHTML = fakeQR((key ? key.value : 'x') + ':' + c); });
    $('#copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(key.value); toast('Chave copiada'); } catch { toast(key.value); }
    });
    $('#sim').addEventListener('click', () => {
      const amount = getAmount() || rand(20, 400) * 100 + rand(0, 99);
      const from = pick(FAKE_NAMES);
      addTx({ type: 'pix-in', title: `Pix recebido · ${from}`, desc: 'Transferência recebida', amount, icon: '↙' });
      success({ title: 'Pix recebido', amount, lines: [['De', from], ['Para', state.user.name]] });
    });
  };

  views.pixChaves = () => {
    const show = (k) => (k.type === 'CPF' ? fmtCPF(k.value) : k.type === 'Celular' ? '+55 ' + fmtPhone(k.value) : k.value);
    const has = (t) => state.pixKeys.some((k) => k.type === t);
    app.innerHTML = `${top('Minhas chaves Pix', '#/pix')}
      <div class="card">${state.pixKeys.length ? state.pixKeys.map((k, i) => `
        <div class="row"><div class="ic">⚿</div><div class="txt"><strong>${esc(k.type)}</strong><small>${esc(show(k))}</small></div>
        <button class="link" data-del="${i}" style="color:var(--red)">Excluir</button></div>`).join('') : '<div class="empty">Nenhuma chave cadastrada.</div>'}</div>
      <div class="section-title"><h2>Cadastrar nova chave</h2></div>
      ${!has('CPF') ? '<button class="btn ghost" data-add="CPF">CPF</button>' : ''}
      ${!has('Celular') ? '<button class="btn ghost" data-add="Celular">Celular</button>' : ''}
      ${!has('E-mail') ? '<button class="btn ghost" data-add="E-mail">E-mail</button>' : ''}
      <button class="btn ghost" data-add="Aleatória">Chave aleatória</button>
      <p class="demo-note">Limite de 5 chaves por conta.</p>`;
    $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmPin('Confirme para excluir a chave'))) return;
      state.pixKeys.splice(Number(b.dataset.del), 1); save(); views.pixChaves(); toast('Chave excluída');
    }));
    $$('[data-add]').forEach((b) => b.addEventListener('click', () => {
      if (state.pixKeys.length >= 5) return toast('Limite de 5 chaves atingido');
      const t = b.dataset.add;
      const value = t === 'CPF' ? state.user.cpf : t === 'Celular' ? state.user.phone : t === 'E-mail' ? state.user.email.toLowerCase()
        : (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => rand(0, 15).toString(16)));
      state.pixKeys.push({ type: t, value }); save(); views.pixChaves(); toast('Chave cadastrada');
    }));
  };

  // ---------- Pagar boleto
  function sampleBoleto() {
    const value = String(rand(3000, 60000)).padStart(10, '0');
    let code = '';
    for (let i = 0; i < 37; i++) code += rand(0, 9);
    return code + value;
  }
  views.pagar = () => {
    app.innerHTML = `${top('Pagar boleto')}
      <form id="f" novalidate>
        <label class="field"><span>Código de barras (linha digitável)</span>
          <input class="input" name="code" inputmode="numeric" placeholder="47 ou 48 números" autocomplete="off"></label>
        <p class="hint"><button type="button" class="link" id="sample">Gerar boleto de teste</button></p>
        <div id="amtBox" hidden><label class="field"><span>Valor</span><input class="input big" name="amount" inputmode="numeric" placeholder="R$ 0,00"></label></div>
        <label class="field"><span>Descrição (opcional)</span><input class="input" name="desc" maxlength="40" placeholder="Ex.: conta de luz"></label>
        <p class="hint">Saldo disponível: ${money(state.balance)}</p>
        <p class="error" id="err"></p>
        <button class="btn">Pagar</button>
      </form>`;
    const f = $('#f');
    const getAmount = bindMoney(f.amount);
    const update = () => {
      const d = digits(f.code.value);
      // Boleto bancário (47): valor nos 10 últimos dígitos. Convênio (48) ou valor zerado: digitar.
      const embedded = d.length === 47 ? Number(d.slice(-10)) : 0;
      $('#amtBox').hidden = !(d.length === 48 || (d.length === 47 && !embedded));
      if (embedded) { f.amount.value = embedded; f.amount.dispatchEvent(new Event('input')); }
    };
    f.code.addEventListener('input', update);
    $('#sample').addEventListener('click', () => { f.code.value = sampleBoleto(); update(); toast(`Boleto de teste: ${money(getAmount())}`); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#err');
      const d = digits(f.code.value);
      const amount = getAmount();
      if (d.length !== 47 && d.length !== 48) return (err.textContent = 'O código deve ter 47 ou 48 números.');
      if (amount < 1) return (err.textContent = 'Informe o valor do boleto.');
      if (amount > state.balance) return (err.textContent = 'Saldo insuficiente.');
      if (!(await confirmPin(`Pagar boleto de ${money(amount)}`))) return;
      const desc = f.desc.value.trim() || 'Boleto';
      addTx({ type: 'boleto', title: `Pagamento · ${desc}`, desc: 'Boleto ' + d.slice(0, 5) + '…', amount: -amount, icon: '▤' });
      success({ title: 'Boleto pago', amount, lines: [['Descrição', desc], ['Código', d.slice(0, 12) + '…' + d.slice(-6)]] });
    });
  };

  // ---------- Depositar
  views.depositar = () => {
    app.innerHTML = `${top('Depositar')}
      <p class="muted">Escolha um valor para adicionar saldo de demonstração à sua conta.</p>
      <label class="field"><span>Valor</span><input class="input big" id="amt" inputmode="numeric" placeholder="R$ 0,00"></label>
      <div class="chips">${[5000, 10000, 50000, 100000].map((c) => `<button type="button" class="chip" data-v="${c}">${money(c)}</button>`).join('')}</div>
      <p class="error" id="err"></p>
      <button class="btn" id="go">Depositar</button>
      <p class="demo-note">Limite de R$ 50.000,00 por depósito simulado.</p>`;
    const inp = $('#amt');
    const getAmount = bindMoney(inp);
    $$('[data-v]').forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.v; inp.dispatchEvent(new Event('input')); }));
    $('#go').addEventListener('click', () => {
      const amount = getAmount();
      if (amount < 100) return ($('#err').textContent = 'Valor mínimo de R$ 1,00.');
      if (amount > 5000000) return ($('#err').textContent = 'Valor máximo de R$ 50.000,00.');
      addTx({ type: 'deposit', title: 'Depósito', desc: 'Depósito simulado', amount, icon: '＋' });
      success({ title: 'Depósito realizado', amount, lines: [['Conta', `${state.account.agency} / ${state.account.number}`]] });
    });
  };

  // ---------- Caixinha
  views.caixinha = () => {
    accrueSavings();
    const s = state.savings;
    const yearly = ((Math.pow(1 + DAILY_YIELD, 365) - 1) * 100).toFixed(1).replace('.', ',');
    app.innerHTML = `${top('Caixinha')}
      <div class="card balance">
        <div class="label">Guardado na caixinha</div>
        <div class="value">${money(s.amount)}</div>
        <div class="sub">Rendeu ${money(s.earned)} · ~${yearly}% ao ano (simulado), rende todo dia</div>
      </div>
      <div class="tabs"><button class="tab on" data-m="in">Guardar</button><button class="tab" data-m="out">Resgatar</button></div>
      <label class="field"><span id="lbl">Quanto guardar?</span><input class="input big" id="amt" inputmode="numeric" placeholder="R$ 0,00"></label>
      <p class="hint" id="avail"></p>
      <p class="error" id="err"></p>
      <button class="btn" id="go">Guardar</button>
      <button class="btn ghost" id="sim">Simular 30 dias de rendimento</button>`;
    let mode = 'in';
    const getAmount = bindMoney($('#amt'));
    const paint = () => {
      $$('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      $('#lbl').textContent = mode === 'in' ? 'Quanto guardar?' : 'Quanto resgatar?';
      $('#go').textContent = mode === 'in' ? 'Guardar' : 'Resgatar';
      $('#avail').textContent = mode === 'in' ? `Saldo em conta: ${money(state.balance)}` : `Disponível na caixinha: ${money(s.amount)}`;
      $('#err').textContent = '';
    };
    paint();
    $$('[data-m]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; paint(); }));
    $('#go').addEventListener('click', () => {
      const amount = getAmount();
      if (amount < 1) return ($('#err').textContent = 'Informe um valor.');
      if (mode === 'in') {
        if (amount > state.balance) return ($('#err').textContent = 'Saldo insuficiente.');
        s.amount += amount;
        addTx({ type: 'save-in', title: 'Guardado na caixinha', desc: 'Caixinha', amount: -amount, icon: '◈' });
      } else {
        if (amount > s.amount) return ($('#err').textContent = 'Valor maior que o guardado.');
        s.amount -= amount;
        addTx({ type: 'save-out', title: 'Resgate da caixinha', desc: 'Caixinha', amount, icon: '◈' });
      }
      toast(mode === 'in' ? 'Dinheiro guardado' : 'Resgate feito');
      views.caixinha();
    });
    $('#sim').addEventListener('click', () => {
      if (!s.amount) return toast('Guarde algum valor primeiro');
      s.updatedAt -= 30 * 86400000; // volta o relógio da caixinha 30 dias
      save();
      const before = s.earned;
      accrueSavings();
      toast(`+ ${money(s.earned - before)} de rendimento`);
      views.caixinha();
    });
  };

  // ---------- Cartão
  const MERCHANTS = [['Mercado Bom Preço', 'Mercado'], ['Posto Chama', 'Combustível'], ['Padaria Fornalha', 'Alimentação'], ['Streaming Plus', 'Assinatura'], ['Farmácia Vida', 'Saúde'], ['Loja de Games Pixel', 'Lazer'], ['App de Transporte', 'Transporte']];
  views.cartao = () => {
    const c = state.card;
    const used = cardUsed();
    let reveal = false;
    const draw = () => {
      const num = reveal ? c.number.replace(/(\d{4})(?=\d)/g, '$1 ') : '•••• •••• •••• ' + c.number.slice(-4);
      app.innerHTML = `${top('Cartão')}
        <div class="vcard ${c.blocked ? 'blocked' : ''}">
          <div class="logo"><span>Forge Bank</span><span>${c.blocked ? 'BLOQUEADO' : 'Virtual'}</span></div>
          <div class="num">${num}</div>
          <div class="meta"><div>Nome<b>${esc(state.user.name.toUpperCase().slice(0, 22))}</b></div>
            <div>Validade<b>${c.exp}</b></div><div>CVV<b>${reveal ? c.cvv : '•••'}</b></div></div>
        </div>
        <div class="mini-grid" style="margin-bottom:14px">
          <div class="card mini"><small>Fatura atual</small><strong>${money(used)}</strong></div>
          <div class="card mini"><small>Limite disponível</small><strong>${money(c.limit - used)}</strong>
            <div class="bar"><i style="width:${Math.min(100, (used / c.limit) * 100)}%"></i></div></div>
        </div>
        <button class="btn ghost" id="reveal">${reveal ? 'Esconder dados' : 'Ver dados do cartão'}</button>
        <button class="btn ghost" id="block">${c.blocked ? 'Desbloquear cartão' : 'Bloquear temporariamente'}</button>
        <button class="btn ghost" id="buy" ${c.blocked ? 'disabled' : ''}>Simular compra</button>
        <button class="btn" id="pay" ${used ? '' : 'disabled'}>Pagar fatura</button>
        <div class="section-title"><h2>Compras na fatura</h2></div>
        <div class="card">${c.purchases.length ? c.purchases.map((p) => `<div class="row"><div class="ic">▭</div>
          <div class="txt"><strong>${esc(p.merchant)}</strong><small>${esc(p.cat)} · ${new Date(p.ts).toLocaleDateString('pt-BR')}</small></div>
          <div class="amount out">${money(p.amount)}</div></div>`).join('') : '<div class="empty">Nenhuma compra nesta fatura.</div>'}</div>
        ${nav('cartao')}`;
      $('#reveal').addEventListener('click', async () => { if (!reveal && !(await confirmPin('Confirme para ver os dados'))) return; reveal = !reveal; draw(); });
      $('#block').addEventListener('click', async () => {
        if (c.blocked && !(await confirmPin('Confirme para desbloquear'))) return;
        c.blocked = !c.blocked; save(); toast(c.blocked ? 'Cartão bloqueado' : 'Cartão desbloqueado'); draw();
      });
      $('#buy').addEventListener('click', () => {
        const [merchant, cat] = pick(MERCHANTS);
        const amount = rand(890, 35000);
        if (amount > c.limit - cardUsed()) return toast('Compra recusada: limite insuficiente');
        c.purchases.unshift({ id: uid(), ts: Date.now(), merchant, cat, amount }); save();
        toast(`Compra aprovada: ${merchant} ${money(amount)}`);
        views.cartao();
      });
      $('#pay').addEventListener('click', async () => {
        const total = cardUsed();
        if (total > state.balance) return toast('Saldo insuficiente para pagar a fatura');
        if (!(await confirmPin(`Pagar fatura de ${money(total)}`))) return;
        c.purchases = [];
        addTx({ type: 'card-bill', title: 'Pagamento de fatura', desc: 'Cartão Forge', amount: -total, icon: '▭' });
        success({ title: 'Fatura paga', amount: total, lines: [['Cartão', 'final ' + c.number.slice(-4)]], back: '#/cartao' });
      });
    };
    draw();
  };

  // ---------- Perfil
  views.perfil = () => {
    const u = state.user;
    app.innerHTML = `${top('Perfil')}
      <div class="card">
        <div class="row"><span class="muted" style="flex:1">Nome</span><strong>${esc(u.name)}</strong></div>
        <div class="row"><span class="muted" style="flex:1">CPF</span><strong>${maskCPF(u.cpf)}</strong></div>
        <div class="row"><span class="muted" style="flex:1">E-mail</span><strong style="word-break:break-all">${esc(u.email)}</strong></div>
        <div class="row"><span class="muted" style="flex:1">Celular</span><strong>${fmtPhone(u.phone)}</strong></div>
        <div class="row"><span class="muted" style="flex:1">Agência / Conta</span><strong>${state.account.agency} / ${state.account.number}</strong></div>
        <div class="row"><span class="muted" style="flex:1">Cliente desde</span><strong>${new Date(u.createdAt).toLocaleDateString('pt-BR')}</strong></div>
      </div>
      <a class="btn ghost" style="display:block;text-align:center;text-decoration:none" href="#/pix/chaves">Minhas chaves Pix</a>
      <button class="btn ghost" id="pin">Alterar PIN</button>
      <button class="btn ghost" id="out">Bloquear app</button>
      <button class="btn danger" id="del">Encerrar conta e apagar dados</button>
      <p class="demo-note">Forge Bank · protótipo da Forge Studios · v0.1</p>
      ${nav('perfil')}`;
    $('#out').addEventListener('click', lock);
    $('#del').addEventListener('click', () => resetAll('Isso apaga a conta, o saldo e o histórico deste navegador. Não dá para desfazer. Continuar?'));
    $('#pin').addEventListener('click', async () => {
      if (!(await confirmPin('Digite o PIN atual'))) return;
      let first = null;
      const draw = (msg, err = '') => {
        app.innerHTML = `${top('Novo PIN', '#/perfil')}<div class="center"><p class="muted">${esc(msg)}</p>${dotsHTML()}<p class="error">${esc(err)}</p>${keypadHTML()}</div>`;
        bindPin(app, async (pin) => {
          if (!first) { first = pin; return draw('Confirme o novo PIN.'); }
          if (pin !== first) { first = null; return draw('Digite o novo PIN.', 'Os PINs não conferem.'); }
          state.user.salt = uid();
          state.user.pinHash = await hashPin(pin, state.user.salt);
          save(); toast('PIN alterado'); location.hash = '#/perfil'; views.perfil();
        });
      };
      draw('Digite o novo PIN.');
    });
  };

  // ---------------------------------------------------------------- roteador
  const routes = {
    '/home': views.home, '/extrato': views.extrato, '/pix': views.pix, '/pix/enviar': views.pixEnviar,
    '/pix/receber': views.pixReceber, '/pix/chaves': views.pixChaves, '/pagar': views.pagar,
    '/depositar': views.depositar, '/caixinha': views.caixinha, '/cartao': views.cartao, '/perfil': views.perfil,
  };

  function render() {
    document.querySelectorAll('.sheet-bg').forEach((n) => n.remove());
    const [path, query] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query || '');
    if (!state) return path === '/cadastro' ? views.cadastro() : views.welcome();
    if (!isUnlocked()) return views.login();
    (routes[path] || views.home)(params);
    window.scrollTo(0, 0);
  }

  addEventListener('hashchange', render);
  // Outra aba alterou os dados: recarrega o estado.
  addEventListener('storage', (e) => { if (e.key === STORE_KEY) { state = load(); render(); } });
  resetIdle();
  render();
})();
