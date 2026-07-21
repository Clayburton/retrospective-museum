/* =============================================================================
   the [retrospective] museum — the entrance banner
   =============================================================================
   One three.js quad running the MUSEUM'S OWN dither (blur the master to recover
   tone, then re-dither at one consistent cell size), so this strip and the world
   behind the door are unmistakably the same object.

   Quick to load on purpose: no models, no post stack, two textures — a 59KB
   facade and a 2D canvas for the type and the mouse. three is pinned to the same
   jsDelivr build every other clay-and-kelsy piece uses, so it's usually cached.
   ========================================================================== */
import * as THREE from "three";

/* WHERE THE DOOR LEADS — set this to the WordPress page the museum is embedded
   on. It navigates the TOP window, so it must be the WP page, not the raw
   github.io URL. Change this one line and re-push. */
const MUSEUM_URL = "https://clayandkelsy.com/retrospective/";
const M = 1536;                    // master square, same coordinate space as the museum
const DYN = 1152;                  // the 2D layer's resolution

const P = {
  ditherPx: 2.0,                   // device px per dither cell
  smoothR:  2.4,                   // master blur radius — recovers tone from the 1-bit art
  edgeAmt:  0.95,                  // how hard the master is re-dithered
  paper: [0.953, 0.945, 0.925],
  ink:   [0.043, 0.043, 0.047],
  dprCap: 2,
  focusY: 950,                     // the building's heart — what stays framed when we crop
};

/* --------------------------------------------------------------- shaders -- */
const VERT = /* glsl */`
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tMaster, tDyn;
uniform vec4  crop;          // master sample rect (cover-fit)
uniform vec2  res;           // canvas device px
uniform float ditherPx, smoothR, edgeAmt, flick;
uniform vec3  paper, ink;
in  vec2 vUv;
out vec4 outC;

const int B8[64] = int[64](
   0,32, 8,40, 2,34,10,42,  48,16,56,24,50,18,58,26,
  12,44, 4,36,14,46, 6,38,  60,28,52,20,62,30,54,22,
   3,35,11,43, 1,33, 9,41,  51,19,59,27,49,17,57,25,
  15,47, 7,39,13,45, 5,37,  63,31,55,23,61,29,53,21);

void main(){
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);              // image space, v down
  vec2 blur = vec2(smoothR) / res;

  // 3x3 box-blur the master → approximate TONE out of the baked 1-bit art
  float g = 0.0;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2(-blur.x,-blur.y))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2( 0.0,   -blur.y))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2( blur.x,-blur.y))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2(-blur.x, 0.0   ))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv)).r * 2.0;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2( blur.x, 0.0   ))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2(-blur.x, blur.y))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2( 0.0,    blur.y))).r;
  g += texture(tMaster, mix(crop.xy, crop.zw, uv + vec2( blur.x, blur.y))).r;
  g /= 10.0;

  // the dynamic layer lives in the SAME master square, so it must take the SAME
  // crop — otherwise the type drifts off the frieze it was measured against
  vec4 dd = texture(tDyn, mix(crop.xy, crop.zw, uv));   // crisp, never blurred
  g = mix(g, dd.r, dd.a);
  g *= flick;

  // master re-dithers hard; the dynamic layer only dithers its MID-tones so solid
  // type stays crisp and readable
  vec2 cell = floor(gl_FragCoord.xy / ditherPx);
  int bi = B8[int(mod(cell.y, 8.0)) * 8 + int(mod(cell.x, 8.0))];
  float bay    = (float(bi) + 0.5) / 64.0;
  float dynSel = clamp(dd.a * 3.0, 0.0, 1.0);
  float dynMid = 1.0 - abs(g - 0.5) * 2.0;
  float amp    = mix(edgeAmt, dynMid, dynSel);
  float bit    = g > (0.5 + (bay - 0.5) * amp) ? 1.0 : 0.0;
  outC = vec4(mix(ink, paper, bit), 1.0);
}`;

/* ------------------------------------------------------------------ state -- */
const stage = document.getElementById("stage");
const S = {
  w: 0, h: 0, dpr: 1,
  view: { scale: 1, fx: 768, fy: P.focusY },   // master→canvas mapping (cover fit)
  hot: null,          // which region the pointer is over
  ptr: { x: -1, y: -1 },
  mouseRun: 0,        // timestamp the grass mouse started running
  flickA: null,
  hoverCta: false,
  raf: 0, last: 0, need: true,
};

