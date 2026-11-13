// ILHA ZERO — cliente do jogo.
import * as THREE from 'three';
import { World, HALF, MAP_SIZE, rayPlayer, WATER_LEVEL } from './shared/world.js';
import { WEAPONS, ITEMS, STATE_NAME } from './shared/sim.js';
import { detectHardware, TIERS, AutoTuner } from './quality.js';
import { GameScene, makeCharacter, poseCharacter, makeLoot } from './scene.js';
import { OnlineTransport, LocalTransport } from './net.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_SEED = 20261113;
const store = { get(k, d) { try { const v = localStorage.getItem('iz_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('iz_' + k, JSON.stringify(v)); } catch {} } };

// ---------------------------------------------------------------- hardware
const hw = detectHardware();
const savedTier = store.get('tier', 'auto');
let startTier = savedTier === 'auto' ? hw.tier : +savedTier;
$('hwinfo').innerHTML = `GPU: <b>${esc(hw.gpu)}</b><br>CPU: <b>${hw.cores} núcleos</b> · RAM: <b>${hw.mem ? (hw.mem >= 8 ? '8+ GB' : hw.mem + ' GB') : 'n/d'}</b> · Tela: <b>${hw.screenW}×${hw.screenH}</b> · WebGL${hw.webgl2 ? '2' : '1'}<br>Qualidade automática: <b>${TIERS[hw.tier].name}</b> — ajusta sozinha durante o jogo pelo FPS.` + (hw.noWebGL ? '<br><b style="color:#f66">WebGL indisponível neste navegador.</b>' : '');
$('name').value = store.get('name', '');
const canOnline = location.protocol.startsWith('http') && !/github\.io$/.test(location.hostname);
if (!canOnline) { $('btnOnline').disabled = true; $('btnOnline').title = 'Rode o servidor (npm start) para jogar online'; $('btnOnline').textContent = 'ONLINE (requer o servidor Node — ver README)'; }

// ---------------------------------------------------------------- estado global
const G = {
  running: false, net: null, world: null, gs: null, myId: 0, phase: 'lobby', phaseTimer: 0,
  me: { x: 0, y: 50, z: 0, vx: 0, vy: 0, vz: 0, onGround: false, state: 'lobby', crouch: false, yaw: 0, pitch: 0 },
  inv: null, names: new Map(), ents: new Map(), loot: new Map(), lootMeshes: new Map(),
  zone: null, plane: null, planeT: 0, planeTLocal: 0, alive: 0, kills: 0, total: 30,
  ads: false, firing: false, lastFire: 0, recoil: 0, spec: null, ended: false, mapOpen: false,
  sens: store.get('sens', 1), vol: store.get('vol', 0.6), showPerf: store.get('perf', true),
  predMag: null, sendAcc: 0, lastSnap: 0, pendingSwitch: null,
};

// ---------------------------------------------------------------- áudio (sintetizado, sem arquivos)
let actx = null, noiseBuf = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); const n = actx.sampleRate * 0.6; noiseBuf = actx.createBuffer(1, n, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5); } catch {} }
  return actx;
}
function sfxShot(type, dist = 0) {
  const a = audio(); if (!a || G.vol <= 0) return;
  const vol = G.vol * Math.max(0, 1 - dist / 500) ** 1.6; if (vol < 0.01) return;
  const src = a.createBufferSource(); src.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.value = (type === 'sniper' ? 2600 : type === 'shotgun' ? 1500 : type === 'pistol' ? 3200 : 2400) * (1 - Math.min(0.8, dist / 400));
  const g = a.createGain(); const t = a.currentTime; const len = type === 'sniper' ? 0.55 : type === 'shotgun' ? 0.45 : 0.22;
  g.gain.setValueAtTime(vol * (type === 'sniper' || type === 'shotgun' ? 1 : 0.7), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(f).connect(g).connect(a.destination); src.start(t, 0, len);
  if (dist < 60) { const o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.1); og.gain.setValueAtTime(vol * 0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(og).connect(a.destination); o.start(t); o.stop(t + 0.13); }
}
function sfxBeep(freq = 880, len = 0.05, v = 0.15) { const a = audio(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.frequency.value = freq; g.gain.setValueAtTime(v * G.vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.01); }

// ---------------------------------------------------------------- menu
$('btnOffline').onclick = () => start(false);
$('btnOnline').onclick = () => start(true);
$('btnSettings').onclick = () => openSettings(false);
$('btnResume').onclick = () => closeSettings();
$('btnQuit').onclick = () => location.reload();
$('btnMenu').onclick = () => location.reload();
$('btnSpectate').onclick = () => { $('endscreen').classList.add('hidden'); lockPointer(); };

async function start(online) {
  audio();
  const name = ($('name').value.trim() || 'Jogador' + ((Math.random() * 900 + 100) | 0)).slice(0, 16);
  store.set('name', $('name').value.trim());
  G.myName = name;
  $('status').textContent = online ? 'Conectando ao servidor…' : 'Gerando a ilha…';
  for (const b of document.querySelectorAll('#menu button')) b.disabled = true;
  await new Promise((r) => setTimeout(r, 30));
  try {
    if (online) {
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      G.net = new OnlineTransport(url, onMsg, () => { if (G.running) showCenter('Conexão perdida com o servidor', 99); });
      await G.net.ready;
      G.net.send({ t: 'join', name });
      // aguarda 'welcome' com a semente do mundo
    } else {
      const world = new World(DEFAULT_SEED);
      G.net = new LocalTransport(world, onMsg, { bots: 30, lobbyTime: 6 });
      initWorld(world);
      G.net.join(name);
    }
  } catch (e) {
    $('status').textContent = '❌ ' + e.message + (online ? ' — tente o modo offline.' : '');
    for (const b of document.querySelectorAll('#menu button')) b.disabled = false;
    if (!canOnline) $('btnOnline').disabled = true;
  }
}

function initWorld(world) {
  if (G.world) return;
  G.world = world;
  const gs = new GameScene($('game'), world, hw, startTier);
  G.gs = gs;
  G.tuner = new AutoTuner({
    tier: startTier,
    maxFn: () => gs.maxScale(),
    onScale: (s) => gs.setScale(s),
    onTier: (t, dir) => { setTier(t); toast(`Qualidade ${dir === 'up' ? '↑' : '↓'} automática: ${TIERS[t].name}`); },
  });
  G.tuner.auto = savedTier === 'auto';
  G.tuner.dynRes = store.get('dyn', true);
  setTier(startTier);
  const userScale = store.get('scale', null);
  if (!G.tuner.dynRes && userScale) { G.tuner.scale = userScale; gs.setScale(userScale); }
  G.charColor = new THREE.Color().setHSL(Math.random(), 0.55, 0.5).getHex();
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  buildMinimapBase();
  G.running = true;
  lockPointer();
  requestAnimationFrame(loop);
}

function setTier(t) {
  G.tuner.setTier(t);
  G.gs.applyTier(t, G.tuner.scale);
  for (const e of G.ents.values()) G.gs.fixMaterials(e.mesh);
  for (const m of G.lootMeshes.values()) G.gs.fixMaterials(m);
}

// ---------------------------------------------------------------- mensagens do servidor
function onMsg(m) {
  switch (m.t) {
    case 'welcome':
      G.myId = m.id;
      if (!G.world) initWorld(new World(m.seed));
      G.phase = m.phase; G.plane = m.plane;
      if (m.loot) setLoot(m.loot);
      break;
    case 'full': $('status').textContent = 'Servidor lotado. Tente mais tarde ou jogue offline.'; break;
    case 'phase':
      G.phase = m.phase;
      if (m.plane) { G.plane = m.plane; G.planeTLocal = 0; }
      if (m.total) G.total = m.total;
      if (m.phase === 'lobby') { G.ended = false; $('endscreen').classList.add('hidden'); clearLoot(); showCenter('Nova partida em breve — aquecimento', 4); }
      if (m.phase === 'plane') showCenter('No avião! Aperte F para saltar', 5);
      break;
    case 'snap': onSnap(m); break;
    case 'inv': G.inv = m; G.predMag = null; G.kills = m.kills; break;
    case 'loot':
      if (m.all) setLoot(m.all);
      if (m.add) for (const it of m.add) addLoot(it);
      if (m.remove) for (const id of m.remove) removeLoot(id);
      break;
    case 'shot': onShot(m); break;
    case 'jumped': if (m.id === G.myId && G.me.state === 'plane') { Object.assign(G.me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0, state: 'air' }); } break;
    case 'correct': Object.assign(G.me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0 }); break;
    case 'hurt': onHurt(m); break;
    case 'hitmark': { const h = $('hitmark'); h.className = m.kill ? 'kill' : ''; h.style.opacity = 1; clearTimeout(G.hmT); G.hmT = setTimeout(() => (h.style.opacity = 0), 140); sfxBeep(m.head ? 1400 : 1000, 0.04, 0.12); break; }
    case 'kill': onKill(m); break;
    case 'end': onEnd(m); break;
    case 'chat': killfeed(`${esc(m.from)}: ${esc(m.msg)}`); break;
  }
}

