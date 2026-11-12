const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const elements = [
  { type: 'node', id: 101, lat: 52.2300, lon: 21.0100, tags: { amenity: 'townhall', name: 'Urząd Miasta Testowego', 'addr:street': 'Testowa', 'addr:housenumber': '1', 'addr:city': 'Warszawa' } },
  { type: 'way', id: 102, center: { lat: 52.2302, lon: 21.0101 }, tags: { office: 'government', name: 'Starostwo Powiatowe Testowe' } },
  { type: 'node', id: 103, lat: 52.2304, lon: 21.0102, tags: { office: 'government', name: 'Urząd Skarbowy Testowy' } },
  { type: 'node', id: 104, lat: 52.2306, lon: 21.0103, tags: { office: 'government', name: 'ZUS Testowy' } },
  { type: 'node', id: 105, lat: 52.2308, lon: 21.0104, tags: { office: 'government', name: 'Punkt Paszportowy Testowy' } },
  { type: 'node', id: 106, lat: 52.2310, lon: 21.0105, tags: { office: 'government', name: 'Punkt Obsługi Mieszkańców Testowy' } },
  { type: 'node', id: 107, lat: 52.2312, lon: 21.0106, tags: { amenity: 'pharmacy', name: 'Apteka Testowa', opening_hours: 'Mo-Fr 08:00-18:00', phone: '+48 111 222 333', website: 'https://example.com/apteka', 'addr:street': 'Testowa', 'addr:housenumber': '7', 'addr:city': 'Warszawa', wheelchair: 'yes' } },
  { type: 'node', id: 108, lat: 52.2314, lon: 21.0107, tags: { amenity: 'doctors', name: 'Przychodnia Testowa' } },
  { type: 'node', id: 109, lat: 52.2316, lon: 21.0108, tags: { amenity: 'hospital', name: 'Szpital Testowy' } },
  { type: 'node', id: 110, lat: 52.2318, lon: 21.0109, tags: { amenity: 'police', name: 'Komisariat Testowy' } },
  { type: 'node', id: 111, lat: 52.2320, lon: 21.0110, tags: { office: 'government', name: 'ARiMR Testowa' } },
  { type: 'node', id: 112, lat: 52.2322, lon: 21.0111, tags: { office: 'government', name: 'Zarząd Dróg Wojewódzkich Testowy' } },
  { type: 'node', id: 113, lat: 52.2324, lon: 21.0112, tags: { amenity: 'atm' } },
  { type: 'node', id: 114, lat: 52.2326, lon: 21.0113, tags: { amenity: 'bench', name: 'Ławka' } }
];

async function open(page, path = '/aplikacja') {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto(path);
}

async function mapServices(page, options = {}) {
  const calls = { geocode: [], overpass: [], tiles: [] };
  await page.route('https://nominatim.openstreetmap.org/**', route => {
    calls.geocode.push(route.request().url());
    return route.fulfill(options.geocode || { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa, Polska' }] });
  });
  await page.route('https://overpass-api.de/**', route => {
    calls.overpass.push(route.request().postData());
    return route.fulfill(options.overpass || { json: { elements } });
  });
  await page.route('https://tile.openstreetmap.org/**', route => {
    calls.tiles.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==', 'base64') });
  });
  return calls;
}

async function searchMap(page, location = 'Warszawa') {
  await page.locator('#openMap').click();
  await page.locator('#placeLocation').fill(location);
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapResults')).toBeVisible();
}

async function checkAxe(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
}

test('tłumacz pisma pokazuje cytowane fakty i nie wymyśla terminu, a panel działa z klawiaturą', async ({ page }) => {
  await open(page);
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/api/letter/explain', route => route.fulfill({ json: { result: {
    meaning: { text: 'Urząd prosi o wyjaśnienie sprawy.', source: 'Prosimy o złożenie wyjaśnień.' },
    actions: [{ text: 'Przygotuj i złóż wyjaśnienia.', source: 'Prosimy o złożenie wyjaśnień.', kind: 'fact' }],
    deadline: null,
    documents: [{ text: 'Dołącz kopię faktury.', source: 'Prosimy dołączyć kopię faktury.', kind: 'fact' }]
  } } }));
  await page.locator('.module-services summary').click();
  await page.locator('#openLetterModule').click();
  await expect(page.locator('#letterBack')).toBeFocused();
  await expect(page.locator('#letterPanel')).toContainText('rozpoznajemy automatycznie (OCR)');
  await page.locator('#letterText').fill('Prosimy o złożenie wyjaśnień. Prosimy dołączyć kopię faktury.');
  await page.locator('#letterConsent').check();
  await page.locator('#explainLetter').click();
  await expect(page.locator('#letterResults')).toContainText('Urząd prosi o wyjaśnienie sprawy.');
  await expect(page.locator('#letterResults')).toContainText('W tekście nie znaleziono jednoznacznie podanego terminu');
  await expect(page.locator('#letterResults')).toContainText('Fakt z pisma');
  await expect(page.locator('#letterResults')).toContainText('Prosimy dołączyć kopię faktury.');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#letterPanel')).not.toHaveClass(/on/);
});

