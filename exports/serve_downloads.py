from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

BASE_DIR = Path(__file__).resolve().parent
FILES = {
    "wekeza-stack-images.tar": BASE_DIR / "wekeza-stack-images.tar",
    "wekeza-postgres-volume.tgz": BASE_DIR / "wekeza-postgres-volume.tgz",
    "wekeza-redis-volume.tgz": BASE_DIR / "wekeza-redis-volume.tgz",
    "wekeza-changed-files.zip": BASE_DIR / "wekeza-changed-files.zip",
    "wekeza-changes.patch": BASE_DIR / "wekeza-changes.patch",
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = unquote(self.path.lstrip('/'))

        if path in ("", "index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            items = []
            for name, file_path in FILES.items():
                if file_path.exists():
                    size_mb = file_path.stat().st_size / (1024 * 1024)
                    items.append(f'<li><a href="/{name}">{name}</a> ({size_mb:.2f} MB)</li>')
            html = f"""
            <html><body>
              <h2>Wekeza Downloads</h2>
              <p>Click any file to download.</p>
              <ul>{''.join(items)}</ul>
            </body></html>
            """
            self.wfile.write(html.encode("utf-8"))
            return

        if path not in FILES or not FILES[path].exists():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return

        file_path = FILES[path]
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{file_path.name}"')
        self.send_header("Content-Length", str(file_path.stat().st_size))
        self.end_headers()

        with file_path.open("rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                self.wfile.write(chunk)

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8081), Handler).serve_forever()
