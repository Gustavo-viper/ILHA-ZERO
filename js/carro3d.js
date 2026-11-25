// Carro 3D low-poly com peças desmontáveis (cada peça tem seus parafusos).
import * as THREE from '../vendor/three/three.module.min.js';
import { modelo } from './fisica.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Ordem de desmontagem: para tirar a peça, as da lista precisam estar fora.
export const DEPENDE = {
  motor: ['velas', 'filtroAr', 'correia'],
  velas: ['filtroAr'],
  embreagem: ['escapamento'],
  pastilhas: ['pneus'],
  amortecedores: ['pneus'],
  discos: ['pastilhas'],
};
// Para montar a peça, as que dependem dela precisam estar no lugar.
export function bloqueiaMontagem(peca, fora) {
  return Object.keys(DEPENDE).filter(q => DEPENDE[q].includes(peca) && fora[q]);
}
export function bloqueiaDesmontagem(peca, fora) {
  return (DEPENDE[peca] || []).filter(q => !fora[q]);
}

function material(cor, r = 0.6, m = 0.2, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: cor, roughness: r, metalness: m, ...extra });
}
function caixa(g, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  g.add(m); return m;
}
// Cilindro com eixo 'x', 'y' ou 'z'.
function cilindro(g, r1, r2, h, mat, x, y, z, eixo = 'y', seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  if (eixo === 'x') m.rotation.z = Math.PI / 2;
  if (eixo === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z); m.castShadow = true;
  g.add(m); return m;
}

const GEO_PARAFUSO = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6);
const Y = V(0, 1, 0);
function parafuso(grupo, pos, normal) {
  const m = new THREE.Mesh(GEO_PARAFUSO, material('#c9ced6', 0.3, 0.9));
  m.quaternion.setFromUnitVectors(Y, normal.clone().normalize());
  m.position.copy(pos);
  m.userData = { parafuso: true, casa: pos.clone(), normal: normal.clone().normalize() };
  grupo.add(m);
  grupo.userData.parafusos.push(m);
  return m;
}

function novaPeca(nome, centro, saida) {
  const g = new THREE.Group();
  g.name = nome;
  g.userData = { peca: nome, parafusos: [], centro, saida };
  return g;
}

