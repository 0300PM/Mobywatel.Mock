const { test, expect } = require('@playwright/test');

const place = { type: 'node', id: 501, lat: 52.23, lon: 21.01, tags: { amenity: 'pharmacy', name: 'Apteka Przykładowa' } };

async function open(page) {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
}

async function search(page, geocode, overpass) {
  await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill(geocode));
  await page.route('https://overpass-api.de/**', overpass);
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==', 'base64') }));
  await open(page);
  await page.locator('#openMap').click();
  await page.locator('#placeLocation').fill('Warszawa');
  await page.locator('#searchLocation').click();
}

test('wyniki mapy pokazują czas pobrania, a placówka bez godzin nie podaje ich jako pewnych', async ({ page }) => {
  await search(page, { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }, route => route.fulfill({ json: { elements: [place] } }));
  await expect(page.locator('#mapResults')).toBeVisible();
  await page.locator('#placeList .place-summary').click();
  await expect(page.locator('.place-details')).toContainText('Dane z OpenStreetMap z');
  await expect(page.locator('.place-details')).toContainText('Brak danych w OpenStreetMap');
  await expect(page.locator('.place-details')).toContainText('Oficjalna strona placówki');
});

test('niedostępna usługa jest odróżniona od braku placówek', async ({ page }) => {
  await search(page, { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }, route => route.fulfill({ status: 503, body: 'unavailable' }));
  await expect(page.locator('#mapStatus')).toContainText('To nie oznacza, że w pobliżu nie ma placówek');
  await expect(page.locator('#mapResults')).toBeHidden();
});

test('limit zapytań i błędny JSON kończą się komunikatem zamiast pustą listą', async ({ page }) => {
  await search(page, { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }, route => route.fulfill({ status: 429, body: 'too many' }));
  await expect(page.locator('#mapStatus')).toContainText('chwilowo przeciążona');
  await expect(page.locator('#mapResults')).toBeHidden();
});

test('błędny JSON z usługi mapy nie pokazuje fałszywych wyników', async ({ page }) => {
  await search(page, { json: [{ lat: '52.23', lon: '21.01', display_name: 'Warszawa' }] }, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{niepoprawny' }));
  await expect(page.locator('#mapStatus')).toContainText('Usługa wyszukiwania jest teraz niedostępna');
  await expect(page.locator('#mapResults')).toBeHidden();
});

test('wpis krótszy niż trzy znaki nie wysyła zapytania do usług mapy', async ({ page }) => {
  let calls = 0;
  await page.route('https://nominatim.openstreetmap.org/**', route => { calls++; return route.fulfill({ json: [] }); });
  await open(page);
  await page.locator('#openMap').click();
  await page.locator('#placeLocation').fill('Wa');
  await page.locator('#searchLocation').click();
  await expect(page.locator('#mapStatus')).toContainText('co najmniej 3 znaki');
  expect(calls).toBe(0);
});
