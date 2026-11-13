// Personagens humanos realistas: modelo 3D com esqueleto (49 ossos) e animações
// (parado / andando / correndo) misturadas suavemente conforme a velocidade.
// Modelo: soldado "Vanguard" dos exemplos do three.js (criado no Mixamo).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

let base = null, clips = null, loading = null;
const VARIANT_TINTS = [0xffffff, 0xb7c49a, 0xd6c7a4, 0xa9b6c8, 0x8f8f86, 0xc9a98f];
const variantMats = new Map();

export function loadSoldier(url = './models/soldier.glb') {
  if (!loading) {
    // hospedagens que não servem .glb podem fornecer o modelo embutido num módulo JS
    const src = window.IZ_SOLDIER_MODULE ? import(window.IZ_SOLDIER_MODULE).then((m) => m.default) : Promise.resolve(url);
    loading = src.then((u) => new GLTFLoader().loadAsync(u)).then((gltf) => {
      base = gltf.scene; clips = {};
      for (const c of gltf.animations) clips[c.name] = c;
      base.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
      return true;
    }).catch((e) => { console.warn('Modelo realista indisponível, usando personagem simples:', e); return false; });
  }
  return loading;
}
export const soldierReady = () => !!base;

function tintedMaterials(variant) {
  if (variantMats.has(variant)) return variantMats.get(variant);
  const map = new Map();
  base.traverse((o) => {
    if (!o.isMesh || map.has(o.material)) return;
    const m = o.material.clone();
    if (!/visor/i.test(m.name)) { m.color = new THREE.Color(VARIANT_TINTS[variant % VARIANT_TINTS.length]); m.roughness = 0.75; m.metalness = 0.05; }
    map.set(o.material, m);
  });
  variantMats.set(variant, map);
  return map;
}

/**
 * Cria um personagem realista. `makeGun(group)` recebe o grupo preso na mão direita
 * para adicionar os modelos de arma; `makeChute()` devolve o paraquedas.
 */
export function makeRealCharacter(seed, makeGun, makeChute) {
  const variant = Math.abs(seed | 0) % VARIANT_TINTS.length;
  const model = SkeletonUtils.clone(base);
  const mats = tintedMaterials(variant);
  model.traverse((o) => { if (o.isMesh) { o.material = mats.get(o.material) || o.material; o.castShadow = true; o.frustumCulled = false; } });
  // o modelo já olha para -Z (a frente do jogo)

  const root = new THREE.Group();
  const body = new THREE.Group(); // inclinações (queda livre, morte) sem brigar com a animação
  body.add(model); root.add(body);

  const bone = (n) => model.getObjectByName('mixamorig' + n);
  const bones = { spine: bone('Spine'), spine1: bone('Spine1'), spine2: bone('Spine2'), neck: bone('Neck'), head: bone('Head'), rHand: bone('RightHand'),
    rArm: bone('RightArm'), lArm: bone('LeftArm'), rFore: bone('RightForeArm'), lFore: bone('LeftForeArm') };

  // arma na mão direita (compensa a escala do esqueleto)
  const gun = new THREE.Group();
  if (bones.rHand) {
    root.updateMatrixWorld(true);
    const ws = new THREE.Vector3(); bones.rHand.getWorldScale(ws);
    gun.scale.setScalar(1 / ws.x);
    gun.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    gun.position.set(0, 9, 3);
    bones.rHand.add(gun);
  }
  const guns = makeGun(gun);
  const chute = makeChute(); chute.position.y = 1.4; chute.visible = false; root.add(chute);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const k of ['Idle', 'Walk', 'Run']) { const a = mixer.clipAction(clips[k]); a.play(); a.setEffectiveWeight(k === 'Idle' ? 1 : 0); actions[k] = a; }
  // fases aleatórias: ninguém anda sincronizado
  for (const a of Object.values(actions)) a.time = Math.random() * a.getClip().duration;

  root.userData = { real: true, mixer, actions, bones, body, model, gun, guns, chute, w: { Idle: 1, Walk: 0, Run: 0 }, deadT: 0, frame: Math.random() * 4 | 0 };
  return root;
}

const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpE = new THREE.Euler(0, 0, 0, 'YXZ'), axX = new THREE.Vector3(1, 0, 0), axY = new THREE.Vector3(0, 1, 0);

