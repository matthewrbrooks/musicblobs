# MusicBlobs

A browser-based musical toy: three psychedelic 3D blob creatures in a shared scene, each playing a different instrument. Built for both kids and adults — playful, glowy, hands-on. Single self-contained HTML right now; refactor to Vite + modules is the next big task.

## Stack

- Three.js `v0.165.0` via importmap from CDN
- Web Audio API for *all* sound (no audio libraries)
- No build step currently — vanilla HTML/JS module
- Target: refactor to Vite, deploy to Netlify

## Running locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000/musicblobs.html
```

**Microphone access requires `localhost` or `https://`** — `file://` URLs and the Claude Desktop preview iframe both block `getUserMedia`. Facey's sample recording will silently fail outside a secure origin.

## The three creatures

Each lives in a Three.js `Group`, has a `tick(t)` method called every frame, and exposes a `pulse(idx)` method for visual feedback on hits. All three creatures share one scene, one canvas, one set of lights.

### Drumbo (drum machine)

- Spiky `IcosahedronGeometry(1.3, 4)` with blobify scale `0.22`
- 4 drum pads in a tight 2×2 grid on the face
- Sounds: kick, snare, hihat, clap (synthesized via Web Audio)
- Decorative red eyes above the top two pads (positions derived from pad tweakables — adjust pad layout and eyes follow)

### Keebo (keyboard)

- Smoothed `SphereGeometry(1.35, 64, 64)` with blobify scale `0.08`
- 8 keys in C major across the front, sit at `z=1.6` so the breathing body never occludes them
- Two antennae on top (tagged as `body` so they participate in dragging)
- Supports glissando — drag across keys and each one triggers on entry, no retrigger until the cursor leaves and re-enters
- Click-through-gaps prevention: hits on the body within the key strip's local rectangle are treated as `key-strip` events, not drag starts

### Facey (vocal sampler)

- Elongated head with several interactive face parts
- **Vocal parts** (eyes, forehead, cheeks) — synthesized "ooh / aah / wow / weird" sounds, indexed by `VOCAL_INDICES = [0,1,4,5,6]`
- **Nose** — plays back a recorded sample at the current mouth-stretch pitch
- **Mouth** — vertical stretchy pill; drag-down stretches the mouth and lowers playback pitch (2-octave range, rest = `2.0×`, fully stretched = `0.5×`, exponential)
- **Left ear (yellow)** — toggles lock/random mode for sample playback; shows a glowing halo ring when locked
- **Right ear (pink)** — records a fresh 2-second sample (3-2-1 countdown via `MediaRecorder`)
- Up to 100 sample slots, FIFO when full; a new recording auto-locks to its slot

## Architecture

### Hit dispatch via `userData`

Every interactive mesh has `userData = { kind, ... }`. `handlePointerDown` raycasts, looks at `hits[0].object.userData.kind`, then switches:

```
'drum-pad'    → triggerDrum(index, cx, cy)
'key-pad'     → playKey(index, cx, cy)
'key-strip'   → (Keebo only — caught via post-hoc local-rect check on body hits)
'face-vocal'  → triggerFaceVocal(partIdx, cx, cy)
'face-mouth'  → start mouth pitch drag
'face-ear'    → if partIdx===7 toggleLock() else startSampleRecord()
'face-nose'   → triggerFaceNose(cx, cy)
'body'        → start blob drag
```

### Factored trigger functions

`triggerDrum`, `playKey`, `triggerFaceVocal`, `triggerFaceNose` exist as standalone functions so *both* real clicks and collision-fired clicks share the exact same code path. This means loop recording, ripples, labels, pulses, and flash effects all happen identically whether triggered by user or physics. **If you add new musical surfaces, factor them this way.**

### Loop engine

- Default 90 BPM, 2 bars (8 beats)
- `loopEvents[]` of `{t, type, index}` where `type ∈ ['drum','key','face','sample']`
- Independent REC and PLAY buttons
- 4-beat count-in when starting a fresh recording (REC counts down 4→1, then "STOP")
- Overdub mode when REC is pressed during playback (no count-in, aligned to existing phase)
- Gentle woodblock metronome during count-in and recording, silent during pure playback
- `getBeatPulse()` returns a 0–1 pulse from `loopStart` phase; blob bodies' `emissiveIntensity` is modulated by it

### Wonk + quantize

