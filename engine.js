"use strict";
/* ============================================================================
   CARDSTOCK — a HyperCard-style 1-bit card-world engine.
   engine.js is game-agnostic; world.js supplies cards/songs/rooms/actions.

   Pipeline: grayscale square masters (art) + a dynamic 2D layer (text/viz/anims)
   → composited in WebGL2 → live ordered dither to pure ink/paper at a chunky
   integer art-cell grid. Transitions are the real HyperCard set, computed
   per art cell (hard replacement, no crossfades).

   Debug: window.__mus — go(id), freeze(), renderOnce(), hot(), play(id),
   forceSize(w,h), P (live tunables). ?debug=1 draws hotspots. ?card=<id> jumps.
   ============================================================================ */
(function () {

const W = window.WORLD, VIZ = window.VIZ, AUDIO = window.AUDIO;
const M = 1536;                       // master coordinate space (art px)
const stage = document.getElementById("stage");
const overlay = document.getElementById("overlay");
const qs = new URLSearchParams(location.search);

const P = {
  back: 1254,                         // FIXED square backing — art native res; dither is CONSTANT
  ditherPx: 2,                        // device px per dither cell (fine Mac dither)
  edgeAmt: 0.95,                      // re-dither the recovered tone → ONE consistent pixel size across all art
  smoothR: 2.4,                       // blur radius (device px) that averages each image's uneven dither back into tone
  textScale: 1.75,                    // physical text size (bigger = more readable)
  paper: [0.953, 0.945, 0.925],       // warm paper white
  ink:   [0.043, 0.043, 0.047],
  assetV: 9,                          // bump after re-processing masters (they cache like scripts)
  dprCap: 2,
  speeds: { veryfast: 170, fast: 340, slow: 760, veryslow: 1500 },
  cacheCap: 9,                        // master textures kept (LRU)
  idleFlicker: 45,                    // seconds
  navBand: 0.085,                     // screen-edge nav zone width (fraction)
  vizFps: 30,
};

/* ---------------------------------------------------------------- state -- */
const S = {
  cur: null,                // current card id
  A: null, B: null,         // slots: {card, dyn:{cv,ctx,res}, dirty}
  trans: null,              // {mode,t0,dur,dir,at,target,opt}
  lock: false,
  playing: null,            // song id
  hover: null,
  view: { x: 0, y: 0, w: 1, h: 1 },   // css content rect (letterbox-aware)
  crop: { u0: 0, v0: 0, u1: 1, v1: 1 },
  cssW: 0, cssH: 0, dpr: 1,
  lastInput: performance.now(),
  flick: 1, flickAnim: null,
  anims: [],                // {t0,dur,draw(ctx,k),onend}
  typeOn: null,             // {text..} for plaque type-on (world reads)
  seed: Math.random() * 100,
  raf: 0, frozen: false,
  vizLast: 0,
  st: {},                   // scratch per-card state for world hooks
};

/* ------------------------------------------------------------- WebGL 2 -- */
let gl, prog, uni = {}, vao, texA, texB, dynTexA, dynTexB, glDead = false;

const VS = `#version 300 es
layout(location=0) in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D tA, tB, dA, dB;
uniform vec4 cropA, cropB;       // master sample rect (u may be mirrored for flip)
uniform vec4 cropDA, cropDB;     // dynamic layer sample rect (never mirrored)
uniform vec2 res;                // square canvas device px
uniform float ditherPx;          // device px per dither cell
uniform float smoothR;           // master blur radius (device px) — recovers tone from uneven 1-bit art
uniform int mode;                // transition id
uniform float prog, seed, flick, edgeAmt;
uniform vec2 tdir;
uniform vec2 zc;                 // iris/zoom origin (uv, y down)
uniform vec3 paper, ink;
uniform float hasB;
out vec4 outC;

const int B8[64] = int[64](
   0,32, 8,40, 2,34,10,42,  48,16,56,24,50,18,58,26,
  12,44, 4,36,14,46, 6,38,  60,28,52,20,62,30,54,22,
   3,35,11,43, 1,33, 9,41,  51,19,59,27,49,17,57,25,
  15,47, 7,39,13,45, 5,37,  63,31,55,23,61,29,53,21);

float hash(vec2 p){ p = fract(p*vec2(127.1,311.7)); p += dot(p,p+34.23); return fract(p.x*p.y*95.4337); }

float comp(sampler2D t, sampler2D d, vec4 crop, vec4 cropD, vec2 uv, vec2 blur, out float dynA){
  // 3x3 box-blur the MASTER → recover approximate TONE from whatever (uneven)
  // 1-bit dither ChatGPT baked in. The re-dither below then re-renders that tone
  // at ONE consistent pixel size, so every image matches.
  float g = 0.0;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2(-blur.x,-blur.y))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2( 0.0,  -blur.y))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2( blur.x,-blur.y))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2(-blur.x, 0.0  ))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv)).r * 2.0;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2( blur.x, 0.0  ))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2(-blur.x, blur.y))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2( 0.0,   blur.y))).r;
  g += texture(t, mix(crop.xy,crop.zw, uv+vec2( blur.x, blur.y))).r;
  g /= 10.0;
  vec4 dd = texture(d, mix(cropD.xy, cropD.zw, uv));       // dynamic (text/viz) — crisp, no blur
  dynA = dd.a;
  return mix(g, dd.r, dd.a);
}

void main(){
  vec2 uv = gl_FragCoord.xy / res;          // 0..1 across the square backing
  uv.y = 1.0 - uv.y;                        // image space (v down)
  vec2 uvA = uv, uvB = uv;
  vec2 bcell = floor(gl_FragCoord.xy / ditherPx);

  float useB = 0.0;
  if (hasB > 0.5) {
    float pr = clamp(prog, 0.0, 1.0);
    if (mode == 1) {                                   // Osmo ordered-dither dissolve
      int bi = B8[int(mod(bcell.y,8.0))*8 + int(mod(bcell.x,8.0))];
      float th = (float(bi)+0.5)/64.0;
      th = th*0.7 + hash(floor(bcell/8.0)+seed)*0.3;   // sweeps in dithered patches
      useB = pr > th ? 1.0 : 0.0;
    } else if (mode == 2) {                            // wipe
      float p = tdir.x>0.5?uv.x : tdir.x<-0.5?1.0-uv.x : tdir.y>0.5?uv.y : 1.0-uv.y;
      useB = p < pr ? 1.0 : 0.0;
    } else if (mode == 3) { useB = abs(uv.x-0.5) < pr*0.5 ? 1.0 : 0.0; }        // barn open
    else if (mode == 4) { useB = abs(uv.x-0.5) > 0.5-pr*0.5 ? 1.0 : 0.0; }      // barn close
    else if (mode == 5 || mode == 10) {                                        // iris/zoom open
      vec2 mx = max(zc, 1.0-zc);
      float f = max(abs(uv.x-zc.x)/mx.x, abs(uv.y-zc.y)/mx.y);
      useB = f < pr ? 1.0 : 0.0;
    } else if (mode == 6 || mode == 11) {                                      // iris/zoom close
      vec2 mx = max(zc, 1.0-zc);
      float f = max(abs(uv.x-zc.x)/mx.x, abs(uv.y-zc.y)/mx.y);
      useB = f > 1.0-pr ? 1.0 : 0.0;
    } else if (mode == 9) {                                                    // scroll (push)
      uvB = uv - tdir*(1.0-pr); uvA = uv + tdir*pr;
      useB = (uvB.x>=0.0&&uvB.x<=1.0&&uvB.y>=0.0&&uvB.y<=1.0) ? 1.0 : 0.0;
    } else { useB = pr >= 1.0 ? 1.0 : 0.0; }           // cut
  }

  float dynA;
  vec2 blur = vec2(smoothR) / res;
  float g = (useB > 0.5) ? comp(tB, dB, cropB, cropDB, uvB, blur, dynA)
                         : comp(tA, dA, cropA, cropDA, uvA, blur, dynA);
  g *= flick;

  // Bayer threshold.
  //  MASTER art (dynA≈0): re-dither STRONGLY so ChatGPT's uneven, smooth-looking
  //   shading is broken into a single consistent fine 1-bit pattern (edgeAmt≈0.9).
  //  DYNAMIC layer (dynA≈1): dither only the MID-TONES (the visualizer/webcam);
  //   keep solid TEXT crisp (near-0/1 → no dither) so it stays readable.
  int bi = B8[int(mod(bcell.y,8.0))*8 + int(mod(bcell.x,8.0))];
  float bay = (float(bi)+0.5)/64.0;
  float dynSel = clamp(dynA*3.0, 0.0, 1.0);
  float dynMid = 1.0 - abs(g-0.5)*2.0;              // 1 at gray, 0 at pure black/white
  float amp = mix(edgeAmt, dynMid, dynSel);
  float bit = g > (0.5 + (bay-0.5)*amp) ? 1.0 : 0.0;
  outC = vec4(mix(ink, paper, bit), 1.0);
}`

function glInit() {
  gl = stage.getContext("webgl2", { antialias: false, alpha: false, depth: false,
    stencil: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
  if (!gl) { document.body.classList.add("no-gl"); return false; }
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  ["tA","tB","dA","dB","cropA","cropB","cropDA","cropDB","res","ditherPx","smoothR","mode","prog","seed","flick","edgeAmt","tdir","zc","paper","ink","hasB"]
    .forEach(n => uni[n] = gl.getUniformLocation(prog, n));
  vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(uni.tA, 0); gl.uniform1i(uni.tB, 1);
  gl.uniform1i(uni.dA, 2); gl.uniform1i(uni.dB, 3);
  texA = mkTex(gl.LINEAR); texB = mkTex(gl.LINEAR);        // blurred to recover tone, then re-dithered
  dynTexA = mkTex(gl.LINEAR); dynTexB = mkTex(gl.LINEAR);  // text/viz scale smoothly
  return true;
}
function mkTex(filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([16,16,16,255]));
  return t;
}
function upload(t, src) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}

/* ------------------------------------------------- master art (LRU cache) -- */
const cache = new Map();      // cardId -> {src (canvas|img), stamp}
let loadTick = 0;

function ensureMaster(card, cb) {
  const hit = cache.get(card.id);
  if (hit) { hit.stamp = ++loadTick; cb && cb(hit.src); return hit.src; }
  if (card.proc) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1152;
    const ctx = cv.getContext("2d");
    ctx.save(); ctx.scale(1152 / M, 1152 / M);      // procs draw in master coords
    W.PROCS[card.proc](ctx, card, H);
    ctx.restore();
    put(card.id, cv); cb && cb(cv); return cv;
  }
  const img = new Image();
  img.onload = () => { put(card.id, img); cb && cb(img); };
  img.onerror = () => {                       // never let missing art wedge the lock
    console.warn("art missing:", card.img);
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const c2 = cv.getContext("2d"); c2.fillStyle = "#3a3a3a"; c2.fillRect(0, 0, 64, 64);
    put(card.id, cv); cb && cb(cv);
  };
  img.src = card.img + "?av=" + P.assetV;
  return null;
}
function put(id, src) {
  cache.set(id, { src, stamp: ++loadTick });
  if (cache.size > P.cacheCap) {
    let old = null, os = 1e18;
    for (const [k, v] of cache) {
      if (k === S.cur || (S.trans && k === S.trans.target)) continue;
      if (v.stamp < os) { os = v.stamp; old = k; }
    }
    if (old) cache.delete(old);
  }
}
function prefetchNeighbors(card) {
  const ids = new Set();
  (card.hots || []).forEach(h => h.go && ids.add(h.go));
  const nav = card.nav || {};
  Object.values(nav).forEach(id => id && ids.add(id));
  (card.frames || []).forEach(f => ids.add("plaque-" + f.song));
  let i = 0;
  ids.forEach(id => {
    const c = W.cards[id];
    if (c && !cache.has(id)) setTimeout(() => ensureMaster(c), 120 + 160 * i++);
  });
}

/* --------------------------------------------------------- dynamic layer -- */
function mkDyn(card) {
  const res = card.dynRes || (card.frames ? 1536 : 768);   // frame walls get crisp plates
  const cv = document.createElement("canvas");
  cv.width = cv.height = res;
  const ctx = cv.getContext("2d");
  return { cv, ctx, res };
}
const sampleCv = document.createElement("canvas");
sampleCv.width = sampleCv.height = 96;
const sampleCtx = sampleCv.getContext("2d", { willReadFrequently: true });
function computeBgSample(card) {
  const c = cache.get(card.id);
  if (!c || !c.src) { S.bgSample = null; return false; }
  try { sampleCtx.drawImage(c.src, 0, 0, 96, 96); S.bgSample = sampleCtx.getImageData(0, 0, 96, 96); return true; }
  catch (e) { S.bgSample = null; return false; }
}
function drawDyn(slot, t) {
  const { card, dyn } = slot;
  const ctx = dyn.ctx;
  if (S.bgSampleFor !== card.id) { if (computeBgSample(card)) S.bgSampleFor = card.id; }
  // master px per dither cell — CONSTANT (fixed backing). text sized in CELLS
  // is the same on every window and always thicker than a cell → always reads.
  H._cm = M * P.ditherPx / P.back * P.textScale;
  ctx.clearRect(0, 0, dyn.res, dyn.res);
  ctx.save(); ctx.scale(dyn.res / M, dyn.res / M);
  // frames: nameplates + visualizer  (guarded so one bad card can't black out the game)
  try {
    (card.frames || []).forEach((f, i) => drawFrame(ctx, card, f, i, t));
    if (card.draw) card.draw(ctx, H, S, t);
  } catch (e) { console.warn("[mus] draw error on", card.id, e); }
  // directional arrows — show when the room continues left/right (also the click target)
  const nav = card.nav || {};
  const bob = Math.sin(t / 480) * 10;
  if (nav.left)  navArrow(ctx, 86 - bob, M * 0.5, -1);
  if (nav.right) navArrow(ctx, M - 86 + bob, M * 0.5, 1);
  // transient anims
  const now = performance.now();
  S.anims = S.anims.filter(a => {
    const k = (now - a.t0) / a.dur;
    if (k >= 1) { a.onend && a.onend(); return false; }
    if (a.card === card.id) a.draw(ctx, Math.max(0, k), H);
    return true;
  });
  ctx.restore();
  slot.dirty = true;
}
// the nameplate rect sits directly below the frame — one shared source of truth
// for both the drawn plate and its click target.
function plateRect(f) {
  // centre a readable plate on the art's own blank nameplate (f.plate); else below the frame
  const w = 300, h = 88;
  const cx = f.plate ? f.plate[0] + f.plate[2] / 2 : f.r[0] + f.r[2] / 2;
  const cy = f.plate ? f.plate[1] + f.plate[3] / 2 : f.r[1] + f.r[3] + 60;
  return [Math.round(cx - w / 2), Math.round(cy - h / 2), w, h];
}
function fitSize(ctx, text, maxW, face, base) {
  let s = base;
  ctx.font = "700 " + s + "px " + face;
  let w = ctx.measureText(text).width;
  if (w > maxW) s = Math.max(8, s * maxW / w);
  return s;
}
function navArrow(ctx, x, y, dir) {          // dir -1 = left, +1 = right
  const w = 30, h = 44;
  ctx.save();
  ctx.fillStyle = "rgb(242,238,228)";
  ctx.strokeStyle = "#0e0e0e"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x + dir * w, y);
  ctx.lineTo(x - dir * w, y - h);
  ctx.lineTo(x - dir * w, y + h);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawFrame(ctx, card, f, i, t) {
  const song = W.songs[f.song];
  const on = S.playing === f.song;
  // visualizer fills the frame opening; an OVAL frame clips its viz to an ellipse
  ctx.save();
  if (f.shape === "oval") {
    // fill the oval opening solid first (so no wall shows in the corners), then clip
    const ecx = f.r[0] + f.r[2] / 2, ecy = f.r[1] + f.r[3] / 2, erx = f.r[2] / 2 * 0.96, ery = f.r[3] / 2 * 0.96;
    ctx.beginPath(); ctx.ellipse(ecx, ecy, erx, ery, 0, 0, 7); ctx.clip();
  }
  VIZ.draw(ctx, f.r, { on, t, song, data: on ? AUDIO.analyser() : null, seed: i * 7.3 });
  ctx.restore();
  // nameplate — a clean opaque plate centred on the art's own blank plate
  const p = plateRect(f), cx = p[0] + p[2] / 2;
  ctx.fillStyle = "rgb(240,236,226)";
  ctx.fillRect(p[0], p[1], p[2], p[3]);
  ctx.strokeStyle = "#111"; ctx.lineWidth = Math.max(2, H._cm * 0.6);
  ctx.strokeRect(p[0] + 4, p[1] + 4, p[2] - 8, p[3] - 8);
  const t1 = fitSize(ctx, song.title, p[2] - 34, FACE, p[3] * 0.42);
  H.type(ctx, song.title, cx, p[1] + p[3] * 0.46, { size: t1, align: "center", seed: i * 13, plain: true, alpha: 1 });
  const t2 = fitSize(ctx, song.plateLine, p[2] - 34, FACE, p[3] * 0.22);
  H.type(ctx, song.plateLine, cx, p[1] + p[3] * 0.84, { size: t2, align: "center", seed: i * 29, plain: true, alpha: 1 });
}

/* ------------------------------------------------ typewriter text helper -- */
let FACE = '"Courier Prime", "Courier New", monospace';
let FACE_HEAD = FACE;
function pickFaces() {
  const has = f => { try { return document.fonts.check('16px ' + f); } catch (e) { return false; } };
  if (has('"prestige-elite-std"')) FACE = '"prestige-elite-std", "Courier Prime", monospace';
  FACE_HEAD = has('"Special Elite"') ? '"Special Elite", ' + FACE : FACE;
}
function srand(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

/* H — helpers handed to world draw hooks */
const H = {
  M,
  _cm: 3,                        // master px per screen cell (set each drawDyn)
  type(ctx, text, x, y, o = {}) {
    const cm = H._cm;
    let size = o.size || 30;
    if (o.cells) size = o.cells * cm;                 // physical sizing: N cells tall
    const rnd = srand((o.seed || 1) * 977 + text.length * 131);
    const face = o.head ? FACE_HEAD : FACE;
    ctx.save();
    if (o.plain || o.cells) {                         // snap to the cell grid
      x = Math.round(x / cm) * cm;
      y = Math.round(y / cm) * cm;
    }
    ctx.font = ((o.bold || o.cells || o.plain) ? "700 " : "400 ") + size + "px " + face;
    // draw text NICE (clean anti-aliased fill); the shader dithers it like everything else.
    // just a hair of stroke so big glyphs stay solid through the threshold.
    if (o.plain || o.cells) { ctx.lineWidth = Math.max(1.0, cm * 0.55); ctx.lineJoin = "round"; }
    ctx.textBaseline = "alphabetic";
    const sp = (o.spacing != null ? o.spacing : 0.06) * size;
    const widths = [...text].map(c => ctx.measureText(c).width + sp);
    const total = widths.reduce((a, b) => a + b, 0) - sp;
    let cx = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
    const base = o.alpha != null ? o.alpha : 0.92;
    const col = o.color || "#101010";
    const jk = o.plain ? 0 : Math.min(1, size / 52);      // small/plain type stays crisp
    const ghost = !o.plain && size >= 34;
    const solid = o.plain || o.cells;
    [...text].forEach((ch, idx) => {
      const jx = (rnd() - 0.5) * size * 0.055 * jk, jy = (rnd() - 0.5) * size * 0.075 * jk;
      const a = ghost ? base * (0.78 + rnd() * 0.30) : base;
      ctx.fillStyle = col; ctx.strokeStyle = col;
      if (ghost) {
        ctx.globalAlpha = Math.min(1, a * 0.42);          // double-strike ghost
        ctx.fillText(ch, cx + jx + size * 0.045, y + jy + size * 0.03);
      } else { rnd(); rnd(); }
      ctx.globalAlpha = Math.min(1, a);
      if (solid) ctx.strokeText(ch, cx + jx, y + jy);
      ctx.fillText(ch, cx + jx, y + jy);
      cx += widths[idx];
    });
    ctx.globalAlpha = 1;
    ctx.restore();
    return y + size * (o.lh || 1.5);
  },
  wrap(ctx, text, x, y, o = {}) {
    const size = o.cells ? o.cells * H._cm : (o.size || 30);
    const maxW = o.maxW || 1000, lh = (o.lh || 1.62) * size;
    ctx.font = "700 " + size + "px " + FACE;
    const words = text.split(/\s+/);
    let line = "", n = 0, yy = y;
    const lines = [];
    for (const w2 of words) {
      const t2 = line ? line + " " + w2 : w2;
      if (ctx.measureText(t2).width * 1.06 > maxW && line) { lines.push(line); line = w2; }
      else line = t2;
    }
    if (line) lines.push(line);
    const lim = o.chars != null ? o.chars : 1e9;          // type-on budget
    for (const ln of lines) {
      const take = Math.max(0, Math.min(ln.length, lim - n));
      if (take > 0) H.type(ctx, ln.slice(0, take), x, yy, { ...o, align: o.align || "left" });
      n += ln.length + 1;
      yy += lh;
      if (n > lim) break;
    }
    // done only when the type-on budget actually covers ALL the text — NOT `n`,
    // which over-counts (it adds each line's full length even when the last line
    // was only partially drawn), flipping done true while text is still typing.
    return { done: lim >= totalLen(lines), y: yy };
    function totalLen(ls) { return ls.reduce((a, b) => a + b.length + 1, 0) - 1; }
  },
  paper(ctx, x, y, w, h2, shade = 0.94) {
    const g = Math.round(238 * shade);
    ctx.fillStyle = `rgb(${g},${g - 3},${g - 9})`;
    ctx.fillRect(x, y, w, h2);
  },
  vignette(ctx, k = 0.5) {
    const g = ctx.createRadialGradient(M/2, M/2, M*0.28, M/2, M/2, M*0.74);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, M, M);
  },
  anim(card, dur, draw, onend) { S.anims.push({ card, t0: performance.now(), dur, draw, onend }); wake(); },
  sfx(n) { AUDIO.sfx(n); },
  S, P,
};

/* -------------------------------------------------------- layout / crop -- */
function computeView() {
  // FIXED square, centred, crisp-scaled. The whole square master is always shown.
  const w = S.cssW, h = S.cssH, side = Math.min(w, h);
  S.view = { x: (w - side) / 2, y: (h - side) / 2, w: side, h: side };
}
function resize(forceW, forceH) {
  let w = forceW || window.innerWidth, h = forceH || window.innerHeight;
  if (!w || !h) { w = 1000; h = 1000; }                // hidden-tab guard
  S.cssW = w; S.cssH = h;
  S.dpr = 1;                                            // backing is fixed; CSS scales it
  stage.width = P.back; stage.height = P.back;          // CONSTANT device pixels — detail never changes
  computeView();
  stage.style.width = S.view.w + "px"; stage.style.height = S.view.h + "px";
  stage.style.left = S.view.x + "px"; stage.style.top = S.view.y + "px";
  overlay.width = w; overlay.height = h;
  render();
}
function cropFor(card, forShader) {
  // whole square master shown; only flip mirrors the u axis
  if (forShader && card.flip) return { u0: 1, v0: 0, u1: 0, v1: 1 };
  return { u0: 0, v0: 0, u1: 1, v1: 1 };
}
function scr2master(x, y, card) {
  const nx = (x - S.view.x) / S.view.w, ny = (y - S.view.y) / S.view.h;
  return [ nx * M, ny * M ];
}
function master2scr(mx, my, card) {
  return [ S.view.x + (mx / M) * S.view.w, S.view.y + (my / M) * S.view.h ];
}

/* -------------------------------------------------------------- render -- */
function hasNavArrows(card) { return !!(card && card.nav && (card.nav.left || card.nav.right)); }
function needsLive() {
  const vizLive = S.playing && S.A && S.A.card.frames;
  return !!(S.trans || S.anims.length || vizLive || S.typeOn && !S.typeOn.done ||
            S.flickAnim || (S.A && (S.A.card.live || hasNavArrows(S.A.card))));
}
function wake() { if (!S.raf && !S.frozen) loop(); }
/* type-on watchdog: rAF is throttled inside the WP cross-origin iframe and in
   background tabs, which strands the placard typewriter mid-sentence. A wall-clock
   interval force-draws it to completion no matter what rAF does. (Same "never rely
   on rAF alone" rule as the transition watchdog.) */
function armTypeWatchdog() {
  clearInterval(S.typeTimer); S.typeTimer = 0;
  if (!S.typeOn || S.typeOn.done || S.frozen) return;
  S.typeTimer = setInterval(() => {
    if (!S.typeOn || S.typeOn.done || S.frozen) { clearInterval(S.typeTimer); S.typeTimer = 0; return; }
    S.A && (S.A.dirty = true); S.B && (S.B.dirty = true);
    render();
  }, 33);
}
function loop() {
  S.raf = requestAnimationFrame(() => { S.raf = 0; render(); if (needsLive()) loop(); });
}
function render(now) {
  if (!gl || glDead || !S.A) return;
  now = now || performance.now();
  computeView();

  // transition progress
  let mode = 0, prg = 1, hasB = 0, tdir = [1, 0], zc = [0.5, 0.5], seed = S.seed;
  if (S.trans) {
    const T = S.trans;
    prg = Math.min(1, (now - T.t0) / T.dur);
    mode = T.mode; hasB = 1; tdir = T.dir; zc = T.zc; seed = T.seed;
    if (T.frozen != null) prg = T.frozen;
    if (prg >= 1 && T.frozen == null) { finishTrans(); mode = 0; prg = 1; hasB = 0; }
  }

  // dynamic layers
  const liveA = S.A.card.frames || S.A.card.draw || S.anims.length || S.typeOn;
  const vizLive = (S.playing && S.A.card.frames) || S.A.card.live || hasNavArrows(S.A.card);
  if (liveA && (S.A.dirty || vizLive || S.anims.length || (S.typeOn && !S.typeOn.done)) &&
      (S.A.dirty || now - S.vizLast > 1000 / P.vizFps)) {
    if (S.typeOn && !S.typeOn.done) S.typeOn.chars = Math.floor((now - S.typeOn.t0) / 1000 * S.typeOn.cps);
    drawDyn(S.A, now); S.vizLast = now;
  }
  if (S.trans && S.B && (S.B.dirty || S.B.card.frames)) drawDyn(S.B, now);

  // flicker envelope
  if (S.flickAnim) {
    const k = (now - S.flickAnim.t0) / S.flickAnim.dur;
    if (k >= 1) { S.flick = 1; S.flickAnim = null; }
    else S.flick = 1 - S.flickAnim.amt * Math.sin(Math.PI * Math.min(1, k)) *
                   (0.7 + 0.3 * Math.sin(k * 47));
  }

  // uploads
  const srcA = cache.get(S.A.card.id);
  if (srcA) upload(texA, srcA.src);
  if (S.A.dirty) { upload(dynTexA, S.A.dyn.cv); S.A.dirty = false; }
  if (S.B) {
    const srcB = cache.get(S.B.card.id);
    if (srcB) upload(texB, srcB.src);
    if (S.B.dirty) { upload(dynTexB, S.B.dyn.cv); S.B.dirty = false; }
  }

  // uniforms
  const cA = cropFor(S.A.card, true), cB = S.B ? cropFor(S.B.card, true) : cA;
  const dA2 = cropFor(S.A.card), dB2 = S.B ? cropFor(S.B.card) : dA2;

  gl.viewport(0, 0, stage.width, stage.height);
  gl.uniform4f(uni.cropA, cA.u0, cA.v0, cA.u1, cA.v1);
  gl.uniform4f(uni.cropB, cB.u0, cB.v0, cB.u1, cB.v1);
  gl.uniform4f(uni.cropDA, dA2.u0, dA2.v0, dA2.u1, dA2.v1);
  gl.uniform4f(uni.cropDB, dB2.u0, dB2.v0, dB2.u1, dB2.v1);
  gl.uniform2f(uni.res, stage.width, stage.height);
  gl.uniform1f(uni.ditherPx, P.ditherPx);
  gl.uniform1f(uni.smoothR, P.smoothR);
  gl.uniform1f(uni.edgeAmt, P.edgeAmt);
  gl.uniform1i(uni.mode, mode);
  gl.uniform1f(uni.prog, prg);
  gl.uniform1f(uni.seed, seed);
  gl.uniform1f(uni.flick, S.flick);
  gl.uniform2f(uni.tdir, tdir[0], tdir[1]);
  gl.uniform2f(uni.zc, zc[0], zc[1]);
  gl.uniform3fv(uni.paper, P.paper);
  gl.uniform3fv(uni.ink, P.ink);
  gl.uniform1f(uni.hasB, hasB);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, dynTexA);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, dynTexB);
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  if (DEBUG) drawDebug();
}

