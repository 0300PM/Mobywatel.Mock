# Scenariusze testowe przed konkursem — wyniki

Data uruchomienia: 12 listopada 2026, środowisko lokalne (`http://127.0.0.1:8792`, Chromium headless przez Playwright).
Plik testów: `tests/scenarios.spec.js` (7 testów, wszystkie zielone: `7 passed (14,3 s)`).

**Czego tu nie ma:** wyników z wdrożonej domeny. Scenariusze A–G w tej tabeli sprawdzają zachowanie aplikacji w przeglądarce i serwerze lokalnym. Uruchomienie na Vercelu wymaga dostępu do panelu wdrożenia i jest osobnym krokiem (`docs/TESTING.md`, sekcja CI).

## Wyniki

| Scenariusz | Co sprawdza test | Wynik | Uwagi |
|---|---|---|---|
| **A — pierwsze uruchomienie** | Nowy kontekst przeglądarki, brak zapisu lokalnego, otwarcie `/aplikacja`, przeładowanie, nasłuch `pageerror` i `console.error` | ✅ | Zero błędów konsoli poza `favicon`. Komunikaty o charakterze prototypu i ograniczeniach widoczne. Przeładowanie nie psuje ekranu. |
| **B — brak AI** | `/api/health` z `agent:false`, `/api/agent` zwraca 503; sprawdzenie paska statusu, mapy i poradników | ✅ | Status: „Asystent AI: brak połączenia z modelem. Pozostałe funkcje działają bez niego”. Mapa i Bezpieczny Obywatel działają dalej. |
| **C — tłumacz pisma** | TXT, PDF z warstwą tekstową, skan bez tekstu, plik ponad 4 MiB, wysyłka bez zgody, wysyłka po zgodzie, brak wymyślonego terminu | ✅ | Bez zgody blokada „Zaznacz zgodę”. Po zgodzie dokładnie 1 żądanie. Gdy w źródle nie ma terminu, wynik go nie dopisuje. |
| **D — mapa** | Warszawa, mała miejscowość, nazwa nieistniejąca, odmowa geolokalizacji, timeout Overpass (504), filtry rodzaju placówki | ✅ | Brak „undefined” w komunikatach. Odmowa lokalizacji i timeout dają osobne komunikaty. Filtr „apteka” usuwa policję z listy. |
| **E — Bezpieczny Obywatel** | Scenariusz powódź i pożar, checklista plecaka, linki do źródeł, tryb awaryjny, przeładowanie strony, status braku alertów | ✅ | Po przeładowaniu poradniki dalej dostępne. Status: „Nieznany — aplikacja nie pobiera bieżących alertów”. Aplikacja nie twierdzi, że nie ma zagrożenia. |
| **F — dostępność** | 12 × Tab z kontrolą widocznego fokusu, profil seniora, duży tekst, wysoki kontrast, szerokość 320 px, axe (WCAG 2.0/2.1 AA) | ✅ | Brak poziomego przewijania przy 320 px. Axe bez naruszeń poza `target-size` (WCAG 2.2, znany, udokumentowany). |
| **G — stabilność** | Przerwane żądanie AI, trzy wiadomości pod rząd, przeładowanie w trakcie, cztery szybkie zmiany filtrów mapy | ✅ | Po przerwaniu połączenia komunikat i możliwość ponownej wysyłki. Liczba żądań nie przekracza liczby wiadomości. Brak zawieszenia interfejsu. |

## Poprawki wprowadzone przy tej okazji

| Plik | Zmiana |
|---|---|
| `mockup/safety.js` | Nowy klucz `aiDirectStatus` — pole statusu przy bezpośrednim zagrożeniu pokazuje teraz „Nie wysyłamy opisu do AI. Zadzwoń 112 teraz.” zamiast pełnego zdania z instrukcją. |
| `mockup/safety.js` | Usunięty `aria-label` na kafelku „Bezpieczny Obywatel”, który dublował widoczną treść i łamał WCAG 2.5.3 (`label-content-name-mismatch`) na wszystkich ekranach. |
| `tests/safety.spec.js` | Testy akceptują okno potwierdzenia wysyłki (`dialog`) i sprawdzają sugestię plecaka w `#safetyPackSuggestion`. |
| `tests/features.spec.js` | Tłumacz pisma akceptuje okno potwierdzenia; selektor „Więcej usług” jest jednoznaczny (dwa `details.more-services` w DOM). |
| `.env` | `LM_STUDIO_OPENAI_PROXY=0` — poprzednia wartość `1` wysyłała żądania do lokalnego LM Studio i psuła testy integracyjne. |

## Znane rozbieżności testów (do decyzji, nie naprawione)

Te testy zakładają zachowanie, którego aplikacja już nie ma — wymagają decyzji, czy wracamy do starego kontraktu, czy aktualizujemy testy:

| Test | Rozbieżność |
|---|---|
| `tests/features.spec.js:302` | Oczekuje tekstu „Żadna czynność nie została wykonana”. Aplikacja pokazuje teraz „Asystent AI jest teraz niedostępny…”, a żądanie do `/api/agent` w ogóle nie wychodzi (0 zamiast 1). |
| `tests/features.spec.js:393` | Ten sam komunikat i licznik żądań. |
| `tests/features.spec.js:462` | Oczekuje `z-index` menu dokumentów wyższym niż pole rozmowy; w `style.css` jest `.lmenu{z-index:19}` i `.composer{z-index:25}`. |
| `tests/prototype.spec.js:427` | Ten sam komunikat „Żadna czynność nie została wykonana”. |
| `tests/lmstudio*.spec.js`, `tests/persistence.spec.js:15`, `tests/prototype.spec.js:25/190/243` | Te same założenia o komunikatach i o liczbie żądań. |

Pełny przebieg: **15 testów nieprzechodzących z 93** (wszystkie z powyższej listy), **78 zielonych**, plus osobno **67 testów Pythona** i **7 scenariuszy A–G**.