function onSnap(m) {
  G.phase = m.phase; G.phaseTimer = m.timer; G.alive = m.alive; G.lastSnap = performance.now();
  const z = m.zone; G.zone = { cx: z[0], cz: z[1], r: z[2], tcx: z[3], tcz: z[4], tr: z[5], timer: z[6], shrinking: !!z[7], stage: z[8] };
  if (G.plane) { G.planeT = m.planeT; if (Math.abs(G.planeTLocal - m.planeT) > 0.5) G.planeTLocal = m.planeT; }
  if (m.names) for (const [id, n, bot] of m.names) G.names.set(id, { name: n, bot });
  const seen = new Set();
  for (const a of m.p) {
    const [id, x, y, z2, yaw, pitch, hp, alive, sc, weapon, anim, crouch] = a;
    const state = STATE_NAME[sc];
    seen.add(id);
    if (id === G.myId) { reconcileMe(state, x, y, z2, alive, hp); continue; }
    let e = G.ents.get(id);
    if (!e) {
      const col = new THREE.Color().setHSL(((id * 0.618) % 1), 0.5, 0.45).getHex();
      e = { id, mesh: makeCharacter(col), x, y, z: z2, yaw, tx: x, ty: y, tz: z2, tyaw: yaw };
      G.gs.fixMaterials(e.mesh); G.gs.scene.add(e.mesh); G.ents.set(id, e);
    }
    if (Math.hypot(e.x - x, e.z - z2) > 25 || Math.abs(e.y - y) > 25) { e.x = x; e.y = y; e.z = z2; }
    Object.assign(e, { tx: x, ty: y, tz: z2, tyaw: yaw, pitch, hp, alive: !!alive, state, weapon, anim, crouch: !!crouch });
  }
  for (const [id, e] of G.ents) if (!seen.has(id)) { G.gs.scene.remove(e.mesh); G.ents.delete(id); }
}

