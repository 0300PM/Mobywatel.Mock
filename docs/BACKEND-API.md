# Serwer i API

## Serwer HTTP

`serwer/server.py` uruchamia `ThreadingHTTPServer` i obsługuje pliki statyczne z `mockup/`. Domyślnie nasłuchuje na `127.0.0.1:8790`; parametry procesu lub zmienne `HOST` i `PORT` zmieniają adres. Testy Playwright uruchamiają osobny proces na 8792. Odpowiedzi API są zwykle JSON z `Cache-Control: no-store`; pliki statyczne mają `Cache-Control: no-cache`.

Nie ma routingu przez framework ani wspólnego schematu OpenAPI. Poniższy opis odzwierciedla ręczne rozgałęzienia w `H.do_GET` i `H.do_POST`; przy zmianie trasy należy zaktualizować tę dokumentację i testy.

## Strony i pliki statyczne

| Żądanie | Zachowanie |
|---|---|
| `GET /`, `/aplikacja`, `/aplikacja/` | Serwuje `index.html`. |
| `GET /komputer` | Serwuje `komputer.html`. |
| `GET /<język>/aplikacja` lub `/<język>/komputer` | Usuwa obsługiwany prefiks języka i serwuje odpowiedni ekran. |
| `GET /api/i18n.js?lang=xx` | Zwraca skrypt inicjalizujący słownik języka. Dla polskiego albo nieobsługiwanego języka słownik może być pusty. |
| `GET /api/i18n?lang=xx` | Zwraca obiekt języka i tłumaczeń. |

## Endpointy GET

| Endpoint | Cel i wynik |
|---|---|
| `/api/health` | Informacje o wybranym dostawcy (`provider`), dostępności rozmowy i mowy, modelu, limicie czasu oraz `lmstudio_id` — identyfikator serwera LM Studio **albo workera Cloudflare**, do którego przypisany jest wybór modelu. Przy `PROVIDER=workers` pole `model` to `CLOUDFLARE_WORKERS_MODEL`, a `timeout` to `CLOUDFLARE_WORKERS_TIMEOUT`. Nie jest testem tożsamości ani dostępności usługi urzędowej. |
| `/api/lmstudio/models` | Lista modeli dla wybranego dostawcy lokalnego/chmurowego: przy `PROVIDER=lmstudio` pyta LM Studio, przy `PROVIDER=workers` pyta worker Cloudflare (`GET <CLOUDFLARE_WORKERS_URL>/models`). Zwraca `{models, model}`. Przy innym dostawcy 404, przy błędzie upstream 502 z komunikatem dopasowanym do dostawcy. |
| `/v1/models` | Opcjonalne przekazanie do endpointu modeli LM Studio, jeśli `LM_STUDIO_OPENAI_PROXY=1`. W przeciwnym razie przekazanie jest zablokowane. |
| `/api/znak/kto?t=…&dev=…` | Sprawdza, czy token wskazuje inne aktywne urządzenie, i oznacza skan w krótkotrwałej pamięci procesu. Zwraca identyfikator urządzenia, typ, deklarowany cel i zakres, jeżeli token jest aktualny. Token nie uwierzytelnia osoby. |

## Endpointy POST

Żądania JSON używają `Content-Type: application/json`, chyba że endpoint przyjmuje audio lub proxy. Błędy walidacji zwykle mają kod 400, za duże żądanie 413, niedostępny dostawca 503 lub błąd upstream 502. Treści błędów nie są kontraktem stabilnym dla klientów zewnętrznych.

