# -*- coding: utf-8 -*-
"""Serwer prototypu: pliki statyczne z ../mockup i API zbudowane z modułów serwera.
Uruchomienie: python3 server.py [port]   (domyślnie 8790)"""
import gzip
import hashlib
import hmac
import io
import json
import os
import sys
import threading
import traceback
import time
import urllib.error
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import agent
import api
import api as api_mod
import lmstudio
import tlumacz
import ustawienia
import ustawienia as ustawienia_mod
from ustawienia import HOST, LOG, ROOT, k, log, zablokowane
import mowa
import znak

BLOKADA = ustawienia.BLOKADA
ODDAJ = ustawienia.ODDAJ
WOLNO_PISAC = ustawienia.WOLNO_PISAC
KEYS = ustawienia.KEYS
_lock = ustawienia._lock

from api import MAX_LETTER_TEXT, LETTER_SYSTEM, extract_pdf_text, letter_text, validate_letter_result
from api import _przygotuj_pismo, _rozmowa
from mowa import tts


def proxy_token():
    """Token przekazywania /v1/*: PROXY_TOKEN, a za niego token serwera modelu. Bez tokenu proxy jest wyłączone."""
    return ustawienia.proxy_token() if ustawienia.proxy_wlaczone() else ''


CACHE_STATYKOW = os.environ.get('CACHE_STATIC') or 'public, max-age=300, must-revalidate'
_ETAGI = {}
_ETAGI_LOCK = threading.Lock()


def etag_pliku(sciezka):
    try:
        stat = os.stat(sciezka)
    except OSError:
        return None
    klucz = (sciezka, stat.st_mtime_ns, stat.st_size)
    with _ETAGI_LOCK:
        zapamietany = _ETAGI.get(sciezka)
        if zapamietany and zapamietany[0] == klucz:
            return zapamietany[1]
    try:
        with open(sciezka, 'rb') as plik:
            etag = '"%s"' % hashlib.sha256(plik.read()).hexdigest()[:32]
    except OSError:
        return None
    with _ETAGI_LOCK:
        _ETAGI[sciezka] = (klucz, etag)
    return etag

NAGLOWKI_BEZPIECZENSTWA = (
    ('X-Content-Type-Options', 'nosniff'),
    ('Referrer-Policy', 'strict-origin-when-cross-origin'),
    ('X-Frame-Options', 'SAMEORIGIN'),
    ('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()'),
    ('Cross-Origin-Opener-Policy', 'same-origin'),
    ('Strict-Transport-Security', 'max-age=31536000; includeSubDomains') if os.environ.get('HTTPS_ONLY', '').lower() in ('1', 'true', 'yes') else None,
    ('Content-Security-Policy', os.environ.get('CSP') or
     "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' data: blob: "
     "https://tile.openstreetmap.org https://www.openstreetmap.org https://www.gov.pl https://meteo.imgw.pl; "
     "font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://nominatim.openstreetmap.org "
     "https://overpass-api.de https://meteo.imgw.pl; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"),
)
NAGLOWKI_BEZPIECZENSTWA = tuple(n for n in NAGLOWKI_BEZPIECZENSTWA if n)


class Serwer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = int(os.environ.get('LISTEN_BACKLOG') or 128)


