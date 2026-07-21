"use strict";
/* ============================================================================
   world.js — THE MUSEUM (v2, Clay's "Better art" + fixed-square rebuild).

   ► Coordinates are MASTER coords in a 1536 square. The WHOLE square master is
     always shown (fixed-square window), so master↔screen is a straight scale.
     Art is native 1254² — multiply an art pixel by 1.225 to get master coords.
   ► card.img = "assets/art/xxx.png" (already-1bit line art; the engine only
     thresholds it, so it stays crisp). ?debug=1 draws every hotspot.
   ============================================================================ */
(function () {

const M = 1536;
const V = "assets/art/";

/* ============================================================ THE SONGS == */
const songs = {
  "laputa": { id:"laputa", title:"Laputa", n:1, room:"early", date:"march 29th, 2013",
    plateLine:"march 29th, 2013  ·  read", file:"laputa.mp3",
    blurb:"One of Clay's application songs to The Institute of Sonology. It is the oldest song on [retrospective]. Spending most of her childhood behind the drums, writing a song was something that was harder to grasp. This was one of their first attempts to express themselves with melody and production." },
  "intro": { id:"intro", title:"Intro", n:2, room:"early", date:"july 13th, 2016",
    plateLine:"july 13th, 2016  ·  read", file:"intro.mp3",
    blurb:"Clay said, \"This song is an introduction to the sounds of my past. It is made using field recordings from a dutch train, walking around Kings Day, and a forgotten cylinder.\"" },
  "no-good-reason": { id:"no-good-reason", title:"No Good Reason", n:3, room:"y17", date:"june 5th, 2017",
    plateLine:"june 5th, 2017  ·  read", file:"no-good-reason.mp3",
    blurb:"One of the first songs Kelsy wrote and produced on her own. \"I couldn't share what was going on inside my own mental labyrinth but you made it better.\"" },
  "currently-alone": { id:"currently-alone", title:"Currently Alone", n:4, room:"y17", date:"july 14th, 2017",
    plateLine:"july 14th, 2017  ·  read", file:"currently-alone.mp3",
    blurb:"Kelsy wrote and produced this song as an experiment to write about the long and lonely moment where one has to decide in all seriousness that this is the right person in life to pursue." },
  "casino": { id:"casino", title:"Casino", n:5, room:"y17", date:"september 1st, 2017",
    plateLine:"september 1st, 2017  ·  read", file:"casino.mp3",
    blurb:"Clay made this song in a single take on the Eurorack. \"It's very technical for a live piece and a success of what I wanted to get out of the rack.\"" },
  "wondering": { id:"wondering", title:"Wondering", n:6, room:"y17", date:"october 3rd, 2017",
    plateLine:"october 3rd, 2017  ·  read", file:"wondering.mp3",
    blurb:"Kelsy started to write Wondering on the piano and later recorded the rest of the song with a Eurorack patch that Clay had left patched earlier that day." },
  "i-can-do-it-all": { id:"i-can-do-it-all", title:"I Can Do It All", n:7, room:"y17", date:"october 22nd, 2017",
    plateLine:"october 22nd, 2017  ·  read", file:"i-can-do-it-all.mp3",
    blurb:"Kelsy recorded this song with a close friend. \"We all make the choice to be a good person or not. I just knew I wanted to be loved.\"" },
  "heartbeats": { id:"heartbeats", title:"Heartbeats", n:8, room:"late", date:"july 10th, 2018",
    plateLine:"july 10th, 2018  ·  read", file:"heartbeats.mp3",
    blurb:"Clay and Kelsy's first attempt at a pop song. \"The belief that no matter what someone has been going through emotionally, our hearts will always be capable of feeling love time and time again.\"" },
  "i-cant-forget": { id:"i-cant-forget", title:"I Can't Forget", n:9, room:"late", date:"july 16th, 2019",
    plateLine:"july 16th, 2019  ·  read", file:"i-cant-forget.mp3",
    blurb:"\"I can't promise you good luck if you don't believe in luck and I can't forget what you did to us.\"" },
  "seven": { id:"seven", title:"07/07/11", n:10, room:"late", date:"august 3rd, 2019",
    plateLine:"august 3rd, 2019  ·  read", file:"07-07-11.mp3",
    blurb:"\"The day we started dating I saw a big rock in a river and I jumped over to it and started to write. I looked over and saw you sitting there like an angel. I saw your ability to truly be present in the moment. That was the most beautiful thing in the world to me and I knew right then that my life was meant to be with yours.\"" },
  "bea5": { id:"bea5", title:"BEA5", n:11, room:"late", date:"september 14th, 2019",
    plateLine:"september 14th, 2019  ·  read", file:"bea5.mp3",
    blurb:"BEA5 is on the basement floor of the Institute of Sonology. Clay made this piece with a friend out of found recordings from her time spent down there. \"I can be aggressive. I can be loud. I can make you know that I am here.\"" },
  "hate-me": { id:"hate-me", title:"Hate Me (remix)", n:12, room:"annex", date:"july 1st, 2019",
    plateLine:"july 1st, 2019  ·  read", file:"hate-me-remix.mp3",
    blurb:"Hate Me (with JuiceWRLD) REMIX. Ellie Goulding was our friend Steve's favorite artist. When we hear her music we think of him. Clay experimented with this remix and dedicated it to Steve and now to JuiceWRLD, who we lost way too soon. Please remember to love the misunderstood." },
  "kanye": { id:"kanye", title:"Kanye West (remix)", n:13, room:"annex", date:"july 18th, 2019",
    plateLine:"july 18th, 2019  ·  read", file:"kanye-remix.mp3",
    blurb:"Kanye West (feat. Wyclef Jean) REMIX. Clay made an attempt at a young thug remix. It is definitely unofficial but that is kind of the fun of it." },
};
const ALBUM11 = ["laputa","intro","no-good-reason","currently-alone","casino","wondering",
                 "i-can-do-it-all","heartbeats","i-cant-forget","seven","bea5"];

/* ============================================ art elements (transparent) == */
const IMG = {};
function loadImg(name) {
  if (!IMG[name]) { const i = new Image();
    const L = window.LOADER; L && L.expect(1);
    const tick = () => { L && L.did(); };
    i.onload = () => { tick(); if (window.__mus) { window.__mus.state.A && (window.__mus.state.A.dirty = true); window.__mus.renderOnce(); } };
    i.onerror = tick;                                   // a missing element must not stall the loader
    i.src = V + name + ".png?av=9"; IMG[name] = i; }
  return IMG[name];
}
["el-key","el-key-w","el-ufo","el-straysky","el-hpic1","el-hpic2","el-reds","el-mirror-mask","el-movie-mask","el-lamp-mask","el-bat1","el-bat2",
 "el-eye1","el-eye2","el-eye3","el-eye4","el-eye5","el-eye6"].forEach(loadImg);

/* ---- what survives a reload: the key, and whether the mirror cam was on ---- */
const SAVE_K = "retro.state";
/* The whole key hunt is session-only: the doors RE-LOCK on every load and the
   key is back in the hole, because finding it is quick and worth doing again.
   The only thing that outlives a visit is whether the mirror cam was on. */
function saveSt(S){
  try { localStorage.setItem(SAVE_K, JSON.stringify({ camWanted: S.st.camWanted ? 1 : 0 })); }
  catch(e){}
}
function loadSt(S){
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_K) || "{}");
    if (o.camWanted) S.st.camWanted = 1;
  } catch(e){}
  S.st.hasKey = 0; S.st.keyShown = 0; S.st.keyTaken = 0;
}

/* ================================================= a few paper-card procs = */
function g(v){ return `rgb(${v},${v},${v})`; }
function grad(ctx,x0,y0,x1,y1,st){ const gr=ctx.createLinearGradient(x0,y0,x1,y1); st.forEach(s=>gr.addColorStop(s[0],g(s[1]))); return gr; }

