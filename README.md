# mObywatel.ai: pełna wersja prototypu do uruchomienia u siebie

To nieoficjalny prototyp z przykładowymi dokumentami, rzeczywistą rozmową z podłączonym modelem AI i mapą danych OpenStreetMap. Jeśli model nie jest skonfigurowany lub połączenie zawiedzie, asystent zgłasza błąd i nie uruchamia fikcyjnych scenariuszy.

**Ważne:** asystent służy wyłącznie do rozmowy i informacji. Nie jest urzędem, nie ma dostępu do rejestrów ani integracji pozwalającej wysłać wniosek, wykonać płatność, zmienić dane czy ustawić powiadomienie. Sam klucz modelu nie daje takich uprawnień. Odpowiedzi AI mogą być błędne lub nieaktualne; ważne informacje należy sprawdzić w oficjalnym źródle.

Osoby, dokumenty, terminy i inne dane prezentowane w prototypie są fikcyjne. To nie jest oficjalna aplikacja mObywatel. Nie wpisuj prawdziwych danych osobowych, haseł, danych logowania ani kodów. Mapa natomiast pobiera publiczne dane OpenStreetMap po wyszukaniu miejsca; ich kompletność i aktualność nie są gwarantowane.

## Co jest w paczce

- `serwer/`: serwer HTTP w Pythonie (sama biblioteka standardowa, bez `pip install`), połączenie z modelem oraz wcześniejsze moduły demonstracyjne. API rozmowy nie udostępnia modelowi narzędzi symulujących czynności urzędowe.
  - `serwer/i18n/`: słowniki interfejsu (15 języków poza polskim),
  - `serwer/glosariusz/`: słowniczek dla tłumaczenia rozmowy z asystentem,
  - `serwer/wiedza/`: wcześniejsza kopia kart usług gov.pl; nie jest obecnie podłączana do rozmowy AI.
- `mockup/`: front aplikacji (HTML, CSS, JavaScript, grafiki); zawiera też demonstracyjny tłumacz pism oraz lokalne centrum zadań rodzinnych.
- `tests/`, `playwright.config.js`: testy zachowania, bezpieczeństwa i wybrane automatyczne kontrole dostępności.
- `docs/`: wieloplikowa dokumentacja architektury, technologii, frontendu, API, UI/UX, prywatności i testów — [spis dokumentów](docs/README.md).
- `Dockerfile`, `docker-compose.yml`, `.env.example`.

## Wymagania

- Python 3.9 lub nowszy (Linux, macOS albo Windows), bez dodatkowych bibliotek, albo Docker.
- Przeglądarka. Opcjonalne dyktowanie wymaga dostępu do mikrofonu w bezpiecznym kontekście (`localhost`/`127.0.0.1` albo HTTPS). Ręczne wpisywanie nie wymaga mikrofonu.
- Dla dostawców chmurowych: klucze API (patrz niżej); wywołania mogą być płatne. LM Studio może działać lokalnie bez klucza, jeśli nie włączono uwierzytelniania.

## Klucze API: co jest obowiązkowe, a co opcjonalne

| Zmienna | Czy potrzebna | Do czego |
|---|---|---|
| `OPENAI_API_KEY` | wymagana dla domyślnego dostawcy AI | rozmowa (`PROVIDER=openai`), serwerowe rozpoznawanie i synteza mowy |
| `ELEVENLABS_API_KEY` | opcjonalna | lepszy polski głos i rozpoznawanie mowy; bez klucza albo po błędzie serwer używa OpenAI |
| `ANTHROPIC_API_KEY` | opcjonalna | asystent na modelu Claude (`PROVIDER=anthropic`) |
| `MODEL_API_KEY` | opcjonalna | klucz do API zgodnego z OpenAI (`PROVIDER=zgodny`), jeśli serwer modelu go wymaga |
| `LM_STUDIO_API_KEY` | opcjonalna | token serwera LM Studio (`PROVIDER=lmstudio`), jeśli włączono w nim uwierzytelnianie |
| `CLOUDFLARE_WORKERS_URL` | wymagana dla `PROVIDER=workers` | adres wdrożonego workera, np. `https://mobywatels-workers-ai.<subdomena>.workers.dev/v1` |
| `CLOUDFLARE_WORKERS_TOKEN` | opcjonalna | token wejściowy workera — ten sam ciąg co sekret `WORKER_TOKEN` w workerze; pusta wartość oznacza brak nagłówka |

Co działa bez kluczy:

- **Bez konfiguracji dostawcy modelu**: można korzystać z przykładowych dokumentów, ustawień i mapy oraz pisać szkic. Asystent zgłasza niedostępność; nie wykonuje ani nie symuluje czynności. Rozpoznawanie i odczyt mogą działać przez funkcje przeglądarki, jeśli są dostępne.
- **Tylko `OPENAI_API_KEY`**: po poprawnym połączeniu działa rozmowa z modelem oraz mogą działać serwerowe usługi mowy. To nie jest integracja z urzędem.
- **Tylko `ANTHROPIC_API_KEY` z `PROVIDER=anthropic`**: po poprawnym połączeniu działa rozmowa; serwerowe usługi mowy wymagają osobnego dostawcy. Funkcje mowy przeglądarki mogą działać niezależnie.
- **LM Studio (`PROVIDER=lmstudio`)**: rozmowa korzysta z serwera LM Studio; klucz jest potrzebny tylko, jeśli włączono w nim uwierzytelnianie. Wybór modelu i test połączenia opisano niżej.
- **Model zgodny z OpenAI (`PROVIDER=zgodny`)**: rozmowa wymaga rzeczywiście działającego serwera modelu i jego klucza, jeśli ten serwer go wymaga. O dostępności mowy decydują przeglądarka i dodatkowe klucze.
- **Cloudflare Workers AI (`PROVIDER=workers`)**: rozmowa idzie przez wdrożonego workera (`cloudflare-worker/`); klucz OpenAI nie jest potrzebny. Bez `CLOUDFLARE_WORKERS_URL` asystent jest niedostępny i zgłasza brak adresu. Workers AI nie wywołuje narzędzi aplikacji, więc odpowiedzi są tylko tekstem.

Na macOS, gdy zmiennej nie ma, serwer próbuje jeszcze odczytać klucz z pęku kluczy (pozycje `openai_api_key`,
`elevenlabs_api_key`, `anthropic_api_key`). Na Linuksie i w Dockerze liczą się tylko zmienne środowiskowe.

## Ułatwienia dostępu i profil seniora

Na ekranie głównym przełącznik „Dla seniora” włącza początkowo duży tekst, uproszczone menu i ograniczenie ruchu. W panelu „Ułatwienia dostępu” można osobno wybrać standardową, dużą lub bardzo dużą czcionkę, kontrast, uproszczone menu, ograniczenie animacji i przyciski odczytu instrukcji. Każdą opcję można zmienić niezależnie, także przy aktywnym profilu. Przycisk odczytu nie uruchamia dźwięku bez wyboru użytkownika.

Ustawienia obu profilów są oddzielnie zapisywane w `localStorage` przeglądarki. Wyłączenie profilu przywraca wcześniejsze ustawienia poza nim, a ponowne włączenie zachowuje jego indywidualne zmiany. Zmiana profilu nie przeładowuje strony ani nie usuwa bieżącej rozmowy lub szkicu. Jeżeli pamięć przeglądarki jest zablokowana lub zostanie wyczyszczona, ustawienia nie przetrwają zamknięcia strony. Systemowe `prefers-reduced-motion` działa niezależnie od przełącznika.

## Tłumacz pism urzędowych i centrum rodzinne

Oba moduły są dostępne z ekranu głównego w sekcji „Więcej funkcji”. Nie zmieniają istniejących symulacji dokumentów, rozmowy ani przypomnień.

### Tłumacz pism

- Przyjmuje pliki TXT UTF-8 i PDF z warstwą tekstową (do 4 MiB), a także tekst wklejony ręcznie. Skanów i zdjęć nie obsługuje, OCR nie jest dostępny.
- Plik jest odczytywany przez serwer projektu wyłącznie na żądanie, nie jest zapisywany na dysku przez tę funkcję ani wpisywany do dziennika. Zanim wyślesz tekst do modelu, możesz go przejrzeć i usunąć dane osobowe. Wysłanie wymaga osobnego zaznaczenia zgody.
- Model ma przedstawić znaczenie, kroki, termin i dokumenty, przytaczając dosłowne fragmenty źródłowego tekstu. Serwer odrzuca cytaty nieobecne w tekście i nie pokazuje terminu bez daty lub okresu w cytacie. Brak terminu lub kroku jest jawnie oznaczany; to ogranicza, ale nie eliminuje błędów modelu.
- Treść wyjaśnienia jest wysyłana do skonfigurowanego dostawcy modelu. Dalsze przetwarzanie i retencja zależą od jego warunków. Prototyp nie weryfikuje autentyczności pisma, nie potwierdza prawa ani aktualności procedury. Porównaj wyjaśnienie z oryginałem i potwierdź istotne obowiązki w urzędzie.

### Bezpieczne centrum rodzinne

- Pozwala utworzyć lokalną listę przykładowych osób z rolami administratora, członka i czytelnika, przełączyć demonstracyjny widok, dodać zadanie prywatne lub widoczne na wspólnej liście oraz zarządzać rolami.
- Zadania prywatne są rozdzielone według właściciela w widoku aplikacji; wspólne pozycje pokazują się osobom z listy. Czytelnik nie może dodawać ani usuwać zadań.
- Lista osób i zadania są przechowywane wyłącznie w `localStorage` tej przeglądarki. Nie ma synchronizacji, logowania, zaproszeń, weryfikacji uprawnień, powiadomień ani dostępu do dokumentów, skrzynek czy kont innych osób. Role po stronie przeglądarki są tylko demonstracją, nie zabezpieczeniem przed użytkownikiem urządzenia.
- Prawdziwe współdzielenie wymagałoby serwerowej kontroli tożsamości, zgody, relacji i zakresów dostępu, audytu oraz zabezpieczeń danych. Samo bycie rodziną nie może automatycznie otworzyć cudzych dokumentów.

