# -*- coding: utf-8 -*-
"""Konfiguracja modelu. Jedyny dostawca: Cloudflare Workers AI.

API zgodne z OpenAI Chat Completions:
`https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/v1/chat/completions`.
Token (`CLOUDFLARE_API_TOKEN`) czyta wyłącznie serwer i wysyła go w nagłówku `Authorization: Bearer`;
nigdy nie trafia do przeglądarki. Dozwolone są tylko modele z katalogu `serwer/katalog.py`, czyli darmowe
modele otwarte z wywoływaniem narzędzi, mieszczące się w dziennym limicie planu Free (10 000 neuronów).
`MODEL=auto` wybiera najszybszy z nich, który Cloudflare widzi na koncie.

Podgląd konfiguracji: python3 serwer/model.py. Katalog: python3 serwer/katalog.py.
"""
import json, os, re, sys, threading, time, urllib.error, urllib.parse, urllib.request

import katalog

API = 'https://api.cloudflare.com/client/v4'
DOMYSLNY = '@cf/ibm-granite/granite-4.0-h-micro'


def _env(klucz, domyslna=''):
    wartosc = os.environ.get(klucz)
    return wartosc if wartosc not in (None, '') else domyslna


def _liczba(klucz, domyslna, typ):
    try:
        return typ(_env(klucz, domyslna))
    except (TypeError, ValueError):
        return typ(domyslna)


