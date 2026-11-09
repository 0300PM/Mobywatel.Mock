# Dokumentacja projektu

Dokumentacja jest podzielona na pliki tematyczne, aby można było utrzymywać opis zachowania, interfejsu, infrastruktury i ryzyk niezależnie. Opisuje stan prototypu w repozytorium, a nie docelową usługę urzędową.

## Nawigacja

- [Architektura i przepływ danych](ARCHITECTURE.md) — elementy systemu, kolejność uruchamiania oraz główne przepływy.
- [Technologie i decyzje](TECHNOLOGIES.md) — stos, role zależności, Tailwind CSS, `duck` i proces budowania.
- [Frontend i katalog funkcji](FRONTEND.md) — pliki, stan aplikacji, moduły i zachowanie funkcjonalne.
- [Serwer i API](BACKEND-API.md) — endpointy HTTP, parametry, walidacje, odpowiedzi i dostawca `PROVIDER=workers` (Cloudflare).
- [UI/UX i dostępność](UI-UX.md) — układ, zachowania interakcji, treść, klawiatura i kryteria WCAG.
- [Bezpieczeństwo i prywatność](SECURITY-PRIVACY.md) — granice prototypu, dane, zagrożenia i wymagania przed wdrożeniem.
- [Bezpieczny Obywatel](SAFETY-MODULE.md) — scenariusze, źródła, AI, prywatność, offline i ograniczenia modułu kryzysowego.
- [Testy i rozwój](TESTING.md) — konfiguracja, komendy, zakres automatyzacji i ograniczenia testów.

## Jak korzystać z dokumentacji

1. Osoba uruchamiająca projekt zaczyna od głównego [README](../README.md), wymagań i konfiguracji.
2. Osoba rozwijająca frontend czyta [architekturę](ARCHITECTURE.md), [frontend](FRONTEND.md) i [UI/UX](UI-UX.md).
3. Osoba zmieniająca serwer lub integracje czyta [API](BACKEND-API.md) i [bezpieczeństwo](SECURITY-PRIVACY.md).
4. Osoba konfigurująca model rozmowy (OpenAI, Anthropic, LM Studio, worker Cloudflare) czyta [technologie](TECHNOLOGIES.md), sekcję „Cloudflare Workers AI”, oraz [instrukcję workera](../cloudflare-worker/README.md).
4. Przed zmianą zależności lub testów sprawdza [technologie](TECHNOLOGIES.md) oraz [testy](TESTING.md).

## Zasady rzetelności

- „Przykładowe”, „demonstracyjne” i „symulowane” oznaczają zachowanie prototypu. Nie są dowodem transakcji urzędowej, tożsamości ani prawa do świadczenia.
- Podsumowanie „Co mogę udostępnić?” jest statyczną, celowo ograniczoną symulacją. Nie wywołuje modelu AI i nie jest zgodą, oceną prawną ani weryfikacją odbiorcy.
- Rzeczywiste połączenia opisano jako zależne od konfiguracji. Mocki w testach nie dowodzą dostępności ani jakości dostawcy.
- Dokumentacja wskazuje miejsca w kodzie, które są źródłem prawdy. Przy rozbieżności pierwszeństwo ma bieżący kod i testy; dokumentację należy wtedy poprawić.

## Utrzymanie

Po zmianie funkcji zaktualizuj odpowiednią stronę, spis treści w tym pliku oraz skrócony opis w głównym README, jeśli wpływa na konfigurację, dane albo ograniczenia użytkownika. Nie opisuj planowanej funkcji tak, jakby już działała.
