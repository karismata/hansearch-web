import importlib.util
import json
import plistlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mac_service', Path(__file__).resolve().parents[1] / 'local-ai/manage-service.py')
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)


class MacServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / 'Documents/Hansearch AI/local-ai'
        self.source.mkdir(parents=True)
        self.runtime = self.root / 'Library/Application Support/HanSearch AI'
        self.env = 'AI_ACCESS_TOKEN=synthetic-private-token\nTAVILY_API_KEY=synthetic-private-search-key\nCONSULTATION_DIR=/synthetic/상담이력\nPORT=9876\n'
        for name, content in [('server.py', '# synthetic server'), ('manage-service.py', '# synthetic manager'), ('.env', self.env)]:
            (self.source / name).write_text(content, encoding='utf-8')
        self.patches = [patch.object(service, 'RUNTIME', self.runtime), patch.object(service, 'SOURCE', self.source),
                        patch.object(service, 'LOGS', self.root / 'logs'), patch.object(service, 'AGENTS', self.root / 'agents')]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_plist_escapes_spaces_without_credentials_or_shell_commands(self):
        value = service.make_plist(service.SERVER, '/opt/homebrew/bin/python3', ['server-run'])
        decoded = plistlib.loads(plistlib.dumps(value))
        self.assertEqual(decoded['ProgramArguments'][0], '/opt/homebrew/bin/python3')
        self.assertEqual(decoded['ProgramArguments'][2], str(self.runtime / 'manage-service.py'))
        self.assertEqual(decoded['WorkingDirectory'], str(self.runtime))
        self.assertTrue(decoded['RunAtLoad'])
        self.assertTrue(decoded['KeepAlive'])
        self.assertNotIn('synthetic-private', json.dumps(decoded))
        self.assertNotIn('AI_ACCESS_TOKEN', decoded['EnvironmentVariables'])

    def test_copy_preserves_keys_consultation_path_and_originals(self):
        (self.source / 'data').mkdir()
        (self.source / 'data/items.json').write_text('synthetic old snapshot')
        service.copy_runtime(self.source)
        self.assertEqual((self.runtime / '.env').read_text(encoding='utf-8'), self.env)
        self.assertEqual((self.source / '.env').read_text(encoding='utf-8'), self.env)
        (self.runtime / 'data/items.json').write_text('newer running snapshot')
        service.copy_runtime(self.source)
        self.assertEqual((self.runtime / 'data/items.json').read_text(), 'newer running snapshot')

    def test_only_expected_local_ollama_is_auto_managed(self):
        for url in ['http://127.0.0.1:11434', 'http://localhost:11434/', 'http://[::1]:11434']:
            self.assertTrue(service.local_ollama({'OLLAMA_URL': url}))
        for url in ['http://192.0.2.1:11434', 'https://example.invalid', 'http://localhost:9999', 'http://localhost:11434/proxy']:
            self.assertFalse(service.local_ollama({'OLLAMA_URL': url}))

    def test_settings_extracts_only_nonsecret_values(self):
        config = service.settings(self.source)
        self.assertEqual(config['PORT'], '9876')
        self.assertEqual(service.health_url(config), 'http://127.0.0.1:9876/health')
        self.assertNotIn('AI_ACCESS_TOKEN', config)
        self.assertNotIn('CONSULTATION_DIR', config)

    def test_running_manual_server_is_not_killed_or_overwritten(self):
        with patch.object(service, 'loaded', return_value=False), \
             patch.object(service.socket, 'create_connection') as connection, \
             patch.object(service, 'launchctl') as launch:
            with self.assertRaisesRegex(RuntimeError, 'Control.C'):
                service.install()
        launch.assert_not_called()
        self.assertFalse(self.runtime.exists())

    def test_server_exec_waits_for_ollama_and_keeps_exact_script_argument(self):
        with patch.object(service.sys, 'platform', 'darwin'), patch.object(service.os, 'getuid', return_value=501, create=True), \
             patch.object(service.sys, 'argv', ['manage-service.py', 'server-run']), \
             patch.object(service, 'ollama_ready', side_effect=[False, True]), patch.object(service.time, 'sleep') as sleep, \
             patch.object(service.os, 'execv') as execute:
            service.main()
        self.assertEqual(sleep.call_count, 1)
        self.assertEqual(execute.call_args.args[1][-1], str(self.source / 'server.py'))

    def test_existing_ollama_is_left_running(self):
        with patch.object(service.sys, 'platform', 'darwin'), patch.object(service.os, 'getuid', return_value=501, create=True), \
             patch.object(service.sys, 'argv', ['manage-service.py', 'ollama-run', '/synthetic/ollama']), \
             patch.object(service, 'ollama_ready', return_value=True), patch.object(service.os, 'execv') as execute:
            service.main()
        execute.assert_not_called()

    def test_install_registers_both_jobs_and_keeps_private_values_out_of_plists(self):
        with patch.object(service, 'loaded', return_value=False), \
             patch.object(service, 'domain', return_value='gui/501'), \
             patch.object(service.socket, 'create_connection', side_effect=OSError), \
             patch.object(service.shutil, 'which', side_effect=lambda name, **kwargs: '/opt/homebrew/bin/' + name), \
             patch.object(service, 'launchctl') as launch, patch.object(service, 'wait_status', return_value=True):
            service.install()
        server = plistlib.loads((service.AGENTS / (service.SERVER + '.plist')).read_bytes())
        ollama = plistlib.loads((service.AGENTS / (service.OLLAMA + '.plist')).read_bytes())
        self.assertEqual(server['WorkingDirectory'], str(self.runtime))
        self.assertEqual(ollama['EnvironmentVariables']['OLLAMA_HOST'], '127.0.0.1:11434')
        self.assertEqual(ollama['KeepAlive'], {'SuccessfulExit': False})
        self.assertNotIn('synthetic-private', json.dumps([server, ollama]))
        self.assertEqual((self.runtime / '.env').read_text(encoding='utf-8'), self.env)
        self.assertEqual(sum(call.args[0] == 'bootstrap' for call in launch.call_args_list), 2)


if __name__ == '__main__':
    unittest.main()
