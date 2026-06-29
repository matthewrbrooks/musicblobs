import { ensureAudio, getReverb } from './context.js';

export const DRUM_COLORS = ['#ff5577', '#ff9944', '#44ddff', '#88ff44'];
export const DRUM_LABELS = ['Kick', 'Snare', 'Hat', 'Clap'];

export function playKick(ps = 1) {
  const ac = ensureAudio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.frequency.setValueAtTime(160 * ps, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40 * ps, ac.currentTime + 0.35);
  gain.gain.setValueAtTime(1.2, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
  osc.start(); osc.stop(ac.currentTime + 0.42);
}

export function playSnare(ps = 1) {
  const ac = ensureAudio();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 2200 * ps; filter.Q.value = 0.7;
  const gain = ac.createGain();
  src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
  gain.gain.setValueAtTime(0.9, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
  const osc = ac.createOscillator();
  const g2 = ac.createGain();
  osc.frequency.value = 200 * ps; osc.connect(g2); g2.connect(ac.destination);
  g2.gain.setValueAtTime(0.4, ac.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
  src.start(); osc.start(); src.stop(ac.currentTime + 0.22); osc.stop(ac.currentTime + 0.14);
}

export function playHihat(ps = 1) {
  const ac = ensureAudio();
  const buf = ac.createBuffer(1, ac.sampleRate * 0.08, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 8000 * ps;
  const gain = ac.createGain();
  src.connect(hp); hp.connect(gain); gain.connect(ac.destination);
  gain.gain.setValueAtTime(0.5, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07);
  src.start(); src.stop(ac.currentTime + 0.09);
}

export function playClap(ps = 1) {
  const ac = ensureAudio();
  for (let i = 0; i < 3; i++) {
    const buf = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200 * ps; bp.Q.value = 0.5;
    const gain = ac.createGain();
    const t = ac.currentTime + i * 0.018;
    src.connect(bp); bp.connect(gain);
    gain.connect(getReverb()); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.start(t); src.stop(t + 0.08);
  }
}

export const DRUM_FNS = [playKick, playSnare, playHihat, playClap];
