import hashlib
import json
import socket
import unicodedata
import urllib.error
import urllib.request
from urllib.parse import urlsplit, urlunsplit

ENDPOINTS = {
    '/models': 'GET',
    '/responses': 'POST',
    '/chat/completions': 'POST',
    '/completions': 'POST',
    '/embeddings': 'POST',
}

MESSAGES = {
    'config': 'Nieprawidłowy adres LM Studio. Ustaw adres serwera HTTP lub HTTPS w LM_STUDIO_BASE_URL.',
    'offline': 'Nie udało się połączyć z LM Studio. Uruchom serwer w zakładce Developer i sprawdź jego adres.',
    'timeout': 'LM Studio nie odpowiedziało w wyznaczonym czasie. Sprawdź serwer, model i limit czasu.',
    'auth': 'LM Studio odrzuciło dostęp. Sprawdź token skonfigurowany na serwerze aplikacji.',
    'model': 'LM Studio nie znalazło modelu lub endpointu API. Sprawdź adres, odśwież listę i wczytaj model.',
    'rejected': 'LM Studio odrzuciło żądanie. Sprawdź wybrany model i ustawienia serwera.',
    'response': 'LM Studio zwróciło nieprawidłową odpowiedź. Sprawdź wersję i ustawienia serwera.',
    'proxy': 'Przekazywanie endpointów modelu jest wyłączone. Ustaw LM_STUDIO_OPENAI_PROXY=1 i PROXY_TOKEN, żeby je włączyć.',
    'proxy_auth': 'Przekazywanie endpointów modelu wymaga nagłówka Authorization z PROXY_TOKEN.',
}

# Komunikaty dla PROVIDER=workers (Cloudflare). Nie wspominają o LM Studio, żeby nie mylić z lokalnym serwerem.
WORKER_MESSAGES = {
    'config': 'Nieprawidłowy adres workera. Ustaw CLOUDFLARE_WORKERS_URL (http lub https) w konfiguracji serwera.',
    'offline': 'Nie udało się połączyć z workerem Cloudflare. Sprawdź adres CLOUDFLARE_WORKERS_URL, czy worker jest wdrożony i czy działa internet.',
    'timeout': 'Worker Cloudflare nie odpowiedział w wyznaczonym czasie. Zwiększ CLOUDFLARE_WORKERS_TIMEOUT albo wybierz szybszy model.',
    'auth': 'Worker Cloudflare odrzucił dostęp. Sprawdź CLOUDFLARE_WORKERS_TOKEN (musi być taki sam jak sekret WORKER_TOKEN w workerze).',
    'model': 'Worker Cloudflare nie znalazło modelu lub endpointu /v1/models. Sprawdź CLOUDFLARE_WORKERS_MODEL i adres workera.',
    'rejected': 'Worker Cloudflare odrzucił żądanie. Sprawdź wybrany model i zmienne workera.',
    'response': 'Worker Cloudflare zwrócił nieprawidłową odpowiedź. Sprawdź kod workera i jego logi.',
    'proxy': 'Przekazywanie endpointów modelu jest wyłączone. Ustaw LM_STUDIO_OPENAI_PROXY=1 i PROXY_TOKEN, żeby je włączyć.',
    'proxy_auth': 'Przekazywanie endpointów modelu wymaga nagłówka Authorization z PROXY_TOKEN.',
}


def messages(provider):
    """Komunikaty błędów dopasowane do dostawcy: workers mówi o workerze, nie o LM Studio."""
    return WORKER_MESSAGES if provider == 'workers' else MESSAGES

class LMStudioError(Exception):
    def __init__(self, kind):
        self.kind = kind if kind in MESSAGES else 'response'
        super().__init__(MESSAGES[self.kind])

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

def base_url(value):
    try:
        value = value.strip()
        if any(char.isspace() or unicodedata.category(char).startswith('C') for char in value):
            raise ValueError()
        parts = urlsplit(value)
        if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username is not None or parts.password is not None or parts.query or parts.fragment:
            raise ValueError()
        if parts.port is not None and not 0 < parts.port < 65536:
            raise ValueError()
        path = parts.path.rstrip('/')
        for endpoint in ENDPOINTS:
            if path.endswith('/v1' + endpoint):
                path = path[:-len(endpoint)]
                break
        if path.endswith('/api/v1') or '/api/v1/' in path:
            raise ValueError()
        if not path.endswith('/v1'):
            path += '/v1'
        return urlunsplit((parts.scheme, parts.netloc, path, '', ''))
    except (AttributeError, TypeError, ValueError):
        raise LMStudioError('config')

def server_id(value):
    """Identyfikator serwera modelu zamiast adresu: sha256, a bez `hashlib.sha256` zgodnie z FIPS."""
    adres = base_url(value).encode()
    try:
        return hashlib.sha256(adres).hexdigest()[:16]
    except (ValueError, TypeError):
        return hashlib.new('sha256', adres).hexdigest()[:16]

def valid_model(value):
    return isinstance(value, str) and bool(value) and value == value.strip() and len(value) <= 256 and not any(unicodedata.category(char).startswith('C') for char in value)

# Cloudflare blokuje domyślny nagłówek Python-urllib (błąd 1010: Access denied), więc przedstawiamy się jak aplikacja.
USER_AGENT = 'Mobywatels/1.0 (+prototyp mObywatel; Python urllib)'


def open_request(base, endpoint, key, data=None, timeout=10):
    method = 'POST' if data is not None else 'GET'
    if ENDPOINTS.get(endpoint) != method:
        raise LMStudioError('config')
    headers = {'Accept': 'application/json', 'User-Agent': USER_AGENT}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if key and key != 'bez-klucza':
        headers['Authorization'] = 'Bearer ' + key
    request = urllib.request.Request(base_url(base) + endpoint, data=data, headers=headers, method=method)
    return OPENER.open(request, timeout=timeout)

def classify_error(error):
    if isinstance(error, LMStudioError):
        return error
    if isinstance(error, urllib.error.HTTPError):
        if error.code in (401, 403):
            return LMStudioError('auth')
        if error.code == 404:
            return LMStudioError('model')
        if 400 <= error.code < 500:
            return LMStudioError('rejected')
        return LMStudioError('offline')
    if isinstance(error, (TimeoutError, socket.timeout)) or isinstance(error, urllib.error.URLError) and isinstance(error.reason, (TimeoutError, socket.timeout)):
        return LMStudioError('timeout')
    if isinstance(error, (OSError, urllib.error.URLError)):
        return LMStudioError('offline')
    return LMStudioError('response')

def list_models(base, key):
    try:
        with open_request(base, '/models', key, timeout=10) as response:
            raw = response.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024:
            raise LMStudioError('response')
        payload = json.loads(raw)
        data = payload.get('data') if isinstance(payload, dict) else None
        if not isinstance(data, list):
            raise LMStudioError('response')
        result, seen = [], set()
        for item in data:
            model = item.get('id') if isinstance(item, dict) else None
            if valid_model(model) and model not in seen:
                result.append(model)
                seen.add(model)
            if len(result) >= 256:
                break
        return result
    except LMStudioError:
        raise
    except Exception as error:
        raise classify_error(error) from error
