import pytest
import sys
import os
import tempfile
from pathlib import Path

# 确保测试时能正确导入 backend 模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, auth


@pytest.fixture
def app(monkeypatch):
    """创建测试用 Flask 应用实例，使用隔离的临时数据库。"""
    # 将账号数据库与密钥重定向到临时目录，避免测试污染真实数据
    tmp_dir = Path(tempfile.mkdtemp(prefix='mathinsight_test_'))
    monkeypatch.setattr(auth, 'DB_PATH', tmp_dir / 'test.db')
    monkeypatch.setattr(auth, 'DATA_DIR', tmp_dir)
    monkeypatch.setattr(auth, 'SECRET_KEY_PATH', tmp_dir / 'secret_key')

    app = create_app()
    app.config.update({
        'TESTING': True,
        # 默认跳过鉴权，便于既有业务测试聚焦自身逻辑；
        # 认证测试通过 fixture 覆盖为 False 以真实验证守卫。
        'TESTING_SKIP_AUTH': True,
    })
    yield app


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return app.test_client()
