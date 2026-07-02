import * as THREE from 'three';
import { wonkiness } from '../loop.js';
import { registerTweakable } from './debug.js';
import { consumeFeedbackActive } from './feedbackBus.js';
import { scene, camera, blobReg } from '../scene.js';
import { flashMesh } from './sceneEffects.js';

// TWEAKABLES (let so the debug panel can mutate them)
let FB_SCALE_PER_FRAME = 0.008;  // echo expands this fraction per frame at max wonk
let FB_TWIST_PER_FRAME = 0.003;  // radians of rotation added per frame at max wonk
let FB_ECHO_ALPHA      = 0.92;   // fraction of echo that survives each frame at max wonk
let FB_STAMP_ALPHA     = 0.75;   // opacity of fresh-frame stamp onto the feedback
let FB_FADE_ALPHA      = 0.07;   // alpha eaten per frame so echoes vanish fully
let FB_MAX_HUE_DEG     = 25;     // max CSS hue-rotate degrees at full wonk
let FB_MAX_SATURATE    = 2.8;    // max CSS saturate multiplier at full wonk
let FB_MAX_BLUR_PX     = 1.2;    // max CSS blur at full wonk

let feedbackCanvas, ctx, stageCanvas;
let inRenderer, inCanvas;

export function initFeedback() {
  stageCanvas = document.getElementById('stage-canvas');

  feedbackCanvas = document.createElement('canvas');
  feedbackCanvas.id = 'feedback-canvas';
  stageCanvas.parentElement.insertBefore(feedbackCanvas, stageCanvas);
  ctx = feedbackCanvas.getContext('2d');

  // Separate renderer for the feedback "in" pass — renders only sounding blobs
  inCanvas = document.createElement('canvas');
  inRenderer = new THREE.WebGLRenderer({ canvas: inCanvas, alpha: true, antialias: false });
  inRenderer.setPixelRatio(1);

  resizeFeedback();
  window.addEventListener('resize', resizeFeedback);

  registerTweakable('Scale/frame',  () => FB_SCALE_PER_FRAME, v => { FB_SCALE_PER_FRAME = v; }, 0.001, 0.05,  0.001);
  registerTweakable('Twist/frame',  () => FB_TWIST_PER_FRAME, v => { FB_TWIST_PER_FRAME = v; }, 0,     0.02,  0.0005);
  registerTweakable('Echo alpha',   () => FB_ECHO_ALPHA,      v => { FB_ECHO_ALPHA = v; },       0.7,   1.0,   0.005);
  registerTweakable('Stamp alpha',  () => FB_STAMP_ALPHA,     v => { FB_STAMP_ALPHA = v; },      0,     1,     0.01);
  registerTweakable('Fade alpha',   () => FB_FADE_ALPHA,      v => { FB_FADE_ALPHA = v; },       0,     0.3,   0.005);
  registerTweakable('Max hue deg',  () => FB_MAX_HUE_DEG,     v => { FB_MAX_HUE_DEG = v; },     0,     90,    1);
  registerTweakable('Max saturate', () => FB_MAX_SATURATE,    v => { FB_MAX_SATURATE = v; },     1,     5,     0.1);
  registerTweakable('Max blur px',  () => FB_MAX_BLUR_PX,     v => { FB_MAX_BLUR_PX = v; },     0,     5,     0.1);
}

export function resizeFeedback() {
  if (!feedbackCanvas) return;
  const w = stageCanvas.clientWidth;
  const h = stageCanvas.clientHeight;
  feedbackCanvas.width = w;
  feedbackCanvas.height = h;
  if (inRenderer) inRenderer.setSize(w, h, false);
}

export function updateFeedback() {
  const w = feedbackCanvas.width, h = feedbackCanvas.height;
  if (!w || !h) return;

  const wAbs = Math.abs(wonkiness);
  const effectStrength = Math.max(0, (wAbs - 0.5) / 0.5);

  if (effectStrength < 0.01) {
    ctx.clearRect(0, 0, w, h);
    feedbackCanvas.style.filter = 'none';
    consumeFeedbackActive();
    return;
  }

  const scale     = 1 + effectStrength * FB_SCALE_PER_FRAME;
  const rotation  = effectStrength * FB_TWIST_PER_FRAME;
  const echoAlpha = 1 - (1 - FB_ECHO_ALPHA) * effectStrength;

  // 1. Re-stamp existing feedback, scaled + rotated + faded.
  // 'copy' rather than 'source-over': self-draw with source-over restores alpha;
  // 'copy' replaces dst with src * globalAlpha so alpha genuinely decays.
  ctx.save();
  ctx.globalAlpha = echoAlpha;
  ctx.globalCompositeOperation = 'copy';
  ctx.translate(w / 2, h / 2);
  ctx.scale(scale, scale);
  ctx.rotate(rotation);
  ctx.drawImage(feedbackCanvas, -w / 2, -h / 2, w, h);
  ctx.restore();

  // 2. Eat away alpha so echoes fully vanish rather than accumulating
  ctx.globalAlpha = effectStrength * FB_FADE_ALPHA;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(0, 0, w, h);

  // 3. Render only the sounding blob(s) into the in-buffer and stamp into echo
  const activeBlobs = consumeFeedbackActive();
  if (activeBlobs) {
    blobReg.forEach(b => { b.obj.group.visible = activeBlobs.has(b.name); });
    const flashWasVisible = flashMesh && flashMesh.visible;
    if (flashMesh) flashMesh.visible = false;
    inRenderer.render(scene, camera);
    blobReg.forEach(b => { b.obj.group.visible = true; });
    if (flashMesh && flashWasVisible) flashMesh.visible = true;

    ctx.globalAlpha = effectStrength * FB_STAMP_ALPHA;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(inCanvas, 0, 0, w, h);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // 4. CSS filter: hue sign tracks wonk sign, all effects scale with effectStrength
  const hue  = effectStrength * Math.sign(wonkiness) * FB_MAX_HUE_DEG;
  const sat   = 1 + effectStrength * (FB_MAX_SATURATE - 1);
  const blur  = effectStrength * FB_MAX_BLUR_PX;
  feedbackCanvas.style.filter = `hue-rotate(${hue}deg) saturate(${sat}) blur(${blur}px)`;
}
