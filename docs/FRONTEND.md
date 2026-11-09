# Frontend i katalog funkcji

## Strony i zasoby

- `/aplikacja` i `/` wskazują `mockup/index.html`.
- `/komputer` wskazuje `mockup/komputer.html` — dodatkowy, demonstracyjny ekran odbiorcy.
- CSS: `style.css` (rdzeń), `modules.css` (moduły i pomoc transferu), `tailwind.generated.css` (opcjonalne utility `tw:`).
- `lmstudio.js` obsługuje kartę wyboru modelu dla obu dostawców lokalnych/chmurowych: `PROVIDER=lmstudio` i `PROVIDER=workers`. Etykiety i komunikaty różnią się w zależności od `window.AGENT_INFO.provider`.
- Dane statyczne i interakcje są rozdzielone na skrypty. Zobacz [architekturę](ARCHITECTURE.md) po pełną kolejność ładowania i opis komponentów.

## Główne ekrany

### Ekran dokumentów

`osoby.js` wybiera przykładowy profil na podstawie URL lub ustawienia w pamięci przeglądarki. `variants.js` buduje układ kart i alternatywne warianty dokumentów, a `core.js` prezentuje szczegóły. Dane dokumentów, zdjęcia i terminy są fikcyjne. Interfejs nie łączy się z rejestrami.

Karta lub alternatywny układ może otworzyć dodatkowe szczegóły, menu osoby/układu albo znak demonstracyjny. Ujawnianie danych na karcie jest tylko zachowaniem makiety. Brak fizycznego poświadczenia nie powinien być interpretowany jako zabezpieczenie.

### Rozmowa z asystentem

`agent.js` wysyła wiadomości do `/api/agent` i wyświetla tekst, błędy lub ograniczoną nawigację. Gdy serwer nie ma dostawcy lub połączenie nie powiedzie się, UI informuje o błędzie i zachowuje wiadomość do ponowienia; nie odtwarza gotowego, fikcyjnego scenariusza zamiast modelu.

Dla `PROVIDER=lmstudio` i `PROVIDER=workers` frontend ustawia dłuższy limit żądania (`AGENT_INFO.timeout + 20 s`, maks. 600 s) i dołącza wybrany model z karty modelu. Dla `PROVIDER=workers` karta pokazuje modele workera (`/api/lmstudio/models` pyta wtedy Cloudflare), a komunikaty błędu mówią o workerze, nie o LM Studio. W tym trybie odpowiedzi są wyłącznie tekstem — Workers AI nie zwraca wywołań narzędzi, więc karty i nawigacja się nie pojawiają.

Historia i szkice są stanem strony. Wstecz pozwala wrócić do szkicu. Dla kolejnych wiadomości frontend pilnuje stanu żądania, aby uniknąć utraty lub podwójnego wysłania.

### Pomoc, dostępność i profil seniora

Pomoc zawiera przewodniki bezpieczeństwa, słowniczek, edytowalny szkic dyktowania, przykładowe przypomnienia oraz wybór czytnika głosowego. Profil seniora i ustawienia dostępności są osobno zapamiętywane dla profilu standardowego i seniora. Dostępne ustawienia obejmują rozmiar tekstu, kontrast, uproszczone menu, ograniczenie animacji i widoczność przycisków odczytu. Ustawienie animacji współdziała z systemowym `prefers-reduced-motion`.

Wypowiedź rozpoznana z mikrofonu pozostaje szkicem: użytkownik może poprawić tekst i świadomie zdecydować o wysłaniu. Brak obsługi przeglądarki, zgody na mikrofon lub dostawcy serwera nie powinien blokować wpisywania tekstu.

### Mapa placówek

`places.js`:

1. geokoduje wpisaną miejscowość przez Nominatim;
2. pobiera z Overpass oznaczone obiekty w promieniu około 6 km;
3. sprawdza identyfikatory, współrzędne i typ obiektu;
4. klasyfikuje placówki, sortuje po odległości i pokazuje do 200 najbliższych;
5. umożliwia filtrowanie listy po rodzaju i tekście, wybór wyniku oraz pokazanie go na mapie;
6. opisuje brakujące pola, nie tworząc fikcyjnych godzin, dostępności, kontaktu ani adresu.

Kategorie obejmują m.in. urzędy gminne, powiatowe, skarbowe, ZUS, punkty paszportowe, apteki, przychodnie, szpitale, policję, ARiMR, drogi wojewódzkie i bankomaty. OSM może mieć niekompletne lub przestarzałe informacje. Przy problemie z kafelkami nadal dostępna jest lista wyników.

### Tłumacz pism urzędowych

`modules.js` obsługuje wejście TXT UTF-8, PDF z warstwą tekstową do 4 MiB i tekst wpisany ręcznie. Odczyt pliku jest osobną akcją od analizy AI. OCR nie działa. Wysłanie tekstu do modelu wymaga edytowalnego podglądu i osobnego pola zgody.

Wynik modelu jest prezentowany jako znaczenie, kroki, termin i dokumenty, wraz z cytatami. Serwer odrzuca cytat, którego nie ma w źródle, oraz termin bez pasującej daty/okresu. To walidacja spójności tekstowej, nie niezależna kontrola prawna. Tekst może opuścić urządzenie i podlegać zasadom skonfigurowanego dostawcy.

### Bezpieczne centrum rodzinne

