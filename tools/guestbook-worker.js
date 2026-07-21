/* =============================================================================
   the [retrospective] guest book — a forever backend
   =============================================================================
   GitHub Pages is static: it cannot store anything. Without an endpoint the
   book falls back to each visitor's own browser, so nobody sees anybody else's
   signatures. This little Cloudflare Worker gives it a shared, permanent home.

   It speaks exactly the contract the museum already expects:
     GET  <url>   ->  ["vii.2026    a line", ...]          (oldest first)
     POST <url>   <-  {"line": "vii.2026    a line"}       -> {"ok":true}

   ---------------------------------------------------------------------------
   DEPLOY (about two minutes, free tier)
   ---------------------------------------------------------------------------
   1. dash.cloudflare.com -> Workers & Pages -> Create -> Worker. Name it
      something like "retrospective-guestbook". Deploy the starter.
   2. Edit code: replace everything with this file. Deploy.
   3. Settings -> Bindings -> Add -> KV namespace.
         Variable name:  GB          (exactly this)
         KV namespace:   create one, any name
   4. Copy the worker URL (https://retrospective-guestbook.<you>.workers.dev)
   5. In world.js set:   const GB_URL = "https://…workers.dev";
      Bump the ?v= in index.html, commit, push.

   Entries are capped and sanitised here as well as in the browser, so a hand-
   crafted POST can't stuff the book or smuggle anything through.
   ========================================================================== */

const KEY      = "book";     // the KV key everything lives under
const MAX_LINE = 60;         // characters per signature
/* Signatures retained. The book is meant to grow forever, so this is set far
   past any realistic use: 50,000 lines x ~60 chars is about 3MB, and a KV value
   can hold 25MB. Past this the oldest finally drop off. */
const MAX_KEEP = 50000;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });

async function read(env) {
  try { return JSON.parse((await env.GB.get(KEY)) || "[]"); }
  catch { return []; }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (!env || !env.GB)
      return json({ error: "no KV binding named GB — see step 3 in this file" }, 500);

    if (request.method === "GET") return json(await read(env));

    if (request.method === "POST") {
      let line;
      try { line = (await request.json()).line; } catch { return json({ error: "bad json" }, 400); }
      if (typeof line !== "string") return json({ error: "no line" }, 400);

      // one line, printable, bounded — never trust the client
      // strip control characters and stop space-flooding, but KEEP the run of
      // spaces the museum uses to column the date away from the message
      line = line.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/ {7,}/g, "      ").trim().slice(0, MAX_LINE);
      if (!line) return json({ error: "empty" }, 400);

      const book = await read(env);
      // ignore an exact repeat of the last entry (double-taps, retries)
      if (book[book.length - 1] !== line) {
        book.push(line);
        await env.GB.put(KEY, JSON.stringify(book.slice(-MAX_KEEP)));
      }
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  },
};
