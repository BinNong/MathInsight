"""
Manim 动画生成任务管理器

提供任务状态维护、取消机制、近期任务列表与可选的文件持久化。
设计为单例，便于在 Flask 单实例或多线程环境中共享状态；
文件持久化为多 worker 部署提供状态查询能力。
"""
import concurrent.futures
import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class TaskStatus(str, Enum):
    PENDING = "PENDING"
    GENERATING = "GENERATING"      # LLM 正在生成或修复代码
    RENDERING = "RENDERING"        # manim 正在渲染
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


@dataclass
class ManimTask:
    task_id: str
    description: str
    resolution: str
    fps: int
    status: TaskStatus = TaskStatus.PENDING
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    cancel_event: threading.Event = field(default_factory=threading.Event)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    iterations: int = 0
    stage_message: str = "等待开始"
    generated_code: Optional[str] = None
    render_log: Optional[str] = None
    progress_percent: int = 0
    cache_hit: bool = False

    def to_dict(self, include_cancel: bool = False) -> Dict[str, Any]:
        data = {
            "task_id": self.task_id,
            "description": self.description,
            "resolution": self.resolution,
            "fps": self.fps,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "iterations": self.iterations,
            "stage_message": self.stage_message,
            "result": self.result,
            "error": self.error,
            "generated_code": self.generated_code,
            "render_log": self.render_log,
            "progress_percent": self.progress_percent,
            "cache_hit": self.cache_hit,
        }
        if include_cancel:
            data["cancelled"] = self.cancel_event.is_set()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ManimTask":
        """从字典重建任务对象（取消事件会丢失，仅用于持久化查询）"""
        task = cls(
            task_id=data["task_id"],
            description=data["description"],
            resolution=data["resolution"],
            fps=data["fps"],
            status=TaskStatus(data.get("status", "PENDING")),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            result=data.get("result"),
            error=data.get("error"),
            iterations=data.get("iterations", 0),
            stage_message=data.get("stage_message", ""),
            generated_code=data.get("generated_code"),
            render_log=data.get("render_log"),
            progress_percent=data.get("progress_percent", 0),
            cache_hit=data.get("cache_hit", False),
        )
        # 若持久化状态为未完成，标记为 FAILED，避免查询到悬停任务
        if task.status not in (TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.CANCELLED):
            task.status = TaskStatus.FAILED
            task.stage_message = "服务重启后任务状态丢失"
            task.error = "服务重启后任务状态丢失"
        return task


