const { test, expect } = require('@playwright/test');

async function open(page, path = '/aplikacja') {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto(path);
}

async function answerWith(page, text) {
  await page.route('**/api/health', route => route.fulfill({ json: { agent: true, provider: 'openai', stt: false, tts: false, timeout: 30 } }));
  await page.route('**/api/agent', route => {
    const messages = route.request().postDataJSON().messages;
    return route.fulfill({ json: { messages: [...messages, { role: 'assistant', content: text }], events: [{ t: 'text', plain: text }] } });
  });
}

test('historia rozmów i szkic przeżywają odświeżenie, a „Wyczyść historię” usuwa zapis', async ({ page }) => {
  await answerWith(page, 'Odpowiedź z modelu');
  await open(page);
  await page.locator('#prompt').fill('Pierwsze pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('.msg.user').last()).toContainText('Pierwsze pytanie');
  await expect(page.locator('#chat')).toContainText('Odpowiedź z modelu');
  await page.locator('#prompt').fill('Mój szkic');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mobywatels.chat.v1'))).not.toBeNull();

  await page.reload();
  await page.locator('#prompt').click();
  await expect(page.locator('#prompt')).toHaveValue('Mój szkic');
  await page.locator('#prompt').press('Enter');
  await page.locator('#histBtn').click();
  await expect(page.locator('#hlist')).toContainText('Pierwsze pytanie');
  await page.locator('#historyBack').click();

  await page.locator('#histBtn').click();
  await page.locator('#clearHistory').click();
  await expect(page.locator('#chat')).not.toContainText('Pierwsze pytanie');
  await expect(page.locator('#prompt')).toHaveValue('');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mobywatels.chat.v1') || '{"convs":[1]}').convs)).toHaveLength(0);
  await page.reload();
  await page.locator('#prompt').click();
  await expect(page.locator('#chat')).not.toContainText('Pierwsze pytanie');
});

test('zapisana rozmowa wraca jako tekst, bez kart potwierdzeń i bez przycisków akcji', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    localStorage.setItem('mobywatels.chat.v1', JSON.stringify({
      v: 1, active: 1, draft: '',
      convs: [{ title: 'Stara rozmowa', icon: 'doc', last: 'Odpowiedź', t: Date.now(), api: [{ role: 'user', content: 'Stare pytanie' }], html: '<div class="msg user" data-t="0">Stare pytanie</div><div class="msg bot">Odpowiedź</div><div class="ui review-card"><button class="btn primary review-confirm">Potwierdź</button></div>' }]
    }));
  });
  await page.reload();
  await page.locator('#prompt').click();
  await expect(page.locator('#chat')).toContainText('Odpowiedź');
  await expect(page.locator('.review-card')).toHaveCount(0);
  await expect(page.locator('.review-confirm')).toHaveCount(0);
});

test('nieaktualna wersja schematu zapisu jest pomijana bez błędu', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await page.evaluate(() => localStorage.setItem('mobywatels.chat.v1', JSON.stringify({ v: 99, convs: [{ title: 'Stara', html: '<div class="msg bot">Stara</div>' }] })));
  await page.reload();
  await page.locator('#prompt').click();
  await expect(page.locator('#chat')).not.toContainText('Stara');
});

test('zablokowana pamięć nie udaje zapisu historii', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  await page.locator('#prompt').fill('Pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#appStatus')).toContainText('Nie udało się zapisać historii');
});
