import { ensureAudio, getReverb } from './context.js';

export const FACE_ZONES    = ['Left eye','Right eye','Nose','Mouth','Forehead','Left cheek','Right cheek','Lock','Record'];
export const FACE_COLORS   = ['#ff66cc','#cc44ff','#ff8844','#33ffaa','#ffffff','#ffee44','#44ccff','#ffdd44','#ff44aa'];
export const VOCAL_INDICES = [0, 1, 4, 5, 6];

export function playVocal(index, ps = 1) {
  const ac = ensureAudio();
  const t = ac.currentTime;
  switch (index % 7) {
    case 0: playOoh(ac, t, 400, ps); break;
    case 1: playOoh(ac, t, 600, ps); break;
    case 2: playNoseZap(ac, t, ps); break;
    case 3: playAah(ac, t, ps); break;
    case 4: playWow(ac, t, ps); break;
    case 5: playWeird(ac, t, 0, ps); break;
    case 6: playWeird(ac, t, 1, ps); break;
  }
}

function playOoh(ac, t, baseFreq, ps) {
  const bf = baseFreq * ps;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(bf * 0.5, t);
  osc.frequency.linearRampToValueAtTime(bf, t + 0.08);
  osc.frequency.linearRampToValueAtTime(bf * 1.05, t + 0.3);
  osc.frequency.linearRampToValueAtTime(bf * 0.97, t + 0.6);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.45, t + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  osc.connect(gain); gain.connect(getReverb()); gain.connect(ac.destination);
  osc.start(t); osc.stop(t + 0.75);
}

function playAah(ac, t, ps) {
  const osc = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 330 * ps;
  osc2.type = 'sawtooth'; osc2.frequency.value = 331 * ps;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(800, t);
  lp.frequency.linearRampToValueAtTime(2200, t + 0.15);
  lp.frequency.linearRampToValueAtTime(900, t + 0.5);
  osc.connect(lp); osc2.connect(lp); lp.connect(gain);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  gain.connect(getReverb()); gain.connect(ac.destination);
  osc.start(t); osc2.start(t); osc.stop(t + 0.7); osc2.stop(t + 0.7);
}

function playNoseZap(ac, t, ps) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200 * ps, t);
  osc.frequency.exponentialRampToValueAtTime(60 * ps, t + 0.25);
  gain.gain.setValueAtTime(0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(t); osc.stop(t + 0.3);
}

function playWow(ac, t, ps) {
  const osc = ac.createOscillator();
  const lp = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = 'sawtooth'; osc.frequency.value = 110 * ps;
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(3000, t + 0.18);
  lp.frequency.linearRampToValueAtTime(300, t + 0.5);
  osc.connect(lp); lp.connect(gain);
  gain.gain.setValueAtTime(0.35, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  gain.connect(getReverb()); gain.connect(ac.destination);
  osc.start(t); osc.stop(t + 0.65);
}

function playWeird(ac, t, type, ps) {
  const carrier = ac.createOscillator();
  const modulator = ac.createOscillator();
  const modGain = ac.createGain();
  const gain = ac.createGain();
  carrier.type = 'sine';
  modulator.type = 'sine';
  if (type === 0) {
    carrier.frequency.value = 280 * ps; modulator.frequency.value = 140 * ps; modGain.gain.value = 200;
  } else {
    carrier.frequency.value = 440 * ps; modulator.frequency.value = 220 * ps; modGain.gain.value = 350;
    carrier.frequency.linearRampToValueAtTime(880 * ps, t + 0.4);
  }
  modulator.connect(modGain); modGain.connect(carrier.frequency);
  carrier.connect(gain);
  gain.gain.setValueAtTime(0.4, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
  gain.connect(getReverb()); gain.connect(ac.destination);
  carrier.start(t); modulator.start(t); carrier.stop(t + 0.7); modulator.stop(t + 0.7);
}
