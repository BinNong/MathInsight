import threading
import time
from unittest.mock import patch

from app.services.manim_service import ManimService, RESOLUTION_CONFIG


class FakeProcess:
    def __init__(self, lines=(), running=False):
        self.pid = 4321
        self.returncode = None if running else 0
        self._running = running
        self.stdout = self._lines(lines)

    @staticmethod
    def _lines(lines):
        for line in lines:
            time.sleep(0.005)
            yield line

    def poll(self):
        return self.returncode

    def wait(self):
        if self._running:
            self.returncode = -9
        return self.returncode

    def kill(self):
        self.returncode = -9


def make_service():
    return ManimService(api_key='test-key')


def test_extract_code_preserves_imports_and_helpers():
    content = '''```python
import numpy as np
from manim import *

def helper(value):
    return value * 2

class GeneratedScene(Scene):
    def construct(self):
        self.add(Text(str(helper(2))))
```'''
    code = make_service()._extract_code(content)
    assert 'import numpy as np' in code
    assert 'def helper' in code
    assert 'class GeneratedScene(Scene):' in code


def test_extract_subtitles_accepts_bare_json_array():
    subtitles = make_service()._extract_subtitles('[{"start": 0, "end": 1.5, "text": "讲解"}]')
    assert subtitles == [{'start': 0.0, 'end': 1.5, 'text': '讲解'}]


@patch('app.services.manim_service.subprocess.Popen')
def test_render_subprocess_uses_sanitized_environment(popen, tmp_path, monkeypatch):
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'must-not-leak')
    monkeypatch.setenv('OPENAI_API_KEY', 'must-not-leak-either')
    popen.return_value = FakeProcess(['rendering\n'])
    code_file = tmp_path / 'scene.py'
    code_file.write_text('pass', encoding='utf-8')

    make_service()._render_video(
        str(code_file),
        str(tmp_path),
        RESOLUTION_CONFIG['720p'],
        30,
        threading.Event(),
        lambda message, progress: None,
    )

    environment = popen.call_args.kwargs['env']
    assert 'ANTHROPIC_API_KEY' not in environment
    assert 'OPENAI_API_KEY' not in environment
    assert environment['PYTHONDONTWRITEBYTECODE'] == '1'


@patch('app.services.manim_service.os.killpg')
@patch('app.services.manim_service.subprocess.Popen')
def test_render_timeout_terminates_process_group(popen, killpg, tmp_path):
    popen.return_value = FakeProcess(['working\n'] * 100, running=True)
    code_file = tmp_path / 'scene.py'
    code_file.write_text('pass', encoding='utf-8')
    config = dict(RESOLUTION_CONFIG['720p'], timeout=0.001)

    video, _, error = make_service()._render_video(
        str(code_file),
        str(tmp_path),
        config,
        30,
        threading.Event(),
        lambda message, progress: None,
    )

    assert video is None
    assert '超时' in error
    killpg.assert_called_once()