const PROCS = {
  // reading surfaces are PURE WHITE (255) so the strong master dither leaves them
  // clean paper — only the black frame/rules survive the threshold.
  plaque(ctx) {
    ctx.fillStyle = g(255); ctx.fillRect(0,0,M,M);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 14; ctx.strokeRect(150,240,1236,1050);
    ctx.lineWidth = 4; ctx.strokeRect(184,274,1168,982);
    [[196,286],[1340,286],[196,1244],[1340,1244]].forEach(c=>{ ctx.beginPath(); ctx.arc(c[0],c[1],14,0,7); ctx.fillStyle="#000"; ctx.fill(); });
  },
  guestbook(ctx) {
    ctx.fillStyle = g(255); ctx.fillRect(0,0,M,M);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 26; ctx.strokeRect(150,236,1236,1044);  // cover edge
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;                                       // ruled lines
    for (let y=580; y<=1240; y+=70){ ctx.beginPath(); ctx.moveTo(230,y); ctx.lineTo(1310,y); ctx.stroke(); }
  },
  photobook(ctx) {
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,M,M);
    ctx.fillStyle = g(255); ctx.lineWidth = 0;
    for (let y=300; y<1300; y+=94){ ctx.fillRect(196,y,26,12); }                        // spine lacing
  },
};

/* ==================================== shared helpers for the dynamic layer = */
function elem(ctx, name, x, y, w, h) {          // draw a transparent art element (already 1-bit)
  const im = IMG[name]; if (!im || !im.complete || !im.naturalWidth) return;
  const s = Math.min(w / im.naturalWidth, h / im.naturalHeight);
  ctx.drawImage(im, x + (w - im.naturalWidth*s)/2, y + (h - im.naturalHeight*s)/2, im.naturalWidth*s, im.naturalHeight*s);
}
function elemInvert(ctx, name, x, y, w, h) {    // draw a WHITE element (el-straysky is already white)
  elem(ctx, name, x, y, w, h);
}
/* fill a rect edge to edge with an element, cropping the overflow — for pictures
   that should FILL their frame rather than float inside it with letterboxing */
function elemCover(ctx, name, x, y, w, h) {
  const im = IMG[name]; if (!im || !im.complete || !im.naturalWidth) return;
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();       // the frame masks the overflow
  ctx.drawImage(im, x + (w - im.naturalWidth*s)/2, y + (h - im.naturalHeight*s)/2,
                im.naturalWidth*s, im.naturalHeight*s);
  ctx.restore();
}
/* draw a DARK-ink element recoloured to paper-white — el-ufo is black line art,
   which is invisible against the night sky unless we flip it. Cached per element. */
const WHITE_CV = {};
function elemWhite(ctx, name, x, y, w, h) {
  const im = IMG[name]; if (!im || !im.complete || !im.naturalWidth) return;
  let c = WHITE_CV[name];
  if (!c) {
    c = document.createElement("canvas");
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d");
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = "source-in";      // keep alpha, replace colour
    g.fillStyle = "rgb(244,240,228)"; g.fillRect(0, 0, c.width, c.height);
    WHITE_CV[name] = c;
  }
  const s = Math.min(w / c.width, h / c.height);
  ctx.drawImage(c, x + (w - c.width*s)/2, y + (h - c.height*s)/2, c.width*s, c.height*s);
}
/* the stray sky, filling EVERY dark part of the card (above the road and to both
   sides of it) — masked by the master's own darkness so no stars land on the road. */
let STAR_CV = null, STAR_FOR = null;
function starfield(H, S) {
  if (STAR_CV && STAR_FOR === S.cur) return STAR_CV;
  const im = IMG["el-straysky"];
  if (!im || !im.complete || !im.naturalWidth) return null;
  if (!S.bgSample) return null;                    // master not sampled yet — don't cache a blank
  const c = document.createElement("canvas"); c.width = M; c.height = M;
  const g = c.getContext("2d");
  const th = M * im.naturalHeight / im.naturalWidth;
  for (let y = 0; y < M; y += th) g.drawImage(im, 0, y, M, th);   // tile down to fill the square
  // mask: keep stars only where the artwork is dark
  const mk = document.createElement("canvas"); mk.width = 96; mk.height = 96;
  const mg = mk.getContext("2d");
  const id = mg.createImageData(96, 96);
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const my = (y + 0.5) / 96 * M;
    const b = H.sampleBg((x + 0.5) / 96 * M, my);
    let a = b < 0.30 ? 255 : b < 0.46 ? Math.round((0.46 - b) / 0.16 * 255) : 0;
    // stars belong in the SKY — fade them out before the ground so none land on
    // the pavement either side of the road
    if (my > 620) a = Math.round(a * Math.max(0, 1 - (my - 620) / 180));
    const i = (y * 96 + x) * 4;
    id.data[i] = id.data[i+1] = id.data[i+2] = 255; id.data[i+3] = a;
  }
  mg.putImageData(id, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(mk, 0, 0, M, M);
  g.globalCompositeOperation = "source-over";
  STAR_CV = c; STAR_FOR = S.cur;
  return c;
}
/* ================================================== the movie theatre === */
const SCREEN_R = [352, 405, 823, 535];        // the screen opening, master coords
const MOVIE_SRC = "assets/video/movie.mp4";
const CURTAIN_MS = 2200;                      // how long the curtain takes to rise

/* The film plays as a real <video> drawn onto the dynamic canvas, so the engine's
   1-bit dither runs over it exactly like the mirror's webcam. (A YouTube iframe
   can never be dithered — it's cross-origin, so its pixels are unreadable, and it
   would float above the WebGL canvas with its own chrome.) */
const FILM = { video:null, on:false, err:false };
let MOVIE_CV = null;
function movieCv() {
  if (!MOVIE_CV) {
    MOVIE_CV = document.createElement("canvas");
    MOVIE_CV.width = SCREEN_R[2]; MOVIE_CV.height = SCREEN_R[3];
  }
  return MOVIE_CV;
}
function filmPlay() {
  if (FILM.video) { FILM.video.play().catch(()=>{}); return; }
  const v = document.createElement("video");
  v.src = MOVIE_SRC; v.playsInline = true; v.preload = "auto";
  v.addEventListener("playing", () => {
    FILM.on = true; FILM.err = false;
    cards["movie"].live = true;
    window.__mus && window.__mus.wake();       // drive the render loop so frames update
  });
  v.addEventListener("error", () => { FILM.err = true; window.__mus && window.__mus.renderOnce(); });
  FILM.video = v;
  v.play().catch(()=>{ /* needs the gesture; the curtain click supplies it */ });
}
function filmStop() {
  if (FILM.video) FILM.video.pause();
  FILM.on = false;
}

/* the hallway picture frame's real opening in the art (detected, not guessed) */
const HFRAME_R = [343, 332, 853, 870];

/* The playable-Manhole-in-the-frame experiment is removed for now — see the
   note in CLAUDE.md. The right picture is simply a picture again. */
function mhShow() {}

/* the eye in the left hallway picture — six frames, open → shut → open */
const EYE_SEQ = [[1,90],[2,70],[3,70],[4,180],[5,110],[6,130]];
const EYE_MS  = EYE_SEQ.reduce((a,b)=>a+b[1],0);
function eyeFrame(S, t) {
  if (!S.st.eyeT0) return 1;                       // at rest it is wide open
  let e = t - S.st.eyeT0;
  if (e < 0 || e >= EYE_MS) return 1;
  for (const [f,d] of EYE_SEQ) { if (e < d) return f; e -= d; }
  return 1;
}

/* offscreen the saucer is composited in, so the lamp can be punched out of it */
let UFO_CV = null;
function ufoCv(w, h) {
  if (!UFO_CV) UFO_CV = document.createElement("canvas");
  if (UFO_CV.width !== w || UFO_CV.height !== h) { UFO_CV.width = w; UFO_CV.height = h; }
  return UFO_CV;
}

/* offscreen the mirror reflection is composited in, so it can be masked to the glass */
let MIRROR_CV = null;
function mirrorCv() {
  if (!MIRROR_CV) {
    MIRROR_CV = document.createElement("canvas");
    MIRROR_CV.width = MIRROR_R[2]; MIRROR_CV.height = MIRROR_R[3];
  }
  return MIRROR_CV;
}

