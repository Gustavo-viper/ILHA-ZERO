// Oficina 3D: carro no elevador, câmera orbital, desmontagem parafuso por parafuso.
import { THREE, construirCarro, descartar, bloqueiaMontagem, bloqueiaDesmontagem } from './carro3d.js';
import { PECAS, LISTA_PECAS } from './data.js';
import { S, salvar, precoPeca, tempoPeca, inspecionar, diagnosticar, aplicarTroca, FIM_DIA } from './estado.js';
import { modelo } from './fisica.js';
import { dinheiro, hora, esc, barra, aviso, corCond } from './ui.js';
import { chave, bip, erro, dinheiro as somDinheiro } from './som.js';

const ALTURA_ELEVADOR = 0.75;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const meioTempo = p => Math.ceil(tempoPeca(p) / 2);

function texturaPiso() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#3b3f46'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},255,${Math.random() * .04})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.strokeStyle = '#2a2d33'; x.lineWidth = 3; x.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaPlaca() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#11151c'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#f6993f'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = '#f6993f'; x.font = 'bold 64px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('OFICINA TURBO', 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function montarAmbiente(cena) {
  const mat = (c, r = .7, m = .2, e = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...e });
  const add = (geo, m, x, y, z, sombra = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = sombra; o.receiveShadow = true; cena.add(o); return o; };
  const piso = add(new THREE.PlaneGeometry(30, 30), mat('#ffffff', .85, .1, { map: texturaPiso() }), 0, 0, 0, false);
  piso.rotation.x = -Math.PI / 2;
  // faixas amarelas da vaga
  for (const z of [-1.9, 1.9]) add(new THREE.BoxGeometry(6, .005, .08), mat('#d69e2e', .6, 0), 0, .003, z, false);
  // paredes
  const parede = mat('#4a5262', .95, 0);
  add(new THREE.BoxGeometry(20, 5, .2), parede, 0, 2.5, -5, false);
  add(new THREE.BoxGeometry(.2, 5, 14), parede, -8, 2.5, 2, false);
  add(new THREE.BoxGeometry(20, 1, .22), mat('#2b6cb0', .7, 0), 0, .5, -4.99, false);
  const placa = add(new THREE.PlaneGeometry(4, 1), mat('#ffffff', .5, 0, { map: texturaPlaca(), emissive: '#ffffff', emissiveIntensity: .25, emissiveMap: texturaPlaca() }), 0, 3.6, -4.88, false);
  placa.castShadow = false;
  // elevador: colunas e braços
  const azul = mat('#2c5282', .5, .5), cinza = mat('#718096', .4, .7);
  for (const z of [-1.45, 1.45]) {
    add(new THREE.BoxGeometry(.25, 2.8, .25), azul, -.1, 1.4, z);
    add(new THREE.BoxGeometry(.5, .05, .5), cinza, -.1, .025, z);
    for (const x of [-1.0, .8]) {
      const braco = add(new THREE.BoxGeometry(Math.abs(x + .1) + .1, .06, .1), cinza, (x - .1) / 2, ALTURA_ELEVADOR + .34, z * .78);
      braco.rotation.y = 0;
    }
  }
  // bancada com ferramentas
  const madeira = mat('#7b5a3a', .8, 0);
  add(new THREE.BoxGeometry(2.6, .08, .8), madeira, -2.6, .95, -4.3);
  for (const x of [-3.8, -1.4]) add(new THREE.BoxGeometry(.08, .95, .7), cinza, x, .475, -4.3);
  add(new THREE.BoxGeometry(2.6, 1.4, .05), mat('#2d3748', .9, 0), -2.6, 1.9, -4.87, false);
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(.05, .35 + (i % 3) * .1, .03), cinza, -3.6 + i * .3, 1.9, -4.82, false);
  // carrinho de ferramentas vermelho
  const vermelho = mat('#c53030', .45, .3);
  add(new THREE.BoxGeometry(.9, .9, .5), vermelho, 3.4, .5, -3.6);
  for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(.8, .02, .02), cinza, 3.4, .25 + i * .2, -3.34, false);
  // pilha de pneus e tambores de óleo
  const borracha = mat('#16181c', .95, 0);
  for (let i = 0; i < 4; i++) { const p = add(new THREE.TorusGeometry(.3, .12, 10, 24), borracha, 5, .12 + i * .24, -2.4); p.rotation.x = Math.PI / 2; }
  for (const [x, z, c] of [[-6.8, -3.8, '#2f855a'], [-6.1, -4.1, '#c05621'], [-6.8, -3.0, '#2b6cb0']]) add(new THREE.CylinderGeometry(.3, .3, .9, 16), mat(c, .5, .4), x, .45, z);
  // luzes
  cena.add(new THREE.HemisphereLight('#dfe8ff', '#3a3026', 1.1));
  const sol = new THREE.DirectionalLight('#fff6e8', 2.2);
  sol.position.set(4, 8, 5); sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
  cena.add(sol);
  for (const x of [-2.5, 2.5]) {
    add(new THREE.BoxGeometry(1.6, .06, .2), mat('#ffffff', .3, 0, { emissive: '#ffffff', emissiveIntensity: 1.5 }), x, 4.4, 0, false);
    const l = new THREE.PointLight('#fff2dd', 6, 12, 1.6); l.position.set(x, 4, 0); cena.add(l);
  }
  const baixo = new THREE.PointLight('#bcd4ff', 3, 6, 1.5); baixo.position.set(.5, .4, 0); cena.add(baixo); // lanterna de baixo
}

