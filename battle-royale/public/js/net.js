// Transporte de rede. O jogo fala sempre com "um servidor":
//  - OnlineTransport: WebSocket para o servidor Node (multiplayer real)
//  - LocalTransport: a mesma simulação rodando dentro do navegador (offline / contra bots)
import { Match } from './shared/sim.js';

export class OnlineTransport {
  constructor(url, onMsg, onClose) {
    this.onMsg = onMsg; this.onClose = onClose;
    this.ws = new WebSocket(url);
    this.ready = new Promise((res, rej) => {
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('Falha ao conectar em ' + url));
      setTimeout(() => rej(new Error('Tempo esgotado conectando ao servidor')), 6000);
    });
    this.ws.onmessage = (e) => { try { this.onMsg(JSON.parse(e.data)); } catch (err) { console.error(err); } };
    this.ws.onclose = () => this.onClose && this.onClose();
    this.online = true;
  }
  send(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  tick() {}
  close() { this.ws.close(); }
}

export class LocalTransport {
  constructor(world, onMsg, opts = {}) {
    this.onMsg = onMsg; this.online = false;
    this.queue = [];
    this.match = new Match({
      world, seed: world.seed, totalPlayers: opts.bots ?? 30, lobbyTime: opts.lobbyTime ?? 8,
      send: (id, m) => { if (this.myId === undefined || id === this.myId) this.queue.push(m); },
      broadcast: (m) => this.queue.push(m),
    });
    this.ready = Promise.resolve();
  }
  join(name) { this.myId = this.match.addPlayer(name); this.flush(); }
  send(m) {
    if (m.t === 'join') return this.join(m.name);
    this.match.onMessage(this.myId, m); this.flush();
  }
  tick(dt) { this.match.update(Math.min(dt, 0.1)); this.flush(); }
  flush() {
    // clona para simular a rede (evita compartilhar objetos do servidor)
    const q = this.queue; this.queue = [];
    for (const m of q) this.onMsg(JSON.parse(JSON.stringify(m)));
  }
  close() {}
}