class H(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=ROOT, **kw)
    def send_response(self, code, message=None):
        if hasattr(self.wfile, 'czesci'):   # tryb WSGI (Vercel): nagłówki i treść idą do listy, nie do gniazda
            self.status = '%d %s' % (code, self.responses.get(code, ('',))[0] if message is None else message)
            self.wfile.naglowki = []
            return
        return super().send_response(code, message)
    def send_header(self, keyword, value):
        if hasattr(self.wfile, 'czesci'):
            self.wfile.naglowki.append((keyword, str(value)))
            return
        return super().send_header(keyword, value)
    def end_headers(self):
        if getattr(self, '_statyk', False):
            self._statyk = False
            self.send_header('ETag', self._etag)
            self.send_header('Cache-Control', CACHE_STATYKOW)
            self._etag = None
        if not getattr(self, '_bezpieczne_naglowki', False):
            self._bezpieczne_naglowki = True
            for nazwa, wartosc in NAGLOWKI_BEZPIECZENSTWA:
                self.send_header(nazwa, wartosc)
        if hasattr(self.wfile, 'czesci'): return   # tryb WSGI: nic nie wysyłamy do gniazda
        return super().end_headers()
    def odtworz_naglowki(self, naglowki):
        istniejace = {k.lower() for k, _ in naglowki}
        for nazwa, wartosc in NAGLOWKI_BEZPIECZENSTWA:
            if nazwa.lower() not in istniejace: naglowki.append((nazwa, wartosc))
    def handle(self):
        try: super().handle()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): pass
    def handle_one_request(self):
        if not hasattr(self.wfile, 'czesci'): return super().handle_one_request()   # tryb WSGI: żądanie podaje _Cien, nie gniazdo
        self.raw_requestline = self.rfile.readline(65537)
        if not self.raw_requestline: self.close_connection = True; return
        if not self.parse_request(): return
        metoda = getattr(self, 'do_' + self.command, None)
        if metoda is None: return self.send_error(501, 'Unsupported method (%r)' % self.command)
        metoda()
    def log_message(self, *a): pass
    def identyfikator(self):
        try:
            return self.__dict__.setdefault('_request_id', uuid.uuid4().hex[:16])
        except Exception:
            return uuid.uuid4().hex[:16]
    def js(self, obj, code=200, naglowki=None):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(b))); self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Request-Id', self.identyfikator())
        for nazwa, wartosc in (naglowki or {}).items(): self.send_header(nazwa, wartosc)
        self.end_headers(); self.wfile.write(b)
    def blad(self, message, code=400, kod='blad', retryable=False, retry_after=None, **pola):
        naglowki = {'Retry-After': str(int(retry_after))} if retry_after else None
        return self.js(dict(error=message, code=kod, message=message, retryable=retryable, request_id=self.identyfikator(), **pola), code, naglowki)
    def body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n) if n else b''
    def naglowki(self):
        return dict(self.headers, **{'x-query': urlparse(self.path).query})
    def naglowek(self, nazwa):
        return next((v for k, v in self.headers.items() if k.lower() == nazwa.lower()), None)
    def lmstudio_proxy(self, endpoint):
        if not ustawienia.proxy_wlaczone():
            return self.blad(lmstudio.MESSAGES['proxy'], 403, 'proxy')
        if agent.PROVIDER not in ('lmstudio', 'workers'):
            return self.blad('Dostawca modelu nie jest włączony.', 404, 'dostawca')
        token = proxy_token()
        if not token:
            return self.blad(lmstudio.MESSAGES['proxy'], 403, 'proxy')
        if zablokowane(): return self.blad('Dostęp do modelu jest zablokowany.', 503, 'zablokowane', retryable=True)
        if not hmac.compare_digest((self.headers.get('Authorization') or '').encode(), ('Bearer ' + token).encode()):
            return self.blad(lmstudio.MESSAGES['proxy_auth'], 401, 'proxy_auth')
        data = None
        if self.command == 'POST':
            if self.headers.get('Transfer-Encoding'): return self.blad('Wymagany nagłówek Content-Length.', 411, 'walidacja')
            try:
                length = int(self.headers.get('Content-Length') or '-1')
            except ValueError:
                length = -1
            if length < 0: return self.blad('Wymagany poprawny Content-Length.', 411, 'walidacja')
            if length > 16 * 1024 * 1024: return self.blad('Żądanie jest za duże.', 413, 'walidacja')
            data = self.rfile.read(length)
            if len(data) != length: return self.blad('Niepełne żądanie.', 400, 'walidacja')
        if endpoint not in lmstudio.ENDPOINTS:
            return self.blad('nie ma takiego adresu', 404, 'nieznany')
        baza, klucz = (agent.WORKERS_BASE_URL, agent.WORKERS_TOKEN or 'bez-klucza') if agent.PROVIDER == 'workers' else (agent.LM_STUDIO_BASE_URL, k('lmstudio'))
        try:
            response = lmstudio.open_request(baza, endpoint, klucz, data=data, timeout=agent.WORKERS_TIMEOUT if agent.PROVIDER == 'workers' else agent.LM_STUDIO_TIMEOUT)
        except urllib.error.HTTPError as error:
            if 300 <= error.code < 400: return self.blad(lmstudio.MESSAGES['response'], 502, 'response', retryable=True)
            response = error
        except Exception as error:
            problem = lmstudio.classify_error(error)
            return self.blad(lmstudio.messages(agent.PROVIDER)[problem.kind], 502, problem.kind, retryable=problem.kind in ('timeout', 'offline', 'response'))
        with response:
            self.send_response(response.status)
            self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
            self.send_header('Cache-Control', 'no-store')
            length = response.headers.get('Content-Length')
            if length and length.isdigit(): self.send_header('Content-Length', length)
            encoding = response.headers.get('Content-Encoding')
            if encoding: self.send_header('Content-Encoding', encoding)
            self.end_headers()
            while True:
                chunk = response.read1(16384)
                if not chunk: break
                self.wfile.write(chunk)
                self.wfile.flush()

    def prepare_path(self):
        parsed = urlparse(self.path)
        p = parsed.path
        parts = p.split('/', 2)
        if len(parts) > 1 and parts[1] in tlumacz.JEZYKI:
            p = '/' + (parts[2] if len(parts) > 2 else '')
        if p.startswith('/aplikacja/') and p != '/aplikacja/':
            p = '/' + p[len('/aplikacja/'):]
        resource = '/komputer.html' if p == '/komputer' else '/index.html' if p in ('/aplikacja', '/aplikacja/', '/') else p
        self.path = resource + ('?' + parsed.query if parsed.query else '')
        return p
    def do_HEAD(self):
        self.prepare_path()
        return super().do_HEAD()
    def do_GET(self):
        p = self.prepare_path()
        if p == '/v1/models': return self.lmstudio_proxy('/models')
        if p in ('/api/i18n', '/api/i18n.js'):
            from urllib.parse import parse_qs
            lang = (parse_qs(urlparse(self.path).query).get('lang') or ['pl'])[0]
            rodzaj, tresc = api.i18n(p, lang)
            if rodzaj == 'json': return self.js(tresc)
            self.send_response(200); self.send_header('Content-Type', 'application/javascript; charset=utf-8'); self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Length', str(len(tresc))); self.end_headers(); self.wfile.write(tresc); return
        if p.startswith('/api/'):
            return self.odpowiedz(p)
        if p == '/v2' or p.startswith('/v2/'):
            self.send_response(301); self.send_header('Location', '/'); self.end_headers(); return
        return self.plik_statyczny()

    def plik_statyczny(self):
        if self.nie_zmieniony(): return None
        return super().do_GET()

    def nie_zmieniony(self):
        sciezka = self.translate_path(self.path)
        if not os.path.isfile(sciezka):
            return False
        etag = etag_pliku(sciezka)
        if not etag or self.naglowek('If-None-Match') != etag:
            self._etag = etag
            self._statyk = True
            return False
        self._etag = None
        self.send_response(304)
        self.send_header('ETag', etag)
        self.send_header('Content-Length', '0')
        self.end_headers()
        return True
    def do_POST(self):
        p = urlparse(self.path).path
        if p.startswith('/v1/'): return self.lmstudio_proxy(p[3:])
        return self.odpowiedz(p)
    def odpowiedz(self, p):
        start, dostawca = time.time(), agent.PROVIDER
        try:
            wynik = api_mod.get(p, self.naglowki(), log) if self.command == 'GET' else api_mod.post(p, self.body(), self.naglowki(), log)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except api.ApiError as error:
            log(dict(t='req', rid=self.identyfikator(), path=p, op=agent.PROVIDER, provider=dostawca, status=error.code, ms=api_mod._czas(start)))
            return self.blad(str(error), error.code, error.kod, retryable=error.retryable, retry_after=error.retry_after, **error.pola)
        except urllib.error.HTTPError as e:
            log(dict(t='req', rid=self.identyfikator(), path=p, op=agent.PROVIDER, provider=dostawca, status=502, ms=api_mod._czas(start), code=e.code))
            return self.blad('Dostawca modelu zwrócił błąd.', 502, 'dostawca', retryable=True)
        except Exception as e:
            log(dict(t='err', rid=self.identyfikator(), path=p, op=agent.PROVIDER, provider=dostawca, status=500, ms=api_mod._czas(start), kind=type(e).__name__))
            return self.blad('Wewnętrzny błąd serwera.', 500, 'wewnetrzny')
        if isinstance(wynik, tuple) and wynik[0] == 'audio':
            self.send_response(200); self.send_header('Content-Type', 'audio/mpeg'); self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(wynik[1]))); self.end_headers(); self.wfile.write(wynik[1]); return
        return self.js(wynik)