class ManimTaskManager:
    """Manim 任务管理器（线程安全，可选文件持久化）"""

    def __init__(self, max_history: int = 100, persist_dir: Optional[str] = None):
        self._tasks: Dict[str, ManimTask] = {}
        self._lock = threading.Lock()
        self._max_history = max_history
        self._persist_dir = persist_dir
        if persist_dir:
            os.makedirs(persist_dir, exist_ok=True)

    def create_task(self, description: str, resolution: str = "720p", fps: int = 30) -> ManimTask:
        task_id = f"manim_{uuid.uuid4().hex[:12]}"
        task = ManimTask(
            task_id=task_id,
            description=description,
            resolution=resolution,
            fps=fps,
        )
        with self._lock:
            self._tasks[task_id] = task
            self._trim_history()
        self._persist_task(task)
        return task

    def get_task(self, task_id: str) -> Optional[ManimTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                return task
        # 内存未命中时尝试从持久化文件加载
        return self._load_task(task_id)

    def update_task(
        self,
        task_id: str,
        status: Optional[TaskStatus] = None,
        stage_message: Optional[str] = None,
        iterations: Optional[int] = None,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        generated_code: Optional[str] = None,
        render_log: Optional[str] = None,
        progress_percent: Optional[int] = None,
        cache_hit: Optional[bool] = None,
    ) -> Optional[ManimTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            if status is not None:
                task.status = status
            if stage_message is not None:
                task.stage_message = stage_message
            if iterations is not None:
                task.iterations = iterations
            if result is not None:
                task.result = result
            if error is not None:
                task.error = error
            if generated_code is not None:
                task.generated_code = generated_code
            if render_log is not None:
                task.render_log = render_log
            if progress_percent is not None:
                task.progress_percent = max(0, min(100, progress_percent))
            if cache_hit is not None:
                task.cache_hit = cache_hit
            task.updated_at = time.time()
            self._persist_task(task)
            return task

    def cancel_task(self, task_id: str) -> Optional[ManimTask]:
        with self._lock:
            task = self._tasks.get(task_id)
            if not task:
                return None
            task.cancel_event.set()
            if task.status not in (TaskStatus.SUCCESS, TaskStatus.FAILED, TaskStatus.CANCELLED):
                task.status = TaskStatus.CANCELLED
                task.stage_message = "用户已取消"
            task.updated_at = time.time()
            self._persist_task(task)
            return task

    def list_recent_tasks(self, limit: int = 20) -> List[Dict[str, Any]]:
        with self._lock:
            tasks = sorted(
                self._tasks.values(),
                key=lambda t: t.created_at,
                reverse=True,
            )
        return [t.to_dict() for t in tasks[:limit]]

    def enable_persistence(self, persist_dir: str):
        """启用文件持久化后端"""
        self._persist_dir = persist_dir
        os.makedirs(persist_dir, exist_ok=True)

    def _trim_history(self):
        """保留最近 N 条任务，避免内存无限增长"""
        if len(self._tasks) <= self._max_history:
            return
        sorted_tasks = sorted(self._tasks.items(), key=lambda kv: kv[1].created_at)
        overflow = len(sorted_tasks) - self._max_history
        for task_id, _ in sorted_tasks[:overflow]:
            self._tasks.pop(task_id, None)

    def _persist_task(self, task: ManimTask):
        """将任务快照写入持久化文件"""
        if not self._persist_dir:
            return
        try:
            filepath = os.path.join(self._persist_dir, f"{task.task_id}.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(task.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception:
            # 持久化失败不应影响主流程
            pass

    def _load_task(self, task_id: str) -> Optional[ManimTask]:
        """从持久化文件加载任务"""
        if not self._persist_dir:
            return None
        filepath = os.path.join(self._persist_dir, f"{task_id}.json")
        if not os.path.exists(filepath):
            return None
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            task = ManimTask.from_dict(data)
            with self._lock:
                self._tasks[task_id] = task
            return task
        except Exception:
            return None


class ManimExecutor:
    """
    Manim 渲染执行器

    使用 ThreadPoolExecutor 限制单进程内并发渲染任务数量，避免无限制创建
    后台线程和 Manim 子进程导致资源耗尽。
    """

    def __init__(self, max_workers: int = 2):
        self._max_workers = max(1, max_workers)
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=self._max_workers,
            thread_name_prefix="manim_worker",
        )
        self._lock = threading.Lock()
        self._running: Dict[str, concurrent.futures.Future] = {}

    @property
    def max_workers(self) -> int:
        return self._max_workers

    @property
    def active_count(self) -> int:
        with self._lock:
            # 清理已完成的任务
            self._running = {
                tid: future for tid, future in self._running.items()
                if not future.done()
            }
            return len(self._running)

    def submit(self, task_id: str, fn: Callable, *args, **kwargs) -> Optional[concurrent.futures.Future]:
        """
        提交任务到线程池。

        若当前活跃任务数已达上限，返回 None，由调用方决定排队或拒绝。
        """
        with self._lock:
            self._running = {
                tid: future for tid, future in self._running.items()
                if not future.done()
            }
            if len(self._running) >= self._max_workers:
                return None

            future = self._executor.submit(fn, *args, **kwargs)
            self._running[task_id] = future
            return future

    def shutdown(self, wait: bool = False):
        self._executor.shutdown(wait=wait)


# 全局单例（未启用持久化，保持与旧版一致）
task_manager = ManimTaskManager()

# 全局执行器：默认最多同时渲染 2 个视频
manim_executor = ManimExecutor(max_workers=2)