/* master-space regions, lifted straight from the museum's facade card */
const R_SIGN  = [280, 470, 700, 150];      // the frieze — knock on it
const R_GRASS = [980, 1150, 520, 330];     // the tufts on the right — something lives there
let   R_CTA   = [0, 0, 0, 0];              // filled in when the plate is drawn

/* ------------------------------------------------------------------ audio -- */
let AC = null;
const ac = () => (AC = AC || new (window.AudioContext || window.webkitAudioContext)());
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0004, t0 + a + d);
}
function tone(freq, type, dur, peak, when, bend) {
  const c = ac(), t0 = c.currentTime + (when || 0);
  const o = c.createOscillator(); o.type = type || "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(bend, t0 + dur);
  const g = c.createGain(); env(g, t0, 0.004, peak, dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.1);
}
function burst(dur, peak, fc, type, when) {
  const c = ac(), t0 = c.currentTime + (when || 0);
  const n = Math.floor(c.sampleRate * dur);
  const b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = b;
  const f = c.createBiquadFilter(); f.type = type || "bandpass"; f.frequency.value = fc || 2000; f.Q.value = 1.1;
  const g = c.createGain(); env(g, t0, 0.003, peak, dur);
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
}
const SFX = {
  knock() { tone(92, "sine", 0.09, 0.34, 0, 60); burst(0.03, 0.26, 320, "lowpass");
            tone(88, "sine", 0.09, 0.28, 0.17, 58); burst(0.03, 0.2, 300, "lowpass", 0.17); },
  rustle(){ for (let i = 0; i < 5; i++) burst(0.05, 0.10, 5200 + Math.random() * 1600, "highpass", i * 0.05); },
  squeak(){ tone(2900, "sine", 0.07, 0.08, 0, 3600); tone(3300, "sine", 0.05, 0.05, 0.09, 2700); },
  creak() { tone(150, "sawtooth", 0.5, 0.05, 0, 70); burst(0.3, 0.05, 500, "lowpass"); },
};

/* ------------------------------------------------------- the dynamic layer -- */
const dyn = document.createElement("canvas");
dyn.width = dyn.height = DYN;
const dx = dyn.getContext("2d");
const K = DYN / M;                                   // master → dyn-canvas scale

function face(px, bold) { return (bold ? "700 " : "400 ") + px + "px 'Courier Prime', 'Courier New', monospace"; }

/* the museum's typewriter: bold, stroke-reinforced, a hair of jitter */
function type(text, mx, my, o = {}) {
  const size = (o.cells || 5) * 5.0 * K;
  dx.save();
  dx.font = face(size, true);
  dx.textAlign = o.align || "center";
  dx.textBaseline = "middle";
  dx.fillStyle = o.color || "#101010";
  dx.strokeStyle = o.color || "#101010";
  dx.lineWidth = Math.max(1, size * 0.055);
  dx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  const sp = o.spacing || 0;
  const X = mx * K, Y = my * K;
  if (sp) {
    const chars = [...text];
    const w = chars.reduce((a, c) => a + dx.measureText(c).width, 0) + sp * size * (chars.length - 1);
    let cx = X - (o.align === "left" ? 0 : w / 2);
    dx.textAlign = "left";
    for (const c of chars) {
      dx.strokeText(c, cx, Y); dx.fillText(c, cx, Y);
      cx += dx.measureText(c).width + sp * size;
    }
  } else {
    dx.strokeText(text, X, Y); dx.fillText(text, X, Y);
  }
  dx.restore();
  return dx.measureText(text).width / K;
}