/* --------------------------------------------------------- transitions -- */
const MODES = { cut:0, dissolve:1, wipe:2, barnOpen:3, barnClose:4, irisOpen:5,
                irisClose:6, checker:7, blinds:8, scroll:9, zoomOpen:10, zoomClose:11 };

function go(id, opt = {}) {
  const card = W.cards[id];
  if (!card || S.lock) return;
  S.lock = true;
  setCursor("watch");
  ensureMaster(card, () => {
    const dyn = mkDyn(card);
    S.B = { card, dyn, dirty: true };
    // card enter hook may set typeOn / schedule things
    S.typeOn = null;
    card.enter && card.enter(H, S);
    drawDyn(S.B, performance.now());
    const zc = opt.at ? maZC(opt.at, card, opt.fromCard) : [0.5, 0.5];
    S.trans = {
      mode: MODES[opt.t || "dissolve"] ?? 1,
      t0: performance.now(),
      dur: P.speeds[opt.spd || "fast"] || 340,
      dir: opt.dir || [1, 0],
      zc, seed: Math.random() * 800,
      target: id, opt,
    };
    wake();
    armTypeWatchdog();                            // placard type-on can't depend on rAF (iframe throttling)
    // watchdog: a throttled tab can stall rAF mid-transition with the lock held
    setTimeout(() => { if (S.trans && S.trans.frozen == null) render(); }, S.trans.dur + 120);
  });
}
function maZC(at, toCard, fromId) {
  // origin given in the *source* card's master coords → content uv
  const from = W.cards[fromId || S.cur] || toCard;
  const [sx, sy] = master2scr(at[0], at[1], from);
  return [ (sx - S.view.x) / S.view.w, (sy - S.view.y) / S.view.h ];
}
function finishTrans() {
  const T = S.trans;
  S.A.card.leave && S.A.card.leave(H, S);
  S.A = S.B; S.B = null; S.trans = null;
  S.A.dirty = true;      // force the dyn layer into texA — else the OLD room's text lingers
  S.cur = T.target;
  S.lock = false;
  const card = S.A.card;
  AUDIO.setRoom(card.room || "ent", card.depth);
  AUDIO.ambient(card.ambient || null);
  broadcastTone(card.tone || "ink");
  card.after && card.after(H, S);
  updateCursor();
  prefetchNeighbors(card);
  if (DEBUG) console.log("[mus] card:", S.cur);
}

