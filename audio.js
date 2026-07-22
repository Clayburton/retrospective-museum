"use strict";
/* ============================================================================
   audio.js — one WebAudio context for the whole museum.
   - Songs: HTMLAudioElement → MediaElementSource → gain → lowpass → master.
     Exclusive playback; muffled only in the entrance hallway (by depth).
   - Room tone: synthesized loops (brown noise + hum through filters) — no
     sample assets. Crossfade on card change.
   - SFX: tiny synthesized one-shots (ticks, clacks, bells, rings, buzz…).
   ============================================================================ */
(function () {

let ctx = null, master, sfxBus, songBus, songLpf, analyser;
let waveArr, freqArr;
let unlocked = false;
let ELEPH_I = -1;                 // round-robins the receptionist's toots

/* muffling: the song plays at FULL quality everywhere you roam the museum
   (era rooms + rotunda) so you can wander and still hear the whole track. It
   only fades/muddies once you step back into the entrance HALLWAY (room "ent"),
   getting quieter step by step as you head out toward the street. */

const songEls = {};        // id -> {el, node}
let current = null;        // {id, room}
let curRoom = "ent", curDepth = 1, curQuiet = false;

function ensureCtx() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
  songLpf = ctx.createBiquadFilter(); songLpf.type = "lowpass"; songLpf.frequency.value = 19000;
  songBus = ctx.createGain(); songBus.gain.value = 1;
  songBus.connect(songLpf); songLpf.connect(master);
  analyser = ctx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.72;
  songBus.connect(analyser);
  waveArr = new Uint8Array(analyser.fftSize);
  freqArr = new Uint8Array(analyser.frequencyBinCount);
  buildAmbients();
  return true;
}

/* ------------------------------------------------------------------ songs */
function elFor(song) {
  if (songEls[song.id]) return songEls[song.id];
  const el = new Audio();
  el.preload = "none";
  el.src = "assets/audio/" + song.file;
  const node = ctx.createMediaElementSource(el);
  node.connect(songBus);
  const rec = { el, node };
  songEls[song.id] = rec;
  return rec;
}

function play(id, onended) {
  if (!ensureCtx()) return;
  stop();
  const song = window.WORLD.songs[id];
  if (!song) return;
  const rec = elFor(song);
  current = { id, room: song.room || "rot" };
  applyDistance(true);
  rec.el.currentTime = 0;
  rec.el.onended = () => { if (current && current.id === id) current = null; onended && onended(); };
  rec.el.play().catch(() => {});
}
function stop() {
  if (!current) return;
  const rec = songEls[current.id];
  if (rec) { rec.el.pause(); rec.el.onended = null; }
  current = null;
}
function applyDistance(hard) {
  if (!ctx || !current) return;
  // full in every gallery + the rotunda; muffled only in the hallway ("ent"),
  // deeper toward the street = more muffled.
  const d = curRoom === "ent" ? Math.min(7, Math.max(1, curDepth || 1)) : 0;
  const gains = [1, 0.5, 0.36, 0.26, 0.18, 0.12, 0.08, 0.05];
  const lpfs = [19000, 2200, 1500, 1000, 700, 480, 330, 230];
  const t = ctx.currentTime, T = hard ? 0.05 : 0.9;
  if (curQuiet) {                       // a soundproof room (the theatre): the song is
    songBus.gain.cancelScheduledValues(t);   // silenced but NEVER stopped — it plays on
    songBus.gain.setTargetAtTime(0, t, 0.18);// in the room you left it in
    return;
  }
  songBus.gain.cancelScheduledValues(t);
  songBus.gain.setTargetAtTime(gains[d], t, T / 3);
  songLpf.frequency.cancelScheduledValues(t);
  songLpf.frequency.setTargetAtTime(lpfs[d], t, T / 3);
}

/* --------------------------------------------------------------- ambients */
const ambients = {};       // name -> {gain}
let curAmbient = null;

function noiseBuffer(sec, brown) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const ch = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.2; }
    else ch[i] = w;
  }
  return b;
}
function mkAmbient(def) {
  const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
  // filtered brown-noise bed
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(3.1, true); src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = def.lpf;
  const g2 = ctx.createGain(); g2.gain.value = def.noise;
  src.connect(f); f.connect(g2); g2.connect(g);
  src.start();
  // mains hum
  if (def.hum) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = def.hum;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = def.hum * 2.01;
    const hg = ctx.createGain(); hg.gain.value = def.humGain || 0.012;
    o.connect(hg); o2.connect(hg); hg.connect(g);
    o.start(); o2.start();
  }
  // thin high whine (the dying streetlight)
  if (def.whine) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = def.whine;
    const wg = ctx.createGain(); wg.gain.value = def.whineGain || 0.004;
    o.connect(wg); wg.connect(g);
    o.start();
  }
  return { gain: g, vol: def.vol };
}
function buildAmbients() {
  const defs = {
    street: { lpf: 240,  noise: 0.55, hum: 0,   vol: 0.16 },
    lamp:   { lpf: 200,  noise: 0.30, hum: 118, humGain: 0.014, whine: 2340, whineGain: 0.006, vol: 0.14 },
    dark:   { lpf: 120,  noise: 0.40, hum: 0,   vol: 0.10 },
    hall:   { lpf: 420,  noise: 0.30, hum: 100, humGain: 0.020, vol: 0.14 },
    rot:    { lpf: 700,  noise: 0.22, hum: 60,  humGain: 0.010, vol: 0.12 },
    room:   { lpf: 520,  noise: 0.18, hum: 120, humGain: 0.008, vol: 0.10 },
    annex:  { lpf: 380,  noise: 0.22, hum: 93,  humGain: 0.016, vol: 0.12 },
  };
  for (const k in defs) ambients[k] = mkAmbient(defs[k]);
}
function ambient(name) {
  if (!ctx) { curAmbient = name; return; }
  const t = ctx.currentTime;
  for (const k in ambients) {
    const target = k === name ? ambients[k].vol : 0;
    ambients[k].gain.gain.setTargetAtTime(target, t, 0.5);
  }
  curAmbient = name;
}

