const { test, expect } = require('@playwright/test');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function waitForServer(process) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Serwer aplikacji nie wystartował: ' + output)), 10000);
    process.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.includes('mObywatel:')) { clearTimeout(timeout); resolve(); }
    });
    process.stderr.on('data', chunk => { output += chunk.toString(); });
    process.once('exit', code => { clearTimeout(timeout); reject(new Error('Serwer zakończył pracę: ' + code + ' ' + output)); });
  });
}

test('przeglądarka, serwer aplikacji i serwer zgodny z LM Studio wymieniają rzeczywiste żądania HTTP', async ({ page }) => {
  const calls = [];
  const lm = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      calls.push({ method: req.method, path: req.url, body: raw ? JSON.parse(raw) : null, authorization: req.headers.authorization });
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/v1/models') res.end(JSON.stringify({ data: [{ id: 'local/model' }] }));
      else if (req.method === 'POST' && req.url === '/v1/chat/completions') res.end(JSON.stringify({ choices: [{ message: { content: 'Odpowiedź z lokalnego serwera testowego.' } }] }));
      else { res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' })); }
    });
  });
  await new Promise(resolve => lm.listen(0, '127.0.0.1', resolve));
  const lmPort = lm.address().port;
  const appPort = await freePort();
  const app = spawn('python3', ['serwer/server.py', String(appPort)], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, HOST: '127.0.0.1', PROVIDER: 'lmstudio', LM_STUDIO_BASE_URL: `http://127.0.0.1:${lmPort}`, LM_STUDIO_MODEL: '', MODEL: '', LM_STUDIO_API_KEY: '', MODEL_API_KEY: '', PYTHONDONTWRITEBYTECODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await waitForServer(app);
    await page.addInitScript(() => { window.FAST = true; });
    await page.goto(`http://127.0.0.1:${appPort}/aplikacja`);
    await page.locator('#homeHelp').click();
    await page.locator('#lmStudioRefresh').click();
    await expect(page.locator('#lmStudioModel')).toHaveValue('local/model');
    await page.locator('#helpBack').click();
    await page.locator('#prompt').fill('Gdzie znajdę urząd?');
    await page.locator('#prompt').press('Enter');
    await expect(page.locator('#chat')).toContainText('Odpowiedź z lokalnego serwera testowego.');
    expect(calls.map(call => `${call.method} ${call.path}`)).toEqual(['GET /v1/models', 'POST /v1/chat/completions']);
    expect(calls[1].body.model).toBe('local/model');
    expect(calls[1].body.messages.at(-1)).toEqual({ role: 'user', content: 'Gdzie znajdę urząd?' });
    expect(calls[1].body).not.toHaveProperty('tools');
    expect(calls[1].authorization).toBeUndefined();
  } finally {
    if (app.exitCode === null) { app.kill('SIGTERM'); await once(app, 'exit'); }
    await new Promise(resolve => lm.close(resolve));
  }
});
