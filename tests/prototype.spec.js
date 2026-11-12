const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const duck = require('duck');

async function open(page, query = '') {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja?test=1' + query);
}

async function idle(page) {
  await expect.poll(() => page.evaluate(() => inflight), { timeout: 5000 }).toBe(0);
}

async function send(page, text) {
  await page.locator('#prompt').fill(text);
  await page.locator('#prompt').press('Enter');
  await idle(page);
}

async function checkAxe(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
}

test('przykładowe przypomnienie, słowniczek, pomoc bliskiej osoby i wyszukiwarka', async ({ page }) => {
  await open(page);
  await page.locator('#exampleReminder').click();
  await expect(page.locator('#reminderScreen')).toContainText('Przykładowy termin ważności');
  await expect(page.locator('#exampleDate')).toHaveText('20.05.2031');
  await page.locator('#reminderScreen summary').click();
  await expect(page.locator('#reminderScreen details')).toContainText('o ile nie zostanie wcześniej unieważniony');
  await page.locator('#helpBack').click();
  await page.locator('#trustedHelp').click();
  await expect(page.locator('#trustedScreen')).toContainText('nie udostępnia bliskiej osobie żadnych danych');
  await expect(page.locator('#trustedScreen')).toContainText('haseł, danych logowania ani kodów SMS');
  await page.locator('#trustedScreen summary').click();
  await expect(page.locator('#trustedScreen details')).toContainText('określonym zakresie');
  await page.locator('#helpBack').click();
  await page.locator('#safetyHelp').click();
  await expect(page.locator('#safetyScreen')).toContainText('Asystent nie jest urzędem');
  await expect(page.locator('#safetyScreen')).toContainText('Oficjalne potwierdzenie');
  await page.locator('#helpBack').click();
  await page.locator('#caseSearch').fill('wniosek');
  await expect(page.locator('#searchResults')).toContainText('Wniosek o dowód osobisty');
  await page.getByRole('button', { name: 'Wniosek o dowód osobisty' }).click();
  await idle(page);
  await expect(page.locator('#chat')).toContainText('Asystent AI jest teraz niedostępny');
});

test('wyszukiwarka otwiera termin dla wybranej osoby i Wstecz przywraca fokus', async ({ page }) => {
  await open(page, '&osoba=ewa');
  await page.locator('#homeHelp').click();
  await page.locator('#caseSearch').fill('termin');
  await page.getByRole('button', { name: 'Dowód osobisty — termin ważności' }).click();
  await expect(page.locator('#exampleDate')).toHaveText('05.12.2026');
  await expect(page.locator('#reminderTitle')).toBeFocused();
  await page.locator('#helpBack').click();
  await expect(page.locator('#helpBack')).toBeFocused();
  await page.locator('#trustedHelp').click();
  await page.locator('#trustedBack').click();
  await expect(page.locator('#helpBack')).toBeFocused();
});

test('brak rozpoznawania mowy nie wysyła fikcyjnego tekstu i pozwala pisać', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, stt: false, tts: false } }));
  await open(page);
  await page.locator('#mic').click();
  await page.locator('#voiceDraft').fill('Chcę sprawdzić dowód');
  await page.locator('#dictate').click();
  await expect(page.locator('#dictationStatus')).toContainText('niedostępne');
  await expect(page.locator('.msg.user')).toHaveCount(0);
  await page.locator('#useDraft').click();
  await expect(page.locator('#prompt')).toHaveValue('Chcę sprawdzić dowód');
  await expect(page.locator('.msg.user')).toHaveCount(0);
});

