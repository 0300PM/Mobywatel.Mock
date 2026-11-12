# Testy i proces pracy

## Wymagania

- Node.js `>=22.12.0` i npm;
- Python 3;
- opcjonalnie Node.js w wersji z `fetch` (18+) do lokalnego testu workera; Cloudflare nie jest potrzebne do testów;
- Chromium Playwright dla testów przeglądarkowych;
- zależnie od testowanego obszaru: wolny port 8792. Rzeczywiste usługi AI, STT, TTS i map nie są wymagane przez zwykły zestaw mockowany.

## Instalacja i uruchamianie

```bash
npm ci
npx playwright install chromium
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

`npm test` uruchamia `pretest`, a ten buduje `mockup/tailwind.generated.css` przed Playwright. Sam serwer aplikacji uruchom ręcznie poleceniem z głównego README; domyślnie jest na `127.0.0.1:8790`.

Tailwind można budować oddzielnie:

```bash
npm run build:css
npm run watch:css
```

## CI przed wdrożeniem

`.github/workflows/test.yml` uruchamia przy każdym pushu i pull requeście:

1. `python -m unittest discover -s tests -p "test_*.py" -v` — 63 testy backendu;
2. `npx playwright test` — testy przeglądarkowe z Chromium;
3. publikację `playwright-report/` i `test-results/` jako artefaktu (retencja 30 dni).

Raport testów zostaje w artefakcie CI i może być materiałem konkursowym. Wdrożenie powinno być blokowane,
dopóki oba joby nie są zielone.

Pomiary wydajności i sposób ich powtórzenia: `docs/PERFORMANCE.md`.

## Konfiguracja Playwright

`playwright.config.js`:

- wskazuje katalog `tests/`, Chromium i jeden worker;
- startuje `python3 serwer/server.py 8792` pod adresem loopback;
- używa `CHROMIUM_EXECUTABLE_PATH`, jeśli zmienna wskazuje lokalny Chromium;
- nie testuje automatycznie produkcyjnych kluczy ani prawdziwych usług.

Nie uruchamiaj równolegle innego procesu na porcie 8792. Przy CI można ustawić `CI`, aby Playwright nie używał już działającego serwera.

## Pokrycie planu naprawczego

| Etap | Wymaganie | Gdzie |
|---|---|---|
| 2 | ścieżki nawigacji | `features.spec.js` — profil, menu, ustawienia, powrót z fokusem |
| 2 | walidacja formularzy | `prototype.spec.js` — zadania rodzinne, przypomnienia |
| 2 | błędy AI i brak konfiguracji | `lmstudio.spec.js`, `prototype.spec.js` |
| 2 | puste i błędne odpowiedzi OSM | `map-data.spec.js` — 429, błędny JSON, puste wyniki |
| 2 | odświeżenie strony | `persistence.spec.js` |
| 2 | utrata połączenia | `letter-ocr.spec.js` — przerwane żądanie pisma |
| 2 | odmowa mikrofonu | `letter-ocr.spec.js`, `prototype.spec.js` |
| 2 | uszkodzony PDF | `letter-ocr.spec.js` |
| 2 | szkic rozmowy lokalnie | `persistence.spec.js` |
| 2 | oznaczenie funkcji demo | `prototype.spec.js`, treść `index.html` |
| 3 | pomiary wydajności | `docs/PERFORMANCE.md` |
| 4 | WCAG i 320 px | `features.spec.js`, `prototype.spec.js` (axe) |
| 5 | CI: testy, audyt | `.github/workflows/test.yml` |

## Zestawy testowe

### `tests/prototype.spec.js`

Podstawowe zachowanie prototypu: przykładowe przypomnienia i pomoc, dyktowanie/odczyt mowy, błędy asystenta, przejścia między klientami znaku, odmowa, selekcja pól i transfer tylko zaznaczonych wierszy, bezpieczeństwo dynamicznych treści, fokus, reflow, klawiatura i wybrane kontrole axe.

W teście transferu import `duck` sprawdza dokładny zestaw nazw wysłanych pól. Pozwala to pokazać opis niezgodności matcherem, obok standardowych `expect` Playwright.

### `tests/features.spec.js`

Tłumacz pism, centrum rodzinne, profil seniora, ustawienia dostępności, mapa, zachowanie przy braku usług, większy tekst, reflow, geolokalizacja, alternatywy listy i nawigacja do lokalnych ekranów.

### `tests/safety.spec.js` i `tests/test_safety.py`

Testy scenariuszy bezpieczeństwa, czytelnego statusu, jawnej obsługi 112, trybu awaryjnego, ukrytego paska przewijania bez blokowania scrolla, lokalnego profilu/plecaka, ochrony lokalizacji i zdjęcia, angielskiego UI, walidacji odpowiedzi modelu, endpointu i ścieżki bez dostawcy. Testy AI są mockowane; nie oceniają jakości porad ani dostępności rzeczywistego modelu.

### `tests/lmstudio.spec.js` i `tests/lmstudio-e2e.spec.js`

Mockowane testy wyboru modelu, walidacji listy, przypisania wyboru do endpointu, komunikatów błędu, stanu `localStorage` i wybranej integracji. Test e2e korzysta z serwera testowego/mocka zgodnego z API; nie dowodzi jakości modeli ani nie zastępuje konfiguracji użytkownika.

### `tests/test_workers.py` (Cloudflare)

Testy dostawcy `PROVIDER=workers` na lokalnej atrapie workera (`FakeWorker`, `ThreadingHTTPServer`), bez sieci i bez Cloudflare:

- normalizacja adresu (`workers_ready` przyjmuje adres z `/v1`, bez `/v1` i pełny endpoint; odrzuca `ftp://`, dane logowania w URL, `/api/v1`);
- rozmowa idzie na `POST /v1/chat/completions` z modelem, historią i promptem systemowym (`REAL_SYSTEM`);
- wybrany model z żądania ma pierwszeństwo, a `WORKERS_TOKEN` trafia jako `Authorization: Bearer` i nie wycieka do odpowiedzi;
- lista modeli `/api/lmstudio/models` pyta workera (`GET /v1/models`);
- `/api/health` raportuje `provider: workers` bez ujawniania tokenu;
- brak adresu daje 503 przy rozmowie i 502 z nazwą `CLOUDFLARE_WORKERS_URL` przy liście modeli;
- komunikaty błędów mówią o workerze, nie o LM Studio;
- błąd workera (429) kończy się 502 i nie tworzy odpowiedzi zastępczej.

