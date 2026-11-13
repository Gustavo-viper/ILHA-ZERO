// Simulação autoritativa da partida. Roda no servidor Node (multiplayer) OU dentro do
// navegador (modo offline contra bots) — mesma lógica nos dois casos.
import { World, HALF, mulberry32, rayPlayer, PLAYER_HEIGHT } from './world.js';

export const WEAPONS = {
  pistol:  { name: 'Pistola P-9',  dmg: 24, rpm: 380, mag: 15, reload: 1.5, spread: 0.010, range: 120, auto: false, pellets: 1, slot: 1 },
  smg:     { name: 'SMG Vespa',    dmg: 21, rpm: 760, mag: 30, reload: 2.0, spread: 0.020, range: 150, auto: true,  pellets: 1, slot: 0 },
  ar:      { name: 'Fuzil AR-7',   dmg: 31, rpm: 640, mag: 30, reload: 2.3, spread: 0.008, range: 400, auto: true,  pellets: 1, slot: 0 },
  shotgun: { name: 'Escopeta T12', dmg: 15, rpm: 75,  mag: 5,  reload: 2.8, spread: 0.065, range: 45,  auto: false, pellets: 9, slot: 0 },
  sniper:  { name: 'Sniper Falcão', dmg: 88, rpm: 42, mag: 5,  reload: 3.0, spread: 0.0008, range: 900, auto: false, pellets: 1, slot: 0, scope: 4 },
};
export const ITEMS = {
  ammo: { name: 'Munição', amount: 30 },
  bandage: { name: 'Bandagem' },
  medkit: { name: 'Kit Médico' },
  armor1: { name: 'Colete Nv1', armor: 1 }, armor2: { name: 'Colete Nv2', armor: 2 }, armor3: { name: 'Colete Nv3', armor: 3 },
  helmet1: { name: 'Capacete Nv1', helmet: 1 }, helmet2: { name: 'Capacete Nv2', helmet: 2 },
};
const ARMOR_RED = [0, 0.3, 0.4, 0.55];
const HELMET_RED = [0, 0.3, 0.45];
const LOOT_TABLE = [
  ['pistol', 12], ['smg', 10], ['ar', 9], ['shotgun', 8], ['sniper', 3], ['ammo', 26], ['bandage', 14], ['medkit', 5],
  ['armor1', 5], ['armor2', 3], ['armor3', 1], ['helmet1', 5], ['helmet2', 2],
];
const LOOT_TOTAL = LOOT_TABLE.reduce((s, [, w]) => s + w, 0);

// Fases da zona: espera (s), encolhimento (s), fração do raio, dano/s fora da zona
const ZONE_PHASES = [
  { wait: 70, shrink: 45, f: 0.55, dps: 1 },
  { wait: 50, shrink: 40, f: 0.5, dps: 2 },
  { wait: 40, shrink: 30, f: 0.5, dps: 4 },
  { wait: 30, shrink: 25, f: 0.45, dps: 7 },
  { wait: 25, shrink: 20, f: 0.4, dps: 10 },
  { wait: 20, shrink: 20, f: 0.01, dps: 15 },
];

const BOT_NAMES = ['Lobo', 'Faísca', 'Tornado', 'Sombra', 'Raposa', 'Trovão', 'Gavião', 'Pantera', 'Cobra', 'Fantasma', 'Titã', 'Vulcão', 'Coruja', 'Neblina', 'Orca', 'Jaguar', 'Falcão', 'Ciclone', 'Granito', 'Pirata', 'Cometa', 'Escorpião', 'Lince', 'Tubarão', 'Bisão', 'Corvo', 'Zumbi', 'Ninja', 'Vândalo', 'Atlas', 'Bala', 'Sniper', 'Turbo', 'Rocha', 'Zebra', 'Krakatoa', 'Mamba', 'Fênix', 'Dragão', 'Urso'];

export class Match {
  /**
   * @param {object} o  { seed, totalPlayers, lobbyTime, send(id,msg), broadcast(msg) }
   */
  constructor(o) {
    this.o = Object.assign({ seed: 1337, totalPlayers: 30, lobbyTime: 20, minHumans: 1 }, o);
    this.world = o.world || new World(this.o.seed);
    this.players = new Map();
    this.nextId = 1;
    this.lootId = 1;
    this.time = 0;
    this.snapAcc = 0;
    this.matchNo = 0;
    this.resetLobby();
  }

