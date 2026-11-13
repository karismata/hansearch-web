"""CI only. Restore the configured signing key without printing its contents."""
import base64
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path


def prepare():
    raw = os.environ.get('HANSEARCH_SIGNING_BUNDLE', '')
    if not raw:
        raise ValueError('HANSEARCH_SIGNING_BUNDLE repository secret is required; no temporary-key APK will be published')
    bundle = json.loads(raw)
    password, alias = bundle['password'], bundle['alias']
    if not isinstance(password, str) or not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', password):
        raise ValueError('invalid signing configuration')
    if not isinstance(alias, str) or not re.fullmatch(r'[a-z0-9_-]{1,40}', alias):
        raise ValueError('invalid signing configuration')
    key = base64.b64decode(bundle['keystore'], validate=True)
    if not 1000 <= len(key) <= 20000:
        raise ValueError('invalid signing configuration')
    path = Path(os.environ['RUNNER_TEMP']) / 'hansearch-signing.p12'
    path.write_bytes(key)
    path.chmod(0o600)
    env = {**os.environ, 'HANSEARCH_KEYSTORE_PASSWORD': password}
    try:
        certificate = subprocess.run([
            'keytool', '-exportcert', '-keystore', str(path), '-storetype', 'PKCS12',
            '-alias', alias, '-storepass:env', 'HANSEARCH_KEYSTORE_PASSWORD',
        ], env=env, capture_output=True, check=True).stdout
        expected = (Path(__file__).resolve().parents[1] / 'signing-certificate.sha256').read_text().strip()
        if hashlib.sha256(certificate).hexdigest() != expected:
            raise ValueError('signing certificate mismatch; refusing to publish an incompatible update')
    except Exception:
        path.unlink(missing_ok=True)
        raise ValueError('signing key/certificate verification failed') from None
    print('::add-mask::' + password)
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as output:
        output.write(f'HANSEARCH_KEYSTORE_PATH={path}\nHANSEARCH_KEYSTORE_PASSWORD={password}\nHANSEARCH_KEY_ALIAS={alias}\n')
    print('Fixed HanSearch signing certificate verified.')


if __name__ == '__main__':
    try:
        prepare()
    except Exception as exc:
        # Never show arbitrary JSON/keystore error bodies or secret values.
        if isinstance(exc, ValueError) and str(exc).startswith(('HANSEARCH_', 'signing ')):
            print(str(exc))
        else:
            print('Invalid signing configuration. Check the private repository secret.')
        raise SystemExit(1) from None