// Constrói cada peça na posição em que fica montada (coordenadas do carro).
function construirPecas(cor) {
  const P = {};
  const metal = () => material('#5c6470', 0.45, 0.7);
  const preto = () => material('#1d1f24', 0.8, 0.1);

  // Motor
  let g = P.motor = novaPeca('motor', V(1.25, 0.75, 0), V(0, 1, 0));
  caixa(g, 0.6, 0.42, 0.55, metal(), 1.25, 0.66, 0);
  caixa(g, 0.56, 0.1, 0.44, material('#9b2c2c', 0.4, 0.5), 1.25, 0.92, 0);
  caixa(g, 0.5, 0.08, 0.06, metal(), 1.25, 0.62, 0.3);
  caixa(g, 0.5, 0.08, 0.06, metal(), 1.25, 0.62, -0.3);
  for (const x of [1.02, 1.48]) for (const z of [-0.18, 0.18]) parafuso(g, V(x, 0.985, z), Y);

  // Velas (cachimbos vermelhos sobre a tampa)
  g = P.velas = novaPeca('velas', V(1.25, 1.0, 0), V(0, 1, 0));
  for (const x of [1.1, 1.2, 1.3, 1.4]) {
    cilindro(g, 0.022, 0.022, 0.08, material('#e53e3e', 0.5, 0.1), x, 1.0, 0);
    parafuso(g, V(x, 1.055, 0), Y);
  }

  // Filtro de ar (caixa por cima das velas)
  g = P.filtroAr = novaPeca('filtroAr', V(1.25, 1.12, 0), V(0, 1, 0));
  caixa(g, 0.48, 0.09, 0.3, preto(), 1.25, 1.12, 0);
  cilindro(g, 0.05, 0.05, 0.3, preto(), 1.25, 1.1, -0.3, 'z');
  parafuso(g, V(1.06, 1.18, 0), Y);
  parafuso(g, V(1.44, 1.18, 0), Y);

  // Filtro de óleo (laranja, na lateral do bloco)
  g = P.oleo = novaPeca('oleo', V(1.4, 0.58, -0.34), V(0, 0, -1));
  cilindro(g, 0.055, 0.055, 0.13, material('#dd6b20', 0.5, 0.2), 1.4, 0.58, -0.34, 'z');
  parafuso(g, V(1.4, 0.58, -0.42), V(0, 0, -1));

  // Correia dentada e polias (na frente do motor)
  g = P.correia = novaPeca('correia', V(1.6, 0.66, -0.12), V(1, 0.4, 0));
  cilindro(g, 0.085, 0.085, 0.04, metal(), 1.6, 0.52, 0, 'x');
  cilindro(g, 0.05, 0.05, 0.04, metal(), 1.6, 0.8, -0.25, 'x');
  const curva = new THREE.CatmullRomCurve3([V(1.6, 0.43, 0), V(1.6, 0.52, 0.09), V(1.6, 0.62, 0.05), V(1.6, 0.84, -0.2),
    V(1.6, 0.82, -0.3), V(1.6, 0.74, -0.29), V(1.6, 0.5, -0.08)], true);
  const correia = new THREE.Mesh(new THREE.TubeGeometry(curva, 60, 0.012, 6, true), material('#111', 0.9, 0));
  g.add(correia);
  parafuso(g, V(1.63, 0.66, 0.1), V(1, 0, 0));

  // Alternador
  g = P.alternador = novaPeca('alternador', V(1.48, 0.8, -0.25), V(0, 1, 0));
  cilindro(g, 0.085, 0.085, 0.16, material('#a0aec0', 0.35, 0.8), 1.48, 0.8, -0.25, 'x');
  parafuso(g, V(1.48, 0.89, -0.25), Y);
  parafuso(g, V(1.48, 0.8, -0.34), V(0, 0, -1));

  // Bateria
  g = P.bateria = novaPeca('bateria', V(0.95, 0.52, 0.52), V(0, 1, 0));
  caixa(g, 0.3, 0.22, 0.18, material('#222831', 0.7, 0.1), 0.95, 0.5, 0.52);
  caixa(g, 0.3, 0.02, 0.18, material('#3182ce', 0.5, 0.1), 0.95, 0.62, 0.52);
  cilindro(g, 0.018, 0.018, 0.04, material('#e53e3e'), 0.86, 0.64, 0.52);
  cilindro(g, 0.018, 0.018, 0.04, material('#111'), 1.04, 0.64, 0.52);
  parafuso(g, V(0.86, 0.67, 0.52), Y);
  parafuso(g, V(1.04, 0.67, 0.52), Y);

  // Radiador
  g = P.radiador = novaPeca('radiador', V(1.9, 0.64, 0), V(0, 1, 0));
  caixa(g, 0.06, 0.42, 1.2, material('#2d3748', 0.6, 0.4), 1.9, 0.64, 0);
  caixa(g, 0.065, 0.36, 1.1, material('#4a5568', 0.9, 0.2, { wireframe: false }), 1.9, 0.64, 0);
  parafuso(g, V(1.9, 0.87, 0.5), Y);
  parafuso(g, V(1.9, 0.87, -0.5), Y);

  // Escapamento (por baixo)
  g = P.escapamento = novaPeca('escapamento', V(-0.5, 0.24, -0.3), V(0, -1, 0));
  const cano = new THREE.CatmullRomCurve3([V(1.25, 0.5, -0.3), V(1.05, 0.28, -0.3), V(0.6, 0.24, -0.3), V(-2.2, 0.24, -0.3)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cano, 40, 0.032, 8, false), material('#718096', 0.4, 0.8)));
  caixa(g, 0.6, 0.14, 0.3, material('#4a5568', 0.5, 0.7), -1.3, 0.22, -0.3);
  for (const x of [0.6, -0.8, -1.8]) parafuso(g, V(x, 0.195, -0.3), V(0, -1, 0));

  // Embreagem (capa seca, atrás do motor, por baixo)
  g = P.embreagem = novaPeca('embreagem', V(0.82, 0.48, 0), V(0, -1, 0));
  cilindro(g, 0.17, 0.2, 0.22, material('#a0aec0', 0.5, 0.6), 0.82, 0.48, 0, 'x');
  for (const x of [0.76, 0.88]) for (const z of [-0.08, 0.08]) parafuso(g, V(x, 0.29, z), V(0, -1, 0));

  // Pneus: as 4 rodas
  g = P.pneus = novaPeca('pneus', V(1.35, 0.32, 0.86), V(0, 0, 1));
  const aro = material('#cbd5e0', 0.3, 0.9);
  for (const x of [1.35, -1.35]) for (const s of [1, -1]) {
    const roda = new THREE.Group();
    roda.userData.saida = V(0, 0, s);
    const pneu = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 28), material('#16181c', 0.95, 0));
    pneu.rotation.x = Math.PI / 2; pneu.castShadow = true;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.225, 10), aro);
    r.rotation.x = Math.PI / 2;
    roda.add(pneu, r);
    roda.position.set(x, 0.32, s * 0.86);
    g.add(roda);
    parafuso(g, V(x, 0.32, s * 0.975), V(0, 0, s));
  }

  // Freio dianteiro esquerdo: disco e pastilhas (pinça)
  g = P.discos = novaPeca('discos', V(1.35, 0.32, 0.72), V(0, 0, 1));
  cilindro(g, 0.2, 0.2, 0.03, material('#8a9099', 0.35, 0.85), 1.35, 0.32, 0.72, 'z', 28);
  cilindro(g, 0.08, 0.08, 0.05, material('#4a5568', 0.5, 0.6), 1.35, 0.32, 0.72, 'z');
  parafuso(g, V(1.31, 0.32, 0.75), V(0, 0, 1));
  parafuso(g, V(1.39, 0.32, 0.75), V(0, 0, 1));

  g = P.pastilhas = novaPeca('pastilhas', V(1.22, 0.47, 0.72), V(0, 0, 1));
  caixa(g, 0.13, 0.1, 0.09, material('#e53e3e', 0.5, 0.3), 1.22, 0.47, 0.72);
  parafuso(g, V(1.17, 0.49, 0.78), V(0, 0, 1));
  parafuso(g, V(1.27, 0.49, 0.78), V(0, 0, 1));

  // Amortecedor (torre dianteira esquerda)
  g = P.amortecedores = novaPeca('amortecedores', V(1.35, 0.68, 0.58), V(0, 1, 0));
  cilindro(g, 0.045, 0.045, 0.32, material('#d69e2e', 0.4, 0.5), 1.35, 0.58, 0.58);
  cilindro(g, 0.018, 0.018, 0.2, material('#cbd5e0', 0.2, 0.9), 1.35, 0.82, 0.58);
  const mola = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16), material('#e53e3e'));
  for (let i = 0; i < 4; i++) { const k = mola.clone(); k.rotation.x = Math.PI / 2; k.position.set(1.35, 0.68 + i * 0.05, 0.58); g.add(k); }
  parafuso(g, V(1.35, 0.94, 0.58), Y);
  parafuso(g, V(1.35, 0.44, 0.64), V(0, 0, 1));

  for (const p of Object.values(P)) p.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return P;
}