function drawMouse(k) {
  // startled — already running, tail whipping (no peek; same as the museum's)
  // its lane is pinned inside the VISIBLE crop, or it scurries off below the frame
  const bx = R_GRASS[0] + R_GRASS[2] * 0.5;
  const by = Math.min(1330, S.view.fy + S.view.visH / 2 - 70);
  const x = (bx - k * 620) * K, y = (by - 6 + Math.sin(k * 34) * 4) * K;
  dx.save();
  dx.fillStyle = "rgb(22,22,20)"; dx.strokeStyle = "rgb(22,22,20)";
  dx.beginPath(); dx.ellipse(x, y + 18 * K, 30 * K, 15 * K, 0.05, 0, 7); dx.fill();
  dx.beginPath(); dx.arc(x - 20 * K, y + 8 * K, 15 * K, 0, 7); dx.fill();
  dx.lineWidth = 5 * K; dx.lineCap = "round";
  dx.beginPath(); dx.moveTo(x + 28 * K, y + 20 * K);
  dx.quadraticCurveTo(x + 56 * K, y + 8 * K, x + 74 * K, y + 24 * K); dx.stroke();
  dx.restore();
}

function drawDyn(now) {
  dx.clearRect(0, 0, DYN, DYN);

  // 1. the building's own lettering, on its blank frieze
  type("RETROSPECTIVE", 762, 566, { cells: 10, color: "#101010", spacing: 0.08 });
  type("clay and kelsy", 762, 604, { cells: 4.6, color: "#101010" });

  // 2. the invitation — a flat sticker plate, black on paper, inverting on hover
  const label = "[ enter the museum ]";
  const cells = 6.4, fs = cells * 5.0 * K;
  dx.font = face(fs, true);
  const tw = dx.measureText(label).width / K;
  // the invitation must never be cropped away, whatever the strip's proportions
  const cy = Math.min(1268, S.view.fy + S.view.visH / 2 - 96);
  const pw = tw + 96, ph = 108, px = 768 - pw / 2, py = cy - ph / 2;
  S.ctaY = cy;
  R_CTA = [px, py, pw, ph];

  const on = S.hoverCta;
  dx.save();
  dx.fillStyle = on ? "#101010" : "rgb(244,241,232)";
  dx.fillRect(px * K, py * K, pw * K, ph * K);
  dx.strokeStyle = on ? "rgb(244,241,232)" : "#101010";
  dx.lineWidth = 4 * K;
  dx.strokeRect(px * K + 6 * K, py * K + 6 * K, pw * K - 12 * K, ph * K - 12 * K);
  dx.restore();
  type(label, 768, cy, { cells, color: on ? "rgb(244,241,232)" : "#101010", spacing: 0.02 });

  // 3. the mouse, if something startled it
  if (S.mouseRun) {
    const k = (now - S.mouseRun) / 760;
    if (k >= 1) S.mouseRun = 0; else drawMouse(k);
  }

  tex.dyn.needsUpdate = true;
}

/* ------------------------------------------------------------------- three -- */
const renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: false, alpha: false,
                                           depth: false, stencil: false, powerPreference: "low-power" });
renderer.setClearColor(0x101010, 1);
const scene = new THREE.Scene();
const cam = new THREE.Camera();

const tex = { master: null, dyn: new THREE.CanvasTexture(dyn) };
tex.dyn.minFilter = tex.dyn.magFilter = THREE.LinearFilter;
tex.dyn.generateMipmaps = false;
tex.dyn.flipY = false;        // the shader flips to image space itself — don't double-flip

const U = {
  tMaster: { value: null }, tDyn: { value: tex.dyn },
  crop:  { value: new THREE.Vector4(0, 0, 1, 1) },
  res:   { value: new THREE.Vector2(1, 1) },
  ditherPx: { value: P.ditherPx }, smoothR: { value: P.smoothR },
  edgeAmt:  { value: P.edgeAmt },  flick:   { value: 1 },
  paper: { value: new THREE.Vector3(...P.paper) },
  ink:   { value: new THREE.Vector3(...P.ink) },
};
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: U,
                             glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false })
);
quad.frustumCulled = false;
scene.add(quad);

new THREE.TextureLoader().load("assets/facade.png?v=4", t => {
  t.minFilter = t.magFilter = THREE.LinearFilter;    // LINEAR so the blur can recover tone
  t.generateMipmaps = false;
  t.flipY = false;                                   // shader works in image space
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  tex.master = t; U.tMaster.value = t;
  S.need = true; kick();
});

