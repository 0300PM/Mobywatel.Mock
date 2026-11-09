import concurrent.futures
import http.client
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
import lmstudio
import server


class FakeLMStudio(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, payload, content_type='application/json'):
        data = json.dumps(payload).encode() if isinstance(payload, (dict, list)) else payload
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def capture(self, data=None):
        item = {'method': self.command, 'path': self.path, 'headers': dict(self.headers), 'data': data}
        with self.server.lock:
            self.server.calls.append(item)
        return item

    def authenticate(self):
        required = self.server.settings.get('token')
        if required and self.headers.get('Authorization') != 'Bearer ' + required:
            self.reply(401, {'error': 'server-secret-detail'})
            return False
        return True

    def do_GET(self):
        self.capture()
        if not self.authenticate():
            return
        if self.server.settings.get('redirect'):
            self.send_response(307)
            self.send_header('Location', self.server.settings['redirect'])
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if self.path == '/v1/models':
            self.reply(200, self.server.settings.get('model_response', {'data': [{'id': 'model/one'}, {'id': 'model/two'}]}))
        else:
            self.reply(404, {'error': 'not found'})

    def do_POST(self):
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        self.capture(data)
        if not self.authenticate():
            return
        if self.server.settings.get('status'):
            self.reply(self.server.settings['status'], {'error': 'upstream error'})
            return
        try:
            body = json.loads(data)
        except ValueError:
            self.reply(400, {'error': 'invalid json'})
            return
        if self.path == '/v1/chat/completions' and self.server.settings.get('reject_tools') and 'tools' in body:
            self.reply(400, {'error': 'tools are not supported'})
            return
        if self.path == '/v1/chat/completions' and self.server.settings.get('navigate'):
            self.reply(200, {'choices': [{'message': {'tool_calls': [{'id': 'x', 'function': {'name': 'otworz_ekran', 'arguments': '{"ekran":"mapa"}'}}]}}]})
            return
        if body.get('stream'):
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.end_headers()
            self.wfile.write(b'data: first\n\n')
            self.wfile.flush()
            self.server.stream_started.set()
            self.server.finish_stream.wait(3)
            self.wfile.write(b'data: [DONE]\n\n')
            self.wfile.flush()
            return
        if self.path == '/v1/chat/completions':
            self.reply(200, {'model': body.get('model'), 'choices': [{'message': {'content': 'Odpowiedź z ' + str(body.get('model'))}}]})
        elif self.path in ('/v1/responses', '/v1/completions', '/v1/embeddings'):
            self.reply(200, {'path': self.path, 'received': body})
        else:
            self.reply(404, {'error': 'not found'})


class LMStudioTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.lm = ThreadingHTTPServer(('127.0.0.1', 0), FakeLMStudio)
        cls.lm.lock = threading.Lock()
        cls.lm_thread = threading.Thread(target=cls.lm.serve_forever, daemon=True)
        cls.lm_thread.start()
        cls.app = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        cls.app_thread = threading.Thread(target=cls.app.serve_forever, daemon=True)
        cls.app_thread.start()
        cls.lm_url = 'http://127.0.0.1:%d' % cls.lm.server_port
        cls.app_url = 'http://127.0.0.1:%d' % cls.app.server_port

    @classmethod
    def tearDownClass(cls):
        cls.app.shutdown()
        cls.app.server_close()
        cls.app_thread.join()
        cls.lm.shutdown()
        cls.lm.server_close()
        cls.lm_thread.join()

    def setUp(self):
        self.lm.calls = []
        self.lm.settings = {}
        self.lm.stream_started = threading.Event()
        self.lm.finish_stream = threading.Event()
        patches = [
            patch.object(agent, 'PROVIDER', 'lmstudio'),
            patch.object(agent, 'LM_STUDIO_BASE_URL', self.lm_url),
            patch.object(agent, 'LM_STUDIO_MODEL', ''),
            patch.object(agent, 'LM_STUDIO_TIMEOUT', 5),
            patch.object(server, 'zablokowane', return_value=False),
            patch.object(server, 'log'),
            patch.dict(os.environ, {'LM_STUDIO_API_KEY': '', 'MODEL_API_KEY': '', 'LM_STUDIO_OPENAI_PROXY': ''}),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def request(self, path, body=None, headers=None):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.app_url + path, data=data, headers=headers or {}, method='POST' if data is not None else 'GET')
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)

    def chat(self, model=None, text='Gdzie jest urząd?'):
        body = {'messages': [{'role': 'user', 'content': text}]}
        if model is not None:
            body['model'] = model
        return self.request('/api/agent', body)

    def test_base_urls_and_credentials_are_validated(self):
        self.assertEqual(lmstudio.base_url(self.lm_url), self.lm_url + '/v1')
        self.assertEqual(lmstudio.base_url(self.lm_url + '/v1/'), self.lm_url + '/v1')
        self.assertEqual(lmstudio.base_url('http://host.docker.internal:8791'), 'http://host.docker.internal:8791/v1')
        self.assertTrue(lmstudio.valid_model('google/gemma-4-12b'))
        for endpoint in lmstudio.ENDPOINTS:
            self.assertEqual(lmstudio.base_url(self.lm_url + '/v1' + endpoint), self.lm_url + '/v1')
        self.assertEqual(lmstudio.server_id(self.lm_url), lmstudio.server_id(self.lm_url + '/v1/'))
        for url in ('file:///tmp/a', 'http://user:secret@localhost:1234/v1', 'http://localhost:1234/v1?token=secret', 'http://localhost:1234/api/v1', 'http://localhost:1234/api/v1/models', 'http://localhost:1234/api/v1/chat', 'http://localhost:0', 'http://local host:1234', 'http://localhost:1234/\ud800'):
            with self.subTest(url=url), self.assertRaises(lmstudio.LMStudioError):
                lmstudio.base_url(url)

    def test_health_and_real_http_model_list_do_not_expose_keys(self):
        self.lm.settings['token'] = 'secret-test-token'
        with patch.dict(os.environ, {'LM_STUDIO_API_KEY': 'secret-test-token'}):
            status, health = self.request('/api/health')
            code, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 200)
        self.assertEqual(health['provider'], 'lmstudio')
        self.assertTrue(health['agent'])
        self.assertTrue(health['lmstudio_id'])
        self.assertEqual(code, 200)
        self.assertEqual(result['models'], ['model/one', 'model/two'])
        self.assertEqual(self.lm.calls[-1]['path'], '/v1/models')
        self.assertEqual(self.lm.calls[-1]['headers']['Authorization'], 'Bearer secret-test-token')
        self.assertNotIn('secret-test-token', json.dumps([health, result]))

    def test_list_validates_duplicates_and_bad_model_ids(self):
        self.lm.settings['model_response'] = {'data': [{'id': 'a'}, {'id': 'a'}, {'id': ''}, {'id': 'bad\nname'}, {'id': 'bad\u202ename'}, {'id': 'bad\ud800name'}, {'id': 'x' * 257}, None, {'id': 'b'}]}
        status, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 200)
        self.assertEqual(result['models'], ['a', 'b'])
        self.lm.settings['model_response'] = {'unexpected': True}
        status, result = self.request('/api/lmstudio/models')
        self.assertEqual(status, 502)
        self.assertEqual(result['code'], 'response')

    def test_chat_sends_selected_model_and_full_text_without_fictitious_tools(self):
        status, result = self.chat('model/two')
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z model/two')
        call = self.lm.calls[-1]
        payload = json.loads(call['data'])
        self.assertEqual(call['path'], '/v1/chat/completions')
        self.assertNotIn('Authorization', call['headers'])
        self.assertEqual(payload['model'], 'model/two')
        self.assertEqual(payload['messages'][0], {'role': 'system', 'content': agent.REAL_SYSTEM})
        self.assertEqual(payload['messages'][-1]['content'], 'Gdzie jest urząd?')
        self.assertNotIn('tools', payload)
        self.assertEqual(result['messages'][-1]['content'], 'Odpowiedź z model/two')

    def test_default_model_selection_and_invalid_values(self):
        status, result = self.chat()
        self.assertEqual(status, 400)
        self.assertIn('Wybierz model', result['error'])
        self.assertFalse(self.lm.calls)
        with patch.object(agent, 'LM_STUDIO_MODEL', 'configured-model'):
            status, result = self.chat()
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(self.lm.calls[-1]['data'])['model'], 'configured-model')
            for invalid in (False, 0, [], {}, 'bad\nmodel', 'bad\u202emodel', 'bad\ud800model', 'x' * 257):
                with self.subTest(model=invalid):
                    status, result = self.request('/api/agent', {'model': invalid, 'messages': [{'role': 'user', 'content': 'Pytanie'}]})
                    self.assertEqual(status, 400)
                    self.assertIn('Nieprawidłowa nazwa', result['error'])

    def test_unrelated_provider_key_is_never_sent_to_lm_studio(self):
        with patch.object(server, 'KEYS', {}), patch.dict(os.environ, {'LM_STUDIO_API_KEY': '', 'MODEL_API_KEY': 'other-provider-secret', 'OPENAI_API_KEY': 'openai-secret'}):
            status, result = self.chat('model/one')
        self.assertEqual(status, 200)
        self.assertNotIn('Authorization', self.lm.calls[-1]['headers'])
        self.assertNotIn('tools', json.loads(self.lm.calls[-1]['data']))
        self.assertNotIn('other-provider-secret', json.dumps(result))
        self.assertNotIn('openai-secret', json.dumps(result))

    def test_models_are_request_scoped_under_concurrency(self):
        names = ['model/one', 'model/two'] * 6
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(self.chat, names))
        for name, (status, result) in zip(names, results):
            self.assertEqual(status, 200)
            self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z ' + name)
        self.assertCountEqual([json.loads(call['data'])['model'] for call in self.lm.calls], names)

    def test_connection_and_auth_errors_are_safe_and_never_fabricate_answers(self):
        self.lm.settings['token'] = 'the-real-token'
        with patch.dict(os.environ, {'LM_STUDIO_API_KEY': 'wrong-secret'}):
            status, result = self.request('/api/lmstudio/models')
            self.assertEqual(status, 502)
            self.assertEqual(result['code'], 'auth')
            status, result = self.chat('model/one')
            self.assertEqual(status, 502)
            self.assertEqual(result['code'], 'auth')
            self.assertNotIn('wrong-secret', json.dumps(result))
            self.assertNotIn('server-secret-detail', json.dumps(result))
            self.assertNotIn('wrong-secret', str(server.log.call_args_list))
            self.assertNotIn('server-secret-detail', str(server.log.call_args_list))
            self.assertNotIn('events', result)
        with patch.object(agent, 'LM_STUDIO_BASE_URL', 'http://127.0.0.1:1'):
            status, result = self.chat('model/one')
        self.assertEqual(status, 502)
        self.assertEqual(result['code'], 'offline')
        self.assertNotIn('events', result)

    def test_local_model_errors_never_expose_provider_details(self):
        with patch.object(agent, 'live_chat', side_effect=agent.BladAPI('private-provider-detail')):
            status, result = self.chat('model/one')
        self.assertEqual(status, 502)
        self.assertEqual(result['code'], 'response')
        self.assertNotIn('private-provider-detail', json.dumps(result))
        self.assertNotIn('private-provider-detail', str(server.log.call_args_list))

    def test_timeout_and_blocked_access_do_not_retry(self):
        with patch.object(lmstudio, 'open_request', side_effect=TimeoutError('timeout')) as call:
            status, result = self.chat('model/one')
        self.assertEqual(status, 502)
        self.assertEqual(result['code'], 'timeout')
        self.assertEqual(call.call_count, 1)
        with patch.object(server, 'zablokowane', return_value=True):
            status, _ = self.chat('model/one')
            list_status, _ = self.request('/api/lmstudio/models')
        self.assertEqual(status, 503)
        self.assertEqual(list_status, 503)
        self.assertFalse(self.lm.calls)

    def test_tool_calls_require_key_and_allow_only_local_navigation(self):
        self.lm.settings['navigate'] = True
        status, result = self.chat('model/one', 'Otwórz mapę')
        self.assertEqual(status, 502)
        self.assertNotIn('events', result)
        self.assertNotIn('tools', json.loads(self.lm.calls[-1]['data']))
        with patch.dict(os.environ, {'LM_STUDIO_API_KEY': 'configured-key'}):
            status, result = self.chat('model/one', 'Otwórz mapę')
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][-1], {'t': 'navigate', 'screen': 'mapa'})
        self.assertEqual([tool['function']['name'] for tool in json.loads(self.lm.calls[-1]['data'])['tools']], ['otworz_ekran'])

    def test_unsupported_tools_fall_back_only_to_real_text(self):
        self.lm.settings['reject_tools'] = True
        with patch.dict(os.environ, {'LM_STUDIO_API_KEY': 'configured-key'}):
            status, result = self.chat('model/one')
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z model/one')
        self.assertEqual(len(self.lm.calls), 2)
        self.assertIn('tools', json.loads(self.lm.calls[0]['data']))
        self.assertNotIn('tools', json.loads(self.lm.calls[1]['data']))

    def test_openai_proxy_requires_explicit_opt_in(self):
        status, result = self.request('/v1/models')
        self.assertEqual(status, 403)
        self.assertIn('LM_STUDIO_OPENAI_PROXY', result['error'])
        self.assertFalse(self.lm.calls)
        with patch.object(agent, 'PROVIDER', 'openai'), patch.dict(os.environ, {'LM_STUDIO_OPENAI_PROXY': '1'}):
            status, _ = self.request('/v1/models')
        self.assertEqual(status, 404)
        self.assertFalse(self.lm.calls)

    def test_openai_proxy_forwards_all_requested_endpoints_with_server_token(self):
        self.lm.settings['token'] = 'server-token'
        with patch.dict(os.environ, {'LM_STUDIO_API_KEY': 'server-token', 'LM_STUDIO_OPENAI_PROXY': '1'}):
            status, models = self.request('/v1/models', headers={'Authorization': 'Bearer untrusted-client'})
            self.assertEqual(status, 200)
            self.assertEqual(models['data'][0]['id'], 'model/one')
            for endpoint in ('/v1/responses', '/v1/chat/completions', '/v1/completions', '/v1/embeddings'):
                with self.subTest(endpoint=endpoint):
                    payload = {'model': 'model/one', 'input': 'tekst', 'messages': [{'role': 'user', 'content': 'tekst'}]}
                    status, result = self.request(endpoint, payload, {'Authorization': 'Bearer untrusted-client'})
                    self.assertEqual(status, 200)
                    self.assertEqual(self.lm.calls[-1]['path'], endpoint)
                    self.assertEqual(json.loads(self.lm.calls[-1]['data']), payload)
                    self.assertEqual(self.lm.calls[-1]['headers']['Authorization'], 'Bearer server-token')
                    self.assertNotIn('server-token', json.dumps(result))
            status, result = self.request('/v1/not-allowed', {})
            self.assertEqual(status, 404)

    def test_openai_proxy_preserves_upstream_errors_and_blocks_redirects(self):
        with patch.dict(os.environ, {'LM_STUDIO_OPENAI_PROXY': '1', 'LM_STUDIO_API_KEY': 'private'}):
            self.lm.settings['status'] = 422
            status, result = self.request('/v1/embeddings', {'input': 'tekst'})
            self.assertEqual(status, 422)
            self.assertEqual(result['error'], 'upstream error')
            self.lm.settings.pop('status')
            self.lm.settings['redirect'] = self.lm_url + '/v1/redirect-target'
            status, result = self.request('/api/lmstudio/models')
            self.assertEqual(status, 502)
            self.assertFalse(any(call['path'] == '/v1/redirect-target' for call in self.lm.calls))
            status, result = self.request('/v1/models')
            self.assertEqual(status, 502)
            self.assertFalse(any(call['path'] == '/v1/redirect-target' for call in self.lm.calls))

    def test_openai_proxy_streams_before_upstream_finishes(self):
        first_received = threading.Event()
        chunks = []
        with patch.dict(os.environ, {'LM_STUDIO_OPENAI_PROXY': '1'}):
            request = urllib.request.Request(self.app_url + '/v1/responses', data=b'{"stream":true}', headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=5) as response:
                def read_first():
                    chunks.append(response.read(len(b'data: first\n\n')))
                    first_received.set()
                thread = threading.Thread(target=read_first)
                thread.start()
                try:
                    self.assertTrue(first_received.wait(1.5))
                    self.assertEqual(chunks, [b'data: first\n\n'])
                finally:
                    self.lm.finish_stream.set()
                    thread.join(timeout=4)
                self.assertEqual(response.read(), b'data: [DONE]\n\n')

    def test_openai_proxy_rejects_oversized_request_without_forwarding(self):
        with patch.dict(os.environ, {'LM_STUDIO_OPENAI_PROXY': '1'}):
            connection = http.client.HTTPConnection('127.0.0.1', self.app.server_port, timeout=5)
            connection.request('POST', '/v1/embeddings', body=b'', headers={'Content-Length': str(16 * 1024 * 1024 + 1)})
            response = connection.getresponse()
            self.assertEqual(response.status, 413)
            response.read()
            connection.close()
        self.assertFalse(self.lm.calls)


if __name__ == '__main__':
    unittest.main()
