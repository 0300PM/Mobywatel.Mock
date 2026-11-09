import base64
import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'serwer'))

import akcje
import narzedzia
import dane
import server


class LetterModuleTest(unittest.TestCase):
    def test_text_and_pdf_input_limits_and_types(self):
        with self.assertRaisesRegex(ValueError, 'UTF-8'):
            server.letter_text({'filename': 'pismo.txt', 'data': '////'})
        with self.assertRaisesRegex(ValueError, 'Skan'):
            server.letter_text({'filename': 'pismo.png', 'data': 'YWJj'})
        with self.assertRaises(OverflowError):
            server.letter_text({'text': 'x' * (server.MAX_LETTER_TEXT + 1)})
        with self.assertRaisesRegex(ValueError, 'OCR'):
            server.letter_text({'filename': 'pismo.pdf', 'data': 'JVBERi0xLjQ='})

    def test_pdf_text_extraction_and_source_validation(self):
        pdf = b'%PDF-1.4\n1 0 obj << >> stream\nBT (Termin odpowiedzi: 26.10.2026) Tj ET\nendstream\n%%EOF'
        self.assertEqual(server.extract_pdf_text(pdf), 'Termin odpowiedzi: 26.10.2026')
        result = server.validate_letter_result({
            'meaning': {'text': 'Urząd prosi o odpowiedź.', 'source': 'Urząd prosi o odpowiedź.'},
            'actions': [{'text': 'Odpowiedz.', 'source': 'Urząd prosi o odpowiedź.', 'kind': 'fact'},
                        {'text': 'Wpłać 500 zł.', 'source': 'Niewystępujący cytat', 'kind': 'fact'}],
            'deadline': {'text': 'Masz 30 dni.', 'source': 'Termin odpowiedzi: 26.10.2026'},
            'documents': []
        }, 'Urząd prosi o odpowiedź. Termin odpowiedzi: 26.10.2026')
        self.assertEqual(len(result['actions']), 1)
        self.assertIsNone(result['deadline'])
        self.assertEqual(result['meaning']['source'], 'Urząd prosi o odpowiedź.')

    def test_extract_and_explain_endpoints_do_not_log_document_text(self):
        http = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        source = 'Prosimy o odpowiedź do 26.10.2026.'
        model_result = {'meaning': {'text': 'Należy odpowiedzieć.', 'source': source}, 'actions': [],
                        'deadline': {'text': 'Odpowiedz do 26.10.2026.', 'source': source}, 'documents': []}
        try:
            base = 'http://127.0.0.1:%s' % http.server_port
            upload = {'filename': 'pismo.txt', 'data': base64.b64encode(source.encode()).decode()}
            request = urllib.request.Request(base + '/api/letter/extract', data=json.dumps(upload).encode(), headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)['text'], source)
            with patch.object(server, 'zablokowane', return_value=False), patch.object(server, 'k', return_value='test-key'), \
                    patch.object(server.agent, 'PROVIDER', 'openai'), patch.object(server.agent, 'live_chat', return_value=([], [{'t': 'text', 'plain': json.dumps(model_result, ensure_ascii=False)}])) as model:
                request = urllib.request.Request(base + '/api/letter/explain', data=json.dumps({'text': source}).encode(), headers={'Content-Type': 'application/json'})
                with urllib.request.urlopen(request) as response:
                    result = json.load(response)['result']
                self.assertEqual(result['deadline']['source'], source)
                sent = model.call_args.args[0][0]['content']
                self.assertIn(source, sent)
                self.assertEqual(model.call_args.kwargs['system_override'], server.LETTER_SYSTEM)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()

    def test_deadline_must_be_explicit_and_cited(self):
        result = server.validate_letter_result({
            'meaning': {'text': 'To informacja.', 'source': 'Otrzymałaś informację.'},
            'actions': [], 'deadline': {'text': 'Odpowiedz do 30 dni.', 'source': 'Prosimy o odpowiedź.'}, 'documents': []
        }, 'Otrzymałaś informację. Prosimy o odpowiedź.')
        self.assertIsNone(result['deadline'])


class ContactSafetyTest(unittest.TestCase):
    def setUp(self):
        self.action = akcje.A['aktualizuj_dane_kontaktowe']

    def test_schema_does_not_request_authentication_codes(self):
        tool = next(item for item in narzedzia.AKCJE if item['name'] == 'aktualizuj_dane_kontaktowe')
        self.assertNotIn('kod', tool['input_schema']['properties'])
        self.assertIn('Nigdy nie proś o kod', tool['description'])

    def test_code_is_rejected_by_preview_and_execution(self):
        for operation in ('podglad', 'wykonaj'):
            with self.subTest(operation=operation):
                with self.assertRaisesRegex(ValueError, 'Nie podawaj asystentowi kodów'):
                    self.action[operation]({'telefon': '000000000', 'kod': '123456'}, {})

    def test_reminder_is_only_an_example(self):
        result, card = dane.r_ustaw_przypomnienie({'kiedy': '01.01.2030', 'tresc': 'Przykład'}, {})
        self.assertFalse(result['ustawiono'])
        self.assertFalse(result['powiadomienia'])
        self.assertEqual(card['title'], 'Przykładowe przypomnienie')
        tool = next(item for item in narzedzia.ODCZYTY if item['name'] == 'ustaw_przypomnienie')
        self.assertIn('nie wysyła powiadomień', tool['description'])

    def test_contact_change_is_only_a_simulation(self):
        preview = self.action['podglad']({'telefon': '000000000'}, {})
        result, card = self.action['wykonaj']({'telefon': '000000000'}, {})
        self.assertIn('nie wysyła kodów', preview['note'])
        self.assertFalse(result['zapisano'])
        self.assertFalse(result['kod_wyslany'])
        self.assertIn('Nie wysłano kodu', card['note'])


class BlockedSpeechTest(unittest.TestCase):
    def test_blocked_service_never_fabricates_transcription(self):
        http = ThreadingHTTPServer(('127.0.0.1', 0), server.H)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        try:
            base = 'http://127.0.0.1:%s' % http.server_port
            with patch.object(server, 'zablokowane', return_value=True):
                with urllib.request.urlopen(base + '/api/health') as response:
                    health = json.load(response)
                self.assertFalse(health['agent'])
                self.assertFalse(health['stt'])
                request = urllib.request.Request(base + '/api/stt', data=b'audio', method='POST')
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(request)
                self.assertEqual(error.exception.code, 503)
                self.assertNotIn('text', json.load(error.exception))
        finally:
            http.shutdown()
            http.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
