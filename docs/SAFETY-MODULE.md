# Moduł „Bezpieczny Obywatel”

## Zakres i pliki

Moduł jest dodatkowym panelem w istniejącym widoku, bez zmiany pozostałych modułów i globalnej nawigacji.

- `mockup/index.html` zawiera skrót na ekranie głównym i dialog modułu.
- `mockup/safety.js` renderuje poradniki, profil, plecak, tryb awaryjny i opcjonalne wywołanie asystenta.
- `mockup/safety.css` ogranicza dodatkowe style do modułu; tryb awaryjny włącza duży tekst, wysoki kontrast i ogranicza animacje.
- `mockup/safety-guides.json` zawiera dwujęzyczne poradniki, checklisty, źródła i pozycje plecaka.
- `mockup/safety-sw.js` buforuje aplikację i statyczne materiały modułu do późniejszego użycia offline; API AI nie jest buforowane.
- `serwer/safety.py` waliduje żądania, ogranicza prompt do lokalnych wskazówek i sprawdza strukturę odpowiedzi modelu.
- `serwer/server.py` wystawia `POST /api/safety/assist`.

## Źródła oraz status

Poradniki odsyłają do oficjalnego Rządowego Poradnika Bezpieczeństwa, RCB, PSP, MSWiA i IMGW. Pełne nazwy, daty przeglądu oraz adresy znajdują się w `safety-guides.json`. Treść w aplikacji jest ogólna i nie zastępuje instrukcji służb. Stan bieżący jest jawnie pokazany jako „Nieznany”: nie ma połączenia z kanałem alertów RCB, IMGW ani lokalnych władz i moduł nie wymyśla ostrzeżeń.

Numer 112 jest zwykłym, widocznym linkiem `tel:112`. Użytkownik musi sam go aktywować; aplikacja nie inicjuje połączeń ani zgłoszeń. Numery dodatkowe są pokazane wraz z zastrzeżeniem, że trzeba wybrać właściwy do sytuacji.

## Scenariusze i działanie

Statyczne przewodniki obejmują powódź/podtopienie, pożar/dym, awarię prądu, ekstremalną pogodę, gaz, wypadek/nagłe zagrożenie zdrowia, podejrzany przedmiot/zagrożenie publiczne, skażenie chemiczne, ewakuację i awarię wody. Każdy ma krótkie kroki, checklistę, typowe błędy i odnośniki do źródeł. Zaznaczenia checklist scenariusza i plecaka są zapisywane w `localStorage` tej przeglądarki.

Profil jest dobrowolny i ogranicza się do liczby domowników oraz ogólnych potrzeb (dzieci, seniorzy, mobilność, zwierzęta, regularna potrzeba leków i sprzętu pomocniczego). Nie zbiera nazwisk, adresów, diagnoz ani nazw leków. Profil można wyczyścić; sugestie plecaka zmieniają się zależnie od niego.

Jeśli użytkownik oznaczy bezpośrednie zagrożenie, formularz blokuje wysłanie do AI, prezentuje przypomnienie i link 112. Ta kontrola jest dodatkową barierą w UI, a nie zastępstwem decyzji operatora ani zabezpieczeniem przed bezpośrednim wywołaniem endpointu.

## AI, lokalizacja i zdjęcia

`POST /api/safety/assist` przyjmuje tylko typ zadania i scenariusz z listy, opis ograniczony długością, nieczułe pola profilu, checklistę, język i dobrowolnie udostępnione miejsce. Serwer odrzuca żądanie oznaczone jako bezpośrednie zagrożenie, waliduje dopuszczalne wartości i nie ujawnia modelowi narzędzi nawigacyjnych. Prompt zawiera statyczne źródłowe kroki; model nie ma kanału do pobrania bieżących alertów. Brak skonfigurowanego lub dostępnego dostawcy kończy się błędem i widocznym przejściem do już pokazanych poradników — nie generujemy odpowiedzi zastępczej.

Wysłanie opisu do skonfigurowanego dostawcy AI następuje po świadomym kliknięciu. Lokalizacja pozostaje wyłączona domyślnie i trafia do żądania tylko po zaznaczeniu zgody. Profil zawiera wyłącznie ogólne potrzeby. Zdjęcie może być wybrane do lokalnego podglądu, ale w tej wersji nie jest przesyłane ani analizowane; użytkownik ma to wyraźnie napisane.

Odpowiedź AI jest dodatkowa i niezweryfikowana. Nie diagnozuje, nie ocenia bezpieczeństwa na podstawie obrazu i nie może zastępować ani opóźniać kontaktu ze służbami. `call_emergency` z odpowiedzi dodaje wyraźny link do 112, nigdy automatyczne połączenie.

## Offline, dostępność i języki

Service Worker przechowuje shell aplikacji oraz `safety-guides.json`, po ich wcześniejszym pomyślnym pobraniu; bez tego pierwszego połączenia nie obiecuje dostępności offline. Żądania `/api/` omijają cache. Tryb offline daje wcześniej pobrane statyczne instrukcje, nie bieżące alerty i nie AI.

Panel działa po polsku i angielsku według `window.LANG`. Dialog jest częścią istniejącego zarządzania warstwami: zamyka się klawiszem Escape i przyciskiem Wstecz, a fokus jest ustawiany przy otwarciu. Cele dotykowe mają co najmniej 44 px, a natywne pola zachowują etykiety. Tryb awaryjny zapewnia większą typografię, wysoki kontrast i ograniczenie animacji. Test axe jest uzupełnieniem, nie dowodem pełnej zgodności WCAG 2.2 AA.

## Weryfikacja

- Jednostkowo: `python3 -m unittest discover -s tests -p 'test_safety.py'` (albo pełne odkrywanie: `python3 -m unittest discover -s tests -p 'test_*.py'`).
- Frontend: `npx playwright test tests/safety.spec.js`.
- Główny pasek przewijania jest ukryty CSS-em bez wyłączania `overflow-y:auto`; poziome przewijanie skrótów pozostaje niezależne.
