const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==', 'base64');

const ZNANE = ['target-size'];

async function start(page) {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await expect(page.locator('#app')).toBeVisible();
}

async function otworzAsystenta(page) {
  await start(page);
  await page.locator('#prompt').fill('Gdzie załatwię dowód?');
}

async function mapa(page, geocode, overpass) {
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill(geocode));
  await page.route('https://overpass-api.de/**', overpass);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.locator('#openMap').click();
  await expect(page.locator('#mapPanel')).toHaveClass(/on/);
}

async function szukaj(page, nazwa) {
  await page.locator('#placeLocation').fill(nazwa);
  await page.locator('#searchLocation').click();
}

test('A — pierwsze uruchomienie w czystym profilu bez błędów konsoli i z widocznymi ograniczeniami', async ({ page, browser }) => {
  const kontekst = await browser.newContext();
  const czysta = await kontekst.newPage();
  const bledy = [];
  czysta.on('pageerror', error => bledy.push(String(error)));
  czysta.on('console', message => { if (message.type() === 'error') bledy.push(message.text()); });
  await czysta.addInitScript(() => { window.FAST = true; });
  await czysta.goto('/aplikacja');
  await expect(czysta.locator('#app')).toBeVisible();
  await expect(czysta.locator('body')).toContainText(/prototyp|demonstracyjn|nieoficjaln/i);
  await czysta.reload();
  await expect(czysta.locator('#app')).toBeVisible();
  expect(bledy.filter(item => !/favicon/i.test(item))).toEqual([]);
  await kontekst.close();
});

test('B — brak dostawcy AI nie blokuje reszty aplikacji', async ({ page }) => {
  await page.route('**/api/agent', route => route.fulfill({ status: 503, json: { error: 'Asystent AI jest niedostępny.', code: 'niedostepny', retryable: true, request_id: 'x' } }));
  await page.route('**/api/health', route => route.fulfill({ json: { ok: true, agent: false, provider: 'brak' } }));
  await start(page);
  await expect(page.locator('#agentStatus')).toContainText(/dostępn|pozostałe funkcje|dokumenty|mapa/i);
  await expect(page.locator('#prompt')).toBeVisible();

  await page.locator('#openSafety').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/on/);
  await expect(page.locator('#safetyGuide')).not.toBeEmpty();
  await expect(page.locator('#safetyPanel a[href="tel:112"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#safetyPanel')).not.toHaveClass(/on/);

  await page.locator('#openMap').click();
  await expect(page.locator('#mapPanel')).toHaveClass(/on/);
  await expect(page.locator('#searchLocation')).toBeEnabled();
  await expect(page.locator('#mapPanel')).toContainText('OpenStreetMap');
});