test('centrum rodzinne rozdziela zadanie prywatne i wspólne oraz ogranicza widok czytelnika', async ({ page }) => {
  await open(page);
  await page.locator('.module-services summary').click();
  await page.locator('#openFamilyModule').click();
  await expect(page.locator('#familyBack')).toBeFocused();
  await page.locator('#familyMemberName').fill('Opiekun');
  await page.locator('#familyMemberRole').selectOption('viewer');
  await page.locator('#familyMemberForm button[type="submit"]').click();
  await expect(page.locator('#familyView')).toHaveValue(/.+/);
  await expect(page.locator('#familyView')).toContainText('Opiekun, Czytelnik');
  await expect(page.locator('#familyTaskForm')).toBeHidden();
  await page.locator('#familyView').selectOption('me');
  await page.locator('#familyTaskTitle').fill('Wizyta u lekarza');
  await page.locator('#familyTaskForm button[type="submit"]').click();
  await expect(page.locator('#familyTasks')).toContainText('Prywatne zadanie');
  await page.locator('#familyTaskTitle').fill('Spotkanie rodzinne');
  await page.locator('#familyTaskShared').check();
  await page.locator('#familyTaskForm button[type="submit"]').click();
  await expect(page.locator('#familyTasks')).toContainText('Spotkanie rodzinne');
  await page.locator('#familyView').selectOption({ label: 'Opiekun, Czytelnik' });
  await expect(page.locator('#familyTasks')).not.toContainText('Wizyta u lekarza');
  await expect(page.locator('#familyTasks')).toContainText('Spotkanie rodzinne');
  await expect(page.locator('#familyPanel')).toContainText('Nie ma tu logowania');
  await expect(page.locator('#familyPanel')).toContainText('Nie ma dostępu do cudzych dokumentów');
  await page.keyboard.press('Escape');
  await expect(page.locator('#familyPanel')).not.toHaveClass(/on/);
});

test('profil jest widoczny, trwały i zachowuje oddzielne indywidualne ustawienia', async ({ page }) => {
  await open(page);
  await page.locator('#prompt').fill('Niezapisany szkic');
  await expect(page.locator('#homeSenior')).not.toBeChecked();
  await page.locator('#openAccess').click();
  await page.locator('input[name="accessFont"][value="extra"]').check();
  await page.locator('#highContrast').check();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'extra');
  await page.locator('#panelSenior').check();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'large');
  await expect(page.locator('#simpleMenu')).toBeChecked();
  await expect(page.locator('#reduceMotion')).toBeChecked();
  await expect(page.locator('#highContrast')).not.toBeChecked();
  await page.locator('input[name="accessFont"][value="standard"]').check();
  await page.locator('#readingEnabled').check();
  await page.locator('#simpleMenu').uncheck();
  await page.locator('#accessBack').click();
  await expect(page.locator('#prompt')).toHaveValue('Niezapisany szkic');
  await expect(page.locator('#homeSenior')).toBeChecked();
  await page.locator('#homeSenior').uncheck();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'extra');
  await expect(page.locator('#app')).toHaveClass(/access-contrast/);
  await page.locator('#homeSenior').check();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'standard');
  await expect(page.locator('#app')).not.toHaveClass(/simple-menu/);
  await expect(page.locator('#app')).toHaveClass(/reading-enabled/);
  await page.reload();
  await expect(page.locator('#homeSenior')).toBeChecked();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'standard');
  await page.locator('#openAccess').click();
  await expect(page.locator('#readingEnabled')).toBeChecked();
  await expect(page.locator('#simpleMenu')).not.toBeChecked();
  await page.locator('#panelSenior').uncheck();
  await expect(page.locator('#highContrast')).toBeChecked();
  await expect(page.locator('input[name="accessFont"][value="extra"]')).toBeChecked();
});

