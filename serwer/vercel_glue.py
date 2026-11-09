# -*- coding: utf-8 -*-
"""Adapter Vercel: wystawia logikę serwera (serwer/*.py) jako funkcje serverless.

Na Vercelu pliki api/*.py to funkcje serverless (klasa handler(BaseHTTPRequestHandler)).
Ten moduł importuje istniejącą logikę agenta/modelu/katalogu/tłumacza/znaku i udostępnia ją
jako funkcje zwracające (obj, kod), gotowe do odesłania przez handler.

Bez zewnętrznych zależności — tylko biblioteka standardowa (jak reszta serwera).

Uwaga: znak mObywatela trzyma stan w pamięci (ZN). Na Vercelu funkcje serverless są bezstanowe
między wywołaniami, więc przekazywanie danych między dwoma urządzeniami działa tylko wtedy,
gdy to samo ciepłe wystąpienie obsłuży oba. Rdzeń aplikacji — rozmowa z agentem — jest bezstanowy
(historię trzyma przeglądarka), więc działa w pełni."""
import os, sys, json, time, threading

HERE = os.path.dirname(os.path.abspath(__file__))      # katalog serwer/
ROOT_DIR = os.path.dirname(HERE)                        # katalog projektu (root repozytorium)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Wczytanie .env lokalnie; na Vercelu zmienne przychodzą z panelu do os.environ,
# a .env nie jest deployowany (jest w .gitignore), więc szukaj() zwróci ('', []).
import ustawienia
ENV_PLIK, ENV_KLUCZE = ustawienia.szukaj([ROOT_DIR, os.getcwd()])
import agent, katalog, model, tlumacz

from http.server import BaseHTTPRequestHandler

_LOG_LOCK = threading.Lock()


