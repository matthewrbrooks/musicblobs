import { ensureAudio, getReverb } from './context.js';

export const NOTE_FREQS  = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
export const NOTE_NAMES  = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'];
export const NOTE_COLORS = ['#cc66ff','#9966ff','#6699ff','#44bbff','#44ffcc','#88ff66','#ffee44','#ff8844'];

export function playNote(freq, ps = 1) {
  const ac = ensureAudio();
  const f = freq * ps;
  const osc = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle'; osc.frequency.value = f;
  osc2.type = 'sine'; osc2.frequency.value = f * 2.01;
  const g2 = ac.createGain(); g2.gain.value = 0.3;
  osc.connect(gain); osc2.connect(g2); g2.connect(gain);
  gain.connect(getReverb()); gain.connect(ac.destination);
  gain.gain.setValueAtTime(0.0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.55, ac.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.9);
  osc.start(); osc2.start(); osc.stop(ac.currentTime + 0.95); osc2.stop(ac.currentTime + 0.95);
}
