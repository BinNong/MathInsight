"""
应用配置管理

集中管理环境变量，避免在多个模块中重复加载 .env。
"""
import os
from pathlib import Path
from dotenv import load_dotenv


def _load_env():
    """加载 .env 文件（仅在未加载过时执行）"""
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)


_load_env()


class Config:
    """应用配置"""
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1', 'yes')

    # LLM API 配置
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
    ANTHROPIC_BASE_URL = os.environ.get('ANTHROPIC_BASE_URL')
    ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'deepseek-v4-pro')

    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    OPENAI_BASE_URL = os.environ.get('OPENAI_BASE_URL')

    # 数学解题助手配置
    SOLVER_MODEL = os.environ.get('SOLVER_MODEL') or ANTHROPIC_MODEL or 'deepseek-v4-pro'
    SOLVER_MAX_TOKENS = int(os.environ.get('SOLVER_MAX_TOKENS', '4000'))
    SOLVER_TEMPERATURE = float(os.environ.get('SOLVER_TEMPERATURE', '0.3'))
    SOLVER_MAX_PROBLEM_LENGTH = int(os.environ.get('SOLVER_MAX_PROBLEM_LENGTH', '2000'))

    # CORS 配置：逗号分隔的允许来源列表
    ALLOWED_ORIGINS = os.environ.get(
        'ALLOWED_ORIGINS',
        'http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000'
    )

    @classmethod
    def get_llm_api_key(cls) -> str | None:
        """获取任意配置的 LLM API 密钥"""
        return cls.ANTHROPIC_API_KEY or cls.OPENAI_API_KEY

    @classmethod
    def get_anthropic_base_url(cls) -> str | None:
        """获取 Anthropic base_url，兼容 OpenAI_BASE_URL 回退"""
        return cls.ANTHROPIC_BASE_URL or cls.OPENAI_BASE_URL