/* ---- the night sky over the facade. The art's own stars are fixed; these breathe. ---- */
const SKY_STARS = (() => {
  let s = 20130722;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const out = [];
  const clearOfBuilding = (x, y) => !(x > 340 && x < 1200 && y > 175);
  let guard = 0;
  while (out.length < 15 && guard++ < 400) {
    const x = 50 + rnd() * 1440, y = 26 + rnd() * 300;
    if (clearOfBuilding(x, y)) out.push({ x, y, r: 2.8 + rnd() * 3.2, sp: 0.6 + rnd() * 1.9, ph: rnd() * 6.283 });
  }
  for (let i = 0; i < 5; i++) {                       // a few down the dark margins
    const x = rnd() < 0.5 ? 34 + rnd() * 150 : 1352 + rnd() * 150;
    out.push({ x, y: 340 + rnd() * 500, r: 2.6 + rnd() * 2.8, sp: 0.6 + rnd() * 1.9, ph: rnd() * 6.283 });
  }
  return out;
})();
function twinkleStars(ctx, t) {
  const s = t / 1000;
  ctx.save();
  ctx.fillStyle = "rgb(250,247,239)";
  for (const st of SKY_STARS) {
    const k = 0.5 + 0.5 * Math.sin(s * st.sp + st.ph);
    if (k < 0.12) continue;                           // some wink out entirely
    const r = st.r * (0.42 + 0.78 * k);
    ctx.beginPath(); ctx.arc(st.x, st.y, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}

/* text under the pictures reads small on a phone — nudge it up when the
   square is being squeezed onto a narrow screen */
function mobK(S) { return (S && S.cssW && S.cssW < 760) ? 1.28 : 1; }

/* ceiling-lamp click targets — [x,y] centres of each room's fixtures (master coords) */
function bulbHots(pts) {
  return pts.map(p => ({ r:[p[0]-66, p[1]-66, 132, 132], cur:"hand", fn:"bulbDip" }));
}
function starsBg(on) {                          // fill the WHOLE window (letterbox bars too) with stars
  const b = document.body.style;
  b.backgroundImage = on ? `url(${V}el-straysky.png?av=9)` : "";
  if (!on) return;
  // match the card's on-screen star scale so the bars and the card read as one sky
  const st = document.getElementById("stage");
  const w = st ? st.clientWidth : 0;              // the master square's displayed width
  b.backgroundSize = w ? w + "px auto" : "cover";
  b.backgroundPosition = "center";
  b.backgroundRepeat = "repeat";
}
window.addEventListener("resize", () => {         // keep the bar stars matched as the window changes
  if (document.body.style.backgroundImage) starsBg(true);
});
function roomTitle(ctx, H, label, seed) {
  const y = 236;
  // pick white on a dark wall, black on a light wall (auto-contrast across its width)
  let b = 0; for (const dx of [-280,-140,0,140,280]) b += H.sampleBg(768 + dx, y);
  b /= 5;
  const col = b < 0.5 ? "#f2eee2" : "#141414";
  H.type(ctx, label, 768, y, { cells:8, align:"center", alpha:0.9, color:col, plain:true, seed });
}
function signPlate(ctx, H, cx, cy, label, cells, seed, angle) {
  const fs = cells * H._cm;
  const w = label.length * fs * 0.66 + 40, h = fs * 1.7;
  ctx.save();
  if (angle) { ctx.translate(cx, cy); ctx.rotate(angle * Math.PI / 180); ctx.translate(-cx, -cy); }
  ctx.fillStyle = "rgb(238,234,224)"; ctx.fillRect(cx - w/2, cy - h/2, w, h);
  ctx.fillStyle = "#101010";
  ctx.fillRect(cx - w/2 + 5, cy - h/2 + 4, w - 10, 3);
  ctx.fillRect(cx - w/2 + 5, cy + h/2 - 7, w - 10, 3);
  H.type(ctx, label, cx, cy + fs*0.34, { size: fs, align:"center", color:"#101010", plain:true, seed });
  ctx.restore();
}


/* standard 2-frame gallery layout (matches the generated gallery art) */
function frames2(a, b) {
  return [
    a && { song:a, r:[360,520,320,368], plate:[360,915,320,74] },
    b && { song:b, r:[890,520,320,368], plate:[890,915,320,74] },
  ].filter(Boolean);
}

/* ================================================================ CARDS == */
const cards = {

  /* ---- outside ---- */
  "street": {
    id:"street", img:V+"street.png", tone:"ink", room:"ent", ambient:"lamp", depth:6, live:true,
    nav:{ back:"facade" },
    hots:[
      { r:[0,0,1536,760], cur:"hand", fn:"skyUFO" },
      { r:[950,250,230,240], cur:"hand", fn:"streetLight" },
      { r:[688,1116,160,124], cur:"hand", fn:"streetGrate" },                // the storm grate in the road
      { r:[540,780,460,300], cur:"fwd", exitZone:true, fn:"leaveMuseum" },   // the end of the road → leave
    ],
    // the lamp's hum follows the lamp: it buzzes while lit, and the street goes
    // quiet when it's out — including when you come back to the card later
    after(H,S){
      if (S.st.starsOut) starsBg(true);
      window.AUDIO && window.AUDIO.ambient(S.st.lampOut ? "dark" : "lamp");
    },
    leave(H,S){ starsBg(false); },
    draw(ctx,H,S,t){
      const st=S.st;
      if (st.starsOut) { const sf=starfield(H,S); if (sf) ctx.drawImage(sf,0,0); }
      if (!st.lampOut) {                         // glow at the drawn lamp head (top-right)
        const lx=1035, ly=345;
        // hot core → soft halo. Separate stops keep the dither from muddying it into
        // one flat blob: a small solid centre, a quick falloff, then a wide faint bloom.
        const core=ctx.createRadialGradient(lx,ly,0,lx,ly,54);
        core.addColorStop(0,"rgba(255,253,246,1)"); core.addColorStop(0.45,"rgba(250,246,234,0.92)");
        core.addColorStop(1,"rgba(246,242,230,0)");
        ctx.fillStyle=core; ctx.beginPath(); ctx.arc(lx,ly,54,0,7); ctx.fill();
        const halo=ctx.createRadialGradient(lx,ly,40,lx,ly,190);
        halo.addColorStop(0,"rgba(244,240,228,0.42)"); halo.addColorStop(0.5,"rgba(244,240,228,0.13)");
        halo.addColorStop(1,"rgba(244,240,228,0)");
        ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(lx,ly,190,0,7); ctx.fill();
        // a few thin rays so it reads as a lamp, not a smudge
        ctx.save(); ctx.translate(lx,ly); ctx.strokeStyle="rgba(248,244,232,0.20)"; ctx.lineWidth=3;
        for (let i=0;i<8;i++){ const a=i*Math.PI/4;
          ctx.beginPath(); ctx.moveTo(Math.cos(a)*58,Math.sin(a)*58);
          ctx.lineTo(Math.cos(a)*(i%2?96:132),Math.sin(a)*(i%2?96:132)); ctx.stroke(); }
        ctx.restore();
        // the cone it throws down the road
        const cg=ctx.createLinearGradient(0,345,0,1160); cg.addColorStop(0,"rgba(238,234,222,0.20)"); cg.addColorStop(1,"rgba(238,234,222,0.01)");
        ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(1000,360); ctx.lineTo(760,1160); ctx.lineTo(1200,1160); ctx.closePath(); ctx.fill();
      } else {
        // lamp out — the whole street actually goes dark (the art's lamp is lit, so we cover it)
        ctx.fillStyle="rgba(6,6,8,0.72)"; ctx.fillRect(0,0,M,M);
      }
      H.type(ctx,"the museum is behind you", 768, 1500, { cells:3.2, align:"center", alpha:0.28, color:"#8a867c", plain:true });
      // the way out — painted on the road at the end of it; brightens when you hover the end
      const leaving = S.hover && S.hover.exitZone;
      const dark = !!st.lampOut;
      H.type(ctx,"go back to clayandkelsy.com?", 768, 1130,
        { cells:7, align:"center", plain:true, color: dark?"#e8e4d6":"#171717", alpha: leaving?0.96:0.42 });
    },
  },

  /* ---- facade ---- */
  "facade": {
    id:"facade", img:V+"facade.png", tone:"ink", room:"ent", ambient:"street", depth:5, live:true,
    nav:{ fwd:"hall-1", back:"street" },
    hots:[
      { r:[600,760,340,320], cur:"fwd", go:"hall-1", t:"dissolve", spd:"slow" },
      { r:[280,470,700,150], cur:"hand", sfx:"knock" },
      { r:[1000,1160,460,300], cur:"hand", fn:"grassMouse" },
    ],
    draw(ctx,H,S,t){
      twinkleStars(ctx, t);                       // the sky breathes
      // RETROSPECTIVE lettered onto the drawn blank frieze band
      H.type(ctx,"RETROSPECTIVE", 762, 566, { cells:10, align:"center", color:"#101010", plain:true, seed:5, spacing:0.08 });
      H.type(ctx,"clay and kelsy", 762, 604, { cells:4.6, align:"center", color:"#101010", plain:true, seed:9 });
      if (!S.st.mouseGone2) {}
    },
  },

  /* ---- hallway (2 stops) ---- */
  "hall-1": {
    id:"hall-1", img:V+"hall-1.png", tone:"ink", room:"ent", ambient:"hall", depth:4,
    nav:{ fwd:"hall-2", back:"facade" },
    hots:[
      { r:[706,600,150,320], cur:"fwd", go:"hall-2", t:"dissolve", spd:"fast" },
      { r:[1210,830,150,150], cur:"hand", fn:"boothBell", sfx:"bellLow" },
      { r:[90,420,240,690],  cur:"lock", curKey:"key", fn:"movieDoor", onHover:"movieHover" },
      ...bulbHots([[780,276]]),                       // the hanging lantern
    ],
  },
  /* ---- the movie theatre, behind the padlocked hallway door ---- */
  "movie": {
    id:"movie", img:V+"movie.png", tone:"ink", room:"ent", ambient:"hall", depth:4, live:true,
    nav:{ back:"hall-1" },
    hots:[ { r:SCREEN_R, cur:"hand", fn:"raiseCurtain" },
           ...bulbHots([[132,630],[1404,630]]) ],          // the wall sconces
    after(H,S){ if (S.st.curtainT0 && performance.now()-S.st.curtainT0 > CURTAIN_MS) filmPlay(); },
    leave(H,S){ filmStop(); },
    draw(ctx,H,S,t){
      const st=S.st, R=SCREEN_R;
      const k = st.curtainT0 ? Math.min(1,(t-st.curtainT0)/CURTAIN_MS) : 0;

      // 1. the film, drawn INTO the screen and masked to its opening, so the
      //    proscenium keeps its ornament and the engine dithers the picture
      if (FILM.on && FILM.video && FILM.video.videoWidth) {
        const cv = movieCv(), g = cv.getContext("2d");
        g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,R[2],R[3]);
        const vw=FILM.video.videoWidth, vh=FILM.video.videoHeight;
        const s=Math.min(R[2]/vw, R[3]/vh);                // contain — never crop the frame
        try{ g.filter="grayscale(1) contrast(1.15)"; }catch(e){}
        g.fillStyle="#000"; g.fillRect(0,0,R[2],R[3]);     // letterbox in black
        g.drawImage(FILM.video, (R[2]-vw*s)/2, (R[3]-vh*s)/2, vw*s, vh*s);
        try{ g.filter="none"; }catch(e){}
        const mk = IMG["el-movie-mask"];
        if (mk && mk.complete && mk.naturalWidth){
          g.globalCompositeOperation="destination-in";
          g.drawImage(mk, -R[0], -R[1], M, M);
          g.globalCompositeOperation="source-over";
        }
        ctx.drawImage(cv, R[0], R[1]);
      } else if (st.curtainT0 && k >= 1) {
        H.type(ctx, FILM.err ? "the reel is missing" : "threading the projector…",
               764, 672, {cells:4,align:"center",alpha:0.65,color:"#e8e4d8",plain:true,seed:78});
      }

      // 2. the curtain over the top of it, rising out of the opening
      if (k < 1) {
        const im = IMG["el-reds"];
        ctx.save();
        ctx.beginPath(); ctx.rect(R[0],R[1],R[2],R[3]); ctx.clip();
        const lift = k*k*(3-2*k) * R[3];            // ease in-out
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, R[0], R[1]-lift, R[2], R[3]);
        else { ctx.fillStyle="rgb(232,228,216)"; ctx.fillRect(R[0],R[1]-lift,R[2],R[3]); }
        ctx.restore();
      }
    },
  },

  "hall-2": {
    id:"hall-2", img:V+"hall-2.png", tone:"ink", room:"ent", ambient:"hall", depth:3,
    nav:{ back:"hall-1" },
    hots:[
      { r:[560,400,400,610], cur:"fwd", go:"door", t:"dissolve", spd:"fast" },
      { r:[1250,360,244,780], cur:"lock", curKey:"key", fn:"mirrorDoor", onHover:"mirrorHover" },
      { r:[318,460,160,420], cur:"zoom", fn:"toFrame", pic:1, sfx:"knock" },
      { r:[1010,470,180,410], cur:"zoom", fn:"toFrame", pic:2, sfx:"knock" },
      ...bulbHots([[764,248]]),                       // the hanging lantern
    ],
  },

  /* ---- the museum door ---- */
  "door": {
    id:"door", img:V+"door.png", tone:"ink", room:"ent", ambient:"hall", depth:1,
    nav:{ back:"hall-2" },
    hots:[
      { r:[430,300,660,1080], cur:"hand", go:"rotunda", t:"barnOpen", spd:"slow", sfx:"creakDoor" },
    ],
    // the lit transom over the doors — big enough to actually read
    draw(ctx,H){ H.type(ctx,"ROTUNDA", 800, 236, { cells:9, align:"center", color:"#101010", plain:true, seed:41, spacing:0.08 }); },
  },

  /* ---- rotunda hub ---- */
  "rotunda": {
    id:"rotunda", img:V+"rotunda.png", tone:"ink", room:"rot", ambient:"rot", depth:0,
    nav:{ back:"door" },
    hots:[
      { r:[154,740,190,320], cur:"fwd", go:"early",  t:"dissolve", spd:"fast" },
      { r:[440,740,190,320], cur:"fwd", go:"y17a",   t:"dissolve", spd:"fast" },
      { r:[898,740,190,320], cur:"fwd", go:"late-a", t:"dissolve", spd:"fast" },
      { r:[1181,740,190,320], cur:"fwd", go:"annex", t:"dissolve", spd:"fast" },
      { r:[360,880,230,230], cur:"quill", go:"guestbook", t:"irisOpen", spd:"fast", at:[460,1000] },
      { r:[970,920,250,300], cur:"hand", fn:"glassTapFlower" },
      { r:[643,0,247,150], cur:"hand", fn:"batsIn" },        // the oculus at the top of the dome
    ],
    draw(ctx,H,S,t){ /* no doorway labels — the doorways speak for themselves */ },
  },

  /* ---- galleries ---- (mouse hole lives in y17a) */
  "early":  { id:"early",  img:V+"gallery-a.png", tone:"ink", room:"early", ambient:"room",
    nav:{ back:"rotunda" }, frames:[{ song:"laputa", r:[318,486,264,354], plate:[395,966,118,41] },{ song:"intro", r:[978,486,252,354], plate:[1042,966,117,41] }],
    hots: bulbHots([[446,155],[1103,155]]),
    draw(ctx,H,S,t){ roomTitle(ctx,H,"EARLY WORKS",61); } },

  "y17a": { id:"y17a", img:V+"gallery-mh.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ right:"y17b", back:"rotunda" }, frames:[{ song:"no-good-reason", r:[402,564,246,276], plate:[485,966,82,30] },{ song:"currently-alone", r:[954,564,228,276], plate:[1026,966,83,30] }],
    hots:[ { r:[1280,1120,120,110], cur:"zoom", go:"mh-zoom1", t:"zoomOpen", spd:"fast", at:[1340,1170], sfx:"squeak" },
           { r:[72,944,245,271], cur:"hand", fn:"radiatorSteam" },       // the old heater
           { r:[476,1174,594,236], cur:"hand", sfx:"knock" },            // the bench — knock on wood
           ...bulbHots([[355,90],[1180,90]]) ],
    draw(ctx,H,S,t){ roomTitle(ctx,H,"2017",71); } },

  "y17b": { id:"y17b", img:V+"gallery-c.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ left:"y17a", back:"rotunda" },
    frames:[{ song:"casino", r:[252,576,168,240], plate:[312,940,72,22] },{ song:"wondering", r:[630,534,270,294], plate:[728,950,71,23] },{ song:"i-can-do-it-all", r:[1104,576,174,240], plate:[1174,940,73,22] }],
    hots: [ { r:[78,1325,295,170], cur:"hand", fn:"streetGrate" },   // the floor grate — same drop as the street's
            ...bulbHots([[315,111],[1218,111]]) ],
    draw(ctx,H,S,t){ } },

  "late-a": { id:"late-a", img:V+"gallery-d.png", tone:"ink", room:"late", ambient:"room",
    nav:{ right:"late-b", back:"rotunda" },
    frames:[{ song:"heartbeats", r:[228,624,180,258], plate:[280,1005,83,30] },{ song:"i-cant-forget", r:[642,558,246,330], plate:[727,1011,82,29] },{ song:"bea5", r:[1122,624,180,270], plate:[1174,1005,85,30] }],
    hots: bulbHots([[286,128],[1235,128]]),
    draw(ctx,H,S,t){ roomTitle(ctx,H,"2018 - 2019",91); } },

  "late-b": { id:"late-b", img:V+"room-1.png", tone:"ink", room:"late", ambient:"room",
    nav:{ left:"late-a", back:"rotunda" }, frames:[{ song:"seven", r:[522,426,492,504], plate:[689,1076,156,48] }],
    hots: bulbHots([[764,123]]),
    draw(ctx,H,S,t){ } },

  "annex": { id:"annex", img:V+"gallery-b.png", tone:"ink", room:"annex", ambient:"annex",
    nav:{ back:"rotunda" }, frames:[{ song:"hate-me", r:[288,486,270,378], plate:[360,978,134,51] },{ song:"kanye", r:[952,456,347,447], plate:[1059,1009,134,51], shape:"oval" }],
    hots: bulbHots([[418,124],[1125,124]]),
    draw(ctx,H,S,t){
      roomTitle(ctx,H,"REMIXES",111);
      H.type(ctx,"please remember to love the misunderstood.", 768, 1420, {cells:4,align:"center",alpha:0.6,color:"#c9c4b4",plain:true,seed:113}); } },

  /* ---- mouse hole zoom sequence ---- */
  "mh-zoom1": { id:"mh-zoom1", img:V+"mh-zoom1.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"y17a" },
    hots:[ { r:[655,790,226,260], cur:"zoom", go:"mh-zoom2", t:"zoomOpen", spd:"fast", at:[768,920] } ] },
  "mh-zoom2": { id:"mh-zoom2", img:V+"mh-zoom2.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"mh-zoom1" },
    hots:[ { r:[500,500,540,540], cur:"zoom", go:"mousehole", t:"irisOpen", spd:"slow", at:[768,768] } ] },

  /* ---- inside the mouse hole ---- */
  "mousehole": {
    id:"mousehole", img:V+"mousehole.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"y17a" },
    hots:[
      { r:[810,700,250,180], cur:"listen", fn:"mouseSqueak" },   // the mouse curled up in the dark
      { r:[660,880,360,300], cur:"hand", fn:"takeKey" },
    ],
    draw(ctx,H,S,t){
      if (S.st.keyShown && !S.st.keyTaken){
        // the key lies just below the mouse, exactly where the pick-up animation lifts it from
        elem(ctx,"el-key", 690, 945, 280, 180);
        H.type(ctx,"the janitor's key", 830, 1150, {cells:2.8,align:"center",color:"#101010",plain:true});
      }
    },
  },

  /* ---- hallway picture zoom-ins ---- */
  "hframe": {
    id:"hframe", img:V+"hframe.png", tone:"ink", room:"ent", ambient:"hall", depth:3,
    nav:{ back:"hall-2" },
    hots:[ { r:HFRAME_R, cur:"hand", fn:"framePoke" } ],
    leave(H,S){ mhShow(false); },
    after(H,S){ if ((S.st.hframePic||1) === 2 && S.st.manhole) mhShow(true); },
    draw(ctx,H,S,t){
      const n = S.st.hframePic || 1, R = HFRAME_R;
      ctx.fillStyle = "#000"; ctx.fillRect(R[0], R[1], R[2], R[3]);
      // the picture FILLS its frame; the frame masks whatever spills over
      if (n === 1) {
        elemCover(ctx, "el-eye" + eyeFrame(S,t), R[0], R[1], R[2], R[3]);     // the eye that blinks
      } else {
        elemCover(ctx, "el-hpic2", R[0], R[1], R[2], R[3]);
      }
    },
  },

  /* ---- the mirror room (behind the 2nd hallway door, key-locked) ---- */
  "mirror": {
    id:"mirror", img:V+"mirror.png", tone:"ink", room:"ent", ambient:"hall", depth:4,
    nav:{ back:"hall-2" },
    hots:[
      { r:[350,390,770,710], cur:"hand", fn:"mirrorToggle" },
      { r:[980,660,310,470], cur:"hand", fn:"snapPhoto" },
      { r:[1210,1270,310,200], cur:"zoom", go:"photobook", t:"zoomOpen", spd:"fast", at:[1360,1330] },
    ],
    after(H,S){ if (S.st.camWanted && !CAM.on) ACTIONS.mirrorToggle({},H,S); },   // stays on across visits
    leave(H,S){ ACTIONS.camOff(); },
    draw(ctx,H,S,t){
      // the mirror glass fills the big ornate black frame opening (MIRROR_R)
      const R=MIRROR_R, mcx=R[0]+R[2]/2, mcy=R[1]+R[3]/2;
      if (CAM.on && CAM.video && CAM.video.videoWidth){
        // Render the reflection offscreen, then punch it through the glass mask so the
        // drawn slide camera (which overlaps the glass) keeps standing in FRONT of it.
        const cv = mirrorCv(), g = cv.getContext("2d");
        g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,R[2],R[3]);
        const vw=CAM.video.videoWidth, vh=CAM.video.videoHeight, s=Math.max(R[2]/vw,R[3]/vh)*1.02;
        g.save();
        g.translate(R[2]/2,R[3]/2); g.scale(-1,1);
        try{ g.filter="grayscale(1) contrast(1.2)"; }catch(e){}
        g.drawImage(CAM.video, -vw*s/2, -vh*s/2, vw*s, vh*s);
        g.restore();
        const mk = IMG["el-mirror-mask"];
        if (mk && mk.complete && mk.naturalWidth){
          g.globalCompositeOperation="destination-in";
          g.drawImage(mk, -R[0], -R[1], M, M);       // mask is full-frame in master coords
          g.globalCompositeOperation="source-over";
        }
        ctx.drawImage(cv, R[0], R[1]);
      } else {
        ctx.save();
        ctx.beginPath(); ctx.rect(R[0],R[1],R[2],R[3]); ctx.clip();
        H.type(ctx, CAM.err?"the glass shows nothing":"a dark mirror", mcx, mcy-10, {cells:6,align:"center",alpha:0.7,color:"#e8e4d8",plain:true});
        if(!CAM.err) H.type(ctx,"· click to look ·", mcx, mcy+60, {cells:4,align:"center",alpha:0.5,color:"#e8e4d8",plain:true});
        ctx.restore();
      }
      if (PHOTOS.length>=6) H.type(ctx,"out of film", 1130, 620, {cells:3.5,align:"center",alpha:0.6,color:"#c9c4b4",plain:true});
    },
  },
  "photobook": {
    id:"photobook", proc:"photobook", tone:"ink", room:"ent", ambient:"hall", dynRes:1254,
    nav:{ back:"mirror" },
    hots:[0,1,2,3,4,5].map((idx)=>{ const c=idx%3, r=Math.floor(idx/3);
      return { r:[300+c*320, 400+r*400, 300, 340], cur:"hand", fn:"savePhoto", idx }; }),
    draw(ctx,H,S,t){
      H.type(ctx,"PHOTOGRAPHS", 768, 320, {cells:7,align:"center",alpha:0.9,color:"#ddd8ca",plain:true,spacing:0.2});
      [0,1,2,3,4,5].forEach(i=>{ const c=i%3, rr=Math.floor(i/3), x=300+c*320, y=400+rr*400;
        ctx.fillStyle="rgb(226,222,210)";
        [[x,y,1,1],[x+300,y,-1,1],[x,y+250,1,-1],[x+300,y+250,-1,-1]].forEach(k=>{ ctx.beginPath(); ctx.moveTo(k[0],k[1]); ctx.lineTo(k[0]+34*k[2],k[1]); ctx.lineTo(k[0],k[1]+34*k[3]); ctx.closePath(); ctx.fill(); });
        const p=PHOTOS[i];
        if (p && p.img.complete && p.img.naturalWidth){
          const s=Math.min(280/p.img.naturalWidth,236/p.img.naturalHeight);
          ctx.drawImage(p.img, x+150-p.img.naturalWidth*s/2, y+125-p.img.naturalHeight*s/2, p.img.naturalWidth*s, p.img.naturalHeight*s);
          H.type(ctx,"[ save ]", x+150, y+305, {cells:4,align:"center",alpha:0.9,color:"#ddd8ca",plain:true});
        } else H.type(ctx,"empty", x+150, y+140, {cells:3,align:"center",alpha:0.3,color:"#ddd8ca",plain:true});
      });
      if (!PHOTOS.length) H.type(ctx,"the camera is in the mirror room", 768, 1230, {cells:3.4,align:"center",alpha:0.45,color:"#ddd8ca",plain:true});
    },
  },

  /* ---- the guest book (reading + signing surface) ---- */
  "guestbook": {
    id:"guestbook", proc:"guestbook", tone:"paper", room:"rot", ambient:"rot", dynRes:1254, live:true,
    nav:{ back:"rotunda" },
    after(H,S){ GB.show(H,S); },
    leave(H,S){ GB.hide(); },
    draw(ctx,H,S,t){
      H.type(ctx,"GUEST BOOK", 768, 400, {cells:9,align:"center",alpha:1,color:"#101010",plain:true,seed:121,spacing:0.16});
      H.type(ctx,"[retrospective]  ·  sign below", 768, 452, {cells:4,align:"center",alpha:0.9,color:"#101010",plain:true,seed:122});
      const entries = GB.all();
      let y = 620;
      for (const e of entries.slice(-8)){ H.type(ctx, e, 250, y, {cells:5.5,alpha:1,color:"#101010",plain:true,seed:y}); y+=70; }
      // the live line you're typing — through the dither, with a blinking caret
      const buf = S.st.gbBuf || "";
      const caret = (Math.floor(t/500)%2===0) ? "|" : " ";
      H.type(ctx, (buf||"") + caret, 250, y, {cells:5.5,alpha:1,color:"#101010",plain:true,seed:99});
      S.st.gbLineY = y;
    },
  },
};

