# -*- coding: utf-8 -*-
"""Rozpoznawanie i synteza mowy: ElevenLabs, a gdy go nie ma — OpenAI."""
import json
import os
import time
import urllib.error
import urllib.request
import uuid

import tlumacz
from ustawienia import k, log, zablokowane
import ustawienia as ustawienia_mod

STT_MODEL = os.environ.get('STT_MODEL', 'gpt-4o-mini-transcribe')
TTS_MODEL = os.environ.get('TTS_MODEL', 'gpt-4o-mini-tts')
TTS_VOICE = os.environ.get('TTS_VOICE', 'coral')
TTS_INSTR = ('Mów po polsku, z naturalną polską wymową i akcentem, bez obcego akcentu. Ton: spokojna, życzliwa urzędniczka, '
             'która konkretnie pomaga. Tempo umiarkowane, wyraźnie wymawiaj liczby, daty i numery.')
STT_PROMPT = 'Rozmowa z asystentem mObywatel. Słownictwo: mObywatel, mDowód, PESEL, KDR, Karta Dużej Rodziny, OC, CEPiK, e-Doręczenia, ZUS, 800 plus, mStłuczka, PCC, Face ID, Toyota, Warta, Skoda, Transporter, Fiat Panda, Golf, legitymacja, mandat, VAT, JPK.'

EL_VOICE = os.environ.get('EL_VOICE', 'H3IcxEgdFxIEJAqMc0Bc')   # Joanna (Voice Library, polski); wymaga doładowanego konta
EL_TTS_MODEL = os.environ.get('EL_TTS_MODEL', 'eleven_flash_v2_5')   # Flash: najtańszy i najszybszy; jakość: eleven_multilingual_v2
EL_STT_MODEL = os.environ.get('EL_STT_MODEL', 'scribe_v2')
EL_KEYTERMS = ['mObywatel', 'mDowód', 'PESEL', 'Karta Dużej Rodziny', 'CEPiK', 'e-Doręczenia', 'ZUS', '800 plus', 'mStłuczka', 'Face ID']
EL_PRZERWA = 900   # po błędzie ElevenLabs tyle sekund idziemy prosto do OpenAI
EL_STOP = {}
TTS_CACHE = {}


def el_ok(co):
    return bool(k('elevenlabs')) and time.time() > EL_STOP.get(co, 0) and (co != 'tts' or EL_VOICE)


def el_pobierz(req):
    for i in range(2):   # połączenie z ElevenLabs potrafi się zerwać przy nawiązywaniu, wtedy jedna ponowna próba
        try:
            with urllib.request.urlopen(req, timeout=ustawienia.CZAS_ROZMOWY) as r:
                return r.read()
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, ConnectionError, OSError):
            if i:
                raise


def el_blad(co, e):
    EL_STOP[co] = time.time() + EL_PRZERWA
    msg = e.read().decode('utf-8', 'replace')[:300] if isinstance(e, urllib.error.HTTPError) else str(e)
    log(dict(t='el_err', co=co, code=getattr(e, 'code', None), msg=msg))


def multipart(fields, files):
    b = uuid.uuid4().hex
    out = b''
    for n, v in fields.items():
        for v in (v if isinstance(v, list) else [v]):
            out += ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (b, n, v)).encode()
    for n, (fn, ct, data) in files.items():
        out += ('--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\nContent-Type: %s\r\n\r\n' % (b, n, fn, ct)).encode() + data + b'\r\n'
    out += ('--%s--\r\n' % b).encode()
    return out, 'multipart/form-data; boundary=' + b


