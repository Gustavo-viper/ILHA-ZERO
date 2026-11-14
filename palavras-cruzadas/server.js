// Palavrário — servidor: arquivos do jogo + contas (login e senha) + progresso na nuvem.
// Sem dependências externas. Dados em DATA_DIR (no Railway, aponte para um volume).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'dados');
const DB_FILE = path.join(DATA_DIR, 'palavrario.json');
const PUBLIC = __dirname;
const SESSAO_DIAS = 60;

// ------------------------------------------------------------ banco (JSON com escrita atômica)
fs.mkdirSync(DATA_DIR, { recursive: true });
let db = { usuarios: {}, sessoes: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { /* primeiro uso */ }
db.usuarios = db.usuarios || {}; db.sessoes = db.sessoes || {};
let gravando = false, pendente = false;
function gravar() {
  if (gravando) { pendente = true; return; }
  gravando = true;
  const tmp = DB_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(db), (err) => {
    if (!err) fs.renameSync(tmp, DB_FILE);
    gravando = false;
    if (pendente) { pendente = false; gravar(); }
  });
}

// ------------------------------------------------------------ senhas e sessões
const hashSenha = (senha, sal) => crypto.scryptSync(senha, sal, 64).toString('hex');
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
function novaSessao(usuario) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessoes[hashToken(token)] = { usuario, expira: Date.now() + SESSAO_DIAS * 864e5 };
  return token;
}
function usuarioDaReq(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const s = db.sessoes[hashToken(m[1])];
  if (!s || s.expira < Date.now()) return null;
  return s.usuario;
}
setInterval(() => { const agora = Date.now(); let mudou = false; for (const k in db.sessoes) if (db.sessoes[k].expira < agora) { delete db.sessoes[k]; mudou = true; } if (mudou) gravar(); }, 36e5).unref();

// limite de tentativas de login/cadastro por IP (anti força bruta)
const tentativas = new Map();
function bloqueado(ip) {
  const t = tentativas.get(ip) || { n: 0, desde: Date.now() };
  if (Date.now() - t.desde > 15 * 60e3) { t.n = 0; t.desde = Date.now(); }
  t.n++; tentativas.set(ip, t);
  return t.n > 20;
}

// ------------------------------------------------------------ utilidades HTTP
function json(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function lerCorpo(req, limite = 2e6) {
  return new Promise((ok, falha) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { falha(new Error('grande')); req.destroy(); } else partes.push(c); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(partes).toString('utf8') || '{}')); } catch (e) { falha(e); } });
    req.on('error', falha);
  });
}
const nomeValido = (u) => typeof u === 'string' && /^[a-z0-9_.]{3,20}$/.test(u);

// ------------------------------------------------------------ API
async function api(req, res, url) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (url === '/api/health') return json(res, 200, { ok: true, contas: Object.keys(db.usuarios).length });

  if (req.method === 'POST' && (url === '/api/cadastro' || url === '/api/login')) {
    if (bloqueado(ip)) return json(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
    let b; try { b = await lerCorpo(req, 1e4); } catch (e) { return json(res, 400, { erro: 'Pedido inválido.' }); }
    const usuario = String(b.usuario || '').trim().toLowerCase(), senha = String(b.senha || '');
    if (!nomeValido(usuario)) return json(res, 400, { erro: 'Usuário: 3 a 20 letras minúsculas, números, ponto ou _.' });
    if (senha.length < 6 || senha.length > 100) return json(res, 400, { erro: 'A senha precisa ter pelo menos 6 caracteres.' });
    if (url === '/api/cadastro') {
      if (db.usuarios[usuario]) return json(res, 409, { erro: 'Esse nome de usuário já existe.' });
      const sal = crypto.randomBytes(16).toString('hex');
      db.usuarios[usuario] = { sal, hash: hashSenha(senha, sal), criado: Date.now(), progresso: null, atualizado: 0 };
    } else {
      const u = db.usuarios[usuario];
      const ok = u && crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hashSenha(senha, u.sal), 'hex'));
      if (!ok) return json(res, 401, { erro: 'Usuário ou senha incorretos.' });
    }
    const token = novaSessao(usuario); gravar();
    const u = db.usuarios[usuario];
    return json(res, 200, { token, usuario, progresso: u.progresso, atualizado: u.atualizado });
  }

  const usuario = usuarioDaReq(req);
  if (!usuario || !db.usuarios[usuario]) return json(res, 401, { erro: 'Sessão expirada. Entre de novo.' });
  const u = db.usuarios[usuario];
  if (url === '/api/progresso' && req.method === 'GET') return json(res, 200, { usuario, progresso: u.progresso, atualizado: u.atualizado });
  if (url === '/api/progresso' && req.method === 'PUT') {
    let b; try { b = await lerCorpo(req); } catch (e) { return json(res, 413, { erro: 'Progresso grande demais.' }); }
    if (!b || typeof b.progresso !== 'object') return json(res, 400, { erro: 'Pedido inválido.' });
    u.progresso = b.progresso; u.atualizado = Date.now(); gravar();
    return json(res, 200, { ok: true, atualizado: u.atualizado });
  }
  if (url === '/api/sair' && req.method === 'POST') {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
    if (m) delete db.sessoes[hashToken(m[1])];
    gravar(); return json(res, 200, { ok: true });
  }
  return json(res, 404, { erro: 'Não encontrado.' });
}

// ------------------------------------------------------------ arquivos estáticos
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
const PERMITIDOS = new Set(['/index.html', '/js/palavras.js', '/js/gerador.js', '/js/jogo.js', '/manifest.webmanifest', '/icone.svg', '/logo.svg', '/sw.js']);

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (url.startsWith('/api/')) return await api(req, res, url);
    const arq = url === '/' ? '/index.html' : url;
    if (!PERMITIDOS.has(arq)) { res.writeHead(404); return res.end('404'); }
    fs.readFile(path.join(PUBLIC, arq), (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'content-type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'cache-control': arq === '/sw.js' ? 'no-cache' : 'public, max-age=300', 'x-content-type-options': 'nosniff' });
      res.end(data);
    });
  } catch (e) { console.error(e); json(res, 500, { erro: 'Erro interno.' }); }
}).listen(PORT, () => console.log(`Palavrário no ar na porta ${PORT} · dados em ${DATA_DIR}`));