export function poseRealCharacter(ch, st, dt, camDist = 0) {
  const u = ch.userData;
  const falling = st.state === 'air', chuting = st.state === 'chute';
  u.chute.visible = chuting;
  for (const k in u.guns) u.guns[k].visible = k === st.weapon && !falling && !chuting && !st.dead;

  // pesos alvo das animações
  const sp = st.speed || 0;
  let tw;
  if (st.dead || falling || chuting) tw = { Idle: 1, Walk: 0, Run: 0 };
  else if (sp < 0.4) tw = { Idle: 1, Walk: 0, Run: 0 };
  else if (sp < 5.2) { const k = Math.min(1, (sp - 0.4) / 1.6); tw = { Idle: 1 - k, Walk: k, Run: 0 }; }
  else { const k = Math.min(1, (sp - 5.2) / 1.5); tw = { Idle: 0, Walk: 1 - k, Run: k }; }
  const blend = Math.min(1, dt * 8);
  for (const k in tw) { u.w[k] += (tw[k] - u.w[k]) * blend; u.actions[k].setEffectiveWeight(u.w[k]); }
  u.actions.Walk.timeScale = Math.max(0.6, Math.min(1.6, sp / 2.2));
  u.actions.Run.timeScale = Math.max(0.8, Math.min(1.3, sp / 6.5));
  if (st.crouch) u.actions.Walk.timeScale *= 0.7;

  // longe da câmera atualiza menos (economia de CPU)
  u.frame++;
  const every = camDist > 160 ? 6 : camDist > 70 ? 2 : 1;
  const tweak = [u.bones.spine1, u.bones.spine2, u.bones.neck, u.bones.rArm, u.bones.lArm, u.bones.rFore].filter(Boolean);
  if (u.frame % every === 0 && !(st.dead && u.deadT > 1.2)) {
    u.mixer.update(dt * every);
    u.saved = tweak.map((bn) => bn.quaternion.clone()); // pose base desta animação
  } else if (u.saved) tweak.forEach((bn, i) => bn.quaternion.copy(u.saved[i])); // evita acumular ajustes

  // corpo: queda livre deitado, morte tombando, agachado mais baixo
  if (st.dead) { u.deadT += dt; const k = Math.min(1, u.deadT * 2.2); u.body.rotation.x = -Math.PI / 2 * k; u.body.position.y = 0.15 * k; }
  else { u.deadT = 0; u.body.rotation.x = falling ? -1.25 : 0; u.body.position.y = 0; }
  u.body.scale.y = st.crouch && !st.dead ? 0.78 : 1;

  // mira: inclina coluna/cabeça para o pitch e levanta os braços segurando a arma
  const b = u.bones;
  if (!st.dead && !falling && !chuting) {
    const p = st.pitch || 0;
    if (b.spine1) b.spine1.quaternion.multiply(tmpQ.setFromAxisAngle(axX, -p * 0.4));
    if (b.spine2) b.spine2.quaternion.multiply(tmpQ.setFromAxisAngle(axX, -p * 0.3));
    if (b.neck) b.neck.quaternion.multiply(tmpQ.setFromAxisAngle(axX, -p * 0.3));
    if (st.weapon && st.aiming) {
      if (b.rArm) b.rArm.quaternion.multiply(tmpQ.setFromAxisAngle(axX, 0.9));
      if (b.rFore) b.rFore.quaternion.multiply(tmpQ.setFromAxisAngle(axY, -0.5));
    }
  }
  // mirando: o cano aponta exatamente para onde o jogador mira (a mão segue a animação)
  if (u.gun.parent && st.weapon && st.aiming && !st.dead && !falling && !chuting) {
    ch.updateMatrixWorld(true);
    u.gun.parent.getWorldQuaternion(tmpQ2).invert();
    tmpQ.setFromEuler(tmpE.set(st.pitch || 0, ch.rotation.y, 0));
    u.gun.quaternion.copy(tmpQ2.multiply(tmpQ));
  } else u.gun.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  if (chuting) {
    if (b.rArm) b.rArm.quaternion.multiply(tmpQ.setFromAxisAngle(axX, -1.2));
    if (b.lArm) b.lArm.quaternion.multiply(tmpQ.setFromAxisAngle(axX, -1.2));
  }
}
