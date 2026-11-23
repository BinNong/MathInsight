"""数说热点自动生成流水线测试（抓取 / 实算 / 回填 / 写入 / 调度）。

全部使用 mock，不依赖真实网络与 LLM。
"""
import json

import pytest

from app.config import Config
from app.services import hotspot_news
from app.services.hotspot_generator import GenerationError, HotspotGenerator
from app.services.hotspot_recipes import RECIPES, run_recipe
from app.services.hotspot_scheduler import HotspotScheduler
from app.services.hotspot_service import HotspotService


SAMPLE = {
    'id': 'hot-old', 'date': '2026-01-01', 'category': '科技', 'branch': 'calculus',
    'topic': 'x', 'headline': 'h', 'summary': 's', 'question': 'q', 'concept': 'c',
    'formula': 'f', 'formula_note': 'fn',
    'steps': [{'title': '1', 'body': 'a'}, {'title': '2', 'body': 'b'}, {'title': '3', 'body': 'c'}],
    'insight': 'i', 'figure': {'data': [{'type': 'bar'}]}, 'figure_caption': 'cap',
    'try_it': {'text': 't', 'answer': 'a'}, 'concepts': ['functions'],
    'modules': ['/limit'], 'source': 'src', 'tags': ['t'],
}


class _Block:
    type = 'text'

    def __init__(self, text):
        self.text = text


class _Resp:
    def __init__(self, payload):
        self.content = [_Block(json.dumps(payload, ensure_ascii=False))]


class _Messages:
    def __init__(self, payload):
        self.payload = payload

    def create(self, **kwargs):
        return _Resp(self.payload)


class _Client:
    def __init__(self, payload):
        self.messages = _Messages(payload)


def _make_generator(payload):
    return HotspotGenerator(api_key='fake', llm_client=_Client(payload))


def _valid_draft(**overrides):
    draft = {
        'skip': False, 'news_index': 0, 'recipe_id': 'binomial',
        'params': {'n': 23, 'p': 0.652, 'k': 15},
        'id': 'hot-20261122-test', 'category': '科技', 'topic': '二项分布',
        'headline': '标题？', 'summary': '现象。', 'question': '问题？',
        'concept': '二项分布', 'formula': 'X~B(n,p)',
        'formula_note': '命中率 {{p_pct}}。',
        'steps': [
            {'title': '1 · 建模', 'body': '命中率 {{p_pct}}。'},
            {'title': '2 · 计算', 'body': '至少15中 {{p_at_least_k}}。'},
            {'title': '3 · 结论', 'body': '期望 {{mean}}。'},
        ],
        'insight': '结论。',
        'try_it': {'text': '算 {{p_exact}}？', 'answer': '用 {{p_at_least_k}} 推理。'},
        'concepts': ['probability-basics'], 'modules': ['/probability'],
        'source': '测试源', 'tags': ['概率'],
    }
    draft.update(overrides)
    return draft


def _make_news(tmp_path):
    return hotspot_news.NewsItem(
        title='某球员 23 投 15 中', link='https://example.com/x',
        summary='一场比赛 23 投 15 中。', date='2026-11-22',
        source='测试源', category='科技',
    )


# -------- 合规过滤 --------
class TestCompliance:
    @pytest.mark.parametrize('title', [
        '总统选举结果出炉', '某地发生抗议示威', '某宗教教派集会',
        '股市明日涨停预测', '新药治愈癌症', '校园霸凌致未成年人受伤',
    ])
    def test_blocked(self, title):
        ok, reason = hotspot_news.is_compliant(title, '')
        assert not ok and reason

    def test_allowed(self):
        ok, _ = hotspot_news.is_compliant('地球捕获了一颗迷你月球', '天文学家发现新天体')
        assert ok

    def test_topic_score(self):
        assert hotspot_news.topic_score('望远镜发现新行星', 'NASA 研究') > \
               hotspot_news.topic_score('今日天气不错', '')


