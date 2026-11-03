import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('hansearch_server', Path(__file__).resolve().parents[1] / 'local-ai/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class AccountSyncTests(unittest.TestCase):
    def test_account_snapshot_is_authenticated_and_paginated(self):
        with patch.object(server, 'SUPABASE_ACCOUNT_MODE', True), patch.object(server, 'PAGE_SIZE', 2), \
                patch.object(server, 'AI_ACCESS_TOKEN', 'test-only-token-at-least-32-characters'), \
                patch.object(server, 'request_json', side_effect=[[{'id': 1}, {'id': 2}], [{'id': 3}]]) as request:
            self.assertEqual(len(server.fetch_all_items()), 3)
            self.assertEqual(len(request.call_args_list), 2)
            for offset, call in zip([0, 2], request.call_args_list):
                self.assertTrue(call.args[0].endswith('/rest/v1/rpc/hansearch_ai_snapshot'))
                self.assertEqual(call.kwargs['method'], 'POST')
                self.assertEqual(call.kwargs['payload']['p_offset'], offset)
                self.assertEqual(call.kwargs['payload']['p_token'], server.AI_ACCESS_TOKEN)
                self.assertNotIn('Authorization', call.kwargs['headers'])

    def test_account_mode_without_key_fails_closed(self):
        with patch.object(server, 'SUPABASE_ACCOUNT_MODE', True), patch.object(server, 'AI_ACCESS_TOKEN', ''), \
                patch.object(server, 'request_json') as request:
            with self.assertRaises(RuntimeError):
                server.fetch_all_items()
            request.assert_not_called()

    def test_legacy_sync_remains_available_before_activation(self):
        with patch.object(server, 'SUPABASE_ACCOUNT_MODE', False), patch.object(server, 'request_json', return_value=[{'id': 1}]) as request:
            self.assertEqual(server.fetch_all_items(), [{'id': 1}])
            self.assertIn('/rest/v1/info?', request.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