function reconcileMe(state, x, y, z, alive, hp) {
  const me = G.me;
  me.hp = hp; me.alive = !!alive;
  if (!G.meMesh) { G.meMesh = makeCharacter(G.charColor); G.gs.fixMaterials(G.meMesh); G.gs.scene.add(G.meMesh); }
  if (state === 'lobby' && me.state !== 'lobby') { Object.assign(me, { x, y, z, vx: 0, vy: 0, vz: 0, state: 'lobby' }); }
  else if (state === 'plane') { me.state = 'plane'; me.x = x; me.y = y; me.z = z; }
  else if (state === 'air' && me.state === 'plane') { Object.assign(me, { x, y, z, vx: 0, vy: 0, vz: 0, state: 'air' }); }
  else if (state === 'dead' || state === 'spectator') { if (me.state !== 'dead' && me.state !== 'spectator') { me.state = state; } }
  else if (me.state === 'dead' && state !== 'dead') { Object.assign(me, { x, y, z, state }); }
  if (me.firstSnap !== true) { me.firstSnap = true; Object.assign(me, { x, y, z }); }
}

function onShot(m) {
  if (m.id === G.myId) return; // já desenhado localmente
  const e = G.ents.get(m.id);
  const o = m.o; const end = m.e;
  if (end) { G.gs.fx.tracer(o, end); G.gs.fx.puff(end, false); }
  if (e) G.gs.fx.flash(new THREE.Vector3(o[0], o[1], o[2]));
  const d = Math.hypot(o[0] - G.me.x, o[1] - G.me.y, o[2] - G.me.z);
  sfxShot(m.w, d);
}

function onHurt(m) {
  const v = $('vignette'); v.style.boxShadow = `inset 0 0 ${120 + Math.min(80, m.amt * 3)}px rgba(255,0,0,${Math.min(0.75, 0.25 + m.amt / 60)})`;
  clearTimeout(G.vigT); G.vigT = setTimeout(() => (v.style.boxShadow = 'inset 0 0 160px rgba(255,0,0,0)'), 260);
  if (!m.zone) {
    const ang = Math.atan2(m.fx - G.me.x, m.fz - G.me.z); // direção do atacante
    const rel = -(ang - Math.atan2(-Math.sin(G.me.yaw), -Math.cos(G.me.yaw)));
    const el = document.createElement('div'); el.className = 'darrow'; el.style.transform = `rotate(${rel}rad)`;
    $('dmgdir').appendChild(el); setTimeout(() => el.remove(), 1200);
  }
}

function onKill(m) {
  const me = m.victim === G.myId, mine = m.killer === G.myId;
  const how = m.how === 'zona' ? 'morreu na zona' : m.how === 'desconectou' ? 'desconectou' : `abatido com ${WEAPONS[m.how]?.name || m.how}`;
  killfeed(`${m.kn ? esc(m.kn) + ' ➜ ' : ''}${esc(m.vn)} <small>(${how})</small>`, me || mine);
  if (mine) { showCenter(`Você abateu ${esc(m.vn)}`, 2); }
  if (me) {
    G.me.state = 'dead'; G.spec = m.killer || null;
    setTimeout(() => {
      if (G.ended) return;
      $('endBig').textContent = `#${m.place}`;
      $('endMid').innerHTML = `${m.kn ? 'Abatido por <b>' + esc(m.kn) + '</b>' : 'Você morreu'} · ${G.kills} abate(s)<br><small>Partidas reiniciam automaticamente — você pode assistir até o fim.</small>`;
      $('endscreen').classList.remove('hidden'); document.exitPointerLock?.();
    }, 1200);
  }
}

function onEnd(m) {
  G.ended = true;
  const win = m.winner === G.myId;
  $('endBig').textContent = win ? 'VITÓRIA! #1' : `Fim de partida`;
  $('endMid').innerHTML = win ? `Último sobrevivente da ilha com ${m.kills} abate(s)! 🏆` : `Vencedor: <b>${esc(m.name)}</b> (${m.kills} abates)<br><small>Nova partida começa em alguns segundos.</small>`;
  $('endscreen').classList.remove('hidden'); document.exitPointerLock?.();
  if (win) { sfxBeep(660, 0.15, 0.3); setTimeout(() => sfxBeep(880, 0.3, 0.3), 160); }
}

// ---------------------------------------------------------------- loot
function setLoot(all) { clearLoot(); for (const it of all) addLoot(it); }
function clearLoot() { for (const m of G.lootMeshes.values()) G.gs?.scene.remove(m); G.lootMeshes.clear(); G.loot.clear(); }
function addLoot(it) {
  if (!G.gs || G.loot.has(it.id)) return;
  G.loot.set(it.id, it);
  const m = makeLoot(it.type); m.position.set(it.x, it.y, it.z); m.visible = false;
  G.gs.fixMaterials(m); G.gs.scene.add(m); G.lootMeshes.set(it.id, m);
}
function removeLoot(id) { const m = G.lootMeshes.get(id); if (m) G.gs.scene.remove(m); G.lootMeshes.delete(id); G.loot.delete(id); }
function lootName(it) { const w = WEAPONS[it.type]; return w ? w.name : it.type === 'ammo' ? `Munição (${it.n})` : ITEMS[it.type]?.name || it.type; }