# -------- 计算配方 --------
class TestRecipes:
    @pytest.mark.parametrize('rid,params', [
        ('binomial', {'n': 23, 'p': 0.652, 'k': 15}),
        ('poisson', {'lam': 3.2, 'k': 5}),
        ('normal_tail', {'mu': 100, 'sigma': 15, 'threshold': 130}),
        ('power_law', {'x': [55, 61, 67, 73, 81, 89], 'y': [283, 298, 310, 325, 337, 348]}),
        ('correlation', {'x': [1, 2, 3, 4, 5], 'y': [2.1, 3.9, 6.2, 8.1, 9.8]}),
        ('exponential_growth', {'rate': 0.07, 't_end': 10}),
        ('half_life', {'half_life': 5730, 't_end': 11460}),
        ('laplacian', {'n': 5, 'edges': [[0, 1], [1, 2], [2, 3], [3, 4]]}),
        ('markov', {'matrix': [[0.9, 0.1], [0.2, 0.8]]}),
    ])
    def test_all_recipes(self, rid, params):
        assert rid in RECIPES
        result = run_recipe(rid, params)
        assert result.facts and result.figure['data']
        for trace in result.figure['data']:
            assert trace['type'] in {'scatter', 'bar', 'contour', 'heatmap'}
            assert len(trace.get('x', [])) <= 200

    def test_binomial_values_are_computed(self):
        r = run_recipe('binomial', {'n': 23, 'p': 0.652, 'k': 15})
        assert r.facts['p_pct'] == '65.2%'
        assert abs(float(r.facts['mean'].replace(',', '')) - 23 * 0.652) < 0.01

    def test_bad_params_rejected(self):
        with pytest.raises(ValueError):
            run_recipe('binomial', {'n': 5, 'p': 0.5, 'k': 99})
        with pytest.raises(ValueError):
            run_recipe('markov', {'matrix': [[0.5, 0.9], [0.2, 0.8]]})


# -------- 生成流水线 --------
class TestGenerator:
    def test_placeholders_filled(self, tmp_path):
        news = _make_news(tmp_path)
        gen = _make_generator(_valid_draft())
        item = gen.generate([news], recent=[]).item
        assert '{{' not in json.dumps(item, ensure_ascii=False)
        assert '65.2%' in item['formula_note']
        assert item['branch'] == 'probability'  # 分支由配方决定
        assert item['source_url'] == news.link

    def test_whitelist_violation_skipped(self, tmp_path):
        news = _make_news(tmp_path)
        gen = _make_generator(_valid_draft(concepts=['not-a-concept']))
        with pytest.raises(GenerationError, match='concepts 越界'):
            gen.generate([news], recent=[])

    def test_unknown_placeholder_skipped(self, tmp_path):
        news = _make_news(tmp_path)
        gen = _make_generator(_valid_draft(insight='引用 {{made_up}}'))
        with pytest.raises(GenerationError, match='未解析的占位符'):
            gen.generate([news], recent=[])

    def test_skip_honored(self, tmp_path):
        news = _make_news(tmp_path)
        gen = _make_generator({'skip': True, 'reason': '无合适选题'})
        with pytest.raises(GenerationError, match='无合适选题'):
            gen.generate([news], recent=[])

    def test_openai_protocol(self, tmp_path, monkeypatch):
        """OpenAI 兼容分支：解析 chat.completions 响应并回填占位符。"""
        class _Msg:
            def __init__(self, content):
                self.content = content
                self.reasoning_content = None

        class _Choice:
            def __init__(self, content):
                self.message = _Msg(content)
                self.finish_reason = 'stop'

        class _OACompletions:
            def create(self, **kwargs):
                assert 'messages' in kwargs
                return type('R', (), {'choices': [_Choice(json.dumps(_valid_draft(), ensure_ascii=False))]})()

        class _OAClient:
            chat = type('Chat', (), {'completions': _OACompletions()})()

        monkeypatch.setattr(Config, 'HOTSPOT_LLM_PROTOCOL', 'openai')
        news = _make_news(tmp_path)
        gen = HotspotGenerator(api_key='fake', llm_client=_OAClient(), protocol='openai')
        item = gen.generate([news], recent=[]).item
        assert gen.protocol == 'openai'
        assert '65.2%' in item['formula_note']
        assert '{{' not in json.dumps(item, ensure_ascii=False)

    def test_openai_reasoning_fallback(self, tmp_path):
        """推理模型 content 为空时，兜底取 reasoning_content。"""
        class _Msg:
            content = None
            reasoning_content = json.dumps({'skip': True, 'reason': '思考内容兜底'}, ensure_ascii=False)

        class _Choice:
            message = _Msg()
            finish_reason = 'stop'

        class _OACompletions:
            def create(self, **kwargs):
                return type('R', (), {'choices': [_Choice()]})()

        class _OAClient:
            chat = type('Chat', (), {'completions': _OACompletions()})()

        gen = HotspotGenerator(api_key='fake', llm_client=_OAClient(), protocol='openai')
        from app.services.hotspot_news import NewsItem as NI
        with pytest.raises(GenerationError, match='思考内容兜底'):
            gen.generate([_make_news(tmp_path)], recent=[])

    def test_wrong_branch_recipe_skipped(self, tmp_path):
        news = _make_news(tmp_path)
        gen = _make_generator(_valid_draft())
        with pytest.raises(GenerationError, match='分支不在允许范围'):
            gen.generate([news], recent=[], allowed_branches={'calculus'})


