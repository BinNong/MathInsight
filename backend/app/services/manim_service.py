"""
Manim 动画生成服务
使用 LLM 生成 Manim 代码并渲染视频
"""
import json
import os
import py_compile
import re
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import anthropic

from app.config import Config
from app.services.manim_cache import (
    get_cache_key,
    get_cached_code,
    get_cached_subtitle,
    get_cached_video,
    save_cached_code,
    save_cached_subtitle,
    save_cached_video,
)
from app.services.manim_security import CodeSecurityError, ensure_code_safe
from app.services.manim_task_manager import ManimTask, ManimTaskManager, TaskStatus, task_manager


# 分辨率到 manim 质量参数、渲染超时、输出目录名的映射
RESOLUTION_CONFIG = {
    "720p": {"quality": "-qm", "timeout": 180, "dir_name": "720p30"},
    "1080p": {"quality": "-qh", "timeout": 300, "dir_name": "1080p60"},
    "4k": {"quality": "-qk", "timeout": 600, "dir_name": "2160p60"},
}

DEFAULT_RESOLUTION = "720p"
DEFAULT_FPS = 30
MAX_ITERATIONS = 10
MAX_LOG_LENGTH = 4000
# 单个任务整体超时（含 LLM 调用、代码修复与渲染），默认 15 分钟
MAX_TOTAL_TASK_SECONDS = 900