/* ============================================================== ACTIONS == */
const CAM = { stream:null, video:null, on:false, err:false };
const PHOTOS = [];
const MIRROR_R = [398,380,706,670];   // the ornate frame's black opening (art-measured)

const ACTIONS = {
  rattleDoor(hot,H){ H.sfx("rattle"); },

  /* the padlocked hallway door → the movie theatre (the janitor's key fits it too) */
  movieDoor(hot,H,S){
    if (S.st.movieOpening) return;                  // hover is already unlocking it
    if (S.st.hasKey){ ACTIONS.movieHover(hot,H,S); }
    else { H.sfx("rattle"); }                       // locked — the padlock cursor says it all
  },
  movieHover(hot,H,S){
    if (!S.st.hasKey || S.st.movieOpening || S.lock) return;
    S.st.movieOpening = 1;
    H.sfx("keys"); setTimeout(()=>H.sfx("creakDoor"), 320);
    H.anim("hall-1", 720, (ctx,k)=>{                // the key turning in the padlock
      const cx=210, cy=760;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.55 + k*1.5);
      ctx.strokeStyle="rgb(236,232,218)"; ctx.lineWidth=11; ctx.lineCap="round";
      ctx.beginPath(); ctx.arc(0,-46,27,0,7); ctx.stroke();                 // bow
      ctx.beginPath(); ctx.moveTo(0,-19); ctx.lineTo(0,84); ctx.stroke();   // shaft
      ctx.beginPath(); ctx.moveTo(0,58); ctx.lineTo(24,58);
      ctx.moveTo(0,74); ctx.lineTo(17,74); ctx.stroke();                    // bit
      ctx.restore();
    });
    // open on a timer so a throttled tab can't strand it half-unlocked
    setTimeout(()=>{ S.st.movieOpening = 0; if (S.cur === "hall-1") H.go("movie",{ t:"barnOpen", spd:"slow" }); }, 720);
  },

  /* the curtain goes up and the house applauds */
  raiseCurtain(hot,H,S){
    if (S.st.curtainT0) {                           // curtain's up — the screen is a play/pause switch
      if (FILM.video && FILM.on) {
        if (FILM.video.paused) { FILM.video.play().catch(()=>{}); H.sfx("tick"); }
        else                   { FILM.video.pause(); H.sfx("tickSoft"); }
      } else { filmPlay(); H.sfx("tick"); }
      S.A.dirty = true;
      return;
    }
    S.st.curtainT0 = performance.now();
    H.sfx("applause");
    // the house lights go down as the curtain goes up
    if (!S.flickAnim){ S.flickAnim = { t0: performance.now()+260, dur: 1700, amt: 0.5 }; S.lastInput = performance.now(); }
    // this click is the gesture that lets the film play with sound
    filmPlay(); if (FILM.video) FILM.video.pause();
    setTimeout(()=>{ if (S.cur === "movie") filmPlay(); }, CURTAIN_MS + 120);
    S.A.dirty = true;
  },
  boothBell(hot,H){ /* bellLow via sfx on the hotspot */ },

  grassMouse(hot,H,S){                 // something startles in the grass and scurries off
    H.sfx("rustle"); setTimeout(()=>H.sfx("squeak"),120); const r=hot.r;
    const bx=r[0]+r[2]*0.5, by=r[1]+r[3]-70;
    H.anim("facade", 760, (ctx,k)=>{   // scurry off to the left — no peek, it's already running
      ctx.fillStyle="rgb(24,24,22)";
      const x=bx-k*540, y=by-6+Math.sin(k*34)*3;
      ctx.beginPath(); ctx.ellipse(x,y+18,30,15,0.05,0,7); ctx.fill();        // body
      ctx.beginPath(); ctx.arc(x-20,y+8,15,0,7); ctx.fill();                  // head leading left
      ctx.strokeStyle="rgb(24,24,22)"; ctx.lineWidth=5; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(x+28,y+20); ctx.quadraticCurveTo(x+56,y+8,x+74,y+24); ctx.stroke(); // tail
    });
  },

  /* click a room's ceiling lamp → the lights dip (the same flicker the rooms do on their own) */
  bulbDip(hot,H,S){
    if (S.flickAnim){ H.sfx("tickSoft"); return; }      // already dipping
    H.sfx("buzz");
    S.flickAnim = { t0: performance.now(), dur: 1500, amt: 0.42 };
    S.lastInput = performance.now();                     // don't let the idle flicker pile on
  },

  /* the 2017 room's old heater — knock it and it lets off steam */
  radiatorSteam(hot,H,S){
    if (S.st.steaming) return;
    S.st.steaming = 1;
    H.sfx("clack"); setTimeout(()=>H.sfx("hiss"), 180);
    H.anim("y17a", 2600, (ctx,k)=>{
      for (let i = 0; i < 4; i++) {                      // wisps rising off the top, fading as they climb
        const ph = (k * 1.15 + i * 0.27) % 1;
        const x = 128 + i * 46 + Math.sin((ph * 3.1 + i) * 2.2) * 26;
        const y = 940 - ph * 330;
        const a = Math.sin(Math.PI * ph) * 0.42 * (1 - k * 0.35);
        if (a <= 0.01) continue;
        const rr = 18 + ph * 46;
        const gr = ctx.createRadialGradient(x, y, 1, x, y, rr);
        gr.addColorStop(0, `rgba(246,243,233,${a.toFixed(3)})`);
        gr.addColorStop(1, "rgba(246,243,233,0)");
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
      }
    }, ()=>{ S.st.steaming = 0; S.A.dirty = true; });
  },

  /* street */
  skyUFO(hot,H,S){
    const st=S.st;
    if (st.starsOut){ H.sfx("tickSoft"); return; }
    if (st.ufoFlying) return;
    st.ufoFlying=1; H.sfx("whisper");
    H.anim("street", 3000, (ctx,k)=>{
      const x = -300 + k*2100, y = 240 + Math.sin(k*3.14)*(-60), w = 360, h = 118;
      // render the saucer offscreen and punch the lamp out of it, so it passes
      // BEHIND the streetlamp instead of sailing over the top of it
      const cv = ufoCv(w, h), g = cv.getContext("2d");
      g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h);
      elemWhite(g,"el-ufo", 0, 0, w, h);         // black line art → white, or it's invisible up there
      const mk = IMG["el-lamp-mask"];
      if (mk && mk.complete && mk.naturalWidth) {
        g.globalCompositeOperation = "destination-out";
        g.drawImage(mk, -x, -y, M, M);           // the mask is full-frame in master coords
        g.globalCompositeOperation = "source-over";
      }
      ctx.drawImage(cv, x, y);
    }, ()=>{ st.ufoFlying=0; st.starsOut=1; starsBg(true); S.A.dirty=true; H.sfx("musicbox"); });
  },
  // the storm grate in the road — something drops away underneath
  streetGrate(hot,H,S){ H.sfx("sinkhole"); },
  // walk off the end of the road → leave the experience (navigates the TOP frame when embedded)
  leaveMuseum(hot,H,S){
    H.sfx("creakDoor");
    const url = "https://clayandkelsy.com";
    setTimeout(()=>{ try { window.top.location.href = url; } catch(e){ window.location.href = url; } }, 160);
  },
  streetLight(hot,H,S){                 // toggle the streetlamp — the whole street goes dark, and back
    S.st.lampOut = S.st.lampOut ? 0 : 1;
    H.sfx("buzz");
    window.AUDIO.ambient(S.st.lampOut ? "dark" : "lamp");
    S.A.dirty=true;
  },

  /* the oculus at the top of the dome — a flurry of bats drops in, circles, and leaves */
  batsIn(hot,H,S){
    if (S.st.bats) return;
    S.st.bats = 1;
    H.sfx("bats");
    const HOLE = [766, 62];                      // the oculus centre, master coords
    const N = 6;
    const bat = [];
    for (let i = 0; i < N; i++) {
      bat.push({
        ph:  i / N,                              // spread them around their orbit
        cx:  640 + Math.random()*260,            // each circles its own patch of the room
        cy:  430 + Math.random()*190,
        rx:  300 + Math.random()*210,
        ry:  150 + Math.random()*100,
        turns: 3.0 + Math.random()*1.5,          // more laps, so they really move
        dir: Math.random() < 0.5 ? 1 : -1,
        lag: Math.random()*0.09,                 // stagger the entrances
        flap: 17 + Math.random()*7,              // wingbeats per second
        sz:  74 + Math.random()*36,
      });
    }
    const DUR = 5200;
    const ss = (a,b,x)=>{ const k=Math.max(0,Math.min(1,(x-a)/(b-a))); return k*k*(3-2*k); };
    H.anim("rotunda", DUR, (ctx,k)=>{
      for (const b of bat) {
        const u = Math.max(0, Math.min(1, (k - b.lag) / (1 - b.lag)));
        if (u <= 0) continue;
        // out of the hole → around the room → back into the hole
        const w  = ss(0, 0.20, u) * (1 - ss(0.80, 1, u));
        const th = b.ph*Math.PI*2 + b.dir * u * b.turns * Math.PI*2;
        const ox = b.cx + Math.cos(th)*b.rx;
        const oy = b.cy + Math.sin(th)*b.ry + Math.sin(u*Math.PI*7)*14;   // bob
        const x  = HOLE[0] + (ox - HOLE[0]) * w;
        const y  = HOLE[1] + (oy - HOLE[1]) * w;
        const s  = (0.18 + 0.82*w) * b.sz;                                // small at the hole
        const im = IMG[(k*b.flap) % 1 < 0.5 ? "el-bat1" : "el-bat2"];     // two-frame flap
        if (!im || !im.complete || !im.naturalWidth) continue;
        const h = s * im.naturalHeight / im.naturalWidth;
        ctx.save();
        ctx.translate(x, y);
        if (Math.cos(th) * b.dir < 0) ctx.scale(-1, 1);                   // face the way it's going
        ctx.drawImage(im, -s/2, -h/2, s, h);
        ctx.restore();
      }
    }, ()=>{ S.st.bats = 0; S.A.dirty = true; });
  },

  /* rotunda flower */
  glassTapFlower(hot,H,S){
    H.sfx("glassTap");
    H.anim("rotunda", 600, (ctx,k)=>{ ctx.strokeStyle="rgba(240,236,224,"+(0.5*(1-k)).toFixed(3)+")"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(1075,980,120+k*30,175+k*34,0,0,7); ctx.stroke(); });
  },

  /* hallway picture zoom */
  toFrame(hot,H,S){ S.st.hframePic = hot.pic; H.go("hframe",{ t:"zoomOpen", spd:"fast" }); },

  /* whichever picture you're stood in front of, poking it does its own thing */
  framePoke(hot,H,S){
    if ((S.st.hframePic || 1) === 2) { H.sfx("knock"); return; }   // just a picture, for now
    ACTIONS.blinkEye(hot,H,S);
  },

  /* click the eye and it blinks shut, then opens again */
  blinkEye(hot,H,S){
    if ((S.st.hframePic || 1) !== 1) return;        // only the left picture is the eye
    if (S.st.eyeT0) return;                         // mid-blink
    S.st.eyeT0 = performance.now();
    H.sfx("tickSoft");
    cards["hframe"].live = true;                    // animate while it blinks
    window.__mus && window.__mus.wake();
    setTimeout(()=>{                                // wall-clock, so a throttled tab can't stick it shut
      S.st.eyeT0 = 0; cards["hframe"].live = false;
      S.A.dirty = true; window.__mus && window.__mus.renderOnce();
    }, EYE_MS + 80);
    S.A.dirty = true;
  },

  /* mouse hole — poke the mouse and it shifts just enough to uncover the key (it stays put) */
  mouseSqueak(hot,H,S){
    H.sfx("squeak");
    if (S.st.keyShown) return;                           // it has already shifted aside
    S.st.keyShown = 1;
    setTimeout(()=>H.sfx("keys"), 240);
    S.A.dirty=true;
  },
  takeKey(hot,H,S){
    if (!S.st.keyShown){ H.sfx("tickSoft"); return; }    // nothing there until the mouse moves
    if (S.st.keyTaken){ H.sfx("tickSoft"); return; }
    S.st.keyTaken=1; S.st.hasKey=1; saveSt(S); H.sfx("keys"); setTimeout(()=>H.sfx("squeak"),200);
    H.anim("mousehole", 900, (ctx,k)=>{ ctx.save(); ctx.globalAlpha=1-k; ctx.translate(830,1035-k*160); ctx.rotate(k*0.6);
      const s=1+k*1.4; elem(ctx,"el-key",-140*s,-90*s,280*s,180*s); ctx.restore(); });
    S.A.dirty=true;
  },

  /* the key-locked mirror door */
  mirrorDoor(hot,H,S){
    if (S.st.mirrorOpening) return;                 // hover is already unlocking it
    if (S.st.hasKey){ ACTIONS.mirrorHover(hot,H,S); }
    else { H.sfx("rattle"); }        // locked — padlock cursor says it all, no box
  },
  // hover the locked door WITH the key → the key turns, the lock clicks, the door opens
  mirrorHover(hot,H,S){
    if (!S.st.hasKey || S.st.mirrorOpening || S.lock) return;
    S.st.mirrorOpening = 1;
    H.sfx("keys"); setTimeout(()=>H.sfx("creakDoor"), 320);
    H.anim("hall-2", 720, (ctx,k)=>{
      // a brass key turning in the door's lock
      const cx=1372, cy=760;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(-0.55 + k*1.5);
      ctx.strokeStyle="rgb(236,232,218)"; ctx.lineWidth=11; ctx.lineCap="round";
      ctx.beginPath(); ctx.arc(0,-46,27,0,7); ctx.stroke();                 // bow
      ctx.beginPath(); ctx.moveTo(0,-19); ctx.lineTo(0,84); ctx.stroke();   // shaft
      ctx.beginPath(); ctx.moveTo(0,58); ctx.lineTo(24,58);
      ctx.moveTo(0,74); ctx.lineTo(17,74); ctx.stroke();                    // bit
      ctx.restore();
    });
    // open on a timer (fires even if rAF is throttled); guard against having wandered off
    setTimeout(()=>{ S.st.mirrorOpening = 0; if (S.cur === "hall-2") H.go("mirror",{ t:"barnOpen", spd:"slow" }); }, 720);
  },

  /* mirror + camera + photobook (dithered webcam) */
  async mirrorToggle(hot,H,S){
    if (CAM.on){ ACTIONS.camOff(); S.st.camWanted=0; saveSt(S); S.A.dirty=true; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ CAM.err=true; H.sfx("brokenNote"); S.A.dirty=true; return; }
    try{
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640 }, audio:false });
      CAM.video = document.createElement("video"); CAM.video.srcObject=CAM.stream; CAM.video.muted=true; CAM.video.playsInline=true;
      await CAM.video.play(); CAM.on=true; CAM.err=false; cards["mirror"].live=true; H.sfx("tick");
      S.st.camWanted=1; saveSt(S);            // remember it, so it comes back on every visit
      window.__mus && window.__mus.wake();   // start the live loop so the webcam updates every frame
    }catch(e){ CAM.err=true; H.sfx("brokenNote"); }
    S.A.dirty=true; window.__mus && window.__mus.renderOnce();
  },
  camOff(){ if (CAM.stream) CAM.stream.getTracks().forEach(tr=>tr.stop()); CAM.stream=null; CAM.video=null; CAM.on=false; cards["mirror"].live=false; },
  snapPhoto(hot,H,S){
    if (PHOTOS.length>=6){ H.sfx("blot"); return; }
    H.sfx("shutter"); setTimeout(()=>H.sfx("filmPull"),260);
    // capture the FULL mirror region straight from the fixed-square backing canvas
    const stage=document.getElementById("stage"), back=stage.width;   // backing px (square)
    const sx=MIRROR_R[0]/M*back, sy=MIRROR_R[1]/M*back, sw=MIRROR_R[2]/M*back, sh=MIRROR_R[3]/M*back;
    const cv=document.createElement("canvas"); cv.width=Math.max(2,Math.round(sw)); cv.height=Math.max(2,Math.round(sh));
    try{ cv.getContext("2d").drawImage(stage, sx,sy,sw,sh, 0,0,cv.width,cv.height);
      const url=cv.toDataURL("image/png"), img=new Image(); img.src=url; PHOTOS.push({url,img}); }catch(e){}
    H.anim("mirror", 800, (ctx,k)=>{ if(k<0.22){ ctx.fillStyle="rgba(255,255,255,"+(0.9*(1-k/0.22)).toFixed(3)+")"; ctx.fillRect(MIRROR_R[0]-40,MIRROR_R[1]-40,MIRROR_R[2]+80,MIRROR_R[3]+80); } });
  },
  savePhoto(hot,H,S){
    const p=PHOTOS[hot.idx]; if(!p){ H.sfx("tickSoft"); return; }
    H.sfx("tick"); const el=document.createElement("a"); el.href=p.url; el.download="retrospective-photo-"+(hot.idx+1)+".png"; el.click();
  },
};

