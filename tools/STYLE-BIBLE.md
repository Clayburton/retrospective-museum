# [retrospective] museum — STYLE BIBLE
Paste the BASE paragraph + one SCENE line into ChatGPT (image generation), square 1:1.
Every image gets ingested by `ingest.py` (grayscale → autocontrast → 1536² jpg) and then
live-dithered to 1-bit by the engine — so generate for TONE STRUCTURE, not detail.

## BASE (prepend to every prompt) — v2, the CORRECT style (Clay, round 3)
Square 1:1 black and white 1-bit VIDEO GAME ART in the exact style of classic 1988
Macintosh HyperCard adventure games such as The Manhole and Cosmic Osmo and the Worlds
Beyond the Mackerel. A confident clean BLACK OUTLINE DRAWING with large flat areas of
pure white and pure black; shading rendered ONLY as coarse regular checkerboard and
halftone dot patterns; absolutely no gray tones, no gradients, no photographic texture,
no film grain. Hand-drawn, whimsical but slightly eerie, dilapidated municipal museum,
empty of people. Strict frontal one-point-perspective composition. ABSOLUTELY NO TEXT,
no lettering, no numbers — every sign, plaque or nameplate is BLANK (we typeset all
text ourselves). Keep every important object inside the central 60% of the square.

### v1 (photographic) — RETIRED. Clay rejected the converted-photo look: "not the
graphics." Never prompt "photograph/film grain" again; the museum is a DRAWING.

## SCENES (one per image)
- facade      — Exterior at night: a small neoclassical museum building with a blank
                stone frieze panel above four columns, dark double doors at the top of
                three wide steps, dead grass in front, a full moon with a thin cloud
                band to the right of the roofline, starless black sky.
- hall-1      — Interior corridor: long narrow hallway receding to a dark doorway at
                center. On the right wall a small lit ticket-booth window with a
                counter and a bell, unmanned. On the left a closed service door with
                a blank plate. A single caged bulb overhead.
- hall-2      — Same corridor style, further in: on the left wall two framed paintings
                hung TURNED AROUND facing the wall (canvas backs and stretcher bars
                visible). On the right a closed office door with a glowing frosted
                glass window. Dark doorway ahead at center.
- hall-3      — Same corridor style, narrower: a single hanging cone lamp swings over
                the middle of the hall, its light pooling on the floorboards; far ahead
                a small dark double door, slightly ajar.
- door        — Close-up, head-on: tall old double doors with carved panel moldings,
                two round tarnished brass handles at center, a blank brass plate above
                the doors, a glow seeping through the gap beneath.
- rotunda     — A round domed museum hall seen head-on: FOUR evenly spaced dark
                doorway openings across the curved wall, each with a blank stone
                lintel plate above it. In the foreground a wooden lectern with an open
                ledger book (left of center) and a small stone plinth with an antique
                typewriter under glass (right of center). Circular inlaid marble
                floor, weak light falling from an unseen oculus above.
- room-early  — Gallery wall head-on: TWO large empty ornate picture frames hanging at
                eye height, evenly spaced, each with a small blank nameplate below.
                An old iron radiator low on the far left; a tiny mouse-hole in the
                baseboard at lower right; a wooden bench silhouette at bottom center.
- room-y17a   — Same gallery style: THREE empty ornate frames in a row (center one
                slightly larger), blank nameplates below each.
- room-y17b   — Same gallery style: TWO empty ornate frames, blank nameplates.
- room-late-a — Same gallery style: TWO empty ornate frames, blank nameplates.
- room-late-b — Same gallery style: TWO empty ornate frames toward the left, and on
                the right side a narrow closed wooden door with a keyhole and a small
                blank label plate — a storage door.
- annex       — Smaller darker side room: TWO empty ornate frames, blank nameplates,
                a velvet museum rope on two brass stanchions across the bottom
                foreground, one weak spotlight per frame.

## RULES LEARNED
- Never let the model draw text — it garbles; all type is ours (typed live).
- Each hallway step is its OWN tableau (a hard cut) — never ask for spatial
  continuity between steps; the shared style + dithering unify them.
- Generate for big value masses (solid blacks, clear mid separations, bright pools);
  fine detail dissolves in the dither.
- After ingest, open `?debug=1` and move `world.js` hotspot/frame rects to match the
  art by eye. The safe box (central 336…1200 of the master) still applies.