/* -------------------------------------------------------------------- sfx */
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0004, t0 + a + d);
}
function tone(freq, type, dur, peak, when, bend) {
  const t0 = ctx.currentTime + (when || 0);
  const o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(bend, t0 + dur);
  const g = ctx.createGain(); env(g, t0, 0.004, peak || 0.2, dur);
  o.connect(g); g.connect(sfxBus);
  o.start(t0); o.stop(t0 + dur + 0.1);
}
function burst(dur, peak, fc, type, when) {
  const t0 = ctx.currentTime + (when || 0);
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(Math.max(0.05, dur), false);
  const f = ctx.createBiquadFilter(); f.type = type || "bandpass"; f.frequency.value = fc || 2000; f.Q.value = 1.1;
  const g = ctx.createGain(); env(g, t0, 0.002, peak || 0.25, dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t0); src.stop(t0 + dur + 0.1);
}

/* a bell rendered into a buffer with sample-hold + step quantize (lo-bit),
   then played slow — the haunted desk bell */
let bellLowBuf = null;
function mkBellLow() {
  const sr = ctx.sampleRate, dur = 2.4, n = Math.floor(sr * dur);
  const b = ctx.createBuffer(1, n, sr), ch = b.getChannelData(0);
  let hold = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 2.0);
    const v = (Math.sin(6.2832 * 392 * t) + 0.55 * Math.sin(6.2832 * 392 * 2.76 * t) +
               0.22 * Math.sin(6.2832 * 392 * 5.4 * t)) * env;
    if (i % 7 === 0) hold = v;                       // ~6.3kHz sample-hold crush
    ch[i] = Math.round(hold * 10) / 10 * 0.45;       // 10-step quantize
  }
  return b;
}