/* ------------------------------------------------------------ hotspots -- */
function hotspotsFor(card) {
  const hs = [];
  (card.frames || []).forEach(f => {
    hs.push({ r: f.r, cur: "listen", fn: "toggleSong", song: f.song });
    const pr = plateRect(f);                        // the nameplate is the "read" click target
    hs.push({ r: pr, cur: "zoom", go: "plaque-" + f.song,
      t: "zoomOpen", spd: "fast", at: [pr[0] + pr[2] / 2, pr[1] + pr[3] / 2] });
  });
  (card.hots || []).forEach(h2 => hs.push(h2));
  return hs;
}
function hitAt(x, y) {
  const card = S.A.card;
  const [mx, my] = scr2master(x, y, card);
  const hs = hotspotsFor(card);
  for (let i = hs.length - 1; i >= 0; i--) {
    const r = hs[i].r;
    if (mx >= r[0] && mx <= r[0] + r[2] && my >= r[1] && my <= r[1] + r[3]) return hs[i];
  }
  // screen-edge nav bands (crop-independent, always reachable)
  const nav = card.nav || {};
  const bx = S.view.w * P.navBand, by = S.view.h * P.navBand;
  const inX = x - S.view.x, inY = y - S.view.y;
  if (inX < 0 || inY < 0 || inX > S.view.w || inY > S.view.h) return null;
  if (nav.left  && inX < bx)            return { cur: "left",  go: nav.left,  t: "scroll", dir: [-1, 0], edge: 1 };
  if (nav.right && inX > S.view.w - bx) return { cur: "right", go: nav.right, t: "scroll", dir: [1, 0],  edge: 1 };
  if (nav.back  && inY > S.view.h - by) return { cur: "back",  go: nav.back,  t: "dissolve", spd: "fast", edge: 1 };
  if (nav.fwd   && inY > S.view.h * 0.3 && inY < S.view.h * 0.78 &&
      inX > S.view.w * 0.34 && inX < S.view.w * 0.66)
    return { cur: "fwd", go: nav.fwd, t: "dissolve", spd: "fast", edge: 2 };
  return null;
}
function runHot(hot, x, y) {
  if (!hot) { AUDIO.sfx("tickSoft"); return; }
  if (hot.sfx) AUDIO.sfx(hot.sfx); else AUDIO.sfx("tick");
  if (hot.fn) {
    const f = ACTIONS[hot.fn] || W.ACTIONS[hot.fn];
    f && f(hot, H, S, [x, y]);
    S.A.dirty = true; wake();
  }
  if (hot.go) go(hot.go, { t: hot.t, spd: hot.spd, dir: hot.dir, at: hot.at, fromCard: S.cur });
}