test('dyktowanie w przeglądarce wymaga sprawdzenia i nie wysyła wypowiedzi', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {}
      stop() {
        const result = [{ transcript: 'termin ważności dowodu' }];
        result.isFinal = true;
        this.onresult({ results: [result] });
        this.onend();
      }
      abort() {}
    };
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, stt: false, tts: false } }));
  await open(page);
  await page.locator('#mic').click();
  await page.locator('#voiceDraft').fill('Proszę sprawdzić');
  await page.locator('#dictate').click();
  await expect(page.locator('#dictate')).toHaveText('Zakończ nagrywanie');
  await page.locator('#dictate').click();
  await expect(page.locator('#voiceDraft')).toHaveValue('Proszę sprawdzić termin ważności dowodu');
  await expect(page.locator('#dictationStatus')).toContainText('Nie został wysłany');
  await page.locator('#voiceDraft').fill('Poprawiona wiadomość');
  await page.locator('#useDraft').click();
  await expect(page.locator('#prompt')).toHaveValue('Poprawiona wiadomość');
  await expect(page.locator('.msg.user')).toHaveCount(0);
});

test('serwerowe rozpoznawanie oraz anulowanie nagrania', async ({ page }) => {
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }, configurable: true });
    window.MediaRecorder = class {
      constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['sample']) }); this.onstop(); }
    };
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, stt: true, tts: false } }));
  await page.route('**/api/stt?*', route => { requests += 1; return route.fulfill({ json: { text: 'rozpoznane słowa' } }); });
  await open(page);
  await page.locator('#mic').click();
  await page.locator('#dictate').click();
  await expect(page.locator('#dictate')).toHaveText('Zakończ nagrywanie');
  await page.locator('#cancelDictation').click();
  await expect(page.locator('#dictationStatus')).toContainText('anulowane');
  expect(requests).toBe(0);
  await page.locator('#dictate').click();
  await expect(page.locator('#dictate')).toHaveText('Zakończ nagrywanie');
  await page.locator('#dictate').click();
  await expect(page.locator('#voiceDraft')).toHaveValue('rozpoznane słowa');
  expect(requests).toBe(1);
  await expect(page.locator('.msg.user')).toHaveCount(0);
});

test('odczyt instrukcji można zatrzymać i odtworzyć ponownie', async ({ page }) => {
  await page.addInitScript(() => {
    window.reads = [];
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [], cancel() {}, speak: utterance => window.reads.push(utterance.text) }, configurable: true });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  await open(page);
  await page.locator('#homeHelp').click();
  await page.locator('#readInstructions').click();
  await expect(page.locator('#stopReading')).toBeEnabled();
  await page.locator('#stopReading').click();
  await expect(page.locator('#readingStatus')).toHaveText('Odczyt zatrzymany.');
  await page.locator('#replayReading').click();
  await expect.poll(() => page.evaluate(() => window.reads.length)).toBe(2);
  expect(await page.evaluate(() => window.reads[0])).toContain('nieoficjalny prototyp');
});

test('odczyt serwerowy można ponowić po odzyskaniu dostępności', async ({ page }) => {
  let healthChecks = 0;
  let requests = 0;
  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true });
    window.Audio = class {
      constructor(src) { this.src = src; }
      play() { window.audioPlayed = true; return Promise.resolve(); }
      pause() { window.audioPaused = true; }
    };
  });
  await page.route('**/api/health', route => route.fulfill({ json: { agent: false, stt: false, tts: ++healthChecks > 2 } }));
  await page.route('**/api/tts', route => { requests += 1; return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: 'audio' }); });
  await open(page);
  await page.locator('#homeHelp').click();
  await page.locator('#readInstructions').click();
  await expect(page.locator('#readingStatus')).toContainText('Odczyt nie jest dostępny');
  await page.locator('#readInstructions').click();
  await expect.poll(() => page.evaluate(() => window.audioPlayed)).toBe(true);
  expect(requests).toBe(1);
  await page.locator('#stopReading').click();
  expect(await page.evaluate(() => window.audioPaused)).toBe(true);
});

test('powrót ze szczegółów przykładowego przypomnienia zachowuje kontekst', async ({ page }) => {
  await open(page);
  await page.locator('#exampleReminder').click();
  await page.locator('#openExampleDocument').click();
  await expect(page.locator('#detail')).toHaveClass(/on/);
  await page.locator('#dclose').click();
  await expect(page.locator('#reminderScreen')).toBeVisible();
  await page.locator('#helpBack').click();
  await page.locator('#helpBack').click();
  await expect(page.locator('#exampleReminder')).toBeFocused();
});

