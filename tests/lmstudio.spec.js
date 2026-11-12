const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function configure(page, options = {}) {
  const info = { agent: true, provider: 'lmstudio', model: '', timeout: 180, lmstudio_id: 'test-server', stt: false, tts: false, ...options.info };
  await page.route('**/api/health', route => route.fulfill({ json: info }));
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
}

async function modelList(page, models) {
  await page.route('**/api/lmstudio/models', route => route.fulfill({ json: { models } }));
}

test('po wyborze modelu rozmowa trafia do serwera aplikacji, a wybór jest trwały', async ({ page }) => {
  const calls = [];
  await modelList(page, ['model/one', 'model/two']);
  await page.route('**/api/agent', route => {
    const payload = route.request().postDataJSON();
    calls.push(payload);
    return route.fulfill({ json: { messages: [...payload.messages, { role: 'assistant', content: 'Odpowiedź z LM Studio' }], events: [{ t: 'text', plain: 'Odpowiedź z LM Studio' }] } });
  });
  await configure(page);
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioCard')).toBeVisible();
  await expect(page.locator('#lmStudioModel')).toBeDisabled();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('Połączono z LM Studio');
  await expect(page.locator('#lmStudioModel')).toBeEnabled();
  await page.locator('#lmStudioModel').selectOption('model/two');
  await expect(page.locator('#lmStudioStatus')).toContainText('Wybrano model: model/two');
  await page.locator('#helpBack').click();
  await page.locator('#prompt').fill('Jak znaleźć urząd?');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Odpowiedź z LM Studio');
  expect(calls).toHaveLength(1);
  expect(calls[0].model).toBe('model/two');
  expect(calls[0].messages.at(-1)).toEqual({ role: 'user', content: 'Jak znaleźć urząd?' });
  expect(calls[0]).not.toHaveProperty('apiKey');
  await page.reload();
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('Wybrany model: model/two');
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('model/two');
});

test('jedyny dostępny model jest wybierany, a poprawiona transkrypcja jest wysyłana świadomie', async ({ page }) => {
  let payload;
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {}
      stop() { const result = [{ transcript: 'Znajdź urząd' }]; result.isFinal = true; this.onresult({ results: [result] }); this.onend(); }
      abort() {}
    };
  });
  await modelList(page, ['model/one']);
  await page.route('**/api/agent', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { messages: [...payload.messages, { role: 'assistant', content: 'Odpowiedź modelu' }], events: [{ t: 'text', plain: 'Odpowiedź modelu' }] } });
  });
  await configure(page);
  await page.locator('#mic').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('model/one');
  await expect(page.locator('#lmStudioStatus')).toContainText('jedyny dostępny model');
  await page.locator('#dictate').click();
  await page.locator('#dictate').click();
  await expect(page.locator('#voiceDraft')).toHaveValue('Znajdź urząd');
  expect(payload).toBeUndefined();
  await page.locator('#voiceDraft').fill('Znajdź urząd skarbowy');
  await page.locator('#sendDraft').click();
  await expect(page.locator('#chat')).toContainText('Odpowiedź modelu');
  expect(payload.model).toBe('model/one');
  expect(payload.messages.at(-1).content).toBe('Znajdź urząd skarbowy');
});

test('błąd połączenia pokazuje wskazówkę i zachowuje wiadomość bez odpowiedzi zastępczej', async ({ page }) => {
  let online = false;
  let attempts = 0;
  await page.route('**/api/lmstudio/models', route => route.fulfill(online
    ? { json: { models: ['model/one'] } }
    : { status: 502, json: { error: 'Uruchom serwer LM Studio i sprawdź adres.' } }));
  await page.route('**/api/agent', route => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 502, json: { error: 'LM Studio odrzuciło dostęp. Sprawdź token.' } });
    const payload = route.request().postDataJSON();
    return route.fulfill({ json: { messages: [...payload.messages, { role: 'assistant', content: 'Odpowiedź po ponowieniu' }], events: [{ t: 'text', plain: 'Odpowiedź po ponowieniu' }] } });
  });
  await configure(page);
  await page.locator('#homeHelp').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('Uruchom serwer LM Studio');
  await expect(page.locator('#lmStudioModel')).toBeDisabled();
  online = true;
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('model/one');
  await page.locator('#helpBack').click();
  await page.locator('#prompt').fill('Moja wiadomość');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Moja wiadomość');
  await expect(page.locator('.review-card,.ui.done')).toHaveCount(0);
  await page.locator('#prompt').fill('Moja wiadomość');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Odpowiedź po ponowieniu');
  expect(attempts).toBe(2);
});

test('pusta lista nie wymyśla modelu, a brak wyboru jest wyjaśniony', async ({ page }) => {
  await modelList(page, []);
  await page.route('**/api/agent', route => route.fulfill({ status: 400, json: { error: 'Wybierz model LM Studio w Pomocy i dostępności.' } }));
  await configure(page);
  await page.locator('#homeHelp').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('lista modeli jest pusta');
  await expect(page.locator('#lmStudioModel')).toBeDisabled();
  await page.locator('#helpBack').click();
  await page.locator('#prompt').fill('Pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Wybierz model LM Studio');
  await expect(page.locator('#prompt')).toHaveValue('Pytanie');
});

test('stary wybór nie przenosi się na inny serwer i można pracować bez localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('mobywatels.lmstudio.model.v1', JSON.stringify({ server: 'old-server', model: 'stary/model' }));
    Storage.prototype.setItem = function() { throw new DOMException('blocked', 'SecurityError'); };
  });
  await modelList(page, ['nowy/jeden', 'nowy/dwa']);
  await configure(page, { info: { lmstudio_id: 'new-server' } });
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioStatus')).not.toContainText('stary/model');
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('');
  await page.locator('#lmStudioModel').selectOption('nowy/dwa');
  await expect(page.locator('#lmStudioStatus')).toContainText('nie udało się zapisać wyboru');
  expect(await page.evaluate(() => window.getLmStudioModel())).toBe('nowy/dwa');
});