// Carroceria simplificada por tipo de carro.
const FORMAS = {
  hatch:  { cab: [-1.95, 0.55], teto: 1.4 },
  sedan:  { cab: [-1.05, 0.55], teto: 1.38, porta: [-2.1, -1.05] },
  coupe:  { cab: [-0.95, 0.5], teto: 1.28, porta: [-2.1, -0.95] },
  muscle: { cab: [-0.9, 0.45], teto: 1.32, porta: [-2.1, -0.9] },
  pickup: { cab: [-0.55, 0.55], teto: 1.48, cacamba: [-2.1, -0.55] },
};

export function construirCarro(carro, { capoAberto = true } = {}) {
  const m = modelo(carro.modelo);
  const forma = FORMAS[m.tipo];
  const cor = carro.cor || m.cor;
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  const baixa = (carro.ups?.suspensao || 0) * 0.03;
  corpo.position.y = -baixa;
  raiz.add(corpo);

  const tinta = material(cor, 0.35, 0.4);
  const escuro = material('#15171b', 0.8, 0.2);
  const vidro = material('#1e3246', 0.1, 0.6, { transparent: true, opacity: 0.55 });

  // parte traseira e cabine
  caixa(corpo, 2.8, 0.55, 1.7, tinta, -0.7, 0.66, 0);
  const [c0, c1] = forma.cab;
  caixa(corpo, c1 - c0, forma.teto - 0.94, 1.5, vidro, (c0 + c1) / 2, (forma.teto + 0.94) / 2, 0);
  caixa(corpo, c1 - c0 - 0.3, 0.05, 1.52, tinta, (c0 + c1) / 2 - 0.08, forma.teto, 0);
  for (const x of [c0 + 0.03, c1 - 0.03]) for (const z of [-0.74, 0.74]) caixa(corpo, 0.06, forma.teto - 0.94, 0.04, tinta, x, (forma.teto + 0.94) / 2, z);
  if (forma.cacamba) {
    const [b0, b1] = forma.cacamba;
    caixa(corpo, b1 - b0, 0.22, 0.06, tinta, (b0 + b1) / 2, 1.04, 0.82);
    caixa(corpo, b1 - b0, 0.22, 0.06, tinta, (b0 + b1) / 2, 1.04, -0.82);
    caixa(corpo, 0.06, 0.22, 1.7, tinta, b0, 1.04, 0);
  }
  // frente: paralamas, para-choque, grade e torre de fogo (cofre aberto)
  for (const s of [1, -1]) {
    caixa(corpo, 1.35, 0.28, 0.1, tinta, 1.37, 0.81, s * 0.8);
    caixa(corpo, 0.25, 0.3, 0.1, tinta, 1.9, 0.53, s * 0.8);
    caixa(corpo, 0.22, 0.3, 0.1, tinta, 0.82, 0.53, s * 0.8);
  }
  caixa(corpo, 0.12, 0.32, 1.7, escuro, 2.06, 0.5, 0);
  caixa(corpo, 0.06, 0.28, 1.5, escuro, 2.02, 0.8, 0);
  caixa(corpo, 0.04, 0.55, 1.5, escuro, 0.7, 0.66, 0);
  const farol = material('#fefcbf', 0.2, 0.1, { emissive: '#fefcbf', emissiveIntensity: 0.6 });
  const lanterna = material('#e53e3e', 0.3, 0.1, { emissive: '#e53e3e', emissiveIntensity: 0.5 });
  for (const z of [-0.6, 0.6]) {
    caixa(corpo, 0.04, 0.1, 0.28, farol, 2.06, 0.82, z);
    caixa(corpo, 0.04, 0.1, 0.3, lanterna, -2.11, 0.82, z);
  }
  // capô articulado na base do para-brisa
  const capo = new THREE.Group();
  capo.position.set(0.7, 0.96, 0);
  caixa(capo, 1.38, 0.04, 1.66, tinta, 0.69, 0, 0);
  capo.rotation.z = capoAberto ? 1.62 : 0;
  corpo.add(capo);
  if (carro.ups?.aerofolio) {
    const topo = forma.cacamba ? 1.15 : forma.porta ? 1.0 : forma.teto;
    const xa = forma.cab[0] - (forma.porta || forma.cacamba ? 0.85 : -0.1);
    caixa(corpo, 0.3, 0.04, 1.6, escuro, xa, topo + 0.18, 0);
    for (const z of [-0.6, 0.6]) caixa(corpo, 0.06, 0.18, 0.04, escuro, xa, topo + 0.09, z);
  }
  if ((carro.ups?.motor || 0) + (carro.ups?.turbo || 0) >= 3) {
    const faixa = material('#f7fafc', 0.4, 0.2);
    for (const s of [1, -1]) caixa(corpo, 2.6, 0.06, 0.01, faixa, -0.7, 0.62, s * 0.856);
  }

  const pecas = construirPecas(cor);
  for (const g of Object.values(pecas)) corpo.add(g);
  raiz.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { raiz, corpo, pecas, capo };
}

