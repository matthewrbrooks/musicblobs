let ctx = null;
let reverbNode = null;

export function ensureAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    // Safari needs a silent buffer played immediately to warm up the audio pipeline,
    // otherwise the first real sound has noticeable latency.
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function getReverb() {
  if (reverbNode) return reverbNode;
  const ac = ensureAudio();
  const len = ac.sampleRate * 1.4;
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  }
  reverbNode = ac.createConvolver();
  reverbNode.buffer = buf;
  reverbNode.connect(ac.destination);
  return reverbNode;
}