class _Wy:
    """Strumień wyjściowy zamiast gniazda: zapamiętuje treść odpowiedzi i nagłówki."""
    def __init__(self, czesci): self.czesci, self.naglowki = czesci, []
    def write(self, b): self.czesci.append(bytes(b))
    def flush(self): pass

# Żądanie WSGI podane w kształcie, jakiego oczekuje H (strumienie, metoda, ścieżka, nagłówki).
# Dołączenie H: ten sam kod obsługuje gniazdo (Docker) i funkcję (Vercel), bez drugiej implementacji API.
class _Cien(H):
    def __init__(self, rfile, wfile, environ):
        self.rfile, self.wfile = rfile, wfile
        self.directory = ROOT   # pliki statyczne z mockup/, jak w H
        self.close_connection = True
        self.command = environ.get('REQUEST_METHOD', 'GET')
        droga = environ.get('RAW_URI') or environ.get('PATH_INFO') or '/'
        zapytanie = environ.get('QUERY_STRING') or ''
        self.path = droga + ('?' + zapytanie if zapytanie else '')
        self.request_version = environ.get('SERVER_PROTOCOL', 'HTTP/1.1')
        self.headers = {k[5:].replace('_', '-').title(): v for k, v in environ.items() if k.startswith('HTTP_')}
        if environ.get('CONTENT_TYPE'): self.headers['Content-Type'] = environ['CONTENT_TYPE']
        if environ.get('CONTENT_LENGTH'): self.headers['Content-Length'] = environ['CONTENT_LENGTH']
        self.status = '200 OK'