test('asystent odrzuca nieobsługiwane akcje nawet przy skonfigurowanym dostawcy', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/health', route => route.fulfill({ json: { agent: true, stt: false, tts: false } }));
  await page.route('**/api/agent', route => {
    requests += 1;
    const data = route.request().postDataJSON();
    expect(data.confirm).toBeUndefined();
    return route.fulfill({ json: { messages: data.messages, events: [{ t: 'confirm', id: 'demo', title: 'Wniosek o dowód', label: 'Potwierdź' }] } });
  });
  await open(page);
  await expect(page.locator('#app')).toHaveAttribute('data-agent', 'configured');
  await send(page, 'Wniosek o dowód');
  await expect(page.locator('.review-card')).toHaveCount(0);
  await expect(page.locator('#prompt')).toHaveValue('Wniosek o dowód');
  expect(requests).toBe(2);
});

test('przykładowy transfer wymaga jawnego wyboru w symulacji i pozwala ponowić po błędzie', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/znak/przekaz', async route => {
    if (route.request().postDataJSON().ok && ++attempts === 1) {
      await route.fulfill({ status: 503, json: { error: 'Brak połączenia' } });
    } else {
      await route.continue();
    }
  });
  await open(page);
  const receiver = 'test-receiver-' + Date.now();
  const beat = async () => (await page.request.post('/api/znak/beat', { data: { dev: receiver, token: 4242, kind: 'web', kto: 'Przykładowy odbiorca', cel: 'pelnoletnosc', zakres: [['Pełnoletność', 'pelnoletnosc']] } })).json();
  await beat();
  await page.evaluate(receiver => {
    window.transferResult = null;
    qrFlow().then(result => { window.transferResult = result; });
    pConsent({ dev: receiver, kind: 'web', kto: 'Przykładowy odbiorca', cel: 'pelnoletnosc', zakres: [['Pełnoletność', 'pelnoletnosc']] });
  }, receiver);
  await expect(page.locator('#qrx')).toContainText('To nie jest prawdziwa zgoda ani weryfikacja');
  expect((await beat()).otrzymane).toEqual([]);
  await page.locator('[data-share-index="0"]').check();
  await page.getByRole('button', { name: 'Potwierdź w symulacji' }).click();
  await expect(page.locator('.transfer-status')).toContainText('Nie udało się przekazać');
  await expect(page.getByRole('button', { name: 'Potwierdź w symulacji' })).toBeEnabled();
  expect((await beat()).otrzymane).toEqual([]);
  await page.getByRole('button', { name: 'Potwierdź w symulacji' }).click();
  await expect(page.locator('#qrx')).toContainText('Przykładowe dane przekazane');
  await page.locator('#qrx .qdone button').click();
  await expect.poll(() => page.evaluate(() => window.transferResult && window.transferResult.ok)).toBe(true);
  const received = (await beat()).otrzymane;
  expect(attempts).toBe(2);
  expect(received).toHaveLength(1);
  expect(received[0].dane.rows).toEqual([['Pełnoletność', 'tak, ukończone 18 lat']]);
});