/* core actions (world adds more in W.ACTIONS) */
const ACTIONS = {
  toggleSong(hot) {
    const id = hot.song;
    if (S.playing === id) { AUDIO.stop(); S.playing = null; }
    else {
      S.playing = id;
      AUDIO.play(id, () => { /* onended */ if (S.playing === id) { S.playing = null; S.A.dirty = true; render(); } });
      markPlayed(id);
    }
    S.A.dirty = true; wake();
  },
  back() { history.length; },
};
function markPlayed(id) {
  try {
    const p = new Set(JSON.parse(localStorage.getItem("retro.played") || "[]"));
    p.add(id); localStorage.setItem("retro.played", JSON.stringify([...p]));
  } catch (e) {}
}
H.played = () => { try { return new Set(JSON.parse(localStorage.getItem("retro.played") || "[]")); } catch (e) { return new Set(); } };
H.go = go; H.master2scr = master2scr; H.setCursor = c => setCursor(c);
// master brightness (0=black..1=white) at master coords — for auto-contrast text
H.sampleBg = (mx, my) => {
  const d = S.bgSample; if (!d) return 0.5;
  const x = Math.max(0, Math.min(95, Math.round(mx / M * 96)));
  const y = Math.max(0, Math.min(95, Math.round(my / M * 96)));
  return d.data[(y * 96 + x) * 4] / 255;
};