## Bezpieczny Obywatel

Nowy panel mobile-first udostępnia jawnie ogólne, dwujęzyczne poradniki na wypadek powodzi, pożaru, awarii prądu, ekstremalnej pogody, gazu, wypadku, zagrożenia publicznego, skażenia chemicznego, ewakuacji i awarii wody. Każdy scenariusz ma kroki, checklistę, częste błędy i odnośniki do oficjalnych źródeł. Link 112 wymaga świadomego kliknięcia; aplikacja nie dzwoni ani nie zgłasza zdarzeń automatycznie. „Bieżący status” jest oznaczony jako nieznany — brak integracji z alertami RCB/IMGW i brak symulowanych ostrzeżeń.

Profil potrzeb i plecak ewakuacyjny są opcjonalne i zapisywane wyłącznie w lokalnej przeglądarce. Tryb awaryjny oferuje duży tekst, wysoki kontrast i ograniczone animacje. Service Worker może udostępnić uprzednio pobrane statyczne instrukcje offline; AI i bieżące alerty offline nie działają. Asystent AI jest dodatkowy i wykorzystuje skonfigurowanego dostawcę. Lokalizację można dołączyć tylko po osobnej zgodzie; wybrane zdjęcie jest jedynie lokalnym podglądem, nie jest wysyłane ani analizowane. Moduł nie zastępuje służb ani pomocy medycznej. Szczegóły i ograniczenia: [dokumentacja modułu](docs/SAFETY-MODULE.md).

## Mapa placówek

Mapa korzysta z publicznych usług OpenStreetMap bez klucza: Nominatim wyszukuje wpisane miejsce w Polsce, Overpass pobiera oznaczone placówki w promieniu około 6 km, a serwer kafelków wyświetla mapę. Widać maksymalnie 200 najbliższych znalezionych obiektów; zasięg, klasyfikacja i kompletność zależą od danych społeczności. Mapa i lista obejmują m.in. urzędy miast i gmin, starostwa, urzędy skarbowe, ZUS, punkty paszportowe i obsługi mieszkańców, apteki, przychodnie, szpitale, policję, ARiMR, zarządy dróg wojewódzkich oraz bankomaty.

Wybór sprawy podpowiada rodzaj placówki, a filtry działają na już pobranych wynikach. Godziny otwarcia są pokazywane w zapisie OSM, dostępność architektoniczna i kontakt wyłącznie wtedy, gdy istnieją w danych. Braki są oznaczane, a dojazd otwiera OpenStreetMap. W razie niedostępności danych aplikacja nie podstawia fikcyjnych placówek; gdy nie uda się pobrać samych kafelków, pozostaje lista. Mapa obsługuje klawiaturę, przyciski powiększenia i wybór z listy.