CLOUDFLARE_ACCOUNT_ID = _env('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = _env('CLOUDFLARE_API_TOKEN') or _env('CF_API_TOKEN') or _env('MODEL_API_KEY')
KLUCZ_USTAWIONY = bool(CLOUDFLARE_API_TOKEN)
KONTO_USTAWIONE = bool(CLOUDFLARE_ACCOUNT_ID)
KONTO_POPRAWNE = bool(re.fullmatch(r'[0-9a-f]{32}', CLOUDFLARE_ACCOUNT_ID.strip().lower()))
BAZA_WLASNA = bool(_env('CLOUDFLARE_AI_BASE'))
KONTO_SPRAWDZONE = KONTO_POPRAWNE or BAZA_WLASNA or not KONTO_USTAWIONE
GLOBALNY_KLUCZ = bool(re.fullmatch(r'[0-9a-f]{37}', CLOUDFLARE_API_TOKEN.strip().lower()))

MODEL = _env('MODEL', 'auto')
AUTO = MODEL.strip().lower() in ('auto', 'najszybszy', '')
PREFERUJ = _env('MODEL_PREFERUJ', 'auto').strip().lower()
MODELE_DOWOLNE = _env('MODELE_DOWOLNE', '0').strip().lower() not in ('0', 'false', 'nie', 'no')

NUM_CTX = _liczba('MODEL_NUM_CTX', 32768, int)
MAX_TOKENS = _liczba('MODEL_MAX_TOKENS', 1200, int)
TIMEOUT = _liczba('MODEL_TIMEOUT', 180, int)
TEMPERATURE = _liczba('MODEL_TEMPERATURE', 0.1, float)
TOP_P = _liczba('MODEL_TOP_P', 0.95, float)
SEED = _liczba('MODEL_SEED', -1, int)

OPCJE = dict(temperature=TEMPERATURE, top_p=TOP_P, max_tokens=MAX_TOKENS)
if SEED >= 0:
    OPCJE['seed'] = SEED

_lock = threading.Lock()
_wybrany = {'nazwa': '', 'komunikat': ''}
_blad_konta = ''
_lista = {'t': 0.0, 'nazwy': None}
CACHE_LISTY = 60


def baza_api():
    """Prefiks `/accounts/{id}`. `CLOUDFLARE_AI_BASE` wskazuje na `.../ai/v1`, więc obcinamy ogon."""
    baza = _env('CLOUDFLARE_AI_BASE').rstrip('/')
    if not baza:
        return '%s/accounts/%s' % (API, CLOUDFLARE_ACCOUNT_ID)
    return baza[:-len('/ai/v1')] if baza.endswith('/ai/v1') else API


def adres():
    """Adres Chat Completions dla tego konta."""
    baza = _env('CLOUDFLARE_AI_BASE').rstrip('/')
    if baza:
        return baza
    return '%s/accounts/%s/ai/v1' % (API, CLOUDFLARE_ACCOUNT_ID)


def klucz_maska():
    if not KLUCZ_USTAWIONY:
        return ''
    return CLOUDFLARE_API_TOKEN[:4] + '…' + CLOUDFLARE_API_TOKEN[-2:] if len(CLOUDFLARE_API_TOKEN) > 8 else 'ustawiony'


def rodzaj_klucza():
    """`ok`, `brak`, `globalny` (Global API Key nie działa jako Bearer) albo `krotki`."""
    if not KLUCZ_USTAWIONY:
        return 'brak'
    if GLOBALNY_KLUCZ:
        return 'globalny'
    return 'ok' if len(CLOUDFLARE_API_TOKEN.strip()) >= 30 else 'krotki'


def klasa_klucza():
    return 'ustawiony (%s)' % klucz_maska() if KLUCZ_USTAWIONY else 'brak'


def naglowki(typ_json=True):
    """Nagłówki żądania. Token idzie tylko z serwera do Cloudflare."""
    h = {'Content-Type': 'application/json'} if typ_json else {}
    if CLOUDFLARE_API_TOKEN:
        h['Authorization'] = 'Bearer ' + CLOUDFLARE_API_TOKEN
    return h


def czy_bielik(nazwa=None):
    return katalog.czy_bielik(nazwa or model())


def dostepne(odswiez=False):
    """Nazwy modeli, które Cloudflare widzi na koncie, albo None, gdy listy nie da się pobrać.

    Workers AI nie udostępnia `GET /v1/models`, więc pytamy API konta o listę modeli.
    """
    global _blad_konta
    if not odswiez and _lista['t'] and time.time() - _lista['t'] < CACHE_LISTY:
        return _lista['nazwy']
    if not CLOUDFLARE_ACCOUNT_ID:
        _blad_konta = 'Brak CLOUDFLARE_ACCOUNT_ID, więc nie mogę sprawdzić modeli konta.'
        _lista.update(t=time.time(), nazwy=None)
        return None
    adres_ = '%s/ai/models/search?%s' % (baza_api(), urllib.parse.urlencode({'per_page': 200}))
    try:
        req = urllib.request.Request(adres_, headers=naglowki(False))
        with urllib.request.urlopen(req, timeout=8) as r:
            odp = json.loads(r.read())
        wynik = odp.get('result') or []
        nazwy = [m.get('name') for m in wynik if isinstance(m, dict) and m.get('name')]
        if not nazwy:
            raise ValueError('pusta lista modeli')
        _blad_konta = ''
        _lista.update(t=time.time(), nazwy=nazwy)
        return nazwy
    except urllib.error.HTTPError as e:
        _blad_konta = ('Token Cloudflare został odrzucony (HTTP %s). Popraw CLOUDFLARE_API_TOKEN.'
                       % e.code if e.code in (401, 403) else
                       'Cloudflare odpowiedział błędem HTTP %s przy liście modeli.' % e.code)
    except Exception as e:
        _blad_konta = 'Nie mogę pobrać listy modeli konta Cloudflare (%s).' % e
    _lista.update(t=time.time(), nazwy=None)
    return None


def _diagnoza(lista):
    if _blad_konta:
        return _blad_konta
    if not lista:
        return 'Cloudflare nie zwrócił żadnego modelu dla tego konta.'
    return ('Konto Cloudflare nie ma żadnego modelu z katalogu (%s). Dozwolone są darmowe modele z wywoływaniem'
            ' narzędzi: %s.' % (', '.join(lista[:4]), ', '.join(m.nazwa for m in katalog.najszybsze(3))))


def model(odswiez=False):
    """Nazwa modelu do żądania. Przy `MODEL=auto` bierze najszybszy katalogowy model widoczny na koncie."""
    if not AUTO:
        return MODEL
    if _wybrany['nazwa'] and not odswiez:
        return _wybrany['nazwa']
    with _lock:
        if _wybrany['nazwa'] and not odswiez:
            return _wybrany['nazwa']
        lista = dostepne(odswiez)
        wybrany = katalog.wybierz(lista, PREFERUJ, NUM_CTX)
        _wybrany['nazwa'] = wybrany.nazwa if wybrany else ''
        _wybrany['komunikat'] = '' if wybrany else _diagnoza(lista)
        return _wybrany['nazwa']


def komunikat_modelu(nazwa=None):
    """Pusty tekst, gdy konfiguracja jest poprawna; inaczej zdanie po polsku, co poprawić."""
    if not KONTO_USTAWIONE:
        return ('Brak identyfikatora konta Cloudflare. Ustaw CLOUDFLARE_ACCOUNT_ID w pliku .env'
                ' (dash.cloudflare.com → Workers & Pages → Account ID).')
    if not KLUCZ_USTAWIONY:
        return ('Brak tokenu Cloudflare. Ustaw CLOUDFLARE_API_TOKEN w pliku .env (dash.cloudflare.com →'
                ' My Profile → API Tokens, uprawnienie „Workers AI: Read”). Token zostaje na serwerze.')
    if GLOBALNY_KLUCZ:
        return ('CLOUDFLARE_API_TOKEN wygląda na Global API Key (37 znaków). Cloudflare przyjmuje go tylko'
                ' w nagłówkach X-Auth-Email i X-Auth-Key, więc tutaj dostaniesz HTTP 401. Utwórz token'
                ' z szablonu „Workers AI” (uprawnienie Workers AI: Read) i wklej go w CLOUDFLARE_API_TOKEN.')
    nazwa = nazwa or (model() if AUTO else MODEL)
    if not nazwa:
        return _wybrany['komunikat'] or (
            'Nie wybrano modelu. Ustaw MODEL=auto albo nazwę z katalogu (python3 serwer/katalog.py).')
    if MODELE_DOWOLNE or katalog.czy_dozwolony(nazwa):
        return ''
    return ('Model %s nie jest na liście dozwolonych. Projekt korzysta wyłącznie z darmowych modeli'
            ' Cloudflare Workers AI z wywoływaniem narzędzi. Wybierz MODEL=auto albo wpisz nazwę z katalogu:'
            ' python3 serwer/katalog.py.' % nazwa)


def ostrzezenia():
    """Rzeczy podejrzane, ale nieblokujące: Cloudflare rozstrzygnie je sam i odpowie konkretnym błędem."""
    lista = []
    if KONTO_USTAWIONE and not KONTO_POPRAWNE:
        lista.append('CLOUDFLARE_ACCOUNT_ID ma %d znaków, a Account ID ma 32 znaki hex. Sprawdź, czy nie'
                     ' wkleiłeś tokenu albo czy nie zostały spacje i cudzysłowy.'
                     % len(CLOUDFLARE_ACCOUNT_ID.strip()))
    if KLUCZ_USTAWIONY and len(CLOUDFLARE_API_TOKEN.strip()) < 30:
        lista.append('CLOUDFLARE_API_TOKEN ma tylko %d znaków — pełny token Cloudflare jest dłuższy.'
                     ' Sprawdź, czy nie został obcięty przy wklejaniu.' % len(CLOUDFLARE_API_TOKEN.strip()))
    return lista


def sprawdz_model():
    """Rzuca ValueError, gdy konfiguracja nie pozwala wysłać żądania."""
    komunikat = komunikat_modelu()
    if komunikat:
        raise ValueError(komunikat)


def opis():
    """Raport konfiguracji dla człowieka i dla dziennika serwera."""
    nazwa = model()
    widoczne = dostepne()
    linie = [
        'Dostawca:    Cloudflare Workers AI (%s)' % (
            adres().replace(CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ACCOUNT_ID[:6] + '…') if CLOUDFLARE_ACCOUNT_ID else adres()),
        'Konto:       %s' % ((CLOUDFLARE_ACCOUNT_ID[:6] + '…' + CLOUDFLARE_ACCOUNT_ID[-4:]
                              + ('  (32 znaki, ok)' if KONTO_POPRAWNE else
                                 ('  (baza własna, nie sprawdzam)' if BAZA_WLASNA else '  (niepełne, ma być 32 znaki)')))
                             if CLOUDFLARE_ACCOUNT_ID else '(brak)'),
        'Model:       %s%s' % (nazwa or '(brak)', '  [auto]' if AUTO else ''),
        'Token:       %s' % klasa_klucza(),
        'Kontekst:    %d tokenów, odpowiedź do %d tokenów' % (NUM_CTX, MAX_TOKENS),
        'Próbkowanie: temperatura %.2f, top_p %.2f' % (TEMPERATURE, TOP_P),
        'Katalog:     %d modeli darmowych' % len(katalog.KATALOG),
        'Widoczny:    %s' % ('tak' if nazwa and (widoczne is None or nazwa in widoczne) else 'nie'),
    ]
    if widoczne is None:
        linie.append('Lista konta: nie udało się pobrać, wybór idzie z katalogu (%s)'
                     % (_blad_konta or 'brak połączenia'))
    else:
        linie.append('Modele konta: %s' % (', '.join(widoczne[:8]) or '(brak)'))
    ostrzezenie = komunikat_modelu()
    if ostrzezenie:
        linie.append('Uwaga:       %s' % ostrzezenie)
    for tekst in ostrzezenia():
        linie.append('Podejrzane:  %s' % tekst)
    return '\n'.join(linie)


if __name__ == '__main__':
    if '--katalog' in sys.argv:
        print(katalog.raport())
        sys.exit(0)
    print(opis())
