/**
 * Worker Cloudflare dla Mobywatels: jedno API zgodne z OpenAI, które woła Workers AI.
 *
 * Endpointy:
 *   GET  /v1/models            lista modeli tekstowych Workers AI
 *   POST /v1/chat/completions  rozmowa (format OpenAI, obsługa tool_calls)
 *   GET  /                     krótki opis (żeby adres nie zwracał 404)
 *
 * Zmienne w panelu workera (Settings -> Variables and Secrets):
 *   CLOUDFLARE_ACCOUNT_ID      (wymagane) ID konta Cloudflare
 *   CLOUDFLARE_API_TOKEN       (sekret, zalecane) token z uprawnieniem Workers AI: Read
 *   WORKER_TOKEN               (sekret, opcjonalne) jeśli ustawione, każde żądanie musi mieć
 *                              nagłówek Authorization: Bearer <WORKER_TOKEN>
 *   DEFAULT_MODEL              (opcjonalne) domyślny model, np. @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *
 * Bez CLOUDFLARE_API_TOKEN worker korzysta z wiązania AI (env.AI), jeśli jest dostępne.
 */

const TEXT_MODELS = [
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistralai/mistral-small-3.1-24b-instruct',
  '@cf/qwen/qwen2.5-coder-32b-instruct',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

function authorised(request, env) {
  if (!env.WORKER_TOKEN) return true;
  const header = request.headers.get('Authorization') || '';
  return header === 'Bearer ' + env.WORKER_TOKEN;
}

/** Wiadomości OpenAI -> prompt tekstowy (Workers AI nie ma natywnego tool-callingu).
 *  Wywołania narzędzi z historii sklejamy w jedną wiadomość assistant, żeby modele nie dostawały
 *  dwóch wiadomości assistant pod rząd (część modeli wtedy odrzuca rozmowę). */
function toMessages(messages) {
  const out = [];
  for (const message of messages) {
    const role = message.role === 'tool' ? 'user' : message.role;   // wynik narzędzia jest danymi, nie odpowiedzią asystenta
    if (role === 'tool') {
      out.push({ role: 'user', content: '[wynik narzędzia ' + (message.tool_call_id || '') + '] ' + String(message.content ?? '') });
      continue;
    }
    let content = message.content;
    if (Array.isArray(content)) content = content.map((part) => part?.text || '').join('');
    if (message.tool_calls?.length) {
      const calls = message.tool_calls
        .map((call) => call.function?.name + '(' + (call.function?.arguments || '{}') + ')')
        .join('; ');
      content = (content ? content + '\n' : '') + '[wywołania narzędzi: ' + calls + ']';
    }
    out.push({ role: role === 'system' ? 'system' : role === 'assistant' ? 'assistant' : 'user', content: String(content ?? '') });
  }
  const merged = [];
  for (const message of out) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role && message.role !== 'system') {
      previous.content = (previous.content ? previous.content + '\n' : '') + message.content;
      continue;
    }
    merged.push({ ...message });
  }
  return merged;
}

async function chat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: 'Nieprawidłowy JSON.' } }, 400);
  }
  const model = body.model || env.DEFAULT_MODEL || TEXT_MODELS[0];
  const messages = toMessages(Array.isArray(body.messages) ? body.messages : []);
  if (!messages.length) return json({ error: { message: 'Brak wiadomości.' } }, 400);
  if (!messages.some((message) => message.role === 'user' && message.content.trim()))
    return json({ error: { message: 'Brak wiadomości użytkownika.' } }, 400);

  const payload = {
    messages,
    max_tokens: Math.min(Number(body.max_tokens) || 1500, 4096),
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.3,
  };

  let result;
  try {
    if (env.AI && !env.CLOUDFLARE_API_TOKEN) {
      result = await env.AI.run(model, payload);
    } else {
      if (!env.CLOUDFLARE_ACCOUNT_ID) return json({ error: { message: 'Brak CLOUDFLARE_ACCOUNT_ID.' } }, 500);
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/accounts/' + env.CLOUDFLARE_ACCOUNT_ID + '/ai/run/' + model,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + (env.CLOUDFLARE_API_TOKEN || ''),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok || data.success === false) {
        const message = data?.errors?.[0]?.message || 'Workers AI odrzuciło żądanie.';
        return json({ error: { message } }, response.status === 200 ? 502 : response.status);
      }
      result = data.result;
    }
  } catch (error) {
    return json({ error: { message: 'Błąd połączenia z Workers AI: ' + (error?.message || error) } }, 502);
  }

  let text = result?.response;
  if (typeof text !== 'string') text = result?.result?.response;
  if (typeof text !== 'string') text = '';

  return json({
    id: 'chatcmpl-' + crypto.randomUUID(),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: result?.usage?.prompt_tokens ?? null,
      completion_tokens: result?.usage?.completion_tokens ?? null,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!authorised(request, env)) return json({ error: { message: 'Brak autoryzacji.' } }, 401);

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, service: 'mobywatels-workers-ai', endpoints: ['/v1/models', '/v1/chat/completions'] });
    }
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      return json({
        object: 'list',
        data: TEXT_MODELS.map((id) => ({ id, object: 'model', owned_by: 'cloudflare' })),
      });
    }
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      return chat(request, env);
    }
    return json({ error: { message: 'Nie ma takiego adresu.' } }, 404);
  },
};