// Abre a oficina 3D. serv = serviço de cliente (ou null para carro próprio).
export function abrirOficina3D(carro, serv, aoFechar) {
  carro.fora = carro.fora || {};
  const m = modelo(carro.modelo);
  const raiz = document.createElement('div');
  raiz.id = 'o3d';
  raiz.innerHTML = `
    <canvas id="o3d-cena"></canvas>
    <div class="o3d-topo">
      <button class="btn peq" id="o3d-voltar">← Voltar</button>
      <div class="o3d-titulo"><b>${esc(m.nome)}</b><span class="fraco">${serv ? esc(serv.cliente) : 'seu carro'}</span></div>
      <div class="o3d-hora" id="o3d-hora"></div>
    </div>
    <div class="o3d-ferr" id="o3d-ferr"></div>
    <div class="o3d-base">
      <div class="o3d-painel" id="o3d-painel"></div>
      <div class="o3d-chips" id="o3d-chips"></div>
    </div>`;
  document.body.appendChild(raiz);
  document.body.classList.add('em-3d');

  const canvas = raiz.querySelector('#o3d-cena');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    raiz.remove(); document.body.classList.remove('em-3d');
    aviso('Seu aparelho não suporta 3D (WebGL).', 3500);
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const cena = new THREE.Scene();
  cena.background = new THREE.Color('#1a1e25');
  cena.fog = new THREE.Fog('#1a1e25', 12, 26);
  const cam = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
  montarAmbiente(cena);

  const { raiz: carro3d, pecas } = construirCarro(carro, { capoAberto: true });
  carro3d.position.y = ALTURA_ELEVADOR;
  cena.add(carro3d);
  for (const p of LISTA_PECAS) {
    const g = pecas[p];
    g.userData.filhos = g.children.map(o => ({ o, pos: o.position.clone() }));
    if (carro.fora[p]) g.visible = false;
  }

  // ── câmera orbital ──
  const orb = { alvo: V(0.6, 1.3, 0), th: 0.75, ph: 0.42, dist: 5.6 };
  const orbAlvo = { alvo: orb.alvo.clone(), th: orb.th, ph: orb.ph, dist: orb.dist };
  function focar(p) {
    const g = pecas[p], s = g.userData.saida;
    orbAlvo.alvo.copy(g.userData.centro).add(V(0, ALTURA_ELEVADOR, 0));
    orbAlvo.dist = p === 'pneus' || p === 'escapamento' ? 3.6 : 2.1;
    if (s.y < -0.5) { orbAlvo.ph = -0.3; orbAlvo.th = 0.35; orbAlvo.dist = 2.6; }
    else if (s.z > 0.5) { orbAlvo.ph = 0.3; orbAlvo.th = 1.35; }
    else if (s.z < -0.5) { orbAlvo.ph = 0.35; orbAlvo.th = -1.3; }
    else if (s.x > 0.5) { orbAlvo.ph = 0.45; orbAlvo.th = 0.2; }
    else { orbAlvo.ph = 0.95; orbAlvo.th = 0.7; }
  }
  function visaoGeral() { orbAlvo.alvo.set(0.6, 1.3, 0); orbAlvo.th = 0.75; orbAlvo.ph = 0.42; orbAlvo.dist = 5.6; }
  function aplicarCamera(dt) {
    const k = Math.min(1, dt * 6);
    orb.alvo.lerp(orbAlvo.alvo, k);
    let d = orbAlvo.th - orb.th; d = Math.atan2(Math.sin(d), Math.cos(d));
    orb.th += d * k; orb.ph += (orbAlvo.ph - orb.ph) * k; orb.dist += (orbAlvo.dist - orb.dist) * k;
    const minPh = Math.asin(Math.max(-0.95, Math.min(0.95, (0.2 - orb.alvo.y) / orb.dist)));
    const ph = Math.max(minPh, orb.ph);
    cam.position.set(orb.alvo.x + orb.dist * Math.cos(ph) * Math.cos(orb.th), orb.alvo.y + orb.dist * Math.sin(ph), orb.alvo.z + orb.dist * Math.cos(ph) * Math.sin(orb.th));
    cam.lookAt(orb.alvo);
  }

  const ponteiros = new Map();
  let arrasto = null, pinca = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 1) arrasto = { x0: e.clientX, y0: e.clientY, t: performance.now(), moveu: 0 };
    if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = Math.hypot(a.x - b.x, a.y - b.y); if (arrasto) arrasto.moveu = 99; }
  });
  canvas.addEventListener('pointermove', e => {
    const ant = ponteiros.get(e.pointerId); if (!ant) return;
    const dx = e.clientX - ant.x, dy = e.clientY - ant.y;
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 1 && arrasto) {
      arrasto.moveu += Math.abs(dx) + Math.abs(dy);
      orbAlvo.th += dx * 0.008; orbAlvo.ph = Math.max(-0.9, Math.min(1.45, orbAlvo.ph + dy * 0.006));
      orb.th = orbAlvo.th; orb.ph = orbAlvo.ph;
    } else if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinca) { orbAlvo.dist = Math.max(1.2, Math.min(9, orbAlvo.dist * pinca / d)); orb.dist = orbAlvo.dist; }
      pinca = d;
    }
  });
  const soltarPonteiro = e => {
    const estava = ponteiros.has(e.pointerId);
    ponteiros.delete(e.pointerId);
    if (ponteiros.size < 2) pinca = 0;
    if (estava && ponteiros.size === 0 && arrasto) {
      if (arrasto.moveu < 10 && performance.now() - arrasto.t < 500) tocar(e.clientX, e.clientY);
      arrasto = null;
    }
  };
  canvas.addEventListener('pointerup', soltarPonteiro);
  canvas.addEventListener('pointercancel', soltarPonteiro);
  canvas.addEventListener('wheel', e => { e.preventDefault(); orbAlvo.dist = Math.max(1.2, Math.min(9, orbAlvo.dist * (1 + Math.sign(e.deltaY) * 0.12))); }, { passive: false });

  // ── estado da interação ──
  let sel = null, modo = null, ocupado = false;
  const anims = [];
  const animar = (dur, fn, fim) => anims.push({ dur, t: 0, fn, fim });

  const ray = new THREE.Raycaster();
  function tocar(x, y) {
    if (ocupado) return;
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), cam);
    const alvos = [];
    for (const p of LISTA_PECAS) if (pecas[p].visible) alvos.push(pecas[p]);
    const hits = ray.intersectObjects(alvos, true);
    if (!hits.length) return;
    let o = hits[0].object;
    if (modo) {
      // procura um parafuso ativo entre os acertos
      const hb = hits.find(h => h.object.userData.parafuso && pecas[modo.p].userData.parafusos.includes(h.object));
      if (hb) { if (modo.tipo === 'soltar') soltarParafuso(hb.object); else apertar(); return; }
    }
    while (o && !o.userData.peca) o = o.parent;
    if (o && !modo) selecionar(o.userData.peca);
  }

  function selecionar(p) {
    sel = p; focar(p); bip(520, 0.04, 'triangle', 0.05);
    desenharUI();
  }

  function definirBrilho(g, cor, intensidade) {
    g.traverse(o => {
      if (!o.isMesh || o.userData.parafuso) return;
      o.material.emissive.set(cor); o.material.emissiveIntensity = intensidade;
    });
  }
  function brilhoParafusos(g, cor, i) { g.userData.parafusos.forEach(b => { b.material.emissive.set(cor); b.material.emissiveIntensity = i; }); }

  function opacidade(g, a) {
    g.traverse(o => { if (o.isMesh) { o.material.transparent = a < 1 || o.material.userData.transp; o.material.opacity = a; } });
  }

  // ── desmontar ──
  function iniciarDesmontagem(p) {
    const falta = bloqueiaDesmontagem(p, carro.fora);
    if (falta.length) { erro(); aviso('Antes tire: ' + falta.map(q => PECAS[q].nome).join(', ')); return; }
    if (serv && S.hora + meioTempo(p) > FIM_DIA) { erro(); aviso('Não dá tempo hoje.'); return; }
    const g = pecas[p];
    modo = { tipo: 'soltar', p, restantes: g.userData.parafusos.filter(b => b.visible) };
    focar(p);
    desenharUI();
  }
  function soltarParafuso(b) {
    if (!modo || modo.tipo !== 'soltar') return;
    if (!b) b = modo.restantes[0];
    if (!b || !modo.restantes.includes(b)) return;
    modo.restantes = modo.restantes.filter(x => x !== b);
    chave();
    const ini = b.position.clone(), n = b.userData.normal;
    animar(0.35, k => { b.position.copy(ini).addScaledVector(n, 0.1 * k); b.rotateOnAxis(V(0, 1, 0), 0.5); }, () => { b.visible = false; });
    if (!modo.restantes.length) setTimeout(() => tirarPeca(modo.p), 380);
    desenharUI();
  }
  function tirarPeca(p) {
    const g = pecas[p];
    ocupado = true;
    animar(0.7, k => {
      for (const { o, pos } of g.userData.filhos) {
        if (o.userData.parafuso) continue;
        const s = o.userData.saida || g.userData.saida;
        o.position.copy(pos).addScaledVector(s, 0.8 * k * k);
      }
      opacidade(g, 1 - k);
    }, () => {
      g.visible = false; opacidade(g, 1);
      for (const { o, pos } of g.userData.filhos) if (!o.userData.parafuso) o.position.copy(pos);
      carro.fora[p] = true;
      if (serv) { S.hora += meioTempo(p); serv.conhecido[p] = true; }
      salvar();
      modo = null; ocupado = false;
      bip(330, 0.12, 'triangle', 0.08);
      aviso(`${PECAS[p].nome} fora do carro (${carro.partes[p]}%)`);
      desenharUI();
    });
  }

  // ── montar ──
  function iniciarMontagem(p, nova) {
    const falta = bloqueiaMontagem(p, carro.fora);
    if (falta.length) { erro(); aviso('Antes monte: ' + falta.map(q => PECAS[q].nome).join(', ')); return; }
    if (serv && S.hora + meioTempo(p) > FIM_DIA) { erro(); aviso('Não dá tempo hoje.'); return; }
    if (nova && S.dinheiro < precoPeca(p, carro)) { erro(); aviso(`Falta dinheiro: a peça custa ${dinheiro(precoPeca(p, carro))}.`); return; }
    const g = pecas[p];
    modo = { tipo: 'apertar', p, nova, notas: [], fila: [...g.userData.parafusos], pos: 0, dir: 1, centro: 0.5, larg: 0.2 };
    novaZona();
    ocupado = true;
    g.visible = true;
    g.userData.parafusos.forEach(b => { b.visible = true; b.position.copy(b.userData.casa).addScaledVector(b.userData.normal, 0.08); });
    focar(p);
    animar(0.6, k => {
      const e = 1 - (1 - k) * (1 - k);
      for (const { o, pos } of g.userData.filhos) {
        if (o.userData.parafuso) continue;
        const s = o.userData.saida || g.userData.saida;
        o.position.copy(pos).addScaledVector(s, 0.8 * (1 - e));
      }
      opacidade(g, e);
    }, () => { opacidade(g, 1); ocupado = false; desenharUI(); });
    desenharUI();
  }
  function novaZona() {
    const facil = !!S.equip.chave;
    modo.larg = (facil ? 0.26 : 0.19) - modo.notas.length * 0.012;
    modo.centro = 0.2 + Math.random() * 0.6;
  }
  function apertar() {
    if (!modo || modo.tipo !== 'apertar' || ocupado) return;
    const b = modo.fila.shift(); if (!b) return;
    const d = Math.abs(modo.pos - modo.centro) / (modo.larg / 2);
    const nota = d <= 0.25 ? 1 : d <= 1 ? 1 - (d - 0.25) * 0.4 : Math.max(0.2, 0.6 - (d - 1) * 0.5);
    modo.notas.push(nota);
    if (nota >= 0.98) bip(1200, 0.08, 'triangle', 0.1); else if (nota >= 0.7) chave(); else erro();
    const ini = b.position.clone();
    animar(0.3, k => { b.position.lerpVectors(ini, b.userData.casa, k); b.rotateOnAxis(V(0, 1, 0), -0.5); });
    if (modo.fila.length) { novaZona(); desenharUI(); return; }
    const { p, nova, notas } = modo;
    const q = notas.reduce((a, c) => a + c, 0) / notas.length;
    modo = null;
    delete carro.fora[p];
    if (nova) {
      aplicarTroca(carro, p, q, serv);
      somDinheiro();
      aviso(`${q >= 0.95 ? 'Aperto perfeito!' : q >= 0.8 ? 'Bem apertado.' : q >= 0.6 ? 'Ficou razoável.' : 'Ficou meio torto...'} ${PECAS[p].nome} nova (${carro.partes[p]}%)`);
    } else {
      if (serv) S.hora += meioTempo(p);
      aviso(`${PECAS[p].nome} montada de volta.`);
    }
    salvar();
    setTimeout(desenharUI, 320);
  }

  // ── interface HTML ──
  const painel = raiz.querySelector('#o3d-painel'), chips = raiz.querySelector('#o3d-chips');
  const ferr = raiz.querySelector('#o3d-ferr');
  function estadoTexto(p) {
    const conhecido = !serv || serv.conhecido[p];
    return conhecido ? `${carro.partes[p]}%` : '?';
  }
  function desenharUI() {
    raiz.querySelector('#o3d-hora').innerHTML = serv
      ? `<span class="relogio">${hora(S.hora)}</span><small>${dinheiro(S.dinheiro)}</small>`
      : `<small>${dinheiro(S.dinheiro)}</small>`;
    ferr.innerHTML = `${serv ? `<details class="o3d-sint"><summary>📋 Reclamações (${serv.sintomas.length})</summary><ul>${serv.sintomas.map(s => `<li>“${esc(s)}”</li>`).join('')}</ul></details>` : ''}
      ${serv && S.equip.scanner ? `<button class="btn peq" data-a="diag" data-eq="scanner">📟 Scanner</button>` : ''}
      ${serv && S.equip.elevador ? `<button class="btn peq" data-a="diag" data-eq="elevador">🏗️ Inspeção por baixo</button>` : ''}
      <button class="btn peq" data-a="geral">🎥 Visão geral</button>`;

    chips.innerHTML = LISTA_PECAS.map(p => {
      const conhecido = !serv || serv.conhecido[p];
      const cor = conhecido ? corCond(carro.partes[p]) : 'var(--fraco)';
      return `<button class="chip ${sel === p ? 'sel' : ''} ${carro.fora[p] ? 'fora' : ''}" data-a="sel" data-p="${p}">
        ${PECAS[p].icone} ${PECAS[p].nome}<i style="background:${cor}">${carro.fora[p] ? 'fora' : estadoTexto(p)}</i></button>`;
    }).join('');

    let h = '';
    if (modo && modo.tipo === 'soltar') {
      const total = pecas[modo.p].userData.parafusos.length;
      h = `<div class="linha"><b>Soltando: ${PECAS[modo.p].nome}</b><span class="fraco">${total - modo.restantes.length}/${total} parafusos</span></div>
        <p class="fraco">Toque nos parafusos <b style="color:var(--amarelo)">piscando</b> no carro (gire a câmera se precisar).</p>
        <div class="botoes"><button class="btn" data-a="cancelar">Cancelar</button><button class="btn pri" data-a="soltar">🔧 Soltar próximo</button></div>`;
    } else if (modo && modo.tipo === 'apertar') {
      const total = pecas[modo.p].userData.parafusos.length;
      h = `<div class="linha"><b>Apertando: ${PECAS[modo.p].nome}${modo.nova ? ' (nova)' : ''}</b><span class="fraco">${modo.notas.length}/${total}</span></div>
        <div class="aperto" id="o3d-torque"><div class="zona" style="left:${(modo.centro - modo.larg / 2) * 100}%;width:${modo.larg * 100}%"></div>
        <div class="perfeito" style="left:${(modo.centro - modo.larg / 8) * 100}%;width:${modo.larg / 4 * 100}%"></div><div class="agulha" id="o3d-agulha"></div></div>
        <button class="btn pri largo" data-a="apertar" style="padding:14px">APERTAR (torque na faixa verde)</button>`;
    } else if (sel) {
      const p = sel, info = PECAS[p], fora = carro.fora[p];
      const conhecido = !serv || serv.conhecido[p];
      const bloqD = bloqueiaDesmontagem(p, carro.fora), bloqM = bloqueiaMontagem(p, carro.fora);
      h = `<div class="linha"><b>${info.icone} ${info.nome}</b><button class="btn peq" data-a="fechar-sel">✕</button></div>
        ${conhecido ? `${barra(carro.partes[p])}<p class="fraco">Estado: <b style="color:${corCond(carro.partes[p])}">${carro.partes[p]}%</b>${serv && p in serv.trocadas ? ' · peça nova' : ''}</p>`
          : `<p class="fraco">Estado desconhecido. Inspecione ou desmonte para ver.</p>`}
        <div class="botoes">`;
      if (fora) {
        h += `<button class="btn pri" data-a="nova" ${bloqM.length ? 'disabled' : ''}>Montar nova ${dinheiro(precoPeca(p, carro))}</button>
          <button class="btn" data-a="original" ${bloqM.length ? 'disabled' : ''}>Montar a mesma</button>`;
        if (bloqM.length) h += `</div><p class="fraco">Antes monte: ${bloqM.map(q => PECAS[q].nome).join(', ')}</p>`;
        else h += `</div>`;
      } else {
        if (serv && !conhecido) h += `<button class="btn" data-a="inspecionar">🔍 Inspecionar (10 min)</button>`;
        h += `<button class="btn pri" data-a="desmontar" ${bloqD.length ? 'disabled' : ''}>🔧 Desmontar${serv ? ` (${meioTempo(p)} min)` : ''}</button></div>`;
        if (bloqD.length) h += `<p class="fraco">Para chegar nela, tire antes: ${bloqD.map(q => PECAS[q].nome).join(', ')}</p>`;
      }
    } else {
      const nFora = Object.keys(carro.fora).length;
      h = `<p><b>Toque numa peça</b> no carro ou na lista abaixo. Arraste para girar, pinça ou roda do mouse para zoom.</p>
        ${nFora ? `<p style="color:var(--laranja)">${nFora} peça(s) fora do carro. Monte tudo antes de ${serv ? 'entregar' : 'correr'}.</p>` : ''}`;
    }
    painel.innerHTML = h;
  }

  raiz.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'sel' && !modo && !ocupado) selecionar(b.dataset.p);
    else if (a === 'geral') { if (!modo) { sel = null; desenharUI(); } visaoGeral(); }
    else if (a === 'fechar-sel') { sel = null; visaoGeral(); desenharUI(); }
    else if (a === 'diag') { const r = diagnosticar(serv, b.dataset.eq); if (!r.ok) { erro(); aviso(r.msg); } else aviso('Diagnóstico pronto.'); desenharUI(); }
    else if (a === 'inspecionar') { const r = inspecionar(serv, sel); if (!r.ok) { erro(); aviso(r.msg); } desenharUI(); }
    else if (a === 'desmontar') iniciarDesmontagem(sel);
    else if (a === 'soltar') soltarParafuso(null);
    else if (a === 'cancelar' && modo?.tipo === 'soltar') {
      pecas[modo.p].userData.parafusos.forEach(x => { x.visible = true; x.position.copy(x.userData.casa); });
      modo = null; desenharUI();
    }
    else if (a === 'nova') iniciarMontagem(sel, true);
    else if (a === 'original') iniciarMontagem(sel, false);
    else if (a === 'apertar') apertar();
  });
  raiz.querySelector('#o3d-voltar').onclick = fechar;
  const tecla = e => {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (modo?.tipo === 'apertar') { e.preventDefault(); apertar(); }
      else if (modo?.tipo === 'soltar') { e.preventDefault(); soltarParafuso(null); }
    } else if (e.code === 'Escape' && !modo) fechar();
  };
  window.addEventListener('keydown', tecla);

  function redimensionar() {
    const w = raiz.clientWidth, h = raiz.clientHeight;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w < h ? 58 : 45;
    cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', redimensionar);
  redimensionar();

  let raf = 0, ultimo = performance.now(), relogio = 0, fechado = false;
  function loop(t) {
    if (fechado) return;
    const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t; relogio += dt;
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]; a.t += dt;
      const k = Math.min(1, a.t / a.dur); a.fn(k);
      if (k >= 1) { anims.splice(i, 1); a.fim && a.fim(); }
    }
    const pulso = 0.5 + 0.5 * Math.sin(relogio * 6);
    for (const p of LISTA_PECAS) {
      const g = pecas[p];
      definirBrilho(g, '#f6993f', p === sel && !modo ? 0.15 + 0.25 * pulso : 0);
      brilhoParafusos(g, modo?.tipo === 'apertar' ? '#48bb78' : '#f6e05e', modo && modo.p === p ? 0.4 + 0.8 * pulso : 0);
    }
    if (modo?.tipo === 'apertar') {
      modo.pos += modo.dir * (S.equip.chave ? 0.75 : 1.05) * (1 + modo.notas.length * 0.1) * dt;
      if (modo.pos > 1) { modo.pos = 1; modo.dir = -1; } else if (modo.pos < 0) { modo.pos = 0; modo.dir = 1; }
      const ag = painel.querySelector('#o3d-agulha'); if (ag) ag.style.left = modo.pos * 100 + '%';
    }
    aplicarCamera(dt);
    renderer.render(cena, cam);
    raf = requestAnimationFrame(loop);
  }

  function fechar() {
    if (modo || ocupado) { aviso('Termine o aperto ou cancele antes de sair.'); return; }
    fechado = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', tecla);
    window.removeEventListener('resize', redimensionar);
    cena.traverse(o => { if (o.isMesh) { o.geometry.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(mm => { mm.map?.dispose(); mm.dispose(); }); } });
    descartar(carro3d);
    renderer.dispose();
    renderer.forceContextLoss();
    raiz.remove();
    document.body.classList.remove('em-3d');
    aoFechar && aoFechar();
  }

  desenharUI();
  raf = requestAnimationFrame(loop);
}
