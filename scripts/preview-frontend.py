"""Preview local UI with the public catalog and Telegram sign-in entrypoint.

Authentication completes on the production origin via the Telegram bot's link.
Never proxy cookies, tokens, or authenticated mutations to production.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1] / "frontend"
PUBLIC_ORIGIN = "https://fraerapp.ru"


class Preview(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        # Request URLs may contain login tokens; never log them.
        pass

    def send_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/auth/telegram/login", "/api/catalog/stories", "/api/catalog/engagement"):
            try:
                # Only these public GET endpoints; no browser headers/cookies.
                request = Request(PUBLIC_ORIGIN + path, headers={
                    "Accept": "application/json", "User-Agent": "Mozilla/5.0",
                })
                with urlopen(request, timeout=15) as response:
                    data = json.load(response)
                self.send_json(200, data)
            except Exception:
                self.send_json(503, {"message": "Public service unavailable"})
        elif path.startswith("/auth/"):
            self.send_json(401, {"message": "Sign in on the public website"})
        elif path.startswith("/history"):
            self.path = "/index.html"
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        self.send_json(503, {"code": "AUTH_PREVIEW", "message": "Use the public website for authentication"})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Preview).serve_forever()