| Endpoint | Wejście i zachowanie | Ograniczenia |
|---|---|---|
| `/api/agent` | `{messages:[{role,content},…], conv?, model?, lang?}`. Serwer przyjmuje historię `user`/`assistant`, wywołuje skonfigurowanego modela i zwraca `{messages, stan, events, czeka}`. | Maks. 80 kB body, 1–60 wpisów, treść każdej wiadomości 1–6000 znaków, ostatni wpis musi być `user`. Żądanie nie wykonuje sprawy urzędowej; pole `confirm` jest odrzucane. Dla LM Studio model musi być prawidłowym identyfikatorem; przy `PROVIDER=workers` pole `model` (do 256 znaków) jest przekazywane do workera, a jego brak oznacza użycie `CLOUDFLARE_WORKERS_MODEL`. |
| `/api/safety/assist` | `{task,threat,description,immediateDanger,location,shareLocation,profile,checked,missing,model,lang}`; zwraca `{result:{actions,checklist,avoid,call_emergency}}` po wywołaniu skonfigurowanego dostawcy modelu. | Body do 12 kB; opis do 1500 znaków, lokalizacja do 100 i tylko po zgodzie, profil z allowlisty bez danych medycznych, scenariusz/checklista z lokalnego allowlistu. Bezpośrednie zagrożenie zwraca 409 bez wywołania modelu; brak dostawcy 503, błąd modelu/formatu 502. Nawigacja i narzędzia są wyłączone. |
| `/api/letter/extract` | `{filename,data}` z base64 pliku albo `{text}`. Zwraca `{text}` po odczycie, bez wywoływania modelu. | Body do 6 MiB; plik TXT lub PDF maks. 4 MiB; TXT UTF-8; PDF musi zawierać dostępną warstwę tekstową; wynik do 30 000 znaków. Brak OCR. |
| `/api/letter/explain` | Przyjmuje ten sam format tekstu/pliku co odczyt, ale wywołuje model i zwraca `{result}` po walidacji cytatów. | Wymaga aktywnego dostawcy i poprawnego modelu. Cytaty muszą dokładnie występować w źródle; do 12 poprawnych pozycji w listach akcji i dokumentów; deadline jest odrzucany, jeśli cytat nie zawiera rozpoznawalnej daty/okresu zgodnego z tekstem wyniku. To walidacja formatowania i powiązania, nie faktów prawnych. |
| `/api/i18n/brak` | `{lang,teksty}` dla brakujących tekstów UI; zwraca dostępne tłumaczenia. | Body maks. 60 kB, do 150 tekstów po maks. 700 znaków. Braki są rejestrowane; brak automatycznego tłumaczenia w tym endpointcie. |
| `/api/znak/beat` | `{dev,token,kind,kto,cel,zakres}` rejestruje obecność urządzenia, aktualizuje token oraz odbiera oczekujące demonstracyjne przekazania. Zwraca `otrzymane`, `skanuje`, ewentualnie `zmien`. | Token jest 16-bitowym żetonem makiety, nie sekretem kryptograficznym. Dane przechowywane są w pamięci procesu; stare wpisy wygasają. |
| `/api/znak/przekaz` | `{to,from,ok,dane?}` umieszcza wynik zaakceptowany/odrzucony w pamięci urządzenia odbiorczego. Akceptacja zawiera przykładowe dane i zaznaczone pola. | Body do 20 kB. Brak uwierzytelnienia nadawcy, podpisu, sprawdzenia zakresu lub weryfikacji zgody; wyłącznie test demonstracyjny. |
| `/api/stt?lang=xx` | Surowe bajty nagrania wraz z `Content-Type`; zwraca `{text}`. Próbuje ElevenLabs, a po błędzie może użyć OpenAI. | Wymaga skonfigurowanego klucza i nie jest dostępne po pliku blokady. Nagranie trafia do dostawcy mowy. Limit/timeout zależy od użytego dostawcy i transportu; nie wysyłaj danych wrażliwych. |
| `/api/tts` | `{text,lang}`; zwraca audio MPEG. Próbuje ElevenLabs, potem OpenAI. Cache jest tylko w pamięci procesu. | Tekst ograniczany przez funkcję syntezy do 3500 znaków; wymaga dostawcy mowy i braku blokady. |
| `/api/glos` | Odbiera diagnostykę problemu z głosem i zapisuje wybrane pola do logu. Zwraca `{ok:true}`. | Do parsowania używa pierwszych 2 kB treści, ale obecna implementacja odczytuje wcześniej całe zadeklarowane body; to nie jest limit rozmiaru żądania. Nie wysyłaj sekretów ani danych osobowych. Log nie jest dziennikiem audytowym. |
| `/v1/models`, `/v1/responses`, `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings` | Przy `PROVIDER=lmstudio` i `LM_STUDIO_OPENAI_PROXY=1` serwer przekazuje obsługiwane żądania do skonfigurowanego LM Studio. | Proxy jest domyślnie wyłączone i nie ma uwierzytelniania. POST wymaga `Content-Length`, limit 16 MiB. Nie wystawiaj do niezaufanej sieci. |

Dla proxy endpointów POST dozwolone są dokładnie metody i ścieżki z `serwer/lmstudio.py`. Ustawienie proxy oznacza udostępnienie zasobów lokalnego modelu każdemu, kto dosięga aplikacji.

## Dostawca `PROVIDER=workers` (Cloudflare)

Serwer nie implementuje osobnego protokołu dla Cloudflare: rozmowa i lista modeli używają tego samego kodu co LM Studio
(`serwer/lmstudio.py` + `zgodny()` w `serwer/agent.py`), a adres jest normalizowany przez `lmstudio.base_url`.