/* --------------------------------------------------------------- input -- */
let pDown = null, hoverHot = null;

function setCursor(c) {
  document.body.className = document.body.className.replace(/\bcur-[\w]+/g, "").trim();
  document.body.classList.add("cur-" + c);
  if (DEBUG) document.body.classList.add("debug");
  document.body.classList.toggle("ready", READY);
}
let watchTimer = 0, watchFrame = 0;
function updateCursor(x, y) {
  if (S.lock) { setCursor("watch"); startWatch(); return; }
  stopWatch();
  if (x == null) { x = lastMove[0]; y = lastMove[1]; }
  const hot = hitAt(x, y);
  if (hot !== hoverHot) {                       // entered a new hotspot
    hoverHot = hot; S.hover = hot;
    if (hot && hot.onHover) {
      const f = ACTIONS[hot.onHover] || W.ACTIONS[hot.onHover];
      if (f) f(hot, H, S, [x, y]);
    }
    S.A.dirty = true; wake();                   // hover-driven visuals (e.g. the exit prompt) update
  }
  let cur = hot ? hot.cur || "hand" : "arrow";
  if (hot && hot.curKey && S.st && S.st.hasKey) cur = hot.curKey;   // key in hand → key cursor
  setCursor(cur);
}
function startWatch() {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    watchFrame ^= 1;
    if (document.body.className.includes("cur-watch"))
      setCursor(watchFrame ? "watch2" : "watch");
  }, 420);
}
function stopWatch() { if (watchTimer) { clearInterval(watchTimer); watchTimer = 0; } }