class ManimService:
    """Manim 动画生成服务类"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        if not api_key:
            api_key = Config.get_llm_api_key()
        if not base_url:
            base_url = Config.get_anthropic_base_url()
        if not model:
            model = Config.ANTHROPIC_MODEL or "deepseek-v4-pro"

        default_headers = {"X-Api-Key": api_key} if api_key else None
        if base_url:
            self.client = anthropic.Anthropic(
                api_key=api_key,
                base_url=base_url,
                default_headers=default_headers,
            )
        else:
            self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.max_iterations = MAX_ITERATIONS
        self.task_manager = task_manager

    def generate_animation(
        self,
        task: ManimTask,
        downloads_dir: str,
    ) -> None:
        """
        在后台线程中执行动画生成。

        结果通过 task_manager 写入 task 对象，不返回值。
        """
        description = task.description
        resolution = task.resolution or DEFAULT_RESOLUTION
        fps = task.fps or DEFAULT_FPS

        res_cfg = RESOLUTION_CONFIG.get(resolution, RESOLUTION_CONFIG[DEFAULT_RESOLUTION])
        cache_key = get_cache_key(description, resolution, fps)
        start_time = time.time()

        def update_stage(status: TaskStatus, message: str, iterations: Optional[int] = None, progress: Optional[int] = None):
            self.task_manager.update_task(
                task.task_id,
                status=status,
                stage_message=message,
                iterations=iterations,
                progress_percent=progress,
            )

        def check_cancelled() -> bool:
            if task.cancel_event.is_set():
                update_stage(TaskStatus.CANCELLED, "任务已取消")
                return True
            return False

        def check_timeout() -> bool:
            elapsed = time.time() - start_time
            if elapsed > MAX_TOTAL_TASK_SECONDS:
                update_stage(TaskStatus.FAILED, f"任务整体超时（超过 {MAX_TOTAL_TASK_SECONDS} 秒）")
                self.task_manager.update_task(
                    task.task_id,
                    error=f"任务整体超时（超过 {MAX_TOTAL_TASK_SECONDS} 秒）",
                )
                return True
            return False

        if check_cancelled() or check_timeout():
            return

        # 优先检查视频缓存
        cached_video = get_cached_video(downloads_dir, cache_key)
        if cached_video and os.path.exists(cached_video):
            dest_filename = f"{task.task_id}.mp4"
            dest_path = os.path.join(downloads_dir, dest_filename)
            shutil.copy2(cached_video, dest_path)
            relative_path = f"/mathinsight/downloads/{dest_filename}"

            result = {
                "success": True,
                "video_url": relative_path,
                "iterations": 0,
                "message": "命中视频缓存，生成成功",
                "resolution": resolution,
                "fps": fps,
            }

            # 命中代码缓存时，可估算动画时长
            cached_code = get_cached_code(downloads_dir, cache_key)
            if cached_code:
                estimated_duration = self._estimate_video_duration(cached_code)
                result["estimated_duration"] = round(estimated_duration, 3)

            # 若存在同 key 缓存字幕，一并复制输出
            cached_subtitle = get_cached_subtitle(downloads_dir, cache_key)
            if cached_subtitle and os.path.exists(cached_subtitle):
                subtitle_dest_filename = f"{task.task_id}.vtt"
                subtitle_dest_path = os.path.join(downloads_dir, subtitle_dest_filename)
                shutil.copy2(cached_subtitle, subtitle_dest_path)
                result["subtitle_url"] = f"/mathinsight/downloads/{subtitle_dest_filename}"
                # 统计字幕条数（简单按 cue 行估算）
                try:
                    with open(cached_subtitle, "r", encoding="utf-8") as f:
                        subtitle_text = f.read()
                    result["subtitle_count"] = subtitle_text.count(" --> ")
                except Exception:
                    result["subtitle_count"] = 0

            self.task_manager.update_task(
                task.task_id,
                status=TaskStatus.SUCCESS,
                stage_message="命中视频缓存，生成成功",
                progress_percent=100,
                cache_hit=True,
                result=result,
            )
            return

        update_stage(TaskStatus.GENERATING, "AI 正在生成 Manim 代码")

        last_error = None
        code = None
        subtitles: List[Dict[str, Any]] = []
        estimated_duration = 0.0
        subtitle_adjusted = False
        iterations = 0

        try:
            for iteration in range(1, self.max_iterations + 1):
                iterations = iteration

                if check_cancelled() or check_timeout():
                    return

                # 第一次迭代优先尝试代码缓存
                if iteration == 1:
                    cached_code = get_cached_code(downloads_dir, cache_key)
                    if cached_code:
                        code = cached_code
                        update_stage(TaskStatus.GENERATING, "命中代码缓存，跳过 LLM 生成")
                    else:
                        update_stage(TaskStatus.GENERATING, f"AI 正在生成 Manim 代码（第 {iteration} 次尝试）")
                        code, subtitles = self._generate_code(description)
                else:
                    update_stage(
                        TaskStatus.GENERATING,
                        f"检测到错误，AI 正在修复代码（第 {iteration} 次尝试）",
                        iterations=iteration - 1,
                    )
                    code, fix_subtitles = self._fix_code(description, last_error or "Unknown error")
                    # 修复迭代若提供了新字幕则更新，否则保留旧字幕
                    if fix_subtitles:
                        subtitles = fix_subtitles

                estimated_duration = self._estimate_video_duration(code)
                subtitles, was_adjusted = self._reconcile_subtitles(subtitles, estimated_duration)
                if was_adjusted:
                    subtitle_adjusted = True

                if not code or not code.strip():
                    last_error = "LLM 返回空代码"
                    continue

                # 保存当前代码到任务状态，便于前端查看
                self.task_manager.update_task(
                    task.task_id,
                    generated_code=code,
                )

                # 代码安全检查
                try:
                    ensure_code_safe(code)
                except CodeSecurityError as e:
                    update_stage(TaskStatus.FAILED, f"代码安全检查失败: {e}")
                    self.task_manager.update_task(
                        task.task_id,
                        error=f"代码包含危险操作: {e}",
                    )
                    return

                # 渲染前语法校验（fail-fast）
                syntax_error = self._validate_syntax(code)
                if syntax_error:
                    last_error = f"Python 语法错误: {syntax_error}"
                    self.task_manager.update_task(
                        task.task_id,
                        render_log=last_error,
                    )
                    continue

                if check_cancelled() or check_timeout():
                    return

                update_stage(TaskStatus.RENDERING, f"Manim 正在渲染视频（第 {iteration} 次尝试）", iterations=iteration, progress=70)

                # 使用临时目录隔离每次渲染
                with tempfile.TemporaryDirectory(prefix="manim_render_") as temp_dir:
                    code_file = self._save_code_file(code, temp_dir)
                    if not code_file:
                        last_error = "Failed to save code file"
                        continue

                    video_path, render_log, error = self._render_video(
                        code_file=code_file,
                        temp_dir=temp_dir,
                        res_cfg=res_cfg,
                        fps=fps,
                        cancel_event=task.cancel_event,
                        progress_callback=lambda msg, pct: self._on_render_progress(task.task_id, msg, pct),
                    )

                    if task.cancel_event.is_set():
                        update_stage(TaskStatus.CANCELLED, "任务已取消")
                        return

                    if video_path and os.path.exists(video_path):
                        # 保存代码缓存
                        save_cached_code(downloads_dir, cache_key, code)
                        # 保存视频缓存
                        save_cached_video(downloads_dir, cache_key, video_path)

                        dest_filename = f"{task.task_id}.mp4"
                        dest_path = os.path.join(downloads_dir, dest_filename)
                        shutil.copy2(video_path, dest_path)

                        relative_path = f"/mathinsight/downloads/{dest_filename}"

                        # 视频时长兜底：用 ffprobe 获取真实时长
                        actual_duration = self._get_video_duration(dest_path)
                        duration_for_subtitles = actual_duration if actual_duration > 0 else estimated_duration
                        if duration_for_subtitles > 0 and duration_for_subtitles != estimated_duration:
                            subtitles, was_adjusted = self._reconcile_subtitles(subtitles, duration_for_subtitles)
                            if was_adjusted:
                                subtitle_adjusted = True

                        result = {
                            "success": True,
                            "video_url": relative_path,
                            "iterations": iteration,
                            "message": "生成成功",
                            "resolution": resolution,
                            "fps": fps,
                            "estimated_duration": round(estimated_duration, 3),
                            "actual_duration": round(actual_duration, 3) if actual_duration > 0 else None,
                            "subtitle_count": len(subtitles),
                            "subtitle_adjusted": subtitle_adjusted,
                        }

                        # 生成并保存字幕文件
                        if subtitles:
                            subtitle_vtt = self._to_webvtt(subtitles)
                            if subtitle_vtt:
                                subtitle_dest_filename = f"{task.task_id}.vtt"
                                subtitle_dest_path = os.path.join(downloads_dir, subtitle_dest_filename)
                                try:
                                    with open(subtitle_dest_path, "w", encoding="utf-8") as f:
                                        f.write(subtitle_vtt)
                                    save_cached_subtitle(downloads_dir, cache_key, subtitle_dest_path)
                                    result["subtitle_url"] = f"/mathinsight/downloads/{subtitle_dest_filename}"
                                except Exception:
                                    # 字幕写入失败不应阻断主流程
                                    pass

                        self.task_manager.update_task(
                            task.task_id,
                            status=TaskStatus.SUCCESS,
                            stage_message="生成成功",
                            iterations=iteration,
                            progress_percent=100,
                            render_log=None,
                            result=result,
                        )
                        return

                    last_error = error or "Unknown error"
                    self.task_manager.update_task(
                        task.task_id,
                        render_log=render_log or last_error,
                    )

            # 超过最大迭代次数
            self.task_manager.update_task(
                task.task_id,
                status=TaskStatus.FAILED,
                stage_message="尝试多次仍失败，请简化描述",
                iterations=iterations,
                progress_percent=0,
                error=last_error or "尝试多次仍失败，请简化描述",
            )

        except Exception as e:
            self.task_manager.update_task(
                task.task_id,
                status=TaskStatus.FAILED,
                stage_message=f"生成异常: {str(e)}",
                error=str(e),
            )

    def _on_render_progress(self, task_id: str, message: str, percent: int):
        """渲染进度回调"""
        self.task_manager.update_task(
            task_id,
            status=TaskStatus.RENDERING,
            stage_message=message,
            progress_percent=percent,
        )

    def _generate_code(self, description: str) -> Tuple[str, List[Dict[str, Any]]]:
        """使用 LLM 生成 Manim 代码与讲解字幕"""
        prompt = f"""你是一个Manim动画专家。根据用户描述生成可运行的Manim Python代码，并给出与画面严格同步的讲解字幕。