// ---------------------------------------------------------------- input
const keys = new Set();
const canvas = $('game');
function lockPointer() { if (!G.running) return; try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {} }
canvas.addEventListener('click', () => { if (G.running && document.pointerLockElement !== canvas && $('settings').classList.contains('hidden')) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && G.running && $('endscreen').classList.contains('hidden')) openSettings(true);
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  const k = 0.0022 * G.sens * (G.ads ? (scopeMul() > 1 ? 0.25 : 0.6) : 1);
  G.me.yaw -= e.movementX * k; G.me.pitch -= e.movementY * k;
  G.me.pitch = Math.max(-1.45, Math.min(1.45, G.me.pitch));
});
addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) { G.firing = true; tryFire(true); }
  if (e.button === 2) G.ads = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) G.firing = false; if (e.button === 2) G.ads = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (!G.running || !$('settings').classList.contains('hidden')) return;
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.repeat) return;
  const me = G.me;
  switch (e.code) {
    case 'KeyF':
      if (me.state === 'plane' && G.phase !== 'lobby') { G.net.send({ t: 'jump' }); const p = planePos(); Object.assign(me, { x: p.x, y: G.plane.y - 4, z: p.z, vx: 0, vy: 0, vz: 0, state: 'air' }); }
      else if (me.state === 'air') me.state = 'chute';
      break;
    case 'KeyR': G.net.send({ t: 'reload' }); break;
    case 'Digit1': G.net.send({ t: 'switch', slot: 0 }); break;
    case 'Digit2': G.net.send({ t: 'switch', slot: 1 }); break;
    case 'Digit3': G.net.send({ t: 'heal', item: 'bandage' }); break;
    case 'Digit4': G.net.send({ t: 'heal', item: 'medkit' }); break;
    case 'KeyE': if (G.nearLoot) G.net.send({ t: 'pickup', id: G.nearLoot.id }); break;
    case 'KeyC': me.crouch = !me.crouch; break;
    case 'KeyM': G.mapOpen = !G.mapOpen; $('bigmap').classList.toggle('hidden', !G.mapOpen); break;
    case 'KeyV': G.spec = null; break;
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); G.firing = false; G.ads = false; });

// ---------------------------------------------------------------- configurações
function openSettings(inGame) {
  const sel = $('qTier'); sel.innerHTML = `<option value="auto">Automático (recomendado) — ${TIERS[hw.tier].name}</option>` + TIERS.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  sel.value = store.get('tier', 'auto');
  $('qDyn').checked = store.get('dyn', true); $('qPerf').checked = G.showPerf; $('qSens').value = G.sens; $('qVol').value = G.vol;
  const sc = G.tuner ? G.tuner.scale : 1; $('qScale').value = sc; $('qScaleV').textContent = sc.toFixed(2) + 'x';
  $('qNote').innerHTML = `Detectado: ${esc(hw.gpu)} · ${hw.cores} núcleos · ${hw.mem ? hw.mem + ' GB' : 'RAM n/d'}.<br>` +
    `<b>Batata/Baixo</b>: sem sombras, materiais simples, menos vegetação, resolução reduzida — feito para Celeron/Pentium com DDR3 e vídeo integrado antigo.<br>` +
    `<b>Ultra/Extremo</b>: sombras 4K, PBR com reflexo do céu, GTAO (oclusão de ambiente), bloom, SMAA; o Extremo adiciona reflexos em tempo real por ray-marching em tela (SSR) e supersampling até 7680×4320 (8K) se a GPU aceitar.<br>` +
    `<i>Ray tracing por hardware (RTX) ainda não é acessível a jogos de navegador via WebGL — o Extremo usa as técnicas equivalentes possíveis no navegador.</i>`;
  $('btnQuit').classList.toggle('hidden', !inGame);
  $('settings').classList.remove('hidden');
}
function closeSettings() { $('settings').classList.add('hidden'); if (G.running) lockPointer(); }
$('qTier').onchange = (e) => {
  const v = e.target.value; store.set('tier', v);
  if (!G.gs) return;
  if (v === 'auto') { G.tuner.auto = true; G.tuner.failedUp.clear(); setTier(hw.tier); } else { G.tuner.auto = false; setTier(+v); }
};
$('qDyn').onchange = (e) => { store.set('dyn', e.target.checked); if (G.tuner) G.tuner.dynRes = e.target.checked; };
$('qScale').oninput = (e) => { const v = +e.target.value; $('qScaleV').textContent = v.toFixed(2) + 'x'; store.set('scale', v); if (G.tuner) { G.tuner.dynRes = false; $('qDyn').checked = false; store.set('dyn', false); G.tuner.scale = v; G.gs.setScale(v); } };
$('qPerf').onchange = (e) => { G.showPerf = e.target.checked; store.set('perf', G.showPerf); };
$('qSens').oninput = (e) => { G.sens = +e.target.value; store.set('sens', G.sens); };
$('qVol').oninput = (e) => { G.vol = +e.target.value; store.set('vol', G.vol); };

// ---------------------------------------------------------------- jogador local
function planePos() {
  const P = G.plane; if (!P) return { x: 0, z: 0, k: 0 };
  const k = Math.min(1, G.planeTLocal / P.dur);
  return { x: P.ax + (P.bx - P.ax) * k, z: P.az + (P.bz - P.az) * k, k };
}

