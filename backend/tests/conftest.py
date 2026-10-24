import pytest
import sys
import os

# 确保测试时能正确导入 backend 模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app


@pytest.fixture
def app():
    """创建测试用 Flask 应用实例"""
    app = create_app()
    app.config.update({
        'TESTING': True,
    })
    yield app


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return app.test_client()
