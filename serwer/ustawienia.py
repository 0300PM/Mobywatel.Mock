# -*- coding: utf-8 -*-
"""Wspólna warstwa serwera: ścieżki, klucze dostawców, dziennik, limity czasu i trwały stan."""
import base64
import json
import re
import os
import secrets
import threading
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('MOCKUP') or os.path.join(os.path.dirname(HERE), 'mockup')
LOG = os.environ.get('AGENT_LOG') or os.path.join(HERE, 'agent.log')
BLOKADA = os.path.join(HERE, 'BLOKADA')
WOLNO_PISAC = os.environ.get('MOB_TYLKO_ODCZYT', '').lower() not in ('1', 'true', 'yes')
HOST = os.environ.get('HOST') or '127.0.0.1'
ODDAJ = 'Oddaj klucz'

_lock = threading.Lock()
KEYS = {}


def _liczba(nazwa, domyslna, najmniej=1, najwyzej=600):
    try:
        return max(najmniej, min(int(os.environ.get(nazwa) or domyslna), najwyzej))
    except ValueError:
        return domyslna


def _flaga(nazwa):
    return os.environ.get(nazwa, '') in ('1', 'true', 'yes')


def proxy_wlaczone():
    return _flaga('LM_STUDIO_OPENAI_PROXY')


def proxy_token():
    token = (os.environ.get('PROXY_TOKEN') or os.environ.get('LM_STUDIO_API_KEY') or '').strip()
    return token if token and token != 'bez-klucza' else ''


# Vercel: funkcja żyje najwyżej maxDuration sekund (vercel.json), więc każdy timeout dostawcy musi być krótszy.
LIMIT_PLATFORMY = _liczba('PLATFORM_TIMEOUT', 120)
ZAPAS_PLATFORMY = 10
LIMIT_ZADANIA = max(5, LIMIT_PLATFORMY - ZAPAS_PLATFORMY)
CZAS_ROZMOWY = _liczba('CHAT_TIMEOUT', 60, najwyzej=LIMIT_ZADANIA)
CZAS_STT = _liczba('STT_TIMEOUT', 45, najwyzej=LIMIT_ZADANIA)
CZAS_TTS = _liczba('TTS_TIMEOUT', 45, najwyzej=LIMIT_ZADANIA)
CZAS_TLUMACZENIA = _liczba('TRANSLATE_TIMEOUT', 30, najwyzej=LIMIT_ZADANIA)
CZAS_DOSTAWCY_MOWY = _liczba('SPEECH_PROVIDER_TIMEOUT', 25, najwyzej=LIMIT_ZADANIA)

# Trwały stan (żetony znaku): Vercel KV przez REST, lokalnie plik JSON. Brak konfiguracji oznacza pamięć procesu.
STAN_PLIK = os.environ.get('STATE_FILE') or os.path.join(HERE, 'stan.json')
KV_URL = (os.environ.get('KV_REST_API_URL') or os.environ.get('UPSTASH_REDIS_REST_URL') or '').rstrip('/')
KV_TOKEN = os.environ.get('KV_REST_API_TOKEN') or os.environ.get('UPSTASH_REDIS_REST_TOKEN') or ''

# Budżet AI na dobę: po jego wyczerpaniu endpointy modelu odpowiadają 503, zanim powstanie koszt u dostawcy.
BUDZET_DOBOWY = _liczba('AI_DAILY_BUDGET', 0, najmniej=0, najwyzej=1000000)


def zablokowane():
    return os.path.exists(BLOKADA)


def k(name):
    import agent
    if name == 'workers':
        return 'env' if not zablokowane() and agent.workers_ready() else None
    if name == 'lmstudio':
        if zablokowane():
            return None
        return os.environ.get('LM_STUDIO_API_KEY') or 'bez-klucza'
    if name == 'zgodny':
        if zablokowane() or not agent.ZGODNY_MODEL:
            return None
        if agent.ZGODNY_BAZA == agent.OPENAI_BAZA_DOMYSLNA:
            return os.environ.get('MODEL_API_KEY') or k('openai')
        return os.environ.get('MODEL_API_KEY') or 'bez-klucza'
    if zablokowane():
        KEYS.clear()
        return None
    if name not in KEYS or (not KEYS[name] and time.time() - KEYS.get(name + '@t', 0) > 60):
        KEYS[name + '@t'] = time.time()
        KEYS[name] = agent.klucz({'anthropic': 'anthropic_api_key', 'openai': 'openai_api_key', 'elevenlabs': 'elevenlabs_api_key'}[name],
                                 {'anthropic': 'ANTHROPIC_API_KEY', 'openai': 'OPENAI_API_KEY', 'elevenlabs': 'ELEVENLABS_API_KEY'}[name])
    return KEYS[name]


WRAZLIWE = ('przed', 'po', 'input', 'wynik', 'content', 'text', 'tresc', 'msg', 'dane', 'pytanie', 'odpowiedz')
PESEL = re.compile(r'\b\d{11}\b')
TOKENY = re.compile(r'\b(sk-[A-Za-z0-9_-]{8,}|Bearer\s+\S+|cfut_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{10,})\b')