let lastMove = [0, 0];
stage.addEventListener("pointerdown", e => {
  S.lastInput = performance.now();
  AUDIO.unlock();
  pDown = [e.clientX, e.clientY, performance.now()];
});
stage.addEventListener("pointermove", e => {
  S.lastInput = performance.now();
  AUDIO.unlock();                       // the room tone starts the moment the visitor stirs
  lastMove = [e.clientX, e.clientY];
  updateCursor(e.clientX, e.clientY);
});
stage.addEventListener("pointerup", e => {
  if (!pDown) return;
  const dx = e.clientX - pDown[0], dy = e.clientY - pDown[1];
  const moved = Math.hypot(dx, dy) > 9;
  pDown = null;
  if (moved || S.lock) return;
  const hot = hitAt(e.clientX, e.clientY);
  runHot(hot, e.clientX, e.clientY);
});
stage.addEventListener("pointercancel", () => { pDown = null; });
window.addEventListener("keydown", e => {
  S.lastInput = performance.now();
  AUDIO.unlock();
  if (S.lock) return;
  const card = S.A && S.A.card; if (!card) return;
  const nav = card.nav || {};
  const key = e.key;
  const map = { ArrowUp: "fwd", ArrowDown: "back", ArrowLeft: "left", ArrowRight: "right",
                Enter: "fwd", Escape: "back", Backspace: "back" };
  const dirName = map[key];
  if (!dirName) return;
  if (document.body.classList.contains("gb-open")) return;
  const target = nav[dirName];
  if (target) {
    e.preventDefault();
    const t = dirName === "left" || dirName === "right" ? "scroll" : "dissolve";
    const dir = dirName === "left" ? [-1, 0] : dirName === "right" ? [1, 0] : [1, 0];
    AUDIO.sfx("tick");
    go(target, { t, dir, spd: "fast" });
  }
});

