import argparse
import functools
import http.server
import os
import socketserver
import threading
import webbrowser


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.glb': 'model/gltf-binary',
        '.png': 'image/png',
    }

    def log_message(self, format, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description='Server lokal Tur Virtual 3D Rumah Minimalis')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()

    root = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(QuietHandler, directory=root)
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(('127.0.0.1', args.port), handler) as httpd:
        url = f'http://127.0.0.1:{args.port}/index.html'
        print(f'Server Tur 3D berjalan di {url}')
        if not args.no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
