/* tryb skryptowy (bez serwera): zastrzec = w bankach (SDZ), zablokować = zawieszenie e-dowodu na 14 dni, unieważnić = na stałe */
const OFF={zastrz:false,zab:false,uniew:false};
const dPlus=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'})};
const S={
 async portfel(){
  await say('Przykro mi. Najpierw zadbajmy, żeby nikt nie użył Twoich dokumentów. Co było w portfelu?');
  multi(['Dowód osobisty','Prawo jazdy','Karty płatnicze','Karta Dużej Rodziny'],async sel=>{
   const dowod=sel.includes('Dowód osobisty'),pj=sel.includes('Prawo jazdy'),kdr=sel.includes('Karta Dużej Rodziny'),cards=sel.includes('Karty płatnicze');
   S.reszta={pj,kdr,cards};
   if(!dowod){await S.reszty();await S.koniec();return}
   await S.zastrzez();
  });
 },
 async zastrzez(){
  await say('Zastrzeżenie dowodu w bankach i blokadę na 14 dni zrobisz w oficjalnej usłudze; ten prototyp niczego nie wysyła. Pokażę, co przygotować. Jeśli portfel się znajdzie, odblokujesz dowód tak samo.');
  await confirmCard({icon:'shield',title:'Zastrzeżenie i blokada dowodu',source:'System Dokumenty Zastrzeżone (ZBP), Rejestr Dowodów Osobistych',rows:[['Dowód osobisty','ABC 123456'],['Zastrzeżenie','w bankach'],['Blokada','do '+dPlus(14)]],note:'Banki i operatorzy od razu zobaczą, że dowód jest zastrzeżony. Zastrzeżenie i blokadę cofniesz tutaj. Jeśli w ciągu 14 dni nie odblokujesz dowodu, zostanie unieważniony.',label:'Pokaż instrukcję',then:async()=>{
   OFF.zastrz=true;OFF.zab=true;
   await result({title:'Instrukcja zastrzeżenia i blokady dowodu',source:'godz. '+now(),rows:[['Zastrzeżenie','w bankach'],['Blokada','do '+dPlus(14)]]});
   await S.reszty();
   await S.koniec();
  }});
 },
 async reszty(){
  const r=S.reszta||{};S.reszta=null;
  if(r.pj)await say('Prawa jazdy nie zastrzeżesz w aplikacji. Utratę zgłosisz razem z wnioskiem o wtórnik przez ePUAP albo w wydziale komunikacji, opłata 100 zł.');
  if(r.kdr)await say('Karta Dużej Rodziny w telefonie działa dalej. Duplikat karty plastikowej zamówisz w gminie za 16 zł.');
  if(r.cards)await S.cards();
 },
 async koniec(){
  if(OFF.uniew){
   await say('Co dalej?');
   chips([{label:'Wniosek o nowy dowód',go:()=>S.renew('utrata')},{label:'Na razie wystarczy',go:()=>say('Gotowe. Zaświadczenie o utracie znajdziesz w skrzynce e-Doręczeń.')}]);
   return;
  }
  if(!OFF.zab){await say('Gotowe.');return}
  await say('Blokada nie zastrzega PESEL. Chcesz zastrzec go osobno?');
  chips([{label:'Zastrzeż PESEL',go:()=>S.pesel(S.koniec2)},{label:'Unieważnij dowód na stałe',go:S.uniewaznij},{label:'Na razie wystarczy',go:S.koniec2}]);
 },
 async koniec2(){await say('Gotowe. Jeśli portfel się nie znajdzie, unieważnię dowód i złożysz wniosek o nowy. Jeśli się znajdzie, napisz „znalazłam portfel”.')},
 async uniewaznij(){
  await say('Unieważnienie dowodu jest nieodwracalne, a PESEL zastrzeże się wtedy sam. Prototyp nie wykona tej czynności — pokażę tylko instrukcję.');
  await confirmCard({icon:'shield',title:'Unieważnienie dowodu',source:'Rejestr Dowodów Osobistych',rows:[['Dowód osobisty','ABC 123456'],['Unieważnienie','na stałe']],note:'Unieważnienia nie da się cofnąć, nawet gdy dokument się znajdzie. Twój PESEL zostanie zastrzeżony automatycznie. Zaświadczenie o utracie przyjdzie do skrzynki e-Doręczeń, ważne do 2 miesięcy, ale nie jest dokumentem tożsamości.',label:'Pokaż instrukcję',then:async()=>{
   OFF.uniew=true;OFF.zab=false;
   await result({title:'Instrukcja unieważnienia dowodu',source:'Rejestr Dowodów Osobistych, godz. '+now(),rows:[['Dowód osobisty','unieważniony'],['PESEL','zastrzeżony z urzędu']]});
   await say('Jeśli ktoś go ukradł, zgłoś kradzież na policji.');
   await S.koniec();
  }});
 },
 async znaleziony(){
  if(OFF.uniew){await say('Ten dowód jest już unieważniony i nie da się go przywrócić. Oddaj go w dowolnym urzędzie gminy. Nowy wniosek złożysz tutaj.');chips([{label:'Wniosek o nowy dowód',go:()=>S.renew('utrata')}]);return}
  if(!OFF.zastrz&&!OFF.zab){await say('Świetnie. Dowód nie był zastrzeżony ani zablokowany, więc nic nie trzeba cofać.');return}
  await confirmCard({icon:'shield',title:'Odblokowanie dowodu',source:'System Dokumenty Zastrzeżone, Rejestr Dowodów Osobistych',rows:[['Dowód osobisty','ABC 123456']].concat(OFF.zastrz?[['Zastrzeżenie w bankach','cofnę']]:[]).concat(OFF.zab?[['Blokada','cofnę']]:[]),note:'Cofniesz tylko zastrzeżenie zrobione w aplikacji. Zastrzeżenie z banku cofniesz w banku.',label:'Pokaż instrukcję',then:async()=>{
   OFF.zastrz=false;OFF.zab=false;
   await result({title:'Instrukcja odblokowania dowodu',source:'godz. '+now(),rows:[['Dowód osobisty','ważny, możesz go używać']]});
  }});
 },
 async cards(after){await say((after?'Zostały karty płatnicze. ':'')+'Kart nie zastrzegę za Ciebie, zrobi to bank. Najszybciej w aplikacji banku albo pod numerem <b>+48 828 828 828</b>, jeśli Twój bank jest w systemie Zastrzegam.pl. Zastrzeżonej karty nie da się odblokować, bank wyda nową.')},
 async pesel(next){
  if(OFF.uniew){await say('Twój PESEL jest już zastrzeżony z urzędu, bo dowód został unieważniony.');return}
  await confirmCard({icon:'shield',title:'Zastrzeżenie numeru PESEL',source:'Rejestr Zastrzeżeń PESEL',rows:[['PESEL','910714•••65'],['Od','teraz'],['Do','do odwołania']],note:'Bank czy firma pożyczkowa muszą sprawdzić zastrzeżenie przed udzieleniem kredytu. Do lekarza, apteki czy urzędu pójdziesz jak dotąd. Czasowe odblokowanie zrobisz tutaj w kilka sekund.',label:'Pokaż instrukcję',then:async()=>{await result({title:'Instrukcja zastrzeżenia numeru PESEL',source:'Rejestr Zastrzeżeń PESEL',rows:[['Status','zastrzeżony od '+now()],['Historia sprawdzeń','zobaczysz tutaj, kto i kiedy sprawdzał']]});if(typeof next==='function')await next()}});
 },
 async renew(powod){
  const pw=powod==='utrata'?'utrata dowodu':'kończy się ważność';
  await say('W tym prototypie nie wyślę wniosku — pokażę tylko, co przygotować i gdzie go złożyć. Wniosek złożysz na gov.pl, a w ciągu 30 dni musisz pójść do urzędu na odciski palców. Dowód odbierzesz tam osobiście.');
  await confirmCard({icon:'id',title:'Wniosek o dowód osobisty',source:'Rejestr PESEL, Rejestr Dowodów Osobistych',rows:[['Wnioskodawczyni','Marta Kowalska'],['Powód',pw],['Zdjęcie','z aparatu, urząd może poprosić o inne'],['Urząd','Urząd Dzielnicy Mokotów'],['Wizyta w urzędzie','do '+dPlus(30)+', odciski palców i podpis'],['Opłata','bezpłatnie']],label:'Pokaż instrukcję',then:async()=>{
   await result({title:'Instrukcja złożenia wniosku o dowód osobisty',source:'Twoje sprawy',rows:[['Numer wniosku','DO/2026/104 552'],['Teraz','idź do urzędu do '+dPlus(30).slice(0,5)+', odciski palców i podpis'],['Gotowy','do 30 dni od wizyty'],['Odbiór','osobiście w tym samym urzędzie']]});
   await say('Mogę pokazać przykład przypomnienia o wizycie. Prototyp nie wysyła powiadomień.');
   chips([{label:'Pokaż przykład przypomnienia',go:()=>result({title:'Przykładowe przypomnienie',rows:[['Przykładowa data',dPlus(23)+', 9:00'],['Powiadomienia','w prototypie nie są wysyłane']]})},{label:'Na razie nie'}]);
  }});
 },
 async stluczka(){
  await say('Najpierw najważniejsze: czy ktoś jest ranny?');
  chips([{label:'Tak',go:()=>info({icon:'alert',tone:'warn',title:'Zadzwoń pod 112',body:'Przy rannych nie spisujemy oświadczenia. Zadbaj o bezpieczeństwo, włącz światła awaryjne i ustaw trójkąt.'})},
   {label:'Nie, nikt nie jest ranny',go:S.stl2}]);
 },
 async stl2(){
  await say('Dobrze. mStłuczka zadziała, jeśli oboje macie mObywatela, oba auta mają polską rejestrację i zgadzacie się, kto zawinił. Pokażę Twój znak, a drugi kierowca zeskanuje go w swoim mObywatelu i przekaże Ci swoje dane.');
  await sleep(500);przyjmijFlow({cel:'mstluczka'}).then(async response=>{
   if(!response.ok){await say('Zamknięto ekran przyjmowania danych. Niczego nie otrzymano.');return}
   await say('W symulacji pokazuję przykładowe dane obu stron. Nie sprawdzono rejestrów.');
   await info({icon:'car',title:'Uczestnicy zdarzenia',source:'CEPiK, rejestr PESEL, lokalizacja: ul. Puławska 145, Warszawa',rows:[['Ty','Toyota Corolla, WX 4521K, OC Warta'],['Drugi kierowca','Piotr Nowak, Skoda Octavia, WPI 22R31, OC PZU']]});
   await say('Kto spowodował zdarzenie?');
   chips([{label:'Drugi kierowca',go:()=>S.stl3('Piotr Nowak, WPI 22R31',true)},{label:'Ja',go:()=>S.stl3('Marta Kowalska, WX 4521K',false)},{label:'Nie jesteśmy zgodni',go:()=>say('Wtedy mStłuczka nie zadziała. Wezwij policję pod numer <b>112</b>. Dane obu pojazdów mam zapisane, przekażę je funkcjonariuszom.')}]);
  });
 },
 async stl3(sprawca,poszkodowana){
  await say('Co się stało? Wybierz albo opisz własnymi słowami.');
  const fin=async opis=>{await say('Dodaj zdjęcia uszkodzeń, dołączę je do oświadczenia.');
   chips([{label:'Dodaj 3 zdjęcia',say:'📷 3 zdjęcia',go:async()=>{
    await confirmCard({icon:'doc',title:'Oświadczenie o zdarzeniu drogowym',source:'mStłuczka, CEPiK, rejestr PESEL',rows:[['Data',today()+', '+now()],['Miejsce','ul. Puławska 145, Warszawa'],['Sprawca',sprawca],['Okoliczności',opis],['Zdjęcia','3'],['Potwierdzenie','obie strony w mObywatelu']],note:'Dostaniecie oboje PDF z pieczęcią elektroniczną ministra cyfryzacji.',label:'Pokaż instrukcję',then:async()=>{
     await result({title:'Instrukcja oświadczenia o zdarzeniu drogowym',source:'Zapisane w mStłuczce',rows:[['Numer','mS/2026/88 410'],['PDF','u obu kierowców']]});
     if(!poszkodowana){await say('Szkodę zgłosi drugi kierowca do Twojego ubezpieczyciela. Oświadczenie już ma.');return}
     await say('Zgłosić szkodę do ubezpieczyciela sprawcy? Przekażę oświadczenie i zdjęcia.');
     chips([{label:'Zgłoś szkodę',go:()=>confirmCard({icon:'car',title:'Przykładowe zgłoszenie szkody',rows:[['Oświadczenie','przykładowy dokument'],['Załączniki','3 przykładowe zdjęcia'],['Odbiorca','ubezpieczyciel sprawcy']],note:'W rzeczywistej usłudze przed wysłaniem sprawdź odbiorcę i zakres przekazywanych danych.',label:'Pokaż instrukcję',then:()=>result({title:'Symulacja zgłoszenia szkody',rows:[['Status','niczego nie przekazano ubezpieczycielowi']]})})},{label:'Nie teraz'}]);
    }});
   }}]);
  };
  chips(['Cofał z miejsca parkingowego','Nie zachował odstępu','Wymusił pierwszeństwo'].map(o=>({label:o,go:()=>fin(o)})));
  pending=t=>fin(t);
 },
 async auto(){
  await say('W symulacji pokażę przykładową historię auta, OC i badań. Nie sprawdzę rejestrów. Możesz zobaczyć przykładowe dane z dokumentu.');
  chips([{label:'Pokaż przykładowe dane ze zdjęcia',say:'Przykładowe dane z dokumentu',go:S.auto2},{label:'WE 4K221',go:S.autoNr}]);
  pending=()=>S.autoNr();
 },
 async autoNr(){
  await say('Do historii pojazdu potrzebuję jeszcze VIN i daty pierwszej rejestracji. Poproś sprzedającego o zdjęcie dowodu rejestracyjnego.');
  chips([{label:'Pokaż przykładowe dane ze zdjęcia',say:'Przykładowe dane z dokumentu',go:S.auto2}]);
 },
 async auto2(){
  await say('To dane przykładowe, nie odczytano zdjęcia ani nie sprawdzono rejestrów: <b>WE 4K221</b>, VIN WVWZZZAUZKW118204, pierwsza rejestracja 14.03.2019.');
  await info({icon:'car',title:'Volkswagen Golf 1.5 TSI, 2019',source:'Historia pojazdu (CEPiK), UFG',rows:[['Właściciele','3, ostatnia zmiana 08.2026'],['OC','ważne do 02.2027'],['Badanie techniczne','ważne do 05.2027'],['Szkoda istotna','1 (2022), zgłosił ubezpieczyciel'],['Kradzież, wyrejestrowanie','brak']],flag:'Przebieg się nie zgadza: w 2024 r. 112 300 km, w 2025 r. 87 400 km. Możliwe cofnięcie licznika.'});
  await say('Zapytaj sprzedającego o różnicę w przebiegu. Coś jeszcze?');
  chips([{label:'Ile zapłacę PCC?',go:()=>say('Podatek PCC to 2% wartości rynkowej auta. Przy wartości 62 000 zł wyjdzie <b>1 240 zł</b>, płatne w 14 dni od umowy. Nie płacisz go, gdy kupujesz od firmy na fakturę. PCC-3 złożę tutaj, w e-Urzędzie Skarbowym.')},
   {label:'Przygotuj umowę kupna-sprzedaży',go:async()=>{await say('Przygotuję umowę. Podpiszecie ją oboje w mObywatelu, podpisem zaufanym albo osobistym. Potem złożysz tutaj PCC-3, a auto zarejestrujesz w wydziale komunikacji w ciągu 30 dni. Tablice i dowód rejestracyjny odbierzesz w urzędzie.');
    await confirmCard({icon:'doc',title:'Umowa kupna-sprzedaży pojazdu',source:'CEPiK, rejestr PESEL',rows:[['Pojazd','VW Golf, WE 4K221'],['Sprzedający','Marek Zieliński'],['Kupująca','Marta Kowalska'],['Cena','62 000 zł'],['Podpis','podpis zaufany lub osobisty, Twój i sprzedającego']],label:'Pokaż instrukcję',then:()=>result({title:'Instrukcja przygotowania umowy kupna-sprzedaży',source:'Czeka na podpis sprzedającego',rows:[['Dalej','PCC-3 w 14 dni, tutaj'],['Rejestracja','w wydziale komunikacji w 30 dni']]})})}}]);
 },
 async dziecko(){
  await say('Gratulacje! Na zgłoszenie urodzenia masz 21 dni od wystawienia karty urodzenia. Zrobimy to teraz. Jak dziecko będzie miało na imię?');
  chips([{label:'Helena',go:()=>S.dz2('Helena')},{label:'Ignacy',go:()=>S.dz2('Ignacy')},{label:'Wpiszę sama',go:async()=>{await say('Napisz imię poniżej. Najwyżej dwa imiona, w pełnej formie, nie zdrobnienie.');pending=t=>S.dz2(t.trim());input.focus()}}]);
  pending=t=>S.dz2(t.trim());
 },
 async dz2(name){
  if(!/^[\p{L}]+(?:[ -][\p{L}]+)?$/u.test(name)||name.length>50){input.value=name;pending=t=>S.dz2(t.trim());announce('Popraw imię dziecka. Wpisz jedno lub dwa imiona, używając liter.');await say('Popraw imię dziecka. Wpisz jedno lub dwa imiona, używając liter.');return}
  const nm=name.charAt(0).toUpperCase()+name.slice(1),fem=/a$/i.test(nm);
  await say('Sprawdź dane. Szpital przekazuje kartę urodzenia prosto do USC.');
  await confirmCard({icon:'baby',title:'Zgłoszenie urodzenia dziecka',source:'Rejestr PESEL, USC',rows:[['Dziecko',nm+' '+(fem?'Kowalska':'Kowalski')],['Data urodzenia','16.10.2026'],['Miejsce','Szpital Bielański, Warszawa'],['Drugi rodzic','Tomasz Kowalski'],['Zameldowanie','ul. Kwiatowa 12, Warszawa'],['Odpis aktu','elektronicznie, do skrzynki'],['Termin','21 dni od wystawienia karty urodzenia'],['Opłata','bezpłatnie']],label:'Pokaż instrukcję',then:async()=>{
   await result({title:'Instrukcja zgłoszenia urodzenia dziecka',source:'Twoje sprawy',rows:[['Status','zgłoszenie wysłane do USC'],['PESEL i akt','zwykle następnego dnia roboczego'],['Odpis skrócony aktu','bezpłatnie, do Twojej skrzynki'],['Ubezpieczenie zdrowotne','zgłosi pracodawca (ZUS ZCNA), przekaż mu PESEL dziecka w ciągu 7 dni']]});
   await say('Mogę też złożyć wniosek o 800+ i o Kartę Dużej Rodziny dla '+(fem?'córki':'syna')+'.');
   chips([{label:'Złóż wniosek o 800+',go:()=>confirmCard({icon:'coin',title:'Wniosek o świadczenie 800+',source:'ZUS, rejestr PESEL',rows:[['Dziecko',nm],['Kwota','800 zł miesięcznie'],['Od kiedy','od dnia urodzenia, jeśli wyślesz w ciągu 3 miesięcy'],['Okres','do 31.05.2027, potem nowy wniosek od 1 lutego'],['Konto do wypłaty','PL •• 4412']],label:'Pokaż instrukcję',then:()=>result({title:'Instrukcja wniosku o świadczenie 800+',rows:[['Odpowiedź','na Twoje konto w eZUS, zwykle w ciągu miesiąca'],['Wypłata','z wyrównaniem od dnia urodzenia']]})})},
    {label:'Karta Dużej Rodziny',go:()=>confirmCard({icon:'doc',title:'Wniosek o Kartę Dużej Rodziny',source:'Emp@tia, Urząd m.st. Warszawy',rows:[['Dla',nm],['Rodzaj','karta w mObywatelu'],['Karty dzieci w Twoim mObywatelu','tak'],['Opłata','bezpłatnie']],label:'Pokaż instrukcję',then:()=>result({title:'Instrukcja wniosku o Kartę Dużej Rodziny',source:'Emp@tia',rows:[['Karta dziecka','w portfelu po przyznaniu przez gminę'],['Karta plastikowa','odbiór w urzędzie, dostaniesz SMS']]})})}]);
  }});
 },
 async todo(){
  await say('Oto, co czeka na Ciebie:');
  const c=await card(`<div class="ui list">${hd('bell','Do załatwienia')}
   <button class="it" data-k="letter"><span class="pip"></span><span class="x"><b>Pismo z Urzędu Skarbowego</b><small>Odpowiedź do 26.10</small></span><span class="go">Otwórz</span></button>
   <button class="it" data-k="oc"><span class="pip"></span><span class="x"><b>Koniec okresu OC Toyoty 29.10</b><small>Za 11 dni</small></span><span class="go">Sprawdź</span></button>
   <button class="it" data-k="pay"><span class="pip"></span><span class="x"><b>Podatek od nieruchomości</b><small>210 zł do 16.11</small></span><span class="go">Zapłać</span></button>${srcH('Skrzynka, ePłatności, CEPiK')}</div>`);
  c.querySelectorAll('.it').forEach(b=>b.onclick=()=>act(()=>{addUser(b.querySelector('b').textContent);S[b.dataset.k]()}));
 },
 async letter(){
  await info({icon:'mail',title:'Wezwanie do złożenia wyjaśnień',source:'e-Doręczenia, Urząd Skarbowy Warszawa-Mokotów, odebrane 17.10',body:'Urząd prosi o udokumentowanie ulgi termomodernizacyjnej z zeznania PIT-37 za 2025 r. za dom jednorodzinny przy ul. Kwiatowej 12. Wymagane są faktury za materiały i usługi. Termin: <b>7 dni</b> od odebrania. 24.10 to sobota, więc masz czas do poniedziałku 26.10.'});
  await say('W Twoich plikach są 3 faktury za docieplenie z 2025 r. Przygotować odpowiedź z załącznikami?');
  chips([{label:'Przygotuj odpowiedź',go:async()=>{
   await info({icon:'doc',title:'Szkic odpowiedzi',body:'W odpowiedzi na wezwanie z dnia 16.10.2026 przekazuję faktury dokumentujące wydatki na termomodernizację domu jednorodzinnego przy ul. Kwiatowej 12, objęte ulgą w zeznaniu PIT-37 za 2025 r.<br><br>Załączniki: FV 2025/03/118, FV 2025/04/022, FV 2025/05/301.'});
   await confirmCard({icon:'mail',title:'Wysyłka przez e-Doręczenia',source:'Do: US Warszawa-Mokotów',rows:[['Załączniki','3 faktury (PDF)'],['Podpis','podpis zaufany']],label:'Pokaż instrukcję',then:()=>result({title:'Instrukcja wysłania odpowiedzi przez e-Doręczenia',source:'e-Doręczenia, dowód otrzymania',rows:[['Dowód otrzymania','godz. '+now()],['Sprawa','w Twoich sprawach']]})});
  }},{label:'Później'}]);
 },
 async oc(){
  await info({icon:'car',title:'OC: Toyota Corolla, WX 4521K',source:'UFG, CEPiK',rows:[['Ubezpieczyciel','Warta'],['Koniec okresu','29.10.2026']],note:'Umowa OC zwykle przedłuża się sama na kolejny rok, jeśli jej nie wypowiesz. Sprawdź to u ubezpieczyciela.'});
  await say('Mogę pokazać przykład przypomnienia. Prototyp nie wysyła powiadomień.');
  chips([{label:'Pokaż przykład przypomnienia',go:()=>result({title:'Przykładowe przypomnienie',rows:[['Przykładowa data','25.10.2026, 9:00'],['Powiadomienia','w prototypie nie są wysyłane']]})},{label:'Nie trzeba'}]);
 },
 async pay(){
  await confirmCard({icon:'coin',title:'Podatek od nieruchomości',source:'ePłatności, Urząd m.st. Warszawy',rows:[['Rata','IV, 2026'],['Kwota','210,00 zł'],['Termin','16.11.2026'],['Płatność','Apple Pay']],label:'Pokaż instrukcję',then:()=>result({title:'Instrukcja zapłaty podatku od nieruchomości',source:'ePłatności',rows:[['Kwota','210,00 zł'],['Potwierdzenie','EP/2026/7 214 088'],['Prowizja','brak']]})});
 },
 async sms(){
  await say('Możesz wpisać treść wiadomości bez danych osobowych lub zobaczyć przykład. Ten prototyp nie weryfikuje prawdziwych wiadomości.');
  chips([{label:'Pokaż przykładowy SMS',say:'„Poczta: paczka zatrzymana z powodu braku opłaty 1,20 zł. Opłać: poczta-dostawa24.top/pl”',go:S.sms2}]);
  pending=()=>S.smsUnverified();
 },
 async smsUnverified(){
  await info({icon:'alert',tone:'warn',title:'Nie mogę zweryfikować wiadomości',body:'Ten prototyp nie sprawdza prawdziwych wiadomości ani linków. Nie otwieraj podejrzanych odnośników i nie podawaj haseł, kodów SMS ani danych logowania. Skontaktuj się z nadawcą przez znany Ci oficjalny kanał.'});
  await say('Więcej zasad znajdziesz w sekcji „Czy to bezpieczne?”.');
 },
 async sms2(){
  await info({icon:'alert',tone:'warn',title:'Przykład podejrzanej wiadomości',source:'Dane przykładowe, nie są wynikiem sprawdzenia CERT Polska',rows:[['Domena','poczta-dostawa24.top'],['Przykładowy wzorzec','fałszywa dopłata do przesyłki']]});
  await say('Nie otwieraj linku. Czy podałaś na tej stronie dane karty albo logowania do banku?');
  chips([{label:'Nie, tylko przeczytałam',go:S.cert},{label:'Tak, podałam dane karty',go:async()=>{await S.cards();await S.cert()}}]);
 },
 async cert(){
  await confirmCard({icon:'shield',title:'Zgłoszenie do CERT Polska',source:'Bezpiecznie w sieci',rows:[['Kategoria','Złośliwa strona internetowa'],['Adres','poczta-dostawa24.top'],['Skąd','link z SMS-a']],label:'Pokaż instrukcję',then:async()=>{await result({title:'Instrukcja zgłoszenia do CERT Polska',source:'Dane przykładowe',rows:[['Status','w pokazie niczego nie wysłano'],['SMS','podejrzaną wiadomość można zgłosić pod numer 8080']]});await say('To była tylko symulacja. Podejrzanego SMS-a możesz przesłać na bezpłatny numer <b>8080</b>. Sprawdź aktualny sposób zgłoszenia na stronie CERT Polska.')}});
 },
 async punkty(){
  await info({icon:'clock',title:'Punkty karne: 5',source:'CEPiK',rows:[['Wykroczenie','prędkość +21–25 km/h, 12.05.2026'],['Wygasają','12.05.2027'],['Limit','24 pkt']],note:'Punkty wygasają po roku od opłacenia mandatu.'});
 },
 async docShow(id){
  const d=DOCS.find(x=>x.id===id)||DOCS[0];
  const c=await card(`<div class="ui"><div style="padding:12px 12px 0"><div class="bigcard" style="background-image:url(${d.img});box-shadow:none">${faceHTML(d)}</div></div><dl class="rows" style="padding-top:6px">${rowsH(d.rows)}</dl><div class="actions"><button class="btn primary">Potwierdź swoje dane</button></div></div>`);
  c.querySelector('.btn').onclick=()=>qrFlow({doc:id});
 },
 async dowodWaz(){const d=DOCS.find(x=>x.id==='dowod');const date=(d.f.find(([k])=>k==='Dowód ważny do')||[])[1]||'brak daty';await say('Przykładowy dowód jest ważny do <b>'+esc(date)+'</b>. To fikcyjne dane, nie sprawdziliśmy rejestru. Sprawdź termin na swoim dokumencie lub w urzędzie.')},
 async kdr(){await say('Z Kartą Dużej Rodziny masz ulgę 37% na pociągi (49% na bilet miesięczny), bezpłatny wstęp do parków narodowych i zniżki u partnerów. Pokazać partnerów w Twojej okolicy?');chips([{label:'Pokaż w okolicy',go:()=>info({icon:'doc',title:'Partnerzy KDR w pobliżu',source:'Wyszukiwarka partnerów KDR (empatia.gov.pl)',rows:[['Muzeum w okolicy','zniżka na bilet rodzinny'],['Basen miejski','zniżka na wejście'],['Orlen','8 gr/l, paliwa premium 10 gr/l']]})}])},
 async fallback(){await say('Tego w tej wersji jeszcze nie załatwię. Najbliżej pasuje:');chips([{label:'Co mam do załatwienia?',go:S.todo},{label:'Zgubiłam portfel',go:S.portfel},{label:'Kupuję używane auto',go:S.auto}])}
};