| Element | Zachowanie |
|---|---|
| Adres | `CLOUDFLARE_WORKERS_URL`, np. `https://mobywatels-workers-ai.<subdomena>.workers.dev/v1`. Można podać z `/v1`, bez niego albo jako pełny adres `.../v1/chat/completions`; reszta ścieżki jest ucinana. Adres musi być `http`/`https`, bez danych logowania, zapytania i fragmentu. |
| Token | `CLOUDFLARE_WORKERS_TOKEN` wysyłany jako `Authorization: Bearer`. Pusta wartość oznacza brak nagłówka; wartość `bez-klucza` jest traktowana jak brak tokenu. Token nigdy nie jest zwracany w odpowiedziach API. |
| Model | `CLOUDFLARE_WORKERS_MODEL` jako domyślny, `model` z żądania ma pierwszeństwo. Brak obu → `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. |
| Limit czasu | `CLOUDFLARE_WORKERS_TIMEOUT` (1–600 s, domyślnie 120). |
| Nagłówki | `Accept`, `Content-Type` oraz własny `User-Agent` (`lmstudio.USER_AGENT`). Cloudflare odrzuca domyślny `Python-urllib` błędem `1010 Access denied` — objaw to 403 bez treści od workera. |
| Odpowiedzi | Worker zwraca `{id, object, model, choices:[{message:{role,content}}], usage}`; serwer wycina bloki `<think>…</think>` i mapuje `tool_calls`, jeśli worker je zwróci. |
| Błędy | Mapowanie na komunikaty z `lmstudio.WORKER_MESSAGES` (nie wspominają LM Studio): brak adresu → 503 przy `/api/agent` i 502 z nazwą zmiennej przy liście modeli; brak połączenia → 502 „Nie udało się połączyć z workerem Cloudflare…”; 401/403 → 502 „Worker Cloudflare odrzucił dostęp…”; limit planu (403 z Workers AI) trafia do komunikatu o odrzuconym żądaniu. |
| Blokada lokalna | Plik `serwer/BLOKADA` wyłącza dostawcę tak samo jak pozostałych. |

Worker (`cloudflare-worker/`) jest wdrażany osobno przez `wrangler deploy`. Jego sekrety (`CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, opcjonalny `WORKER_TOKEN`) **nie są** zmiennymi serwera aplikacji — mieszanie ich powoduje
401, bo aplikacja wysyła `CLOUDFLARE_WORKERS_TOKEN` jako token wejściowy workera.

Znane ograniczenia: Workers AI nie zwraca `tool_calls`, więc odpowiedzi są czystym tekstem; `events` zawiera wtedy
tylko `text`. Karty, akcje i nawigacja wymagają `PROVIDER=lmstudio`, `zgodny`, `anthropic` albo `openai`.

## Przechowywanie i logowanie

- Tokeny i kolejka znaku są w pamięci procesu; restart serwera je usuwa. Stan jest współdzielony pomiędzy wątkami jednego procesu przez blokadę, ale nie jest replikowany między procesami.
- Tłumaczenie tekstu, rozmowa, STT i wyjaśnianie pisma mogą logować metadane; log rozmowy zawiera zdarzenia, a STT zapisuje rozpoznany tekst. Szczegóły zależą od gałęzi obsługi i dostawcy.
- Plik PDF/TXT w funkcji tłumacza nie jest celowo zapisywany na dysku przez endpoint, ale treść wyjaśnienia jest wysyłana do skonfigurowanego modelu. Nie traktuj tej funkcji jako bezpiecznego repozytorium dokumentów.
- `safety.py` waliduje i wysyła do skonfigurowanego modelu jedynie opis, wybrany scenariusz, nieczułe potrzeby i lokalizację udostępnioną przez użytkownika. Nie ma pola dla obrazu; callback logujący treść rozmowy jest wyłączony. Lokalna biblioteka źródeł ogranicza prompt, ale nie zapewnia weryfikacji faktów ani alertów w czasie rzeczywistym.
- Nie ma ogólnego mechanizmu ograniczania liczby żądań ani uwierzytelniania użytkowników. Konfigurację sieci i dostęp do kluczy trzeba chronić poza tym prototypem.

## Błędy i diagnostyka

Serwer zwraca status HTTP i zwięzły komunikat JSON dla zwykłych błędów walidacji. Błąd nie powinien być przedstawiany jako sukces ani uruchamiać scenariusza zastępczego. Techniczne szczegóły wyjątków mogą trafić do lokalnego logu; należy go chronić i usuwać zgodnie z lokalnymi zasadami. Pełne instrukcje konfiguracji dostawców są w głównym [README](../README.md).