test('nieobecny model i niebezpieczne nazwy z listy nie są uruchamiane jako HTML', async ({ page }) => {
  const unsafe = '<img src=x onerror="window.lmXss=1">';
  await page.addInitScript(() => localStorage.setItem('mobywatels.lmstudio.model.v1', JSON.stringify({ server: 'test-server', model: 'nieobecny' })));
  await modelList(page, [unsafe, 'model/one']);
  await configure(page);
  await page.locator('#homeHelp').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('nie jest na liście');
  await expect(page.locator('#lmStudioModel')).toHaveValue('nieobecny');
  await page.locator('#lmStudioModel').selectOption(unsafe);
  await expect(page.locator('#lmStudioStatus')).toContainText(unsafe);
  expect(await page.evaluate(() => window.lmXss)).toBeUndefined();
  await expect(page.locator('#lmStudioCard img')).toHaveCount(0);
});

test('ustawienia modelu mieszczą się w ramie przy dużym tekście i przechodzą wybrane kontrole dostępności', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await modelList(page, ['przykładowy/długi-identyfikator-modelu']);
  await configure(page);
  await page.locator('#openAccess').click();
  await page.locator('input[name="accessFont"][value="extra"]').check();
  await page.locator('#highContrast').check();
  await page.locator('#accessBack').click();
  await page.locator('#homeHelp').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toBeEnabled();
  const boxes = await page.evaluate(() => {
    const app = document.querySelector('#app').getBoundingClientRect();
    return ['lmStudioCard', 'lmStudioRefresh', 'lmStudioModel'].map(id => {
      const box = document.getElementById(id).getBoundingClientRect();
      return { left: box.left - app.left, right: app.right - box.right };
    });
  });
  boxes.forEach(box => { expect(box.left).toBeGreaterThanOrEqual(-1); expect(box.right).toBeGreaterThanOrEqual(-1); });
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
});

test('bez aktywnego dostawcy LM Studio dodatkowy panel nie zmienia układu', async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, provider: 'openai', stt: false, tts: false } }));
  await page.goto('/aplikacja');
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioCard')).toBeHidden();
});

test('domyślny model z konfiguracji jest pokazany bez fałszywego ostrzeżenia przed sprawdzeniem listy', async ({ page }) => {
  await modelList(page, ['ustawiony/model']);
  await configure(page, { info: { model: 'ustawiony/model' } });
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioStatus')).toContainText('Wybrany model: ustawiony/model');
  await expect(page.locator('#lmStudioModel option:checked')).toHaveText('ustawiony/model');
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('ustawiony/model');
});

test('niepoprawny adres konfiguracji nie jest przedstawiany jako działające połączenie', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/lmstudio/models', route => { calls++; return route.fulfill({ json: { models: ['model'] } }); });
  await configure(page, { info: { agent: false, lmstudio_id: null } });
  await page.locator('#homeHelp').click();
  await expect(page.locator('#lmStudioRefresh')).toBeDisabled();
  await expect(page.locator('#lmStudioStatus')).toContainText('Nieprawidłowy adres serwera');
  expect(calls).toBe(0);
});

test('wewnętrzny błąd serwera nie ujawnia technicznych szczegółów w rozmowie', async ({ page }) => {
  await page.route('**/api/agent', route => route.fulfill({ status: 500, json: { error: 'wewnętrzny sekret i ścieżka serwera' } }));
  await configure(page, { info: { model: 'model/one' } });
  await page.locator('#prompt').fill('Pytanie');
  await page.locator('#prompt').press('Enter');
  await expect(page.locator('#chat')).toContainText('Nie udało się połączyć z asystentem AI');
  await expect(page.locator('#chat')).not.toContainText('wewnętrzny sekret');
  await expect(page.locator('#prompt')).toHaveValue('Pytanie');
});

test('wyboru modelu można dokonać klawiaturą, także w poziomym widoku telefonu', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 320 });
  await modelList(page, ['model/one', 'model/two']);
  await configure(page);
  await page.locator('#homeHelp').focus();
  await page.keyboard.press('Enter');
  await page.locator('#lmStudioRefresh').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lmStudioModel')).toBeEnabled();
  await page.locator('#lmStudioModel').focus();
  await page.keyboard.press('End');
  await expect(page.locator('#lmStudioModel')).toHaveValue('model/two');
  await page.keyboard.press('Tab');
  const overflow = await page.evaluate(() => {
    const app = document.querySelector('#app');
    const item = document.querySelector('#lmStudioModel').getBoundingClientRect();
    const frame = app.getBoundingClientRect();
    return { page: document.documentElement.scrollWidth - document.documentElement.clientWidth, left: item.left - frame.left, right: frame.right - item.right };
  });
  expect(overflow.page).toBeLessThanOrEqual(1);
  expect(overflow.left).toBeGreaterThanOrEqual(-1);
  expect(overflow.right).toBeGreaterThanOrEqual(-1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#helpPanel')).not.toHaveClass(/on/);
  await expect(page.locator('#homeHelp')).toBeFocused();
});

test('lista odrzuca nazwy zawierające niewidoczne znaki sterujące', async ({ page }) => {
  await modelList(page, ['zły\u202emodel', 'model/one']);
  await configure(page);
  await page.locator('#homeHelp').click();
  await page.locator('#lmStudioRefresh').click();
  await expect(page.locator('#lmStudioModel')).toHaveValue('model/one');
  await expect(page.locator('#lmStudioModel option')).toHaveCount(2);
});
