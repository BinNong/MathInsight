"""数说热点视频生产任务接口测试。"""
import json

from app.services.hotspot_service import HotspotService


def _sample():
    return {
        'id': 'video-test-1', 'date': '2026-11-23', 'category': '天文',
        'branch': 'calculus', 'topic': 't', 'headline': '测试标题',
        'summary': '摘要', 'question': '问题？', 'concept': '概念',
        'formula': 'x=1', 'formula_note': '说明',
        'steps': [{'title': '1 · a', 'body': 'b'}],
        'insight': '结论', 'figure': {'data': []}, 'figure_caption': '图注',
        'try_it': {'text': '试试', 'answer': '答案'},
        'concepts': [], 'modules': [], 'source': 'test', 'tags': [],
    }


class TestVideoTaskService:
    def test_pending_video_lists_items_without_video(self, tmp_path):
        path = tmp_path / 'hotspots.json'
        path.write_text(json.dumps([_sample()], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(path)
        assert [it['id'] for it in svc.items_missing_video()] == ['video-test-1']

        svc.mark_video('video-test-1', {'url': '/x.mp4', 'duration': 90.5, 'caption': '/x.vtt'})
        assert svc.items_missing_video() == []
        assert svc.get_item('video-test-1')['video']['url'] == '/x.mp4'

    def test_mark_video_atomic_and_filters_fields(self, tmp_path):
        path = tmp_path / 'hotspots.json'
        path.write_text(json.dumps([_sample()], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(path)

        updated = svc.mark_video('video-test-1', {
            'url': '/a.mp4', 'duration': '12.5', 'caption': '/a.vtt', 'evil': 'drop',
        })
        assert updated['video'] == {'url': '/a.mp4', 'duration': 12.5, 'caption': '/a.vtt'}
        # 重新加载确认落盘
        assert HotspotService(path).get_item('video-test-1')['video']['url'] == '/a.mp4'

    def test_mark_video_rejects_bad_input(self, tmp_path):
        path = tmp_path / 'hotspots.json'
        path.write_text(json.dumps([_sample()], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(path)
        for bad in [('', {'url': '/x'}), ('video-test-1', {}),
                    ('video-test-1', {'url': '/x', 'duration': 'abc'}),
                    ('nope', {'url': '/x'})]:
            try:
                svc.mark_video(*bad)
            except ValueError:
                pass
            else:
                raise AssertionError(f'应拒绝: {bad}')

    def test_mark_video_idempotent(self, tmp_path):
        path = tmp_path / 'hotspots.json'
        path.write_text(json.dumps([_sample()], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(path)
        svc.mark_video('video-test-1', {'url': '/x.mp4', 'duration': 10})
        mtime_before = path.stat().st_mtime
        svc.mark_video('video-test-1', {'url': '/x.mp4', 'duration': 10})
        assert path.stat().st_mtime == mtime_before, '重复登记不应触发写入'


class TestVideoTaskRoutes:
    def test_pending_video_requires_admin(self, client):
        assert client.get('/api/hotspots/admin/pending-video').status_code == 401

    def test_register_video_requires_admin(self, client):
        r = client.post('/api/hotspots/admin/video', json={'id': 'x', 'video': {'url': '/x'}})
        assert r.status_code == 401
