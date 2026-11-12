# Bezpieczeństwo i prywatność

## Status i przeznaczenie

To nieoficjalny prototyp, nie usługa mObywatel ani urząd. Dane osób, dokumenty, terminy i informacje transferowe są przykładowe. Nie wpisuj PESEL-u, prawdziwego adresu, danych logowania, haseł, kodów SMS ani danych dokumentów. Informacja o stanie prototypu znajduje się również w głównym [README](../README.md) i w interfejsie.

## Model zaufania

| Element | Zaufanie i ograniczenie |
|---|---|
| Przeglądarka użytkownika | Nie jest zabezpieczona przed inną osobą, która używa tego samego urządzenia lub profilu. localStorage jest dostępny dla strony i może być modyfikowany. |
| Serwer aplikacji | Brak kont, sesji i autoryzacji użytkowników. Domyślnie lokalny bind ogranicza ekspozycję, ale nie zastępuje firewall, izolacji ani uwierzytelniania. |
| Odbiorca znaku | `dev`, token, nazwa i deklarowany cel nie potwierdzają tożsamości ani uprawnień. Są wartościami prototypu. |
| Model / dostawca STT/TTS | Otrzymuje treści jawnie wysłane przez aplikację zgodnie z działaniem funkcji; retencja i przetwarzanie zależą od dostawcy i konfiguracji. Przy `PROVIDER=workers` pośrednikiem jest worker Cloudflare, a modelem Workers AI. |
| Dane OpenStreetMap | Zewnętrzne i społecznościowe; mogą być niepełne lub nieaktualne. Serwisy widzą żądania z przeglądarki. |
| Testy | Mocki w testach nie dowodzą bezpieczeństwa dostawcy, prywatności konta ani zachowania infrastruktury produkcyjnej. |

## Dane i przepływ

- **Rozmowa:** tekst wysłany do `/api/agent` trafia do skonfigurowanego modelu. Rozpoznany szkic nie jest wysłany, dopóki użytkownik świadomie nie wybierze wysłania. Odpowiedzi AI mogą być błędne.
- **Tłumaczenie pisma:** odczyt pliku wysyła jego zawartość do serwera projektu. Analiza przesyła tekst do dostawcy modelu po osobnym zaznaczeniu i uruchomieniu. Nie ma trwałego magazynu dokumentów w tej funkcji, ale dostawca może stosować własną retencję.
- **Mowa:** nagranie jest wysyłane do skonfigurowanej usługi STT. Tekst syntezy trafia do usługi TTS. Serwer loguje rozpoznany tekst STT; sprawdź log i politykę dostawcy, zanim użyjesz wrażliwej treści.
- **Mapa:** wpisana miejscowość trafia z przeglądarki do Nominatim. Współrzędne trafiają do Overpass, a kafelki i zasoby mapowe do dostawców OSM. Przy geolokalizacji przeglądarka pyta o uprawnienie i współrzędne są używane do zapytania Overpass. Nie wysyła ich serwer aplikacji.
- **Bezpieczny Obywatel:** tylko po wysłaniu formularza opis, wybrany scenariusz i nieczułe potrzeby ogólne trafiają do skonfigurowanego modelu. Lokalizacja jest domyślnie wykluczona i dołączana wyłącznie po zaznaczeniu zgody; zdjęcie nigdy nie trafia do API. Bezpośrednie zagrożenie blokuje wysłanie w UI i backendzie. Status alertów pozostaje nieznany, a nie ma automatycznych połączeń.
- **Ustawienia / zadania rodzinne / profil bezpieczeństwa / checklisty plecaka:** zapis lokalny w localStorage. Brak synchronizacji, szyfrowania, kont i kontroli dostępu między osobami.
- **Transfer demonstracyjny:** tylko wybrane przykładowe pola trafiają przez `/api/znak/przekaz` do krótkotrwałej pamięci jednego procesu i są odbierane przez `/api/znak/beat`. Nazwa odbiorcy, cel i żeton nie są weryfikowane. To nie jest bezpieczny protokół wymiany danych.
- **Log:** `serwer/agent.log` zawiera wyłącznie metadane techniczne: typ zdarzenia, model, czasy, liczbę znaków, identyfikator żądania. Warstwa `ustawienia.log` **redaguje** pola z treścią (`przed`, `po`, `input`, `wynik`, `tresc`, `msg`, `content`, `text`, `dane`, `pytanie`, `odpowiedz`), numer PESEL (11 cyfr) oraz wzorce tokenów (`sk-…`, `Bearer …`, `cfut_…`, JWT). Nie zapisuj do logu treści dokumentów, nagrań ani odpowiedzi modelu — jeśli to konieczne, użyj osobnego, świadomie zarządzanego kanału.