Testy nie łączą się z prawdziwym workerem ani Workers AI. Wdrożenie i sekrety Cloudflare sprawdza się ręcznie
(`curl https://<worker>/v1/models`, potem rozmowa w aplikacji). Testy AWS/Bedrock zostały usunięte wraz z kodem.

### `tests/test_*.py`

Testy serwerowej walidacji, kontraktów, bezpieczeństwa wejścia, integracji LM Studio, dostawcy Cloudflare i ograniczeń związanych z dokumentami. Zwykłe uruchomienie nie wymaga dostępu do prawdziwych danych urzędowych.

## Uruchomienie wybranych testów

Playwright przyjmuje standardowe filtry:

```bash
npx playwright test tests/prototype.spec.js
npx playwright test tests/features.spec.js --grep "mapa"
npx playwright test tests/prototype.spec.js --grep "podsumowanie prywatności"
```

W repo może być wymagane Chromium zgodne z wersją `@playwright/test`; w razie braku uruchom `npx playwright install chromium`. Nie raportuj testu jako zaliczonego, jeśli przeglądarka nie została uruchomiona.

## Co oznaczają wyniki

- Testy Playwright sprawdzają zachowania DOM w Chromium, zainicjalizowanych fikcyjnych profilach i mockach sieciowych.
- Axe testuje tylko wskazane ekrany i reguły. Nie dowodzi pełnej zgodności WCAG 2.2 AA.
- Test serwerowy nie potwierdza aktualnych warunków API u dostawcy.
- Testy nie zastępują ręcznej próby z czytnikiem ekranu, mikrofonem, ekranem dotykowym, siecią mobilną ani testów penetracyjnych.
- Brak kluczy jest poprawnym przypadkiem testowym; aplikacja ma wtedy jasno zgłosić niedostępność, a nie udawać odpowiedź modelu.

## Zalecany przegląd przed zmianą

1. Sprawdź `git diff --check`, składnię JS oraz brak wygenerowanych testowych danych lub sekretów.
2. Uruchom testy właściwe dla zmodyfikowanej warstwy; po zmianie przepływu UI uruchom pełny zestaw Playwright i testy Python.
3. Jeśli zmieniono CSS źródłowy, uruchom `npm run build:css` i sprawdź różnicę w pliku wynikowym.
4. Otwórz interfejs przy szerokości 320 px, orientacji poziomej, dużym tekście i ograniczeniu ruchu.
5. Sprawdź komunikaty błędu, odmowę, ponowienie, focus i zakres danych wysyłanych przez sieć.
6. Aktualizuj dokumentację odpowiedniej warstwy i README.
