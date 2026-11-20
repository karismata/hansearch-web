"""Install per-user macOS services. No credentials are placed in launchd plists."""
from __future__ import annotations

import json
import os
import plistlib
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

SOURCE = Path(__file__).resolve().parent
HOME = Path.home()
RUNTIME = HOME / 'Library/Application Support/HanSearch AI'
AGENTS = HOME / 'Library/LaunchAgents'
LOGS = HOME / 'Library/Logs/HanSearch AI'
SERVER = 'com.hansearch.local-ai'
OLLAMA = 'com.hansearch.ollama'
SEARCH_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'


def settings(folder: Path) -> dict[str, str]:
    # Read only the non-secret settings used to locate local services.
    result = {'HOST': '127.0.0.1', 'PORT': '8765', 'OLLAMA_URL': 'http://127.0.0.1:11434'}
    path = folder / '.env'
    if path.is_file():
        for line in path.read_text(encoding='utf-8').splitlines():
            key, sep, value = line.partition('=')
            if sep and key.strip() in result:
                result[key.strip()] = value.strip().strip('\"\'')
    return result


def health_url(config: dict[str, str]) -> str:
    host = config['HOST']
    if host in ('0.0.0.0', '::'):
        host = '127.0.0.1' if host == '0.0.0.0' else '::1'
    if ':' in host:
        host = '[' + host + ']'
    return f"http://{host}:{int(config['PORT'])}/health"


def read_json(url: str):
    try:
        with urlopen(url, timeout=2) as response:
            return json.loads(response.read(65536))
    except Exception:
        return None


def ollama_ready(config: dict[str, str]) -> bool:
    return isinstance(read_json(config['OLLAMA_URL'].rstrip('/') + '/api/version'), dict)


def local_ollama(config: dict[str, str]) -> bool:
    url = urlsplit(config['OLLAMA_URL'])
    return url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1') and url.port == 11434 and not url.path.strip('/') and not url.username and not url.password


def launchctl(*args: str, required=False):
    result = subprocess.run(['launchctl', *args], capture_output=True, text=True)
    if required and result.returncode:
        raise RuntimeError('자동 실행 등록 실패: 맥미니에 로그인한 계정의 터미널에서 실행해 주세요. 로그 경로: ' + str(LOGS))
    return result


def domain() -> str:
    return f'gui/{os.getuid()}'


def loaded(label: str) -> bool:
    return launchctl('print', domain() + '/' + label).returncode == 0


def make_plist(label: str, python: str, arguments: list[str], *, failure_only=False) -> dict:
    return {'Label': label, 'ProgramArguments': [python, '-u', str(RUNTIME / 'manage-service.py'), *arguments],
            'WorkingDirectory': str(RUNTIME), 'RunAtLoad': True,
            'KeepAlive': {'SuccessfulExit': False} if failure_only else True,
            'ThrottleInterval': 15,
            'EnvironmentVariables': {'PATH': SEARCH_PATH, 'PYTHONUTF8': '1', 'PYTHONUNBUFFERED': '1'},
            'StandardOutPath': str(LOGS / (label + '.log')),
            'StandardErrorPath': str(LOGS / (label + '.error.log'))}


def copy_runtime(source: Path):
    # Launch from Application Support instead of the protected Documents folder.
    RUNTIME.mkdir(parents=True, exist_ok=True)
    RUNTIME.chmod(0o700)
    for name in ('server.py', 'manage-service.py', '.env'):
        src, dest = source / name, RUNTIME / name
        if src.resolve() != dest.resolve():
            temporary = dest.with_name(dest.name + '.installing')
            shutil.copyfile(src, temporary)
            temporary.chmod(0o600)
            os.replace(temporary, dest)
    if (source / 'data').is_dir() and not (RUNTIME / 'data').exists():
        shutil.copytree(source / 'data', RUNTIME / 'data')


def start_agent(label: str):
    path = AGENTS / (label + '.plist')
    if not path.is_file():
        raise RuntimeError('자동 실행 설정이 없습니다. 먼저 install을 실행해 주세요.')
    launchctl('enable', domain() + '/' + label, required=True)
    if not loaded(label):
        launchctl('bootstrap', domain(), str(path), required=True)


