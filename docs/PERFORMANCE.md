# Wydajność — pomiary i cele

Dokument zawiera **zmierzone** wartości z lokalnego środowiska (nie z wdrożenia na Vercelu) oraz jawne
oznaczenie tego, czego nie udało się zmierzyć. Nie podajemy wyniku Lighthouse ani LCP/INP/CLS bez pomiaru
w przeglądarce — te pozycje wymagają uruchomienia Playwright/Lighthouse na środowisku docelowym.

## Środowisko pomiaru

| Element | Wartość |
|---|---|
| Maszyna | lokalna, Windows, Python 3.14 |
| Serwer | `serwer/server.py` (biblioteka standardowa, `ThreadingHTTPServer`) |
| Dane AI | lokalny atrapa dostawcy (HTTP), sztuczne opóźnienie 300 ms |
| Data pomiaru | 2026-02 (pomiary wykonane skryptami z sekcji „Jak powtórzyć”) |
| Sieć | loopback, bez CDN i bez limitu pasma |

Wartości na Vercelu będą inne: zimny start funkcji, region, sieć i limity platformy (`maxDuration` 120 s).

## 1. Rozmiar zasobów startowych

Zmierzono sumę plików JS/CSS ładowanych przez `mockup/index.html`, surowo i po gzip.

| Zasób | Surowo | Gzip |
|---|---:|---:|
| `style.css` | 78 034 B | 16 152 B |
| `core.js` | 34 352 B | 12 276 B |
| `safety.js` | 31 828 B | 9 498 B |
| `scenarios.js` | 24 997 B | 9 155 B |
| `places.js` | 22 995 B | 8 048 B |
| `accessibility.js` | 21 350 B | 6 555 B |
| `sylwetki.js` | 18 092 B | 6 778 B |
| `znak.js` | 17 471 B | 7 083 B |
| `osoby.js` | 15 658 B | 4 735 B |
| `modules.js` | 14 745 B | 5 035 B |
| `variants.js` | 10 826 B | 3 643 B |
| `safety.css` | 8 872 B | 2 290 B |
| `agent.js` | 7 578 B | 2 898 B |
| `preferences.js` | 6 525 B | 2 396 B |
| `i18n.js` | 5 228 B | 2 359 B |
| `znak-kod.js` | 4 815 B | 2 581 B |
| `lmstudio.js` | 4 578 B | 1 735 B |
| `modules.css` | 3 975 B | 1 249 B |
| `tailwind.generated.css` | 153 B | 136 B |
| **Razem** | **332 072 B** | **104 602 B** |

`index.html` to dodatkowe 40 717 B (surowo).

**Wniosek:** cel „< 200 KB gzip dla początkowego JS” jest **spełniony z zapasem** — całość JS+CSS to
~105 KB gzip. Uwaga: `tailwind.generated.css` ma 153 B, więc klasy Tailwinda w `index.html` nie mają
odpowiednika w wygenerowanym pliku; styl pochodzi z `style.css`.

## 2. Czas odpowiedzi serwera (bez AI)

30 kolejnych żądań na endpoint, pojedyncze połączenie, loopback.

| Ścieżka | p50 | p95 | min | max |
|---|---:|---:|---:|---:|
| `/` | 1,0 ms | 16,3 ms | 0,8 ms | 32,6 ms |
| `/api/health` | 0,7 ms | 0,9 ms | 0,6 ms | 12,1 ms |
| `/style.css` | 0,9 ms | 1,1 ms | 0,8 ms | 1,1 ms |
| `/core.js` | 0,9 ms | 1,1 ms | 0,8 ms | 1,1 ms |

### Nagłówki cache i warunkowe żądania

Statyki (`*.html`, `*.js`, `*.css`, `*.json`, `*.svg`) wysyłają teraz `ETag` (SHA-256 z treści, liczony raz i
odświeżany po zmianie `mtime`/rozmiaru) oraz `Cache-Control: public, max-age=300, must-revalidate`.
Ponowne żądanie z `If-None-Match` dostaje **304 bez treści**:

| Ścieżka | `Cache-Control` | `ETag` | Powtórka |
|---|---|---|---|
| `/` | `public, max-age=300, must-revalidate` | tak | 304 |
| `/core.js` | `public, max-age=300, must-revalidate` | tak | 304 |
| `/style.css` | `public, max-age=300, must-revalidate` | tak | 304 |
| `/api/health` | `no-store` | brak | zawsze pełna odpowiedź |

Odpowiedzi AI (`/api/agent`, `/api/letter/*`, `/api/safety/*`, `/api/tts`, `/api/stt`) pozostają `no-store` —
prywatne odpowiedzi nigdy nie trafiają do cache przeglądarki ani pośrednika.