function updateMe(dt) {
  const me = G.me, W = G.world;
  const fwdX = -Math.sin(me.yaw), fwdZ = -Math.cos(me.yaw), rtX = Math.cos(me.yaw), rtZ = -Math.sin(me.yaw);
  let ix = 0, iz = 0;
  if (keys.has('KeyW')) { ix += fwdX; iz += fwdZ; } if (keys.has('KeyS')) { ix -= fwdX; iz -= fwdZ; }
  if (keys.has('KeyD')) { ix += rtX; iz += rtZ; } if (keys.has('KeyA')) { ix -= rtX; iz -= rtZ; }
  const il = Math.hypot(ix, iz); if (il > 0) { ix /= il; iz /= il; }
  me.speed = 0;
  if (me.state === 'plane') { const p = planePos(); me.x = p.x; me.z = p.z; me.y = G.plane.y; return; }
  if (me.state === 'dead' || me.state === 'spectator') return;
  if (me.state === 'air' || me.state === 'chute') {
    const g = W.heightAt(me.x, me.z);
    const agl = me.y - g;
    if (me.state === 'air' && agl < 90) me.state = 'chute';
    const hs = me.state === 'chute' ? 13 : 30, vs = me.state === 'chute' ? (keys.has('KeyW') ? -8 : -5.5) : (keys.has('KeyW') ? -48 : -36);
    me.vx += (ix * hs - me.vx) * Math.min(1, dt * 2); me.vz += (iz * hs - me.vz) * Math.min(1, dt * 2);
    me.x = Math.max(-HALF + 2, Math.min(HALF - 2, me.x + me.vx * dt)); me.z = Math.max(-HALF + 2, Math.min(HALF - 2, me.z + me.vz * dt)); me.y += vs * dt;
    const gr = W.groundAt(me.x, me.z, me.y + 0.5);
    if (me.y <= gr || me.y < WATER_LEVEL - 1.2) { me.y = Math.max(gr, WATER_LEVEL - 1.2); me.state = 'ground'; me.vy = 0; me.vx *= 0.2; me.vz *= 0.2; }
    me.speed = Math.hypot(me.vx, me.vz);
    return;
  }
  // chão (ou aquecimento no lobby)
  const acting = G.inv && G.inv.action && G.inv.action !== 'reload';
  let speed = me.crouch ? 2.3 : 4.8;
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (sprint && !G.ads && !me.crouch && keys.has('KeyW')) { speed = 7.2; me.crouch = false; }
  if (G.ads) speed = Math.min(speed, 2.9);
  if (acting) speed = Math.min(speed, 1.6);
  if (me.swimming) speed = 2.8;
  const acc = me.onGround ? 14 : 3;
  me.vx += (ix * speed - me.vx) * Math.min(1, dt * acc);
  me.vz += (iz * speed - me.vz) * Math.min(1, dt * acc);
  if (keys.has('Space') && me.onGround) { me.vy = me.crouch ? 0 : 7.2; me.crouch = false; me.onGround = false; }
  W.moveBody(me, dt);
  me.speed = Math.hypot(me.vx, me.vz);
  me.anim = me.speed > 6 ? 2 : me.speed > 0.5 ? 1 : 0;
}

// ---------------------------------------------------------------- tiro
function scopeMul() { const w = curWeapon(); return w && WEAPONS[w.type].scope && G.ads ? WEAPONS[w.type].scope : 1; }
function curWeapon() { return G.inv && G.inv.slots[G.inv.cur]; }
function tryFire(click) {
  const me = G.me, wpn = curWeapon();
  if (!wpn || !(me.state === 'ground' || me.state === 'lobby') || !me.alive) return;
  const W = WEAPONS[wpn.type];
  if (!click && !W.auto) return;
  const now = performance.now() / 1000;
  if (now - G.lastFire < 60 / W.rpm) return;
  if (G.inv.action === 'reload') return;
  const mag = G.predMag ?? wpn.mag;
  if (mag <= 0) { if (click) { sfxBeep(300, 0.03, 0.1); if (G.inv.ammo > 0) G.net.send({ t: 'reload' }); } return; }
  G.lastFire = now; G.predMag = mag - 1;
  if (keys.has('ShiftLeft')) keys.delete('ShiftLeft');
  const cam = G.gs.camera;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const moving = me.speed > 0.6 ? 1 : 0;
  const spread = W.spread * (G.ads ? 0.5 : 1.6) * (me.crouch ? 0.7 : 1) + moving * 0.012 + (me.onGround ? 0 : 0.05);
  const muzzle = new THREE.Vector3(me.x, me.y + (me.crouch ? 1.05 : 1.45), me.z).addScaledVector(new THREE.Vector3(-Math.sin(me.yaw), 0, -Math.cos(me.yaw)), 0.6).add(new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw)).multiplyScalar(0.2));
  const startT = cam.position.distanceTo(new THREE.Vector3(me.x, me.y + 1.5, me.z)) + 0.3;
  const hits = []; let endP = null;
  for (let i = 0; i < W.pellets; i++) {
    const d = dir.clone(); d.x += (Math.random() - 0.5) * spread * 2; d.y += (Math.random() - 0.5) * spread * 2; d.z += (Math.random() - 0.5) * spread * 2; d.normalize();
    const o = cam.position.clone().addScaledVector(d, startT);
    let wd = G.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, W.range);
    let best = null;
    for (const e of G.ents.values()) {
      if (!e.alive || e.state === 'plane') continue;
      if (Math.hypot(e.x - me.x, e.z - me.z) > W.range + 5) continue;
      const h = rayPlayer(o.x, o.y, o.z, d.x, d.y, d.z, { x: e.x, y: e.y, z: e.z, crouch: e.crouch });
      if (h && h.t < wd && (!best || h.t < best.t)) best = { ...h, id: e.id };
    }
    const t = best ? best.t : wd;
    const ep = o.clone().addScaledVector(d, t);
    if (best) { hits.push({ id: best.id, part: best.part }); G.gs.fx.puff([ep.x, ep.y, ep.z], true); } else if (wd < W.range) G.gs.fx.puff([ep.x, ep.y, ep.z], false);
    if (!endP) endP = [ep.x, ep.y, ep.z];
    if (i < 3) G.gs.fx.tracer([muzzle.x, muzzle.y, muzzle.z], [ep.x, ep.y, ep.z]);
  }
  G.gs.fx.flash(muzzle);
  G.net.send({ t: 'shoot', o: [+muzzle.x.toFixed(2), +muzzle.y.toFixed(2), +muzzle.z.toFixed(2)], d: [+dir.x.toFixed(3), +dir.y.toFixed(3), +dir.z.toFixed(3)], e: endP.map((v) => +v.toFixed(2)), hits });
  sfxShot(wpn.type, 0);
  const kick = wpn.type === 'sniper' ? 0.05 : wpn.type === 'shotgun' ? 0.06 : wpn.type === 'pistol' ? 0.018 : 0.012;
  me.pitch += kick * (G.ads ? 0.6 : 1) * (me.crouch ? 0.7 : 1); me.yaw += (Math.random() - 0.5) * kick * 0.5;
  G.recoil = Math.min(1, G.recoil + 0.35);
}