/* ------------------------------------------------------------------ layout -- */
function resize() {
  const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
  S.dpr = Math.min(window.devicePixelRatio || 1, P.dprCap);
  S.w = w; S.h = h;
  renderer.setPixelRatio(S.dpr);
  renderer.setSize(w, h, false);
  stage.style.width = w + "px"; stage.style.height = h + "px";

  // COVER-fit the square master, keeping the building framed
  const scale = Math.max(w / M, h / M);
  const visW = w / scale, visH = h / scale;
  const fx = Math.min(Math.max(768, visW / 2), M - visW / 2);
  const fy = Math.min(Math.max(P.focusY, visH / 2), M - visH / 2);
  S.view = { scale, fx, fy, visW, visH };
  U.crop.value.set((fx - visW / 2) / M, (fy - visH / 2) / M,
                   (fx + visW / 2) / M, (fy + visH / 2) / M);
  U.res.value.set(w * S.dpr, h * S.dpr);
  S.need = true; kick();
}

const m2c = (mx, my) => [ (mx - (S.view.fx - S.view.visW / 2)) * S.view.scale,
                          (my - (S.view.fy - S.view.visH / 2)) * S.view.scale ];
const c2m = (cx, cy) => [ cx / S.view.scale + (S.view.fx - S.view.visW / 2),
                          cy / S.view.scale + (S.view.fy - S.view.visH / 2) ];

/* ------------------------------------------------------------------ input -- */
const inRect = (m, r) => m[0] >= r[0] && m[0] <= r[0] + r[2] && m[1] >= r[1] && m[1] <= r[1] + r[3];

function hitAt(cx, cy) {
  const m = c2m(cx, cy);
  if (inRect(m, R_CTA))   return "cta";
  if (inRect(m, R_GRASS)) return "grass";
  if (inRect(m, R_SIGN))  return "sign";
  return "enter";                       // the whole strip is the door
}
function setCursor(c) {
  document.body.className = c ? "cur-" + c : "";
}
function onMove(e) {
  const cx = e.clientX, cy = e.clientY;
  S.ptr.x = cx; S.ptr.y = cy;
  const h = hitAt(cx, cy);
  if (h !== S.hot) {
    S.hot = h;
    const wasCta = S.hoverCta;
    S.hoverCta = (h === "cta");
    setCursor(h === "grass" || h === "sign" ? "hand" : "fwd");
    if (wasCta !== S.hoverCta) { S.need = true; kick(); }
  }
}
function enterMuseum() {
  SFX.creak();
  setTimeout(() => {
    try { window.top.location.href = MUSEUM_URL; } catch (e) { window.location.href = MUSEUM_URL; }
  }, 170);
}
function onDown(e) {
  const h = hitAt(e.clientX, e.clientY);
  if (h === "grass") {
    if (!S.mouseRun) { SFX.rustle(); setTimeout(SFX.squeak, 120); S.mouseRun = performance.now(); kick(); }
    return;
  }
  if (h === "sign") { SFX.knock(); flick(0.30, 900); return; }
  enterMuseum();
}
function flick(amt, dur) { S.flickA = { t0: performance.now(), dur, amt }; kick(); }

stage.addEventListener("pointermove", onMove);
stage.addEventListener("pointerdown", onDown);
stage.addEventListener("pointerleave", () => { S.hot = null; S.hoverCta = false; setCursor(null); S.need = true; kick(); });
window.addEventListener("resize", resize);
window.addEventListener("pageshow", e => { if (e.persisted) { resize(); } });
stage.addEventListener("webglcontextlost", e => { e.preventDefault(); });
stage.addEventListener("webglcontextrestored", () => { resize(); });

/* ------------------------------------------------------------------- loop -- */
function busy() { return !!(S.mouseRun || S.flickA); }
function kick() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
function frame(now) {
  S.raf = 0;
  if (S.flickA) {
    const k = (now - S.flickA.t0) / S.flickA.dur;
    if (k >= 1) { U.flick.value = 1; S.flickA = null; }
    else U.flick.value = 1 - S.flickA.amt * Math.sin(Math.PI * Math.min(1, k)) * (0.7 + 0.3 * Math.sin(k * 47));
  }
  drawDyn(now);
  renderer.render(scene, cam);
  S.need = false;
  if (busy()) kick();
}
// wall clock too — rAF is throttled inside a cross-origin iframe
setInterval(() => { if (busy() || S.need) kick(); }, 120);

resize();
kick();

window.__enter = { S, P, U, resize, kick, flick, mouse: () => { S.mouseRun = performance.now(); kick(); } };
