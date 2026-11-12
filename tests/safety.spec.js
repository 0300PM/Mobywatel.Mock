const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

async function openSafety(page, path = '/aplikacja') {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto(path);
  await page.locator('#openSafety').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/on/);
  await expect(page.locator('#safetyScenarioSelect')).toBeVisible();
}

test('bezpieczny obywatel pokazuje ogólne poradniki, jawny status i dostępny kontakt alarmowy', async ({ page }) => {
  await page.addInitScript(() => { window.FAST = true; });
  await page.goto('/aplikacja');
  const scrolling = await page.locator('#homeContent').evaluate(node => {
    document.querySelector('#app').classList.add('compact-view');
    const style = getComputedStyle(node);
    return { overflowY: style.overflowY, scrollbarWidth: style.scrollbarWidth };
  });
  expect(scrolling.overflowY).toBe('auto');
  expect(scrolling.scrollbarWidth).toBe('none');
  await page.locator('#openSafety').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/on/);
  await expect(page.locator('#safetyScenarioSelect')).toBeVisible();
  await expect(page.locator('.safety-status-unknown')).toContainText('Nieznany');
  await expect(page.locator('.safety-status-unknown')).toContainText('nie pobiera bieżących alertów');
  await expect(page.locator('#safetyPanel a[href="tel:112"]').first()).toBeVisible();
  await expect(page.locator('#safetyGuide')).toContainText('Najczęstsze błędy');
  await expect(page.locator('#safetyGuide')).toContainText('Oficjalne źródła');
  await page.locator('#safetyMode').click();
  await expect(page.locator('#safetyPanel')).toHaveClass(/safety-emergency/);
  await expect(page.locator('#safetyMode')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#safetyAccessTools')).toBeVisible();
  await page.locator('#safetyExitMode').click();
  await expect(page.locator('#safetyPanel')).not.toHaveClass(/safety-emergency/);
  const axe = await new AxeBuilder({ page }).include('#safetyPanel').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#safetyPanel')).not.toHaveClass(/on/);
});

test('bezpośrednie zagrożenie pokazuje 112 i nigdy nie wysyła opisu do AI', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/safety/assist', route => { requests += 1; return route.fulfill({ status: 500, json: {} }); });
  await openSafety(page);
  await page.locator('#safetySituation').fill('W mieszkaniu jest dym.');
  await page.locator('#safetyImmediate').selectOption('yes');
  await expect(page.locator('#safetyDirectNotice')).toBeVisible();
  await expect(page.locator('#safetyDirectNotice a')).toHaveAttribute('href', 'tel:112');
  await page.locator('#safetyAskAI').click();
  await expect(page.locator('#safetyAIStatus')).toContainText('Nie wysyłamy opisu do AI');
  expect(requests).toBe(0);
});

test('AI dostaje lokalizację wyłącznie po zgodzie; zdjęcie pozostaje lokalnym podglądem', async ({ page }) => {
  const payloads = [];
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/api/safety/assist', async route => {
    payloads.push(route.request().postDataJSON());
    await route.fulfill({ json: { result: { actions: ['Sprawdź oficjalny komunikat.'], checklist: ['Zapisz numer służb.'], avoid: ['Nie wchodź do wody.'], call_emergency: false } } });
  });
  await openSafety(page);
  await page.locator('#safetySituation').fill('Woda pojawia się przy drodze.');
  await page.locator('#safetyImmediate').selectOption('no');
  await page.locator('#safetyLocation').fill('Biłgoraj');
  await page.locator('#safetyAskAI').click();
  await expect(page.locator('#safetyAIResult')).toContainText('Sprawdź oficjalny komunikat.');
  expect(payloads[0].location).toBe('');
  expect(payloads[0]).not.toHaveProperty('photo');
  await page.locator('#safetyShareLocation').check();
  await page.locator('#safetyAskAI').click();
  await expect(page.locator('#safetyAIResult')).toContainText('Sprawdź oficjalny komunikat.');
  expect(payloads[1].location).toBe('Biłgoraj');
  expect(payloads[1].shareLocation).toBe(true);
  await page.locator('#safetyPhoto').setInputFiles({ name: 'scene.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aAAAAABJRU5ErkJggg==', 'base64') });
  await expect(page.locator('#safetyPhotoPreview')).toBeVisible();
  await expect(page.locator('#safetyPhotoStatus')).toContainText('nie zostanie wysłany');
  await page.locator('#safetyAskAI').click();
  await expect(page.locator('#safetyAIResult')).toContainText('Sprawdź oficjalny komunikat.');
  expect(payloads[2]).not.toHaveProperty('photo');
});

test('profil i plecak są opcjonalne, lokalne i zachowane po ponownym otwarciu', async ({ page }) => {
  await openSafety(page);
  const firstItem = page.locator('#safetyPackList input[type="checkbox"]').first();
  await firstItem.check();
  const firstLabel = await firstItem.getAttribute('data-pack-id');
  await page.locator('[name="safety-pets"]').check();
  await page.locator('#safetyProfileForm button[type="submit"]').click();
  await expect(page.locator('#safetyProfileStatus')).toContainText('Profil zapisano lokalnie');
  await page.reload();
  await page.locator('#openSafety').click();
  await expect(page.locator(`[data-pack-id="${firstLabel}"]`)).toBeChecked();
  await expect(page.locator('[name="safety-pets"]')).toBeChecked();
  await expect(page.locator('#safetyPackSuggestion')).toContainText('dla zwierząt');
  await page.locator('#safetyClearProfile').click();
  await expect(page.locator('[name="safety-pets"]')).not.toBeChecked();
});

test('interfejs modułu jest po angielsku, gdy język aplikacji jest en', async ({ page }) => {
  await openSafety(page, '/aplikacja?lang=en');
  await expect(page.locator('#safetyModuleTitle')).toHaveText('Safe Citizen');
  await expect(page.locator('.safety-status-unknown')).toContainText('Unknown');
  await expect(page.locator('#safetyScenarioSelect')).toContainText('Flood');
  await expect(page.locator('#safetyPanel a[href="tel:112"]').first()).toContainText('Call 112');
});
