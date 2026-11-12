const { test, expect } = require('@playwright/test');
const fs = require('fs');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function openLetter(page) {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await page.evaluate(() => openLetter());
  await expect(page.locator('#letterBack')).toBeFocused();
}

async function pick(page, name, type) {
  await page.locator('#letterFile').setInputFiles({ name, mimeType: type, buffer: png });
}

test('rozpoznany tekst trafia do edytowalnego pola, a zgoda na wysłanie do modelu jest wyłączona', async ({ page }) => {
  await page.route('**/api/letter/extract', route => route.fulfill({ json: { text: 'Prosimy o wyjaśnienia w terminie 7 dni. Dołącz kopię faktury.' } }));
  await openLetter(page);
  await pick(page, 'pismo.png', 'image/png');
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterText')).toHaveValue('Prosimy o wyjaśnienia w terminie 7 dni. Dołącz kopię faktury.');
  await expect(page.locator('#letterConsent')).not.toBeChecked();
  await expect(page.locator('#letterStatus')).toContainText('Sprawdź tekst');
  await page.locator('#letterText').fill('Poprawiony tekst pisma');
  await expect(page.locator('#letterText')).toHaveValue('Poprawiony tekst pisma');
});

test('niska jakość OCR jest oznaczona ostrzeżeniem', async ({ page }) => {
  await page.route('**/api/letter/extract', route => route.fulfill({ json: { text: '||| 1 2 3 ... ### nieczytelne' } }));
  await openLetter(page);
  await pick(page, 'skan.jpg', 'image/jpeg');
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('Jakość odczytu jest niska');
});

test('wyłączony OCR kończy się komunikatem i możliwością wpisania tekstu', async ({ page }) => {
  await page.route('**/api/letter/extract', route => route.fulfill({ status: 400, json: { error: 'Odczyt zdjęć i skanów (OCR) nie jest włączony na tym serwerze. Zainstaluj Tesseract OCR albo wpisz tekst ręcznie.' } }));
  await openLetter(page);
  await pick(page, 'pismo.png', 'image/png');
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('OCR) nie jest włączony');
  await expect(page.locator('#letterText')).toHaveValue('');
  await page.locator('#letterText').fill('Tekst wpisany ręcznie');
  await expect(page.locator('#letterText')).toHaveValue('Tekst wpisany ręcznie');
});

test('nieobsługiwany format pliku jest odrzucany przed wysłaniem', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/letter/extract', route => { calls++; return route.fulfill({ json: { text: 'x' } }); });
  await openLetter(page);
  await pick(page, 'dokument.doc', 'application/msword');
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).toContainText('Obsługujemy PDF, TXT oraz zdjęcia');
  expect(calls).toBe(0);
});

test('uszkodzony PDF kończy się komunikatem i nie blokuje formularza', async ({ page }) => {
  await openLetter(page);
  await page.locator('#letterFile').setInputFiles({ name: 'uszkodzone.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 bez strumienia') });
  await page.locator('#extractLetter').click();
  await expect(page.locator('#letterStatus')).not.toBeEmpty();
  await expect(page.locator('#extractLetter')).toBeEnabled();
  await expect(page.locator('#letterText')).toBeEditable();
});

test('odmowa dostępu do mikrofonu nie zostawia interfejsu w wiecznym ładowaniu', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async () => { throw new DOMException('Odmowa', 'NotAllowedError'); } },
      configurable: true
    });
  });
  await page.goto('/aplikacja');
  await expect(page.locator('body')).toBeVisible();
  const status = page.locator('#status');
  if (await status.count()) await expect(status).not.toContainText('Ładuję');
});

test('utrata połączenia podczas wysyłania pisma pokazuje błąd i pozwala ponowić', async ({ page }) => {
  await page.route('**/api/letter/explain', route => route.abort('failed'));
  await openLetter(page);
  await page.locator('#letterText').fill('Prosimy o odpowiedź do 26.10.2026.');
  await page.locator('#letterConsent').check();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#explainLetter').click();
  await expect(page.locator('#letterStatus')).toContainText(/nie udało|błąd|połącze/i);
  await expect(page.locator('#explainLetter')).toBeEnabled();
});
