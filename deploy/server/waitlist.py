#!/usr/bin/env python3
"""
BazarPeech waitlist endpoint.

Listens on localhost only; nginx proxies /api/waitlist to it. Takes an email,
appends it to a file on disk, then notifies Telegram.

The bot token is read from the environment (systemd EnvironmentFile), never
from the page and never from this file — anything in the page's JavaScript is
readable by every visitor, and a leaked bot token lets a stranger post as the
bot and read its updates.
"""
import json, os, re, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("BOT_TOKEN", "").strip()
CHATS = [c.strip() for c in os.environ.get("CHAT_IDS", "").split(",") if c.strip()]
STORE = os.path.join(os.environ.get("STATE_DIRECTORY", "/var/lib/bazarpeech"), "waitlist.tsv")
PORT  = int(os.environ.get("PORT", "8787"))

MAX_BODY = 4096
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,188}[A-Za-z0-9])?\.[A-Za-z]{2,24}$")

# Second line of defence behind nginx's limit_req, so a flood can't spam Telegram.
_hits = defaultdict(deque)
def rate_ok(ip, limit=5, window=600):
    q, t = _hits[ip], time.time()
    while q and t - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return False
    q.append(t)
    return True

def notify(email, ip):
    """Returns (delivered_count, failures). Never raises — a Telegram outage
    must not lose the signup."""
    if not TOKEN or not CHATS:
        return 0, ["not configured"]
    text = (
        "New waitlist signup\n\n"
        f"Email: {email}\n"
        f"Time:  {time.strftime('%Y-%m-%d %H:%M:%S %Z')}\n"
        f"IP:    {ip}"
    )
    failures, delivered = [], 0
    for chat in CHATS:
        body = urllib.parse.urlencode({
            "chat_id": chat,
            "text": text,
            "disable_web_page_preview": "true",
        }).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{TOKEN}/sendMessage",
            data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                payload = json.loads(r.read().decode())
                if payload.get("ok"):
                    delivered += 1
                else:
                    failures.append(f"{chat}: {payload.get('description')}")
        except urllib.error.HTTPError as e:
            # Telegram puts the real reason in the body — without reading it the
            # log just says "400 Bad Request", which hides the actual cause
            # (almost always: that user has never pressed Start on the bot).
            try:
                detail = json.loads(e.read().decode()).get("description", str(e))
            except Exception:                                   # noqa: BLE001
                detail = str(e)
            hint = " (that user must send /start to the bot first)" \
                   if "chat not found" in detail.lower() else ""
            failures.append(f"{chat}: {detail}{hint}")
        except Exception as e:                                  # noqa: BLE001
            failures.append(f"{chat}: {e}")
    return delivered, failures

def record(email, ip, ua):
    os.makedirs(os.path.dirname(STORE), exist_ok=True)
    with open(STORE, "a", encoding="utf-8") as fh:
        fh.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')}\t{email}\t{ip}\t{ua[:200]}\n")

class Handler(BaseHTTPRequestHandler):
    server_version = "bazarpeech"
    protocol_version = "HTTP/1.1"

    def _json(self, code, obj):
        raw = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _ip(self):
        return self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()

    def do_GET(self):
        if self.path == "/api/waitlist/health":
            return self._json(200, {"ok": True, "configured": bool(TOKEN and CHATS)})
        self._json(404, {"ok": False})

    def do_POST(self):
        if self.path != "/api/waitlist":
            return self._json(404, {"ok": False})

        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self._json(400, {"ok": False, "error": "bad_request"})
        if length <= 0 or length > MAX_BODY:
            return self._json(413, {"ok": False, "error": "too_large"})

        ip = self._ip()
        if not rate_ok(ip):
            return self._json(429, {"ok": False, "error": "rate_limited"})

        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            email = str(data.get("email", "")).strip().lower()
        except Exception:                                       # noqa: BLE001
            return self._json(400, {"ok": False, "error": "bad_request"})

        if not EMAIL_RE.match(email):
            return self._json(400, {"ok": False, "error": "invalid_email"})

        # Store first: if Telegram is down the signup is still captured, and the
        # visitor should not be told their address was rejected.
        try:
            record(email, ip, self.headers.get("User-Agent", ""))
        except Exception as e:                                  # noqa: BLE001
            print(f"[waitlist] store failed: {e}", flush=True)

        delivered, failures = notify(email, ip)
        for f in failures:
            print(f"[waitlist] telegram NOT delivered for {email} -> {f}", flush=True)
        if delivered:
            print(f"[waitlist] {email} delivered to {delivered}/{len(CHATS)} recipient(s)", flush=True)
        # The signup is on disk either way, so the visitor always sees success.
        self._json(200, {"ok": True, "notified": delivered > 0})

    def log_message(self, fmt, *args):
        print(f"[waitlist] {self.address_string()} {fmt % args}", flush=True)

if __name__ == "__main__":
    print(f"[waitlist] listening on 127.0.0.1:{PORT}; "
          f"telegram {'configured' if TOKEN and CHATS else 'NOT configured'}; "
          f"store={STORE}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
