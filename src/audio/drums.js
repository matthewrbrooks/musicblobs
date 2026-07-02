import { ensureAudio, getReverb } from './context.js';

export const DRUM_COLORS = ['#ff5577', '#44ddff', '#ff9944', '#88ff44'];
export const DRUM_LABELS = ['Kick', 'Hat', 'Snare', 'Clap'];

// Pre-generated noise buffers — created once on first audio use, reused every hit.
// AudioBuffer is read-only data; multiple BufferSourceNodes can share the same buffer.
let _snareBuf = null, _hihatBuf = null, _clapBufs = null;

function makeNoise(ac, dur) {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Returns a random multiplier centred on 1, spanning ±(range/2)
function pitchVar(range) { return 1 - range * 0.5 + Math.random() * range; }

function ensureNoiseBufs(ac) {
  if (!_snareBuf) {
    _snareBuf = makeNoise(ac, 0.2);
    _hihatBuf = makeNoise(ac, 0.08);
    _clapBufs = [makeNoise(ac, 0.05), makeNoise(ac, 0.05), makeNoise(ac, 0.05)];
  }
}

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
  ensureNoiseBufs(ac);
  const pv = pitchVar(0.06);
  const src = ac.createBufferSource();
  src.buffer = _snareBuf;
  src.playbackRate.value = pv;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 2200 * ps; filter.Q.value = 0.7;
  const gain = ac.createGain();
  src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
  gain.gain.setValueAtTime(0.9, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
  const osc = ac.createOscillator();
  const g2 = ac.createGain();
  osc.frequency.value = 200 * ps * pv; osc.connect(g2); g2.connect(ac.destination);
  g2.gain.setValueAtTime(0.4, ac.currentTime);
  g2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
  src.start(); osc.start(); src.stop(ac.currentTime + 0.22); osc.stop(ac.currentTime + 0.14);
}

export function playHihat(ps = 1) {
  const ac = ensureAudio();
  ensureNoiseBufs(ac);
  const src = ac.createBufferSource();
  src.buffer = _hihatBuf;
  src.playbackRate.value = pitchVar(0.10);
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
  ensureNoiseBufs(ac);
  for (let i = 0; i < 3; i++) {
    const src = ac.createBufferSource();
    src.buffer = _clapBufs[i];
    src.playbackRate.value = pitchVar(0.08);
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

export const DRUM_FNS = [playKick, playHihat, playSnare, playClap];