test('C — tłumacz pisma: TXT, PDF, limit, zgoda i brak wymyślonego terminu', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await page.evaluate(() => openLetter());
  await expect(page.locator('#letterBack')).toBeFocused();

  await page.locator('#letterFile').setInputFiles({ name: 'pismo.txt', mimeType: 'text/plain', buffer: Buffer.from('Prosimy o odpowiedź.') });
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterText')).toHaveValue('Prosimy o odpowiedź.');

  await page.locator('#letterFile').setInputFiles({ name: 'pismo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << >> stream\nBT (Termin odpowiedzi: 26.10.2026) Tj ET\nendstream\n%%EOF') });
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterText')).toHaveValue(/26\.10\.2026/);

  await page.locator('#letterFile').setInputFiles({ name: 'skan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 bez warstwy tekstowej') });
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).not.toBeEmpty();
  await expect(page.locator('#letterText')).toBeEditable();

  await page.locator('#letterFile').setInputFiles({ name: 'duzy.txt', mimeType: 'text/plain', buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 0x61) });
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).toContainText(/za duż|limit|4 MiB/i);

  await page.locator('#letterText').fill('Prosimy o odpowiedź.');
  await page.locator('#explainLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('Zaznacz zgodę');
  await expect(page.locator('#letterConsent')).not.toBeChecked();

  let zadania = 0;
  await page.route('**/api/letter/explain', route => {
    zadania += 1;
    return route.fulfill({ json: { result: { meaning: { text: 'Urząd prosi o odpowiedź.', source: 'Prosimy o odpowiedź.' }, actions: [], deadline: null, documents: [] } } });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#letterConsent').check();
  await page.locator('#explainLetter').click();
  await expect(page.locator('#letterResults')).toContainText('Urząd prosi o odpowiedź.');
  expect(zadania).toBe(1);
  await expect(page.locator('#letterResults')).not.toContainText(/termin upływa|do 26\.10\.2026/i);
});

test('D — mapa: duża i mała miejscowość, brak wyników, odmowa lokalizacji, timeout OSM, filtry', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');

  await mapa(page, { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }, route => route.fulfill({ json: { elements: [{ type: 'node', id: 1, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: 'Apteka Duża' } }] } }));
  await szukaj(page, 'Warszawa');
  await expect(page.locator('#mapResults')).toBeVisible();

  await page.unroute('https://nominatim.openstreetmap.org/**');
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '49.62', lon: '20.7', display_name: 'Zalesie' }] }));
  await page.unroute('https://overpass-api.de/**');
  await page.route('https://overpass-api.de/**', route => route.fulfill({ json: { elements: [] } }));
  await szukaj(page, 'Zalesie');
  await expect(page.locator('#mapStatus')).not.toContainText('undefined');

  await page.unroute('https://nominatim.openstreetmap.org/**');
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [] }));
  await szukaj(page, 'Nieistniejacemiastoqwerty');
  await expect(page.locator('#mapStatus')).toContainText(/nie znaleziono|innej miejscowości|wpisz/i);
  await expect(page.locator('#placeList .place-summary')).toHaveCount(0);

  await page.unroute('https://nominatim.openstreetmap.org/**');
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok, fail) => fail({ code: 1, message: 'Odmowa' }) }, configurable: true });
  });
  await page.reload();
  await page.locator('#openMap').click();
  await page.locator('#useLocation').click();
  await expect(page.locator('#mapStatus')).not.toBeEmpty();

  await page.unroute('https://overpass-api.de/**');
  await page.route('https://overpass-api.de/**', route => route.fulfill({ status: 504, body: 'timeout' }));
  await szukaj(page, 'Warszawa');
  await expect(page.locator('#mapStatus')).toContainText(/nie udało|niedostępn|spróbuj|chwilowo/i);

  await page.unroute('https://overpass-api.de/**');
  await page.route('https://overpass-api.de/**', route => route.fulfill({ json: { elements: [
    { type: 'node', id: 1, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: 'Apteka A' } },
    { type: 'node', id: 2, lat: 52.24, lon: 21.02, tags: { amenity: 'police', name: 'Policja B' } }
  ] } }));
  await szukaj(page, 'Warszawa');
  await page.locator('#placeType').selectOption('pharmacy');
  await expect(page.locator('#placeList')).toContainText('Apteka A');
  await expect(page.locator('#placeList')).not.toContainText('Policja B');
});

