# Architektura i przepływ danych

## Zakres

Projekt to nieoficjalny prototyp typu single-page frontend z serwerem Python. Główny interfejs jest w `mockup/index.html`, a dodatkowy komputerowy ekran odbiorczy ma osobną stronę `mockup/komputer.html`. Serwer dostarcza pliki statyczne i wybrane API; nie ma bazy danych, kont użytkowników, sesji ani integracji z rejestrami urzędowymi.

## Widok systemu

```text
Przeglądarka
  ├─ mockup/index.html + skrypty i style
  ├─ Web APIs: DOM, fetch, localStorage, geolokalizacja, audio
  ├─ usługi mapowe: Nominatim, Overpass i kafelki OpenStreetMap
  └─ /api/* → serwer/server.py
                 ├─ logika rozmowy i nawigacji → serwer/agent.py
                 ├─ dostawca modelu → OpenAI / Anthropic / zgodne API / LM Studio / Cloudflare Workers AI
                 ├─ worker Cloudflare → cloudflare-worker/src/index.js → Workers AI (api.cloudflare.com)
                 ├─ mowa → OpenAI lub ElevenLabs
                 ├─ tłumaczenia interfejsu → serwer/tlumacz.py i słowniki JSON
                 ├─ wyjaśnianie pism → walidacja cytatów w serwer/server.py
                 ├─ bezpieczeństwo → serwer/safety.py + lokalne źródła w mockup/safety-guides.json
                 └─ transfer demonstracyjny → pamięć procesu serwera
```

Frontend wysyła żądania względnymi adresami, takimi jak `/api/agent`; przeglądarka nie łączy się bezpośrednio z `localhost` serwera. Wyjątkiem są świadomie zewnętrzne źródła mapy, fontów i usługi mapowe wywoływane z przeglądarki.

## Warstwy i odpowiedzialności

### Frontend

- `mockup/index.html` — semantyczny szkielet i dialogi aplikacji; ładuje arkusze i skrypty w kolejności wymaganej przez globalne funkcje.
- `mockup/style.css` — istniejący projekt wizualny i układ główny.
- `mockup/modules.css` — style ekranów modułowych i podsumowania prywatności.
- `mockup/tailwind.css` — źródło Tailwind CSS; nie zastępuje istniejących arkuszy.
- `mockup/tailwind.generated.css` — zbudowane narzędzia Tailwind podłączone do obu dokumentów HTML.
- `mockup/core.js` — wspólne narzędzia DOM, prezentacja profili i dokumentów, rozmowy, historia, stan oczekujących operacji i przepływ dialogów.
- `mockup/osoby.js`, `sylwetki.js`, `variants.js`, `scenarios.js` — fikcyjne profile i dokumenty, warianty układu oraz lokalne przykładowe scenariusze.
- `mockup/agent.js` — wysyłanie rozmowy do serwera, prezentacja odpowiedzi i ograniczona nawigacja do lokalnych ekranów.
- `mockup/znak-kod.js`, `znak.js` — token/znak demonstracyjny, skanowanie i przepływ transferu symulacyjnego.
- `mockup/accessibility.js`, `preferences.js` — zarządzanie dialogami i ustawieniami dostępności.
- `mockup/places.js` — wyszukiwanie, filtrowanie i prezentacja danych placówek z OSM.
- `mockup/modules.js` — tłumacz pism oraz lokalne centrum rodzinne.
- `mockup/safety.js`, `safety-guides.json`, `safety.css`, `safety-sw.js` — statyczne poradniki i stan lokalny, opcjonalny asystent AI, ograniczony tryb offline.
- `mockup/i18n.js`, `lmstudio.js` — tłumaczenie tekstów UI i wybór modelu LM Studio.

Skrypty nie są modułami ES; udostępniają funkcje i dane w globalnym zakresie. Kolejność `<script>` w HTML jest więc częścią kontraktu aplikacji. Przy dodaniu nowego skryptu należy zweryfikować, że wymagane przez niego funkcje zostały już zdefiniowane.

### Serwer

`serwer/server.py` korzysta z `ThreadingHTTPServer` i biblioteki standardowej Pythona. Udostępnia statyczny katalog `mockup/`, normalizuje ścieżki stron językowych oraz kieruje żądania API do kodu integracji. `serwer/agent.py` obsługuje dostawców rozmowy i narzędzia nawigacyjne; `serwer/lmstudio.py` obsługuje lokalny interfejs modeli i wspólny klient HTTP używany także przez workera Cloudflare; `serwer/tlumacz.py` udostępnia słowniki i obsługuje brakujące tłumaczenia.

