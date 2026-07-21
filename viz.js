"use strict";
/* ============================================================================
   viz.js — the placeholder visualizer that lives inside EVERY picture frame
   (framework v1). One simple, honest instrument: a dormant dark panel that
   wakes into an oscilloscope + spectrum when its song plays.

   Per-song visualizers later replace this via VIZ.register(songId, drawFn).
   A draw fn paints GRAYSCALE into ctx at master coords; the engine's dither
   pass makes it 1-bit. Signature: draw(ctx, r=[x,y,w,h], io) where io =
   { on, t, song, data:{wave,freq}|null, seed }.
   ============================================================================ */
(function () {

const custom = {};

function drawDefault(ctx, r, io) {
  const [x, y, w, h] = r;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  // the dark canvas of the piece — near-black so dormant frames stay solid ink
  ctx.fillStyle = "#070707"; ctx.fillRect(x, y, w, h);

  const t = io.t / 1000;

  if (!io.on || !io.data) {
    // dormant: one faint resting line + drifting dust motes
    ctx.strokeStyle = "rgba(210,205,192,0.16)";
    ctx.lineWidth = Math.max(2, h * 0.006);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h / 2);
    ctx.lineTo(x + w * 0.92, y + h / 2);
    ctx.stroke();
    const rnd = mulberry(io.seed * 1000 + 7);
    for (let i = 0; i < 5; i++) {
      const px = x + w * (0.1 + 0.8 * rnd());
      const py = y + h * ((0.2 + 0.6 * rnd() + t * 0.008 * (i + 1)) % 0.9);
      ctx.fillStyle = "rgba(200,196,184," + (0.10 + 0.12 * rnd()) + ")";
      ctx.fillRect(px, py, 3, 3);
    }
    ctx.restore();
    return;
  }

  const { wave, freq } = io.data;

  // spectrum: soft bars rising from the floor of the frame
  const bars = 24;
  const bw = w / bars;
  for (let i = 0; i < bars; i++) {
    const fi = Math.floor(Math.pow(i / bars, 1.6) * freq.length * 0.72);
    const v = freq[fi] / 255;
    const bh = v * h * 0.55;
    ctx.fillStyle = "rgba(216,212,200," + (0.14 + v * 0.32) + ")";
    ctx.fillRect(x + i * bw + bw * 0.18, y + h - bh, bw * 0.64, bh);
  }

  // oscilloscope: the living line
  ctx.strokeStyle = "rgba(238,234,224,0.92)";
  ctx.lineWidth = Math.max(2.5, h * 0.010);
  ctx.beginPath();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const wi = Math.floor(i / n * (wave.length - 1));
    const v = (wave[wi] - 128) / 128;
    const px = x + w * (0.05 + 0.9 * i / n);
    const py = y + h * 0.46 + v * h * 0.30;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke();

  // breathing corner glow — the piece is awake
  const k = 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.fillStyle = "rgba(238,234,224," + (0.05 + 0.05 * k) + ")";
  ctx.fillRect(x, y, w, Math.max(2, h * 0.012));

  ctx.restore();
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

window.VIZ = {
  draw(ctx, r, io) { (custom[io.song && io.song.id] || drawDefault)(ctx, r, io); },
  register(songId, fn) { custom[songId] = fn; },
};

})();
