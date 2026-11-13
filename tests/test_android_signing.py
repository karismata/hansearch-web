import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('android_signing', Path(__file__).resolve().parents[1] / 'android/scripts/prepare-signing.py')
signing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(signing)


class SigningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'scripts').mkdir()
        self.certificate = b'synthetic-public-certificate'
        (self.root / 'signing-certificate.sha256').write_text(hashlib.sha256(self.certificate).hexdigest())
        self.bundle = {'keystore': base64.b64encode(b'synthetic-key' * 100).decode(),
                       'password': 'synthetic-password-for-tests-only-12345', 'alias': 'hansearch'}
        self.patch_file = patch.object(signing, '__file__', str(self.root / 'scripts/prepare-signing.py'))
        self.patch_file.start()
        self.addCleanup(self.patch_file.stop)

    def run_prepare(self, bundle, certificate=None):
        environment = {'HANSEARCH_SIGNING_BUNDLE': json.dumps(bundle) if bundle else '',
                       'RUNNER_TEMP': str(self.root), 'GITHUB_ENV': str(self.root / 'env')}
        with patch.dict(os.environ, environment), \
             patch.object(signing.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout=certificate or self.certificate)) as command, \
             contextlib.redirect_stdout(io.StringIO()):
            signing.prepare()
        return command

    def test_missing_secret_fails_without_publishing_or_generating_key(self):
        with self.assertRaises(ValueError):
            self.run_prepare(None)
        self.assertFalse((self.root / 'hansearch-signing.p12').exists())

    def test_expected_key_restores_and_passes_password_via_environment(self):
        command = self.run_prepare(self.bundle)
        args = command.call_args.args[0]
        self.assertNotIn(self.bundle['password'], args)
        self.assertIn('-storepass:env', args)
        self.assertIn('HANSEARCH_KEYSTORE_PATH=', (self.root / 'env').read_text())

    def test_different_key_is_rejected_and_removed(self):
        with self.assertRaises(ValueError):
            self.run_prepare(self.bundle, certificate=b'different-certificate')
        self.assertFalse((self.root / 'hansearch-signing.p12').exists())
        self.assertFalse((self.root / 'env').exists())

    def test_environment_injection_is_rejected(self):
        for field in ('password', 'alias'):
            bundle = {**self.bundle, field: 'bad\nINJECTED=true'}
            with self.assertRaises(ValueError):
                self.run_prepare(bundle)
            self.assertFalse((self.root / 'env').exists())


if __name__ == '__main__':
    unittest.main()