Wyszukanie wysyła wpisaną miejscowość do Nominatim i otrzymane współrzędne do Overpass bezpośrednio z przeglądarki. „Użyj mojej lokalizacji” wymaga zgody przeglądarki i przesyła współrzędne do Overpass. Usługi mapowe i kafelkowe widzą adres IP przeglądarki; zewnętrzny link dojazdu otwiera OpenStreetMap. Dostęp do tych usług może być ograniczony przez sieć, limity lub polityki zewnętrznych dostawców. Dane: © współtwórcy [OpenStreetMap](https://www.openstreetmap.org/copyright).

## Pomoc, głos i bezpieczeństwo

- W sekcji „Pomoc i dostępność” można wpisać wiadomość lub wybrać „Powiedz, czego potrzebujesz”. Rozpoznany tekst pozostaje edytowalny; można go przenieść do pola wiadomości albo świadomie wybrać „Wyślij do asystenta”. Nic nie jest wysyłane automatycznie. Gdy rozpoznawanie jest niedostępne albo odmówiono dostępu do mikrofonu, można nadal pisać.
- „Przeczytaj instrukcję” i „Przeczytaj ostatnią odpowiedź” mają kontrolki zatrzymania i ponownego odczytu. Jakość i dostępność funkcji przeglądarki lub serwera zależy od środowiska; nagranie może trafić do dostawcy rozpoznawania mowy.
- „Co to znaczy?” wyjaśnia m.in. wniosek, pełnomocnictwo i termin ważności. „Potrzebuję pomocy bliskiej osoby” opisuje wsparcie za zgodą, bez automatycznego udostępniania dokumentów, loginów czy kodów.
- „Wstecz” pozwala wrócić i poprawić szkic. Historia i szkice rozmowy są przechowywane w pamięci strony, nie po odświeżeniu. Nie ma aktywnego formularza wykonującego czynności urzędowe; ewentualna przyszła integracja wymagałaby osobnego przeglądu danych, konsekwencji i potwierdzenia.
- Karty przypomnień i terminy są przykładowe. Prototyp **nie planuje ani nie wysyła rzeczywistych powiadomień**. Przed demonstracyjnym transferem podsumowanie „Co mogę udostępnić?” pokazuje niezweryfikowany cel, prośbę o dane, możliwość ich odznaczenia i skutki. To statyczna symulacja AI, nie prawdziwa analiza, zgoda ani weryfikacja tożsamości. Po kliknięciu „Potwierdź w symulacji” na drugie urządzenie trafiają wybrane fikcyjne dane.
- „Czy to bezpieczne?” rozróżnia informację, rekomendację i potrzebę oficjalnego potwierdzenia. Asystent może się mylić, nie jest urzędem ani gwarancją poprawności prawnej. Nigdy nie wpisuj prawdziwych danych, haseł ani kodów.

## Uruchomienie lokalne

```bash
export OPENAI_API_KEY="..."
python3 serwer/server.py             # albo: python3 serwer/server.py 8080
```

Otwórz http://127.0.0.1:8790/aplikacja (adres `/` też pokazuje aplikację, `/komputer` to ekran „komputera” do przekazywania danych znakiem).

Możesz też trzymać ustawienia w pliku: `cp .env.example .env`, uzupełnij i uruchom `set -a; . ./.env; set +a; python3 serwer/server.py`.

## Uruchomienie w Dockerze

```bash
cp .env.example .env
docker compose up --build
```

Compose domyślnie łączy kontener z LM Studio na hoście pod `host.docker.internal:8791/v1` i wybiera model `google/gemma-4-12b` (wartości z podanego ekranu „API Usage”). Adres aplikacji to http://127.0.0.1:8790/aplikacja. Ustawienia można nadpisać w `.env`, np. dla innego modelu. Bez Compose można uruchomić kontener standardowo: `docker build -t mobywatel-ai . && docker run --rm --env-file .env -p 127.0.0.1:8790:8790 mobywatel-ai`. Dla LM Studio dodaj do `docker run` zmienne `PROVIDER=lmstudio`, `LM_STUDIO_BASE_URL=http://host.docker.internal:8791/v1` i `LM_STUDIO_MODEL=google/gemma-4-12b`; na Linuksie dodaj też `--add-host=host.docker.internal:host-gateway`.

## Ustawienia (zmienne środowiskowe)

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `PROVIDER` | `openai` | dostawca modelu rozmowy: `openai`, `anthropic`, `zgodny`, `lmstudio` albo `workers`. To jeden przełącznik: `lmstudio` = lokalny serwer, `workers` = Cloudflare Workers AI |
| `OPENAI_MODEL` | `gpt-4o-mini` | model asystenta przy `PROVIDER=openai` (API Responses) |
| `OPENAI_TIER`, `OPENAI_EFFORT` | nieustawione | poziom usługi i wysiłek rozumowania; gdy konto ich nie obsługuje, serwer ponawia zapytanie bez nich |
| `CLOUDFLARE_WORKERS_URL` | pusty | adres workera, np. `https://mobywatels-workers-ai.twoj-subdomen.workers.dev/v1`; patrz `cloudflare-worker/README.md` |
| `CLOUDFLARE_WORKERS_TOKEN` | pusty | sekret `WORKER_TOKEN` ustawiony w workerze; wysyłany jako `Bearer`, tylko po stronie serwera |
| `CLOUDFLARE_WORKERS_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | domyślny model; można go też wybrać w aplikacji |
| `CLOUDFLARE_WORKERS_TIMEOUT` | `120` | limit oczekiwania na odpowiedź workera w sekundach (1–600) |
| `MODEL` | | model asystenta przy `PROVIDER=zgodny`, alternatywny domyślny model LM Studio albo pierwszy model do wypróbowania przy `PROVIDER=anthropic` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | adres API zgodnego z OpenAI przy `PROVIDER=zgodny` |
| `MODEL_MAX_TOKENS` | `1500` | limit długości odpowiedzi dla `PROVIDER=zgodny` i `PROVIDER=lmstudio` |
| `MODEL_TIMEOUT` | `120` | czas oczekiwania (s) przy `PROVIDER=zgodny`; rozmowa informacyjna ogranicza pojedyncze oczekiwanie do 60 s |
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` poza Compose; Compose: `http://host.docker.internal:8791/v1` | adres LM Studio widoczny **z serwera aplikacji**, bez tokenu w adresie |
| `LM_STUDIO_MODEL` | pusty poza Compose; Compose: `google/gemma-4-12b` | domyślny identyfikator modelu LM Studio; można go też wybrać w aplikacji |
| `LM_STUDIO_TIMEOUT` | `180` | limit oczekiwania na odpowiedź LM Studio w sekundach (1–600) |
| `LM_STUDIO_OPENAI_PROXY` | wyłączone | `1` włącza nieautoryzowane przekazywanie pięciu endpointów `/v1/*` do LM Studio; patrz ostrzeżenie niżej |
| `TLUMACZ_MODEL` | `gpt-6-luna` | model OpenAI używany przez starsze funkcje tłumaczenia |
| `STT_MODEL`, `TTS_MODEL`, `TTS_VOICE` | `gpt-4o-mini-transcribe`, `gpt-4o-mini-tts`, `coral` | mowa przez OpenAI |
| `EL_VOICE`, `EL_TTS_MODEL`, `EL_STT_MODEL` | głos z biblioteki ElevenLabs, `eleven_flash_v2_5`, `scribe_v2` | mowa przez ElevenLabs; wybrany głos może wymagać płatnego planu, wtedy ustaw własny `EL_VOICE` |
| `HOST`, `PORT` | `127.0.0.1`, `8790` | adres i port serwera (w Dockerze `HOST=0.0.0.0`) |
| `AGENT_LOG` | `serwer/agent.log` | plik dziennika |

Nazwy modeli mogą się zmieniać u dostawców: jeśli domyślny model nie jest dostępny na Twoim koncie, ustaw własny.

## LM Studio: połączenie i wybór modelu

Aplikacja obsługuje [API LM Studio zgodne z OpenAI](https://lmstudio.ai/docs/developer/openai-compat): listę `GET /v1/models` oraz rozmowę `POST /v1/chat/completions`. Używa ich po stronie serwera, nie z przeglądarki. Natrywne API `/api/v1/*` nie jest potrzebne do tej integracji.

1. W LM Studio pobierz odpowiedni model i uruchom serwer w zakładce **Developer**. Wczytaj model lub włącz ładowanie Just-in-Time. Domyślny adres to `http://127.0.0.1:1234/v1`. Lista może zawierać modele pobrane, ale jeszcze niewczytane, zależnie od ustawień LM Studio.
2. Uruchamiając aplikację na **tym samym komputerze**, ustaw:

   ```bash
   export PROVIDER=lmstudio
   export LM_STUDIO_BASE_URL="http://127.0.0.1:1234/v1"
   python3 serwer/server.py
   ```

   W Windows PowerShell:

   ```powershell
   $env:PROVIDER = "lmstudio"
   $env:LM_STUDIO_BASE_URL = "http://127.0.0.1:1234/v1"
   python serwer/server.py
   ```

   Możesz zamiast tego wpisać te zmienne do nieśledzonego przez Git pliku `.env` i wczytać go jak w sekcji „Uruchomienie lokalne”. Adres można podać z `/v1`, bez niego albo jako pełny adres jednego z wymienionych endpointów OpenAI. Jeśli LM Studio wymaga tokenu, ustaw `LM_STUDIO_API_KEY` w środowisku serwera aplikacji, a nie w przeglądarce. Nigdy nie umieszczaj tokenu w adresie URL. Połączenie z LM Studio jest bezpośrednie, bez używania zmiennych HTTP proxy; przez niezaufaną sieć stosuj HTTPS lub bezpieczny tunel, ponieważ zwykłe HTTP nie szyfruje wiadomości ani tokenu. `LM_STUDIO_MODEL` jest opcjonalnym domyślnym identyfikatorem modelu; `MODEL` jest zgodnym zamiennikiem.
3. W aplikacji otwórz **Pomoc i bezpieczeństwo → Model LM Studio**, wybierz **Sprawdź połączenie i pokaż modele**, a następnie model przeznaczony do rozmowy (nie model embeddingów). Jeden dostępny model zostanie wybrany automatycznie. Wybór jest zapamiętywany w przeglądarce osobno dla danego adresu serwera. Jeśli pamięć jest niedostępna, działa do zamknięcia strony. Odśwież listę po zmianach w LM Studio. Sam status konfiguracji nie potwierdza połączenia.
4. Wyślij wiadomość. LM Studio może potrzebować czasu na wczytanie modelu; limit ustawia `LM_STUDIO_TIMEOUT`. Jeśli lista jest pusta lub model nie odpowiada, sprawdź wczytanie modelu, ustawienia JIT i serwera, adres oraz ewentualny token. Przy błędzie aplikacja nie tworzy zastępczej odpowiedzi.

Bez skonfigurowanego tokenu model może odpowiadać tekstowo, ale nie dostaje narzędzia otwierania ekranów. Po skonfigurowaniu tokenu i przy obsłudze narzędzi może otworzyć wyłącznie lokalną mapę, pomoc lub dostępność. LM Studio nie konfiguruje automatycznie rozpoznawania ani syntezy mowy: korzystają one z funkcji przeglądarki lub osobnych usług.

Dla konfiguracji z ekranu „API Usage” w Docker Compose ustawienia domyślne to `PROVIDER=lmstudio`, `LM_STUDIO_BASE_URL=http://host.docker.internal:8791/v1` i `LM_STUDIO_MODEL=google/gemma-4-12b`. W `.env` możesz je jawnie wpisać albo zmienić. Na Linuksie Compose dodaje mapowanie `host.docker.internal`; przy zwykłym `docker run` może być konieczne `--add-host=host.docker.internal:host-gateway`. Adres `http://127.0.0.1:8791` z ekranu LM Studio działa tylko z komputera gospodarza, nie z wnętrza kontenera. W LM Studio włącz dostęp serwera z sieci lokalnej / interfejsu hosta, używaj w kontenerze `host.docker.internal:8791`, ogranicz dostęp zaporą do zaufanego komputera lub sieci, a jeśli dostępne, ustaw token i wpisz go wyłącznie do `LM_STUDIO_API_KEY` po stronie serwera. Samo ustawienie adresu w `.env` nie otworzy portu ani nie zmieni nasłuchu LM Studio. `127.0.0.1` w kontenerze oznacza sam kontener.

**Podgląd zdalny:** `127.0.0.1` oznacza maszynę, na której działa serwer aplikacji, a nie komputer z przeglądarką. Zdalny podgląd nie ma automatycznego dostępu do LM Studio na Twoim komputerze. Uruchom aplikację lokalnie albo skonfiguruj bezpiecznie osiągalny serwer LM Studio.

### Opcjonalne przekazywanie endpointów `/v1/*`

Po ustawieniu `PROVIDER=lmstudio` i `LM_STUDIO_OPENAI_PROXY=1` serwer aplikacji przekazuje do LM Studio dokładnie te endpointy:

- `GET /v1/models`
- `POST /v1/responses`
- `POST /v1/chat/completions`
- `POST /v1/completions`
- `POST /v1/embeddings`

Endpointy są wtedy dostępne pod adresem aplikacji, np. `http://127.0.0.1:8790/v1/models`. Przekazywane są treści żądań i odpowiedzi, również strumieniowe; funkcje i dostępne modele zależą od wersji oraz konfiguracji LM Studio. Limit treści żądania wynosi 16 MiB i wymagany jest `Content-Length`. Token do LM Studio pobierany jest wyłącznie z konfiguracji serwera. To przekazywanie nie jest wymagane do rozmowy w aplikacji i domyślnie jest wyłączone.

**Uwaga:** endpointy aplikacji nie mają logowania ani limitowania żądań. Każdy, kto może się z nimi połączyć, może korzystać z Twojego serwera LM Studio, jego zasobów i skonfigurowanego tokenu; żądania `/v1/responses` mogą obejmować funkcje oferowane przez LM Studio. Włączaj przekazywanie wyłącznie w zaufanym środowisku, pozostaw aplikację na `127.0.0.1` lub dodaj własne uwierzytelnianie i zaporę. Samo połączenie z LM Studio nie daje dostępu do urzędów ani nie gwarantuje poprawności odpowiedzi.

## Cloudflare Workers AI: worker i podłączenie

Alternatywa dla LM Studio, gdy model ma działać w chmurze, a nie na Twoim komputerze. Worker w `cloudflare-worker/`
wystawia API zgodne z OpenAI (`/v1/models`, `/v1/chat/completions`) i woła Workers AI. Pełna instrukcja:
[`cloudflare-worker/README.md`](cloudflare-worker/README.md).

```bash
cd cloudflare-worker
npm install
npx wrangler login
npx wrangler secret put CLOUDFLARE_API_TOKEN    # klucz cfut_... (uprawnienie Workers AI)
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID   # ID konta Cloudflare
npx wrangler deploy
```

`wrangler deploy` wypisuje adres workera. Wpisz go do `.env` i przełącz dostawcę:

```dotenv
PROVIDER=workers
CLOUDFLARE_WORKERS_URL=https://mobywatels-workers-ai.<subdomena>.workers.dev/v1
CLOUDFLARE_WORKERS_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
CLOUDFLARE_WORKERS_TIMEOUT=120
```

Potem `docker compose up -d --build` (kontener musi wczytać nowe `.env`). Sprawdzenie: `GET /v1/models` na adresie
workera zwraca listę modeli, a w aplikacji **Pomoc i bezpieczeństwo → Model LM Studio** pokazuje modele workera.

Czego nie wpisywać: `https://api.cloudflare.com/client/v4/accounts/.../ai/run/...` — to surowy endpoint Workers AI,
nie worker; aplikacja dokleja do niego `/v1` i dostaje `No route for that URI`. Klucz `cfut_…` należy do sekretów
workera, a nie do `CLOUDFLARE_WORKERS_TOKEN` (ten jest tylko wtedy, gdy ustawisz `WORKER_TOKEN`).

Uwagi: Workers AI nie zwraca `tool_calls`, więc asystent odpowiada tekstem i nie otwiera kart ani ekranów; dostępność
modeli zależy od planu (na Free np. `@cf/moonshotai/kimi-k2.7-code` zwraca 403); pierwsze żądanie po wdrożeniu może
zwrócić chwilowy `error 1042` i wystarczy ponowić. Powrót do LM Studio to `PROVIDER=lmstudio`.

## Polskie modele (Bielik, PLLuM i inne)

Asystenta można podpiąć do dowolnego API zgodnego z OpenAI Chat Completions (`/v1/chat/completions`), na przykład
do polskiego modelu uruchomionego lokalnie (vLLM, Ollama) albo u dostawcy chmurowego:

```bash
export PROVIDER=zgodny
export OPENAI_BASE_URL="http://127.0.0.1:8000/v1"   # adres serwera modelu (wzór; vLLM domyślnie: port 8000, Ollama: http://127.0.0.1:11434/v1)
export MODEL="<nazwa-modelu-na-tym-serwerze>"
export MODEL_API_KEY="..."                         # tylko jeśli serwer wymaga klucza
python3 serwer/server.py
```

W Dockerze serwer modelu działający na Twoim komputerze jest pod adresem `http://host.docker.internal:<port>/v1`.

Model odpowiada na przekazany tekst bez narzędzi symulujących rejestry lub czynności urzędowe. Po uwierzytelnieniu, jeśli model obsługuje wywoływanie narzędzi, może na wyraźną prośbę otworzyć lokalny ekran mapy, pomocy lub ustawień. Samo otwarcie nie wyszukuje miejsca, nie zmienia ustawień ani nie wysyła sprawy. Błąd dostawcy lub brak klucza blokuje komendę; model lokalny dopuszczający rozmowę bez klucza nie dostaje narzędzia nawigacji. Nie gwarantuje to dostępności ani poprawności odpowiedzi modelu. Mowa serwerowa wymaga odpowiedniego dostawcy; alternatywą mogą być funkcje przeglądarki.

## Bezpieczeństwo i prywatność

- Serwer nie ma logowania ani limitów. Każdy, kto dostanie się do jego adresu, korzysta z Twoich kluczy API.
  Domyślnie słucha tylko na `127.0.0.1`, a `docker-compose.yml` wystawia port tylko lokalnie. Nie wystawiaj go do internetu bez własnej ochrony.
- Serwer zapisuje w dzienniku (`serwer/agent.log`) metadane i błędy wywołań modelu oraz rozpoznany przez serwer tekst nagrań. Nagrania głosu nie są zapisywane na dysku, ale trafiają do dostawcy rozpoznawania mowy. Dostawca może stosować własne zasady przechowywania danych.
- Treść rozmów trafia do wybranego dostawcy modelu na jego zasadach. W przypadku LM Studio trafia pod skonfigurowany adres serwera; użycie adresu lokalnego nie chroni danych przed innym oprogramowaniem na tym komputerze.

## Testy

Testy przeglądarkowe wymagają Node.js co najmniej 22.12, npm, Pythona oraz Chromium Playwright. W katalogu projektu:

```bash
npm ci
npx playwright install chromium
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
```

Na Linuksie może być konieczne zainstalowanie systemowych zależności przeglądarki zgodnie z dokumentacją Playwright. Testy same uruchamiają serwer aplikacji na porcie 8792, aby nie kolidować z portem LM Studio 8791. Opcjonalnie `CHROMIUM_EXECUTABLE_PATH` wskazuje zainstalowaną przeglądarkę Chromium. `npm ci` i pobranie przeglądarki wymagają dostępu do odpowiednich serwisów.

Testy obejmują m.in. trwałość i niezależność ustawień, reflow, dyktowanie, odczyt, brak fikcyjnego fallbacku, ograniczoną do lokalnych ekranów nawigację, granicę narzędzi API modelu, integrację LM Studio i strumieniowanie proxy, wyszukiwanie i filtrowanie placówek, błędy sieci, klawiaturę, podsumowanie prywatności AI i selekcję pól w transferze symulacyjnym, nowe moduły oraz wybrane kontrole axe WCAG 2.1 A/AA i WCAG 2.2 AA dla tłumacza i centrum rodzinnego. Testy serwerowe sprawdzają limity plików, ekstrakcję PDF, cytowanie i odrzucanie niepotwierdzonych terminów. W testach dostawcy AI, mowy i map są mockowani; nie zastępują one prób rzeczywistego mikrofonu, aparatu, usług zewnętrznych ani pełnego audytu dostępności.

## Plan dostępności WCAG 2.2 A/AA

Wprowadzono semantyczne etykiety, nazwy przycisków, widoczny fokus, statusy na żywo, obsługę dialogów klawiaturą, alternatywy przyciskowe dla karuzel, edytowalne dyktowanie, profil seniora i alternatywę listy dla mapy. Automatyczne testy sprawdzają wybrane ekrany, szerokości, orientacje i odstępy tekstu. **To nie jest deklaracja pełnej zgodności z WCAG.** Przed wdrożeniem należy wykonać i udokumentować następujące prace:

1. **Kontrast i czytelność:** zmierzyć cały tekst i jego stany na rzeczywistych tłach: co najmniej 4,5:1 dla tekstu zwykłego, 3:1 dla dużego; istotne granice i stany komponentów oraz grafiki informacji co najmniej 3:1 względem sąsiadujących kolorów tam, gdzie wymagają tego kryteria. Nie przekazywać informacji wyłącznie kolorem.
2. **Powiększenie i reflow:** ręcznie sprawdzić powiększenie tekstu i strony do 200%, szerokość 320 CSS px, pion i poziom oraz odstępy tekstu WCAG (interlinia 1,5, akapity 2, odstępy liter 0,12 i słów 0,16). Żaden tekst, kontrolka ani fokus nie może zostać obcięty, zasłonięty lub wymagać poziomego przewijania treści; ocenić to także na urządzeniach mobilnych.
3. **Klawiatura i wskaźnik:** przejść wszystkie funkcje przez Tab, Shift+Tab, Enter, Spację i Escape; sprawdzić logiczną kolejność, widoczny fokus, brak pułapek i przywracanie fokusu po dialogach. Każdy gest musi mieć prostą alternatywę. Dodatkowo sprawdzić niezasłonięty fokus oraz minimalne rozmiary/odstępy celów według WCAG 2.2, kryteria 2.4.11 i 2.5.8.
4. **Formularze i błędy:** sprawdzić widoczne etykiety, dostępne nazwy, właściwe typy i `autocomplete` tam, gdzie mają zastosowanie. Błędy mają wskazywać sposób poprawy bez usuwania danych; przed istotną transakcją zapewnić przegląd i korektę oraz jasne skutki czynności nieodwracalnych.
5. **Technologie asystujące:** przetestować kolejność odczytu, nagłówki, ikony, komunikaty `status`/`live`, dialogi i zmiany widoków z NVDA/Firefox, JAWS/Chrome, VoiceOver/Safari i TalkBack/Chrome. Sprawdzić działanie bez dźwięku, ze sterowaniem głosowym i przy użyciu powiększenia. Same automatyczne reguły axe tego nie potwierdzają.
6. **Język i nawigacja:** sprawdzić `lang`, zrozumiałość i spójność wszystkich ekranów, historię i wyszukiwarkę jako dodatkowe sposoby odnalezienia sprawy. Nowa pomoc, mapa, ustawienia, tłumacz pism i centrum rodzinne są obecnie po polsku także w innych wersjach językowych i oznaczone `lang=pl`; potrzebują tłumaczeń i kontroli językowej. Zweryfikować również pozostałe istniejące tłumaczenia.
7. **Czas i treści dodatkowe:** zinwentaryzować wszystkie limity czasu, zapewnić możliwość ich wyłączenia lub wydłużenia tam, gdzie jest wymagana, i udokumentować uzasadnione wyjątki. Sprawdzić zamykanie trwałych podpowiedzi, brak utraty danych po przerwie oraz ręczne zatrzymanie i ponowienie odczytu. Przykładowe dane po odebraniu pozostają widoczne do zamknięcia ekranu.

Wyniki audytu należy zapisać wraz z wersjami przeglądarek, technologiami asystującymi, błędami i ponownym testem po poprawkach. Przydatne są także testy z osobami o różnych potrzebach dostępnościowych.

## Licencja

Kod prototypu (pliki `.py`, `.js`, `.html`, `.css`, słowniki interfejsu i pliki konfiguracyjne) jest udostępniony na licencji MIT.
Pełny tekst jest w pliku `LICENSE`. Możesz go używać, zmieniać i rozpowszechniać, także komercyjnie,
pod warunkiem zachowania informacji o autorze i treści licencji.

Licencja MIT nie obejmuje:
- godła Rzeczypospolitej Polskiej, nazwy, logo i oznaczeń mObywatela ani wyglądu dokumentów
  (m.in. `mockup/assets/icon-mobywatel.svg`, `logo-mobywatel*`, `card-*`, `strip-*`, `mdowod-ekran.png`).
  Są w prototypie wyłącznie w celach pokazowych, a ich użycie podlega odrębnym przepisom i prawom ich właścicieli;
- zdjęć osób z pokazu (`mockup/assets/foto-*.jpg`);
- opisów usług w `serwer/wiedza/`, które pochodzą z serwisu gov.pl. Przy ich ponownym wykorzystaniu sprawdź warunki podane na gov.pl.

Osoby i dane w prototypie są fikcyjne. Projekt nie jest usługą administracji publicznej ani oficjalną aplikacją mObywatel.
