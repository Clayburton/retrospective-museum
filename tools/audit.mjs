#!/usr/bin/env node
/* World-graph audit: run `node tools/audit.mjs` from museum/.
   - every card reachable from start
   - every card has an exit
   - every hotspot / nav target exists
   - every song hangs in exactly one frame; blurb + file present
   - nav-critical hotspots sit inside the portrait-safe x band (336…1200)   */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));

// --- shims so world.js runs headless -------------------------------------
global.window = {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.document = { getElementById: () => null, body: { classList: { add(){}, remove(){} } } };
global.Image = class { set src(v) {} };
global.performance = { now: () => 0 };

eval(readFileSync(join(dir, "..", "world.js"), "utf8"));
const W = global.window.WORLD;
W.build({});   // assembles plaque cards

const M = 1536, SAFE = [336, 1200];
let fails = 0, warns = 0;
const fail = m => { console.log("  ✗ " + m); fails++; };
const warn = m => { console.log("  ~ " + m); warns++; };

const cards = W.cards;
const ids = Object.keys(cards);
console.log(`cards: ${ids.length}   songs: ${Object.keys(W.songs).length}\n`);

// ---- targets exist + collect edges ---------------------------------------
const edges = {};
for (const id of ids) {
  const c = cards[id];
  const out = new Set();
  (c.hots || []).forEach(h => {
    if (h.go) { out.add(h.go); if (!cards[h.go]) fail(`${id}: hotspot target '${h.go}' missing`); }
  });
  Object.entries(c.nav || {}).forEach(([k, t]) => {
    if (t) { out.add(t); if (!cards[t]) fail(`${id}: nav.${k} target '${t}' missing`); }
  });
  (c.frames || []).forEach(f => {
    out.add("plaque-" + f.song);
    if (!W.songs[f.song]) fail(`${id}: frame references unknown song '${f.song}'`);
  });
  edges[id] = [...out];
}
// fn-driven gos the static walk can't see — declare them
edges["hall-2"].push("mirror");                  // the janitor's key opens the 2nd door
edges["hall-2"].push("hframe");                  // the two hallway pictures zoom in
edges["y17a"].push("mh-zoom1");                  // the mouse-hole picture

// ---- reachability --------------------------------------------------------
const seen = new Set([W.start]);
const q = [W.start];
while (q.length) for (const t of edges[q.shift()] || []) if (!seen.has(t)) { seen.add(t); q.push(t); }
ids.filter(id => !seen.has(id)).forEach(id => fail(`unreachable card: ${id}`));

// ---- exits ---------------------------------------------------------------
for (const id of ids) if (!(edges[id] || []).length) fail(`dead end (no exit): ${id}`);

// ---- songs hung exactly once + data present ------------------------------
const hung = {};
for (const id of ids) (cards[id].frames || []).forEach(f => { hung[f.song] = (hung[f.song] || 0) + 1; });
for (const sid of Object.keys(W.songs)) {
  const s = W.songs[sid];
  if ((hung[sid] || 0) !== 1) fail(`song '${sid}' hangs in ${hung[sid] || 0} frames (want 1)`);
  if (!s.blurb) fail(`song '${sid}' missing blurb`);
  if (!s.file) fail(`song '${sid}' missing file`);
  if (!s.plateLine) fail(`song '${sid}' missing plateLine`);
}

// ---- portrait-safe nav ---------------------------------------------------
for (const id of ids) {
  if (cards[id].aspectMin) continue;                 // wide cards letterbox instead of cropping
  (cards[id].hots || []).forEach(h => {
    if (!h.go || !h.r) return;                       // toys may live anywhere
    if (h.go === "mousehole") return;                // secrets may hide off the phone path
    const [x, , w] = h.r;
    if (x < SAFE[0] - 4 || x + w > SAFE[1] + 4)
      warn(`${id}: nav hotspot → '${h.go}' leaves portrait-safe band (x ${x}…${x + w})`);
  });
  (cards[id].frames || []).forEach(f => {
    const [x, , w] = f.r;
    if (x < SAFE[0] - 4 || x + w > SAFE[1] + 4)
      warn(`${id}: frame '${f.song}' leaves portrait-safe band (x ${x}…${x + w})`);
  });
}

console.log(`\n${fails} failures, ${warns} warnings`);
process.exit(fails ? 1 : 0);
