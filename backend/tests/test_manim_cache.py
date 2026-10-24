import os
import tempfile

from app.services.manim_cache import (
    get_cache_key,
    get_cached_code,
    save_cached_code,
    get_cached_subtitle,
    get_cached_video,
    save_cached_subtitle,
    save_cached_video,
    clear_cache,
)


class TestManimCache:
    """Manim 缓存模块测试"""

    def test_cache_key_deterministic(self):
        key1 = get_cache_key("test description", "720p", 30)
        key2 = get_cache_key("test description", "720p", 30)
        assert key1 == key2
        assert len(key1) == 64

    def test_cache_key_sensitive_to_params(self):
        key1 = get_cache_key("test", "720p", 30)
        key2 = get_cache_key("test", "1080p", 30)
        key3 = get_cache_key("test", "720p", 60)
        assert key1 != key2
        assert key1 != key3
        assert key2 != key3

    def test_save_and_get_cached_code(self):
        with tempfile.TemporaryDirectory() as base_dir:
            key = get_cache_key("circle animation", "720p", 30)
            code = "from manim import *\nclass GeneratedScene(Scene):\n    pass\n"

            assert get_cached_code(base_dir, key) is None

            save_cached_code(base_dir, key, code)
            cached = get_cached_code(base_dir, key)
            assert cached == code

    def test_save_and_get_cached_video(self):
        with tempfile.TemporaryDirectory() as base_dir:
            key = get_cache_key("circle animation", "720p", 30)
            # 创建一个假视频文件
            source = os.path.join(base_dir, "source.mp4")
            with open(source, "w") as f:
                f.write("fake video")

            assert get_cached_video(base_dir, key) is None

            save_cached_video(base_dir, key, source)
            cached_path = get_cached_video(base_dir, key)
            assert cached_path is not None
            assert os.path.exists(cached_path)
            with open(cached_path) as f:
                assert f.read() == "fake video"

    def test_save_and_get_cached_subtitle(self):
        with tempfile.TemporaryDirectory() as base_dir:
            key = get_cache_key("circle animation", "720p", 30)
            source = os.path.join(base_dir, "source.vtt")
            with open(source, "w") as f:
                f.write("WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.000\ntest\n")

            assert get_cached_subtitle(base_dir, key) is None

            save_cached_subtitle(base_dir, key, source)
            cached_path = get_cached_subtitle(base_dir, key)
            assert cached_path is not None
            assert os.path.exists(cached_path)
            with open(cached_path) as f:
                assert f.read().startswith("WEBVTT")

    def test_clear_cache(self):
        with tempfile.TemporaryDirectory() as base_dir:
            key = get_cache_key("test", "720p", 30)
            save_cached_code(base_dir, key, "code")
            assert get_cached_code(base_dir, key) is not None

            clear_cache(base_dir)
            assert get_cached_code(base_dir, key) is None