// ---------------------------------------------------------------- câmera
const tmpV = new THREE.Vector3();
function updateCamera(dt) {
  const cam = G.gs.camera, me = G.me, W = G.world;
  let focus = me;
  if (me.state === 'dead' || me.state === 'spectator') {
    let e = G.spec ? G.ents.get(G.spec) : null;
    if (!e || !e.alive) { e = [...G.ents.values()].find((q) => q.alive && q.state !== 'plane'); G.spec = e ? e.id : null; }
    if (e) focus = e;
  }
  const scope = scopeMul();
  const targetFov = scope > 1 ? 70 / scope : G.ads ? 52 : 74;
  cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 14); cam.updateProjectionMatrix();
  $('scope').classList.toggle('hidden', !(scope > 1 && cam.fov < 30));
  $('cross').classList.toggle('ads', G.ads);
  if (me.state === 'plane' && G.plane) {
    const p = planePos();
    const dist = 38;
    cam.position.set(p.x + Math.sin(me.yaw) * Math.cos(me.pitch) * dist, G.plane.y + 8 - Math.sin(me.pitch) * dist, p.z + Math.cos(me.yaw) * Math.cos(me.pitch) * dist);
    cam.lookAt(p.x, G.plane.y, p.z);
    return { x: p.x, y: G.plane.y, z: p.z };
  }
  const yaw = focus === me ? me.yaw : focus.yaw, pitch = focus === me ? me.pitch : 0;
  const eyeY = focus.y + (focus.crouch ? 1.15 : 1.6);
  cam.rotation.set(pitch, yaw, 0);
  if (scope > 1 && focus === me && me.state === 'ground') { cam.position.set(me.x, eyeY, me.z); return me; }
  const air = me.state === 'air' || me.state === 'chute';
  const back = air ? 7 : G.ads ? 1.6 : 3.1, right = air ? 0 : G.ads ? 0.55 : 0.6, up = air ? 1.5 : 0.25;
  const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const ox = focus.x, oy = eyeY, oz = focus.z;
  let cx = ox - fx * back + rx * right, cy = oy - fy * back + up, cz = oz - fz * back + rz * right;
  // colisão da câmera com paredes/teto/terreno
  const dx = cx - ox, dy = cy - oy, dz = cz - oz, L = Math.hypot(dx, dy, dz);
  const hit = W.raycast(ox, oy, oz, dx / L, dy / L, dz / L, L + 0.2);
  if (hit < L + 0.2) { const k = Math.max(0.15, hit - 0.25) / L; cx = ox + dx * k; cy = oy + dy * k; cz = oz + dz * k; }
  cy = Math.max(cy, W.heightAt(cx, cz) + 0.3);
  cam.position.set(cx, cy, cz);
  return focus;
}

// ---------------------------------------------------------------- loop principal
let lastT = performance.now();
let perfAcc = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (!G.running) return;
  G.net.tick(dt);
  G.planeTLocal += dt;
  updateMe(dt);
  if (G.firing) tryFire(false);
  // envia estado ~20x/s
  G.sendAcc += dt;
  if (G.sendAcc > 0.05 && G.myId) {
    G.sendAcc = 0;
    const me = G.me;
    if (me.state !== 'plane' && me.state !== 'dead' && me.state !== 'spectator') G.net.send({ t: 'state', x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), s: me.state === 'lobby' ? 'ground' : me.state, a: me.anim | 0, c: me.crouch ? 1 : 0 });
  }
  // entidades remotas (suavização)
  const k = 1 - Math.exp(-dt * 12);
  for (const e of G.ents.values()) {
    const ox = e.x, oz = e.z;
    e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k; e.z += (e.tz - e.z) * k;
    let dy = e.tyaw - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * k;
    const sp = Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-4);
    e.mesh.position.set(e.x, e.y, e.z); e.mesh.rotation.y = e.yaw;
    e.mesh.visible = e.state !== 'plane' && e.state !== 'spectator';
    poseCharacter(e.mesh, { speed: e.state === 'ground' || e.state === 'lobby' ? sp : 0, state: e.state, dead: !e.alive, crouch: e.crouch, weapon: e.weapon, pitch: e.pitch }, dt);
  }
  // eu
  const me = G.me;
  if (G.meMesh) {
    G.meMesh.position.set(me.x, me.y, me.z); G.meMesh.rotation.y = me.yaw;
    G.meMesh.visible = me.state !== 'plane' && me.state !== 'spectator' && !(scopeMul() > 1 && G.gs.camera.fov < 30);
    poseCharacter(G.meMesh, { speed: me.state === 'ground' || me.state === 'lobby' ? me.speed : 0, state: me.state, dead: me.state === 'dead', crouch: me.crouch, weapon: curWeapon()?.type, pitch: me.pitch }, dt);
  }
  // avião
  const gs = G.gs;
  if (G.plane && G.phase !== 'lobby' && G.planeTLocal < G.plane.dur + 5) {
    const p = planePos(); gs.plane.visible = true; gs.plane.position.set(p.x, G.plane.y, p.z);
    gs.plane.rotation.y = Math.atan2(-(G.plane.bx - G.plane.ax), -(G.plane.bz - G.plane.az));
  } else gs.plane.visible = false;
  // zona
  if (G.zone && G.phase !== 'lobby') { gs.zoneMesh.visible = true; gs.zoneMesh.position.set(G.zone.cx, 200, G.zone.cz); gs.zoneMesh.scale.set(G.zone.r, 1, G.zone.r); } else gs.zoneMesh.visible = false;
  // loot próximo
  updateLootVis(dt);
  gs.fx.update(dt);
  gs.setAltitudeView(me.state === 'plane' || me.state === 'air' || (me.state === 'chute' && me.y - G.world.heightAt(me.x, me.z) > 40));
  const focus = updateCamera(dt);
  gs.render(focus);
  G.tuner.frame(dt);
  perfAcc += dt; if (perfAcc > 0.25) { perfAcc = 0; updateHUD(); }
  drawMinimap();
}

