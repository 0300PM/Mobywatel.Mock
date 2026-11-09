# UI/UX i dostępność

## Zasady interfejsu

1. **Wyraźnie rozdzielaj demonstrację od czynności rzeczywistej.** Ekran ma nazywać fikcyjne dane i nie sugerować dostępu do rejestrów, złożenia wniosku, płatności, prawdziwej tożsamości lub wysłania powiadomienia.
2. **Najpierw wyjaśnij decyzję.** Wymagający decyzji ekran powinien podać kto/na jakiej podstawie prosi, jakie dane lub skutki dotyczą wyboru i jak odmówić albo wrócić.
3. **Nie wysyłaj szkicu automatycznie.** Rozpoznana mowa i odczytany tekst dokumentu pozostają widoczne do sprawdzenia; wysłanie ma osobną, świadomą akcję.
4. **Nie ukrywaj ograniczeń za błędem.** Brak modelu, mapy, pamięci lokalnej lub usługi mowy powinien mieć zrozumiały komunikat i alternatywę, jeśli istnieje.
5. **Zachowuj ciągłość.** Powrót z dialogu powinien przywracać sensowny kontekst i fokus; przy dużym tekście treść powinna pozostać dostępna bez ucinania.

## Hierarchia i nawigacja

Główna strona przypomina widok urządzenia mobilnego i prezentuje przykładowe dokumenty oraz przypomnienia. Nagłówek oferuje skróty do ekranu głównego, historii, nowej rozmowy, demonstracyjnego transferu i pozostałych elementów. Funkcje wspierające znajdują się na ekranie głównym i w sekcji „Więcej funkcji”. Dodatkowa nawigacja umożliwia przechodzenie między układami dokumentów i przykładowymi osobami.

Mapa, pomoc/dostępność, tłumacz pism, centrum rodzinne i transfer są warstwami/dialogami nad głównym widokiem. Każdy panel ma wyraźną nazwę, przycisk „Wstecz” i – tam, gdzie zaimplementowano – obsługę Escape, ograniczenie fokusu do aktywnej warstwy oraz przywrócenie fokusu do elementu wywołującego. Funkcję należy sprawdzać klawiaturą; nie zakładać, że sam Escape występuje na każdym komponencie.

## Moduł kryzysowy

„Bezpieczny Obywatel” jest dodatkowym skrótem i dialogiem, nie przebudową istniejących ekranów. Widoczny 112 ma semantykę linku i uruchamia telefon tylko po aktywacji przez użytkownika. Status alertów jest jawnie nieznany, bez imitowania bieżących komunikatów. Statyczne kroki, błędy i checklisty pozostają widoczne niezależnie od AI. Po zaznaczeniu bezpośredniego zagrożenia opis nie jest wysyłany do modelu; pojawia się `role="alert"` i link 112.

Lokalizacja jest opcjonalna i domyślnie nie jest dołączana; opis zdjęcia informuje, że obraz pozostaje lokalnym podglądem. Profil nie pyta o diagnozy ani nazwy leków. Tryb awaryjny zapewnia większy tekst, kontrast, przyciski min. 44 px i redukcję animacji. Odnośniki do instrukcji mają źródła, a treść przestrzega, że bieżące polecenia służb mają pierwszeństwo. Szczegóły: [Bezpieczny Obywatel](SAFETY-MODULE.md).

## Zachowanie przy różnych potrzebach

- Profil „Dla seniora” umożliwia większy tekst, uproszczony dostęp do funkcji i ustawienia odczytu.
- Ustawienia standardowe i seniora są zapisywane oddzielnie, by przełączanie profilu nie kasowało indywidualnych wartości.
- Ustawienie ograniczenia ruchu nie wyłącza preferencji systemowej; `prefers-reduced-motion` działa niezależnie.
- Mapa ma alternatywną listę wyników, a znacznik można wybrać z listy; nawigacja nie wymaga przeciągania.
- Odczyt tekstu ma przyciski uruchomienia i zatrzymania. Nie zaczyna automatycznie mówić przy wejściu na ekran.
- Gdy localStorage jest niedostępny, zmiany wizualne nadal mogą działać w sesji, ale nie należy obiecywać ich trwałego zapisu.

