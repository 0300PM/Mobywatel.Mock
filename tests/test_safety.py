import json
import sys
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'serwer'))

import safety
import server


class SafetyModuleValidationTest(unittest.TestCase):
    def payload(self, **overrides):
        value = {'task': 'situation', 'threat': 'powodz', 'description': 'Woda zbliża się do domu.',
                 'immediateDanger': False, 'location': '', 'shareLocation': False,
                 'profile': {'household': 3, 'children': True}, 'checked': [], 'missing': [], 'lang': 'pl'}
        value.update(overrides)
        return value

    def test_guides_cover_core_scenarios_in_both_languages_with_sources(self):
        self.assertGreaterEqual(len(safety.SCENARIOS), 9)
        for scenario in safety.SCENARIOS.values():
            self.assertTrue(scenario['steps'])
            self.assertTrue(scenario['checklist'])
            self.assertTrue(scenario['avoid'])
            self.assertTrue(scenario['mistakes'])
            self.assertTrue(scenario['sources'])
            for text in [scenario['title'], scenario['summary'], *scenario['steps'], *scenario['checklist']]:
                if isinstance(text, dict):
                    self.assertTrue(text.get('pl'))
                    self.assertTrue(text.get('en'))
        self.assertTrue(all({'pl', 'en'} <= set(item['text']) for item in safety.BACKPACK.values()))

    def test_immediate_danger_is_rejected_before_model_dispatch(self):
        with self.assertRaises(safety.EmergencyCallRequired):
            safety.validate_payload(self.payload(immediateDanger=True))

    def test_location_is_removed_unless_user_explicitly_shares_it(self):
        clean = safety.validate_payload(self.payload(location='Biłgoraj', shareLocation=False))
        self.assertEqual(clean['location'], '')
        encoded = json.loads(safety._user_payload(clean))
        self.assertNotIn('approximate_location_shared_by_user', encoded)
        shared = safety.validate_payload(self.payload(location='Biłgoraj', shareLocation=True))
        self.assertEqual(json.loads(safety._user_payload(shared))['approximate_location_shared_by_user'], 'Biłgoraj')
        with self.assertRaisesRegex(ValueError, 'lokalizację'):
            safety.validate_payload(self.payload(location=' ', shareLocation=True))

    def test_only_allowlisted_profile_and_checklist_fields_are_accepted(self):
        clean = safety.validate_payload(self.payload(profile={'household': 2, 'children': True, 'diagnosis': 'asthma'}))
        self.assertNotIn('diagnosis', clean['profile'])
        with self.assertRaisesRegex(ValueError, 'osób'):
            safety.validate_payload(self.payload(profile={'household': True}))
        with self.assertRaisesRegex(ValueError, 'Checklista'):
            safety.validate_payload(self.payload(missing=['unknown-medical-item']))
        with self.assertRaisesRegex(ValueError, '1500'):
            safety.validate_payload(self.payload(description='x' * 1501))

    def test_ai_response_is_strictly_bounded_and_typed(self):
        result = safety._parse_result('```json\n{"actions":["Zadzwoń pod 112"],"checklist":["Zabierz telefon"],"avoid":["Nie zwlekaj"],"call_emergency":true}\n```')
        self.assertEqual(result['actions'], ['Zadzwoń pod 112'])
        self.assertTrue(result['call_emergency'])
        with self.assertRaises(ValueError):
            safety._parse_result('{"actions":"one","checklist":[],"avoid":[],"call_emergency":false}')
        with self.assertRaises(ValueError):
            safety._parse_result('{"actions":[],"checklist":[],"avoid":[],"call_emergency":"yes"}')

    def test_model_is_called_without_tools_or_raw_location_when_not_shared(self):
        data = safety.validate_payload(self.payload(location='Tajemnicza miejscowość', shareLocation=False))
        expected = {'actions': ['Sprawdź oficjalne komunikaty.'], 'checklist': [], 'avoid': [], 'call_emergency': False}
        with patch.object(safety.agent, 'live_chat', return_value=([], None, [{'t': 'text', 'plain': json.dumps(expected)}], None)) as live:
            result = safety.ask_model(data, {}, lambda _: None)
        request = json.loads(live.call_args.args[0][0]['content'])
        self.assertNotIn('Tajemnicza miejscowość', live.call_args.kwargs['system_override'])
        self.assertNotIn('approximate_location_shared_by_user', request)
        self.assertFalse(live.call_args.kwargs['allow_navigation'])
        self.assertEqual(result, expected)


class SafetyApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:%s/api/safety/assist' % cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)

    def post(self, payload):
        request = urllib.request.Request(self.url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.loads(response.read())

    def payload(self, **overrides):
        value = {'task': 'situation', 'threat': 'powodz', 'description': 'Woda zbliża się do domu.',
                 'immediateDanger': False, 'location': '', 'shareLocation': False,
                 'profile': {}, 'checked': [], 'missing': [], 'lang': 'pl'}
        value.update(overrides)
        return value

    def test_endpoint_calls_configured_model_and_returns_validated_answer(self):
        answer = {'actions': ['Sprawdź oficjalne komunikaty.'], 'checklist': ['Zapisz numer służb.'], 'avoid': ['Nie wchodź do wody.'], 'call_emergency': False}
        completion = ([], None, [{'t': 'text', 'plain': json.dumps(answer)}], None)
        with patch.object(server, 'zablokowane', return_value=False), patch.object(server, 'k', return_value='test-key'), patch.object(server.agent, 'live_chat', return_value=completion) as live:
            status, data = self.post(self.payload())
        self.assertEqual(status, 200)
        self.assertEqual(data['result'], answer)
        self.assertFalse(live.call_args.kwargs['allow_navigation'])
        self.assertIsNone(live.call_args.kwargs['model'])

    def test_only_the_configured_provider_key_is_loaded(self):
        answer = {'actions': ['Sprawdź komunikaty.'], 'checklist': [], 'avoid': [], 'call_emergency': False}
        completion = ([], None, [{'t': 'text', 'plain': json.dumps(answer)}], None)
        with (
            patch.object(server.agent, 'PROVIDER', 'anthropic'),
            patch.object(server, 'zablokowane', return_value=False),
            patch.object(server, 'k', side_effect=lambda name: 'test-key' if name == 'anthropic' else self.fail('Unexpected key lookup: ' + name)) as key,
            patch.object(server.agent, 'live_chat', return_value=completion),
        ):
            status, data = self.post(self.payload())
        self.assertEqual(status, 200)
        self.assertEqual(data['result'], answer)
        key.assert_called_once_with('anthropic')

    def test_emergency_request_is_rejected_without_calling_model(self):
        with patch.object(server, 'k') as key, patch.object(server.agent, 'live_chat') as live:
            try:
                self.post(self.payload(immediateDanger=True))
            except Exception as error:
                self.assertEqual(error.code, 409)
                data = json.loads(error.read())
            else:
                self.fail('Direct emergency should be rejected')
        self.assertTrue(data['call_emergency'])
        key.assert_not_called()
        live.assert_not_called()

    def test_provider_failure_returns_no_fabricated_answer(self):
        with patch.object(server, 'zablokowane', return_value=False), patch.object(server, 'k', return_value=None):
            try:
                self.post(self.payload())
            except Exception as error:
                self.assertEqual(error.code, 503)
                data = json.loads(error.read())
            else:
                self.fail('Missing provider key should return 503')
        self.assertNotIn('result', data)


if __name__ == '__main__':
    unittest.main()
