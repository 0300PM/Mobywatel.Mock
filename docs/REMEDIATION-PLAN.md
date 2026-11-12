# Realizacja planu naprawczego

Stan na dziś, z jawnym rozdzieleniem tego, co **zrobione w kodzie**, od tego, co **wymaga wdrożenia,
ludzi lub decyzji** i nie może być wykonane z repozytorium.

## ETAP 0 — Stabilizacja i stan bazowy

| Zadanie | Stan | Uwaga |
|---|---|---|
| przypiąć audytowany commit i hash | **do zrobienia po Twojej stronie** | `git rev-parse HEAD` na commicie, który wdrażasz; wymaga decyzji, który commit jest wdrożony |
| sprawdzić zmienne środowiskowe Vercel | **do zrobienia w panelu Vercel** | `.env.example` opisuje każdą zmienną; wartości sekretów nie mogą trafić do repo |
| sprawdzić `/api/health` | **gotowe** | endpoint istnieje, zwraca dostawcę i wersję; test w CI |
| potwierdzić aktywnego dostawcę AI | **gotowe** | `/api/health` zwraca `provider`; brak dostawcy jest jawnym błędem, nie cichym fallbackiem |
| publiczne proxy LM Studio wyłączone | **gotowe w kodzie** | `LM_STUDIO_OPENAI_PROXY=0` na Vercelu — sprawdź w panelu; bez flagi `/v1/*` zwraca 403 |
| uruchomić `npm test` | **gotowe** | 71 testów Playwright, wszystkie zielone |
| zapisać raport testów | **gotowe** | CI publikuje `playwright-report/` jako artefakt (30 dni) |
| sprawdzić logi błędów wdrożenia | **do zrobienia na wdrożeniu** | logi zawierają `rid`, `path`, `status`, `ms`; bez wdrożenia nie ma czego czytać |
| smoke test wszystkich modułów | **częściowo** | 71 testów Playwright pokrywa moduły lokalnie; smoke na wdrożeniu wymaga dostępu |
| pierwszy Lighthouse Mobile/Desktop | **nie wykonany** | wymaga przeglądarki na wdrożeniu — patrz `docs/PERFORMANCE.md`, sekcja 6 |

## ETAP 1 — Krytyczne błędy i bezpieczeństwo