`modules.js` utrzymuje demonstracyjną listę osób, role i zadania w `localStorage`. Można przełączać widok osoby, dodawać/usuwać osoby i zadania oraz oznaczyć zadanie jako wspólne w tej samej przeglądarce. Czytelnik ma ograniczony zestaw przycisków w interfejsie.

To nie jest autoryzacja. Dane można zmienić przez narzędzia przeglądarki, role nie są sprawdzane na serwerze, nie ma kont, zaproszeń, synchronizacji ani powiadomień. Każda osoba na tym samym urządzeniu może potencjalnie odczytać pamięć przeglądarki.

### Bezpieczny Obywatel

`mockup/safety.js` renderuje dwujęzyczny panel z poradnikami `safety-guides.json`, statusem bieżących zagrożeń jawnie oznaczonym jako nieznany, dobrowolnym profilem i lokalnym plecakiem. Checklisty, profil i wybór w poradnikach są przechowywane w `localStorage`. `safety-sw.js` precache’uje shell i statyczne materiały dla kolejnych wejść offline; wyklucza `/api/`, więc nie udaje działania AI ani aktualności alertów bez sieci.

Scenariusz „bezpośrednie zagrożenie” blokuje wysłanie opisu do AI i pokazuje jawny link `tel:112`. W innych przypadkach formularz wywołuje `/api/safety/assist`; przy błędzie pozostawia widoczne statyczne instrukcje. Lokalizacja jest wysyłana tylko po opt-in. Zdjęcie jest lokalnym podglądem, nigdy częścią żądania. Przy wejściu do panelu ustawiany jest fokus, Escape i Wstecz zamykają dialog zgodnie ze wspólnym zarządzaniem warstwami.

Szczegóły ograniczeń, walidacji i źródeł znajdują się w [dokumentacji modułu](SAFETY-MODULE.md).

### Karta modelu (LM Studio / worker Cloudflare)

`lmstudio.js`:

1. pokazuje kartę, gdy `AGENT_INFO.provider` to `lmstudio` albo `workers` (przy innych dostawcach karta jest ukryta);
2. wiąże zapisany wybór z `AGENT_INFO.lmstudio_id` — identyfikatorem serwera LM Studio lub workera; zmiana adresu unieważnia stary wybór;
3. pobiera listę z `/api/lmstudio/models` po kliknięciu „Sprawdź połączenie i pokaż modele”, z 12-sekundowym `AbortController`;
4. wybiera automatycznie jedyny model z listy, ostrzega o modelu spoza listy i o pustej liście;
5. przy błędzie pokazuje komunikat z serwera (np. „Nie udało się połączyć z workerem Cloudflare…”).

Wybór modelu nie jest potwierdzeniem dostępności usługi — to tylko identyfikator przekazywany w żądaniu.

### Znak i „Co mogę udostępnić?”

`znak.js` prowadzi przepływ skanowania i testowego przekazania danych między klientami. Ekran potwierdzenia:

- pokazuje nazwę odbiorcy i cel, jaki odbiorca zadeklarował; nie potwierdza ich autentyczności,
- przedstawia statyczne wskazówki zależne od celu oraz wskazuje pola potencjalnie bardziej identyfikujące,
- pokazuje wszystkie żądane przykładowe pola jako osobne checkboxy, początkowo wyłączone,
- aktualizuje liczbę zaznaczeń, tekst o pominiętych polach i konsekwencje,
- utrzymuje przycisk potwierdzenia wyłączony do zaznaczenia co najmniej jednego pola,
- wysyła tylko zaznaczone wiersze. Odbiorca widzi wyłącznie te wiersze.

Etykieta „AI · SYMULACJA PROTOTYPU” nie oznacza analizy modelu. Funkcja jest napisana jako statyczne reguły; nie kontaktuje się z AI ani nie rozstrzyga podstawy prawnej lub niezbędności danych. Potwierdzenie, animacja Face ID, znak i odbiór są fikcyjne. Nie wolno opisywać ich jako prawdziwej zgody, uwierzytelnienia lub bezpiecznego transferu.

## Wspólne wzorce implementacyjne

- Dynamiczne treści użytkownika i zewnętrzne są wstawiane jako tekst DOM lub kodowane przed HTML; dane OSM są dodatkowo walidowane przed utworzeniem linku.
- Wiadomości statusowe korzystają z `role="status"`/`aria-live` tam, gdzie to ma sens.
- Dialogi synchronizują warstwę `inert`, widoczność i fokus przez funkcje dostępności.
- Żądania mapy i tłumacza można anulować przez `AbortController` przy zamknięciu panelu lub zmianie żądania.
- Gdy pamięć lokalna jest niedostępna, część ustawień działa tymczasowo; UI powinien komunikować brak trwałego zapisu.

## Dodawanie nowej funkcji

1. Określ, czy to działanie demonstracyjne czy rzeczywiste i ujawnij ograniczenia przy punkcie decyzji.
2. Dodaj semantyczny element HTML i stan początkowy; nie zakładaj, że użytkownik może użyć wyłącznie myszy.
3. Zadbaj o etykiety, komunikaty błędu, fokus przy otwarciu/zamknięciu i zachowanie przy dużym tekście.
4. Umieść logikę w odpowiednim pliku JS, nie duplikuj walidacji bezpieczeństwa po stronie serwera.
5. Dodaj test Playwright dla sukcesu, odmowy/błędu, klawiatury i ograniczeń prywatności.
6. Uaktualnij [UI/UX](UI-UX.md), [API](BACKEND-API.md) i [bezpieczeństwo](SECURITY-PRIVACY.md), jeśli funkcja dotyka tych obszarów.