let lootAcc = 0, lootSpin = 0;
function updateLootVis(dt) {
  lootSpin += dt;
  lootAcc += dt;
  const me = G.me;
  if (lootAcc > 0.2) {
    lootAcc = 0;
    let best = null, bd = 2.6;
    const lim = TIERS[G.gs.tierId].view > 500 ? 90 : 55;
    for (const [id, it] of G.loot) {
      const m = G.lootMeshes.get(id); if (!m) continue;
      const d = Math.hypot(it.x - me.x, it.z - me.z);
      m.visible = d < lim;
      if (d < bd && Math.abs(it.y - me.y) < 2.2 && (me.state === 'ground' || me.state === 'lobby')) { best = it; bd = d; }
    }
    G.nearLoot = best;
    const pr = $('prompt');
    if (best) { pr.innerHTML = `<kbd>E</kbd> pegar ${lootName(best)}`; pr.classList.remove('hidden'); } else pr.classList.add('hidden');
  }
  for (const m of G.lootMeshes.values()) if (m.visible) { m.userData.spin.rotation.y = lootSpin * 1.5; }
}

// ---------------------------------------------------------------- HUD
function updateHUD() {
  const me = G.me, inv = G.inv;
  $('alive').textContent = G.phase === 'lobby' ? '—' : G.alive; $('kills').textContent = G.kills || 0;
  const hp = Math.max(0, me.hp ?? 100);
  $('hpfill').style.width = hp + '%'; $('hpfill').classList.toggle('low', hp < 30);
  if (inv) {
    $('gear').textContent = `${inv.armor ? 'Colete Nv' + inv.armor : 'Sem colete'} · ${inv.helmet ? 'Capacete Nv' + inv.helmet : 'Sem capacete'}`;
    for (let s = 0; s < 2; s++) {
      const w = inv.slots[s]; const el = $('slot' + s);
      el.textContent = `${s + 1} · ${w ? WEAPONS[w.type].name : '—'}`; el.classList.toggle('on', inv.cur === s && !!w);
    }
    const w = inv.slots[inv.cur];
    $('ammo').innerHTML = w ? `${G.predMag ?? w.mag}<small> / ${inv.ammo}</small>` : '';
    $('items').innerHTML = `<kbd>3</kbd> Bandagem × ${inv.bandage}<br><kbd>4</kbd> Kit médico × ${inv.medkit}`;
    const act = inv.action;
    if (act) {
      const total = act === 'reload' ? WEAPONS[w?.type]?.reload || 2 : act === 'bandage' ? 3 : 6;
      G.actionEnd = G.actionEnd && G.actionKey === act + inv.actionT ? G.actionEnd : performance.now() + inv.actionT * 1000; G.actionKey = act + inv.actionT;
      const left = Math.max(0, (G.actionEnd - performance.now()) / 1000);
      $('action').classList.remove('hidden'); $('actionTxt').textContent = (act === 'reload' ? 'Recarregando' : act === 'bandage' ? 'Usando bandagem' : 'Usando kit médico') + ` ${left.toFixed(1)}s`;
      $('actionBar').style.width = (100 * (1 - left / total)) + '%';
    } else $('action').classList.add('hidden');
  }
  $('clickhint').classList.toggle('hidden', document.pointerLockElement === canvas || !$('settings').classList.contains('hidden') || !$('endscreen').classList.contains('hidden'));
  // zona / fase
  let zi = '';
  if (G.phase === 'lobby') zi = `Aquecimento — partida começa em ${Math.max(0, G.phaseTimer).toFixed(0)}s (tiros não causam dano)`;
  else if (G.zone) {
    const out = Math.hypot(me.x - G.zone.cx, me.z - G.zone.cz) > G.zone.r;
    zi = G.zone.shrinking ? `⚠ Zona fechando! ${G.zone.timer.toFixed(0)}s` : `Zona fecha em ${G.zone.timer > 900 ? '—' : G.zone.timer.toFixed(0) + 's'}`;
    if (out && me.state === 'ground') zi += ' · <b style="color:#6aa8ff">Você está FORA da zona!</b>';
    if (me.state === 'plane') zi = '✈ Aperte <kbd>F</kbd> para saltar · <kbd>M</kbd> mapa';
    if (me.state === 'air') zi = 'Queda livre — <kbd>W</kbd> mergulha · <kbd>F</kbd> abre o paraquedas';
  }
  $('zoneinfo').innerHTML = zi;
  // compasso
  const deg = ((-me.yaw * 180 / Math.PI) % 360 + 360) % 360;
  if (!G.compassBuilt) {
    let s = ''; for (let rep = 0; rep < 3; rep++) for (let d = 0; d < 360; d += 15) s += `<span style="display:inline-block;width:30px;text-align:center">${({ 0: 'N', 90: 'L', 180: 'S', 270: 'O' })[d] || (d % 45 === 0 ? d : '·')}</span>`;
    $('compassStrip').innerHTML = s; G.compassBuilt = true;
  }
  $('compassStrip').style.left = (210 - 15 - (360 + deg) * 2) + 'px';
  // desempenho
  const perf = $('perf'); perf.classList.toggle('hidden', !G.showPerf);
  if (G.showPerf) {
    const ds = G.gs.drawingSize(); const info = G.gs.renderer.info.render;
    const res = ds.x >= 7600 ? ' (8K)' : ds.x >= 3800 ? ' (4K)' : ds.x >= 2500 ? ' (1440p)' : '';
    perf.textContent = `FPS ${G.tuner.fps.toFixed(0)}  ·  ${TIERS[G.gs.tierId].name}${G.tuner.auto ? ' [auto]' : ''}\nRender ${ds.x}×${ds.y}${res}  escala ${G.gs.scale.toFixed(2)}x${G.tuner.dynRes ? ' dinâmica' : ''}\nDraw calls ${info.calls} · triângulos ${(info.triangles / 1000).toFixed(0)}k\n${G.gs.post.length ? 'Pós: ' + G.gs.post.join(', ') : 'Pós-processamento: nenhum'}${G.net.online ? '\nOnline' : '\nOffline (bots)'}`;
  }
}
let centerT = null;
function showCenter(html, secs) { const c = $('center-msg'); c.innerHTML = html; clearTimeout(centerT); centerT = setTimeout(() => (c.innerHTML = ''), secs * 1000); }
function toast(t) { killfeed(`<span style="color:#9fd">${esc(t)}</span>`); }
function killfeed(html, hi) {
  const kf = $('killfeed'); const d = document.createElement('div'); d.innerHTML = html; if (hi) d.className = 'me';
  kf.prepend(d); while (kf.children.length > 6) kf.lastChild.remove(); setTimeout(() => d.remove(), 7000);
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

// ---------------------------------------------------------------- mapa / minimapa
let mapBase = null;
function buildMinimapBase() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'), img = c.createImageData(S, S), W = G.world;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = (i / S) * MAP_SIZE - HALF, z = (j / S) * MAP_SIZE - HALF, h = W.heightAt(x, z), o = (j * S + i) * 4;
    let r, g, b;
    if (h < 0) { const d = Math.min(1, -h / 9); r = 40 - d * 20; g = 110 - d * 40; b = 150 - d * 30; }
    else if (h < 2.2) { r = 216; g = 197; b = 144; }
    else { const t = Math.min(1, h / 70); r = 95 + t * 60; g = 140 - t * 20; b = 60 + t * 50; }
    const shade = (W.heightAt(x - 3, z - 3) - h) * 6;
    img.data[o] = r + shade; img.data[o + 1] = g + shade; img.data[o + 2] = b + shade; img.data[o + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.fillStyle = '#5b4a3a';
  for (const H of W.houses) c.fillRect(((H.x - H.w / 2 + HALF) / MAP_SIZE) * S, ((H.z - H.d / 2 + HALF) / MAP_SIZE) * S, (H.w / MAP_SIZE) * S, (H.d / MAP_SIZE) * S);
  c.font = 'bold 11px system-ui'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.shadowColor = '#000'; c.shadowBlur = 3;
  for (const t of W.towns) c.fillText(t.name, ((t.x + HALF) / MAP_SIZE) * S, ((t.z + HALF) / MAP_SIZE) * S - (t.r / MAP_SIZE) * S - 3);
  mapBase = cv;
}
let mmAcc = 0;
function drawMinimap() {
  if (!mapBase) return;
  if ((mmAcc = (mmAcc + 1) % 3) !== 0 && !G.mapOpen) return; // minimapa a cada 3 frames
  const mm = $('minimap'), c = mm.getContext('2d'), me = G.me, S = mapBase.width;
  const view = 260; // metros visíveis
  const sc = mm.width / view, px = ((me.x + HALF) / MAP_SIZE) * S, pz = ((me.z + HALF) / MAP_SIZE) * S, src = (view / MAP_SIZE) * S;
  c.clearRect(0, 0, mm.width, mm.height);
  c.drawImage(mapBase, px - src / 2, pz - src / 2, src, src, 0, 0, mm.width, mm.height);
  const toMM = (x, z) => [(x - me.x) * sc + mm.width / 2, (z - me.z) * sc + mm.height / 2];
  drawZone(c, toMM, sc);
  drawPlaneLine(c, toMM);
  drawMe(c, mm.width / 2, mm.height / 2);
  if (G.mapOpen) {
    const bm = $('bigmap'), b = bm.getContext('2d'), k = bm.width / MAP_SIZE;
    b.drawImage(mapBase, 0, 0, bm.width, bm.height);
    const toB = (x, z) => [(x + HALF) * k, (z + HALF) * k];
    drawZone(b, toB, k); drawPlaneLine(b, toB);
    const [mx, mz] = toB(me.x, me.z); drawMe(b, mx, mz, 1.6);
  }
}
function drawZone(c, f, sc) {
  const z = G.zone; if (!z || G.phase === 'lobby') return;
  c.lineWidth = 2;
  c.strokeStyle = '#4d8dff'; c.beginPath(); let [x, y] = f(z.cx, z.cz); c.arc(x, y, z.r * sc, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#fff'; c.beginPath(); [x, y] = f(z.tcx, z.tcz); c.arc(x, y, z.tr * sc, 0, Math.PI * 2); c.stroke();
}
function drawPlaneLine(c, f) {
  if (!G.plane || G.phase === 'lobby' || G.me.state !== 'plane') return;
  const P = G.plane; c.strokeStyle = 'rgba(255,255,255,.8)'; c.setLineDash([6, 5]); c.lineWidth = 2;
  c.beginPath(); c.moveTo(...f(P.ax, P.az)); c.lineTo(...f(P.bx, P.bz)); c.stroke(); c.setLineDash([]);
}
function drawMe(c, x, y, s = 1) {
  const yaw = G.me.yaw;
  c.save(); c.translate(x, y); c.rotate(-yaw); c.scale(s, s);
  c.fillStyle = '#ffb02e'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
}

// exposto para depuração/testes automáticos
window.__IZ = G;
G.fire = tryFire;
