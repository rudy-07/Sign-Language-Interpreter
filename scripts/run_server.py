"""
Development HTTP Server for Sign Language Interpreter.
Serves the web application locally with proper CORS and MIME headers for MediaPipe/TF.js.
"""

import argparse
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys


class CustomRequestHandler(SimpleHTTPRequestHandler):
    """Custom request handler enabling CORS and correct caching/MIME settings."""

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()


def run_server(port: int = 8000, directory: str = "."):
    """Starts the local development HTTP server."""
    root_dir = os.path.abspath(directory)
    handler = partial(CustomRequestHandler, directory=root_dir)

    print("=" * 70)
    print(" SIGN LANGUAGE INTERPRETER — LOCAL DEV SERVER")
    print("=" * 70)
    print(f" Serving Directory : {root_dir}")
    print(f" Local URL         : http://localhost:{port}")
    print(f" Network URL       : http://127.0.0.1:{port}")
    print(" Press Ctrl+C to stop the server.")
    print("=" * 70)

    try:
        with HTTPServer(("", port), handler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[+] Server stopped gracefully.")
        sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Sign Language Interpreter Dev Server")
    parser.add_argument("--port", "-p", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument(
        "--dir", "-d", type=str, default=os.path.join(os.path.dirname(__file__), ".."), help="Root directory"
    )
    args = parser.parse_args()
    run_server(port=args.port, directory=args.dir)