def _wsgi(h):
    """H (serwer HTTP na gniazdach) -> aplikacja WSGI: na Vercelu działa ten sam kod."""
    import io

    def aplikacja(environ, start_response):
        czesci = []
        zrzut = environ['wsgi.input'].read()
        cien = _Cien(io.BytesIO(b''), _Wy(czesci), environ)
        # parse_request oczekuje linii żądania na strumieniu: składamy ją z danych WSGI, treść już jest w cien.rfile.
        cien.rfile = io.BytesIO(('%s %s HTTP/1.0\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n' % (cien.command, cien.path, len(zrzut))).encode() + zrzut)
        zachowane = cien.headers
        H.handle_one_request(cien)   # parse_request + do_GET/do_POST, jak na gnieździe
        cien.headers = dict(zachowane)   # parse_request podmienia nagłówki na te z linii żądania; w WSGI prawdą jest environ
        H.odtworz_naglowki(cien, cien.wfile.naglowki)
        start_response(cien.status, cien.wfile.naglowki)
        return czesci
    return aplikacja

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or 8790)
    try:
        import wiedza; threading.Thread(target=wiedza._wczytaj, daemon=True).start()   # baza kart gov.pl wczytuje się w tle (kilka sekund)
    except Exception as e: print('wiedza:', e)
    srv = Serwer((HOST, port), H)
    print('mObywatel: http://%s:%d  (pliki: %s)' % ('127.0.0.1' if HOST in ('0.0.0.0', '::') else HOST, port, ROOT), flush=True)
    srv.serve_forever()

# Vercel (api/index.py) importuje ten plik i podaje `app` do WSGI. Serwer HTTP i Docker działają jak dotąd.
app = _wsgi(H)