test('uproszczone menu nie usuwa dokumentów ani pozostałych usług', async ({ page }) => {
  await open(page);
  await page.locator('#homeSenior').check();
  await expect(page.locator('#seniorTasksTitle')).toBeVisible();
  await expect(page.locator('#seniorDocuments')).toBeVisible();
  await page.locator('.more-services summary', { hasText: 'Więcej usług' }).click();
  await expect(page.locator('#seniorReminders')).toBeVisible();
  await expect(page.locator('#seniorHelp')).toBeVisible();
  await page.locator('#seniorReminders').click();
  await expect(page.locator('#exampleReminder')).toBeFocused();
  await page.locator('#seniorDocuments').click();
  await expect(page.locator('#stack .card-open').first()).toBeFocused();
  await page.getByRole('button', { name: 'Otwórz mDowód' }).click();
  await expect(page.locator('#detail')).toHaveClass(/on/);
  await expect(page.locator('#detail')).toContainText('Przykładowy dokument');
});

test('ustawienie odczytu dodaje ręczne przyciski bez automatycznego mówienia', async ({ page }) => {
  await page.addInitScript(() => {
    window.reads = [];
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak: utterance => window.reads.push(utterance.text) }, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  await open(page);
  await page.locator('#openAccess').click();
  await page.locator('#readingEnabled').check();
  expect(await page.evaluate(() => window.reads.length)).toBe(0);
  await expect(page.locator('#accessPanel [data-read]')).toBeVisible();
  await page.locator('#accessPanel [data-read]').click();
  await expect.poll(() => page.evaluate(() => window.reads.length)).toBe(1);
  await expect(page.locator('#accessPanel .speech-status')).toContainText('Trwa odczyt');
  await page.locator('#accessPanel [data-stop]').click();
  await expect(page.locator('#accessPanel .speech-status')).toContainText('Odczyt zatrzymany');
  await page.locator('#readingEnabled').uncheck();
  await expect(page.locator('#accessPanel [data-read]')).not.toBeVisible();
});

test('systemowe ograniczenie animacji działa niezależnie od ustawienia profilu', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await expect(page.locator('#app')).not.toHaveClass(/reduce-motion/);
  const duration = await page.locator('#helpPanel').evaluate(node => getComputedStyle(node).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.001);
  await page.locator('#openAccess').click();
  await page.locator('#reduceMotion').check();
  await page.locator('#reduceMotion').uncheck();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(parseFloat(await page.locator('#helpPanel').evaluate(node => getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
});

test('mapa pobiera dane dopiero po wyborze lokalizacji i obsługuje wszystkie rodzaje placówek', async ({ page }) => {
  const calls = await mapServices(page);
  await open(page);
  await page.locator('#openMap').click();
  expect(calls.geocode).toHaveLength(0);
  expect(calls.overpass).toHaveLength(0);
  expect(calls.tiles).toHaveLength(0);
  await page.locator('#placeLocation').fill('Warszawa');
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapResults')).toBeVisible();
  await expect(page.locator('#placeCount')).toHaveText('13 miejsc');
  expect(calls.geocode).toHaveLength(1);
  expect(calls.overpass).toHaveLength(1);
  expect(new URLSearchParams(calls.overpass[0]).get('data')).toContain('around:6000,52.230000,21.010000');
  await expect(page.locator('#placeList .place-summary')).toHaveCount(13);
  await expect(page.locator('#placeList')).not.toContainText('Ławka');
  for (const kind of ['municipal', 'county', 'tax', 'zus', 'passport', 'resident', 'pharmacy', 'primary', 'hospital', 'police', 'arimr', 'roads', 'atm']) {
    await page.locator('#placeType').selectOption(kind);
    await expect(page.locator('#placeList .place-summary')).toHaveCount(1);
  }
  await page.locator('#placeType').selectOption('');
  await expect(page.locator('.map-attribution a')).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(page.locator('#placeMap')).toBeVisible();
  await expect.poll(() => calls.tiles.length).toBeGreaterThan(0);
});

test('sprawa podpowiada placówkę, wyszukiwarka rozpoznaje temat i dane niepełne są oznaczone', async ({ page }) => {
  await mapServices(page);
  await open(page);
  await searchMap(page);
  await page.locator('#placeTask').selectOption('tax');
  await expect(page.locator('#placeType')).toHaveValue('tax');
  await expect(page.locator('#taskHint')).toContainText('podatkowych');
  await expect(page.locator('#placeList')).toContainText('Urząd Skarbowy Testowy');
  await page.locator('#placeType').selectOption('');
  await page.locator('#placeFilter').fill('emerytura');
  await expect(page.locator('#placeList .place-summary')).toHaveCount(1);
  await expect(page.locator('#placeList')).toContainText('ZUS Testowy');
  await page.locator('#placeList .place-summary').click();
  await expect(page.locator('.place-details')).toContainText('Brak danych w OpenStreetMap');
  await page.locator('#placeFilter').fill('coś nieistniejącego');
  await expect(page.locator('#placeList')).toContainText('Nie znaleziono pasujących miejsc');
});

test('szczegóły miejsca pokazują rzeczywiste pola, zastrzeżenia i bezpieczny link dojazdu', async ({ page }) => {
  await mapServices(page);
  await open(page);
  await searchMap(page);
  await page.locator('#placeType').selectOption('pharmacy');
  await page.locator('#placeList .place-summary').click();
  const details = page.locator('.place-details');
  await expect(details).toContainText('Testowa 7, Warszawa');
  await expect(details).toContainText('Mo-Fr 08:00-18:00');
  await expect(details).toContainText('Dostępna według OSM');
  await expect(details).toContainText('mogą być nieaktualne');
  await expect(details.getByRole('link', { name: '+48 111 222 333' })).toHaveAttribute('href', 'tel:+48111222333');
  await expect(details.getByRole('link', { name: 'Wyznacz dojazd' })).toHaveAttribute('href', /openstreetmap\.org\/directions\?to=/);
  await expect(details.getByRole('link', { name: 'Wyznacz dojazd' })).toHaveAttribute('rel', /noopener/);
});

test('mapę można powiększyć i przesunąć klawiaturą oraz wybrać wynik znacznikiem', async ({ page }) => {
  await mapServices(page);
  await open(page);
  await searchMap(page);
  await page.locator('#placeType').selectOption('pharmacy');
  const oldZoom = await page.evaluate(() => placesState.zoom);
  await page.locator('#mapZoomIn').click();
  expect(await page.evaluate(() => placesState.zoom)).toBe(oldZoom + 1);
  const oldLon = await page.evaluate(() => placesState.center.lon);
  await page.locator('#placeMap').focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => placesState.center.lon)).toBeGreaterThan(oldLon);
  await page.locator('.map-marker').click();
  await expect(page.locator('.place-details')).toContainText('Godziny otwarcia');
  await expect(page.locator('#placeList .place-summary')).toBeFocused();
});

test('błędy usług mapy nie pokazują fikcyjnych ani nieaktualnych wyników', async ({ page }) => {
  let count = 0;
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }));
  await page.route('https://overpass-api.de/**', route => ++count === 1 ? route.fulfill({ json: { elements } }) : route.fulfill({ status: 503, body: 'unavailable' }));
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await open(page);
  await searchMap(page);
  await expect(page.locator('#placeList')).toContainText('Apteka Testowa');
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapStatus')).toContainText('Usługa wyszukiwania jest teraz niedostępna');
  await expect(page.locator('#mapResults')).toBeHidden();
  await expect(page.locator('#mapStatus')).toContainText('Nie pokazujemy przykładowych placówek');
  await expect(page.locator('#searchLocation')).toBeEnabled();
});