test('podsumowanie prywatności symuluje AI i przekazuje tylko zaznaczone pola', async ({ page }) => {
  await open(page);
  const receiver = 'privacy-review-' + Date.now();
  const scope = await page.evaluate(() => ZAKRESY.tozsamosc.pola);
  const beat = async () => (await page.request.post('/api/znak/beat', { data: { dev: receiver, token: 4243, kind: 'web', kto: 'Odbiorca testowy', cel: 'tozsamosc', zakres: scope } })).json();
  await beat();
  await page.evaluate(receiver => {
    pConsent({ dev: receiver, kind: 'web', kto: 'Odbiorca testowy', cel: 'tozsamosc', zakres: ZAKRESY.tozsamosc.pola });
  }, receiver);
  await expect(page.locator('#shareAssistantHeading')).toHaveText('Co mogę udostępnić?');
  await expect(page.locator('.share-assistant')).toContainText('AI · SYMULACJA PROTOTYPU');
  await expect(page.locator('.share-assistant')).toContainText('Cel podany przez odbiorcę');
  await expect(page.locator('.share-assistant')).toContainText('Konsekwencje udostępnienia');
  await expect(page.locator('.share-assistant')).toContainText('Nie jest weryfikowany');
  await expect(page.getByRole('button', { name: 'Potwierdź w symulacji' })).toBeDisabled();
  await page.locator('[data-share-index="0"]').check();
  await page.locator('[data-share-index="3"]').uncheck();
  await expect(page.locator('.share-omission')).toContainText('Pominiesz:');
  await expect(page.locator('.share-consequence')).toContainText('wybrane pola z przykładowego profilu');
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) })).filter(item => !item.id.startsWith('color-contrast'))).toEqual([]);
  const sent = page.waitForResponse(response => response.url().endsWith('/api/znak/przekaz'));
  await page.getByRole('button', { name: 'Potwierdź w symulacji' }).click();
  await sent;
  await expect(page.locator('#qrx')).toContainText('Przykładowe dane przekazane');
  await page.locator('#qrx .qdone button').click();
  const received = (await beat()).otrzymane;
  expect(received).toHaveLength(1);
  expect(received[0].dane.rows.map(row => row[0])).not.toContain('PESEL');
  expect(received[0].dane.rows.length).toBeGreaterThan(0);
});

test('odmowa transferu nie przekazuje danych, a odebrane dane są oznaczone jako przykład', async ({ page }) => {
  await open(page);
  const receiver = 'test-refusal-' + Date.now();
  const beat = async () => (await page.request.post('/api/znak/beat', { data: { dev: receiver, token: 4343, kind: 'web' } })).json();
  await beat();
  await page.evaluate(receiver => {
    window.refusal = null;
    qrFlow().then(result => { window.refusal = result; });
    pConsent({ dev: receiver, kind: 'web', kto: 'Przykładowy odbiorca', cel: 'pelnoletnosc', zakres: [['Pełnoletność', 'pelnoletnosc']] });
  }, receiver);
  const request = page.waitForResponse(response => response.url().endsWith('/api/znak/przekaz'));
  await page.getByRole('button', { name: 'Odmów' }).click();
  await request;
  await expect.poll(() => page.evaluate(() => window.refusal && window.refusal.ok)).toBe(false);
  const received = (await beat()).otrzymane;
  expect(received).toHaveLength(1);
  expect(received[0].ok).toBe(false);
  expect(received[0].dane).toBeNull();
  await page.evaluate(() => {
    przyjmijFlow();
    odebrano({ ok: true, dane: { cel: 'pelnoletnosc', rows: [['Pełnoletność', 'przykład']] } });
  });
  await expect(page.locator('#zx')).toContainText('Nie sprawdzono rejestrów ani tożsamości');
  await expect(page.locator('#zx')).toContainText('będą widoczne do zamknięcia');
  await page.locator('#zx .qbtn').click();
  await expect(page.locator('#zx')).not.toHaveClass(/on/);
});