test('E — Bezpieczny Obywatel: powódź, pożar, checklista, źródła, tryb awaryjny, brak alertów jako brak danych', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await page.locator('#openSafety').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/on/);

  await page.locator('#safetyScenarioSelect').selectOption('powodz');
  await expect(page.locator('#safetyGuide')).toContainText('Kroki działania');
  await expect(page.locator('#safetyGuide')).toContainText('Oficjalne źródła');
  const powodz = await page.locator('#safetyGuide a[href^="http"]').count();
  expect(powodz).toBeGreaterThan(0);

  await page.locator('#safetyScenarioSelect').selectOption('pozar');
  await expect(page.locator('#safetyGuide')).toContainText('Najczęstsze błędy');
  const pozar = await page.locator('#safetyGuide a[href^="http"]').count();
  expect(pozar).toBeGreaterThan(0);

  const pierwszy = page.locator('#safetyPackList input[type="checkbox"]').first();
  await expect(pierwszy).toBeVisible();
  await pierwszy.check();
  await expect(pierwszy).toBeChecked();
  await expect(page.locator('#safetyPackProgress')).not.toBeEmpty();

  await page.locator('#safetyMode').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/safety-emergency/);
  await page.reload();
  await page.locator('#openSafety').click();
  await expect(page.locator('#safetyGuide')).not.toBeEmpty();
  await expect(page.locator('.safety-status-unknown')).toContainText(/nieznany/i);
  await expect(page.locator('.safety-status-unknown')).toContainText(/nie pobiera bieżących alertów/i);
  await expect(page.locator('#safetyPanel')).not.toContainText(/brak zagrożenia/i);
});

test('F — dostępność: Tab, profil seniora, duży tekst, kontrast, 320 px, axe', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  const widoczne = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    widoczne.push(await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      return { tag: el.tagName, outline: style.outlineStyle, width: style.outlineWidth };
    }));
  }
  expect(widoczne.filter(Boolean).length).toBeGreaterThan(5);

  await page.evaluate(() => document.querySelector('#app').classList.add('senior-view'));
  await page.setViewportSize({ width: 320, height: 568 });
  const poziomo = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(poziomo).toBeLessThanOrEqual(1);

  await page.evaluate(() => document.documentElement.classList.add('large-text', 'high-contrast'));
  await expect(page.locator('#app')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(item => item.id).filter(id => !ZNANE.includes(id))).toEqual([]);
});

test('G — stabilność: przerwane żądanie AI, odświeżenie w trakcie, kilka wiadomości, szybkie filtry mapy', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');

  await page.route('**/api/health', route => route.fulfill({ json: { ok: true, agent: true, provider: 'openai', timeout: 30 } }));
  await page.route('**/api/agent', route => route.abort('failed'));
  await page.reload();
  await expect(page.locator('#agentStatus')).toContainText('połączono z modelem');
  await page.locator('#prompt').fill('Pierwsza wiadomość');
  await page.keyboard.press('Enter');
  await expect(page.locator('.msgs')).toContainText(/niedostępn|nie udało się połączyć/i, { timeout: 25000 });
  await expect(page.locator('#prompt')).toBeEditable();

  await page.unroute('**/api/agent');
  let zadania = 0;
  await page.route('**/api/agent', async route => {
    zadania += 1;
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { messages: [{ role: 'assistant', content: [{ type: 'text', text: 'Odpowiedź.' }] }], events: [{ t: 'text', md: 'Odpowiedź.', html: '<p>Odpowiedź.</p>', plain: 'Odpowiedź.' }] } });
  });
  const pole = page.locator('#prompt');
  for (const tekst of ['Druga', 'Trzecia', 'Czwarta']) {
    await pole.fill(tekst);
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(2500);
  await expect(page.locator('.msgs')).toContainText('Odpowiedź.');
  expect(zadania).toBeGreaterThanOrEqual(1);
  expect(zadania).toBeLessThanOrEqual(3);

  await page.reload();
  await expect(page.locator('#app')).toBeVisible();

  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }));
  await page.route('https://overpass-api.de/**', route => route.fulfill({ json: { elements: [{ type: 'node', id: 1, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: 'Apteka A' } }] } }));
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.locator('#openMap').click();
  await szukaj(page, 'Warszawa');
  for (const typ of ['pharmacy', 'police', 'tax', '']) {
    await page.locator('#placeType').selectOption(typ);
    await page.locator('#placeFilter').fill('a');
  }
  await page.waitForTimeout(800);
  await expect(page.locator('#mapPanel')).toHaveClass(/on/);
  await expect(page.locator('#mapStatus')).not.toContainText('undefined');
});
