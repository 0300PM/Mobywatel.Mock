# -*- coding: utf-8 -*-
"""Wczytywanie pliku .env bez zależności zewnętrznych.

Obsługiwane warianty zapisu, które psują typowe parsery: `export KLUCZ=...`, komentarz na końcu
wiersza, cudzysłowy proste i typograficzne, znak BOM, końce linii CRLF oraz `KLUCZ: wartość`.
Wartości już ustawione w środowisku mają pierwszeństwo nad plikiem.
"""
import os
import re

_KLUCZ = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
_CUDZYSLOWY = {'„': '"', '”': '"', '“': '"', '’': "'", '‘': "'", '\ufeff': ''}
_ZNANE = ('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN', 'MODEL_API_KEY',
          'MODEL', 'MODEL_PREFERUJ', 'MODEL_NUM_CTX', 'MODELE_DOWOLNE')


def _wartosc(tekst):
    tekst = tekst.strip()
    if not tekst:
        return ''
    if tekst[0] in '"\'':
        koniec = tekst.find(tekst[0], 1)
        return tekst[1:koniec] if koniec > 0 else tekst[1:]
    for i, znak in enumerate(tekst):
        if znak == '#' and (i == 0 or tekst[i - 1] in ' \t'):
            tekst = tekst[:i]
            break
    return tekst.strip()


def _rozpoznaj(linia):
    linia = linia.strip()
    if not linia or linia.startswith('#'):
        return None, None
    if linia.lower().startswith('export '):
        linia = linia[7:].lstrip()
    if '=' in linia:
        klucz, wartosc = linia.split('=', 1)
    elif _KLUCZ.match(linia.split(':', 1)[0].strip()) and ':' in linia:
        klucz, wartosc = linia.split(':', 1)
    else:
        return None, None
    klucz = klucz.strip().strip('"\'')
    return (klucz, wartosc) if _KLUCZ.match(klucz) else (None, None)


def wczytaj(sciezka):
    """Wpisuje do środowiska pary z pliku i zwraca listę kluczy, których wcześniej nie było."""
    klucze = []
    try:
        with open(sciezka, encoding='utf-8-sig', errors='replace') as f:
            linie = f.read().splitlines()
    except OSError:
        return klucze
    for linia in linie:
        linia = linia.translate(str.maketrans(_CUDZYSLOWY))
        klucz, wartosc = _rozpoznaj(linia)
        if not klucz or os.environ.get(klucz):
            continue
        os.environ[klucz] = _wartosc(wartosc)
        klucze.append(klucz)
    return klucze


def szukaj(katalogi):
    """Przegląda katalogi po kolei i wczytuje pierwszy znaleziony `.env`."""
    for katalog in katalogi:
        if not katalog:
            continue
        sciezka = os.path.join(katalog, '.env')
        if os.path.isfile(sciezka):
            klucze = wczytaj(sciezka)
            return sciezka, [k for k in klucze if k in _ZNANE]
    return '', []


def zrodlo(sciezka, klucze):
    """Jedno zdanie do dziennika i do `/api/health`: skąd wzięła się konfiguracja."""
    if not sciezka:
        return 'brak pliku .env, konfiguracja wyłącznie ze środowiska'
    if not klucze:
        return '%s: plik istnieje, ale nie wniósł nowych kluczy (środowisko ma pierwszeństwo)' % sciezka
    return '%s: wczytane %s' % (sciezka, ', '.join(klucze))