test('lokalizacja wymaga działania użytkownika, nie wysyła jej do geokodera', async ({ page, context }) => {
  const calls = await mapServices(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 50.541, longitude: 22.722 });
  await open(page);
  await page.locator('#openMap').click();
  expect(calls.overpass).toHaveLength(0);
  await page.locator('#useLocation').click();
  await expect(page.locator('#mapResults')).toBeVisible();
  expect(calls.geocode).toHaveLength(0);
  expect(calls.overpass).toHaveLength(1);
  expect(new URLSearchParams(calls.overpass[0]).get('data')).toContain('around:6000,50.541000,22.722000');
});

test('brak klucza lub połączenia nigdy nie uruchamia scenariusza, nawet w starym trybie skryptu', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, stt: false, tts: false } }));
  await page.route('**/api/agent', route => { requests += 1; return route.fulfill({ status: 503, json: { error: 'unavailable' } }); });
  await open(page, '/aplikacja?tryb=skrypt');
  await page.locator('#prompt').fill('Zastrzeż mój PESEL');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Żadna czynność nie została wykonana');
  await expect(page.locator('#prompt')).toHaveValue('Zastrzeż mój PESEL');
  await expect(page.locator('.review-card,.chips,.ui.done')).toHaveCount(0);
  expect(requests).toBe(1);
  await page.locator('#prompt').press('Enter');
  await expect.poll(() => requests).toBe(2);
  await expect(page.locator('.review-card,.ui.done')).toHaveCount(0);
});