def _bezpieczne(klucz, wartosc):
    if klucz in WRAZLIWE:
        return '[redacted]' if wartosc not in (None, '') else wartosc
    if isinstance(wartosc, str):
        return TOKENY.sub('[redacted]', PESEL.sub('[redacted]', wartosc))[:300]
    if isinstance(wartosc, dict):
        return {k: _bezpieczne(k, v) for k, v in wartosc.items()}
    if isinstance(wartosc, list):
        return [_bezpieczne(klucz, v) for v in wartosc[:20]]
    return wartosc


def log(x):
    if not WOLNO_PISAC:
        return
    x = dict({k: _bezpieczne(k, v) for k, v in x.items()}, ts=time.strftime('%Y-%m-%d %H:%M:%S'))
    with _lock:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(json.dumps(x, ensure_ascii=False) + '\n')


class BudzetWyczerpany(Exception):
    pass


def _dzien():
    return time.strftime('%Y-%m-%d')


def budzet_zuzyty():
    return MAGAZYN.czytaj('budzet:%s' % _dzien()) or 0


def budzet_sprawdz():
    if BUDZET_DOBOWY and budzet_zuzyty() >= BUDZET_DOBOWY:
        raise BudzetWyczerpany('Dzienny limit użycia asystenta został wyczerpany. Spróbuj jutro.')


def budzet_licz(n=1):
    """Zapisuje n wywołań modelu w bieżącej dobie; tylko gdy budżet jest włączony."""
    if not BUDZET_DOBOWY:
        return
    sciezka = 'budzet:%s' % _dzien()
    MAGAZYN.zapisz(sciezka, (MAGAZYN.czytaj(sciezka) or 0) + n, 2 * 86400)


class Magazyn:
    """Stan współdzielony między instancjami funkcji: Vercel KV, lokalnie plik, w ostateczności pamięć procesu."""

    def __init__(self):
        self._pamiec = {}
        self._lock = threading.Lock()

    @property
    def trwaly(self):
        return bool(KV_URL and KV_TOKEN) or (WOLNO_PISAC and bool(STAN_PLIK))

    def _kv(self, komendy):
        body = json.dumps(komendy if len(komendy) == 1 else [_SKRYPT, komendy]).encode()
        req = urllib.request.Request(KV_URL, data=body, headers={'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read()).get('result')

    def _plik(self, sciezka, wartosc=None):
        with self._lock:
            try:
                with open(STAN_PLIK, encoding='utf-8') as f:
                    dane = json.load(f)
            except (OSError, ValueError):
                dane = {}
            if wartosc is None:
                return dane.get(sciezka)
            if wartosc is _USUN:
                dane.pop(sciezka, None)
            else:
                dane[sciezka] = wartosc
            tmp = STAN_PLIK + '.tmp'
            try:
                with open(tmp, 'w', encoding='utf-8') as f:
                    json.dump(dane, f, ensure_ascii=False)
                os.replace(tmp, STAN_PLIK)
            except OSError:
                pass
            return wartosc

    def zapisz(self, sciezka, wartosc, ttl):
        try:
            if KV_URL and KV_TOKEN:
                self._kv([['SET', sciezka, json.dumps(wartosc, ensure_ascii=False), 'EX', str(int(ttl))]])
            elif WOLNO_PISAC:
                self._plik(sciezka, wartosc)
        except (urllib.error.URLError, OSError, ValueError):
            pass
        with self._lock:
            self._pamiec[sciezka] = (wartosc, time.time() + ttl)

    def czytaj(self, sciezka):
        try:
            if KV_URL and KV_TOKEN:
                surowe = self._kv([['GET', sciezka]])
                return json.loads(surowe) if surowe else None
            if WOLNO_PISAC:
                return self._plik(sciezka)
        except (urllib.error.URLError, OSError, ValueError):
            pass
        with self._lock:
            wpis = self._pamiec.get(sciezka)
            if not wpis:
                return None
            if wpis[1] < time.time():
                self._pamiec.pop(sciezka, None)
                return None
            return wpis[0]

    def kasuj(self, sciezka):
        try:
            if KV_URL and KV_TOKEN:
                self._kv([['DEL', sciezka]])
            elif WOLNO_PISAC:
                self._plik(sciezka, _USUN)
        except (urllib.error.URLError, OSError, ValueError):
            pass
        with self._lock:
            self._pamiec.pop(sciezka, None)

    def klucz(self, prefiks):
        return '%s%s' % (prefiks, base64.urlsafe_b64encode(secrets.token_bytes(12)).decode().rstrip('='))


_USUN = object()
_SKRYPT = ("local t=redis.call('TIME') local n=t[1]*1000+math.floor(t[2]/1000) "
           "for i=1,#ARGV,4 do local c=ARGV[i] local k=ARGV[i+1] "
           "if c=='z' then redis.call('ZADD',k,n,ARGV[i+2]) "
           "elseif c=='s' then redis.call('SET',k,ARGV[i+2],'EX',ARGV[i+3]) "
           "elseif c=='x' then redis.call('ZREMRANGEBYSCORE',k,'-inf',n-ARGV[i+3]) "
           "elseif c=='d' then redis.call('DEL',k) end end return n")

MAGAZYN = Magazyn()