def log(x):
    """Dziennik do /tmp (na Vercelu system plików jest tylko do odczytu poza /tmp)."""
    x = dict(x, ts=time.strftime('%Y-%m-%d %H:%M:%S'))
    try:
        with _LOG_LOCK:
            with open('/tmp/agent.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps(x, ensure_ascii=False) + '\n')
    except OSError:
        pass


class Handler(BaseHTTPRequestHandler):
    """Baza dla funkcji api/*.py: wycisza logi serwera HTTP."""
    def log_message(self, *a):
        pass


def _send(h, obj, code=200):
    b = json.dumps(obj, ensure_ascii=False).encode()
    h.send_response(code)
    h.send_header('Content-Type', 'application/json; charset=utf-8')
    h.send_header('Content-Length', str(len(b)))
    h.send_header('Cache-Control', 'no-store')
    h.end_headers()
    h.wfile.write(b)


def respond(h, fn):
    """fn() -> (obj, kod). BladAPI -> 503, inne błędy -> 500 (jak w serwer/server.py)."""
    try:
        obj, code = fn()
        _send(h, obj, code)
    except agent.BladAPI as e:
        log(dict(t='model_err', msg=str(e)))
        _send(h, dict(error=str(e)), 503)
    except (BrokenPipeError, ConnectionResetError):
        pass
    except Exception as e:
        import traceback
        log(dict(t='err', msg=str(e), tb=traceback.format_exc()[-800:]))
        _send(h, dict(error='Błąd serwera: %s' % e), 500)


def read_body(h):
    n = int(h.headers.get('Content-Length') or 0)
    return h.rfile.read(n) if n else b''


def read_json(h):
    return json.loads(read_body(h) or b'{}')


# ---------------------------------------------------------------------------
# endpointy — zwracają (obj, kod)
# ---------------------------------------------------------------------------

def _dostawca():
    """Nazwa dostawcy modelu (agent trzyma ją w PROVIDER; starsze wersje w DOSTAWCA)."""
    return getattr(agent, 'PROVIDER', None) or getattr(agent, 'DOSTAWCA', 'openai')


def _stan_modelu():
    """Stan modelu dla /api/health i /api/modele.

    Na Vercelu nie ma ciepłego serwera, który by go utrzymywał, więc wszystko liczymy
    z konfiguracji (serwer/model.py) zamiast odpytywać model o listę dostępnych.
    """
    if hasattr(agent, 'stan_modelu'):
        return agent.stan_modelu()
    nazwa = model.model()
    return dict(ok=bool(model.KLUCZ_USTAWIONY and model.KONTO_SPRAWDZONE), model=nazwa,
                klucz=bool(model.KLUCZ_USTAWIONY), konto=bool(model.KONTO_USTAWIONE),
                bielik=bool(model.czy_bielik(nazwa)), dostepne=None, komunikat='')


def zdrowie():
    stan = _stan_modelu()
    return dict(
        agent=bool(stan['ok']),
        provider=_dostawca(),
        model=stan.get('model') or model.model(),
        modelGotowy=bool(stan['ok']),
        bielik=bool(stan.get('bielik', model.czy_bielik())),
        klucz=bool(stan.get('klucz')),
        konto=bool(stan.get('konto')),
        kontoOk=bool(model.KONTO_SPRAWDZONE),
        kluczRodzaj=model.rodzaj_klucza(),
        ostrzezenia=model.ostrzezenia(),
        config=ustawienia.zrodlo(ENV_PLIK, ENV_KLUCZE),
        glos=dict(stt='przegladarka', tts='przegladarka'),
        stt=True, tts=True,
        komunikat=stan.get('komunikat') or '',
    ), 200


def katalog_modeli():
    stan = _stan_modelu()
    nazwa = stan.get('model') or model.model()
    widoczne = stan.get('dostepne')
    pozycje = []
    for m in katalog.uporzadkuj(model.PREFERUJ):
        d = m.jako_dict()
        d['dostepny'] = widoczne is None or m.nazwa in widoczne
        d['wybrany'] = m.nazwa == nazwa
        pozycje.append(d)
    return dict(
        katalog=pozycje,
        dostawca=_dostawca(),
        adres=model.adres(),
        konto=model.KONTO_USTAWIONE,
        kontoOk=model.KONTO_SPRAWDZONE,
        config=ustawienia.zrodlo(ENV_PLIK, ENV_KLUCZE),
        klucz=bool(model.KLUCZ_USTAWIONY),
        model=nazwa,
        bielik=bool(stan.get('bielik')),
        auto=model.AUTO,
        preferuj=model.PREFERUJ,
        okno=model.NUM_CTX,
        lista_znana=widoczne is not None,
        dostepne=widoczne or [],
        komunikat=stan.get('komunikat') or '',
    ), 200


def i18n_slownik(lang):
    d = tlumacz.slownik(lang) if lang in tlumacz.JEZYKI and lang != 'pl' else {}
    return dict(lang=lang, t=d), 200


def i18n_brak(h):
    raw = read_body(h)
    if len(raw) > 60000:
        return dict(error='za duzo'), 413
    req = json.loads(raw or b'{}')
    lang = req.get('lang')
    if lang not in tlumacz.JEZYKI or lang == 'pl':
        return dict(t={}), 200
    teksty = [str(x)[:700] for x in (req.get('teksty') or [])][:150]
    d = tlumacz.przetlumacz(lang, teksty)
    log(dict(t='i18n', lang=lang, n=len(teksty), brak=len(teksty) - len(d)))
    return dict(t=d), 200


def agent_run(h):
    req = read_json(h)
    t0 = time.time()
    user = req.get('messages', [])[-1] if req.get('messages') else None
    log(dict(t='req', osoba=req.get('osoba'), conv=req.get('conv'),
             user=user.get('content') if user and isinstance(user.get('content'), str) else None,
             confirm=req.get('confirm')))
    msgs, stan, events, czeka = agent.run(req.get('messages', []), req.get('stan'), req.get('confirm'),
                                          lambda x: log(dict(x, conv=req.get('conv'))),
                                          osoba=req.get('osoba'), jezyk=req.get('lang') or 'pl')
    log(dict(t='resp', conv=req.get('conv'), ms=int((time.time() - t0) * 1000),
             events=[e.get('t') for e in events], czeka=czeka))
    return dict(messages=msgs, stan=stan, events=events, czeka=czeka), 200


# --- znak mObywatela -------------------------------------------------------
ZN = {'devs': {}, 'skrz': {}, 'skan': {}}
ZN_TTL = 120
ZN_SWIEZY = 15
_zlock = threading.Lock()


def zn_clean():
    t = time.time()
    for d in [d for d, v in ZN['devs'].items() if t - v['t'] > ZN_TTL]:
        ZN['devs'].pop(d, None)
        ZN['skrz'].pop(d, None)
        ZN['skan'].pop(d, None)


def zn_kto(tok, dev):
    now = time.time()
    for d, v in ZN['devs'].items():
        if d == dev or now - v['t'] > ZN_SWIEZY:
            continue
        if v['token'] == tok or (v.get('prev') == tok and now - v['tt'] < 60):
            return d, v
    return None, None


def znak_kto(tok, dev):
    with _zlock:
        d, v = zn_kto(tok, dev)
        if d:
            ZN['skan'][d] = time.time()
    log(dict(t='znak_kto', ok=bool(d), kind=v and v['kind'], cel=v and v.get('cel')))
    if not d:
        return dict(dev=None), 200
    return dict(dev=d, kind=v['kind'], kto=v.get('kto'), cel=v.get('cel'), zakres=v.get('zakres')), 200


def znak_beat(h):
    req = read_json(h)
    dev = str(req.get('dev', ''))[:40]
    try:
        tok = int(req.get('token')) & 0xffff
    except (TypeError, ValueError):
        return dict(error='zly zeton'), 400
    with _zlock:
        zn_clean()
        now = time.time()
        v = ZN['devs'].get(dev)
        zajety = any(d != dev and now - w['t'] < ZN_SWIEZY and tok in (w['token'], w.get('prev'))
                     for d, w in ZN['devs'].items())
        if v is None:
            v = ZN['devs'][dev] = dict(token=tok, prev=None, tt=now)
        elif v['token'] != tok:
            v['prev'], v['token'], v['tt'] = v['token'], tok, now
        v.update(t=now, kind='web' if req.get('kind') == 'web' else 'telefon',
                 kto=str(req.get('kto') or '')[:80], cel=req.get('cel'), zakres=req.get('zakres'))
        otrz = ZN['skrz'].pop(dev, [])
        skanuje = now - ZN['skan'].get(dev, 0) < 45
        if otrz:
            ZN['skan'].pop(dev, None)
    return dict(otrzymane=otrz, skanuje=skanuje and not otrz, zmien=zajety), 200


def znak_przekaz(h):
    raw = read_body(h)
    if len(raw) > 20000:
        return dict(error='za duzo danych'), 413
    req = json.loads(raw or b'{}')
    to = req.get('to')
    with _zlock:
        if to not in ZN['devs']:
            return dict(ok=False, error='odbiorca niedostepny'), 404
        ZN['skrz'].setdefault(to, []).append(dict(ok=bool(req.get('ok')),
                                                   dane=req.get('dane') if req.get('ok') else None, t=time.time()))
        kind = ZN['devs'][to]['kind']
    log(dict(t='znak_przekaz', ok=bool(req.get('ok')), kind=kind))
    return dict(ok=True), 200