要求：
1. 先输出Python代码块（```python ... ```）
2. 再输出字幕块，格式为 ```json
SUBTITLES
[
  {{"start": 0.0, "end": 3.0, "text": "讲解文本"}},
  ...
]
```
3. 使用Manim Community版本 (from manim import *)
4. 代码要完整可运行
5. 画面要美观，适合教学演示
6. 场景类名必须是 GeneratedScene，继承 Scene
7. 注意：不要在类内部再定义其他类！只定义一个类！
8. 不要包含任何文件读写、网络请求、系统调用相关代码
9. 如需显示中文，请使用 Text 对象并设置合适的字体
10. 字幕时间轴必须严格基于代码中的动画时长计算：
    - self.play(..., run_time=X) 占用 X 秒
    - self.wait(X) 占用 X 秒
    - 未显式设置 run_time 的 self.play(...) 默认占用 1 秒
    - 例如前三个动画 run_time 分别为 1、2、1.5 秒，则第一条字幕建议覆盖 0-4.5 秒区间
11. 每条字幕的文本必须准确描述该时间段内画面上实际出现的对象、变换或讲解要点
12. 在代码关键位置用注释标注对应字幕段，例如：# SUBTITLE[0]: 0.0-4.5 画出坐标系

用户描述：{description}

生成的代码与字幕："""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system="你是一个Manim动画专家，擅长生成高质量的数学动画代码与同步讲解字幕。",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = self._extract_text_content(response)
        if not content:
            return self._fallback_code(), []

        code = self._extract_code(content)
        code = re.sub(r"class \w+\(Scene\):", "class GeneratedScene(Scene):", code)
        if "from manim import" not in code:
            code = "from manim import *\n\n" + code

        subtitles = self._extract_subtitles(content)
        estimated_duration = self._estimate_video_duration(code)
        subtitles, _ = self._reconcile_subtitles(subtitles, estimated_duration)
        return code, subtitles

    def _fix_code(self, description: str, error: str) -> Tuple[str, List[Dict[str, Any]]]:
        """使用 LLM 修复代码错误并保留字幕"""
        prompt = f"""上次生成的代码执行失败，错误信息如下：
{error}