- `wonkiness ∈ [-1, +1]`: negative quantizes toward the grid, positive pushes events off-grid *and* offsets pitch
- `wonkPitchScale` is a global multiplier applied to every synth frequency during loop playback (set before `fireEvent`, reset after)
- Wonk changes apply on the *next* loop cycle, never mid-cycle (prevents glitching)
- Quantize grid is one of 1/16, 1/8, 1/4

### Physics

Two `moveMode` values, switchable via the UI. **Bounce is the default.**

- **Bounce**: elastic blob-on-blob collisions, air drag, walls have 0.7 restitution. Dragged blobs have effectively infinite mass and impart velocity to anything they hit.
- **Avoid**: blobs spring back to their home positions, with repulsion from the dragged blob and from each other.

**Bounce mode triggers musical events on new collisions.** `collidingPairs` (a `Set`) tracks which pairs are currently touching, so we only fire `triggerRandomClick` on the first frame of contact, not continuously while overlapping.

### Visual effects

- Ripples: 3 concentric rings staggered 80ms apart, ease-out curve, colour matches the tapped element
- Body illumination on the beat (via `getBeatPulse()`)
- Floating tap labels above each interaction point
- Floating creature name labels track each blob's screen position
- Hit flash overlay tints the screen briefly on each event
- **Use `mousedown`, not `click`** — musical immediacy matters more than the conventional click semantics

## Tweakable constants

Grouped near the relevant build function. Adjust freely; downstream visuals (like Drumbo's eyes) are derived from these so they update consistently.

```js
// Drumbo (top of buildDrumbo)
const DRUMBO_PAD_RADIUS  = 0.42;   // disc radius
const DRUMBO_PAD_HEIGHT  = 0.08;   // disc thickness
const DRUMBO_PAD_SPACING = 0.48;   // half-distance between adjacent pads
const DRUMBO_PAD_Z       = 1.50;   // depth — must clear body bumps (max ≈ 1.52)

// Facey (sample section)
const MAX_SAMPLES = 100;           // FIFO cap
let faceyMonophonic = true;        // INTERNAL — not exposed in UI
                                   // true: new sample cuts off existing playback
                                   // false: samples layer (polyphonic)
```

Other notable globals: `NOTE_FREQS` (Keebo), `DRUM_COLORS`/`DRUM_LABELS` (Drumbo), `FACE_ZONES`/`FACE_COLORS`/`VOCAL_INDICES` (Facey).

## Conventions

- **Single source of truth for click handling.** All musical triggers go through their factored trigger functions. Don't inline duplicate dispatch logic.
- **Tweakable constants near the build function.** Don't bury layout numbers in animation code.
- **Internal config flags over UI controls** when the toggle is for development or aesthetic tuning, not user-facing behaviour. Example: `faceyMonophonic`.
- **Visual feedback is shared overlay-driven.** Don't create per-creature ripples/labels — call the shared `spawnRipple`, `showLabel`, `flashHit`.
- **No raw `click` events for sound triggers** — use `mousedown` / pointerdown for immediacy.

## Common gotchas

- **Body bumps occluding interactive surfaces.** The blobify noise can push body geometry well in front of "in front" elements. When this happens, push the surface forward in `z` (Keebo's keys at `z=1.6`, Drumbo's pads at `z=1.5`) rather than reducing blobify and losing character.
- **Mic in iframe.** Claude Desktop's preview iframe doesn't delegate microphone permission, and `file://` can't grant secure-origin permission. Use the local HTTP server for testing Facey's recording.
- **Worldspace ≠ local space when checking hits.** `worldToLocal(hit.point.clone())` — always `.clone()`, `worldToLocal` mutates.
- **Sample indices on FIFO eviction.** When the slot array shifts, `lockedSlot` and `lastPlayedSlot` indices need adjusting. There's a helper for this — `storeSampleBuffer`.
- **Wonk pitch reset.** Always reset `wonkPitchScale = 1` after firing a loop event, or direct user clicks afterwards inherit the wonk pitch.

## Open work

- [ ] Refactor single-file `musicblobs.html` into Vite project with `src/{audio,blobs,physics,interaction,ui}/`
- [ ] Deploy to Netlify with auto-deploy on `git push`
- [ ] Consider velocity-mapped volume on collision triggers (faster impact = louder)
- [ ] Decide whether to expose `faceyMonophonic` to UI or leave internal
- [ ] Wonk pitch range currently ±7 semitones at max — possibly too aggressive

## Useful files

- `musicblobs.html` — the entire prototype (currently)
- This file (`CLAUDE.md`) — load me first
