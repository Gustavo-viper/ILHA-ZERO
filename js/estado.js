// Estado do jogo, salvamento e regras de economia.
import { PECAS, LISTA_PECAS, LISTA_UPGRADES, UPGRADES, MODELOS, TIER_MULT, NOMES, DIAGNOSTICO } from './data.js';
import { modelo, clamp } from './fisica.js';

const CHAVE = 'oficina-turbo-save-v1';
export const S = {};
export const INICIO_DIA = 8 * 60, FIM_DIA = 18 * 60;

const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const escolher = arr => arr[Math.floor(Math.random() * arr.length)];
let seq = Date.now() % 100000;
const uid = () => (++seq).toString(36) + Math.random().toString(36).slice(2, 6);

export function novoCarro(idModelo, condMin = 70, condMax = 100) {
  const partes = {};
  LISTA_PECAS.forEach(p => partes[p] = rndi(condMin, condMax));
  const ups = {};
  LISTA_UPGRADES.forEach(u => ups[u] = 0);
  return { uid: uid(), modelo: idModelo, cor: modelo(idModelo).cor, partes, ups, ecu: null, gasto: 0, recorde: null };
}

export function precoPeca(peca, carro) { return Math.round(PECAS[peca].preco * TIER_MULT[modelo(carro.modelo).tier]); }
export function tempoPeca(peca) { return Math.round(PECAS[peca].tempo * (S.equip.chave ? 0.65 : 1)); }
export function precoUpgrade(u, nivel, carro) {
  return Math.round(UPGRADES[u].niveis[nivel] * (1 + (modelo(carro.modelo).tier - 1) * 0.3) / 10) * 10;
}

export function valorCarro(carro) {
  const m = modelo(carro.modelo);
  const media = LISTA_PECAS.reduce((s, p) => s + carro.partes[p], 0) / LISTA_PECAS.length;
  return Math.round((m.preco * (0.25 + 0.6 * media / 100) + carro.gasto * 0.45) / 10) * 10;
}

export function novoJogo() {
  for (const k of Object.keys(S)) delete S[k];
  const inicial = novoCarro('rubi', 25, 70);
  Object.assign(S, {
    versao: 1, dinheiro: 3000, rep: 2.5, dia: 1, hora: INICIO_DIA,
    equip: {}, carros: [inicial], ativo: inicial.uid,
    servicos: [], ferroVelho: [], rivalVencido: -1,
    stats: { servicos: 0, corridas: 0, vitorias: 0, faturado: 0 },
    som: true, tutorial: true,
  });
  gerarDia();
  salvar();
}

export function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && d.versao === 1) { Object.assign(S, d); return true; }
  } catch (e) { /* save corrompido */ }
  return false;
}
export function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) { /* sem espaço */ } }
export function apagarSave() { localStorage.removeItem(CHAVE); }

export const carroAtivo = () => S.carros.find(c => c.uid === S.ativo) || S.carros[0] || null;
export const vagas = () => 1 + (S.equip.vaga2 ? 1 : 0) + (S.equip.vaga3 ? 1 : 0);
export const custoDiario = () => 120 + 60 * (vagas() - 1);

function tierMax() {
  if (S.rep >= 4 || S.dia > 25) return 4;
  if (S.rep >= 3.2 || S.dia > 12) return 3;
  if (S.rep >= 2.5 || S.dia > 4) return 2;
  return 1;
}

function novoServico() {
  const tm = tierMax();
  const opcoes = MODELOS.filter(m => m.tier <= tm && (m.tier < 4 || Math.random() < 0.3));
  const m = escolher(opcoes);
  const carro = novoCarro(m.id, 45, 100);
  carro.cor = Math.random() < 0.5 ? m.cor : escolher(['#718096', '#e2e8f0', '#1a202c', '#9b2c2c', '#2a4365', '#276749']);
  // 1 a 3 defeitos que geram sintomas
  const nDefeitos = rndi(1, Math.min(3, 1 + Math.floor(S.dia / 3)));
  const defeitos = [];
  while (defeitos.length < nDefeitos) {
    const p = escolher(LISTA_PECAS);
    if (p === 'motor' && Math.random() < 0.7) continue;
    if (!defeitos.includes(p)) defeitos.push(p);
  }
  defeitos.forEach(p => carro.partes[p] = rndi(3, 25));
  // de vez em quando uma peça desgastada sem sintoma (pode trocar e cobrar)
  if (Math.random() < 0.5) {
    const p = escolher(LISTA_PECAS.filter(x => !defeitos.includes(x)));
    carro.partes[p] = rndi(30, 48);
  }
  return {
    id: uid(), cliente: escolher(NOMES), carro,
    sintomas: defeitos.map(p => PECAS[p].sintoma),
    original: { ...carro.partes }, conhecido: {}, trocadas: {}, gastoPecas: 0,
  };
}

