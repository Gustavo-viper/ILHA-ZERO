// Sons sintetizados com Web Audio (nada para baixar, funciona offline).
let ac = null, motor = null;
export const som = { ligado: true };

function ctx() {
  if (!som.ligado) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function bip(freq = 660, dur = 0.08, tipo = 'square', vol = 0.08) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = tipo; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}

export function chave() { bip(180, 0.05, 'sawtooth', 0.06); setTimeout(() => bip(240, 0.05, 'sawtooth', 0.05), 60); }
export function dinheiro() { bip(880, 0.07, 'triangle', 0.1); setTimeout(() => bip(1320, 0.12, 'triangle', 0.1), 80); }
export function erro() { bip(140, 0.25, 'square', 0.08); }

export function motorLigar(cilindros = 4) {
  const a = ctx(); if (!a || motor) return;
  const o1 = a.createOscillator(), o2 = a.createOscillator();
  const f = a.createBiquadFilter(), g = a.createGain();
  o1.type = 'sawtooth'; o2.type = 'square';
  f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 4;
  g.gain.value = 0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(a.destination);
  o1.start(); o2.start();
  motor = { o1, o2, f, g, cil: cilindros };
  g.gain.linearRampToValueAtTime(0.07, a.currentTime + 0.2);
}

export function motorRpm(rpm, carga = 1) {
  if (!motor || !ac) return;
  const hz = rpm / 60 * motor.cil / 2;
  const t = ac.currentTime;
  motor.o1.frequency.setTargetAtTime(hz, t, 0.02);
  motor.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.02);
  motor.f.frequency.setTargetAtTime(400 + rpm * 0.25 * (0.5 + carga), t, 0.03);
  motor.g.gain.setTargetAtTime(0.04 + 0.05 * carga, t, 0.05);
}

export function motorDesligar() {
  if (!motor || !ac) return;
  const m = motor; motor = null;
  m.g.gain.setTargetAtTime(0, ac.currentTime, 0.1);
  setTimeout(() => { try { m.o1.stop(); m.o2.stop(); } catch (e) { /* já parado */ } }, 500);
}
