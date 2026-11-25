// Dados fixos do jogo: peças, modelos de carro, upgrades, rivais e clientes.

export const PECAS = {
  motor:        { nome: 'Motor (retífica)',     icone: '⚙️', preco: 2600, tempo: 240, sistema: 'motor',       sintoma: 'Fumaça azul no escapamento e motor sem compressão' },
  oleo:         { nome: 'Óleo e filtro',        icone: '🛢️', preco: 90,   tempo: 20,  sistema: 'motor',       sintoma: 'Luz do óleo acesa no painel' },
  velas:        { nome: 'Velas de ignição',     icone: '⚡', preco: 140,  tempo: 30,  sistema: 'motor',       sintoma: 'Motor falhando e tremendo na marcha lenta' },
  filtroAr:     { nome: 'Filtro de ar',         icone: '🌬️', preco: 60,   tempo: 10,  sistema: 'motor',       sintoma: 'Carro sem força e gastando muito combustível' },
  correia:      { nome: 'Correia dentada',      icone: '➰', preco: 280,  tempo: 90,  sistema: 'motor',       sintoma: 'Chiado e estalos vindos da frente do motor' },
  bateria:      { nome: 'Bateria',              icone: '🔋', preco: 420,  tempo: 10,  sistema: 'eletrica',    sintoma: 'Carro não pega de manhã, só no tranco' },
  alternador:   { nome: 'Alternador',           icone: '🔌', preco: 680,  tempo: 60,  sistema: 'eletrica',    sintoma: 'Luz da bateria acesa com o carro andando' },
  radiador:     { nome: 'Radiador',             icone: '🌡️', preco: 520,  tempo: 60,  sistema: 'arrefecimento', sintoma: 'Ponteiro da temperatura subindo no trânsito' },
  pastilhas:    { nome: 'Pastilhas de freio',   icone: '🛑', preco: 160,  tempo: 30,  sistema: 'freios',      sintoma: 'Chiado agudo toda vez que freia' },
  discos:       { nome: 'Discos de freio',      icone: '💿', preco: 380,  tempo: 50,  sistema: 'freios',      sintoma: 'Volante treme quando freia forte' },
  amortecedores:{ nome: 'Amortecedores',        icone: '🔩', preco: 760,  tempo: 90,  sistema: 'suspensao',   sintoma: 'Carro balança demais nas lombadas' },
  pneus:        { nome: 'Jogo de pneus',        icone: '🛞', preco: 950,  tempo: 40,  sistema: 'rodas',       sintoma: 'Pneus carecas, carro escorrega na chuva' },
  embreagem:    { nome: 'Kit de embreagem',     icone: '🦶', preco: 850,  tempo: 150, sistema: 'transmissao', sintoma: 'Embreagem patinando: o giro sobe e o carro não anda' },
  escapamento:  { nome: 'Escapamento',          icone: '💨', preco: 460,  tempo: 50,  sistema: 'escape',      sintoma: 'Ronco alto e cheiro de fumaça dentro do carro' },
};
export const LISTA_PECAS = Object.keys(PECAS);

// Sistemas que cada equipamento da oficina consegue diagnosticar de uma vez.
export const DIAGNOSTICO = {
  scanner:  ['motor', 'eletrica', 'arrefecimento'],
  elevador: ['freios', 'suspensao', 'rodas', 'transmissao', 'escape'],
};