function novaOfertaFerroVelho() {
  const tm = Math.min(4, tierMax() + 1);
  const m = escolher(MODELOS.filter(x => x.tier <= tm));
  const carro = novoCarro(m.id, 5, 75);
  if (Math.random() < 0.4) carro.cor = escolher(['#744210', '#4a5568', '#9c4221', '#22543d']);
  const media = LISTA_PECAS.reduce((s, p) => s + carro.partes[p], 0) / LISTA_PECAS.length;
  const preco = Math.round(m.preco * (0.12 + 0.35 * media / 100) * rnd(0.85, 1.15) / 10) * 10;
  return { carro, preco };
}

export function gerarDia() {
  S.hora = INICIO_DIA;
  S.servicos = [];
  for (let i = 0; i < vagas(); i++) S.servicos.push(novoServico());
  S.ferroVelho = [novaOfertaFerroVelho(), novaOfertaFerroVelho(), novaOfertaFerroVelho()];
}

// Encerra o dia: clientes não atendidos vão embora e paga-se o aluguel.
export function encerrarDia() {
  const abandonados = S.servicos.length;
  const perda = abandonados * 0.15;
  S.rep = clamp(S.rep - perda, 0, 5);
  const aluguel = custoDiario();
  S.dinheiro -= aluguel;
  S.dia++;
  gerarDia();
  salvar();
  return { abandonados, perda, aluguel };
}

export function gastarTempo(min) {
  if (S.hora + min > FIM_DIA) return false;
  S.hora += min;
  return true;
}

export function inspecionar(serv, peca) {
  if (serv.conhecido[peca]) return { ok: true };
  if (!gastarTempo(10)) return { ok: false, msg: 'Não dá tempo hoje.' };
  serv.conhecido[peca] = true;
  return { ok: true };
}

export function diagnosticar(serv, equip) {
  if (!S.equip[equip]) return { ok: false, msg: 'Você não tem esse equipamento.' };
  if (!gastarTempo(10)) return { ok: false, msg: 'Não dá tempo hoje.' };
  LISTA_PECAS.filter(p => DIAGNOSTICO[equip].includes(PECAS[p].sistema)).forEach(p => serv.conhecido[p] = true);
  return { ok: true };
}

// Verifica se é possível trocar a peça (antes do minigame).
export function podeTrocar(carro, peca, cobraTempo) {
  const preco = precoPeca(peca, carro);
  if (S.dinheiro < preco) return { ok: false, msg: `Falta dinheiro: a peça custa R$ ${preco}.` };
  if (cobraTempo && S.hora + tempoPeca(peca) > FIM_DIA) return { ok: false, msg: 'Não dá tempo de fazer essa troca hoje.' };
  return { ok: true, preco };
}

// Aplica a troca. qualidade 0..1 vem do minigame do aperto.
export function aplicarTroca(carro, peca, qualidade, serv) {
  const preco = precoPeca(peca, carro);
  S.dinheiro -= preco;
  carro.partes[peca] = Math.round(70 + 30 * qualidade);
  if (serv) {
    S.hora += tempoPeca(peca);
    serv.trocadas[peca] = qualidade;
    serv.conhecido[peca] = true;
    serv.gastoPecas += preco;
  } else {
    carro.gasto += preco * 0.3;
  }
  salvar();
}