  // ---------------- ciclo da partida ----------------
  resetLobby() {
    this.phase = 'lobby';
    this.phaseTimer = this.o.lobbyTime;
    this.loot = new Map();
    this.zone = { cx: 0, cz: 0, r: HALF * 1.45, tcx: 0, tcz: 0, tr: HALF * 1.45, stage: -1, timer: 0, shrinking: false, dps: 0.5, sr: 0, scx: 0, scz: 0, total: 0 };
    this.plane = null;
    this.winner = null;
    for (const [id, p] of this.players) {
      if (p.isBot) { this.players.delete(id); continue; }
      this._resetPlayer(p);
      p.state = 'lobby';
      const s = this.world.randomLandPoint(Math.random, 0.15);
      p.x = s.x; p.z = s.z; p.y = this.world.heightAt(s.x, s.z) + 1;
    }
    this.broadcast({ t: 'phase', phase: this.phase, timer: this.phaseTimer });
  }

  _resetPlayer(p) {
    Object.assign(p, { hp: 100, alive: true, armor: 0, helmet: 0, slots: [null, null], cur: 0, ammo: 0, bandage: 0, medkit: 0, kills: 0, dmg: 0, action: null, actionT: 0, lastShot: 0, vx: 0, vy: 0, vz: 0, place: 0, crouch: false });
    p.slots[1] = { type: 'pistol', mag: WEAPONS.pistol.mag }; p.cur = 1; p.ammo = 30; // começa com pistola
  }