/* --------------------------------------------------------- idle events -- */
setInterval(() => {
  if (S.frozen || !READY) return;
  // second watchdog layer: never leave a finished transition (or its lock) hanging
  if (S.trans && S.trans.frozen == null &&
      performance.now() - S.trans.t0 > S.trans.dur + 400) render();
  // never leave the lights stuck dim: if a dip outran its duration (throttled rAF), finish it
  if (S.flickAnim && performance.now() - S.flickAnim.t0 > S.flickAnim.dur + 400) {
    S.flick = 1; S.flickAnim = null; S.A && (S.A.dirty = true); render();
  }
  const idle = (performance.now() - S.lastInput) / 1000;
  const card = S.A && S.A.card;
  if (!card) return;
  if (idle > P.idleFlicker && !S.flickAnim && card.room !== "ent") {
    S.flickAnim = { t0: performance.now(), dur: 1500, amt: 0.42 };
    AUDIO.sfx("buzz");
    S.lastInput = performance.now() - (P.idleFlicker - 26) * 1000; // next in ~26s
    wake();
  } else if (idle > 20 && Math.random() < 0.13) {
    AUDIO.sfx("thunk");
  }
}, 5000);

/* --------------------------------------------------------------- debug -- */
const DEBUG = qs.get("debug") === "1";
function drawDebug() {
  const c = overlay.getContext("2d");
  c.clearRect(0, 0, overlay.width, overlay.height);
  const card = S.A.card;
  c.font = "12px monospace";
  hotspotsFor(card).forEach(h2 => {
    const [x0, y0] = master2scr(h2.r[0], h2.r[1], card);
    const [x1, y1] = master2scr(h2.r[0] + h2.r[2], h2.r[1] + h2.r[3], card);
    c.strokeStyle = h2.go ? "rgba(0,160,255,.8)" : "rgba(255,80,0,.8)";
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = "rgba(0,0,0,.6)";
    c.fillText(h2.go || h2.fn || "?", x0 + 3, y0 + 12);
  });
  c.fillStyle = "rgba(0,0,0,.7)";
  c.fillRect(6, 6, 210, 20);
  c.fillStyle = "#fff";
  c.fillText(S.cur + (S.playing ? "  ♫ " + S.playing : ""), 10, 20);
}