test('znak do przyjmowania danych nie wygasa podczas otwartego ekranu', async ({ page }) => {
  await page.clock.install();
  await page.route('**/api/znak/beat', route => route.fulfill({ json: { otrzymane: [], skanuje: false, zmien: false } }));
  await open(page);
  await page.evaluate(() => { window.initialToken = TOKEN; przyjmijFlow(); });
  await expect(page.locator('#zx')).toContainText('Znak jest widoczny do zamknięcia ekranu');
  await page.clock.fastForward(35000);
  expect(await page.evaluate(() => TOKEN === window.initialToken)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#zx')).not.toHaveClass(/on/);
});

test('tekst odpowiedzi modelu nie uruchamia znaczników HTML', async ({ page }) => {
  const malicious = '<img src=x onerror=window.injected=1>';
  await page.route('**/api/health', route => route.fulfill({ json: { agent: true, stt: false, tts: false } }));
  await page.route('**/api/agent', route => route.fulfill({ json: {
    messages: [...route.request().postDataJSON().messages, { role: 'assistant', content: malicious }],
    events: [{ t: 'text', plain: malicious }]
  } }));
  await open(page);
  await send(page, 'Przykład');
  await expect(page.locator('.msg.bot')).toHaveText(malicious);
  expect(await page.locator('.msg.bot img').count()).toBe(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('wszystkie układy kart przechodzą automatyczne reguły WCAG', async ({ page }) => {
  for (const variant of ['stos', 'karuzela', 'pion', 'lista', 'siatka']) {
    await open(page, '&uklad=' + variant);
    await checkAxe(page);
    await expect(page.locator('#exampleReminder')).toBeVisible();
  }
});

test('lokalne adresy aplikacji i jej zasobów obsługują GET oraz HEAD', async ({ request }) => {
  for (const path of ['/aplikacja', '/aplikacja/', '/en/aplikacja/', '/en/aplikacja/core.js', '/komputer']) {
    expect((await request.get(path)).status()).toBe(200);
    expect((await request.head(path)).status()).toBe(200);
  }
});

test('polskie nowe treści są oznaczone językiem w wersji angielskiej', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/en/aplikacja/?tryb=skrypt');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#exampleReminder')).toHaveAttribute('lang', 'pl');
  await page.locator('#homeHelp').click();
  await expect(page.locator('#helpPanel')).toHaveAttribute('lang', 'pl');
  await expect(page.locator('#safetyHelp')).toContainText('Czy to bezpieczne?');
});

test('sam fokus pola nie zmienia ekranu, propozycje otwierają się po wyborze', async ({ page }) => {
  await open(page);
  await page.locator('#prompt').focus();
  await expect(page.locator('#app')).not.toHaveClass(/chatting/);
  await page.locator('#prompt').fill('Zachowany szkic');
  await page.locator('#showSuggestions').click();
  await expect(page.locator('#app')).toHaveClass(/chatting/);
  await expect(page.locator('#prompt')).toHaveValue('Zachowany szkic');
  await expect(page.locator('.sugg button').first()).toBeFocused();
});

test('klawiatura, dialogi i przywracanie fokusu', async ({ page }) => {
  await open(page);
  await page.locator('#homeHelp').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#helpPanel')).toHaveClass(/on/);
  await expect(page.locator('#helpBack')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => document.querySelector('#helpPanel').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('#helpBack')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#homeHelp')).toBeFocused();
  await page.locator('#title').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menuBack')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#title')).toBeFocused();
  const card = page.getByRole('button', { name: 'Otwórz mDowód' });
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#dclose')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card).toBeFocused();
});

test('brak poziomego przewijania w małym widoku, poziomie i przy większych odstępach', async ({ page }) => {
  await open(page);
  for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 320, height: 422 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rect = await page.locator('#app').boundingBox();
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(size.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(size.height);
    await page.locator('#homeHelp').click();
    await expect.poll(() => page.locator('#helpScroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
    await page.locator('#helpBack').click();
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'spacing-test';
    style.textContent = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p{margin-bottom:2em!important}';
    document.head.append(style);
  });
  await expect(page.locator('#app')).toHaveClass(/header-stacked/);
  await page.locator('#homeHelp').click();
  await expect.poll(() => page.locator('#helpScroll').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  await page.locator('#caseSearch').fill('bezpieczenstwo');
  await expect(page.locator('#searchResults')).toContainText('Czy to bezpieczne?');
});

test('karuzele mają przyciski Poprzedni i Następny', async ({ page }) => {
  for (const variant of ['karuzela', 'pion']) {
    await open(page, '&uklad=' + variant);
    const previous = page.locator('.prev-doc');
    const next = page.locator('.next-doc');
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(previous).toBeEnabled();
    await expect(page.locator('#cstat')).toContainText('Ważna bezterminowo');
    await previous.click();
    await expect(previous).toBeDisabled();
  }
});

test('automatyczne sprawdzenie dostępności głównych ekranów', async ({ page }) => {
  await open(page);
  await checkAxe(page);
  await page.locator('#homeHelp').click();
  await checkAxe(page);
  await page.locator('#helpBack').click();
  await send(page, 'Chcę zapłacić podatek');
  await expect(page.locator('#chat')).toContainText('Asystent AI jest teraz niedostępny');
  await checkAxe(page);
});
