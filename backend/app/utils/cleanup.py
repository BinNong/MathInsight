"""
临时文件清理工具

负责清理 downloads 目录中过期的 Manim 生成文件、缓存目录，以及遗留的 media/videos 临时目录。
"""
import os
import shutil
import threading
import time
from pathlib import Path
from typing import Optional

DEFAULT_MAX_AGE_HOURS = 24
CLEANUP_INTERVAL_HOURS = 1
CACHE_MAX_AGE_HOURS = 72  # 缓存保留更久


def _remove_empty_dirs(root: str):
    """递归删除空目录"""
    for dirpath, dirnames, filenames in os.walk(root, topdown=False):
        if not dirnames and not filenames and dirpath != root:
            try:
                os.rmdir(dirpath)
            except Exception:
                pass


def cleanup_manim_temp_files(downloads_dir: str, max_age_hours: Optional[int] = None) -> int:
    """
    清理 downloads 目录中过期的 manim 临时文件与缓存。

    返回删除的文件/目录数量。
    """
    if max_age_hours is None:
        max_age_hours = DEFAULT_MAX_AGE_HOURS

    if not os.path.exists(downloads_dir):
        return 0

    now = time.time()
    max_age_seconds = max_age_hours * 3600
    removed_count = 0

    for entry in os.listdir(downloads_dir):
        entry_path = os.path.join(downloads_dir, entry)

        # 删除过期的视频文件、源码文件和字幕文件
        if entry.startswith("manim_") and (entry.endswith(".mp4") or entry.endswith(".py") or entry.endswith(".vtt")):
            try:
                mtime = os.path.getmtime(entry_path)
                if now - mtime > max_age_seconds:
                    os.remove(entry_path)
                    removed_count += 1
            except Exception:
                continue

        # 删除遗留的 media/videos 临时目录（无论是否过期）
        if entry in ("media", "videos") and os.path.isdir(entry_path):
            try:
                shutil.rmtree(entry_path, ignore_errors=True)
                removed_count += 1
            except Exception:
                continue

    # 清理缓存目录中的过期文件
    cache_dir = os.path.join(downloads_dir, "cache")
    if os.path.isdir(cache_dir):
        cache_max_age_seconds = CACHE_MAX_AGE_HOURS * 3600
        for dirpath, _dirnames, filenames in os.walk(cache_dir):
            for filename in filenames:
                if filename.endswith(".mp4") or filename.endswith(".py") or filename.endswith(".vtt"):
                    file_path = os.path.join(dirpath, filename)
                    try:
                        mtime = os.path.getmtime(file_path)
                        if now - mtime > cache_max_age_seconds:
                            os.remove(file_path)
                            removed_count += 1
                    except Exception:
                        continue
        _remove_empty_dirs(cache_dir)

    return removed_count


def schedule_periodic_cleanup(downloads_dir: str, interval_hours: Optional[int] = None):
    """
    启动一个后台线程，定期清理过期文件。
    """
    if interval_hours is None:
        interval_hours = CLEANUP_INTERVAL_HOURS

    def cleanup_loop():
        while True:
            time.sleep(interval_hours * 3600)
            try:
                cleanup_manim_temp_files(downloads_dir)
            except Exception:
                # 清理失败不应影响主服务
                pass

    thread = threading.Thread(target=cleanup_loop, daemon=True)
    thread.start()