| Zadanie | Stan | Dowód |
|---|---|---|
| rate limiting endpointów AI | **gotowe** | `serwer/limity.py`, `LIMITY`, `LIMIT_IP`; opt-in `RATE_LIMIT_ON` |
| limit równoległych żądań | **gotowe** | `Wspolbieznosc`, `PROVIDER_CONCURRENCY` (domyślnie 4) |
| limity wejścia dla endpointu | **gotowe** | `dlugosc(headers, …)` na każdym endpoincie; limity znaków w `api.py` |
| sprawdzić i wyłączyć proxy LM Studio | **gotowe** | brama: flaga → 403, dostawca → 404, token → 403/401, `compare_digest` |
| kontrola timeoutów | **gotowe** | `LIMIT_ZADANIA` 110 < `maxDuration` 120; `CZAS_ROZMOWY` 60, `CZAS_STT`/`CZAS_TTS` 45, `CZAS_TLUMACZENIA` 30 |
| ujednolicona obsługa błędów | **gotowe** | `{code, message, retryable, request_id}` + `X-Request-Id` |
| brak sekretów we froncie i repo | **sprawdzone** | frontend nie zawiera kluczy; `.env` w `.gitignore`; sekrety tylko w env serwera |
| nagłówki bezpieczeństwa | **gotowe** | CSP bez `unsafe-inline`, HSTS za `HTTPS_ONLY`, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` |
| test prompt injection | **gotowe** | `PromptInjectionTest` — 5 wektorów, dokument nigdy w prompcie systemowym |
| logowanie danych wrażliwych | **gotowe** | redakcja PESEL, tokenów i pól treściowych w `ustawienia.log` |

## ETAP 2 — Stabilność logiki aplikacji

| Zadanie | Stan | Dowód |
|---|---|---|
| ścieżki nawigacji | **gotowe** | `features.spec.js` — profil, menu, ustawienia, powrót z fokusem, 320 px |
| walidacja formularzy | **gotowe** | `prototype.spec.js` — zadania, przypomnienia, transfer |
| błędy AI i brak konfiguracji | **gotowe** | `lmstudio.spec.js`, `prototype.spec.js` |
| puste i błędne odpowiedzi OSM | **gotowe** | `map-data.spec.js` — 429, błędny JSON, puste wyniki |
| odświeżenie strony | **gotowe** | `persistence.spec.js` |
| utrata połączenia | **dodane teraz** | `letter-ocr.spec.js` — przerwane żądanie pisma; komunikat po polsku zamiast „Failed to fetch" |
| odmowa mikrofonu | **dodane teraz** | `letter-ocr.spec.js`, `prototype.spec.js` |
| błędny i uszkodzony PDF | **dodane teraz** | `letter-ocr.spec.js` — formularz pozostaje użyteczny |
| szkic rozmowy lokalnie | **gotowe** | `persistence.spec.js` — szkic przeżywa odświeżenie |
| oznaczenie funkcji demo | **gotowe** | treść `index.html` + `prototype.spec.js` |

## ETAP 3 — Wydajność

| Zadanie | Stan | Uwaga |
|---|---|---|
| analiza rozmiaru assetów | **gotowe** | 332 KB surowo / 105 KB gzip — `docs/PERFORMANCE.md` |
| optymalizacja obrazów i fontów | **częściowo** | jedno `<img>`, font z `preconnect`; konwersja do `woff2` lokalnie i `font-display` wymaga decyzji projektowej |
| lazy-load mapy i cięższych modułów | **nie zrobione** | `places.js` (22 KB surowo, 8 KB gzip) ładowany na starcie; zysk mały, ryzyko regresji duże — poza tym zakresem |
| limit markerów | **gotowe** | `PLACE_LIMIT` = 200, sortowanie po odległości |
| debounce wyszukiwania mapy | **gotowe** | `PLACE_FILTER_DELAY` |
| limit wywołań API | **gotowe** | `limity.py` + `budzet_sprawdz()` |
| cache bezpiecznych danych statycznych | **dodane teraz** | `ETag` + `Cache-Control: public, max-age=300, must-revalidate`, 304 bez treści |
| brak cache prywatnych odpowiedzi AI | **gotowe** | `no-store` na wszystkich endpointach AI |
| rozdzielone timeouty AI/STT/TTS/mapa | **gotowe** | osobne stałe w `ustawienia.py` |
| streaming rozmowy | **nie zrobione** | wymaga zmiany kontraktu API i klienta — poza zakresem |
| test 5/10/25 równoległych | **gotowe** | `docs/PERFORMANCE.md`, sekcje 3–4 |

## ETAP 4 — Dostępność i UX

| Zadanie | Stan | Uwaga |
|---|---|---|
| pełny przegląd WCAG 2.2 AA | **częściowo** | axe w Playwright (automatyczne reguły); pełny audyt manualny wymaga eksperta |
| wszystkie ekrany klawiaturą | **gotowe** | `features.spec.js` — karuzele, dialogi, powrót fokusu |
| czytnik ekranu | **nie zrobione** | wymaga NVDA/VoiceOver i człowieka przy przeglądzie |
| powiększenie 200% i 400% | **częściowo** | testy dużego tekstu i kontrastu; zoom 400% wymaga przeglądu manualnego |
| etykiety pól i komunikaty błędów | **gotowe** | `aria-describedby`, `role="status"`, komunikaty po polsku |
| zarządzanie fokusem | **gotowe** | `features.spec.js` |
| kontrast wszystkich stanów | **częściowo** | axe pokrywa większość; stany `:hover`/`:active` wymagają przeglądu |
| testy z seniorami | **nie zrobione** | wymaga rekrutacji uczestników — poza możliwościami repozytorium |
| układ przy 320 px | **gotowe** | `features.spec.js` |

## ETAP 5 — Architektura

| Zadanie | Stan | Dowód |
|---|---|---|
| wydzielone moduły API | **gotowe** | `serwer/api.py`, `server.py` (HTTP), `agent.py` (LLM) |
| adaptery dostawców AI | **gotowe** | `agent.py` + `lmstudio.py` + worker Cloudflare |
| moduły STT/TTS | **gotowe** | `serwer/mowa.py` |
| obsługa dokumentów | **gotowe** | `letter_text`, `extract_pdf_text`, `validate_letter_result` w `api.py` |
| moduł kryzysowy | **gotowe** | `serwer/safety.py` + `mockup/safety.js` |
| wspólna walidacja i typy odpowiedzi | **gotowe** | `ApiError` z `kod`/`retryable`, `validate_*` |
| identyfikatory żądań i logowanie | **gotowe** | `X-Request-Id`, `rid` w logu, redakcja |
| dokumentacja przepływu danych | **gotowe** | `docs/SECURITY-PRIVACY.md`, `docs/ARCHITECTURE.md`, `docs/BACKEND-API.md` |
| CI: testy, lint, audyt, build | **częściowo** | testy + audyt są; **lint nie jest skonfigurowany** (brak ESLint/Ruff w repo) |

## ETAP 6 — Ulepszenia konkursowe

| Zadanie | Stan | Uwaga |
|---|---|---|
| OCR z podglądem i korektą | **gotowe** | `letter-ocr.spec.js` — rozpoznany tekst trafia do edytowalnego pola |
| źródła i daty porad | **gotowe** | `safety.js` — `sources`, data przeglądu |
| plecak do wydruku/PDF | **nie zrobione** | nowa funkcja, wymaga decyzji o formacie |
| jasny status offline poradników | **gotowe** | `safety.js` — `offline`, `error` |
| przepływ „znajdź sprawę → instrukcja → kanał" | **częściowo** | istnieje w module mapy; pełny przepływ wymaga decyzji produktowej |
| testy z osobami starszymi | **nie zrobione** | wymaga ludzi |
| demo bez zewnętrznego AI | **gotowe** | `PROVIDER` bez klucza → jawny komunikat; `prototype.spec.js` |

## Czego nie da się zrobić z repozytorium

Lighthouse, zimny start Vercela, CWV, audyt manualny WCAG, testy z seniorami, logi wdrożenia i hash
wdrożonego commita wymagają dostępu do wdrożenia albo udziału ludzi. Są oznaczone powyżej jako
„nie zrobione" / „do zrobienia po Twojej stronie", nigdy jako wykonane.
