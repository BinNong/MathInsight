"""数说热点内容服务与接口测试。"""
import json
from pathlib import Path

from app.services.hotspot_service import HotspotService, DATA_PATH


class TestHotspotService:
    def test_all_content_valid(self):
        items = json.loads(DATA_PATH.read_text(encoding='utf-8'))
        assert len(items) >= 4
        for item in items:
            assert HotspotService.validate_item(item) == [], item['id']

    def test_unique_ids_and_dates(self):
        items = json.loads(DATA_PATH.read_text(encoding='utf-8'))
        ids = [it['id'] for it in items]
        assert len(ids) == len(set(ids)), '内容 id 必须唯一'
        for it in items:
            assert len(it['date']) == 10, it['id']

    def test_list_sorted_and_summary(self):
        svc = HotspotService()
        items = svc.list_items()
        dates = [it['date'] for it in items]
        assert dates == sorted(dates, reverse=True)
        assert all('figure' not in it and 'formula' not in it for it in items)

    def test_filters(self):
        svc = HotspotService()
        assert svc.list_items(branch='probability')
        assert svc.list_items(category='体育')
        assert svc.list_items(search='举重')
        assert svc.list_items(search='不存在的关键词zzz') == []
        assert len(svc.list_items(limit=2)) == 2

    def test_detail_and_meta(self):
        svc = HotspotService()
        detail = svc.get_item('hot-20261117-robot-sync')
        assert detail and len(detail['steps']) == 3
        assert detail['figure']['data']
        assert svc.get_item('missing') is None
        meta = svc.meta()
        assert meta['total'] >= 4
        assert 'linear-algebra' in meta['branches']

    def test_validation_catches_bad_content(self):
        errors = HotspotService.validate_item({
            'id': 'x', 'branch': 'unknown', 'figure': {'data': [{'type': 'pie'}]},
        })
        assert any('缺少字段' in e for e in errors)
        assert any('未知数学分支' in e for e in errors)
        assert any('不支持的图表类型' in e for e in errors)


class TestHotspotRoutes:
    def test_list_route(self, client):
        resp = client.get('/api/hotspots')
        assert resp.status_code == 200
        data = resp.get_json()['data']
        assert data['total'] >= 4
        assert 'figure' not in data['items'][0]

    def test_meta_route(self, client):
        resp = client.get('/api/hotspots/meta')
        assert resp.status_code == 200
        assert resp.get_json()['data']['total'] >= 4

    def test_detail_route(self, client):
        resp = client.get('/api/hotspots/hot-20261122-nba-empty-carriage')
        assert resp.status_code == 200
        assert resp.get_json()['data']['branch'] == 'probability'

    def test_detail_not_found(self, client):
        assert client.get('/api/hotspots/nope').status_code == 404

    def test_branch_filter_route(self, client):
        resp = client.get('/api/hotspots?branch=calculus')
        data = resp.get_json()['data']
        assert data['total'] >= 1
        assert all(it['branch'] == 'calculus' for it in data['items'])