### Worker Cloudflare (opcjonalny dostawca)

`cloudflare-worker/` to osobny projekt wdrażany na Cloudflare (`wrangler deploy`), a nie część serwera Pythona. Worker wystawia `GET /v1/models` i `POST /v1/chat/completions` w formacie OpenAI i wywołuje **Workers AI**:

```text
serwer/agent.py (PROVIDER=workers)
  └─ serwer/lmstudio.py open_request → CLOUDFLARE_WORKERS_URL/v1/chat/completions
        └─ worker (cloudflare-worker/src/index.js)
              └─ env.AI.run(...) albo POST api.cloudflare.com/.../ai/run/<model>
```

Trzy decyzje wynikające z tej konstrukcji:

- **Wspólny klient HTTP.** Rozmowa z workerem idzie przez `lmstudio.open_request`/`zgodny` (format Chat Completions), więc serwer nie ma drugiej implementacji protokołu. `lmstudio.base_url` normalizuje adres workera tak samo jak LM Studio.
- **Własny nagłówek `User-Agent`.** Cloudflare odrzuca domyślny nagłówek `Python-urllib` błędem `1010 Access denied`, zanim żądanie dotrze do workera. Dlatego `lmstudio.open_request` ustawia `USER_AGENT`; bez tego błąd wygląda jak odrzucony token.
- **Brak procesów roboczych w tle.** Każda odpowiedź to jedno zapytanie HTTP z serwera do workera. Nie ma kolejki, zadań asynchronicznych ani `serwer/aws.py` — dawna wersja dostawcy AWS (Bedrock) została usunięta wraz z testem `tests/test_aws.py`.

Ograniczenia workera: Workers AI nie obsługuje `tool_calls`, więc odpowiedzi są tekstowe i nie wywołują narzędzi aplikacji (karty, akcje, nawigacja). Dostępność modeli zależy od planu Cloudflare.

### Testy

- `tests/*.spec.js` — testy przeglądarkowe Playwright, w tym scenariusze z mockowanymi usługami.
- `tests/test_*.py` — testy serwerowe i logiki Pythona.
- `playwright.config.js` — Chromium, jeden worker, serwer testowy na porcie 8792.

## Główne przepływy

### Uruchomienie strony

1. Serwer mapuje `/aplikacja` na `mockup/index.html` i obsługuje resztę statycznych plików z `mockup/`.
2. `i18n.js` ustala język z prefiksu URL lub parametru, po czym załadowane są dane i zachowania aplikacji.
3. `core.js` buduje widok z fikcyjnych danych. Moduły rejestrują własne zdarzenia po inicjalizacji wymaganych elementów HTML.
4. `agent.js` pobiera `/api/health`. Stan `configured` oznacza konfigurację i dostępność wskazaną przez serwer, nie prawdziwą integrację urzędową.

### Rozmowa

1. Użytkownik wpisuje tekst albo świadomie wybiera wysłanie sprawdzonego szkicu dyktowania.
2. Frontend wysyła historię ograniczoną do wiadomości użytkownika i asystenta pod `/api/agent`. Przy `PROVIDER=lmstudio` i `PROVIDER=workers` dołącza wybrany model i stosuje dłuższy limit czasu (`CLOUDFLARE_WORKERS_TIMEOUT`).
3. Serwer waliduje kształt historii i wybór modelu, wywołuje skonfigurowanego dostawcę (`openai`, `anthropic`, `zgodny`, `lmstudio` albo `workers`) i zwraca odpowiedź oraz ewentualne zdarzenie nawigacyjne.
4. Frontend przyjmuje jedynie tekst i trzy rozpoznane ekrany lokalne: mapa, pomoc i dostępność. Nawigacja nie wykonuje sprawy.
5. Przy błędzie wiadomość pozostaje dostępna do ponowienia; nie powstaje odpowiedź zastępcza udająca model.

### Tłumacz pism

