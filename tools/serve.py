#!/usr/bin/env python3
"""Museum dev server: static files + the shared guest book log.
   GET  /gb   → JSON array of entries
   POST /gb   → append {"line": "..."} (server re-checks length/charset)
Run from museum/:  python3 tools/serve.py [port]        (default 8860)
The log lives in guestbook.json next to index.html — one shared book that
every visitor reads and signs. (For the public GitHub Pages build, point
GB_URL in world.js at a tiny worker with this same GET/POST contract.)"""
import http.server, json, os, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "guestbook.json")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8860

def read_log():
    try:
        with open(LOG) as f: return json.load(f)
    except Exception: return []

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == "/gb":
            body = json.dumps(read_log()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()
    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/gb":
            self.send_response(404); self.end_headers(); return
        n = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(min(n, 4096)))
            line = str(data.get("line", ""))[:64]
            ok = line.strip() and all(31 < ord(c) < 0x3000 for c in line)
        except Exception:
            ok = False
        if ok:
            log = read_log()
            log.append(line)
            with open(LOG, "w") as f: json.dump(log[-500:], f)
        self.send_response(200 if ok else 400)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true}' if ok else b'{"ok":false}')
    def log_message(self, *a): pass

print(f"museum on http://localhost:{PORT}  (guest book → {LOG})")
http.server.ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