test('prawdziwie rozpoznany i poprawiony tekst trafia do modelu dopiero po wysłaniu', async ({ page }) => {
  let sent = null;
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {}
      stop() { const result = [{ transcript: 'Znajdź urząd' }]; result.isFinal = true; this.onresult({ results: [result] }); this.onend(); }
      abort() {}
    };
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: true, stt: false, tts: false } }));
  await page.route('**/api/agent', route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { messages: [...sent.messages, { role: 'assistant', content: 'Odpowiedź z usługi modelu' }], events: [{ t: 'text', plain: 'Odpowiedź z usługi modelu' }] } });
  });
  await open(page);
  await page.locator('#mic').click();
  await page.locator('#dictate').click();
  await page.locator('#dictate').click();
  await expect(page.locator('#voiceDraft')).toHaveValue('Znajdź urząd');
  expect(sent).toBeNull();
  await page.locator('#voiceDraft').fill('Znajdź urząd skarbowy');
  await page.locator('#sendDraft').click();
  await expect(page.locator('#chat')).toContainText('Odpowiedź z usługi modelu');
  expect(sent.messages.at(-1)).toEqual({ role: 'user', content: 'Znajdź urząd skarbowy' });
  expect(sent.confirm).toBeUndefined();
  expect(sent.osoba).toBeUndefined();
});

test('profil działa na ekranach i mieści się w ramie przy 320 px, poziomie i dużym tekście', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.locator('#homeSenior').check();
  await page.locator('#openAccess').click();
  await page.locator('input[name="accessFont"][value="extra"]').check();
  await page.locator('#highContrast').check();
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 320, height: 422 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    for (const id of ['accessScroll', 'homeContent']) {
      expect(await page.locator('#' + id).evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
    }
    const phone = await page.locator('#app').boundingBox();
    expect(phone.x).toBeGreaterThanOrEqual(0);
    expect(phone.y).toBeGreaterThanOrEqual(0);
    expect(phone.x + phone.width).toBeLessThanOrEqual(size.width);
    expect(phone.y + phone.height).toBeLessThanOrEqual(size.height);
  }
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.locator('#panelSenior').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(52);
  expect(await page.locator('#accessPanel .setting-row label').first().evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(120);
  await page.locator('#accessBack').click();
  await page.locator('#openMap').click();
  expect(await page.locator('#mapScroll').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
  expect(await page.locator('#mapPanel .assist-intro').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBe(20);
  await page.locator('#mapBack').click();
  await page.locator('#seniorAssistant').click();
  expect(await page.locator('#prompt').evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBe(20);
});

test('nowe ekrany i profil seniora przechodzą wybrane automatyczne reguły dostępności', async ({ page }) => {
  await mapServices(page);
  await open(page);
  await page.locator('#homeSenior').check();
  await checkAxe(page);
  await page.locator('#openAccess').click();
  await checkAxe(page);
  await page.locator('#accessBack').click();
  await page.locator('#openMap').click();
  await checkAxe(page);
  await page.locator('#placeLocation').fill('Warszawa');
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapResults')).toBeVisible();
  await checkAxe(page);
});

test('skrót przypomnień i przycisk zdjęcia nie uruchamiają fikcyjnych akcji asystenta', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/agent', route => { requests += 1; return route.fulfill({ status: 503, json: { error: 'unavailable' } }); });
  await open(page, '/aplikacja?tryb=skrypt');
  await page.locator('#tiles .rsum').first().click();
  await page.locator('#todoAsk').click();
  await expect(page.locator('#chat')).toContainText('Żadna czynność nie została wykonana');
  expect(requests).toBe(1);
  await page.locator('#cam').click();
  await expect(page.locator('#chat')).toContainText('Odczyt zdjęcia dokumentu nie jest dostępny');
  await expect(page.locator('.review-card,.ui.done')).toHaveCount(0);
  expect(requests).toBe(1);
});

test('większy tekst pokazuje czytelne dane dokumentu poza grafiką', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await page.locator('#homeSenior').check();
  await page.getByRole('button', { name: 'Otwórz mDowód' }).click();
  await expect(page.locator('.detail-readable')).toBeVisible();
  await expect(page.locator('.detail-readable')).toContainText('Przykładowe dane dokumentu');
  expect(await page.locator('.detail-readable dt').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBe(18);
  expect(await page.locator('#detail .body').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
});

test('znaczniki mapy i ustawienia czcionki mają powiększone cele dotykowe', async ({ page }) => {
  await mapServices(page);
  await open(page);
  await page.locator('#homeSenior').check();
  await page.locator('#openAccess').click();
  for (const label of await page.locator('.font-options label').all()) {
    expect((await label.boundingBox()).height).toBeGreaterThanOrEqual(52);
  }
  await page.locator('#accessBack').click();
  await searchMap(page);
  const marker = page.locator('.map-marker').first();
  await expect(marker).toBeVisible();
  const box = await marker.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(52);
  expect(box.height).toBeGreaterThanOrEqual(52);
});

test('wszystkie układy dokumentów zachowują pełne etykiety i nie nachodzą na przypomnienia przy dużym tekście', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const variant of ['stos', 'karuzela', 'pion', 'lista', 'siatka']) {
    await open(page, '/aplikacja?uklad=' + variant);
    await page.locator('#homeSenior').check();
    await page.locator('#openAccess').click();
    await page.locator('input[name="accessFont"][value="extra"]').check();
    await page.locator('#accessBack').click();
    await expect.poll(() => page.locator('#homeContent').evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
    if (variant !== 'stos') {
      const positions = await page.evaluate(() => ({ alt: document.querySelector('#alt').getBoundingClientRect().bottom, reminders: document.querySelector('#reminders').getBoundingClientRect().top }));
      expect(positions.reminders).toBeGreaterThanOrEqual(positions.alt);
    }
    if (variant === 'lista') {
      for (const item of await page.locator('.strip .st').all()) {
        expect(await item.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
      }
    }
    if (variant === 'siatka') {
      for (const item of await page.locator('.gcap').all()) {
        expect(await item.evaluate(node => node.scrollWidth - node.clientWidth)).toBe(0);
      }
    }
    await page.evaluate(() => localStorage.removeItem('mobywatels.accessibility.v1'));
  }
});

test('menu dokumentów przy dużym tekście pozostaje ponad polem rozmowy i przewija się w ramie', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await page.locator('#homeSenior').check();
  await page.locator('#openAccess').click();
  await page.locator('input[name="accessFont"][value="extra"]').check();
  await page.locator('#accessBack').click();
  await page.locator('#title').click();
  const panel = page.locator('#lmenu .panel');
  const box = await panel.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(568);
  expect(await panel.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  expect(await page.evaluate(() => Number(getComputedStyle(document.querySelector('#lmenu')).zIndex) > Number(getComputedStyle(document.querySelector('#composer')).zIndex))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#title')).toBeFocused();
});

test('powrót z ustawień otwartych w pomocy zachowuje kontekst i fokus', async ({ page }) => {
  await open(page);
  await page.locator('#homeHelp').click();
  await page.locator('#helpAccess').click();
  await expect(page.locator('#accessBack')).toBeFocused();
  await page.locator('#accessBack').click();
  await expect(page.locator('#helpAccess')).toBeFocused();
  await page.locator('#helpBack').click();
  await expect(page.locator('#homeHelp')).toBeFocused();
});

test('ograniczenie ruchu wyłącza płynne przewijanie karuzeli', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Element.prototype.scrollTo;
    window.scrollBehaviors = [];
    Element.prototype.scrollTo = function(options) { if (options && options.behavior) window.scrollBehaviors.push(options.behavior); return original.apply(this, arguments); };
  });
  await page.goto('/aplikacja?uklad=karuzela');
  await page.locator('#homeSenior').check();
  await expect(page.locator('#app')).toHaveClass(/reduce-motion/);
  await page.locator('.next-doc').click();
  expect(await page.evaluate(() => window.scrollBehaviors.at(-1))).toBe('auto');
});

test('przy braku pamięci przeglądarki ustawienia działają, ale aplikacja ostrzega o braku zapisu', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await open(page);
  await page.locator('#openAccess').click();
  await page.locator('#panelSenior').check();
  await expect(page.locator('#app')).toHaveAttribute('data-font', 'large');
  await expect(page.locator('#preferenceStatus')).toContainText('Nie udało się zapisać ustawień');
});

