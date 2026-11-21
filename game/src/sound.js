// Solmar Heat — sound, all synthesized with WebAudio: no audio files, nothing to
// load. Short voices for shots, punches, crashes and cash; two loops, the engine and
// the siren, that follow the game. The context wakes on the first user gesture, as
// browsers require; before that (and in screenshot scenes) every call is a no-op.

let ctx = null;
let master = null;
let muted = false;
let engineNodes = null;
let sirenNodes = null;
let sirenFlip = 0;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

/** Call from a click or keypress: browsers only allow sound after a gesture. */
export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

/** M toggles the whole mix. Returns the new muted state. */
export function toggleMute() {
  muted = !muted;
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.3, freq = 1200, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

/** Play a named one-shot. Unknown names are silence. */
export function playSfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shot': noise(0.13, 0.5, 2600); tone(140, 0.1, 'square', 0.16, 60); break;
    case 'punch': tone(110, 0.09, 'sine', 0.4, 55); break;
    case 'thud': tone(80, 0.16, 'sine', 0.5, 40); noise(0.08, 0.2, 500); break;
    case 'crash': noise(0.3, 0.5, 900); tone(70, 0.3, 'sawtooth', 0.22, 34); break;
    case 'door': tone(220, 0.05, 'square', 0.12); tone(160, 0.06, 'square', 0.1, null, 0.05); break;
    case 'click': tone(660, 0.04, 'square', 0.1); break;
    case 'honk': tone(370, 0.16, 'square', 0.14); tone(466, 0.16, 'square', 0.1); break;
    case 'pickup': tone(660, 0.09, 'triangle', 0.3); tone(880, 0.12, 'triangle', 0.3, null, 0.08); break;
    case 'checkpoint': tone(784, 0.09, 'triangle', 0.3); tone(1046, 0.14, 'triangle', 0.3, null, 0.09); break;
    case 'mission': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.3, null, i * 0.11)); break;
    case 'cash': tone(988, 0.07, 'square', 0.16); tone(1318, 0.12, 'square', 0.16, null, 0.06); break;
    case 'busted': [440, 349, 262, 196].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.2, null, i * 0.16)); break;
    case 'wasted': [392, 330, 262, 165].forEach((f, i) => tone(f, 0.3, 'triangle', 0.26, null, i * 0.2)); break;
    default: break;
  }
}

/** The engine loop: call with a speed ratio while driving, null to stop it. */
export function engineSound(ratio) {
  if (!ctx) return;
  if (ratio === null) {
    if (engineNodes) {
      try { engineNodes.osc.stop(); } catch { /* already stopped */ }
      engineNodes = null;
    }
    return;
  }
  if (muted) return;
  if (!engineNodes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    gain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engineNodes = { osc, gain };
  }
  engineNodes.osc.frequency.setTargetAtTime(52 + Math.abs(ratio) * 165, ctx.currentTime, 0.06);
}

/** The siren loop: call with true while a chase is live, false to stop it. */
export function sirenSound(on) {
  if (!ctx) return;
  if (!on) {
    if (sirenNodes) {
      try { sirenNodes.osc.stop(); } catch { /* already stopped */ }
      sirenNodes = null;
    }
    return;
  }
  if (muted || sirenNodes) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  gain.gain.value = 0.045;
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  sirenNodes = { osc, gain };
}

/** Advance the siren's two-tone wail; call once a frame. */
export function tickSound(dt) {
  if (!sirenNodes || !ctx) return;
  sirenFlip -= dt;
  if (sirenFlip <= 0) {
    sirenFlip = 0.38;
    const high = Math.round(ctx.currentTime * 10) % 2 === 0;
    sirenNodes.osc.frequency.setValueAtTime(high ? 950 : 660, ctx.currentTime);
  }
}
