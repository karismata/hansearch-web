import importlib.util
import contextlib
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
import socket
import ssl
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('fallback_server', Path(__file__).resolve().parents[1] / 'local-ai/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

ITEM = {'id': 10, '키워드2': '프린터 오류', '내용': '내부 전용 정보', 'embedding': [1, 0]}


class FallbackTests(unittest.TestCase):
    def setUp(self):
        server._web_cache.clear()
    def search(self, coverage):
        analysis = {'coverage': coverage, 'summary': '내부 답변 [자료 ID: 10]', 'source_ids': [10] if coverage != 'none' else []}
        with patch.object(server, 'read_state', return_value={'10': ITEM}), \
                patch.object(server, 'embed_texts', return_value=[[1, 0]]), \
                patch.object(server, 'analyze_internal', return_value=analysis), \
                patch.object(server, 'web_search_answer', return_value={'status': 'empty', 'summary': '', 'sources': []}) as web:
            result = server.search('증상')
            return result, web.call_count

    def test_sufficient_and_partial_do_not_search_web(self):
        for coverage in ['sufficient', 'partial', 'unknown']:
            result, calls = self.search(coverage)
            self.assertEqual(calls, 0)
            self.assertEqual(result['coverage'], coverage)
            self.assertEqual(result['results'][0]['id'], 10)

    def test_irrelevant_candidates_are_removed_and_web_runs(self):
        result, calls = self.search('none')
        self.assertEqual(calls, 1)
        self.assertEqual(result['results'], [])
        self.assertIn('web', result)

    def test_no_synced_items_also_uses_web(self):
        events = []
        with patch.object(server, 'read_state', return_value={}), patch.object(server, 'TAVILY_API_KEY', ''):
            result = server.search('포스 전원', progress=lambda *args: events.append(args))
        self.assertEqual(result['web']['status'], 'not_configured')
        self.assertEqual(result['coverage'], 'none')
        self.assertEqual(events[-1][0], 'analyzing')

    def test_manual_request_suppresses_duplicate_automatic_web_call(self):
        with patch.object(server, 'read_state', return_value={}), patch.object(server, 'web_search_answer') as web:
            result = server.search('질문', progress=lambda *args: {'external_web_requested': True})
        web.assert_not_called()
        self.assertNotIn('web', result)

    def test_manual_web_does_not_wait_for_internal_search_or_embedding(self):
        with patch.object(server, 'read_state') as state, patch.object(server, 'embed_texts') as embed, \
                patch.object(server, 'TAVILY_API_KEY', ''):
            result = server.search('포스 전원', mode='web')
            self.assertEqual(result['web']['status'], 'not_configured')
            state.assert_not_called()
            embed.assert_not_called()

    def test_invalid_model_output_is_not_treated_as_missing_data(self):
        for response in ['garbage', '{}', json.dumps({'coverage': 'sufficient', 'summary': '[자료 ID: 999]', 'source_ids': [10]}),
                         json.dumps({'coverage': 'sufficient', 'summary': '답변', 'source_ids': [999]})]:
            with patch.object(server, 'ollama_answer', return_value=response):
                self.assertEqual(server.analyze_internal('증상', [ITEM])['coverage'], 'unknown')

    def test_valid_coverage_and_citations(self):
        response = {'coverage': 'partial', 'summary': '일부 확인 [자료 ID: 10]', 'source_ids': [10]}
        with patch.object(server, 'ollama_answer', return_value=json.dumps(response)):
            self.assertEqual(server.analyze_internal('증상', [ITEM]), response)

    def test_web_only_gets_question_and_search_key_and_bounded_sources(self):
        calls = []
        def request(url, **kwargs):
            calls.append((url, kwargs))
            return {'results': [
                {'title': '잘못된 링크', 'url': 'javascript:alert(1)', 'content': 'bad'},
                {'title': '매뉴얼', 'url': 'https://www.kicc.co.kr/manual', 'content': '일반 점검 ' * 1500},
                {'title': '다른 자료', 'url': 'https://example.com/doc', 'content': '추가 내용'},
            ]}
        answer = json.dumps({'summary': '확인 방법 [웹 자료 1]', 'source_numbers': [1]})
        with patch.object(server, 'TAVILY_API_KEY', 'synthetic-search-key'), \
                patch.object(server, 'request_json', side_effect=request), \
                patch.object(server, 'ollama_answer', return_value=answer) as model:
            result = server.search('증상 문의', mode='web')
        self.assertEqual(result['web']['status'], 'complete')
        self.assertEqual(len(result['web']['sources']), 1)
        self.assertEqual(result['web']['sources'][0]['url'], 'https://www.kicc.co.kr/manual')
        self.assertEqual(calls[0][0], 'https://api.tavily.com/search')
        self.assertEqual(calls[0][1]['headers'], {'Authorization': 'Bearer synthetic-search-key'})
        self.assertNotIn('내부 전용 정보', json.dumps(calls, ensure_ascii=False))
        self.assertLess(len(model.call_args.args[1]), 6000)

    def test_web_failures_do_not_expose_keys_or_error_bodies(self):
        with patch.object(server, 'TAVILY_API_KEY', 'secret-value'), \
                patch.object(server, 'request_json', side_effect=RuntimeError('HTTP 401 secret-value')):
            result = server.web_search_answer('질문')
        self.assertEqual(result['status'], 'error')
        self.assertNotIn('secret-value', json.dumps(result))

    def test_structured_http_errors_are_distinguished_without_secret_output(self):
        for status in (401, 403, 429, 500):
            error = HTTPError('https://api.tavily.com/search', status, 'private-error-value', {'Retry-After': '30'}, io.BytesIO(b'private-error-value'))
            with patch.object(server, 'urlopen', side_effect=error), patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), contextlib.redirect_stdout(io.StringIO()) as output:
                result = server.web_search_answer('질문')
            self.assertEqual(result['http_status'], status)
            self.assertEqual(result['error_code'], f'http_{status}')
            self.assertIn(str(status), result['message'])
            self.assertNotIn('private-error-value', json.dumps(result) + output.getvalue())
            self.assertNotIn('synthetic-key', output.getvalue())
            if status == 429:
                self.assertIn('30초', result['message'])

    def test_cloudflare_access_block_is_not_reported_as_rate_limit(self):
        error = HTTPError('https://api.tavily.com/search', 403, '', {}, io.BytesIO(b'{"error_name":"browser_signature_banned"}'))
        with patch.object(server, 'urlopen', side_effect=error), patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'):
            result = server.web_search_answer('질문')
        self.assertEqual(result['error_code'], 'access_blocked')

    def test_network_error_categories(self):
        for reason, category in [(socket.gaierror('private-dns-details'), 'dns'),
                                 (ssl.SSLCertVerificationError('private-cert-details'), 'tls'),
                                 (TimeoutError('private-timeout'), 'timeout')]:
            with patch.object(server, 'urlopen', side_effect=URLError(reason)), patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'):
                result = server.web_search_answer('질문')
            self.assertEqual(result['error_code'], category)
            self.assertNotIn('private-', json.dumps(result))

    def test_malformed_search_response_is_not_treated_as_no_evidence(self):
        with patch.object(server, 'request_json', return_value={'error': 'private details'}), patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), patch.object(server, 'ollama_answer') as model:
            result = server.web_search_answer('질문')
        self.assertEqual(result['error_code'], 'invalid_response')
        model.assert_not_called()

    def test_tavily_uses_one_basic_request_even_if_only_one_source(self):
        first = {'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '점검 안내'}]}
        with patch.object(server, 'request_json', return_value=first) as request, patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), \
                patch.object(server, 'ollama_answer', return_value=json.dumps({'summary': '확인 [웹 자료 1]', 'source_numbers': [1]})):
            result = server.web_search_answer('질문')
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(len(result['sources']), 1)
        request.assert_called_once()
        payload = request.call_args.kwargs['payload']
        self.assertEqual(payload['search_depth'], 'basic')
        self.assertFalse(payload['auto_parameters'])
        self.assertFalse(payload['include_answer'])
        self.assertFalse(payload['include_raw_content'])

    def test_repeated_question_reuses_bounded_cache(self):
        first = {'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '점검 안내'}]}
        with patch.object(server, 'request_json', return_value=first) as request, patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'):
            initial, initial_hit = server.fetch_web_candidates('POS 전원')
            repeated, hit = server.fetch_web_candidates('pos   전원')
            self.assertFalse(initial_hit)
            self.assertTrue(hit)
            self.assertEqual(initial, repeated)
            request.assert_called_once()
            with patch.object(server.time, 'monotonic', return_value=server.time.monotonic()+server.WEB_CACHE_TTL_SECONDS+1):
                server.fetch_web_candidates('POS 전원')
            self.assertEqual(request.call_count, 2)

    def test_cache_is_bounded_and_key_rotation_does_not_reuse_old_account_data(self):
        first = {'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '점검 안내'}]}
        with patch.object(server, 'request_json', return_value=first) as request, patch.object(server, 'TAVILY_API_KEY', 'old-key'), patch.object(server, 'WEB_CACHE_MAX_ENTRIES', 2):
            for question in ['q1', 'q2', 'q3']:
                server.fetch_web_candidates(question)
            self.assertEqual(len(server._web_cache), 2)
            with patch.object(server, 'TAVILY_API_KEY', 'new-key'):
                _, cached = server.fetch_web_candidates('q3')
            self.assertFalse(cached)
            self.assertEqual(request.call_count, 4)

    def test_concurrent_identical_questions_make_one_request(self):
        first = {'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '점검 안내'}]}
        with patch.object(server, 'request_json', return_value=first) as request, patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(server.fetch_web_candidates, '동일 질문') for _ in range(2)]
            hits = [future.result()[1] for future in futures]
        self.assertEqual(sorted(hits), [False, True])
        request.assert_called_once()

    def test_cached_answer_is_labeled_and_preserves_sources(self):
        first = {'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '점검 안내'}]}
        answer = json.dumps({'summary': '확인 [웹 자료 1]', 'source_numbers': [1]})
        with patch.object(server, 'request_json', return_value=first) as request, patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), patch.object(server, 'ollama_answer', return_value=answer):
            server.web_search_answer('질문')
            result = server.web_search_answer('질문')
        request.assert_called_once()
        self.assertTrue(result['cached'])
        self.assertIn('재사용', result['message'])
        self.assertEqual(result['sources'][0]['url'], 'https://example.com/manual')

    def test_tavily_quota_does_not_retry_or_fallback_to_paid_search(self):
        for status in (432, 433):
            with patch.object(server, 'request_json', side_effect=server.RequestFailure('http', status)) as request, patch.object(server, 'TAVILY_API_KEY', 'synthetic-key'), patch.object(server, 'ollama_answer') as model:
                result = server.web_search_answer('질문')
            request.assert_called_once()
            model.assert_not_called()
            self.assertEqual(result['http_status'], status)
            self.assertIn('무료', result['message'])

    def test_diagnostic_makes_one_request_without_starting_server_or_showing_secrets(self):
        with patch.object(server.sys, 'argv', ['server.py', '--check-web-search']), patch.object(server, 'load_dotenv'), \
                patch.dict(os.environ, {'TAVILY_API_KEY': 'synthetic-secret'}), patch.object(server, 'TAVILY_API_KEY', 'synthetic-secret'), \
                patch.object(server, 'ThreadingHTTPServer') as http_server, patch.object(server, 'request_json', return_value={'results': []}) as request, \
                contextlib.redirect_stdout(io.StringIO()) as output:
            server.main()
        request.assert_called_once()
        self.assertEqual(request.call_args.kwargs['payload']['max_results'], 1)
        self.assertEqual(request.call_args.args[0], 'https://api.tavily.com/search')
        http_server.assert_not_called()
        self.assertIn('HTTP 200', output.getvalue())
        self.assertNotIn('synthetic-secret', output.getvalue())

    def test_no_web_evidence_produces_clearly_unverified_general_guidance(self):
        with patch.object(server, 'TAVILY_API_KEY', 'synthetic'), patch.object(server, 'request_json', return_value={'results': []}), \
                patch.object(server, 'ollama_answer', return_value='AI 추정·현장 확인 필요\n전원 공급 여부를 구분하세요.'):
            result = server.web_search_answer('질문')
        self.assertEqual(result['status'], 'empty')
        self.assertEqual(result['sources'], [])
        self.assertTrue(result['summary'].startswith('AI 추정'))

    def test_web_fabricated_citations_are_rejected_but_source_links_survive(self):
        with patch.object(server, 'TAVILY_API_KEY', 'synthetic'), patch.object(server, 'request_json', return_value={
            'results': [{'title': '매뉴얼', 'url': 'https://example.com/manual', 'content': '확인 내용'}]}), \
                patch.object(server, 'ollama_answer', return_value=json.dumps({'summary': '답 [웹 자료 9]', 'source_numbers': [9]})):
            result = server.web_search_answer('질문')
        self.assertEqual(result['status'], 'error')
        self.assertEqual(len(result['sources']), 1)

    def test_question_validation(self):
        for question in ['', 'a' * 1001]:
            with self.assertRaises(ValueError):
                server.search(question)


if __name__ == '__main__':
    unittest.main()
