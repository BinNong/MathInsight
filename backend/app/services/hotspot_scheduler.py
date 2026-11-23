"""
数说热点 · 后台自动生成调度器。

平台内部自循环：按配置的星期几/时刻，抓取近期新闻 → LLM 选题写骨架 →
Python 实算数值与图表 → 校验 → 原子写入数据卷。全程写日志，任一步失败
即跳过本次（宁缺毋滥），绝不影响主 Web 服务。

沿用 cleanup.py 的 threading.Thread + sleep 模式，零新依赖；部署形态为
gunicorn 单 worker，线程随 create_app 启动一次。
"""
import json
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from app.config import Config
from app.services import hotspot_news
from app.services.hotspot_generator import (
    GenerationError, HotspotGenerator, VALID_BRANCHES,
)
from app.services.hotspot_service import HotspotService, SEED_PATH

LOG_NAME = 'hotspot_generator.log'
LOG_MAX_LINES = 400


class HotspotScheduler:
    def __init__(
        self,
        service: HotspotService,
        log_dir: Path | None = None,
        generator_factory: Callable[[], HotspotGenerator] | None = None,
    ):
        self.service = service
        self.log_path = (log_dir or service._path.parent) / LOG_NAME
        self._generator_factory = generator_factory or HotspotGenerator
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._state_lock = threading.Lock()
        self._last_run: str | None = None
        self._last_status: str = 'idle'
        self._last_detail: str = ''

    # -------- 日志 --------
    def log(self, level: str, message: str) -> None:
        line = f'{datetime.now().isoformat(timespec="seconds")} [{level}] {message}'
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_path, 'a', encoding='utf-8') as f:
                f.write(line + '\n')
            self._trim_log()
        except OSError:
            pass

    def _trim_log(self) -> None:
        try:
            lines = self.log_path.read_text(encoding='utf-8').splitlines()
            if len(lines) > LOG_MAX_LINES:
                self.log_path.write_text('\n'.join(lines[-LOG_MAX_LINES:]) + '\n', encoding='utf-8')
        except OSError:
            pass

    def read_log(self, limit: int = 80) -> list[str]:
        try:
            lines = self.log_path.read_text(encoding='utf-8').splitlines()
            return lines[-limit:]
        except OSError:
            return []

    def status(self) -> dict[str, Any]:
        with self._state_lock:
            return {
                'enabled': Config.HOTSPOT_AUTO_ENABLED,
                'dry_run': Config.HOTSPOT_DRY_RUN,
                'weekdays': Config.HOTSPOT_AUTO_WEEKDAYS,
                'scheduled_at': f'{Config.HOTSPOT_AUTO_HOUR:02d}:{Config.HOTSPOT_AUTO_MINUTE:02d}',
                'running': bool(self._thread and self._thread.is_alive()),
                'last_run': self._last_run,
                'last_status': self._last_status,
                'last_detail': self._last_detail,
                'total_items': self.service.meta()['total'],
            }

    # -------- 调度 --------
    def _should_run_today(self, now: datetime) -> bool:
        if not Config.HOTSPOT_AUTO_ENABLED:
            return False
        try:
            days = {int(x.strip()) for x in Config.HOTSPOT_AUTO_WEEKDAYS.split(',') if x.strip() != ''}
        except ValueError:
            days = {0, 2, 4}
        return now.weekday() in days

    def _next_run_time(self, now: datetime) -> datetime:
        target = now.replace(
            hour=Config.HOTSPOT_AUTO_HOUR, minute=Config.HOTSPOT_AUTO_MINUTE,
            second=0, microsecond=0,
        )
        if target <= now:
            target += timedelta(days=1)
        return target

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self.log('INFO', f'调度器启动 enabled={Config.HOTSPOT_AUTO_ENABLED} '
                         f'dry_run={Config.HOTSPOT_DRY_RUN} '
                         f'weekdays={Config.HOTSPOT_AUTO_WEEKDAYS} '
                         f'at={Config.HOTSPOT_AUTO_HOUR:02d}:{Config.HOTSPOT_AUTO_MINUTE:02d}')
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name='hotspot-auto')
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            now = datetime.now()
            if not self._should_run_today(now):
                # 非计划日：睡 30 分钟再检查，避免忙等
                self._stop.wait(timeout=30 * 60)
                continue
            target = self._next_run_time(now)
            wait = (target - now).total_seconds()
            if self._stop.wait(timeout=max(wait, 1)):
                break
            try:
                self.run_once()
            except Exception as e:
                self.log('ERROR', f'自动生成未捕获异常: {type(e).__name__}: {e}')
            # 完成后睡到下次重试/次日同一时刻，避免当天重复触发
            self._stop.wait(timeout=max(Config.HOTSPOT_RETRY_MINUTES, 60) * 60)

    # -------- 单次执行 --------
    def run_once(self) -> dict[str, Any]:
        """执行一次完整生成流程，返回状态字典（供手动触发接口复用）。"""
        started = datetime.now()
        self.log('INFO', '开始一次自动生成')
        with self._state_lock:
            self._last_run = started.isoformat(timespec='seconds')
            self._last_status = 'running'

        result = {'ok': False, 'reason': ''}
        try:
            items = self.service.list_items()
            # 只认平台自动生成且带标记的条目，避免历史人工内容误挡当日生成
            today_prefix = f'hot-{started.strftime("%Y%m%d")}-'
            already = any(
                it.get('auto_generated') and it.get('id', '').startswith(today_prefix)
                for it in self.service.get_all_items()
            )
            if already:
                result = {'ok': True, 'reason': '今日已生成，跳过'}
                self.log('INFO', result['reason'])
            else:
                result = self._generate_and_publish(started, items)
        except GenerationError as e:
            result = {'ok': False, 'reason': str(e)}
            self.log('SKIP', str(e))
        except Exception as e:
            result = {'ok': False, 'reason': f'{type(e).__name__}: {e}'}
            self.log('ERROR', str(e))

        with self._state_lock:
            self._last_status = 'ok' if result['ok'] else 'skipped'
            self._last_detail = result['reason']
        self.log('INFO' if result['ok'] else 'WARN',
                 f'本次结束 ok={result["ok"]} reason={result["reason"]}')
        return result

    def _choose_branch(self, items: list[dict[str, Any]]) -> set[str]:
        """分支轮换：优先选最近 3 篇没用过的分支，宁缺毋滥。"""
        recent_branches = [it.get('branch') for it in items[:3] if it.get('branch')]
        fresh = VALID_BRANCHES - set(recent_branches)
        return fresh if fresh else VALID_BRANCHES

    def _generate_and_publish(
        self, started: datetime, items: list[dict[str, Any]],
    ) -> dict[str, Any]:
        seen_titles = set()
        for it in items:
            key = ''.join(c for c in it.get('headline', '').lower() if c.isalnum())
            if key:
                seen_titles.add(key)

        candidates = hotspot_news.fetch_candidates(seen_titles=seen_titles)
        if not candidates:
            raise GenerationError('无合规候选新闻')

        allowed = self._choose_branch(items)
        generator = self._generator_factory()
        gen_result = generator.generate(
            candidates=candidates, recent=items[:3], allowed_branches=allowed,
        )
        item = gen_result.item
        item['auto_generated'] = True

        # 再过一遍官方校验器（与 scripts/validate_hotspots.py 同规则）
        from app.services.hotspot_service import HotspotService as HS
        errs = HS.validate_item(item)
        if errs:
            raise GenerationError('成稿校验失败: ' + '; '.join(errs))

        # 发布日期与候选新闻对齐，确保「今日已生成」判断稳定
        item['date'] = item['date'] or started.strftime('%Y-%m-%d')

        if Config.HOTSPOT_DRY_RUN:
            self.log('INFO', f'dry-run 生成成功，不写入: {item["id"]} / {item["headline"]}')
            return {'ok': True, 'reason': f'dry-run: {item["id"]}', 'id': item['id']}

        self.service.append_item(item, max_items=Config.HOTSPOT_MAX_ITEMS)
        self.log('INFO', f'已发布 {item["id"]} | 分支={item["branch"]} | '
                         f'配方={gen_result.recipe_id} | 来源={gen_result.source_news.source}')
        return {'ok': True, 'reason': f'已发布 {item["id"]}', 'id': item['id']}


_scheduler: HotspotScheduler | None = None
_scheduler_lock = threading.Lock()


def get_hotspot_scheduler() -> HotspotScheduler:
    global _scheduler
    if _scheduler is None:
        with _scheduler_lock:
            if _scheduler is None:
                from app.services.hotspot_service import get_hotspot_service
                _scheduler = HotspotScheduler(
                    service=get_hotspot_service(),
                    log_dir=get_hotspot_service()._path.parent if get_hotspot_service()._path.parent.exists() else None,
                )
    return _scheduler