## UI podsumowania prywatności

Ekran pojawia się przed demonstracyjnym potwierdzeniem transferu. Kolejność treści:

1. identyfikacja charakteru jako statycznej symulacji AI;
2. deklarowany przez odbiorcę cel i informacja, że nie jest weryfikowany;
3. prośba o konkretne przykładowe pola;
4. celowo odznaczone checkboxy dla każdego pola;
5. pytanie o możliwość pominięcia i wskazówki statyczne zależne od celu;
6. dynamiczny opis liczby zaznaczeń, pominięć oraz skutków;
7. jawne zastrzeżenie, że nie ma analizy modelu, oceny prawnej, prawdziwej zgody ani weryfikacji;
8. osobne przyciski „Odmów” i „Potwierdź w symulacji”.

Przycisk potwierdzenia jest wyłączony, dopóki użytkownik nie zaznaczy pola. Przy próbie sieciowej może wystąpić błąd; komunikat pozostaje przycisku i pozwala ponowić próbę. Na odbiorcę wysyłany jest wyłącznie zaznaczony zakres. Tekst wyświetla się jako przykład, nie jako poświadczenie.

## Treść, błędy i potwierdzenia

- Przycisk nazywa wykonywaną akcję, np. „Odczytaj wybrany plik”, „Wyjaśnij pismo” lub „Potwierdź w symulacji”.
- Potwierdzenia wrażliwe na decyzję nie mogą być zastąpione animacją. Animacja Face ID w makiecie jest wyraźnie oznaczona jako symulacja.
- Komunikaty o błędach powinny mówić, co nie zadziałało, czy coś wysłano i co można zrobić dalej. Gdy odpowiedź nie dotarła, nie pokazuj sukcesu.
- W statusie na żywo powinien znaleźć się krótki stan bez nadmiarowego odczytywania całej strony. Długie informacje pozostają w normalnej kolejności czytania.
- Nie opieraj rozróżnienia na samym kolorze lub ikonie; dodawaj tekst, etykietę lub semantyczną nazwę.

## Kryteria dostępności do weryfikacji

Repozytorium zawiera wybrane automatyczne kontrole axe, testy klawiatury, fokusowania, reflow, dużego tekstu, kontrastu i odstępów. To nie jest certyfikat WCAG ani pełny audyt. Przed wdrożeniem sprawdź ręcznie co najmniej:

- kompletność nazw dostępnych dla kontrolek, etykiet i stanów, w tym pól powstających dynamicznie;
- logiczną kolejność fokusu i widoczny fokus przy wszystkich stanach komponentów;
- dostępność dialogów po otwarciu, przy Escape, przyciskiem Wstecz i po przejściu między panelami;
- reflow przy 320 CSS px, powiększeniu 200%, dużym tekście i odstępach WCAG;
- kontrast zwykłego/dużego tekstu, focusu, ramek i stanów disabled/selected;
- cele dotykowe i odstępy między nimi (WCAG 2.2 AA), nie tylko sam rozmiar pola checkbox;
- komunikaty asynchroniczne w czytnikach ekranu i zachowanie przy powolnej sieci;
- obsługę czytnika ekranu na rzeczywistych urządzeniach i przeglądarkach.

## Projektowanie zmian

Drobna aktualizacja komponentu może zmienić zachowanie w innych ekranach, ponieważ wiele stylów jest współdzielonych. Przed zmianą:

1. sprawdź selektory w `style.css` i `modules.css` oraz strukturę panelu;
2. przetestuj widok zwykły i seniora, oba profile dostępności i układ poziomy;
3. zachowaj treści i nawigację obecną poza zakresem zadania;
4. dopisz test regresyjny odpowiadający ryzyku zmiany;
5. po zmianie odśwież zbudowany Tailwind, jeżeli dodano utility `tw:`.