test('zamknięcie podczas pobierania mapy anuluje żądanie i pozwala ponowić', async ({ page }) => {
  let release;
  const requested = new Promise(resolve => {
    page.route('https://overpass-api.de/**', async route => {
      resolve();
      await new Promise(done => { release = done; });
      try { await route.fulfill({ json: { elements } }); } catch (error) {}
    });
  });
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }));
  await open(page);
  await page.locator('#openMap').click();
  await page.locator('#placeLocation').fill('Warszawa');
  await page.locator('#searchLocation').click();
  await requested;
  await expect(page.locator('#searchLocation')).toBeDisabled();
  await page.locator('#mapBack').click();
  release();
  await page.locator('#openMap').click();
  await expect(page.locator('#searchLocation')).toBeEnabled();
  await expect(page.locator('#mapStatus')).toContainText('Wyszukiwanie anulowano');
  await expect(page.locator('#mapResults')).toBeHidden();
});

test('dane z mapy nie uruchamiają HTML ani niebezpiecznych adresów', async ({ page }) => {
  const item = { type: 'node', id: 88, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: '<img src=x onerror=window.mapInjected=1>', website: 'javascript:alert(1)' } };
  await mapServices(page, { overpass: { json: { elements: [item] } } });
  await open(page);
  await searchMap(page);
  await page.locator('#placeList .place-summary').click();
  await expect(page.locator('#placeList')).toContainText('onerror=window.mapInjected=1');
  await expect(page.locator('#placeList img')).toHaveCount(0);
  await expect(page.locator('#placeList a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.mapInjected)).toBeUndefined();
});

test('wysoki kontrast i bardzo duża czcionka przechodzą automatyczne kontrole na nowych ekranach', async ({ page }) => {
  await mapServices(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page);
  await page.locator('#openAccess').click();
  await page.locator('input[name="accessFont"][value="extra"]').check();
  await page.locator('#highContrast').check();
  await checkAxe(page);
  await page.locator('#accessBack').click();
  await checkAxe(page);
  await page.locator('#openMap').click();
  await checkAxe(page);
});

test('zweryfikowane polecenie głosowe może otworzyć lokalną mapę po odpowiedzi modelu', async ({ page }) => {
  let sent = null;
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {}
      stop() { const result = [{ transcript: 'Otwórz mapę placówek' }]; result.isFinal = true; this.onresult({ results: [result] }); this.onend(); }
      abort() {}
    };
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: true, stt: false, tts: false } }));
  await page.route('**/api/agent', route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ json: { messages: [...sent.messages, { role: 'assistant', content: 'Otwieram mapę.' }], events: [{ t: 'text', plain: 'Otwieram mapę.' }, { t: 'navigate', screen: 'mapa' }] } });
  });
  await open(page);
  await page.locator('#mic').click();
  await page.locator('#dictate').click();
  await page.locator('#dictate').click();
  await expect(page.locator('#voiceDraft')).toHaveValue('Otwórz mapę placówek');
  await expect(page.locator('#mapPanel')).not.toHaveClass(/on/);
  await page.locator('#sendDraft').click();
  await expect(page.locator('#mapPanel')).toHaveClass(/on/);
  expect(sent.messages.at(-1).content).toBe('Otwórz mapę placówek');
  await expect(page.locator('#mapResults')).toBeHidden();
});