/* ========================================================== GUEST BOOK == */
/* Where the guest book lives. "/gb" = the local tools/serve.py only — on a static
   host (GitHub Pages) that 404s and the book falls back to each visitor's own
   browser, so nobody sees anybody else's signatures. For a SHARED, permanent
   book deploy tools/guestbook-worker.js and paste its URL here. */
const GB_URL = "/gb";
const GB = {
  remote:null,
  async fetchRemote(cb){ try{ const r=await fetch(GB_URL,{cache:"no-store"}); if(r.ok){ this.remote=await r.json(); cb&&cb(); } }catch(e){} },
  all(){ if(this.remote) return this.remote;
    try{ return JSON.parse(localStorage.getItem("retro.gb")||"[]"); }catch(e){ return []; } },
  input:null,
  show(H,S){
    const el=this.input||(this.input=document.getElementById("gbInput"));
    document.body.classList.add("gb-open");
    S.st.gbBuf=""; el.value="";
    this.fetchRemote(()=>{ S.A&&(S.A.dirty=true); window.__mus&&window.__mus.renderOnce(); });
    el.oninput=()=>{ S.st.gbBuf=el.value; };
    el.onkeydown=e=>{
      if (e.key==="Enter" && el.value.trim()){
        const raw=el.value.trim(); el.value=""; S.st.gbBuf="";
        if (!(window.gbClean && window.gbClean(raw))){ H.sfx("blot");
          const y=Math.min(S.st.gbLineY||620,1200);
          H.anim("guestbook", 1000, (ctx,k)=>{ const grow=Math.min(1,k*2.4);
            ctx.fillStyle="rgba(16,16,16,"+(0.85*Math.min(1,3-k*3)).toFixed(3)+")";
            ctx.beginPath(); ctx.ellipse(520,y-14,150*grow,26*grow,0.04,0,7); ctx.fill(); });
          return;
        }
        const d=new Date(), rom=["i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii"][d.getMonth()];
        this.save(rom+"."+d.getFullYear()+"    "+raw.toLowerCase(), H, S);
        H.sfx("keys"); setTimeout(()=>H.sfx("ding"),380);
      }
      e.stopPropagation();
    };
    setTimeout(()=>el.focus({preventScroll:true}),60);
  },
  save(line,H,S){
    try{ const mine=JSON.parse(localStorage.getItem("retro.gb")||"[]"); mine.push(line); localStorage.setItem("retro.gb",JSON.stringify(mine.slice(-40))); }catch(e){}
    if (this.remote) this.remote.push(line);
    S.A&&(S.A.dirty=true); window.__mus&&window.__mus.renderOnce();
    fetch(GB_URL,{ method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({line}) })
      .then(r=>{ if(r.ok) this.fetchRemote(()=>window.__mus&&window.__mus.renderOnce()); }).catch(()=>{});
  },
  hide(){ document.body.classList.remove("gb-open"); if(this.input){ this.input.onkeydown=null; this.input.oninput=null; } },
};

