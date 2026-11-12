# -*- coding: utf-8 -*-
"""Rate limiting i limit współbieżności: liczniki w magazynie (KV/plik), więc obowiązują między instancjami funkcji."""
import hashlib
import threading
import time

import ustawienia

# endpoint: (limit na minutę, limit na dobę)
LIMITY = {
    '/api/agent': (ustawienia._liczba('RATE_AGENT_PER_MIN', 12, najwyzej=600), ustawienia._liczba('RATE_AGENT_PER_DAY', 300, najwyzej=100000)),
    '/api/letter/explain': (ustawienia._liczba('RATE_LETTER_PER_MIN', 6, najwyzej=600), ustawienia._liczba('RATE_LETTER_PER_DAY', 100, najwyzej=100000)),
    '/api/safety/assist': (ustawienia._liczba('RATE_SAFETY_PER_MIN', 10, najwyzej=600), ustawienia._liczba('RATE_SAFETY_PER_DAY', 200, najwyzej=100000)),
    '/api/tts': (ustawienia._liczba('RATE_TTS_PER_MIN', 30, najwyzej=600), ustawienia._liczba('RATE_TTS_PER_DAY', 600, najwyzej=100000)),
    '/api/stt': (ustawienia._liczba('RATE_STT_PER_MIN', 20, najwyzej=600), ustawienia._liczba('RATE_STT_PER_DAY', 400, najwyzej=100000)),
    '/api/i18n/brak': (ustawienia._liczba('RATE_I18N_PER_MIN', 20, najwyzej=600), ustawienia._liczba('RATE_I18N_PER_DAY', 400, najwyzej=100000)),
}
LIMIT_IP = (ustawienia._liczba('RATE_IP_PER_MIN', 20, najwyzej=1200), ustawienia._liczba('RATE_IP_PER_DAY', 1000, najwyzej=1000000))
OKNO_MINUTA = 60
OKNO_DZIEN = 86400


class LimitPrzekroczony(Exception):
    def __init__(self, retry_after):
        super().__init__('Za dużo żądań. Spróbuj ponownie później.')
        self.retry_after = retry_after


def _skrot(wartosc):
    return hashlib.sha256(wartosc.encode()).hexdigest()[:24]


def _klient(headers):
    """Tożsamość klienta: identyfikator sesji z aplikacji, a bez niego adres IP z nagłówków proxy."""
    ident = headers.get('X-Session-Id') or headers.get('x-session-id')
    if isinstance(ident, str) and ident.strip():
        return 's', _skrot(ident.strip()[:200])
    for naglowek in ('X-Forwarded-For', 'x-forwarded-for', 'X-Real-IP', 'x-real-ip'):
        ip = (headers.get(naglowek) or '').split(',')[0].strip()
        if ip:
            return 'ip', _skrot(ip)
    return 'ip', 'brak'


def _sprawdz_licznik(klucz, okno, limit):
    slot = int(time.time()) // okno
    sciezka = 'limit:%s:%d' % (klucz, slot)
    licznik = (ustawienia.MAGAZYN.czytaj(sciezka) or 0) + 1
    if licznik > limit:
        raise LimitPrzekroczony(okno - int(time.time()) % okno)
    ustawienia.MAGAZYN.zapisz(sciezka, licznik, okno * 2)


def sprawdz(sciezka, headers):
    """Liczy żądanie i podnosi LimitPrzekroczony przed wykonaniem pracy: osobno dla sesji i dla IP."""
    if not ustawienia._flaga('RATE_LIMIT_ON') or sciezka not in LIMITY:
        return
    rodzaj, klient = _klient(headers)
    na_minute, na_dobe = LIMITY[sciezka]
    _sprawdz_licznik('ip:m:%s' % klient, OKNO_MINUTA, LIMIT_IP[0])
    _sprawdz_licznik('ip:d:%s' % klient, OKNO_DZIEN, LIMIT_IP[1])
    if rodzaj == 's':
        _sprawdz_licznik('%s:m:s:%s' % (sciezka, klient), OKNO_MINUTA, na_minute)
        _sprawdz_licznik('%s:d:s:%s' % (sciezka, klient), OKNO_DZIEN, na_dobe)



class _BezLimitu:
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


_BEZ_LIMITU = _BezLimitu()


class Wspolbieznosc:
    """Limit równoległych zapytań do dostawcy modelu w jednej instancji procesu."""

    def __init__(self, limit):
        self.limit = max(1, limit)
        self._biezace = 0
        self._stan = threading.Lock()

    def __enter__(self):
        with self._stan:
            if self._biezace >= self.limit:
                raise LimitPrzekroczony(5)
            self._biezace += 1
        return self

    def __exit__(self, *args):
        with self._stan:
            self._biezace -= 1
        return False


RÓWNOLEGLE = Wspolbieznosc(ustawienia._liczba('PROVIDER_CONCURRENCY', 4, najwyzej=64))


def rownolegle():
    return RÓWNOLEGLE if ustawienia._flaga('PROVIDER_CONCURRENCY_ON') else _BEZ_LIMITU