// Calcula o que o cliente paga e o efeito na reputação.
export function avaliarEntrega(serv) {
  const mt = TIER_MULT[modelo(serv.carro.modelo).tier];
  const linhas = [];
  let total = 0, rep = 0;
  for (const p of LISTA_PECAS) {
    const orig = serv.original[p];
    const trocou = p in serv.trocadas;
    if (trocou) {
      if (orig < 50) {
        const mao = Math.round(PECAS[p].tempo / 60 * 90 * mt);
        const valor = Math.round(precoPeca(p, serv.carro) * 1.25) + mao;
        total += valor; rep += 0.04 + 0.04 * (serv.trocadas[p] - 0.6);
        linhas.push({ txt: `${PECAS[p].nome} (peça + mão de obra)`, valor });
      } else {
        rep -= 0.12;
        linhas.push({ txt: `${PECAS[p].nome}: troca desnecessária, cliente não pagou`, valor: 0, ruim: true });
      }
    } else if (orig < 30) {
      rep -= 0.2;
      linhas.push({ txt: `${PECAS[p].nome} continua com defeito!`, valor: 0, ruim: true });
    }
  }
  const resolvido = LISTA_PECAS.every(p => serv.original[p] >= 30 || p in serv.trocadas);
  if (resolvido && Object.keys(serv.trocadas).length) rep += 0.1;
  const gorjeta = resolvido ? Math.round(total * (S.rep - 2.5) * 0.06) : 0;
  if (gorjeta > 0) linhas.push({ txt: 'Gorjeta pela boa fama', valor: gorjeta });
  total += Math.max(0, gorjeta);
  return { linhas, total, rep, resolvido };
}

export function entregar(serv) {
  const r = avaliarEntrega(serv);
  S.dinheiro += r.total;
  S.rep = clamp(S.rep + r.rep, 0, 5);
  S.stats.servicos++;
  S.stats.faturado += r.total;
  S.servicos = S.servicos.filter(s => s !== serv);
  salvar();
  return r;
}

export function comprarFerroVelho(i) {
  const o = S.ferroVelho[i];
  if (!o || S.dinheiro < o.preco) return false;
  if (S.carros.length >= 4) return 'cheia';
  S.dinheiro -= o.preco;
  o.carro.gasto = o.preco;
  S.carros.push(o.carro);
  S.ferroVelho.splice(i, 1);
  salvar();
  return true;
}

export function venderCarro(uidCarro) {
  if (S.carros.length <= 1) return 0;
  const c = S.carros.find(x => x.uid === uidCarro);
  const v = valorCarro(c);
  S.dinheiro += v;
  S.carros = S.carros.filter(x => x !== c);
  if (S.ativo === c.uid) S.ativo = S.carros[0].uid;
  salvar();
  return v;
}

export function comprarUpgrade(carro, u) {
  const nivel = carro.ups[u];
  if (nivel >= UPGRADES[u].niveis.length) return { ok: false, msg: 'Já está no nível máximo.' };
  const preco = precoUpgrade(u, nivel, carro);
  if (S.dinheiro < preco) return { ok: false, msg: `Falta dinheiro: custa R$ ${preco}.` };
  S.dinheiro -= preco;
  carro.ups[u]++;
  carro.gasto += preco;
  if (u === 'turbo' || u === 'ecu') carro.ecu = null; // volta ao mapa seguro
  salvar();
  return { ok: true };
}

// Detonação causa dano ao motor.
export function aplicarDetonacao(carro, sp) {
  if (sp.detonacao <= sp.limite) return 0;
  const excesso = sp.detonacao - sp.limite;
  if (Math.random() > Math.min(0.9, 0.35 + excesso)) return 0;
  const dano = Math.round(10 + excesso * 40 + Math.random() * 10);
  carro.partes.motor = Math.max(0, carro.partes.motor - dano);
  carro.partes.velas = Math.max(0, carro.partes.velas - Math.round(dano / 2));
  salvar();
  return dano;
}

// Desgaste natural depois de uma corrida.
export function desgastarCorrida(carro) {
  const d = (p, a, b) => carro.partes[p] = Math.max(0, carro.partes[p] - rndi(a, b));
  d('pneus', 2, 5); d('embreagem', 1, 4); d('oleo', 1, 3); d('motor', 0, 1); d('velas', 0, 2);
}