// Modelos fictícios.
export const MODELOS = [
  { id: 'rubi',     nome: 'Rubi 1.0',          tipo: 'hatch',  hp: 68,  peso: 880,  redline: 6500, pico: 5600, tracao: 'D', cd: 0.34, area: 1.95, preco: 14000,  tier: 1, cor: '#c0392b', marchas: [3.73, 2.13, 1.41, 1.03, 0.82], final: 4.3 },
  { id: 'mula',     nome: 'Mula 1.8 Picape',   tipo: 'pickup', hp: 98,  peso: 1180, redline: 6000, pico: 5200, tracao: 'D', cd: 0.40, area: 2.30, preco: 22000,  tier: 1, cor: '#2c7a7b', marchas: [3.55, 2.05, 1.38, 1.00, 0.80], final: 4.1 },
  { id: 'cometa',   nome: 'Cometa 1.6 Sedã',   tipo: 'sedan',  hp: 112, peso: 1090, redline: 6800, pico: 5900, tracao: 'D', cd: 0.32, area: 2.05, preco: 28000,  tier: 2, cor: '#2b6cb0', marchas: [3.45, 1.94, 1.31, 1.03, 0.84], final: 4.0 },
  { id: 'brisa',    nome: 'Brisa GTi 2.0',     tipo: 'hatch',  hp: 156, peso: 1140, redline: 7200, pico: 6400, tracao: 'D', cd: 0.33, area: 2.00, preco: 45000,  tier: 2, cor: '#f6e05e', marchas: [3.36, 2.07, 1.46, 1.10, 0.89], final: 3.9 },
  { id: 'corsario', nome: 'Corsário V8',       tipo: 'muscle', hp: 305, peso: 1560, redline: 6200, pico: 5300, tracao: 'T', cd: 0.38, area: 2.20, preco: 90000,  tier: 3, cor: '#1a202c', marchas: [2.97, 1.94, 1.34, 1.00, 0.77], final: 3.55 },
  { id: 'falcao',   nome: 'Falcão 2.0 Coupé',  tipo: 'coupe',  hp: 205, peso: 1250, redline: 7600, pico: 6800, tracao: 'T', cd: 0.31, area: 1.95, preco: 70000,  tier: 3, cor: '#e2e8f0', marchas: [3.25, 2.06, 1.45, 1.10, 0.86], final: 4.1 },
  { id: 'raio',     nome: 'Raio GT',           tipo: 'coupe',  hp: 410, peso: 1380, redline: 8000, pico: 7300, tracao: 'T', cd: 0.30, area: 1.90, preco: 180000, tier: 4, cor: '#dd6b20', marchas: [3.10, 2.10, 1.55, 1.22, 1.00, 0.84], final: 3.7 },
];
export const TIER_MULT = { 1: 1, 2: 1.35, 3: 1.9, 4: 2.8 };

// Turbos: pressão máxima (bar) e faixa de enchimento (fração da rotação máxima).
export const TURBOS = [
  { nome: 'Turbo pequeno', max: 0.6, enche: [0.30, 0.48] },
  { nome: 'Turbo médio',   max: 1.0, enche: [0.40, 0.62] },
  { nome: 'Turbo grande',  max: 1.6, enche: [0.52, 0.76] },
];

export const UPGRADES = {
  motor:     { nome: 'Preparação interna',  icone: '🔧', desc: 'Pistões forjados e comando bravo: +potência e aguenta mais pressão.', niveis: [1800, 4500, 10000] },
  admissao:  { nome: 'Admissão esportiva',  icone: '🌪️', desc: 'Filtro cônico e coletor: +4% de potência por nível.', niveis: [600, 1500] },
  escape:    { nome: 'Escape esportivo',    icone: '📯', desc: 'Coletor dimensionado e abafador reto: +5% por nível.', niveis: [800, 2000] },
  turbo:     { nome: 'Kit turbo',           icone: '🐌', desc: 'Pequeno enche cedo, grande dá mais pressão mas enche tarde.', niveis: [3500, 8000, 16000] },
  ecu:       { nome: 'Injeção programável', icone: '💻', desc: 'Libera o mapa: pressão, avanço e mistura no dinamômetro.', niveis: [2500] },
  cambio:    { nome: 'Câmbio de engate rápido', icone: '🕹️', desc: 'Trocas de marcha mais rápidas.', niveis: [1500, 4000] },
  pneus:     { nome: 'Pneus esportivos',    icone: '🛞', desc: 'Mais aderência na largada: rua, semi-slick e slick.', niveis: [1200, 3000, 6000] },
  suspensao: { nome: 'Suspensão de arrancada', icone: '🪜', desc: 'Transfere peso para as rodas de tração e rebaixa o carro.', niveis: [1000, 2500] },
  peso:      { nome: 'Alívio de peso',      icone: '🪶', desc: 'Tira banco traseiro, forro e põe capô de fibra.', niveis: [1500, 4000] },
  nitro:     { nome: 'Kit de nitro',        icone: '🧪', desc: 'Uma carga por corrida: +40% de potência por 3 segundos.', niveis: [3000] },
  aerofolio: { nome: 'Aerofólio',           icone: '🪽', desc: 'Puro estilo. Mas fica bonito.', niveis: [700] },
};
export const LISTA_UPGRADES = Object.keys(UPGRADES);

