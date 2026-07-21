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
    i.onload = () => { if (window.__mus) { window.__mus.state.A && (window.__mus.state.A.dirty = true); window.__mus.renderOnce(); } };
    i.src = V + name + ".png?av=9"; IMG[name] = i; }
  return IMG[name];
}
["el-key","el-key-w","el-ufo","el-straysky","el-hpic1","el-hpic2"].forEach(loadImg);

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
function starsBg(on) {                          // fill the WHOLE window (letterbox bars too) with stars
  document.body.style.backgroundImage = on ? `url(${V}el-straysky.png?av=9)` : "";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
}
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
      { r:[540,780,460,380], cur:"fwd", exitZone:true, fn:"leaveMuseum" },   // the end of the road → leave
    ],
    after(H,S){ if (S.st.starsOut) starsBg(true); },
    leave(H,S){ starsBg(false); },
    draw(ctx,H,S,t){
      const st=S.st;
      if (st.starsOut) { elemInvert(ctx,"el-straysky", 40,40,1456,660); }
      if (!st.lampOut) {                         // glow at the drawn lamp head (top-right)
        const lx=1035, ly=345;
        const lg=ctx.createRadialGradient(lx,ly,4,lx,ly,120); lg.addColorStop(0,"rgba(244,240,228,0.9)"); lg.addColorStop(1,"rgba(244,240,228,0)");
        ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(lx,ly,120,0,7); ctx.fill();
        const cg=ctx.createLinearGradient(0,345,0,1160); cg.addColorStop(0,"rgba(238,234,222,0.16)"); cg.addColorStop(1,"rgba(238,234,222,0.01)");
        ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(1000,360); ctx.lineTo(760,1160); ctx.lineTo(1200,1160); ctx.closePath(); ctx.fill();
      }
      if (st.ufoAt && t < st.ufoAt) {}          // ufo drawn by its anim
      H.type(ctx,"the museum is behind you", 768, 1500, { cells:3.2, align:"center", alpha:0.28, color:"#8a867c", plain:true });
      // the way out — painted on the road at the end of it; brightens when you hover the end
      const leaving = S.hover && S.hover.exitZone;
      H.type(ctx,"go back to clayandkelsy.com?", 768, 1130, { cells:5, align:"center", plain:true, color:"#171717", alpha: leaving?0.96:0.4 });
    },
  },

  /* ---- facade ---- */
  "facade": {
    id:"facade", img:V+"facade.png", tone:"ink", room:"ent", ambient:"street", depth:5,
    nav:{ fwd:"hall-1", back:"street" },
    hots:[
      { r:[600,760,340,320], cur:"fwd", go:"hall-1", t:"dissolve", spd:"slow" },
      { r:[280,470,700,150], cur:"hand", sfx:"knock" },
      { r:[1000,1160,460,300], cur:"hand", fn:"grassMouse" },
    ],
    draw(ctx,H,S,t){
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
      { r:[90,420,240,690],  cur:"hand", fn:"rattleDoor" },
    ],
  },
  "hall-2": {
    id:"hall-2", img:V+"hall-2.png", tone:"ink", room:"ent", ambient:"hall", depth:3,
    nav:{ back:"hall-1" },
    hots:[
      { r:[560,400,400,610], cur:"fwd", go:"door", t:"dissolve", spd:"fast" },
      { r:[1250,360,244,780], cur:"lock", curKey:"key", fn:"mirrorDoor", onHover:"mirrorHover" },
      { r:[318,460,160,420], cur:"zoom", fn:"toFrame", pic:1, sfx:"knock" },
      { r:[1010,470,180,410], cur:"zoom", fn:"toFrame", pic:2, sfx:"knock" },
    ],
  },

  /* ---- the museum door ---- */
  "door": {
    id:"door", img:V+"door.png", tone:"ink", room:"ent", ambient:"hall", depth:1,
    nav:{ back:"hall-2" },
    hots:[
      { r:[430,300,660,1080], cur:"hand", go:"rotunda", t:"barnOpen", spd:"slow", sfx:"creakDoor" },
    ],
    draw(ctx,H){ H.type(ctx,"MVSEVM", 806, 230, { cells:4.2, align:"center", color:"#101010", plain:true, seed:41, spacing:0.18 }); },
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
    ],
    draw(ctx,H,S,t){ /* no doorway labels — the doorways speak for themselves */ },
  },

  /* ---- galleries ---- (mouse hole lives in y17a) */
  "early":  { id:"early",  img:V+"gallery-a.png", tone:"ink", room:"early", ambient:"room",
    nav:{ back:"rotunda" }, frames:[{ song:"laputa", r:[318,486,264,354], plate:[395,966,118,41] },{ song:"intro", r:[978,486,252,354], plate:[1042,966,117,41] }],
    draw(ctx,H,S,t){ roomTitle(ctx,H,"EARLY WORKS",61); } },

  "y17a": { id:"y17a", img:V+"gallery-mh.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ right:"y17b", back:"rotunda" }, frames:[{ song:"no-good-reason", r:[402,564,246,276], plate:[485,966,82,30] },{ song:"currently-alone", r:[954,564,228,276], plate:[1026,966,83,30] }],
    hots:[ { r:[1280,1120,120,110], cur:"zoom", go:"mh-zoom1", t:"zoomOpen", spd:"fast", at:[1340,1170] } ],
    draw(ctx,H,S,t){ roomTitle(ctx,H,"2017",71); } },

  "y17b": { id:"y17b", img:V+"gallery-c.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ left:"y17a", back:"rotunda" },
    frames:[{ song:"casino", r:[252,576,168,240], plate:[312,940,72,22] },{ song:"wondering", r:[630,534,270,294], plate:[728,950,71,23] },{ song:"i-can-do-it-all", r:[1104,576,174,240], plate:[1174,940,73,22] }],
    draw(ctx,H,S,t){ } },

  "late-a": { id:"late-a", img:V+"gallery-d.png", tone:"ink", room:"late", ambient:"room",
    nav:{ right:"late-b", back:"rotunda" },
    frames:[{ song:"heartbeats", r:[228,624,180,258], plate:[280,1005,83,30] },{ song:"i-cant-forget", r:[642,558,246,330], plate:[727,1011,82,29] },{ song:"bea5", r:[1122,624,180,270], plate:[1174,1005,85,30] }],
    draw(ctx,H,S,t){ roomTitle(ctx,H,"2018 - 2019",91); } },

  "late-b": { id:"late-b", img:V+"room-1.png", tone:"ink", room:"late", ambient:"room",
    nav:{ left:"late-a", back:"rotunda" }, frames:[{ song:"seven", r:[522,426,492,504], plate:[689,1076,156,48] }],
    draw(ctx,H,S,t){ } },

  "annex": { id:"annex", img:V+"gallery-b.png", tone:"ink", room:"annex", ambient:"annex",
    nav:{ back:"rotunda" }, frames:[{ song:"hate-me", r:[288,486,270,378], plate:[360,978,134,51] },{ song:"kanye", r:[952,456,347,447], plate:[1059,1009,134,51], shape:"oval" }],
    draw(ctx,H,S,t){
      roomTitle(ctx,H,"REMIXES",111);
      H.type(ctx,"please remember to love the misunderstood.", 768, 1420, {cells:4,align:"center",alpha:0.6,color:"#c9c4b4",plain:true,seed:113}); } },

  /* ---- mouse hole zoom sequence ---- */
  "mh-zoom1": { id:"mh-zoom1", img:V+"mh-zoom1.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"y17a" },
    hots:[ { r:[540,620,320,320], cur:"zoom", go:"mh-zoom2", t:"zoomOpen", spd:"fast", at:[700,780] } ] },
  "mh-zoom2": { id:"mh-zoom2", img:V+"mh-zoom2.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"mh-zoom1" },
    hots:[ { r:[500,500,540,540], cur:"zoom", go:"mousehole", t:"irisOpen", spd:"slow", at:[768,768] } ] },

  /* ---- inside the mouse hole ---- */
  "mousehole": {
    id:"mousehole", img:V+"mousehole.png", tone:"ink", room:"y17", ambient:"room",
    nav:{ back:"y17a" },
    hots:[
      { r:[790,400,280,220], cur:"listen", fn:"mouseSqueak" },
      { r:[660,1030,360,300], cur:"key", fn:"takeKey" },
    ],
    draw(ctx,H,S,t){
      if (!S.st.hasKey){
        // the key rests on the lit floor, exactly where the pick-up animation lifts it from
        elem(ctx,"el-key", 690, 1095, 280, 180);
        H.type(ctx,"the janitor's key", 830, 1300, {cells:2.8,align:"center",color:"#101010",plain:true});
      }
    },
  },

  /* ---- hallway picture zoom-ins ---- */
  "hframe": {
    id:"hframe", img:V+"hframe.png", tone:"ink", room:"ent", ambient:"hall", depth:3,
    nav:{ back:"hall-2" },
    draw(ctx,H,S,t){
      const n = S.st.hframePic || 1;
      // the frame opening is black; fit the (black-bg) picture inside it
      ctx.fillStyle = "#000"; ctx.fillRect(452, 360, 632, 632);
      elem(ctx, "el-hpic"+n, 452, 400, 632, 552);
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
    leave(H,S){ ACTIONS.camOff(); },
    draw(ctx,H,S,t){
      // the mirror glass fills the big ornate black frame opening (MIRROR_R)
      const R=MIRROR_R, mcx=R[0]+R[2]/2, mcy=R[1]+R[3]/2;
      ctx.save();
      ctx.beginPath(); ctx.rect(R[0],R[1],R[2],R[3]); ctx.clip();
      if (CAM.on && CAM.video && CAM.video.videoWidth){
        const vw=CAM.video.videoWidth, vh=CAM.video.videoHeight, s=Math.max(R[2]/vw,R[3]/vh)*1.02;
        ctx.translate(mcx,mcy); ctx.scale(-1,1);
        try{ ctx.filter="grayscale(1) contrast(1.2)"; }catch(e){}
        ctx.drawImage(CAM.video, -vw*s/2, -vh*s/2, vw*s, vh*s);
        try{ ctx.filter="none"; }catch(e){}
      } else {
        H.type(ctx, CAM.err?"the glass shows nothing":"a dark mirror", mcx, mcy-10, {cells:6,align:"center",alpha:0.7,color:"#e8e4d8",plain:true});
        if(!CAM.err) H.type(ctx,"· click to look ·", mcx, mcy+60, {cells:4,align:"center",alpha:0.5,color:"#e8e4d8",plain:true});
      }
      ctx.restore();
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
  boothBell(hot,H){ /* bellLow via sfx on the hotspot */ },

  grassMouse(hot,H,S){                 // a little mouse peeks out of the grass, then scurries off
    H.sfx("rustle"); setTimeout(()=>H.sfx("squeak"),280); const r=hot.r;
    const bx=r[0]+r[2]*0.5, by=r[1]+r[3]-70;
    H.anim("facade", 1600, (ctx,k)=>{
      ctx.fillStyle="rgb(24,24,22)";
      if(k<0.6){                        // pop up and look
        const up=Math.min(1,k*3)*72, cx=bx, cy=by-up;
        ctx.beginPath(); ctx.ellipse(cx,cy+18,30,26,0,0,7); ctx.fill();       // body
        ctx.beginPath(); ctx.arc(cx,cy-8,20,0,7); ctx.fill();                 // head
        ctx.beginPath(); ctx.arc(cx-16,cy-24,11,0,7); ctx.fill();             // ears
        ctx.beginPath(); ctx.arc(cx+16,cy-24,11,0,7); ctx.fill();
        ctx.fillStyle="rgb(240,236,224)"; ctx.beginPath(); ctx.arc(cx+8,cy-10,3.5,0,7); ctx.fill(); // eye
      } else {                          // scurry off to the left
        const run=(k-0.6)/0.4, x=bx-run*540, y=by-6+Math.sin(run*34)*3;
        ctx.beginPath(); ctx.ellipse(x,y+18,30,15,0.05,0,7); ctx.fill();      // body
        ctx.beginPath(); ctx.arc(x-20,y+8,15,0,7); ctx.fill();                // head leading left
        ctx.strokeStyle="rgb(24,24,22)"; ctx.lineWidth=5; ctx.lineCap="round";
        ctx.beginPath(); ctx.moveTo(x+28,y+20); ctx.quadraticCurveTo(x+56,y+8,x+74,y+24); ctx.stroke(); // tail
      }
    });
  },

  /* street */
  skyUFO(hot,H,S){
    const st=S.st;
    if (st.starsOut){ H.sfx("tickSoft"); return; }
    if (st.ufoFlying) return;
    st.ufoFlying=1; H.sfx("whisper");
    H.anim("street", 3000, (ctx,k)=>{
      const x = -300 + k*2100, y = 240 + Math.sin(k*3.14)*(-60);
      elem(ctx,"el-ufo", x, y, 360, 118);
    }, ()=>{ st.ufoFlying=0; st.starsOut=1; starsBg(true); S.A.dirty=true; H.sfx("musicbox"); });
  },
  // walk off the end of the road → leave the experience (navigates the TOP frame when embedded)
  leaveMuseum(hot,H,S){
    H.sfx("creakDoor");
    const url = "https://clayandkelsy.com";
    setTimeout(()=>{ try { window.top.location.href = url; } catch(e){ window.location.href = url; } }, 160);
  },
  streetLight(hot,H,S){
    if (S.st.lampOut){ H.sfx("tickSoft"); return; }
    S.st.lampOut=1; H.sfx("buzz"); window.AUDIO.ambient("dark"); S.A.dirty=true;
  },

  /* rotunda flower */
  glassTapFlower(hot,H,S){
    H.sfx("glassTap");
    H.anim("rotunda", 600, (ctx,k)=>{ ctx.strokeStyle="rgba(240,236,224,"+(0.5*(1-k)).toFixed(3)+")"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(1075,980,120+k*30,175+k*34,0,0,7); ctx.stroke(); });
  },

  /* hallway picture zoom */
  toFrame(hot,H,S){ S.st.hframePic = hot.pic; H.go("hframe",{ t:"zoomOpen", spd:"fast" }); },

  /* mouse hole */
  mouseSqueak(hot,H){ H.sfx("squeak"); },
  takeKey(hot,H,S){
    if (S.st.hasKey){ H.sfx("tickSoft"); return; }
    S.st.hasKey=1; H.sfx("keys"); setTimeout(()=>H.sfx("squeak"),200);
    H.anim("mousehole", 900, (ctx,k)=>{ ctx.save(); ctx.globalAlpha=1-k; ctx.translate(830,1185-k*160); ctx.rotate(k*0.6);
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
    if (CAM.on){ ACTIONS.camOff(); S.A.dirty=true; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ CAM.err=true; H.sfx("brokenNote"); S.A.dirty=true; return; }
    try{
      CAM.stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640 }, audio:false });
      CAM.video = document.createElement("video"); CAM.video.srcObject=CAM.stream; CAM.video.muted=true; CAM.video.playsInline=true;
      await CAM.video.play(); CAM.on=true; CAM.err=false; cards["mirror"].live=true; H.sfx("tick");
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
  for (const id in songs){
    const song=songs[id];
    const wallId=Object.keys(cards).find(cid=>(cards[cid].frames||[]).some(f=>f.song===id));
    cards["plaque-"+id]={
      id:"plaque-"+id, proc:"plaque", tone:"paper", room:cards[wallId].room, ambient:cards[wallId].ambient, dynRes:1254,
      nav:{ back:wallId },
      hots:[ { r:[0,0,M,M], cur:"hand", fn:"plaqueClick", wall:wallId } ],
      enter(H2,S){ S.typeOn={ text:song.blurb, t0:performance.now(), cps:46, chars:0, done:false, skip:false, _tick:0 }; },
      draw(ctx,H2,S,t){
        H2.type(ctx,"no. "+song.n, 768, 430, {cells:4.5,align:"center",alpha:0.9,color:"#101010",plain:true,seed:200+song.n});
        H2.type(ctx,song.title, 768, 530, {cells:13,align:"center",color:"#101010",plain:true,seed:210+song.n,spacing:0.06});
        H2.type(ctx,song.date, 768, 590, {cells:5,align:"center",alpha:1,color:"#101010",plain:true,seed:220+song.n});
        ctx.fillStyle="rgba(16,16,16,0.5)"; ctx.fillRect(560,620,416,3);
        const T=S.typeOn; if(T){ const chars=T.skip?1e9:T.chars;
          if(!T.skip && chars>T._tick+4){ T._tick=chars; H2.sfx("tickSoft"); }
          const r=H2.wrap(ctx,T.text,300,700,{cells:6.5,maxW:960,lh:1.7,chars,color:"#101010",plain:true,seed:230+song.n});
          T.done=r.done;
          if(T.done) H2.type(ctx,"· click to return ·", 768, 1200, {cells:4,align:"center",alpha:0.6,color:"#101010",plain:true,seed:240});
        }
      },
    };
  }
}
ACTIONS.plaqueClick=function(hot,H,S){ const T=S.typeOn; if(T&&!T.done){ T.skip=true; S.A.dirty=true; return; } H.go(hot.wall,{ t:"zoomClose", spd:"fast" }); };

/* ================================================================ EXPORT = */
window.WORLD = { start:"facade", cards, songs, PROCS, ACTIONS, build, ALBUM11 };

})();
