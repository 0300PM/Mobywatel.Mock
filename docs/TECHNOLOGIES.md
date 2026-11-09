# Technologie i decyzje projektowe

## Zestaw technologii

| Technologia | Gdzie | Rola i powód użycia |
|---|---|---|
| HTML5 | `mockup/index.html`, `mockup/komputer.html` | Semantyczny szkielet, formularze, regiony dialogów i punkty montowania widoków. Pozwala zachować lekką aplikację bez frameworka UI. |
| CSS | `mockup/style.css`, `mockup/modules.css` | Obecny wizualny system aplikacji, responsywność, układy, stany i style modułów. Pozostaje źródłem prawdy dla istniejącego interfejsu. |
| Tailwind CSS 4.3.5 | `mockup/tailwind.css` → `mockup/tailwind.generated.css` | Daje narzędzia utility do przyszłych, jawnych zmian bez resetowania istniejących stylów. Używany z prefiksem `tw:` i bez Preflight, by uniknąć przypadkowych zmian UI. |
| JavaScript przeglądarki | `mockup/*.js` | Zachowanie prototypu, DOM, dostępność, lokalny stan i integracje HTTP. Skrypty są klasyczne, bez bundlera i modułów ES. |
| Python 3 | `serwer/*.py` | Serwer HTTP, walidacja, połączenie z dostawcami i ekstrakcja tekstu. Serwer główny opiera się na standardowej bibliotece; brak `pip install` dla podstawowego uruchomienia. |
| Playwright 1.64.1 | testy `*.spec.js` | Testy przeglądarkowe i scenariusze interakcji z Chromium. |
| Cloudflare Workers AI + Wrangler 4.159.0 | `cloudflare-worker/` | Opcjonalny dostawca modelu rozmowy (`PROVIDER=workers`). Worker w JS (moduł ES) wystawia API zgodne z OpenAI i woła Workers AI. Wrangler jest `devDependency` w `cloudflare-worker/package.json`, nie w głównym `package.json`, więc `npm ci` w katalogu głównym nie instaluje narzędzi Cloudflare. |
| axe-core Playwright 4.14.0 | testy dostępności | Automatyczne wykrywanie wybranych problemów semantycznych i dostępności. Nie zastępuje audytu ręcznego. |
| `duck` 0.1.12 | wyłącznie testy Node | Matchery/assertions dla złożonych danych z użytecznym opisem różnic. To nie jest skrypt aplikacji ani zależność ładowana w przeglądarce. |

Wersje narzędzi Node są przypięte w `package.json` i `package-lock.json`. `npm ci` instaluje powtarzalny zestaw zależności. Pakiety developerskie nie są potrzebne do uruchomienia samego serwera Pythona, ale Tailwind CLI jest wymagany do regeneracji arkusza CSS.

## Tailwind CSS

### Zakres integracji

Oba HTML-e linkują `tailwind.generated.css`. Plik jest generowany z `mockup/tailwind.css`, skanuje `index.html`, `komputer.html` i skrypty JS w katalogu mockupu. Tailwind jest narzędziem do utility classes; istniejące ekrany nie zostały przepisywane na utility, aby nie zmieniać UI/UX w ramach samej integracji.

### Izolacja od istniejących stylów

- Prefiks `tw:` musi poprzedzać każdą klasę Tailwind, np. `tw:flex` albo `tw:p-4`.
- Importowane są theme i utilities, ale nie warstwa Preflight/reset. Globalny reset Tailwind mógłby zmienić istniejące formularze, nagłówki i układ.
- Arkusz Tailwind znajduje się przed obecnymi arkuszami w `<head>`, więc style komponentów aplikacji pozostają później w kolejności kaskady.
- Nie buduj nazw klas przez łączenie fragmentów w runtime. Skaner musi zobaczyć pełny zapis klasy; przy wyjątkach dodaj jawne źródło lub safelist zgodnie z dokumentacją Tailwind v4 i zweryfikuj wynik.

### Budowanie

```bash
npm ci
npm run build:css
```

Tryb obserwowania podczas pracy nad HTML/CSS:

```bash
npm run watch:css
```

`npm test` uruchamia automatyczne `pretest`, które najpierw buduje CSS. Wygenerowany `mockup/tailwind.generated.css` jest mały, wersjonowany w repozytorium i serwowany bezpośrednio przez Pythonowy serwer. Po zmianie wejścia sprawdź, czy plik wygenerowany oraz oba HTML-e są zgodne.

## `duck` i testowanie

Nazwa pakietu npm to `duck`, repozytorium projektu nosi nazwę duck.js. Jest to biblioteka matcherów, a nie biblioteka aplikacyjna. W tym repozytorium jest `devDependency` i używana jest w `tests/prototype.spec.js` do asercji dokładnej listy pól otrzymanego, symulowanego transferu. Nie umieszczaj jej w `<script>` HTML ani w kodzie klienta: nie wnosi funkcji do interfejsu i nie jest potrzebna w produkcyjnym runtime.