  startMatch() {
    this.matchNo++;
    const rng = mulberry32((Date.now() & 0xffffff) ^ this.o.seed ^ (this.matchNo * 7919));
    this.rng = rng;
    // loot
    this.loot.clear();
    for (const s of this.world.lootSpawns) {
      if (rng() < 0.18) continue;
      this._spawnLoot(this._rollLoot(rng), s.x, s.y, s.z);
      if (rng() < 0.35) this._spawnLoot('ammo', s.x + 0.6, s.y, s.z + 0.3);
    }
    // bots
    const humans = [...this.players.values()].filter((p) => !p.isBot && p.state !== 'spectator');
    const nBots = Math.max(0, this.o.totalPlayers - humans.length);
    for (let i = 0; i < nBots; i++) {
      const id = this.nextId++;
      const p = { id, name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? i : ''), isBot: true, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, skill: 0.35 + rng() * 0.55 };
      this._resetPlayer(p);
      p.bot = { jumpAt: 0.1 + rng() * 0.8, think: rng(), target: null, goal: null, stuck: 0, reaction: 0, strafe: rng() < 0.5 ? 1 : -1, strafeT: 0 };
      this.players.set(id, p);
    }
    for (const p of this.players.values()) { if (p.state !== 'spectator') { this._resetPlayer(p); p.state = 'plane'; } }
    // rota do avião
    const a = rng() * Math.PI * 2;
    const off = (rng() * 2 - 1) * HALF * 0.4;
    const nx = Math.cos(a), nz = Math.sin(a), px = -nz, pz = nx;
    const L = HALF * 1.15;
    this.plane = { ax: -nx * L + px * off, az: -nz * L + pz * off, bx: nx * L + px * off, bz: nz * L + pz * off, y: 260, t: 0, dur: (2 * L) / 60 };
    // zona
    this.zone.stage = -1; this._nextZone();
    this.phase = 'plane';
    this.aliveAtStart = [...this.players.values()].filter((p) => p.alive && p.state !== 'spectator').length;
    this.broadcast({ t: 'phase', phase: this.phase, plane: this.plane, total: this.aliveAtStart });
    this.broadcast({ t: 'loot', all: [...this.loot.values()] });
    for (const p of this.players.values()) if (!p.isBot) this._sendInv(p);
  }

  _nextZone() {
    const z = this.zone; z.stage++;
    const ph = ZONE_PHASES[Math.min(z.stage, ZONE_PHASES.length - 1)];
    z.scx = z.cx; z.scz = z.cz; z.sr = z.r;
    if (z.stage === 0) { z.r = HALF * 1.45; z.sr = z.r; }
    const nr = z.stage === 0 ? HALF * 0.72 : z.r * ph.f;
    // novo centro dentro do círculo atual e em terra
    for (let i = 0; i < 40; i++) {
      const ang = this.rng() * Math.PI * 2, d = this.rng() * Math.max(0, z.r - nr) * (z.stage === 0 ? 0.25 : 0.9);
      const cx = z.cx + Math.cos(ang) * d, cz = z.cz + Math.sin(ang) * d;
      if (this.world.heightAt(cx, cz) > 1 || i === 39) { z.tcx = cx; z.tcz = cz; break; }
    }
    z.tr = nr; z.timer = ph.wait; z.shrinkDur = ph.shrink; z.shrinking = false; z.dps = ph.dps;
    z.final = z.stage >= ZONE_PHASES.length - 1;
  }

  _rollLoot(rng) {
    let r = rng() * LOOT_TOTAL;
    for (const [k, w] of LOOT_TABLE) { if ((r -= w) <= 0) return k; }
    return 'ammo';
  }
  _spawnLoot(type, x, y, z, extra = {}) {
    const id = this.lootId++;
    const it = { id, type, x: +x.toFixed(2), y: +(y + 0.05).toFixed(2), z: +z.toFixed(2), ...extra };
    if (WEAPONS[type] && it.mag == null) it.mag = WEAPONS[type].mag;
    if (type === 'ammo' && it.n == null) it.n = ITEMS.ammo.amount;
    this.loot.set(id, it);
    return it;
  }

  // ---------------- conexão ----------------
  addPlayer(name) {
    const id = this.nextId++;
    const p = { id, name: String(name || 'Jogador').slice(0, 16), isBot: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    this._resetPlayer(p);
    if (this.phase === 'lobby') {
      p.state = 'lobby';
      const s = this.world.randomLandPoint(Math.random, 0.15); p.x = s.x; p.z = s.z; p.y = this.world.heightAt(s.x, s.z) + 1;
    } else { p.state = 'spectator'; p.alive = false; }
    this.players.set(id, p);
    this.send(id, { t: 'welcome', id, seed: this.world.seed, phase: this.phase, timer: this.phaseTimer, plane: this.plane, loot: [...this.loot.values()] });
    this._sendInv(p);
    return id;
  }
  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (p.alive && (this.phase === 'playing' || this.phase === 'plane')) this._kill(p, null, 'desconectou');
    this.players.delete(id);
  }

  send(id, m) { this.o.send && this.o.send(id, m); }
  broadcast(m) { this.o.broadcast && this.o.broadcast(m); }
  _sendInv(p) {
    if (p.isBot) return;
    this.send(p.id, { t: 'inv', hp: p.hp, armor: p.armor, helmet: p.helmet, slots: p.slots, cur: p.cur, ammo: p.ammo, bandage: p.bandage, medkit: p.medkit, action: p.action, actionT: p.actionT, kills: p.kills });
  }

  // ---------------- mensagens do cliente ----------------
  onMessage(id, m) {
    const p = this.players.get(id);
    if (!p || !m || typeof m !== 'object') return;
    switch (m.t) {
      case 'state': {
        if (!p.alive || p.state === 'plane' || p.state === 'spectator') return;
        const nx = +m.x, ny = +m.y, nz = +m.z;
        if (![nx, ny, nz].every(Number.isFinite)) return;
        // validação anti-teleporte baseada no tempo desde a última atualização
        const d = Math.hypot(nx - p.x, nz - p.z);
        const el = Math.min(2, this.time - (p.lastState ?? this.time - 0.1));
        const maxSpeed = p.state === 'ground' || p.state === 'lobby' ? 11 : 45;
        if (d > maxSpeed * el + 4) { this.send(p.id, { t: 'correct', x: p.x, y: p.y, z: p.z }); p.lastState = this.time; return; }
        p.lastState = this.time;
        p.x = Math.max(-HALF, Math.min(HALF, nx)); p.y = ny; p.z = Math.max(-HALF, Math.min(HALF, nz));
        p.yaw = +m.yaw || 0; p.pitch = +m.pitch || 0; p.anim = m.a | 0; p.crouch = !!m.c;
        if (p.state !== 'lobby' && ['air', 'chute', 'ground'].includes(m.s)) p.state = m.s;
        if (p.action && (m.a === 2)) { /* correndo cancela cura */ if (p.action === 'bandage' || p.action === 'medkit') { p.action = null; this._sendInv(p); } }
        break;
      }
      case 'jump': if (p.state === 'plane' && this.phase !== 'lobby') this._jumpFromPlane(p); break;
      case 'shoot': this._shoot(p, m); break;
      case 'reload': this._startReload(p); break;
      case 'heal': this._startHeal(p, m.item); break;
      case 'switch': if (p.alive && (m.slot === 0 || m.slot === 1) && p.slots[m.slot]) { p.cur = m.slot; if (p.action === 'reload') p.action = null; this._sendInv(p); } break;
      case 'pickup': this._pickup(p, m.id); break;
      case 'chat': this.broadcast({ t: 'chat', from: p.name, msg: String(m.msg || '').slice(0, 120) }); break;
    }
  }

  _jumpFromPlane(p) {
    const pl = this._planePos();
    p.state = 'air'; p.x = pl.x; p.z = pl.z; p.y = this.plane.y - 4; p.vy = 0;
    this.broadcast({ t: 'jumped', id: p.id, x: p.x, y: p.y, z: p.z });
  }
  _planePos() {
    const P = this.plane; const k = Math.min(1, P.t / P.dur);
    return { x: P.ax + (P.bx - P.ax) * k, z: P.az + (P.bz - P.az) * k, k };
  }

  _weapon(p) { const s = p.slots[p.cur]; return s ? { s, w: WEAPONS[s.type] } : null; }

  _shoot(p, m) {
    if (!p.alive || (p.state !== 'ground' && p.state !== 'lobby')) return;
    const ww = this._weapon(p); if (!ww) return;
    const { s, w } = ww;
    const now = this.time;
    if (now - p.lastShot < (60 / w.rpm) * 0.75) return; // tolerância de rede
    if (p.action === 'reload') return;
    if (s.mag <= 0) return;
    if (p.action) p.action = null;
    s.mag--; p.lastShot = now;
    const o = m.o, dir = m.d;
    if (!Array.isArray(o) || !Array.isArray(dir)) return;
    this.broadcast({ t: 'shot', id: p.id, w: s.type, o, e: m.e });
    // acertos (lista de alvos por chumbinho)
    if (Array.isArray(m.hits)) {
      const per = new Map();
      for (const h of m.hits.slice(0, w.pellets)) {
        const tgt = this.players.get(h.id);
        if (!tgt || !tgt.alive || tgt === p || tgt.state === 'plane') continue;
        const dist = Math.hypot(tgt.x - p.x, tgt.y - p.y, tgt.z - p.z);
        if (dist > w.range + 10) continue;
        // checagem de linha de visão no servidor
        if (!this.world.lineOfSight(p.x, p.y + 1.55, p.z, tgt.x, tgt.y + (h.part === 'head' ? 1.6 : 1.1), tgt.z)) continue;
        const prev = per.get(tgt) || 0;
        let dmg = w.dmg * (dist > w.range * 0.5 ? 0.8 : 1);
        if (h.part === 'head') dmg *= 2.1 * (1 - HELMET_RED[tgt.helmet]); else dmg *= 1 - ARMOR_RED[tgt.armor];
        per.set(tgt, prev + dmg);
      }
      for (const [tgt, dmg] of per) this._damage(tgt, dmg, p, s.type, false);
    }
    if (s.mag === 0 && p.ammo > 0 && p.isBot) this._startReload(p);
    this._sendInv(p);
  }

  _damage(tgt, dmg, from, weapon, zone) {
    if (!tgt.alive || this.phase === 'lobby') return;
    tgt.hp -= dmg;
    if (from) from.dmg += dmg;
    if (!tgt.isBot) this.send(tgt.id, { t: 'hurt', from: from ? from.id : 0, amt: Math.round(dmg), fx: from ? from.x : tgt.x, fz: from ? from.z : tgt.z, zone: !!zone });
    if (from && !from.isBot) this.send(from.id, { t: 'hitmark', head: dmg > 50, kill: tgt.hp <= 0 });
    if (tgt.isBot && from && tgt.bot && !tgt.bot.target) { tgt.bot.target = from.id; tgt.bot.reaction = 0.2; }
    if (tgt.hp <= 0) this._kill(tgt, from, zone ? 'zona' : weapon);
    else this._sendInv(tgt);
  }

  _kill(p, killer, how) {
    if (!p.alive) return;
    p.alive = false; p.hp = 0; p.action = null;
    const aliveNow = [...this.players.values()].filter((q) => q.alive).length;
    p.place = aliveNow + 1;
    p.state = 'dead';
    if (killer && killer !== p) killer.kills++;
    // dropa a "caixa" de loot
    if (this.phase === 'playing') {
      let k = 0;
      const drop = (type, extra) => { const a = k++ * 1.1; this._spawnLoot(type, p.x + Math.cos(a) * 0.9, p.y, p.z + Math.sin(a) * 0.9, extra); };
      for (const s of p.slots) if (s) drop(s.type, { mag: s.mag });
      if (p.ammo > 0) drop('ammo', { n: p.ammo });
      for (let i = 0; i < p.bandage; i++) drop('bandage');
      for (let i = 0; i < p.medkit; i++) drop('medkit');
      if (p.armor) drop('armor' + p.armor);
      if (p.helmet) drop('helmet' + p.helmet);
      this.broadcast({ t: 'loot', add: [...this.loot.values()].slice(-k) });
    }
    this.broadcast({ t: 'kill', victim: p.id, vn: p.name, killer: killer ? killer.id : 0, kn: killer ? killer.name : '', how, alive: aliveNow, place: p.place });
    this._sendInv(p);
    if (killer && !killer.isBot) this._sendInv(killer);
    this._checkWin();
  }

  _checkWin() {
    if (this.phase !== 'playing') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    const humansAlive = alive.some((p) => !p.isBot);
    const humansConnected = [...this.players.values()].some((p) => !p.isBot);
    if (alive.length <= 1 || !humansConnected) {
      const w = alive[0];
      this.phase = 'ended'; this.phaseTimer = 10;
      if (w) w.place = 1;
      this.winner = w ? w.id : 0;
      this.broadcast({ t: 'end', winner: this.winner, name: w ? w.name : '—', kills: w ? w.kills : 0 });
    } else if (!humansAlive && this.o.fastForward) {
      // ninguém humano vivo: continua normalmente (espectadores assistem)
    }
  }

  _startReload(p) {
    const ww = this._weapon(p); if (!ww || !p.alive) return;
    if (p.action === 'reload' || ww.s.mag >= ww.w.mag || p.ammo <= 0) return;
    p.action = 'reload'; p.actionT = ww.w.reload; this._sendInv(p);
  }
  _startHeal(p, item) {
    if (!p.alive || (p.state !== 'ground' && p.state !== 'lobby')) return;
    if (item === 'bandage' && p.bandage > 0 && p.hp < 75) { p.action = 'bandage'; p.actionT = 3; }
    else if (item === 'medkit' && p.medkit > 0 && p.hp < 100) { p.action = 'medkit'; p.actionT = 6; }
    this._sendInv(p);
  }

  _pickup(p, lootId) {
    if (!p.alive || (p.state !== 'ground' && p.state !== 'lobby')) return;
    const it = this.loot.get(lootId); if (!it) return;
    if (Math.hypot(it.x - p.x, it.z - p.z) > 3.2 || Math.abs(it.y - p.y) > 2.5) return;
    const t = it.type;
    if (WEAPONS[t]) {
      const w = WEAPONS[t];
      let slot = w.slot;
      if (p.slots[slot]) {
        // slot ocupado: tenta o outro (primária pode ir nos dois)
        const other = slot === 0 ? 1 : 0;
        if (!p.slots[other] && t !== 'pistol') slot = other;
        else if (t === 'pistol' && p.slots[1]) slot = 1;
        else slot = p.cur;
        const old = p.slots[slot];
        if (old) this.broadcast({ t: 'loot', add: [this._spawnLoot(old.type, p.x, p.y, p.z, { mag: old.mag })] });
      }
      p.slots[slot] = { type: t, mag: it.mag ?? w.mag };
      p.cur = slot;
      if (p.action === 'reload') p.action = null;
    } else if (t === 'ammo') { if (p.ammo >= 300) return; p.ammo += it.n || 30; }
    else if (t === 'bandage') { if (p.bandage >= 10) return; p.bandage++; }
    else if (t === 'medkit') { if (p.medkit >= 3) return; p.medkit++; }
    else if (ITEMS[t] && ITEMS[t].armor) {
      const lv = ITEMS[t].armor; if (lv <= p.armor) return;
      if (p.armor) this.broadcast({ t: 'loot', add: [this._spawnLoot('armor' + p.armor, p.x, p.y, p.z)] });
      p.armor = lv;
    } else if (ITEMS[t] && ITEMS[t].helmet) {
      const lv = ITEMS[t].helmet; if (lv <= p.helmet) return;
      if (p.helmet) this.broadcast({ t: 'loot', add: [this._spawnLoot('helmet' + p.helmet, p.x, p.y, p.z)] });
      p.helmet = lv;
    }
    this.loot.delete(lootId);
    this.broadcast({ t: 'loot', remove: [lootId] });
    this._sendInv(p);
  }

  // ---------------- tick ----------------
  update(dt) {
    this.time += dt;
    const humans = [...this.players.values()].filter((p) => !p.isBot);
    if (this.phase === 'lobby') {
      if (humans.length >= this.o.minHumans) this.phaseTimer -= dt; else this.phaseTimer = this.o.lobbyTime;
      if (this.phaseTimer <= 0) this.startMatch();
    } else if (this.phase === 'plane' || this.phase === 'playing') {
      this._updatePlane(dt);
      this._updateZone(dt);
      this._updateActions(dt);
      this._updateBots(dt);
      if (humans.length === 0) this.resetLobby();
    } else if (this.phase === 'ended') {
      this.phaseTimer -= dt;
      this._updateActions(dt);
      if (this.phaseTimer <= 0) this.resetLobby();
    }
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / 15) { this.snapAcc = 0; this._snapshot(); }
  }

  _updatePlane(dt) {
    if (!this.plane) return;
    this.plane.t += dt;
    const pos = this._planePos();
    for (const p of this.players.values()) {
      if (p.state !== 'plane') continue;
      p.x = pos.x; p.z = pos.z; p.y = this.plane.y;
      if (pos.k >= 0.97 || (p.isBot && pos.k >= p.bot.jumpAt && this.world.heightAt(pos.x, pos.z) > 1)) this._jumpFromPlane(p);
    }
    if (this.phase === 'plane' && [...this.players.values()].every((p) => p.state !== 'plane')) this.phase = 'playing';
    if (this.phase === 'plane' && pos.k > 0.15) this.phase = 'playing';
  }

  _updateZone(dt) {
    const z = this.zone;
    z.timer -= dt;
    if (!z.shrinking && z.timer <= 0) {
      if (z.final && z.r <= 2) z.timer = 9999; else { z.shrinking = true; z.timer = z.shrinkDur; z.scx = z.cx; z.scz = z.cz; z.sr = z.r; }
    } else if (z.shrinking) {
      const k = 1 - Math.max(0, z.timer) / z.shrinkDur;
      z.cx = z.scx + (z.tcx - z.scx) * k; z.cz = z.scz + (z.tcz - z.scz) * k; z.r = z.sr + (z.tr - z.sr) * k;
      if (z.timer <= 0) { z.shrinking = false; this._nextZone(); }
    }
    // dano da zona (1x/seg)
    z.acc = (z.acc || 0) + dt;
    if (z.acc >= 1) {
      z.acc -= 1;
      for (const p of this.players.values()) {
        if (!p.alive || p.state === 'plane' || p.state === 'spectator' || p.state === 'lobby') continue;
        if (Math.hypot(p.x - z.cx, p.z - z.cz) > z.r) this._damage(p, z.dps, null, 'zona', true);
      }
    }
  }

  _updateActions(dt) {
    for (const p of this.players.values()) {
      if (!p.action || !p.alive) continue;
      p.actionT -= dt;
      if (p.actionT > 0) continue;
      const a = p.action; p.action = null;
      if (a === 'reload') {
        const ww = this._weapon(p);
        if (ww) { const need = ww.w.mag - ww.s.mag, n = Math.min(need, p.ammo); ww.s.mag += n; p.ammo -= n; }
      } else if (a === 'bandage' && p.bandage > 0) { p.bandage--; p.hp = Math.min(75, Math.max(p.hp, p.hp + 15)); }
      else if (a === 'medkit' && p.medkit > 0) { p.medkit--; p.hp = 100; }
      this._sendInv(p);
    }
  }

  _snapshot() {
    const pl = [];
    for (const p of this.players.values()) {
      if (p.state === 'spectator') continue;
      pl.push([p.id, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(3), +p.pitch.toFixed(3), Math.max(0, Math.round(p.hp)), p.alive ? 1 : 0, STATE_CODE[p.state] ?? 0, p.slots[p.cur] ? p.slots[p.cur].type : '', p.anim | 0, p.crouch ? 1 : 0]);
    }
    const z = this.zone;
    this.broadcast({
      t: 'snap', time: +this.time.toFixed(3), phase: this.phase, timer: +this.phaseTimer.toFixed(1),
      zone: [+z.cx.toFixed(1), +z.cz.toFixed(1), +z.r.toFixed(1), +z.tcx.toFixed(1), +z.tcz.toFixed(1), +z.tr.toFixed(1), +Math.max(0, z.timer).toFixed(1), z.shrinking ? 1 : 0, z.stage],
      planeT: this.plane ? +this.plane.t.toFixed(2) : 0,
      alive: [...this.players.values()].filter((p) => p.alive && p.state !== 'spectator' && p.state !== 'lobby').length,
      names: this._namesDirty() ? [...this.players.values()].map((p) => [p.id, p.name, p.isBot ? 1 : 0]) : undefined,
      p: pl,
    });
  }
  _namesDirty() {
    const sig = [...this.players.keys()].join(',');
    if (sig !== this._nameSig) { this._nameSig = sig; return true; }
    this._nameTick = (this._nameTick || 0) + 1;
    return this._nameTick % 45 === 0; // reenvia de vez em quando para quem acabou de entrar
  }

  // ---------------- IA dos bots ----------------
  _updateBots(dt) {
    const W = this.world;
    const all = [...this.players.values()];
    for (const p of all) {
      if (!p.isBot || !p.alive) continue;
      const B = p.bot;
      if (p.state === 'plane') continue;
      if (p.state === 'air' || p.state === 'chute') {
        if (!B.goal) {
          // escolhe uma cidade ou ponto de loot próximo da queda
          const towns = W.towns.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          const t = this.rng() < 0.7 ? towns[(this.rng() * 2) | 0] : null;
          B.goal = t ? { x: t.x + (this.rng() - 0.5) * t.r, z: t.z + (this.rng() - 0.5) * t.r } : W.randomLandPoint(this.rng, 0.8);
        }
        const g = W.heightAt(p.x, p.z);
        const dx = B.goal.x - p.x, dz = B.goal.z - p.z, d = Math.hypot(dx, dz) || 1;
        const chute = p.y - g < 90;
        p.state = chute ? 'chute' : 'air';
        const hs = chute ? 13 : 28, vs = chute ? -6 : -38;
        const k = Math.min(1, d / 20);
        p.x += (dx / d) * hs * k * dt; p.z += (dz / d) * hs * k * dt; p.y += vs * dt;
        p.yaw = Math.atan2(-dx, -dz);
        if (p.y <= g + 0.05) { p.y = W.groundAt(p.x, p.z, p.y + 3); p.state = 'ground'; B.goal = null; p.vy = 0; }
        continue;
      }
      if (p.state !== 'ground') continue;

      B.think -= dt;
      if (B.think <= 0) { B.think = 0.25 + this.rng() * 0.15; this._botThink(p, all); }

      // mover
      let mvx = 0, mvz = 0, speed = 4.6;
      const ww = this._weapon(p);
      const tgt = B.target ? this.players.get(B.target) : null;
      if (tgt && tgt.alive && B.canSee) {
        const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz) || 1;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(tgt.y - p.y, d);
        B.strafeT -= dt; if (B.strafeT <= 0) { B.strafe *= -1; B.strafeT = 0.6 + this.rng() * 1.4; }
        const wantDist = ww ? Math.min(ww.w.range * 0.5, 35) : 0;
        const fwd = d > wantDist ? 1 : d < wantDist * 0.5 ? -0.6 : 0;
        mvx = (dx / d) * fwd + (-dz / d) * B.strafe * 0.8; mvz = (dz / d) * fwd + (dx / d) * B.strafe * 0.8;
        speed = 3.6;
        // atirar
        B.reaction -= dt;
        if (ww && B.reaction <= 0 && ww.s.mag > 0 && p.action !== 'reload' && this.time - p.lastShot >= (60 / ww.w.rpm) * (ww.w.auto ? 1.7 : 1.15) && d < ww.w.range) {
          this._botFire(p, tgt, ww, d);
          if (!ww.w.auto) B.reaction = 0.25 + (1 - p.skill) * 0.6;
          else if (this.rng() < 0.08) B.reaction = 0.4 + this.rng() * 0.5; // rajadas
        }
        if (ww && ww.s.mag === 0) this._startReload(p);
      } else if (B.goal) {
        const dx = B.goal.x - p.x, dz = B.goal.z - p.z, d = Math.hypot(dx, dz);
        if (d < 1.2) { if (B.goal.loot) this._pickup(p, B.goal.loot); B.goal = null; }
        else { mvx = dx / d; mvz = dz / d; p.yaw = Math.atan2(-dx, -dz); p.pitch = 0; }
        const z = this.zone;
        if (Math.hypot(p.x - z.cx, p.z - z.cz) > z.r * 0.9) speed = 6.2;
      }
      // desvio quando travado
      if (B.avoid > 0) { B.avoid -= dt; const c = Math.cos(B.avoidA), s = Math.sin(B.avoidA); [mvx, mvz] = [mvx * c - mvz * s, mvx * s + mvz * c]; }
      p.vx = mvx * speed; p.vz = mvz * speed;
      const ox = p.x, oz = p.z;
      W.moveBody(p, dt);
      const moved = Math.hypot(p.x - ox, p.z - oz);
      if ((mvx || mvz) && moved < speed * dt * 0.3) { B.stuck += dt; if (B.stuck > 0.4) { B.avoid = 0.8 + this.rng(); B.avoidA = (this.rng() < 0.5 ? 1 : -1) * (0.9 + this.rng()); B.stuck = 0; if (p.onGround) p.vy = 7; } }
      else B.stuck = Math.max(0, B.stuck - dt);
      p.anim = (mvx || mvz) ? (speed > 5 ? 2 : 1) : 0;
      // cura
      if (!p.action && p.hp < 60 && !(tgt && B.canSee)) { if (p.medkit) this._startHeal(p, 'medkit'); else if (p.bandage) this._startHeal(p, 'bandage'); }
    }
  }

  _botThink(p, all) {
    const W = this.world, B = p.bot;
    // procura alvo visível
    const ww = this._weapon(p);
    let best = null, bd = 1e9;
    const sight = 110 + p.skill * 60;
    for (const q of all) {
      if (q === p || !q.alive || q.state !== 'ground') continue; // não atira em quem está no ar
      const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
      if (d > sight || d > bd) continue;
      if (q.id === B.target) { best = q; bd = d * 0.7; continue; }
      best = q; bd = d;
    }
    B.canSee = false;
    if (best && W.lineOfSight(p.x, p.y + 1.55, p.z, best.x, best.y + 1.3, best.z)) {
      if (B.target !== best.id) { B.reaction = 0.35 + (1 - p.skill) * 0.9 + this.rng() * 0.3; }
      B.target = best.id; B.canSee = !!ww; B.goal = null;
      if (!ww) { B.target = null; }
      return;
    }
    if (B.target) { const t = this.players.get(B.target); if (!t || !t.alive || Math.hypot(t.x - p.x, t.z - p.z) > sight * 1.3) B.target = null; else B.goal = { x: t.x, z: t.z }; }
    // fora da zona ou chegando no limite: vai pro centro
    const z = this.zone;
    const dz = Math.hypot(p.x - z.tcx, p.z - z.tcz);
    const needZone = Math.hypot(p.x - z.cx, p.z - z.cz) > z.r * 0.85 || (z.timer < 25 && dz > z.tr * 0.8);
    if (needZone) {
      const a = Math.atan2(z.tcz - p.z, z.tcx - p.x);
      B.goal = { x: z.tcx - Math.cos(a) * z.tr * 0.4, z: z.tcz - Math.sin(a) * z.tr * 0.4 };
      return;
    }
    if (B.goal && !B.goal.loot && B.goal.wander && Math.hypot(B.goal.x - p.x, B.goal.z - p.z) > 2) return;
    // procura loot útil
    const wantWeapon = !p.slots[0];
    let bl = null, bld = 45;
    for (const it of this.loot.values()) {
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d > bld || Math.abs(it.y - p.y) > 3) continue;
      const useful = WEAPONS[it.type] ? (wantWeapon && it.type !== 'pistol') : it.type === 'ammo' ? p.ammo < 120 : it.type === 'bandage' ? p.bandage < 5 : it.type === 'medkit' ? p.medkit < 2 : it.type.startsWith('armor') ? +it.type.slice(-1) > p.armor : it.type.startsWith('helmet') ? +it.type.slice(-1) > p.helmet : false;
      if (!useful) continue;
      bl = it; bld = d;
    }
    if (bl) { B.goal = { x: bl.x, z: bl.z, loot: bl.id }; return; }
    if (!B.goal) {
      const a = this.rng() * Math.PI * 2, r = 30 + this.rng() * 60;
      let gx = p.x + Math.cos(a) * r, gz = p.z + Math.sin(a) * r;
      const k = Math.hypot(gx - z.tcx, gz - z.tcz) > z.tr * 0.8 ? 0.5 : 0;
      gx += (z.tcx - gx) * k; gz += (z.tcz - gz) * k;
      B.goal = { x: gx, z: gz, wander: true };
    }
  }

  _botFire(p, tgt, ww, d) {
    const { s, w } = ww;
    const ox = p.x, oy = p.y + 1.5, oz = p.z;
    // erro de mira dependente da habilidade, distância e movimento do alvo
    const moving = Math.hypot(tgt.vx || 0, tgt.vz || 0) > 1 || tgt.anim > 0;
    const err = (0.045 + (1 - p.skill) * 0.1 + (moving ? 0.035 : 0)) * (1 + d / 100);
    const hits = [];
    let endP = null;
    for (let i = 0; i < w.pellets; i++) {
      const aimY = tgt.y + (this.rng() < 0.12 * p.skill ? 1.6 : 1.1);
      let dx = tgt.x - ox, dy = aimY - oy, dz = tgt.z - oz; const L = Math.hypot(dx, dy, dz);
      dx = dx / L + (this.rng() - 0.5) * (err + w.spread) * 2; dy = dy / L + (this.rng() - 0.5) * (err + w.spread) * 2; dz = dz / L + (this.rng() - 0.5) * (err + w.spread) * 2;
      const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
      const h = rayPlayer(ox, oy, oz, dx, dy, dz, tgt);
      const wd = this.world.raycast(ox, oy, oz, dx, dy, dz, w.range);
      if (h && h.t < wd) hits.push({ id: tgt.id, part: h.part });
      const t = h && h.t < wd ? h.t : wd;
      if (!endP) endP = [+(ox + dx * t).toFixed(2), +(oy + dy * t).toFixed(2), +(oz + dz * t).toFixed(2)];
    }
    this._shoot(p, { o: [+ox.toFixed(2), +oy.toFixed(2), +oz.toFixed(2)], d: [0, 0, 0], e: endP, hits });
  }
}

export const STATE_CODE = { lobby: 0, plane: 1, air: 2, chute: 3, ground: 4, dead: 5, spectator: 6 };
export const STATE_NAME = Object.fromEntries(Object.entries(STATE_CODE).map(([k, v]) => [v, k]));
export { PLAYER_HEIGHT };
