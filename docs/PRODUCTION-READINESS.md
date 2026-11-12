# Gotowość produkcyjna (Vercel)

Data sprawdzenia: 12 listopada 2026. Sprawdzone na kodzie z tego repozytorium, bez wdrożenia — Vercel nie był dostępny w tej sesji, więc pozycje wymagające panelu wdrożenia są oznaczone osobno.

## 1. Co zostało naprawione w tej sesji

Wszystkie trzy błędy dotyczyły tylko trybu WSGI, czyli właśnie Vercela. Lokalny serwer HTTP (`serwer/server.py` uruchamiany bezpośrednio, Docker) działał poprawnie, dlatego testy ich nie widziały.

| Błąd | Skutek na produkcji | Poprawka |
|---|---|---|
| `H.send_response` przypisywał `self.naglowki = []` — listę nagłówków — pod nazwę metody `H.naglowki()`. | **Każde** `/api/*` zwracało 500 „Wewnętrzny błąd serwera”, w tym `/api/health`. Aplikacja działała, ale asystent, tłumacz pism, STT, TTS i mapa nie. | Lista nagłówków trzymana w strumieniu wyjściowym (`_Wy.naglowki`), `_Cien` nie nadpisuje metod klasy. |
| `parse_request()` w trybie WSGI czytał linię żądania bez nagłówków z `environ`, więc po parsowaniu `self.headers` zawierał tylko `Content-Type` i `Content-Length`. | Nagłówki `If-None-Match`, `Authorization`, `X-Request-Id` z żądania były niewidoczne. Warunkowe `304` nie działało, a `GET` do `/v1/models` z tokenem dawał 401. | Po `handle_one_request` nagłówki z `environ` są przywracane. |
| `end_headers` w trybie WSGI kończył pracę przed dodaniem nagłówków bezpieczeństwa, bo `send_header` nic nie robił bez listy. | Na Vercelu brakowało CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`. | `odtworz_naglowki()` dokłada brakujące nagłówki bezpieczeństwa do odpowiedzi WSGI. |

Plik: `serwer/server.py`. Zmiany nie dotyczą ścieżki gniazdowej — `python -m unittest discover` nadal przechodzi w całości (67 testów).

## 2. Weryfikacja trybu WSGI bez wdrażania

Aplikacja WSGI z `api/index.py` została wywołana bezpośrednio, z `MOB_TYLKO_ODCZYT=1` (jak na Vercelu), dla 12 typów żądań:

| Żądanie | Wynik |
|---|---|
| `GET /`, `GET /aplikacja`, `GET /en/aplikacja/` | 200, `text/html`, ETag, `Cache-Control: public, max-age=300`, komplet nagłówków bezpieczeństwa |
| `GET /style.css`, `GET /safety-guides.json` | 200, poprawny `Content-Type` |
| `GET /api/i18n`, `GET /api/i18n.js` | 200, JSON i JavaScript |
| `GET /api/health` | 200, `application/json`, `Cache-Control: no-store` |
| `GET /api/lmstudio/models` | 404 z kodem `nieznany` (dostawca wyłączony) — zgodnie z projektem |
| `POST /api/tts`, `POST /api/stt` | 503 `niedostepny` — brak klucza, komunikat po polsku |
| `POST /api/letter/explain`, `POST /api/safety/assist` | 503 `niedostepny` — brak dostawcy AI |
| `POST /api/agent` z niepoprawnym JSON | 400 `walidacja` |
| `POST /v1/chat/completions` | 403 `proxy` — przekazywanie endpointów wyłączone |
| `HEAD /aplikacja` | 200, 0 bajtów |
| `GET /nie-ma` | 404 `text/html` |
| `POST /api/agent` z `PROVIDER=openai` i kluczem testowym | 502 `response`, `retryable: true` — żądanie doszło do warstwy dostawcy, nie wywaliło serwera |

Żadne z żądań nie zwróciło 500.

## 3. Ryzyko: rozmiar funkcji na Vercelu

`vercel.json` ma `"includeFiles": "serwer/**"`, a katalog `serwer/wiedza` waży **62 MB** (`cards.jsonl` 27,7 MB, `chunks.jsonl` 34,1 MB). Vercel ma limit rozmiaru funkcji — po przekroczeniu wdrożenie jest odrzucane albo funkcja nie startuje. Limitu nie potwierdziłem w tej sesji (wymaga panelu Vercel), ale 62 MB to wartość graniczna.

Dwie opcje do decyzji:

1. **Wyrzucić bazę wiedzy z funkcji** — `"excludeFiles": "serwer/wiedza/**"` w `vercel.json`. Wtedy `dane.govpl` zwróci brak danych zamiast kart gov.pl, a reszta aplikacji działa. Pliki `fakty_*.jsonl` (135 KB) można zostawić.
2. **Zostawić i sprawdzić na wdrożeniu** — jeśli Vercel przyjmie funkcję, nic nie trzeba zmieniać.

Nie zmieniałem tego sam, bo to decyzja o zakresie funkcji na produkcji, a nie błąd.

## 4. Co jest sprawdzone, a czego nie da się sprawdzić bez wdrożenia

| Pozycja | Stan |
|---|---|
| Ścieżki i kody odpowiedzi w trybie WSGI | ✅ sprawdzone bezpośrednim wywołaniem aplikacji |
| Nagłówki bezpieczeństwa w trybie WSGI | ✅ sprawdzone (po poprawce) |
| Warunkowe `304` (ETag) w trybie WSGI | ⚠️ działa w kodzie, ale nagłówek `If-None-Match` dochodzi dopiero po poprawce — warto potwierdzić na wdrożeniu |
| `maxDuration` 120 s vs limit wewnętrzny 110 s | ✅ spójne (`LIMIT_ZADANIA`) |
| Zimny start funkcji | ⚠️ nie zmierzony — wymaga wdrożenia |
| Zachowanie przy `LM_STUDIO_OPENAI_PROXY=1` | ⚠️ ustawienie musi być `0` na Vercelu; w lokalnym `.env` poprawione |
| Sekrety w `.env` | ✅ `.env` jest w `.gitignore`, do repozytorium nie trafia |
| `vercel.json` — nagłówki HSTS/CSP na poziomie platformy | ⚠️ nie dodane; CSP i reszta idą teraz z serwera, HSTS wymagałby wpisu w `vercel.json` |