## Interfejs bez frameworka

Frontend używa zwykłego DOM i globalnych skryptów, ponieważ aplikacja ma pozostać możliwa do uruchomienia jako zestaw statycznych plików z prostym serwerem. Kosztem jest zależność od kolejności ładowania, globalny zakres nazw i trudniejsza izolacja modułów. Przy refaktorze na bundler trzeba zachować kolejność inicjalizacji, głębokie linki, dynamiczne treści, stan focusu i testy istniejącego UI.

## Python i serwer HTTP

`serwer/server.py` rozszerza `SimpleHTTPRequestHandler`, używa `ThreadingHTTPServer` i udostępnia katalog `mockup`. Nie jest to serwer produkcyjny: brak wbudowanego uwierzytelniania, limitowania żądań, CSRF-protection ani trwałego modelu sesji. Główne funkcje AI i integracje wymagają konfiguracji opisanej w głównym [README](../README.md).

## Usługi zewnętrzne

Zależnie od użytej funkcji aplikacja może komunikować się z:

- dostawcą modelu wybranym przez `PROVIDER` (OpenAI, Anthropic, API zgodne z OpenAI, LM Studio albo worker Cloudflare),
- workerem Cloudflare pod `CLOUDFLARE_WORKERS_URL`, który z kolei łączy się z `api.cloudflare.com` (Workers AI),
- OpenAI lub ElevenLabs w celu STT/TTS,
- usługami OpenStreetMap z przeglądarki: Nominatim, Overpass i serwerem kafelków,
- Google Fonts dla kroju Inter.

## Cloudflare Workers AI (`PROVIDER=workers`)

### Dlaczego worker, a nie bezpośrednie API

Workers AI da się wołać prosto z Pythona (`POST /client/v4/accounts/<id>/ai/run/<model>`), ale ten endpoint nie ma
`/v1/models`, a klucz konta musiałby trafić do `.env`. Worker daje trzy rzeczy naraz:

1. **API zgodne z OpenAI**, więc serwer używa jednego klienta (`zgodny()`/`lmstudio.open_request`) dla LM Studio i Cloudflare;
2. **klucz konta zostaje w sekrecie workera** (`CLOUDFLARE_API_TOKEN`), a aplikacja zna co najwyżej własny `WORKER_TOKEN`;
3. **własną listę modeli** i miejsce na przyszłe mapowanie formatów.

### Stos i wersje

| Element | Wersja / plik | Uwagi |
|---|---|---|
| Worker | `cloudflare-worker/src/index.js` | Moduł ES (`export default { fetch }`), `type: "module"` w `package.json`. |
| Wrangler | `^4.159.0` | `npx wrangler deploy`, `npx wrangler secret put`, `npx wrangler whoami`. |
| Konfiguracja | `cloudflare-worker/wrangler.toml` | `compatibility_date = "2024-11-01"`, wiązanie `[ai] binding = "AI"`, `DEFAULT_MODEL`. |
| Runtime | Workers (workerd) | `node_modules` workera jest w `.gitignore` (`cloudflare-worker/.gitignore`). |

### Dwie ścieżki uwierzytelnienia do Workers AI

| Wariant | Konfiguracja | Kiedy |
|---|---|---|
| Wiązanie `env.AI` | zostaw `[ai]` w `wrangler.toml`, bez `CLOUDFLARE_API_TOKEN` | najprostszy; uprawnienia daje samo wdrożenie |
| Klucz API | usuń `[ai]`, ustaw sekrety `CLOUDFLARE_API_TOKEN` (uprawnienie *Workers AI: Read*) i `CLOUDFLARE_ACCOUNT_ID` | gdy chcesz kontrolować uprawnienia kluczem |

### Ograniczenia techniczne

- Workers AI nie zwraca `tool_calls`; worker skleja historię narzędzi w tekst (`[wywołania narzędzi: …]`), więc asystent nie wykonuje akcji.
- Dostępność modeli zależy od planu: na planie Free `@cf/moonshotai/kimi-k2.7-code` zwraca 403, a `@cf/meta/llama-3.3-70b-instruct-fp8-fast` działa.
- Pierwsze żądanie po wdrożeniu może zwrócić chwilowy `error 1042` z brzegu Cloudflare; powtórzenie przechodzi.
- Cloudflare blokuje domyślny `User-Agent: Python-urllib` (błąd 1010), dlatego `lmstudio.USER_AGENT` jest obowiązkowy.
- Worker nie ma dostępu do plików, rejestrów ani danych użytkownika — dostaje wyłącznie treść rozmowy.

W teście większość połączeń zewnętrznych jest mockowana. Obecność testu nie oznacza, że usługa, klucz, limit albo dostępność sieci są gwarantowane.