const SFX = {
  tick()     { burst(0.018, 0.34, 3400); tone(1250, "square", 0.02, 0.05); },
  bellLow()  {
    if (!bellLowBuf) bellLowBuf = mkBellLow();
    const src = ctx.createBufferSource();
    src.buffer = bellLowBuf; src.playbackRate.value = 0.52;
    const g = ctx.createGain(); g.gain.value = 0.19;      // a memory of a bell, not a bell
    src.connect(g); g.connect(sfxBus); src.start();
  },
  knock()    { tone(92, "sine", 0.09, 0.4, 0, 60); burst(0.03, 0.3, 320, "lowpass");
               tone(88, "sine", 0.09, 0.34, 0.17, 58); burst(0.03, 0.24, 300, "lowpass", 0.17); },
  rustle()   { burst(0.22, 0.14, 2400, "highpass"); burst(0.16, 0.10, 1800, "bandpass", 0.12); },
  squeak()   { tone(2900, "sine", 0.07, 0.09, 0, 3600); tone(3300, "sine", 0.05, 0.06, 0.09, 2700); },
  glassTap() { tone(1960, "sine", 0.06, 0.22); tone(2600, "sine", 0.16, 0.06, 0.01);
               tone(1890, "sine", 0.06, 0.16, 0.16); tone(2500, "sine", 0.14, 0.05, 0.17); },
  shutter()  { burst(0.015, 0.5, 2600); tone(150, "square", 0.04, 0.2, 0.02);
               burst(0.09, 0.25, 900, "bandpass", 0.06); },     // clack + film slide
  filmPull() { burst(0.14, 0.2, 1400, "bandpass"); burst(0.1, 0.14, 2000, "bandpass", 0.1); },
  creakDoor(){ tone(180, "sawtooth", 0.7, 0.05, 0, 90); tone(240, "sawtooth", 0.5, 0.03, 0.2, 130); },
  brokenNote(){ tone(660, "sine", 0.18, 0.12, 0, 622); tone(311, "sine", 0.3, 0.08, 0.16, 290); },
  blot()     { burst(0.05, 0.2, 500, "lowpass"); },
  tickSoft() { burst(0.014, 0.12, 2600); },
  clack()    { burst(0.02, 0.5, 2900); tone(190, "sine", 0.05, 0.16); },
  keys()     { for (let i = 0; i < 6; i++) { burst(0.02, 0.34, 2500 + Math.random()*1200, "bandpass", i*0.09 + Math.random()*0.03); } },
  bell()     { tone(2093, "sine", 0.7, 0.16); tone(2093*2.7, "sine", 0.4, 0.05); },
  ding()     { tone(1568, "sine", 0.5, 0.14); },
  stamp()    { burst(0.06, 0.6, 300, "lowpass"); tone(72, "sine", 0.10, 0.5, 0, 46); },
  rattle()   { for (let i = 0; i < 3; i++) burst(0.03, 0.3, 900 + i*180, "bandpass", i * 0.07); },
  thunk()    { tone(64, "sine", 0.30, 0.22, 0, 40); burst(0.05, 0.10, 240, "lowpass"); },
  buzz()     { // the light dips: low electrical shudder with crackles
               const t0 = ctx.currentTime;
               const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = 52;
               const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 300;
               const g = ctx.createGain();
               g.gain.setValueAtTime(0.0001, t0);
               g.gain.linearRampToValueAtTime(0.075, t0 + 0.14);
               g.gain.setValueAtTime(0.075, t0 + 1.0);
               g.gain.exponentialRampToValueAtTime(0.0003, t0 + 1.4);
               o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + 1.5);
               for (const w of [0.12, 0.37, 0.55, 0.86, 1.04]) burst(0.014, 0.20, 900, "bandpass", w); },
  /* the receptionist's voice — a very short digital elephant toot. Four variants
     cycled round-robin so a line of dialogue never sounds like one repeated bleep. */
  eleph()    { // low, buzzy, and unmistakably a synthesised elephant: a sawtooth
               // blare pulled down through a resonant filter, plus a detuned
               // second voice so it honks rather than beeps
               const t0 = ctx.currentTime;
               ELEPH_I = (ELEPH_I + 1) % 4;
               const V = [[196, 118], [232, 150], [168, 108], [258, 132]][ELEPH_I];
               const g = ctx.createGain(); env(g, t0, 0.008, 0.045, 0.10);
               const f = ctx.createBiquadFilter(); f.type = "lowpass";
               f.frequency.setValueAtTime(1100, t0);
               f.frequency.exponentialRampToValueAtTime(420, t0 + 0.10);
               f.Q.value = 7;                                    // the nasal resonance
               for (const [type, mul, lvl] of [["sawtooth", 1, 1], ["square", 1.005, 0.5]]) {
                 const o = ctx.createOscillator(); o.type = type;
                 o.frequency.setValueAtTime(V[0] * mul, t0);
                 o.frequency.exponentialRampToValueAtTime(V[1] * mul, t0 + 0.10);
                 const og = ctx.createGain(); og.gain.value = lvl;
                 o.connect(og); og.connect(f); o.start(t0); o.stop(t0 + 0.16);
               }
               f.connect(g); g.connect(sfxBus); },
  bats()     { // a low-bit flurry: squeaky square-wave chirps + leathery wingbeats
               const t0 = ctx.currentTime;
               for (let i = 0; i < 18; i++) {
                 const w = i * 0.085 + Math.random() * 0.06;
                 const f = 1700 + Math.random() * 2400;
                 const o = ctx.createOscillator(); o.type = "square";
                 o.frequency.setValueAtTime(f, t0 + w);
                 o.frequency.exponentialRampToValueAtTime(f * 0.42, t0 + w + 0.07);
                 const g = ctx.createGain(); env(g, t0 + w, 0.004, 0.055, 0.08);
                 o.connect(g); g.connect(sfxBus); o.start(t0 + w); o.stop(t0 + w + 0.16);
               }
               for (let i = 0; i < 16; i++) burst(0.04, 0.07, 380, "lowpass", i * 0.105 + Math.random() * 0.05); },
  applause() { // an old low-bit house clapping — crunchy, sample-and-held, swelling then thinning
               const t0 = ctx.currentTime, dur = 3.4, sr = ctx.sampleRate;
               const n = Math.floor(sr * dur);
               const b = ctx.createBuffer(1, n, sr), ch = b.getChannelData(0);
               const step = 6;                       // sample-and-hold = the low-bit crunch
               const claps = 190;
               for (let c = 0; c < claps; c++) {
                 const at = Math.pow(Math.random(), 0.7) * dur * 0.92;
                 const s0 = Math.floor(at * sr), len = Math.floor((0.018 + Math.random()*0.03) * sr);
                 const amp = (0.28 + Math.random()*0.5) * Math.sin(Math.PI * Math.min(1, at/dur));
                 let hold = 0;
                 for (let i = 0; i < len && s0 + i < n; i++) {
                   if (i % step === 0) hold = (Math.random()*2 - 1);
                   ch[s0 + i] += hold * amp * Math.pow(1 - i/len, 2.2);
                 }
               }
               for (let i = 0; i < n; i++) ch[i] = Math.max(-1, Math.min(1, ch[i] * 0.5));
               const src = ctx.createBufferSource(); src.buffer = b;
               const f = ctx.createBiquadFilter(); f.type = "bandpass";
               f.frequency.value = 2100; f.Q.value = 0.7;
               const g = ctx.createGain(); g.gain.value = 0.5;
               src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t0); },
  sinkhole() { // the grate: a hollow drop into somewhere deep under the street
               const t0 = ctx.currentTime;
               const o = ctx.createOscillator(); o.type = "sine";
               o.frequency.setValueAtTime(190, t0); o.frequency.exponentialRampToValueAtTime(26, t0 + 1.5);
               const g = ctx.createGain(); env(g, t0, 0.05, 0.20, 1.6);
               o.connect(g); g.connect(sfxBus); o.start(t0); o.stop(t0 + 1.8);
               const n = ctx.createBufferSource(); n.buffer = noiseBuffer(1.7, true);
               const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.Q.value = 3.5;
               nf.frequency.setValueAtTime(760, t0); nf.frequency.exponentialRampToValueAtTime(85, t0 + 1.5);
               const ng = ctx.createGain(); env(ng, t0, 0.04, 0.13, 1.5);
               n.connect(nf); nf.connect(ng); ng.connect(sfxBus); n.start(t0); n.stop(t0 + 1.7);
               for (const w of [0, 0.06, 0.13]) burst(0.03, 0.18, 620, "bandpass", w); },
  ring()     { for (const w of [0, 0.07, 0.14, 0.21, 0.28, 0.35]) { tone(1050, "sine", 0.05, 0.10, w); tone(1382, "sine", 0.05, 0.10, w + 0.035); } },
  flap()     { for (let i = 0; i < 3; i++) burst(0.04, 0.22 - i*0.05, 600 - i*120, "bandpass", i * 0.11); },
  hiss()     { burst(1.1, 0.06, 5200, "highpass"); },
  whisper()  { burst(0.7, 0.05, 1800, "bandpass"); burst(0.5, 0.04, 2600, "bandpass", 0.25); },
  creak()    { tone(300, "sawtooth", 0.4, 0.03, 0, 210); },
  // a cat's ear twitching: a little coiled-spring boing that wobbles twice and
  // settles — square edge and a pinch of grit keep it lo-fi rather than clean
  earFlick() { tone(300, "square",   0.05, 0.050, 0,    880);
               tone(880, "triangle", 0.09, 0.055, 0.04, 360);
               tone(360, "triangle", 0.08, 0.032, 0.11, 660);
               tone(660, "triangle", 0.07, 0.018, 0.18, 420);
               burst(0.02, 0.05, 1700, "bandpass", 0.01); },
  // going through the archive boxes: dry irregular paper rustles, a duller slide,
  // and the box itself shifting — deliberately crunchy rather than clean
  rummage()  { [0, 0.085, 0.17, 0.275, 0.355, 0.47].forEach((d, i) =>
                 burst(0.05 + Math.random()*0.05, 0.125 - i*0.012,
                       1500 + Math.random()*2200, "bandpass", d));
               burst(0.045, 0.055, 700, "lowpass", 0.205);
               tone(120, "square", 0.05, 0.022, 0.30, 92); },
  musicbox() { const notes = [1318, 1568, 1760, 2093, 1760, 1568, 1318];
               notes.forEach((f, i) => tone(f, "sine", 0.5, 0.10, i * 0.22)); },
};

/* ------------------------------------------------------------------- API */
window.AUDIO = {
  unlock() {
    if (unlocked) { if (ctx && ctx.state === "suspended") ctx.resume(); return; }
    if (!ensureCtx()) return;
    unlocked = true;
    if (ctx.state === "suspended") ctx.resume();
    if (curAmbient) ambient(curAmbient);
  },
  play, stop,
  setRoom(r, depth, quiet) { curRoom = r; curDepth = depth == null ? 1 : depth; curQuiet = !!quiet; applyDistance(false); },
  ambient,
  sfx(n) { if (!ctx || !unlocked) return; try { SFX[n] && SFX[n](); } catch (e) {} },
  analyser() {
    if (!analyser) return null;
    analyser.getByteTimeDomainData(waveArr);
    analyser.getByteFrequencyData(freqArr);
    return { wave: waveArr, freq: freqArr };
  },
  playingId: () => current && current.id,
};

})();
