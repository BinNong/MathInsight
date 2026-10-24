import os
import tempfile
from unittest import mock

import pytest

from app.services.manim_service import ManimService


class TestManimSubtitles:
    """Manim 字幕解析、时序校验与 WebVTT 生成测试"""

    @pytest.fixture
    def service(self):
        return ManimService(api_key="dummy")

    def test_extract_subtitles_with_markers(self, service):
        content = """
```python
from manim import *
class GeneratedScene(Scene):
    pass
```

```json
SUBTITLES
[
  {"start": 0.0, "end": 2.5, "text": "第一步"},
  {"start": 2.5, "end": 5.0, "text": "第二步"}
]
```
"""
        subtitles = service._extract_subtitles(content)
        assert len(subtitles) == 2
        assert subtitles[0] == {"start": 0.0, "end": 2.5, "text": "第一步"}
        assert subtitles[1] == {"start": 2.5, "end": 5.0, "text": "第二步"}

    def test_extract_subtitles_without_marker(self, service):
        content = """
```python
from manim import *
class GeneratedScene(Scene):
    pass
```

```json
[
  {"start": 1.0, "end": 3.0, "text": "没有 SUBTITLES 标记"}
]
```
"""
        subtitles = service._extract_subtitles(content)
        assert len(subtitles) == 1
        assert subtitles[0]["text"] == "没有 SUBTITLES 标记"

    def test_extract_subtitles_invalid_json_returns_empty(self, service):
        content = """
```json
SUBTITLES
[
  {"start": 0.0, "end": 2.0, "text": "broken"},
```
"""
        assert service._extract_subtitles(content) == []

    def test_extract_subtitles_missing_fields_returns_empty(self, service):
        content = """
```json
SUBTITLES
[
  {"start": 0.0, "text": "缺少 end"}
]
```
"""
        assert service._extract_subtitles(content) == []

    def test_extract_subtitles_empty_text_skipped(self, service):
        content = """
```json
SUBTITLES
[
  {"start": 0.0, "end": 1.0, "text": "   "}
]
```
"""
        assert service._extract_subtitles(content) == []

    def test_to_webvtt_basic(self, service):
        subtitles = [
            {"start": 0.0, "end": 3.5, "text": "首先我们画一个坐标系"},
            {"start": 3.5, "end": 7.0, "text": "然后让正弦曲线生长"},
        ]
        vtt = service._to_webvtt(subtitles)
        assert vtt.startswith("WEBVTT\n")
        assert "00:00:00.000 --> 00:00:03.500" in vtt
        assert "首先我们画一个坐标系" in vtt
        assert "00:00:03.500 --> 00:00:07.000" in vtt
        assert "然后让正弦曲线生长" in vtt

    def test_to_webvtt_empty_returns_empty(self, service):
        assert service._to_webvtt([]) == ""

    def test_to_webvtt_time_formatting(self, service):
        subtitles = [
            {"start": 3661.123, "end": 3662.999, "text": "跨小时测试"},
        ]
        vtt = service._to_webvtt(subtitles)
        assert "01:01:01.123 --> 01:01:02.999" in vtt

    def test_to_webvtt_multiline_text_normalized(self, service):
        subtitles = [
            {"start": 0.0, "end": 1.0, "text": "第一行\n第二行"},
        ]
        vtt = service._to_webvtt(subtitles)
        assert "第一行 第二行" in vtt
        assert "\n第一行\n" not in vtt

    def test_estimate_video_duration_with_run_time_and_wait(self, service):
        code = """
class GeneratedScene(Scene):
    def construct(self):
        self.play(Create(Circle()), run_time=2.5)
        self.wait(1.0)
        self.play(FadeIn(Text("Hi")), run_time=0.5)
        self.play(Transform(c, s))
"""
        duration = service._estimate_video_duration(code)
        assert duration == 2.5 + 1.0 + 0.5 + 1.0

    def test_estimate_video_duration_empty_code(self, service):
        assert service._estimate_video_duration("") == 0.0

    def test_reconcile_subtitles_filters_out_of_range(self, service):
        subtitles = [
            {"start": 0.0, "end": 2.0, "text": "第一段"},
            {"start": 5.0, "end": 7.0, "text": "超出时长"},
        ]
        result, adjusted = service._reconcile_subtitles(subtitles, estimated_duration=4.0)
        assert adjusted is True
        assert len(result) == 1
        assert result[0]["text"] == "第一段"
        assert result[0]["end"] == 4.0

    def test_reconcile_subtitles_fills_gaps_and_extends_last(self, service):
        subtitles = [
            {"start": 0.0, "end": 1.0, "text": "第一段"},
            {"start": 3.0, "end": 4.0, "text": "第二段"},
        ]
        result, adjusted = service._reconcile_subtitles(subtitles, estimated_duration=6.0, max_gap=1.0)
        assert adjusted is True
        assert len(result) == 2
        assert result[0]["end"] == 3.0  # gap 为 2 秒，延长前一条
        assert result[1]["end"] == 6.0  # 最后一条延长至结束

    def test_reconcile_subtitles_no_adjustment_needed(self, service):
        subtitles = [
            {"start": 0.0, "end": 2.0, "text": "第一段"},
            {"start": 2.0, "end": 4.0, "text": "第二段"},
        ]
        result, adjusted = service._reconcile_subtitles(subtitles, estimated_duration=4.0)
        assert adjusted is False
        assert len(result) == 2
        assert result[0]["end"] == 2.0
        assert result[1]["end"] == 4.0

    def test_get_video_duration_with_ffprobe(self, service):
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(b"fake video")
            tmp_path = tmp.name
        try:
            with mock.patch("app.services.manim_service.subprocess.run") as mock_run:
                mock_run.return_value = mock.Mock(returncode=0, stdout="12.345\n", stderr="")
                duration = service._get_video_duration(tmp_path)
                assert duration == 12.345
                mock_run.assert_called_once()
                args = mock_run.call_args[0][0]
                assert args[0] == "ffprobe"
        finally:
            os.remove(tmp_path)

    def test_get_video_duration_ffprobe_missing(self, service):
        with mock.patch("app.services.manim_service.subprocess.run", side_effect=FileNotFoundError()):
            assert service._get_video_duration("/nonexistent/video.mp4") == 0.0