# -------- 原子写入 --------
class TestAppend:
    def test_append_dedup_and_cap(self, tmp_path):
        p = tmp_path / 'hotspots.json'
        p.write_text(json.dumps([SAMPLE], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(p)
        svc.append_item({**SAMPLE, 'id': 'hot-new', 'date': '2026-11-22'})
        assert len(svc.list_items()) == 2
        assert len(json.loads(p.read_text(encoding='utf-8'))) == 2
        with pytest.raises(ValueError, match='id 已存在'):
            svc.append_item({**SAMPLE, 'id': 'hot-new', 'date': '2026-11-22'})
        svc.append_item({**SAMPLE, 'id': 'hot-third', 'date': '2026-11-23'}, max_items=2)
        assert [x['id'] for x in svc.list_items()] == ['hot-third', 'hot-new']

    def test_invalid_item_rejected(self, tmp_path):
        p = tmp_path / 'hotspots.json'
        p.write_text('[]', encoding='utf-8')
        svc = HotspotService(p)
        with pytest.raises(ValueError, match='校验失败'):
            svc.append_item({'id': 'incomplete'})


# -------- 调度闭环 --------
class TestScheduler:
    def test_dry_run_does_not_write(self, tmp_path, monkeypatch):
        p = tmp_path / 'hotspots.json'
        p.write_text('[]', encoding='utf-8')
        svc = HotspotService(p)
        sched = HotspotScheduler(
            service=svc, log_dir=tmp_path,
            generator_factory=lambda: _make_generator(_valid_draft()),
        )
        monkeypatch.setattr(Config, 'HOTSPOT_DRY_RUN', True)
        result = sched.run_once()
        assert result['ok'] and result['id'] == 'hot-20261122-test'
        assert svc.list_items() == []
        assert any('dry-run' in line for line in sched.read_log())

    def test_publish_writes_and_logs(self, tmp_path, monkeypatch):
        p = tmp_path / 'hotspots.json'
        p.write_text('[]', encoding='utf-8')
        svc = HotspotService(p)
        sched = HotspotScheduler(
            service=svc, log_dir=tmp_path,
            generator_factory=lambda: _make_generator(_valid_draft()),
        )
        monkeypatch.setattr(Config, 'HOTSPOT_DRY_RUN', False)
        result = sched.run_once()
        assert result['ok']
        assert len(svc.list_items()) == 1
        assert '已发布' in '\n'.join(sched.read_log())

    def test_loop_thread_survives(self, tmp_path, monkeypatch):
        """调度线程启动后应持续存活，不能因 wait 参数错误而崩溃。"""
        import time as _time
        p = tmp_path / 'hotspots.json'
        p.write_text('[]', encoding='utf-8')
        svc = HotspotService(p)
        monkeypatch.setattr(Config, 'HOTSPOT_AUTO_ENABLED', False)
        sched = HotspotScheduler(service=svc, log_dir=tmp_path)
        sched.start()
        try:
            assert sched._thread.is_alive()
            _time.sleep(1.5)
            assert sched._thread.is_alive(), '调度线程不应在循环中退出'
        finally:
            sched.stop()

    def test_manual_content_does_not_block_today(self, tmp_path, monkeypatch):
        """历史人工内容（无 auto_generated 标记）不应误挡当日自动生成。"""
        p = tmp_path / 'hotspots.json'
        p.write_text(json.dumps([{**SAMPLE, 'id': 'hot-20261122-manual'}], ensure_ascii=False), encoding='utf-8')
        svc = HotspotService(p)
        sched = HotspotScheduler(
            service=svc, log_dir=tmp_path,
            generator_factory=lambda: _make_generator(_valid_draft()),
        )
        monkeypatch.setattr(Config, 'HOTSPOT_DRY_RUN', True)
        result = sched.run_once()
        assert result['ok'] and result['id'] == 'hot-20261122-test'

    def test_branch_rotation(self, tmp_path):
        p = tmp_path / 'hotspots.json'
        p.write_text('[]', encoding='utf-8')
        svc = HotspotService(p)
        sched = HotspotScheduler(service=svc, log_dir=tmp_path)
        recent = [
            {'branch': 'probability'}, {'branch': 'statistics'}, {'branch': 'calculus'},
        ]
        assert sched._choose_branch(recent) == {'linear-algebra'}