1. Wybór pliku nie wysyła go samoczynnie. Po osobnym kliknięciu „Odczytaj wybrany plik” frontend koduje plik i wysyła go do `/api/letter/extract`.
2. Serwer czyta TXT UTF-8 albo PDF z warstwą tekstową, ograniczając rozmiar i liczbę znaków. OCR nie jest dostępny.
3. Użytkownik może przejrzeć i poprawić tekst, a przed analizą musi osobno zaznaczyć pole zgody.
4. `/api/letter/explain` przesyła tekst do skonfigurowanego modelu. Walidator odrzuca pozycje bez dosłownego cytatu w źródle i termin bez pasującej jawnej daty lub okresu.
5. To ogranicza niektóre błędy, ale nie potwierdza prawdziwości interpretacji ani aktualności prawa.

### Bezpieczny Obywatel

1. Przeglądarka pobiera dwujęzyczne statyczne scenariusze z `safety-guides.json`; checklisty i opcjonalny profil są utrwalane lokalnie.
2. Jawnie nieznany status nie jest łączony z kanałem alertów; połączenie alarmowe to wyłącznie link klikany przez użytkownika.
3. Po świadomym wysłaniu opisu backend waliduje allowlisty i wywołuje skonfigurowany model z promptem ograniczonym do lokalnych wskazówek. Przy bezpośrednim zagrożeniu API odrzuca żądanie; AI nie ma narzędzi ani dostępu do bieżących danych.
4. Zdjęcie pozostaje podglądem lokalnym. Service Worker buforuje tylko statyczne materiały, nie `/api/`; po pierwszym wczytaniu poradniki mogą działać offline.

### Mapa

1. Użytkownik wpisuje miejscowość albo wybiera lokalizację przeglądarki.
2. Frontend wyszukuje wpisaną nazwę w Nominatim, a następnie wysyła współrzędne do Overpass. Użycie lokalizacji wymaga działania użytkownika i uprawnienia przeglądarki.
3. Odpowiedź jest sprawdzana, klasyfikowana i ograniczana do 200 wyników; filtry działają lokalnie na pobranej liście.
4. Kafelki mapy są pobierane z usługi OSM. Gdy dane nie są dostępne, interfejs pokazuje błąd lub listę, nie fikcyjne punkty.

### Znak i transfer symulacyjny

1. Urządzenie emituje okresowo zmieniany token demonstracyjny; drugi klient pyta serwer o skan i status.
2. Ekran żądania wyświetla deklarowany cel oraz zakres i statyczną poradę. Żaden model AI nie jest przy tym wywoływany.
3. Pola są początkowo odznaczone. Przycisk potwierdzenia jest aktywny dopiero po wyborze przynajmniej jednego pola.
4. Przy potwierdzeniu na serwer trafiają wyłącznie zaznaczone fikcyjne wiersze. `beat` odbiorcy odbiera je z pamięci procesu serwera.
5. Nie jest to prawdziwa zgoda ani uwierzytelnienie. Odbiorca i cel nie są weryfikowane, a dane nie pochodzą z rejestru.

## Stan i trwałość

| Rodzaj danych | Miejsce | Trwałość |
|---|---|---|
| Ustawienia seniora i dostępności | `localStorage` | Do wyczyszczenia danych przeglądarki; przy błędzie aplikacja działa w bieżącej sesji i ostrzega. |
| Wybór modelu (LM Studio lub worker) | `localStorage`, przypisany do identyfikatora serwera lub workera (`lmstudio.server_id`) | Nie przenosi się na inny serwer; wybór może działać tylko do końca sesji przy niedostępnej pamięci. |
| Lista osób i zadania rodzinne | `localStorage` | Lokalnie w jednej przeglądarce, bez synchronizacji. |
| Historia i szkic rozmowy | stan strony w pamięci | Nie przetrwa odświeżenia. |
| Znak, skan i skrzynka transferu | pamięć procesu Pythona | Ulotne, wygaszane; znikają po restarcie serwera. |
| Logi i cache TTS | plik `serwer/agent.log` oraz pamięć procesu | Cache TTS ulotny; log może pozostać na dysku do ręcznego usunięcia. |

## Ważne granice

Nie ma trwałej bazy, kont, uprawnień serwerowych, uwierzytelnienia odbiorcy, podpisu, sprawdzenia rejestru ani wysyłania formularza do urzędu. Użytkownik nie powinien wprowadzać prawdziwych danych. Zmiana prototypu w produkcyjny system wymagałaby osobnej architektury tożsamości, zgód, autoryzacji, retencji, audytu, dostępności i ochrony danych.