**Wniosek:** statyki i `/api/health` są tanie (< 2 ms p50). Wąskie gardło to nie serwer plików.

## 3. Współbieżność statyków

N = 200 żądań na `/` na każdym poziomie (25 → N = 25).

Pomiar **przed** zmianą backlogu (`request_queue_size` = 5, domyślna wartość `socketserver`):

| Równoległość | p50 | p95 | p99 | Błędy HTTP |
|---:|---:|---:|---:|---|
| 1 | 0,9 ms | 1,2 ms | 13,7 ms | brak |
| 5 | 3,9 ms | 4,8 ms | 5,2 ms | brak |
| 10 | 5,6 ms | 7,0 ms | 511,9 ms | brak |
| 25 | 5,6 ms | 515,3 ms | 1 016,8 ms | brak |

Pomiar **po** zmianie (`serwer.Serwer`, `request_queue_size` = 128, N = 200):

| Równoległość | p50 | p95 | p99 | Błędy HTTP |
|---:|---:|---:|---:|---|
| 1 | 1,0 ms | 1,2 ms | 23,2 ms | brak |
| 5 | 3,9 ms | 5,1 ms | 5,6 ms | brak |
| 10 | 7,9 ms | 8,9 ms | 9,3 ms | brak |
| 25 | 9,7 ms | 11,6 ms | 11,7 ms | brak |

**Wniosek:** p95 przy 10 i 25 równoległych spadło z ~515 ms i ~1 016 ms do **8,9 ms i 11,6 ms** (≈50×
i ≈90×). Przyczyną był backlog gniazda, nie kolejka aplikacji. Na Vercelu ten parametr nie ma znaczenia
(WSGI), ale w Dockerze i przy uruchomieniu lokalnym tak.

`LISTEN_BACKLOG` pozwala zmienić wartość bez edycji kodu; domyślnie 128.

## 4. Czas odpowiedzi AI

Atrapa dostawcy z opóźnieniem 300 ms; `/api/agent` z jedną wiadomością, model `model/one`.

| Limity | Równoległość | p50 | p95 | p99 | Błędy HTTP |
|---|---|---:|---:|---:|---|
| wyłączone | 1 | 303,2 ms | 314,6 ms | 337,4 ms | brak |
| wyłączone | 5 | 303,2 ms | 322,0 ms | 325,1 ms | brak |
| wyłączone | 10 | 304,2 ms | 316,3 ms | 316,3 ms | brak |
| wyłączone | 25 | 313,2 ms | 317,2 ms | 325,5 ms | brak |
| włączone (`PROVIDER_CONCURRENCY=4`) | 1 | 1,1 ms | 1,3 ms | 1,5 ms | 40 × 429 |
| włączone | 5 | 4,5 ms | 5,8 ms | 5,8 ms | 40 × 429 |
| włączone | 10 | 9,1 ms | 11,3 ms | 11,6 ms | 40 × 429 |
| włączone | 25 | 14,4 ms | 17,1 ms | 17,4 ms | 25 × 429 |

**Wnioski:**

1. Czas odpowiedzi `/api/agent` to w praktyce czas dostawcy + ~3 ms narzutu serwera. Aplikacja nie dodaje
   własnego opóźnienia.
2. Przy limitach wyłączonych 25 równoległych żądań przechodzi bez błędów i **bez degradacji** —
   p95 = 317 ms przy opóźnieniu dostawcy 300 ms (po podniesieniu backlogu, sekcja 3).
3. Przy `PROVIDER_CONCURRENCY=4` żądania ponad limit dostają **429 z `Retry-After`** i odpowiedź jest
   natychmiastowa (1–17 ms) — to zachowanie zgodne z projektem i pożądane: serwer nie kolejkuje pracy,
   tylko szybko odmawia. Przy testach obciążeniowych 429 nie jest błędem wydajności.

   Uwaga do pomiaru: `RATE_LIMIT_ON` jest czytane przy każdym żądaniu, ale `PROVIDER_CONCURRENCY`
   (rozmiar `Wspolbieznosc`) jest liczony raz przy imporcie `limity`, więc poziom współbieżności trzeba
   ustawić przed startem procesu.
4. `RATE_IP_PER_MIN`/`RATE_IP_PER_DAY` są liczone **przy imporcie modułu**, więc nie można ich zmienić
   zmienną środowiskową w trakcie działania procesu — trzeba ustawić przed startem. To ograniczenie
   udokumentowane, nie błąd.

## 5. Zimny start

Trzy niezależne uruchomienia procesu Pythona z `import server`:

| Metryka | Wartość |
|---|---:|
| mediana | 161 ms |
| min | 158 ms |
| max | 170 ms |