用户原始描述：{description}

请修复上述问题，重新生成可运行的Manim代码与严格同步的讲解字幕。
输出格式：
1. 先输出Python代码块（```python ... ```）
2. 再输出字幕块（```json\nSUBTITLES\n[...]\n```）
场景类名必须是 GeneratedScene，继承 Scene。
不要包含任何文件读写、网络请求、系统调用相关代码。
字幕时间轴必须基于代码中 self.play(run_time=...)、self.wait(...) 的实际时长累加得到；
未设置 run_time 的 self.play(...) 默认按 1 秒计算。
每条字幕文本必须描述对应时间段内画面实际出现的内容。
在代码关键位置用注释标注：# SUBTITLE[n]: start-end 讲解内容

修复后的代码与字幕："""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system="你是一个Manim动画专家，擅长修复代码错误并保留讲解字幕。",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        content = self._extract_text_content(response)
        if not content:
            return self._fallback_code(), []

        code = self._extract_code(content)
        code = re.sub(r"class \w+\(Scene\):", "class GeneratedScene(Scene):", code)
        if "from manim import" not in code:
            code = "from manim import *\n\n" + code

        subtitles = self._extract_subtitles(content)
        estimated_duration = self._estimate_video_duration(code)
        subtitles, _ = self._reconcile_subtitles(subtitles, estimated_duration)
        return code, subtitles

    def _extract_text_content(self, response) -> str:
        """从 Anthropic 响应中提取文本内容"""
        content = ""
        for block in response.content:
            if hasattr(block, "type") and block.type == "text":
                content = block.text
                break
            elif hasattr(block, "text"):
                content = block.text
        return content

    def _fallback_code(self) -> str:
        return "from manim import *\n\nclass GeneratedScene(Scene):\n    def construct(self):\n        pass"

    def _extract_code(self, content: str) -> str:
        """从 LLM 响应中提取代码"""
        content = re.sub(r"ThinkingBlock\([^)]+\)", "", content)

        code_match = re.search(r"```python\n(.*?)```", content, re.DOTALL)
        if code_match:
            code = code_match.group(1).strip()
            lines = code.split("\n")
            result_lines = []
            in_main_class = False
            for line in lines:
                if line.startswith("class ") and not in_main_class:
                    in_main_class = True
                    result_lines.append(line)
                elif in_main_class:
                    if line.startswith("class "):
                        break
                    result_lines.append(line)
            if result_lines:
                code = "\n".join(result_lines).strip()
                if "def construct" in code:
                    return code
            return code

        code_match = re.search(r"class GeneratedScene\(Scene\):.*", content, re.DOTALL)
        if code_match:
            code = code_match.group(0)
            if "def construct" in code:
                return code.strip()

        return content.strip()

    def _extract_subtitles(self, content: str) -> List[Dict[str, Any]]:
        """从 LLM 响应中提取 SUBTITLES JSON 块"""
        # 先尝试匹配 ```json SUBTITLES [...] ``` 格式
        pattern = r"```json\s*SUBTITLES\s*(\[.*?\])\s*```"
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            # 兼容没有 SUBTITLES 标记的 JSON 数组
            pattern = r"```json\s*(\[.*?\])\s*```"
            match = re.search(pattern, content, re.DOTALL)
        if not match:
            # 兼容裸 JSON 数组
            pattern = r"(\\[\\s\\S]*?\"start\"\\s*:\\s*\\d+(?:\\.\\d+)?[\\s\\S]*?\\])"
            match = re.search(pattern, content, re.DOTALL)
        if not match:
            return []

        try:
            data = json.loads(match.group(1))
            if not isinstance(data, list):
                return []
            subtitles = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                start = item.get("start")
                end = item.get("end")
                text = item.get("text")
                if start is None or end is None or text is None:
                    continue
                try:
                    start_val = float(start)
                    end_val = float(end)
                except (ValueError, TypeError):
                    continue
                text_val = str(text).strip()
                if not text_val:
                    continue
                subtitles.append({"start": start_val, "end": end_val, "text": text_val})
            return subtitles
        except Exception:
            return []

    @staticmethod
    def _to_webvtt(subtitles: List[Dict[str, Any]]) -> str:
        """将字幕数组转换为 WebVTT 格式字符串"""
        if not subtitles:
            return ""

        def _format_time(seconds: float) -> str:
            """将秒数转换为 WebVTT 时间戳 HH:MM:SS.mmm"""
            seconds = max(0.0, float(seconds))
            hours = int(seconds // 3600)
            minutes = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int(round((seconds % 1) * 1000))
            if millis >= 1000:
                millis = 999
            return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"

        lines = ["WEBVTT", ""]
        for index, item in enumerate(subtitles, start=1):
            start = _format_time(item["start"])
            end = _format_time(item["end"])
            text = item["text"].replace("\n", " ").strip()
            lines.append(str(index))
            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _estimate_video_duration(code: str) -> float:
        """
        根据 Manim 代码中的动画调用估算视频总时长。

        规则：
        - self.play(..., run_time=X) -> X 秒
        - self.wait(X) -> X 秒
        - self.play(...) 未指定 run_time -> 默认 1 秒
        - 其他未识别调用按 0 秒处理（保守估算）
        """
        if not code:
            return 0.0

        def _find_call_args(code: str, method_name: str) -> List[str]:
            """查找指定方法的所有调用参数字符串（支持嵌套括号）"""
            results = []
            pattern = re.compile(rf"self\.{re.escape(method_name)}\s*\(")
            for match in pattern.finditer(code):
                start = match.end()
                depth = 1
                pos = start
                while pos < len(code) and depth > 0:
                    if code[pos] == '(':
                        depth += 1
                    elif code[pos] == ')':
                        depth -= 1
                    pos += 1
                if depth == 0:
                    results.append(code[start:pos - 1])
            return results

        total = 0.0

        for args in _find_call_args(code, "play"):
            run_time_match = re.search(r"run_time\s*=\s*([0-9]+(?:\.[0-9]+)?)", args)
            if run_time_match:
                total += float(run_time_match.group(1))
            else:
                total += 1.0

        for args in _find_call_args(code, "wait"):
            wait_match = re.search(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*$", args)
            if wait_match:
                total += float(wait_match.group(1))

        return total

    @staticmethod
    def _reconcile_subtitles(
        subtitles: List[Dict[str, Any]],
        estimated_duration: float,
        max_gap: float = 1.0,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """
        修正字幕时间轴，使其与估算的视频时长更一致。

        返回：(修正后的字幕列表, 是否发生过修正)
        """
        if not subtitles or estimated_duration <= 0:
            return subtitles, False

        adjusted = False
        result: List[Dict[str, Any]] = []

        for item in subtitles:
            start = float(item.get("start", 0.0))
            end = float(item.get("end", 0.0))
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            # 过滤完全超出估算时长的字幕
            if start >= estimated_duration:
                adjusted = True
                continue
            if end > estimated_duration:
                end = estimated_duration
                adjusted = True
            result.append({"start": start, "end": end, "text": text})

        if not result:
            return [], adjusted

        # 对相邻字幕做连续性修正：gap 过大时延长前一条
        for i in range(len(result) - 1):
            current_end = result[i]["end"]
            next_start = result[i + 1]["start"]
            if next_start > current_end + max_gap:
                result[i]["end"] = next_start
                adjusted = True

        # 最后一条字幕延长至视频估算结束
        if result[-1]["end"] < estimated_duration:
            result[-1]["end"] = estimated_duration
            adjusted = True

        return result, adjusted

    @staticmethod
    def _get_video_duration(video_path: str) -> float:
        """
        使用 ffprobe 获取视频真实时长，ffprobe 不可用时返回 0。
        """
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    video_path,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
                timeout=10,
            )
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except Exception:
            pass
        return 0.0

    def _validate_syntax(self, code: str) -> Optional[str]:
        """校验 Python 代码语法，返回错误信息或 None"""
        try:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
                f.write(code)
                temp_path = f.name
            try:
                py_compile.compile(temp_path, doraise=True)
                return None
            finally:
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
        except py_compile.PyCompileError as e:
            return str(e)
        except Exception as e:
            return str(e)

    def _save_code_file(self, code: str, temp_dir: str) -> Optional[str]:
        """保存代码到临时文件"""
        try:
            filename = "generated_scene.py"
            filepath = os.path.join(temp_dir, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(code)
            return filepath
        except Exception:
            return None

    def _render_video(
        self,
        code_file: str,
        temp_dir: str,
        res_cfg: Dict[str, Any],
        fps: int,
        cancel_event: threading.Event,
        progress_callback: Callable[[str, int], None],
    ) -> tuple:
        """渲染视频（流式读取输出并上报进度）"""
        try:
            output_filename = os.path.basename(code_file).replace(".py", "")

            cmd = [
                "manim",
                code_file,
                "GeneratedScene",
                res_cfg["quality"],
                "--fps",
                str(fps),
                "-o",
                output_filename,
                "--media_dir",
                temp_dir,
                "--disable_caching",
            ]

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=temp_dir,
                start_new_session=True,
            )

            timeout = res_cfg["timeout"]
            start_time = time.time()
            output_lines = []
            finished = threading.Event()

            def reader():
                """持续读取子进程输出"""
                try:
                    for line in process.stdout:
                        line = line.rstrip("\n")
                        output_lines.append(line)
                        if cancel_event.is_set():
                            break
                except Exception:
                    pass
                finally:
                    finished.set()

            reader_thread = threading.Thread(target=reader, daemon=True)
            reader_thread.start()

            # 进度更新循环
            last_progress_update = 0
            while not finished.is_set():
                elapsed = time.time() - start_time
                if elapsed > timeout:
                    break
                if cancel_event.is_set():
                    break

                # 每 0.5 秒更新一次进度
                if elapsed - last_progress_update >= 0.5:
                    progress = min(95, 70 + int((elapsed / timeout) * 25))
                    progress_callback(f"Manim 正在渲染视频（已用时 {int(elapsed)} 秒）", progress)
                    last_progress_update = elapsed

                time.sleep(0.1)

            # 超时或取消时结束子进程
            if process.poll() is None:
                try:
                    os.killpg(os.getpgid(process.pid), 9)
                except Exception:
                    process.kill()
            process.wait()
            reader_thread.join(timeout=2)

            full_output = "\n".join(output_lines)
            render_log = self._truncate_log(full_output)

            if cancel_event.is_set():
                return None, render_log, "任务已取消"

            if process.returncode is None or (process.returncode != 0 and not self._video_exists(temp_dir, output_filename, res_cfg)):
                # 判定为超时或渲染失败
                if process.returncode is None:
                    return None, render_log, f"渲染超时（超过 {timeout} 秒），请简化动画描述"
                error = render_log or "Unknown error during rendering"
                return None, render_log, error

            code_name = os.path.basename(code_file).replace(".py", "")
            dir_name = res_cfg["dir_name"]
            video_path = None

            possible_paths = [
                os.path.join(temp_dir, "videos", code_name, dir_name, f"{code_name}.mp4"),
                os.path.join(temp_dir, "videos", code_name, dir_name, "GeneratedScene.mp4"),
            ]

            # 尝试不同帧率目录
            for alt_dir in [dir_name, dir_name.replace("30", "15").replace("60", "30")]:
                possible_paths.append(
                    os.path.join(temp_dir, "videos", code_name, alt_dir, f"{code_name}.mp4")
                )
                possible_paths.append(
                    os.path.join(temp_dir, "videos", code_name, alt_dir, "GeneratedScene.mp4")
                )

            for path in possible_paths:
                if os.path.exists(path):
                    video_path = path
                    break

            if not video_path:
                videos_dir = os.path.join(temp_dir, "videos")
                if os.path.exists(videos_dir):
                    for root, _, files in os.walk(videos_dir):
                        for f in files:
                            if f.endswith(".mp4") and not f.startswith("partial_"):
                                video_path = os.path.join(root, f)
                                break
                        if video_path:
                            break

            if video_path:
                return video_path, render_log, None
            return None, render_log, "未找到生成的视频文件"

        except Exception as e:
            return None, str(e), str(e)

    def _video_exists(self, temp_dir: str, code_name: str, res_cfg: Dict[str, Any]) -> bool:
        """检查视频是否已经存在（用于超时但成功完成的情况）"""
        dir_name = res_cfg["dir_name"]
        possible_paths = [
            os.path.join(temp_dir, "videos", code_name, dir_name, f"{code_name}.mp4"),
            os.path.join(temp_dir, "videos", code_name, dir_name, "GeneratedScene.mp4"),
        ]
        for alt_dir in [dir_name, dir_name.replace("30", "15").replace("60", "30")]:
            possible_paths.append(
                os.path.join(temp_dir, "videos", code_name, alt_dir, f"{code_name}.mp4")
            )
            possible_paths.append(
                os.path.join(temp_dir, "videos", code_name, alt_dir, "GeneratedScene.mp4")
            )
        return any(os.path.exists(p) for p in possible_paths)

    def _truncate_log(self, log: str) -> str:
        """截断日志，避免存储过大"""
        if not log:
            return log
        if len(log) <= MAX_LOG_LENGTH:
            return log
        # 保留头部和尾部
        half = MAX_LOG_LENGTH // 2
        return log[:half] + "\n...（日志过长，已截断）...\n" + log[-half:]