test('komenda nawigacji nie otwiera ekranu po błędzie połączenia ani dla nieznanej akcji', async ({ page }) => {
  let status = 503;
  await page.route('**/api/agent', route => route.fulfill({ status, json: { messages: route.request().postDataJSON().messages, events: [{ t: 'text', plain: 'Tekst' }, { t: 'navigate', screen: status === 503 ? 'mapa' : 'platnosc' }] } }));
  await open(page);
  await page.locator('#prompt').fill('Otwórz mapę');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Żadna czynność nie została wykonana');
  await expect(page.locator('#mapPanel')).not.toHaveClass(/on/);
  status = 200;
  await page.locator('#prompt').press('Enter');
  await expect.poll(() => page.locator('.msg.bot').count()).toBe(2);
  await expect(page.locator('#mapPanel')).not.toHaveClass(/on/);
  await expect(page.locator('.review-card')).toHaveCount(0);
});

test('odpowiedź nawigacyjna nie przerywa innego otwartego ekranu', async ({ page }) => {
  let finish;
  const requested = new Promise(resolve => page.route('**/api/agent', async route => {
    resolve();
    await new Promise(done => { finish = done; });
    const messages = route.request().postDataJSON().messages;
    await route.fulfill({ json: { messages: [...messages, { role: 'assistant', content: 'Możesz otworzyć mapę.' }], events: [{ t: 'text', plain: 'Możesz otworzyć mapę.' }, { t: 'navigate', screen: 'mapa' }] } });
  }));
  await open(page);
  await page.locator('#prompt').fill('Otwórz mapę');
  await page.locator('#prompt').press('Enter');
  await requested;
  await page.locator('#chatHelp').click();
  finish();
  await expect(page.locator('#chat .chips button')).toHaveText('Otwórz mapę placówek');
  await expect(page.locator('#helpPanel')).toHaveClass(/on/);
  await expect(page.locator('#mapPanel')).not.toHaveClass(/on/);
  await page.locator('#helpBack').click();
  await page.locator('#chat .chips button').click();
  await expect(page.locator('#mapPanel')).toHaveClass(/on/);
});

test('niedostępny plik asystenta zamyka drogę do dawnych scenariuszy', async ({ page }) => {
  await page.route('**/agent.js?*', route => route.abort());
  await open(page, '/aplikacja?tryb=skrypt');
  await page.locator('#prompt').fill('Zgubiłam portfel');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Żadna czynność nie została wykonana');
  await expect(page.locator('#prompt')).toHaveValue('Zgubiłam portfel');
  await expect(page.locator('.review-card,.chips,.ui.done')).toHaveCount(0);
});

