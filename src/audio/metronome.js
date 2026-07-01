import { ensureAudio } from './context.js';
export function playWoodblock(accent) {
  const ac = ensureAudio();
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  const baseFreq = accent ? 1500 : 1100;
  const endFreq  = accent ? 1000 : 760;
  osc.frequency.setValueAtTime(baseFreq, t);
  osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.05);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(accent ? 0.24 : 0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(gain); gain.connect(ac.destination);
  osc.start(t); osc.stop(t + 0.1);
  const nbuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.015), ac.sampleRate);
  const nd = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
  const noise = ac.createBufferSource(); noise.buffer = nbuf;
  const ng = ac.createGain(); ng.gain.value = accent ? 0.10 : 0.06;
  noise.connect(ng); ng.connect(ac.destination);
  noise.start(t); noise.stop(t + 0.02);
}