def stt(data, ctype, lang='pl'):
    c = ctype.lower()
    ext = next((e for k_, e in [('webm', 'webm'), ('mp4', 'mp4'), ('m4a', 'm4a'), ('aac', 'm4a'), ('ogg', 'ogg'), ('mpeg', 'mp3'), ('mp3', 'mp3'), ('wav', 'wav')] if k_ in c), 'webm')
    kod = (tlumacz.JEZYKI.get(lang) or tlumacz.JEZYKI['pl'])[2]
    plik = {'file': ('nagranie.' + ext, ctype.split(';')[0] or 'audio/webm', data)}
    if el_ok('stt'):
        pola = {'model_id': EL_STT_MODEL, 'tag_audio_events': 'false', 'keyterms': EL_KEYTERMS}
        if kod:
            pola['language_code'] = kod
        body, ct = multipart(pola, plik)
        req = urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text', data=body, headers={'xi-api-key': k('elevenlabs'), 'Content-Type': ct})
        try:
            return json.loads(el_pobierz(req)).get('text', '').strip(), 'elevenlabs'
        except Exception as e:
            el_blad('stt', e)
    pola = {'model': STT_MODEL, 'prompt': STT_PROMPT if lang == 'pl' else 'mObywatel, mDowód, PESEL, ZUS, CEPiK, Face ID', 'response_format': 'json'}
    if kod:
        pola['language'] = kod
    body, ct = multipart(pola, plik)
    req = urllib.request.Request('https://api.openai.com/v1/audio/transcriptions', data=body, headers={'Authorization': 'Bearer ' + k('openai'), 'Content-Type': ct})
    with urllib.request.urlopen(req, timeout=ustawienia.CZAS_STT) as r:
        return json.loads(r.read()).get('text', '').strip(), 'openai'


def tts(text, lang='pl'):
    if el_ok('tts'):
        d = dict(text=text[:3500], model_id=EL_TTS_MODEL, apply_text_normalization='on')
        if 'multilingual_v2' not in EL_TTS_MODEL:
            d['language_code'] = lang
        req = urllib.request.Request('https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_64' % EL_VOICE, data=json.dumps(d).encode(),
                                     headers={'xi-api-key': k('elevenlabs'), 'Content-Type': 'application/json'})
        try:
            return el_pobierz(req), 'elevenlabs'
        except Exception as e:
            el_blad('tts', e)
    ins = TTS_INSTR if lang == 'pl' or lang not in tlumacz.JEZYKI else ('Speak %s with natural native pronunciation and accent. Tone: calm, friendly public-service clerk who helps concretely. Moderate pace; pronounce numbers, dates and codes clearly. Polish names and addresses: pronounce them the Polish way.' % tlumacz.JEZYKI[lang][0])
    body = json.dumps(dict(model=TTS_MODEL, voice=TTS_VOICE, input=text[:3500], instructions=ins, response_format='mp3')).encode()
    req = urllib.request.Request('https://api.openai.com/v1/audio/speech', data=body, headers={'Authorization': 'Bearer ' + k('openai'), 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=ustawienia.CZAS_TTS) as r:
        return r.read(), 'openai'


def _jezyk(query):
    from urllib.parse import parse_qs
    lang = (parse_qs(query).get('lang') or ['pl'])[0]
    return lang if lang in tlumacz.JEZYKI else 'pl'


def post(path, raw, headers):
    from api import ApiError
    if path == '/api/stt':
        if zablokowane():
            raise ApiError('rozpoznawanie mowy jest niedostępne', 503)
        if not (k('openai') or el_ok('stt')):
            raise ApiError('brak klucza do rozpoznawania mowy', 503)
        lang = _jezyk(headers.get('x-query') or '')
        t0 = time.time()
        txt, kto = stt(raw, headers.get('Content-Type') or 'audio/webm', lang)
        ustawienia_mod.budzet_licz()
        try:
            diag = json.loads(headers.get('X-Glos') or '{}')
        except ValueError:
            diag = None
        log(dict(t='stt', ms=int((time.time() - t0) * 1000), bytes=len(raw), text=txt, kto=kto, ctype=headers.get('Content-Type'), diag=diag))
        return {'text': txt}
    if zablokowane():
        raise ApiError('blokada', 503)
    if not (k('openai') or el_ok('tts')):
        raise ApiError('brak klucza do syntezy mowy', 503)
    req = json.loads(raw or b'{}')
    t0 = time.time()
    txt = req.get('text', '').strip()
    lang = req.get('lang') if req.get('lang') in tlumacz.JEZYKI else 'pl'
    data, kto = TTS_CACHE.get((lang, txt)), 'cache'
    if data is None:
        data, kto = tts(txt, lang)
        ustawienia_mod.budzet_licz()
        if len(TTS_CACHE) > 300:
            TTS_CACHE.clear()
        TTS_CACHE[(lang, txt)] = data
    log(dict(t='tts', ms=int((time.time() - t0) * 1000), chars=len(req.get('text', '')), bytes=len(data), kto=kto))
    return ('audio', data)