/* ------------------------------------------------- environment plumbing -- */
function broadcastTone(tone) {
  const col = tone === "paper" ? "#f2efe7" : "#101010";
  document.body.style.backgroundColor = col;      // color only — leave backgroundImage (star field) alone
  let meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", col);
  try { if (window.parent !== window) window.parent.postMessage({ retro: "bg", color: col }, "*"); } catch (e) {}
}
window.addEventListener("resize", () => resize());
window.addEventListener("pageshow", e => {
  if (e.persisted) {
    if (gl && gl.isContextLost && gl.isContextLost()) location.reload();
    else { resize(); render(); }
  }
});
stage.addEventListener("webglcontextlost", e => { e.preventDefault(); glDead = true; });
stage.addEventListener("webglcontextrestored", () => {
  glDead = false; glInit(); resize(); S.A && (S.A.dirty = true); render();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) { resize(); } });

/* ---------------------------------------------------------------- boot -- */
let READY = false;
function boot() {
  if (!glInit()) return;
  W.build(H);                                   // world assembles cards (plaques etc)
  pickFaces();
  const start = qs.get("card") && W.cards[qs.get("card")] ? qs.get("card") : W.start;
  const card = W.cards[start];
  ensureMaster(card, () => {
    S.A = { card, dyn: mkDyn(card), dirty: true };
    S.cur = start;
    card.enter && card.enter(H, S);
    armTypeWatchdog();
    drawDyn(S.A, performance.now());
    resize();
    READY = true;
    document.body.classList.add("ready");
    broadcastTone(card.tone || "ink");
    AUDIO.setRoom(card.room || "ent", card.depth);
    prefetchNeighbors(card);
    card.after && card.after(H, S);
    updateCursor(innerWidth / 2, innerHeight / 2);
  });
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => { pickFaces(); if (S.A) { S.A.dirty = true; render(); } });
}
boot();

/* ---------------------------------------------------------- debug hooks -- */
window.__mus = {
  go: (id, opt) => go(id, opt || { t: "cut" }),
  freeze(prog) { S.frozen = true; if (S.trans) S.trans.frozen = prog; if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; } render(); },
  unfreeze() { S.frozen = false; if (S.trans) S.trans.frozen = null; wake(); },
  renderOnce: () => { if (S.A) S.A.dirty = true; render(); },
  wake: () => wake(),            // start the live render loop (e.g. after the webcam turns on)
  play: id => { ACTIONS.toggleSong({ song: id }); },
  hot: () => S.A ? hotspotsFor(S.A.card) : [],
  hit: (x, y) => hitAt(x, y),
  forceSize: (w, h) => resize(w, h),
  state: S, P, W,
  cursor: () => document.body.className,
};

})();
