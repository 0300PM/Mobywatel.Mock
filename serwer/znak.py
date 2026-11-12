# -*- coding: utf-8 -*-
"""Znak mObywatela: każde urządzenie pokazuje zmieniający się żeton; kto go zeskanuje, przekazuje dane jego właścicielowi."""
import json
import time
from urllib.parse import parse_qs

from api import ApiError
from ustawienia import MAGAZYN

OKNO_OBECNOSCI = 15
OKNO_SKANU = 45
TTL_URZADZENIA = 120
TTL_SKANOWANIA = 120
TTL_SKRZYNKI = 300
MAX_WIADOMOSCI = 10


def _klucz(rodzaj, wartosc):
    return 'znak:%s:%s' % (rodzaj, wartosc)


def _token(value):
    try:
        return int(value) & 0xFFFF
    except (TypeError, ValueError):
        return None


def _najblizszy(token, dev):
    """Urządzenie inne niż `dev`, które pokazało ten żeton (także poprzedni) w oknie obecności."""
    if token is None or not dev:
        return None, None
    for inny in MAGAZYN.czytaj(_klucz('skan', token)) or []:
        if inny == dev:
            continue
        wpis = MAGAZYN.czytaj(_klucz('dev', inny))
        if wpis and time.time() - wpis['t'] <= OKNO_OBECNOSCI and token in (wpis['token'], wpis.get('prev')):
            return inny, wpis
    return None, None


def kto(query, log):
    q = parse_qs(query)
    token = _token((q.get('t') or ['-1'])[0])
    dev = (q.get('dev') or [''])[0][:40]
    d, v = _najblizszy(token, dev)
    if d:
        MAGAZYN.zapisz(_klucz('skan', d), time.time(), TTL_SKANOWANIA)
    log(dict(t='znak_kto', ok=bool(d), kind=v and v['kind'], cel=v and v.get('cel')))
    if not d:
        return dict(dev=None)
    return dict(dev=d, kind=v['kind'], kto=v.get('kto'), cel=v.get('cel'), zakres=v.get('zakres'))


def _beat(req):
    dev = str(req.get('dev', ''))[:40]
    token = _token(req.get('token'))
    if token is None:
        raise ApiError('zly zeton')
    if not dev:
        raise ApiError('brak urzadzenia')
    now = time.time()
    stary = MAGAZYN.czytaj(_klucz('dev', dev)) or {}
    zmien = _najblizszy(token, dev)[0] is not None
    poprzedni = stary.get('prev') if stary.get('token') == token else stary.get('token')
    wpis = dict(token=token, prev=poprzedni, t=now, kind='web' if req.get('kind') == 'web' else 'telefon',
                kto=str(req.get('kto') or '')[:80], cel=req.get('cel'), zakres=req.get('zakres'))
    MAGAZYN.zapisz(_klucz('dev', dev), wpis, TTL_URZADZENIA)
    MAGAZYN.zapisz(_klucz('skan', token), [dev], OKNO_OBECNOSCI * 4)
    if poprzedni is not None:
        MAGAZYN.zapisz(_klucz('skan', poprzedni), [dev], TTL_URZADZENIA // 2)
    otrz = MAGAZYN.czytaj(_klucz('skrz', dev)) or []
    if otrz:
        MAGAZYN.kasuj(_klucz('skrz', dev))
        MAGAZYN.kasuj(_klucz('skan', dev))
    skanuje = now - (MAGAZYN.czytaj(_klucz('skan', dev)) or 0) < OKNO_SKANU
    return dict(otrzymane=otrz, skanuje=skanuje and not otrz, zmien=zmien)


def _przekaz(req, log):
    to = req.get('to')
    odbiorca = MAGAZYN.czytaj(_klucz('dev', to)) if to else None
    if not odbiorca:
        return dict(ok=False, error='odbiorca niedostepny')
    skrzynka = (MAGAZYN.czytaj(_klucz('skrz', to)) or [])[-(MAX_WIADOMOSCI - 1):]
    skrzynka.append(dict(ok=bool(req.get('ok')), dane=req.get('dane') if req.get('ok') else None, t=time.time()))
    MAGAZYN.zapisz(_klucz('skrz', to), skrzynka, TTL_SKRZYNKI)
    log(dict(t='znak_przekaz', ok=bool(req.get('ok')), kind=odbiorca.get('kind')))
    return dict(ok=True)


def post(path, raw, log):
    try:
        req = json.loads(raw or b'{}')
    except ValueError:
        raise ApiError('Nieprawidłowe żądanie.')
    if not isinstance(req, dict):
        raise ApiError('Nieprawidłowe żądanie.')
    if path == '/api/znak/beat':
        return _beat(req)
    if len(raw) > 20000:
        raise ApiError('za duzo danych', 413)
    return _przekaz(req, log)
