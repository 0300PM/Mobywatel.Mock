# -*- coding: utf-8 -*-
"""PROVIDER=workers: rozmowa przez worker Cloudflare (Workers AI) z API zgodnym z OpenAI."""
import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'serwer'))

import agent
import server


class FakeWorker(BaseHTTPRequestHandler):
    """Udaje worker Cloudflare: /v1/models oraz /v1/chat/completions, z opcjonalnym tokenem."""

    def log_message(self, *args):
        pass

    def reply(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.server.settings.get('token') and self.headers.get('Authorization') != 'Bearer ' + self.server.settings['token']:
            return self.reply(401, {'error': {'message': 'Brak autoryzacji.'}})
        with self.server.lock:
            self.server.calls.append({'path': self.path, 'headers': dict(self.headers)})
        if self.path == '/v1/models':
            return self.reply(200, {'object': 'list', 'data': [{'id': '@cf/meta/llama-3.3-70b-instruct-fp8-fast'}, {'id': '@cf/meta/llama-3.1-8b-instruct'}]})
        self.reply(404, {'error': {'message': 'nie ma'}})

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        with self.server.lock:
            self.server.calls.append({'path': self.path, 'headers': dict(self.headers), 'body': json.loads(data or b'{}')})
        if self.server.settings.get('token') and self.headers.get('Authorization') != 'Bearer ' + self.server.settings['token']:
            return self.reply(401, {'error': {'message': 'Brak autoryzacji.'}})
        if self.server.settings.get('status'):
            return self.reply(self.server.settings['status'], {'error': {'message': 'limit'}})
        body = json.loads(data or b'{}')
        self.reply(200, {'model': body.get('model'), 'choices': [{'message': {'content': 'Odpowiedź z ' + str(body.get('model'))}}],
                         'usage': {'prompt_tokens': 5, 'completion_tokens': 3}})


class WorkersTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.worker = ThreadingHTTPServer(('127.0.0.1', 0), FakeWorker)
        cls.worker.lock = threading.Lock()
        cls.worker_thread = threading.Thread(target=cls.worker.serve_forever, daemon=True)
        cls.worker_thread.start()
        cls.app = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        cls.app_thread = threading.Thread(target=cls.app.serve_forever, daemon=True)
        cls.app_thread.start()
        cls.worker_url = 'http://127.0.0.1:%d' % cls.worker.server_port
        cls.app_url = 'http://127.0.0.1:%d' % cls.app.server_port

    @classmethod
    def tearDownClass(cls):
        cls.app.shutdown(); cls.app.server_close(); cls.app_thread.join()
        cls.worker.shutdown(); cls.worker.server_close(); cls.worker_thread.join()

    def setUp(self):
        self.worker.calls = []
        self.worker.settings = {}
        patches = [
            patch.object(agent, 'PROVIDER', 'workers'),
            patch.object(agent, 'WORKERS_BASE_URL', self.worker_url + '/v1'),
            patch.object(agent, 'WORKERS_TOKEN', ''),
            patch.object(agent, 'WORKERS_MODEL', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
            patch.object(agent, 'WORKERS_TIMEOUT', 5),
            patch.object(server, 'zablokowane', return_value=False),
            patch.object(server, 'log'),
            patch.dict(os.environ, {'OPENAI_API_KEY': ''}),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def request(self, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.app_url + path, data=data, headers={}, method='POST' if data is not None else 'GET')
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)

    def chat(self, **extra):
        return self.request('/api/agent', dict({'messages': [{'role': 'user', 'content': 'Gdzie jest urząd?'}]}, **extra))

    def test_address_is_normalised_and_readiness_needs_url(self):
        self.assertTrue(agent.workers_ready())
        for url in (self.worker_url, self.worker_url + '/v1', self.worker_url + '/v1/chat/completions'):
            with self.subTest(url=url), patch.object(agent, 'WORKERS_BASE_URL', url):
                self.assertTrue(agent.workers_ready())
        for url in ('', 'ftp://x', 'http://user:pass@host/v1', 'http://host/api/v1'):
            with self.subTest(url=url), patch.object(agent, 'WORKERS_BASE_URL', url):
                self.assertFalse(agent.workers_ready())

    def test_chat_goes_through_the_worker(self):
        status, result = self.chat()
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z @cf/meta/llama-3.3-70b-instruct-fp8-fast')
        call = self.worker.calls[-1]
        self.assertEqual(call['path'], '/v1/chat/completions')
        self.assertEqual(call['body']['model'], '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
        self.assertEqual(call['body']['messages'][0], {'role': 'system', 'content': agent.REAL_SYSTEM})
        self.assertNotIn('Authorization', call['headers'])

    def test_selected_model_and_token_are_passed_to_the_worker(self):
        self.worker.settings['token'] = 'sekret-workera'
        with patch.object(agent, 'WORKERS_TOKEN', 'sekret-workera'):
            status, result = self.chat(model='@cf/meta/llama-3.1-8b-instruct')
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z @cf/meta/llama-3.1-8b-instruct')
        call = self.worker.calls[-1]
        self.assertEqual(call['headers']['Authorization'], 'Bearer sekret-workera')
        self.assertNotIn('sekret-workera', json.dumps(result))

    def test_model_list_comes_from_the_worker(self):
        status, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 200)
        self.assertEqual(result['models'], ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'])
        self.assertEqual(self.worker.calls[-1]['path'], '/v1/models')

    def test_health_reports_workers_without_leaking_the_token(self):
        with patch.object(agent, 'WORKERS_TOKEN', 'sekret-workera'):
            status, health = self.request('/api/health')
        self.assertEqual(status, 200)
        self.assertEqual(health['provider'], 'workers')
        self.assertTrue(health['agent'])
        self.assertEqual(health['model'], '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
        self.assertNotIn('sekret-workera', json.dumps(health))

    def test_without_url_the_assistant_is_unavailable(self):
        with patch.object(agent, 'WORKERS_BASE_URL', ''):
            status, result = self.chat()
        self.assertEqual(status, 503)
        self.assertEqual(self.worker.calls, [])

    def test_errors_talk_about_the_worker_not_lm_studio(self):
        status, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 200)   # lista modeli działa, dopóki worker odpowiada
        with patch.object(agent, 'WORKERS_BASE_URL', 'http://127.0.0.1:9/v1'):
            status, result = self.chat()
        self.assertEqual(status, 502)
        self.assertIn('worker', result['error'].lower())
        self.assertNotIn('LM Studio', result['error'])

    def test_missing_address_points_at_the_variable(self):
        with patch.object(agent, 'WORKERS_BASE_URL', ''):
            status, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 502)
        self.assertIn('CLOUDFLARE_WORKERS_URL', result['error'])

    def test_worker_error_is_reported_and_never_answered_with_a_script(self):
        self.worker.settings['status'] = 429
        status, result = self.chat()
        self.assertEqual(status, 502)
        self.assertNotIn('events', result)


if __name__ == '__main__':
    unittest.main()