## Podsumowanie „AI: Co mogę udostępnić?”

Podsumowanie jest w całości statyczne. Rozpoznaje cel z lokalnego słownika i buduje tekst wskazówki w przeglądarce; nie przesyła danych do modelu ani nie pyta zewnętrznego systemu. Wskazówka nie ocenia podstawy prawnej, nie stwierdza minimalnego zakresu danych i nie zna intencji odbiorcy. Użytkownik sam ocenia prośbę.

Wybór checkboxa to wyłącznie wybór danych fikcyjnych w demo. Etykiety „Potwierdź w symulacji” i zastrzeżenia mają zapobiegać utożsamieniu z realną zgodą. Nawet odmowa jest tylko odpowiedzią demonstracyjną. Faktyczne uwierzytelnienie, zgoda, cel, minimalizacja, wycofanie dostępu i audyt nie są implementowane.

## Klucze i połączenia

- Sekrety powinny pozostawać w zmiennych środowiskowych serwera, nie w HTML, JS, query string ani repozytorium. `.env` jest ignorowany przez Git; nie udostępniaj go.
- LM Studio jest osiągane z procesu serwera. Nie wkładaj tokenu w URL. Dla ruchu przez niezaufaną sieć używaj szyfrowania i ograniczeń dostępu.
- Przy `PROVIDER=workers` serwer łączy się z workerem Cloudflare przez HTTPS i wysyła `CLOUDFLARE_WORKERS_TOKEN` w nagłówku `Authorization`. Rozróżnij trzy sekrety: `CLOUDFLARE_WORKERS_TOKEN` (wejście do workera, po stronie aplikacji), `WORKER_TOKEN` (ten sam ciąg ustawiony w workerze) oraz `CLOUDFLARE_API_TOKEN` (klucz konta Cloudflare z uprawnieniem *Workers AI*, **wyłącznie** jako sekret workera). Wklejenie klucza konta do `CLOUDFLARE_WORKERS_TOKEN` daje 401 i niepotrzebnie wystawia klucz aplikacji.
- Klucze `cfut_…` dają dostęp do całego konta Cloudflare w zakresie nadanych uprawnień. Trzymaj je w sekretach workera, rotuj po ujawnieniu i nie loguj nagłówków żądań.
- Treść rozmowy przy `PROVIDER=workers` opuszcza urządzenie i przechodzi przez Cloudflare (worker) do Workers AI; obowiązują warunki i retencja Cloudflare. Prototyp nie dodaje do żądania danych użytkownika poza historią rozmowy.
- Worker nie przechowuje rozmów, nie ma bazy ani KV; nie dodawaj logowania treści, jeśli nie jest to konieczne. Cloudflare może prowadzić własne logi platformy.
- `CLOUDFLARE_WORKERS_URL` musi być adresem `http`/`https` bez danych logowania, zapytania i fragmentu — serwer odrzuca inne wartości (`lmstudio.base_url`).
- `LM_STUDIO_OPENAI_PROXY=1` udostępnia endpointy modelu przez serwer aplikacji. Wymaga wtedy tokenu (`PROXY_TOKEN` albo `LM_STUDIO_API_KEY`) i nagłówka `Authorization: Bearer <token>`; bez tokenu proxy zwraca 403, a z złym tokenem 401. Na publicznym hostingu (Vercel) zostaw tę zmienną wyłączoną.
- Serwer w Dockerze nie powinien być publikowany publicznie bez warstwy autoryzacji, limitowania, zapory i ochrony transportu.

## Nagłówki bezpieczeństwa

Każda odpowiedź serwera (`serwer.NAGLOWKI_BEZPIECZENSTWA`) zawiera:

| Nagłówek | Wartość |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy` | `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `frame-ancestors 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; jawna lista dozwolonych hostów dla obrazów, fontów i `connect-src` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` — **tylko** gdy `HTTPS_ONLY=1` |

CSP nie zawiera `unsafe-inline` ani `unsafe-eval`; `index.html` nie ma skryptów ani stylów inline, więc polityka nie wymaga wyjątków. `CSP` pozwala nadpisać politykę, jeśli wdrożenie wymaga innego zakresu.

**HSTS na Vercelu:** dodać nagłówek w konfiguracji platformy (`headers` w `vercel.json`) — platforma terminuje TLS przed funkcją, więc ustawienie `HTTPS_ONLY` w funkcji nie wystarczy.

## Zgoda przed wysłaniem do AI

Trzy funkcje wysyłają treść użytkownika do modelu. Każda wymaga świadomej zgody, którą można wycofać przed wysłaniem:

| Funkcja | Mechanizm zgody | Co pokazuje |
|---|---|---|
| Tłumacz pism | checkbox `#letterConsent` **oraz** okno potwierdzenia z podglądem tekstu | podgląd wysyłanej treści, nazwa dostawcy, cel |
| Bezpieczny Obywatel | okno potwierdzenia `potwierdzWyslanie` | opis, zagrożenie, lokalizacja (jeśli dołączona), cel |
| Rozmowa z asystentem | wysłanie wiadomości jest jawną akcją użytkownika | treść widoczna w polu przed wysłaniem |

Anulowanie okna **nie wysyła niczego** i nie zużywa budżetu AI. Zgoda nie jest zapamiętywana między sesjami.

## Prompt injection w dokumentach

Dokument jest **niezaufaną treścią**, nigdy instrukcją:

- `LETTER_SYSTEM` zakazuje wykonywania poleceń z pisma, korzystania z wiedzy zewnętrznej i uzupełniania brakujących danych;
- treść pisma trafia wyłącznie w wiadomości użytkownika jako `{"document_text": …}` — nigdy do promptu systemowego;
- odpowiedź modelu przechodzi przez `validate_letter_result`: każde twierdzenie musi mieć `source` będące **dosłownym cytatem** z dokumentu; wpisy bez cytatu są odrzucane;
- termin jest przyjmowany tylko wtedy, gdy cytat zawiera jawną datę lub okres.

Testy red-team: `tests/test_security.py::PromptInjectionTest` — dokumenty z poleceniami „IGNORUJ POPRZEDNIE INSTRUKCJE", tekstem zerowej szerokości (`\u200b`), komentarzami HTML udającymi `system:`, sekcją `SYSTEM:` w treści, znakami homoglifowymi (cyrylica `і`) oraz próbą wycieku PESEL. Test sprawdza, że system prompt się nie zmienia, dokument pozostaje w wiadomości użytkownika, a twierdzenia bez cytatu nie trafiają do wyniku.

Ograniczenie: to warstwa obrony w kodzie i testach, nie gwarancja. Model może zinterpretować tekst inaczej, niż zakłada autor pisma; dlatego interfejs zawsze pokazuje cytaty źródłowe.

## Zależności i audyt

| Obszar | Stan |
|---|---|
| npm | `npm audit` — **0 podatności** (0 low/moderate/high/critical) |
| Python | serwer używa wyłącznie biblioteki standardowej; brak `pip install` w `Dockerfile`; `requirements.txt` jest pusty i służy audytowi |
| Obraz kontenera | `python:3-slim` — tag ruchomy; do produkcji przypnij digestem `@sha256:…` |
| GitHub Actions | `npm audit --audit-level=moderate` + `pip-audit` w jobie `audit` w `.github/workflows/test.yml` |
| Dependabot | `.github/dependabot.yml` — npm, pip, github-actions, docker, co tydzień |
| Python w CI | 3.12; lokalnie sprawdzone 3.14 |

Do zrobienia przed produkcją: przypiąć obraz kontenera digestem, włączyć alerty Dependabota i wymusić blokadę merge przy nieudanym audycie.

## Ryzyka, których prototyp nie rozwiązuje

- brak uwierzytelnienia, autoryzacji, zarządzania sesją i ochrony CSRF (limity żądań są, ale domyślnie wyłączone — patrz `docs/BACKEND-API.md`);
- zgoda przed wysłaniem do AI jest realizowana w interfejsie (`window.confirm` + checkbox), a nie jako podpisany, audytowalny rekord po stronie serwera;
- token znaku ma małą przestrzeń wartości i jest tylko mechanizmem demonstracyjnym;
- brak trwałej transakcji, idempotencji, kryptograficznego podpisu i audytu przekazań;
- przechowywanie lokalne bez izolacji per użytkownik i bez polityki retencji;
- brak gwarancji poprawności, aktualności ani źródłowej wiarygodności generatywnej AI;
- usługi mapowe, fonty, modele i mowa są zależne od stron trzecich i sieci;
- automatyczna sanitacja i testy nie są pełnym audytem bezpieczeństwa.

## Minimalne wymagania przed produkcją

Wdrożenie wymagałoby co najmniej: przeglądu zagrożeń i prywatności, uwierzytelniania i autoryzacji po stronie serwera, kontroli dostępu per zasób, krótkotrwałych podpisanych tokenów, ochrony CSRF/CSP i nagłówków, szyfrowania transportu, rate limiting, monitoringu bez niepotrzebnych treści, retencji i kasowania danych, bezpiecznego przechowywania sekretów, audytu operacyjnego, procedury incydentów, weryfikacji dostawców oraz testów penetracyjnych. Przypadki urzędowe wymagałyby dodatkowego potwierdzenia prawnego i właścicieli usług.