test('druga wiadomość w trakcie odpowiedzi nie ginie ani nie jest wysyłana podwójnie', async ({ page }) => {
  let finish;
  const requested = new Promise(resolve => page.route('**/api/agent', async route => {
    resolve();
    await new Promise(done => { finish = done; });
    const messages = route.request().postDataJSON().messages;
    await route.fulfill({ json: { messages: [...messages, { role: 'assistant', content: 'Odpowiedź' }], events: [{ t: 'text', plain: 'Odpowiedź' }] } });
  }));
  await open(page);
  await page.locator('#prompt').fill('Pierwsze pytanie');
  await page.locator('#prompt').press('Enter');
  await requested;
  await page.locator('#prompt').fill('Drugie pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#prompt')).toHaveValue('Drugie pytanie');
  await expect(page.locator('.msg.user')).toHaveCount(1);
  finish();
  await expect(page.locator('#chat')).toContainText('Odpowiedź');
  await expect(page.locator('#prompt')).toHaveValue('Drugie pytanie');
});

test('wstecz do lokalizacji zachowuje wynik i pozwala poprawić miejscowość', async ({ page }) => {
  const calls = await mapServices(page);
  await open(page);
  await searchMap(page);
  await page.locator('#changeLocation').click();
  await expect(page.locator('#placeLocation')).toBeFocused();
  await expect(page.locator('#placeLocation')).toHaveValue('Warszawa');
  await expect(page.locator('#mapResults')).toBeVisible();
  expect(calls.geocode).toHaveLength(1);
  expect(calls.overpass).toHaveLength(1);
});

test('niekompletne współrzędne nie tworzą fałszywych punktów na mapie', async ({ page }) => {
  const invalid = [
    { type: 'node', id: 1, lat: null, lon: null, tags: { amenity: 'pharmacy', name: 'Niepoprawny punkt' } },
    { type: 'node', id: 2, tags: { amenity: 'pharmacy', name: 'Bez współrzędnych' } },
    { type: 'node', id: -1, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: 'Błędny identyfikator' } }
  ];
  await mapServices(page, { overpass: { json: { elements: invalid } } });
  await open(page);
  await searchMap(page);
  await expect(page.locator('#placeCount')).toHaveText('0 miejsc');
  await expect(page.locator('.map-marker')).toHaveCount(0);
  await expect(page.locator('#placeList')).toContainText('Nie znaleziono pasujących miejsc');
  await expect(page.locator('#placeList')).toContainText('Brak wyniku nie oznacza, że placówki nie ma');
});

test('odmowa lokalizacji i pusty wynik geokodera pozwalają wpisać inne miejsce', async ({ page, context }) => {
  const calls = await mapServices(page, { geocode: { json: [] } });
  await context.clearPermissions();
  await context.grantPermissions([]);
  await open(page);
  await page.locator('#openMap').click();
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapStatus')).toContainText('Wpisz miejscowość lub adres');
  expect(calls.geocode).toHaveLength(0);
  await page.locator('#useLocation').click();
  await expect(page.locator('#mapStatus')).toContainText('Nie udało się uzyskać lokalizacji');
  await expect(page.locator('#mapResults')).toBeHidden();
  await page.locator('#placeLocation').fill('Miejscowość, której nie znaleziono');
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapStatus')).toContainText('Nie znaleziono tej miejscowości');
  expect(calls.overpass).toHaveLength(0);
  await expect(page.locator('#placeLocation')).toHaveValue('Miejscowość, której nie znaleziono');
});

test('zmiana profilu w rozmowie nie usuwa odpowiedzi, historii ani szkicu', async ({ page }) => {
  await page.route('**/api/agent', route => {
    const messages = route.request().postDataJSON().messages;
    return route.fulfill({ json: { messages: [...messages, { role: 'assistant', content: 'Odpowiedź z modelu' }], events: [{ t: 'text', plain: 'Odpowiedź z modelu' }] } });
  });
  await open(page);
  await page.locator('#prompt').fill('Pierwsze pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Odpowiedź z modelu');
  await page.locator('#prompt').fill('Mój szkic');
  await page.locator('#chatHelp').click();
  await page.locator('#helpAccess').click();
  await page.locator('#panelSenior').check();
  await page.locator('#accessBack').click();
  await page.locator('#helpBack').click();
  await expect(page.locator('#chat')).toContainText('Pierwsze pytanie');
  await expect(page.locator('#chat')).toContainText('Odpowiedź z modelu');
  await expect(page.locator('#prompt')).toHaveValue('Mój szkic');
  await expect(page.locator('#app')).toHaveClass(/senior-profile/);
  await page.locator('#histBtn').click();
  await expect(page.locator('#hlist')).toContainText('Pierwsze pytanie');
});