def install():
    if not (SOURCE / 'server.py').is_file() or not (SOURCE / '.env').is_file():
        raise RuntimeError('기존 server.py와 .env가 있는 local-ai 폴더에서 실행해 주세요. 설정 파일을 예제로 덮어쓰지 마세요.')
    config = settings(SOURCE)
    managed = loaded(SERVER)
    host = urlsplit(health_url(config)).hostname
    try:
        with socket.create_connection((host, int(config['PORT'])), timeout=1):
            if not managed:
                raise RuntimeError('기존 서버가 실행 중입니다. 그 터미널에서 Control+C로 종료한 뒤 다시 install을 실행해 주세요.')
    except OSError:
        pass
    python = shutil.which('python3') or sys.executable  # Preserve Homebrew's stable symlink.
    jobs = [(SERVER, make_plist(SERVER, python, ['server-run']))]
    if local_ollama(config):
        ollama = shutil.which('ollama', path=os.environ.get('PATH', '') + ':' + SEARCH_PATH)
        if not ollama:
            candidate = Path('/Applications/Ollama.app/Contents/Resources/ollama')
            if candidate.is_file():
                ollama = str(candidate)
        if not ollama:
            raise RuntimeError('Ollama 실행 파일을 찾지 못했습니다. Ollama 설치 상태를 확인해 주세요.')
        job = make_plist(OLLAMA, python, ['ollama-run', ollama], failure_only=True)
        job['EnvironmentVariables']['OLLAMA_HOST'] = '[::1]:11434' if urlsplit(config['OLLAMA_URL']).hostname == '::1' else '127.0.0.1:11434'
        jobs.insert(0, (OLLAMA, job))
    if managed:
        launchctl('bootout', domain() + '/' + SERVER, required=True)
    copy_runtime(SOURCE)
    AGENTS.mkdir(parents=True, exist_ok=True)
    LOGS.mkdir(parents=True, exist_ok=True)
    LOGS.chmod(0o700)
    for label, job in jobs:
        path = AGENTS / (label + '.plist')
        if path.exists():
            shutil.copyfile(path, path.with_suffix('.plist.previous'))
        temporary = path.with_suffix('.plist.installing')
        temporary.write_bytes(plistlib.dumps(job))
        temporary.chmod(0o600)
        os.replace(temporary, path)
        start_agent(label)
    print('로그인 후 자동 실행 등록 완료. 터미널을 닫아도 서버가 계속 실행됩니다.', flush=True)
    wait_status()


def status():
    config = settings(RUNTIME if (RUNTIME / '.env').is_file() else SOURCE)
    payload = read_json(health_url(config))
    running = isinstance(payload, dict) and payload.get('service') == 'hansearch-local-ai'
    print('한주AI 서버: ' + ('실행 중' if running else '응답 없음'))
    print('Ollama: ' + ('실행 중' if ollama_ready(config) else '응답 없음'))
    if running:
        print('한서치 자료: ' + str(payload.get('count', 0)) + '건')
        print('상담 참고: ' + str((payload.get('consultations') or {}).get('count', 0)) + '건')
    print('로그: ' + str(LOGS))
    return running


def wait_status():
    config = settings(RUNTIME)
    deadline = time.monotonic() + 55
    while time.monotonic() < deadline:
        payload = read_json(health_url(config))
        if isinstance(payload, dict) and payload.get('service') == 'hansearch-local-ai':
            break
        time.sleep(1)
    return status()


def main():
    if sys.platform != 'darwin':
        raise RuntimeError('이 도구는 맥미니에서 실행해 주세요.')
    if os.getuid() == 0:
        raise RuntimeError('sudo 없이 맥미니 로그인 계정으로 실행해 주세요.')
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if action == 'server-run':
        config = settings(SOURCE)
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline and not ollama_ready(config):
            time.sleep(1)
        os.execv(sys.executable, [sys.executable, '-u', str(SOURCE / 'server.py')])
    elif action == 'ollama-run':
        if not ollama_ready(settings(SOURCE)):
            os.execv(sys.argv[2], [sys.argv[2], 'serve'])
    elif action == 'install':
        install()
    elif action == 'status':
        status()
    elif action == 'stop':
        if loaded(SERVER):
            launchctl('bootout', domain() + '/' + SERVER, required=True)
        print('한주AI 자동 실행 서버를 중지했습니다. Ollama는 유지합니다. 다음 로그인 때는 다시 시작됩니다.')
    elif action == 'restart':
        if loaded(SERVER):
            launchctl('bootout', domain() + '/' + SERVER, required=True)
        if (AGENTS / (OLLAMA + '.plist')).exists():
            start_agent(OLLAMA)
        start_agent(SERVER)
        wait_status()
    else:
        raise RuntimeError('사용법: python3 manage-service.py install|status|stop|restart')


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        if isinstance(exc, RuntimeError):
            print(str(exc))
        else:
            print('자동 실행 설정을 완료하지 못했습니다. 맥미니의 파일 접근 권한과 설치 경로를 확인해 주세요.')
        raise SystemExit(1) from None