export function descartar(obj) {
  obj.traverse(o => {
    if (o.isMesh) {
      if (o.geometry !== GEO_PARAFUSO) o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });
}

// Renderizador único para as "fotos" 3D dos carros nas listas.
let fotoR = null, fotoCena = null, fotoCam = null;
export function fotografar(canvas, carro) {
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || 140;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  try {
    if (!fotoR) {
      fotoR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      fotoR.outputColorSpace = THREE.SRGBColorSpace;
      fotoCena = new THREE.Scene();
      fotoCena.add(new THREE.HemisphereLight('#dfe8ff', '#30261c', 1.6));
      const sol = new THREE.DirectionalLight('#ffffff', 2.2); sol.position.set(4, 6, 5); fotoCena.add(sol);
      const chao = new THREE.Mesh(new THREE.CircleGeometry(3.4, 40), material('#2a2f38', 0.9, 0));
      chao.rotation.x = -Math.PI / 2; fotoCena.add(chao);
      fotoCam = new THREE.PerspectiveCamera(30, 2, 0.1, 50);
    }
  } catch (e) { return false; }
  fotoR.setPixelRatio(dpr);
  fotoR.setSize(w, h, false);
  fotoCam.aspect = w / h;
  const dist = 7.6 / Math.min(1.6, fotoCam.aspect) + 1;
  fotoCam.position.set(dist * 0.55, 2.6, dist * 0.8);
  fotoCam.lookAt(0, 0.55, 0);
  fotoCam.updateProjectionMatrix();
  const { raiz } = construirCarro(carro, { capoAberto: false });
  for (const p of Object.keys(carro.fora || {})) { const g = raiz.getObjectByName(p); if (g) g.visible = false; }
  fotoCena.add(raiz);
  fotoR.render(fotoCena, fotoCam);
  fotoCena.remove(raiz);
  descartar(raiz);
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, '#2a3140'); g.addColorStop(1, '#12161d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fotoR.domElement, 0, 0, canvas.width, canvas.height);
  return true;
}

export { THREE };
