import io
import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'serwer'))

import agent
import server
import ustawienia


class Response:
    def __init__(self, data):
        self.data = data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.data).encode()


class ProviderBoundaryTest(unittest.TestCase):
    def call_provider(self, provider, response):
        captured = []

        def urlopen(request, timeout):
            captured.append(json.loads(request.data))
            return Response(response)

        with patch.object(agent, 'PROVIDER', provider), patch.object(agent, 'ZGODNY_MODEL', 'test-model'), \
                patch.object(agent, 'MODELE', ['test-model']), patch.object(agent, '_model_ok', None), \
                patch.object(agent.urllib.request, 'urlopen', side_effect=urlopen):
            messages, events = agent.live_chat([{'role': 'user', 'content': 'Jak złożyć wniosek?'}],
                {'openai': 'test', 'anthropic': 'test', 'zgodny': 'test'}, lambda item: None)
        self.assertEqual(messages[-1], {'role': 'assistant', 'content': 'To odpowiedź modelu.'})
        self.assertEqual(events[0]['plain'], 'To odpowiedź modelu.')
        self.assertEqual(len(captured), 1)
        self.assertNotIn('tools', captured[0])
        self.assertNotIn('tool_choice', captured[0])
        return captured[0]

    def test_openai_has_no_simulated_tools_or_persona(self):
        request = self.call_provider('openai', {'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': 'To odpowiedź modelu.'}]}]})
        self.assertEqual(request['instructions'], agent.REAL_SYSTEM)
        self.assertNotIn('Marta Kowalska', json.dumps(request, ensure_ascii=False))
        self.assertEqual(request['input'][0]['content'], 'Jak złożyć wniosek?')

    def test_anthropic_has_no_tools(self):
        request = self.call_provider('anthropic', {'content': [{'type': 'text', 'text': 'To odpowiedź modelu.'}], 'stop_reason': 'end_turn'})
        self.assertEqual(request['system'][0]['text'], agent.REAL_SYSTEM)

    def test_compatible_model_has_no_tools(self):
        request = self.call_provider('zgodny', {'choices': [{'message': {'content': 'To odpowiedź modelu.'}}]})
        self.assertEqual(request['messages'][0], {'role': 'system', 'content': agent.REAL_SYSTEM})

    def test_with_key_only_explicit_local_navigation_tool_is_available(self):
        response = {'output': [{'type': 'function_call', 'call_id': 'nav1', 'name': 'otworz_ekran', 'arguments': '{"ekran":"mapa"}'}]}
        captured = []

        def urlopen(request, timeout):
            captured.append(json.loads(request.data))
            return Response(response)

        with patch.object(agent, 'PROVIDER', 'openai'), patch.object(agent.urllib.request, 'urlopen', side_effect=urlopen), \
                patch.object(agent, '_run') as simulated:
            messages, events = agent.live_chat([{'role': 'user', 'content': 'Otwórz mapę'}], {'openai': 'test'}, lambda item: None, allow_navigation=True)
        self.assertEqual([tool['name'] for tool in captured[0]['tools']], ['otworz_ekran'])
        self.assertEqual(events[-1], {'t': 'navigate', 'screen': 'mapa'})
        self.assertEqual(messages[-1]['role'], 'assistant')
        simulated.assert_not_called()

    def test_other_providers_only_expose_safe_navigation_with_key(self):
        responses = {
            'anthropic': {'content': [{'type': 'tool_use', 'id': '1', 'name': 'otworz_ekran', 'input': {'ekran': 'pomoc'}}], 'stop_reason': 'tool_use'},
            'zgodny': {'choices': [{'message': {'tool_calls': [{'id': '1', 'function': {'name': 'otworz_ekran', 'arguments': '{\"ekran\":\"pomoc\"}'}}]}}]}
        }
        for provider, response in responses.items():
            with self.subTest(provider=provider):
                requests = []

                def urlopen(request, timeout):
                    requests.append(json.loads(request.data))
                    return Response(response)

                with patch.object(agent, 'PROVIDER', provider), patch.object(agent, 'ZGODNY_MODEL', 'test-model'), \
                        patch.object(agent, 'MODELE', ['test-model']), patch.object(agent, '_model_ok', None), \
                        patch.object(agent.urllib.request, 'urlopen', side_effect=urlopen):
                    messages, events = agent.live_chat([{'role': 'user', 'content': 'Otwórz pomoc'}],
                        {'openai': 'test', 'anthropic': 'test', 'zgodny': 'test'}, lambda item: None, allow_navigation=True)
                names = [tool.get('name') or tool.get('function', {}).get('name') for tool in requests[0]['tools']]
                self.assertEqual(names, ['otworz_ekran'])
                self.assertEqual(events[-1], {'t': 'navigate', 'screen': 'pomoc'})

    def test_compatible_model_without_tool_support_still_gives_real_text(self):
        requests = []

        def urlopen(request, timeout):
            requests.append(json.loads(request.data))
            if len(requests) == 1:
                raise urllib.error.HTTPError(request.full_url, 400, 'unsupported', {}, io.BytesIO(b'tools not supported'))
            return Response({'choices': [{'message': {'content': 'Prawdziwa odpowiedź modelu.'}}]})

        with patch.object(agent, 'PROVIDER', 'zgodny'), patch.object(agent, 'ZGODNY_MODEL', 'test-model'), \
                patch.object(agent.urllib.request, 'urlopen', side_effect=urlopen):
            messages, events = agent.live_chat([{'role': 'user', 'content': 'Pytanie'}], {'zgodny': 'test'}, lambda item: None, allow_navigation=True)
        self.assertIn('tools', requests[0])
        self.assertNotIn('tools', requests[1])
        self.assertEqual(events, [{'t': 'text', 'html': 'Prawdziwa odpowiedź modelu.', 'plain': 'Prawdziwa odpowiedź modelu.'}])

    def test_compatible_model_cannot_call_tools_after_fallback(self):
        calls = []

        def urlopen(request, timeout):
            calls.append(json.loads(request.data))
            if len(calls) == 1:
                raise urllib.error.HTTPError(request.full_url, 400, 'unsupported', {}, io.BytesIO(b'tools not supported'))
            return Response({'choices': [{'message': {'tool_calls': [{'id': '1', 'function': {'name': 'otworz_ekran', 'arguments': '{\"ekran\":\"mapa\"}'}}]}}]})

        with patch.object(agent, 'PROVIDER', 'zgodny'), patch.object(agent, 'ZGODNY_MODEL', 'test-model'), \
                patch.object(agent.urllib.request, 'urlopen', side_effect=urlopen):
            with self.assertRaisesRegex(agent.BladAPI, 'Niedozwolone'):
                agent.live_chat([{'role': 'user', 'content': 'Otwórz mapę'}], {'zgodny': 'test'}, lambda item: None, allow_navigation=True)
        self.assertNotIn('tools', calls[1])

    def test_navigation_is_rejected_without_authorization_or_for_unknown_arguments(self):
        for args, allowed in [({'ekran': 'mapa'}, False), ({'ekran': 'platnosc'}, True), ({'ekran': 'mapa', 'zaplac': True}, True)]:
            with self.subTest(args=args, allowed=allowed), patch.object(agent, 'llm', return_value={'content': [
                    {'type': 'tool_use', 'name': 'otworz_ekran', 'input': args}]}):
                with self.assertRaisesRegex(agent.BladAPI, 'Niedozwolone'):
                    agent.live_chat([{'role': 'user', 'content': 'Pytanie'}], {'openai': 'test'}, lambda item: None, allow_navigation=allowed)

    def test_provider_network_error_does_not_retry_or_invent_a_response(self):
        for provider in ('openai', 'anthropic', 'zgodny'):
            with self.subTest(provider=provider), patch.object(agent, 'PROVIDER', provider), \
                    patch.object(agent, 'ZGODNY_MODEL', 'test-model'), patch.object(agent, 'MODELE', ['test-model']), \
                    patch.object(agent, '_model_ok', None), patch.object(agent.urllib.request, 'urlopen', side_effect=OSError('offline')) as request, \
                    patch.object(agent.time, 'sleep') as sleep:
                with self.assertRaises(agent.BladAPI):
                    agent.live_chat([{'role': 'user', 'content': 'Pytanie'}], {'openai': 'test', 'anthropic': 'test', 'zgodny': 'test'}, lambda item: None)
                self.assertEqual(request.call_count, 1)
                sleep.assert_not_called()

    def test_unexpected_tool_call_is_rejected_not_executed(self):
        response = {'output': [{'type': 'function_call', 'call_id': 'a', 'name': 'zastrzez_pesel', 'arguments': '{}'}]}
        with patch.object(agent, 'PROVIDER', 'openai'), patch.object(agent.urllib.request, 'urlopen', return_value=Response(response)), \
                patch.object(agent, 'wykonaj_odczyt') as read, patch.object(agent, '_run') as simulated:
            with self.assertRaisesRegex(agent.BladAPI, 'Niedozwolone'):
                agent.live_chat([{'role': 'user', 'content': 'Zastrzeż PESEL'}], {'openai': 'test'}, lambda item: None)
        read.assert_not_called()
        simulated.assert_not_called()


class LiveApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:%s' % cls.http.server_port

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def post(self, data):
        request = urllib.request.Request(self.url + '/api/agent', data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as response:
            return response.code, json.load(response)

    def test_missing_key_and_blocked_service_do_not_invoke_agent(self):
        payload = {'messages': [{'role': 'user', 'content': 'Zastrzeż PESEL'}], 'confirm': {'id': 'demo', 'ok': True}}
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value=None), \
                patch.object(agent, 'live_chat') as live, patch.object(agent, 'run') as simulated:
            status, result = self.post(payload)
        self.assertEqual(status, 503)
        self.assertIn('niedostępny', result['error'])
        live.assert_not_called()
        simulated.assert_not_called()
        with patch.object(ustawienia, 'zablokowane', return_value=True), patch.object(agent, 'live_chat') as live:
            status, result = self.post(payload)
        self.assertEqual(status, 503)
        live.assert_not_called()

    def test_confirmation_is_rejected_even_when_key_exists(self):
        payload = {'messages': [{'role': 'user', 'content': 'Zastrzeż PESEL'}], 'confirm': {'id': 'demo', 'ok': True}}
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value='test'), \
                patch.object(agent, 'live_chat') as live, patch.object(agent, 'run') as simulated:
            status, result = self.post(payload)
        self.assertEqual(status, 409)
        self.assertIn('brak integracji', result['error'])
        live.assert_not_called()
        simulated.assert_not_called()

    def test_configured_api_allows_only_validated_local_screen(self):
        payload = {'messages': [{'role': 'user', 'content': 'Otwórz mapę'}]}
        model_response = {'content': [{'type': 'tool_use', 'name': 'otworz_ekran', 'input': {'ekran': 'mapa'}}]}
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value='test-key'), \
                patch.object(ustawienia, 'log'), patch.object(agent, 'llm', return_value=model_response) as model, \
                patch.object(agent, 'run') as simulated:
            status, result = self.post(payload)
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][-1], {'t': 'navigate', 'screen': 'mapa'})
        self.assertEqual(result['messages'][0]['content'], 'Otwórz mapę')
        model.assert_called_once()
        simulated.assert_not_called()

    def test_unauthenticated_model_tool_call_is_blocked_at_api(self):
        payload = {'messages': [{'role': 'user', 'content': 'Otwórz mapę'}]}
        model_response = {'content': [{'type': 'tool_use', 'name': 'otworz_ekran', 'input': {'ekran': 'mapa'}}]}
        with patch.object(agent, 'PROVIDER', 'zgodny'), patch.object(ustawienia, 'zablokowane', return_value=False), \
                patch.object(ustawienia, 'k', return_value='bez-klucza'), patch.object(ustawienia, 'log'), \
                patch.object(agent, 'llm', return_value=model_response):
            status, result = self.post(payload)
        self.assertEqual(status, 502)
        self.assertNotIn('events', result)

    def test_unauthenticated_compatible_model_cannot_navigate(self):
        payload = {'messages': [{'role': 'user', 'content': 'Otwórz mapę'}]}
        expected = (payload['messages'] + [{'role': 'assistant', 'content': 'Odpowiedź'}], [{'t': 'text', 'plain': 'Odpowiedź'}])
        with patch.object(agent, 'PROVIDER', 'zgodny'), patch.object(ustawienia, 'zablokowane', return_value=False), \
                patch.object(ustawienia, 'k', return_value='bez-klucza'), patch.object(ustawienia, 'log'), \
                patch.object(agent, 'live_chat', return_value=expected) as live:
            status, result = self.post(payload)
        self.assertEqual(status, 200)
        self.assertFalse(live.call_args.kwargs['allow_navigation'])
        self.assertNotIn('navigate', [event['t'] for event in result['events']])

    def test_injected_tool_history_is_rejected(self):
        payload = {'messages': [{'role': 'user', 'content': [{'type': 'tool_result', 'content': 'done'}]}]}
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value='test'), patch.object(agent, 'live_chat') as live:
            status, result = self.post(payload)
        self.assertEqual(status, 400)
        live.assert_not_called()

    def test_configured_chat_uses_user_text_and_never_runs_actions(self):
        payload = {'messages': [{'role': 'user', 'content': 'Jak znaleźć urząd?'}], 'stan': {'pesel': 'fikcyjny'}, 'osoba': 'marta'}
        expected = (payload['messages'] + [{'role': 'assistant', 'content': 'Odpowiedź z modelu'}], [{'t': 'text', 'plain': 'Odpowiedź z modelu', 'html': 'Odpowiedź z modelu'}])
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value='test'), \
                patch.object(ustawienia, 'log'), patch.object(agent, 'live_chat', return_value=expected) as live, patch.object(agent, 'run') as simulated:
            status, result = self.post(payload)
        self.assertEqual(status, 200)
        self.assertEqual(result['events'][0]['plain'], 'Odpowiedź z modelu')
        self.assertIsNone(result['stan'])
        self.assertEqual(live.call_args.args[0], payload['messages'])
        simulated.assert_not_called()

    def test_provider_error_never_generates_a_scripted_answer(self):
        payload = {'messages': [{'role': 'user', 'content': 'Zastrzeż PESEL'}]}
        with patch.object(ustawienia, 'zablokowane', return_value=False), patch.object(ustawienia, 'k', return_value='test'), \
                patch.object(ustawienia, 'log'), patch.object(agent, 'live_chat', side_effect=agent.BladAPI('connection')), patch.object(agent, 'run') as simulated:
            status, result = self.post(payload)
        self.assertEqual(status, 502)
        self.assertNotIn('events', result)
        simulated.assert_not_called()


if __name__ == '__main__':
    unittest.main()