To **nie jest** zimny start funkcji Vercel (tam dochodzi uruchomienie kontenera, warstwy i import całego
`serwer/**`). Do zmierzenia na wdrożeniu osobnym narzędziem; lokalnie nie da się tego wiarygodnie odwzorować.

## 6. Czego nie zmierzono

| Pozycja | Powód | Jak zmierzyć |
|---|---|---|
| LCP, INP, CLS, FCP, TTFB | wymaga przeglądarki i renderu | Lighthouse w Playwright na wdrożeniu, 3 powtórzenia incognito, mediana |
| Rozmiar transferu z CDN | lokalnie brak CDN | DevTools → Network z cache i bez |
| Czas STT/TTS | wymaga kluczy dostawców mowy | pomiar na środowisku z kluczami, osobne limity `CZAS_STT`/`CZAS_TTS` |
| Czas odczytu PDF | wymaga plików testowych | `/api/letter/extract` na próbkach 1/5/20 stron |
| Nominatim / Overpass | publiczne usługi, limit zapytań | tylko na mocku lub po uzgodnieniu z OSM |
| Koszt AI | zależy od dostawcy i modelu | licznik `AI_DAILY_BUDGET` + log `resp` |
| Zimny start na Vercelu | brak dostępu do wdrożenia w tym audycie | logi funkcji + `X-Request-Id` |

## 7. Cele

| Metryka | Cel | Status |
|---|---|---|
| LCP | ≤ 2,5 s | do zmierzenia |
| INP | ≤ 200 ms | do zmierzenia |
| CLS | ≤ 0,1 | do zmierzenia |
| TTFB | ≤ 800 ms (orientacyjnie) | lokalnie ~1 ms; na Vercelu do zmierzenia |
| FCP | ≤ 1,8 s (orientacyjnie) | do zmierzenia |
| JS initial payload | < 200 KB gzip | **spełniony**: ~105 KB gzip |
| Błędy JS | 0 krytycznych | do zmierzenia w Playwright |
| `/api/health` p95 | < 50 ms | **spełniony**: 0,9 ms lokalnie |
| `/api/agent` narzut serwera | < 50 ms ponad czas dostawcy | **spełniony**: ~3 ms (do 25 równoległych) |
| statyki p95 przy 25 równoległych | < 100 ms | **spełniony**: 11,6 ms |
| powtórne wejście na statyk | 304 bez treści | **spełniony**: 0 B |

## 8. Jak powtórzyć

Statyki i `/api/health`:

```bash
python - <<'PY'
import sys, time, statistics, threading, urllib.request
sys.path.insert(0, 'serwer')
import server
from http.server import ThreadingHTTPServer
app = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
threading.Thread(target=app.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:%d' % app.server_port
lat = []
for _ in range(30):
    t = time.perf_counter()
    with urllib.request.urlopen(base + '/api/health', timeout=10) as r: r.read()
    lat.append((time.perf_counter() - t) * 1000)
lat.sort()
print('p50=%.1f p95=%.1f' % (statistics.median(lat), lat[int(len(lat) * 0.95)]))
PY
```

Rozmiar zasobów:

```bash
python - <<'PY'
import re, os, gzip
html = open('mockup/index.html', encoding='utf-8').read()
files = re.findall(r'src="([^"?]+\.js)', html) + re.findall(r'href="([^"?]+\.css)', html)
raw = gz = 0
for f in files:
    p = os.path.join('mockup', f)
    raw += os.path.getsize(p)
    gz += len(gzip.compress(open(p, 'rb').read()))
print('raw=%d gzip=%d' % (raw, gz))
PY
```

Obciążenie AI: atrapa dostawcy z `time.sleep(0.3)` + `ThreadPoolExecutor` na `/api/agent`
(poziomy 1/5/10/25). **Nie kieruj obciążenia na publiczne Nominatim, Overpass ani płatne API** — używaj
atrapy lub środowiska testowego z własnymi limitami.

## 9. Ryzyka wydajnościowe pozostające otwarte

- ~~`request_queue_size` gniazda~~ — **rozwiązane** w `serwer.Serwer` (128), sekcja 3;
- ~~brak ETag dla statyków~~ — **rozwiązane**: ETag + 304 (sekcja 2);
- brak kompresji gzip/brotli po stronie serwera aplikacji: na Vercelu robi to platforma, w Dockerze trzeba dodać proxy;
- brak potwierdzonego pomiaru na wdrożeniu — wymaga Lighthouse i logów funkcji;
- limity `RATE_IP_*` czytane raz przy imporcie;
- STT/TTS: transfer audio dominuje nad czasem serwera i nie był mierzony.
