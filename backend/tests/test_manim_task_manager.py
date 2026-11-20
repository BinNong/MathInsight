import os
import time

from app.services.manim_task_manager import ManimTaskManager, TaskStatus
from app.utils.cleanup import cleanup_manim_temp_files


def test_update_task_can_clear_fields_and_persists_them(tmp_path):
    manager = ManimTaskManager(persist_dir=str(tmp_path))
    task = manager.create_task('测试任务')
    manager.update_task(
        task.task_id,
        status=TaskStatus.SUCCESS,
        error='旧错误',
        generated_code='旧代码',
        render_log='旧日志',
    )

    manager.update_task(task.task_id, error=None, generated_code=None, render_log=None)

    restored = ManimTaskManager(persist_dir=str(tmp_path)).get_task(task.task_id)
    assert restored is not None
    assert restored.error is None
    assert restored.generated_code is None
    assert restored.render_log is None


def test_cleanup_removes_only_expired_task_metadata(tmp_path):
    tasks_dir = tmp_path / '.tasks'
    tasks_dir.mkdir()
    old_task = tasks_dir / 'manim_old.json'
    recent_task = tasks_dir / 'manim_recent.json'
    old_task.write_text('{}', encoding='utf-8')
    recent_task.write_text('{}', encoding='utf-8')
    expired = time.time() - 3 * 3600
    os.utime(old_task, (expired, expired))

    removed = cleanup_manim_temp_files(str(tmp_path), max_age_hours=1)

    assert removed == 1
    assert not old_task.exists()
    assert recent_task.exists()
