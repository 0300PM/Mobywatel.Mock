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
- **Log:** `serwer/agent.log` może zawierać metadane, treść rozpoznaną z mowy i wybrane informacje o błędach. Chroń go jak dane potencjalnie wrażliwe i usuwaj świadomie.

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
- `LM_STUDIO_OPENAI_PROXY=1` udostępnia endpointy modelu przez serwer aplikacji bez wbudowanego uwierzytelniania. Pozostaw wyłączone, chyba że sieć jest zaufana i kontrolowana.
- Serwer w Dockerze nie powinien być publikowany publicznie bez warstwy autoryzacji, limitowania, zapory i ochrony transportu.

## Ryzyka, których prototyp nie rozwiązuje

- brak uwierzytelnienia, autoryzacji, zarządzania sesją, CSRF, limitów żądań i ochrony przed nadużyciami;
- token znaku ma małą przestrzeń wartości i jest tylko mechanizmem demonstracyjnym;
- brak trwałej transakcji, idempotencji, kryptograficznego podpisu i audytu przekazań;
- przechowywanie lokalne bez izolacji per użytkownik i bez polityki retencji;
- brak gwarancji poprawności, aktualności ani źródłowej wiarygodności generatywnej AI;
- usługi mapowe, fonty, modele i mowa są zależne od stron trzecich i sieci;
- automatyczna sanitacja i testy nie są pełnym audytem bezpieczeństwa.

## Minimalne wymagania przed produkcją

Wdrożenie wymagałoby co najmniej: przeglądu zagrożeń i prywatności, uwierzytelniania i autoryzacji po stronie serwera, kontroli dostępu per zasób, krótkotrwałych podpisanych tokenów, ochrony CSRF/CSP i nagłówków, szyfrowania transportu, rate limiting, monitoringu bez niepotrzebnych treści, retencji i kasowania danych, bezpiecznego przechowywania sekretów, audytu operacyjnego, procedury incydentów, weryfikacji dostawców oraz testów penetracyjnych. Przypadki urzędowe wymagałyby dodatkowego potwierdzenia prawnego i właścicieli usług.
