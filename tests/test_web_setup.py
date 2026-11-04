import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'local-ai/enable-web-search.command'
PYTHON_BLOCK = SCRIPT.read_text(encoding='utf-8').split("<<'PY'\n", 1)[1].split('\nPY\n', 1)[0]


class WebSetupTests(unittest.TestCase):
    def test_preserves_existing_private_settings_and_replaces_only_search_key(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / '.env'
            original = '# existing\nAI_ACCESS_TOKEN=old-relay-token\nSUPABASE_ACCOUNT_MODE=1\nOLLAMA_API_KEY=old-key\nTAVILY_API_KEY=old-search-key\n'
            env_file.write_text(original, encoding='utf-8')
            result = subprocess.run([sys.executable, '-c', PYTHON_BLOCK], cwd=directory,
                                    env={**os.environ, 'HANSEARCH_SEARCH_KEY': 'synthetic-new-search-key'}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            saved = env_file.read_text(encoding='utf-8')
            self.assertIn('AI_ACCESS_TOKEN=old-relay-token', saved)
            self.assertIn('SUPABASE_ACCOUNT_MODE=1', saved)
            self.assertEqual(saved.count('TAVILY_API_KEY='), 1)
            self.assertIn('TAVILY_API_KEY=synthetic-new-search-key', saved)
            self.assertIn('OLLAMA_API_KEY=old-key', saved)
            self.assertEqual((Path(directory) / '.env.web-backup').read_text(encoding='utf-8'), original)
            self.assertNotIn('synthetic-new-search-key', result.stdout + result.stderr)

    def test_bad_key_does_not_change_existing_settings(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / '.env'
            env_file.write_text('AI_ACCESS_TOKEN=keep\n', encoding='utf-8')
            result = subprocess.run([sys.executable, '-c', PYTHON_BLOCK], cwd=directory,
                                    env={**os.environ, 'HANSEARCH_SEARCH_KEY': 'key with spaces'}, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(env_file.read_text(encoding='utf-8'), 'AI_ACCESS_TOKEN=keep\n')


if __name__ == '__main__':
    unittest.main()
