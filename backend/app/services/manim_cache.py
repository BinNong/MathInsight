"""
Manim 生成结果缓存

缓存键基于 description + resolution + fps 的 SHA256 哈希。
提供代码缓存与视频缓存两级结构，命中时可跳过 LLM 调用或 manim 渲染。
"""
import hashlib
import os
import shutil
from pathlib import Path
from typing import Optional


DEFAULT_CACHE_ROOT = "cache"
CACHE_VIDEO_FILENAME = "video.mp4"
CACHE_CODE_FILENAME = "generated_scene.py"
CACHE_SUBTITLE_FILENAME = "subtitles.vtt"


def get_cache_key(description: str, resolution: str, fps: int) -> str:
    """生成缓存键"""
    text = f"{description.strip()}|{resolution}|{fps}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def get_cache_root(base_dir: str) -> str:
    """获取缓存根目录"""
    root = os.path.join(base_dir, DEFAULT_CACHE_ROOT)
    os.makedirs(root, exist_ok=True)
    return root


def _cache_dir(base_dir: str, cache_key: str) -> str:
    """获取某个缓存键对应的目录"""
    root = get_cache_root(base_dir)
    directory = os.path.join(root, cache_key[:2], cache_key[2:])
    os.makedirs(directory, exist_ok=True)
    return directory


def get_cached_code(base_dir: str, cache_key: str) -> Optional[str]:
    """读取缓存的代码，不存在返回 None"""
    code_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_CODE_FILENAME)
    if not os.path.exists(code_path):
        return None
    try:
        with open(code_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def save_cached_code(base_dir: str, cache_key: str, code: str) -> str:
    """保存代码到缓存，返回缓存文件路径"""
    code_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_CODE_FILENAME)
    with open(code_path, "w", encoding="utf-8") as f:
        f.write(code)
    return code_path


def get_cached_video(base_dir: str, cache_key: str) -> Optional[str]:
    """读取缓存的视频文件路径，不存在返回 None"""
    video_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_VIDEO_FILENAME)
    if os.path.exists(video_path):
        return video_path
    return None


def save_cached_video(base_dir: str, cache_key: str, video_path: str) -> str:
    """复制视频到缓存，返回缓存后的路径"""
    dest_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_VIDEO_FILENAME)
    shutil.copy2(video_path, dest_path)
    return dest_path


def get_cached_subtitle(base_dir: str, cache_key: str) -> Optional[str]:
    """读取缓存的字幕文件路径，不存在返回 None"""
    subtitle_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_SUBTITLE_FILENAME)
    if os.path.exists(subtitle_path):
        return subtitle_path
    return None


def save_cached_subtitle(base_dir: str, cache_key: str, subtitle_path: str) -> str:
    """复制字幕到缓存，返回缓存后的路径"""
    dest_path = os.path.join(_cache_dir(base_dir, cache_key), CACHE_SUBTITLE_FILENAME)
    shutil.copy2(subtitle_path, dest_path)
    return dest_path


def clear_cache(base_dir: str) -> int:
    """清空缓存目录，返回删除的目录数"""
    root = os.path.join(base_dir, DEFAULT_CACHE_ROOT)
    if not os.path.exists(root):
        return 0
    removed = 0
    for entry in os.listdir(root):
        entry_path = os.path.join(root, entry)
        try:
            if os.path.isdir(entry_path):
                shutil.rmtree(entry_path, ignore_errors=True)
                removed += 1
        except Exception:
            continue
    return removed