/* ============================================================= ASSEMBLY == */
function build(H){
  if (H && H.S) loadSt(H.S);                    // the key (and the mirror cam) survive a reload
  for (const id in songs){
    const song=songs[id];
    const wallId=Object.keys(cards).find(cid=>(cards[cid].frames||[]).some(f=>f.song===id));
    cards["plaque-"+id]={
      id:"plaque-"+id, proc:"plaque", tone:"paper", room:cards[wallId].room, ambient:cards[wallId].ambient, dynRes:1254,
      nav:{ back:wallId },
      hots:[ { r:[0,0,M,M], cur:"hand", fn:"plaqueClick", wall:wallId } ],
      enter(H2,S){ S.typeOn={ text:song.blurb, t0:performance.now(), cps:46, chars:0, done:false, skip:false, _tick:0 }; },
      draw(ctx,H2,S,t){
        const k = mobK(S);                       // the whole placard reads bigger on a phone
        H2.type(ctx,"no. "+song.n, 768, 430, {cells:4.5*k,align:"center",alpha:0.9,color:"#101010",plain:true,seed:200+song.n});
        H2.type(ctx,song.title, 768, 530, {cells:13*Math.min(k,1.14),align:"center",color:"#101010",plain:true,seed:210+song.n,spacing:0.06});
        H2.type(ctx,song.date, 768, 590, {cells:5*k,align:"center",alpha:1,color:"#101010",plain:true,seed:220+song.n});
        ctx.fillStyle="rgba(16,16,16,0.5)"; ctx.fillRect(560,620,416,3);
        const T=S.typeOn; if(T){ const chars=T.skip?1e9:T.chars;
          if(!T.skip && chars>T._tick+4){ T._tick=chars; H2.sfx("tickSoft"); }
          // a wider column too, so the bigger type still gets a full line of words
          const r=H2.wrap(ctx,T.text,768-(k>1?520:480),700,
                          {cells:6.5*k,maxW:(k>1?1040:960),lh:1.7,chars,color:"#101010",plain:true,seed:230+song.n});
          T.done=r.done;
          if(T.done) H2.type(ctx,"· click to return ·", 768, 1240, {cells:4*k,align:"center",alpha:0.6,color:"#101010",plain:true,seed:240});
        }
      },
    };
  }
}
ACTIONS.plaqueClick=function(hot,H,S){ const T=S.typeOn; if(T&&!T.done){ T.skip=true; S.A.dirty=true; return; } H.go(hot.wall,{ t:"zoomClose", spd:"fast" }); };

/* ================================================================ EXPORT = */
window.WORLD = { start:"facade", cards, songs, PROCS, ACTIONS, build, ALBUM11, FILM, CAM };

})();
