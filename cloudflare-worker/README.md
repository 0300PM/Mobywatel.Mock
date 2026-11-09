# Worker Cloudflare zamiast AWS (Workers AI)

Worker wystawia **API zgodne z OpenAI** (`/v1/models`, `/v1/chat/completions`) i woła **Cloudflare Workers AI**.
Aplikacja rozmawia z nim tym samym kodem co z LM Studio, więc przełączenie to jedna zmienna `PROVIDER`.

W tym katalogu wszystko jest już zainstalowane: `node_modules`, `wrangler` 4.159.0, a worker przechodzi test
lokalny (atrapa Workers AI) i `wrangler deploy --dry-run`.

## Co jest w repozytorium, a czego nie

Katalog `cloudflare-worker/` **należy do repozytorium** — bez niego nie da się wdrożyć workera. Commitujemy:

| Plik | Dlaczego w repo |
|---|---|
| `src/index.js` | kod workera — źródło prawdy |
| `wrangler.toml` | nazwa workera, `compatibility_date`, wiązanie `[ai]`, `DEFAULT_MODEL` (bez sekretów) |
| `package.json`, `package-lock.json` | powtarzalny `npm ci` i przypięty Wrangler |
| `README.md` | instrukcja wdrożenia |

`.gitignore` w tym katalogu wyklucza to, co lokalne lub wrażliwe:

- `node_modules/` — ~175 MB zależności, odtwarzalne przez `npm ci`;
- `.wrangler/` — lokalny stan i cache Wranglera;
- `.dev.vars`, `.dev.vars.*`, `.env`, `.env.*` — lokalne sekrety do `wrangler dev`.

Sekrety produkcyjne **nigdy** nie trafiają do repo: ustawia się je przez `wrangler secret put`, a trzyma po stronie
Cloudflare. Klucz `cfut_…` nie może się znaleźć w `wrangler.toml` ani w `[vars]` — ta sekcja jest jawna i publiczna.

## Krok 1 — zaloguj się do Cloudflare (raz)

```bash
cd cloudflare-worker
npx wrangler login
```

Otworzy się przeglądarka. Zaloguj się na to samo konto, do którego należy klucz `cfut_…`
(`ACCOUNT_ID = cc27d179b5b92fd98172575d50d0438f`).

Sprawdzenie: `npx wrangler whoami` ma pokazać Twoje konto i ten sam `ACCOUNT_ID`.

## Krok 2 — sekrety workera (raz)

Worker ma dwa warianty. **Wybierz wariant A**, bo masz już klucz `cfut_…`.

**Wariant A — klucz API (Twój przypadek):** usuń wiązanie `[ai]` z `wrangler.toml` (albo zostaw, nie przeszkadza),
a potem:

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN     # wklej cfut_...
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID    # wklej cc27d179b5b92fd98172575d50d0438f
npx wrangler secret put WORKER_TOKEN             # opcjonalnie: własny token na wejściu workera
```

**Wariant B — bez klucza w aplikacji:** zostaw `[ai]` w `wrangler.toml` i nie ustawiaj `CLOUDFLARE_API_TOKEN`;
worker użyje wiązania `env.AI`.

## Krok 3 — wdróż

```bash
npx wrangler deploy
```

Na końcu wypisze adres, np.:

```
https://mobywatels-workers-ai.<twoja-subdomena>.workers.dev
```

**Sprawdź go w przeglądarce**, dopisując `/v1/models`:

```
https://mobywatels-workers-ai.<twoja-subdomena>.workers.dev/v1/models
```

- lista modeli → dobrze,
- `401` → dobrze, jeśli ustawiłeś `WORKER_TOKEN` (worker wymaga nagłówka),
- `400 No route` / `404` → to nie jest adres workera.

## Krok 4 — wpisz adres do `.env`

```dotenv
PROVIDER=workers
CLOUDFLARE_WORKERS_URL=https://mobywatels-workers-ai.<twoja-subdomena>.workers.dev/v1
CLOUDFLARE_WORKERS_TOKEN=            # tylko jeśli ustawiłeś WORKER_TOKEN w kroku 2
CLOUDFLARE_WORKERS_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
CLOUDFLARE_WORKERS_TIMEOUT=120
```

Czego **nie** wpisywać: `https://api.cloudflare.com/client/v4/accounts/.../ai/run/...` — to surowy endpoint
Workers AI, nie worker (aplikacja dokleja do niego `/v1` i dostaje `No route for that URI`).

## Krok 5 — restart aplikacji

```bash
docker compose up -d --build
```

Kontener musi wczytać nowe `.env`. Sprawdzenie: `docker exec mobywatels-mobywatel-1 env | grep PROVIDER`
ma pokazać `PROVIDER=workers`. Jeśli na porcie 8790 działa jeszcze inny kontener (np. stary podgląd), zatrzymaj go,
żeby przeglądarka nie łączyła się ze starymi ustawieniami.

## Krok 6 — test w aplikacji

**Pomoc i bezpieczeństwo → Model LM Studio → Sprawdź połączenie i pokaż modele**. Przy `PROVIDER=workers` ta karta
pokazuje modele z workera. Wybierz model i wyślij wiadomość. Błędy mówią teraz wprost o workerze, np.
„Worker Cloudflare odrzucił dostęp. Sprawdź CLOUDFLARE_WORKERS_TOKEN”.

## Powrót do LM Studio

Jedna linia w `.env` i restart:

```dotenv
PROVIDER=lmstudio
```

## Znane ograniczenia

- **Brak wywoływania narzędzi.** Workers AI nie obsługuje `tool_calls`, więc asystent odpowiada informacyjnie
  i nie otwiera kart ani ekranów. Karty, akcje i nawigacja działają przy `PROVIDER=lmstudio`, `zgodny`, `anthropic`, `openai`.
- **Dostępność modeli zależy od planu.** Na planie Free `@cf/moonshotai/kimi-k2.7-code` zwraca `403`
  („not available on the Workers Free plan”). `@cf/meta/llama-3.3-70b-instruct-fp8-fast` działa.
- **Limity.** Zapytania obciążają limit Workers AI; przy przekroczeniu worker zwraca błąd, a aplikacja pokazuje
  komunikat zamiast wymyślonej odpowiedzi.
- **Tłumaczenie interfejsu** na języki inne niż polski nadal korzysta z `OPENAI_API_KEY`; rozmowa przez workera
  działa bez niego.