const norm=t=>t.toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function route(t){
 if(typeof agentSend==='function')return agentSend(t);
 if(!input.value)input.value=t;
 announce('Asystent jest niedostępny. Wiadomość można wysłać ponownie.');
 return say('Asystent AI jest niedostępny. Żadna czynność nie została wykonana. Sprawdź połączenie i spróbuj ponownie.');
}

$('#histBtn').onclick=()=>app.classList.contains('hist')?closeHist():openHist();
$('#newBtn').onclick=()=>{closeHist();newConv();input.focus()};
$('#hmenu .scrim').onclick=closeHist;
$('#hnew').onclick=()=>{closeHist();newConv();input.focus()};
$('#clearHistory').onclick=clearHistory;
$('#homeBtn').onclick=()=>{
 // na ekranie głównym orzełek prowadzi na stronę startową (z prefiksem języka, np. /de/)
 if(!app.classList.contains('chatting')&&!$('#detail').classList.contains('on')){const m=location.pathname.match(/^\/([a-z]{2})\//);location.href=m?'/'+m[1]+'/':'/';return}
 detailReturn=null;$('#detail').classList.remove('on');exitChat();$('#tiles').scrollTo({left:0,behavior:scrollBehavior()})};
$('#mailBtn').onclick=()=>{closeHist();startTopic('Co mam w skrzynce?')};
$('#bellBtn').onclick=()=>{closeHist();startTopic('Co mam do załatwienia?')};
$('#composer').onsubmit=e=>{e.preventDefault();const t=input.value.trim();if(!t){enterChat();return}input.value='';send(t)};
$('#mic').onclick=()=>openHelp('voice');
$('#cam').onclick=()=>{enterChat();act(()=>say('Odczyt zdjęcia dokumentu nie jest dostępny. Nie wykonano żadnej czynności.'))};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(app.classList.contains('hist')){closeHist();return}$('#detail').classList.remove('on');exitChat()}});
layout();
document.fonts&&document.fonts.ready.then(layout);
