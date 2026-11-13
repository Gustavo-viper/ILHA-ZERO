// Servidor do ILHA ZERO: serve os arquivos do jogo + multiplayer em tempo real (WebSocket).
// Uso: npm install && npm start  → abra http://localhost:8080 (ou o IP da sua máquina na rede)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Match } from './public/js/shared/sim.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = +process.env.PORT || 8080;
const SEED = +process.env.SEED || 20261113;
const TOTAL = +process.env.PLAYERS || 30; // humanos + bots por partida
const LOBBY = +process.env.LOBBY || 25;   // segundos de aquecimento antes do avião

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (p === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: clients.size, phase: match.phase })); }
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': p.includes('/vendor/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(data);
  });
});

const clients = new Map(); // id -> ws
const match = new Match({
  seed: SEED, totalPlayers: TOTAL, lobbyTime: LOBBY,
  send: (id, m) => { const ws = clients.get(id); if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
  broadcast: (m) => { const s = JSON.stringify(m); for (const ws of clients.values()) if (ws.readyState === 1) ws.send(s); },
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
wss.on('connection', (ws) => {
  let id = 0, count = 0, windowStart = Date.now();
  ws.on('message', (raw) => {
    // limite simples de mensagens (anti-flood)
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
    if (++count > 120) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!id) {
      if (m.t !== 'join') return;
      if (clients.size >= TOTAL) { ws.send(JSON.stringify({ t: 'full' })); return ws.close(); }
      // registra o socket antes de addPlayer para receber o 'welcome'
      const pending = match.nextId;
      clients.set(pending, ws);
      id = match.addPlayer(m.name);
      if (id !== pending) { clients.delete(pending); clients.set(id, ws); }
      console.log(`[+] ${m.name} (#${id}) entrou — ${clients.size} online`);
      return;
    }
    match.onMessage(id, m);
  });
  ws.on('close', () => { if (id) { clients.delete(id); match.removePlayer(id); console.log(`[-] #${id} saiu — ${clients.size} online`); } });
});

let last = performance.now();
setInterval(() => { const now = performance.now(); match.update(Math.min(0.1, (now - last) / 1000)); last = now; }, 1000 / 30);

server.listen(PORT, () => {
  console.log(`\nILHA ZERO rodando!`);
  console.log(`  Neste PC:      http://localhost:${PORT}`);
  for (const ifs of Object.values(os.networkInterfaces())) for (const i of ifs || []) if (i.family === 'IPv4' && !i.internal) console.log(`  Na rede local: http://${i.address}:${PORT}`);
  console.log(`  ${TOTAL} jogadores por partida (vagas vazias viram bots), aquecimento de ${LOBBY}s\n`);
});