export const EQUIPAMENTOS = {
  scanner:  { nome: 'Scanner automotivo', icone: '📟', preco: 1500, desc: 'Diagnostica motor, elétrica e arrefecimento de uma vez em 10 min.' },
  elevador: { nome: 'Elevador',           icone: '🏗️', preco: 3200, desc: 'Diagnostica freios, suspensão, rodas, câmbio e escape de uma vez em 10 min.' },
  chave:    { nome: 'Chave de impacto',   icone: '🔫', preco: 2200, desc: 'Trocas 35% mais rápidas e aperto mais fácil.' },
  vaga2:    { nome: 'Segunda vaga',       icone: '🅿️', preco: 5000, desc: '+1 cliente por dia.' },
  vaga3:    { nome: 'Terceira vaga',      icone: '🅿️', preco: 9000, desc: '+1 cliente por dia.', requer: 'vaga2' },
  pintura:  { nome: 'Cabine de pintura',  icone: '🎨', preco: 2500, desc: 'Permite pintar seus carros de qualquer cor.' },
};

export const CORES = ['#c0392b', '#e53e3e', '#dd6b20', '#f6e05e', '#38a169', '#2c7a7b', '#2b6cb0', '#553c9a', '#d53f8c', '#1a202c', '#718096', '#e2e8f0'];

export const RIVAIS = [
  { nome: 'Zé Tranqueira',  frase: 'Meu Rubi é original de fábrica!',        modelo: 'rubi',     ups: {}, cond: 45,                                                       entrada: 150,  premio: 500 },
  { nome: 'Dona Cida',      frase: 'A picape do meu falecido é brava.',      modelo: 'mula',     ups: { escape: 1, admissao: 1 },                                 entrada: 300,  premio: 950 },
  { nome: 'Toninho Cometa', frase: 'Sedã também corre, parceiro.',           modelo: 'cometa',   ups: { escape: 1, admissao: 1, pneus: 1 },                       entrada: 600,  premio: 1800 },
  { nome: 'Lia Nitro',      frase: 'Pisca e eu já passei.',                  modelo: 'brisa',    ups: { escape: 1, admissao: 2, pneus: 1, nitro: 1 },             entrada: 1200, premio: 3600 },
  { nome: 'Marcão Turbo',   frase: 'Escuta essa válvula espirrando...',      modelo: 'cometa',   ups: { turbo: 2, ecu: 1, motor: 1, pneus: 2, escape: 2, cambio: 1 }, ecu: { boost: 1.0, ign: 2, afr: 12.4 }, entrada: 2500, premio: 7500 },
  { nome: 'Barão',          frase: 'Oito cilindros não se discute.',         modelo: 'corsario', ups: { motor: 2, escape: 2, admissao: 2, pneus: 2, suspensao: 2, cambio: 1 }, entrada: 5000, premio: 15000 },
  { nome: 'Fantasma',       frase: 'Ninguém viu meu carro de frente.',       modelo: 'raio',     ups: { motor: 3, turbo: 2, ecu: 1, escape: 2, admissao: 2, pneus: 3, suspensao: 2, cambio: 2, peso: 2, nitro: 1 }, ecu: { boost: 1.0, ign: 3, afr: 12.4 }, entrada: 10000, premio: 40000 },
];

export const NOMES = ['Seu Jorge', 'Dona Marta', 'Carlinhos', 'Patrícia', 'Rafa', 'Tio Beto', 'Juliana', 'Sr. Almeida', 'Bruna', 'Fernando', 'Dona Lurdes', 'Pedrão', 'Kátia', 'Vini', 'Dr. Souza', 'Neide', 'Gabi', 'Cláudio', 'Rose', 'Thiago'];
