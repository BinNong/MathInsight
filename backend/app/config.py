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

    # 「数说热点」自动生成配置
    # 总开关：false 时完全停用后台自动生成（只读展示现有内容）
    HOTSPOT_AUTO_ENABLED = os.environ.get('HOTSPOT_AUTO_ENABLED', 'true').lower() in ('true', '1', 'yes')
    # 每周自动生成的星期几，逗号分隔 0=周一 ... 6=周日，默认周一/三/五
    HOTSPOT_AUTO_WEEKDAYS = os.environ.get('HOTSPOT_AUTO_WEEKDAYS', '0,2,4')
    # 生成器每天尝试的时刻（小时:分钟，服务器本地时区），默认 09:00
    HOTSPOT_AUTO_HOUR = int(os.environ.get('HOTSPOT_AUTO_HOUR', '9'))
    HOTSPOT_AUTO_MINUTE = int(os.environ.get('HOTSPOT_AUTO_MINUTE', '0'))
    # 生成失败的重试间隔（分钟），默认每 6 小时重试一次当天尚未成功的任务
    HOTSPOT_RETRY_MINUTES = int(os.environ.get('HOTSPOT_RETRY_MINUTES', '360'))
    # dry-run：true 时只生成并写日志，不写入内容库
    HOTSPOT_DRY_RUN = os.environ.get('HOTSPOT_DRY_RUN', 'false').lower() in ('true', '1', 'yes')
    # 生成内容专属模型（留空则复用 SOLVER_MODEL）
    HOTSPOT_MODEL = os.environ.get('HOTSPOT_MODEL') or ''
    # LLM 协议与专用端点：anthropic（默认，复用现有配置）或 openai（OpenAI 兼容网关）
    HOTSPOT_LLM_PROTOCOL = os.environ.get('HOTSPOT_LLM_PROTOCOL', 'anthropic').lower()
    # 专用密钥/端点（留空则按协议回退到 ANTHROPIC_* / OPENAI_* 通用配置）
    HOTSPOT_LLM_API_KEY = os.environ.get('HOTSPOT_LLM_API_KEY') or ''
    HOTSPOT_LLM_BASE_URL = os.environ.get('HOTSPOT_LLM_BASE_URL') or ''
    # 内容库最多保留篇数，超出丢弃最旧的（0 表示不限制）
    HOTSPOT_MAX_ITEMS = int(os.environ.get('HOTSPOT_MAX_ITEMS', '0'))
    # 运行日志文件路径（相对数据目录）
    HOTSPOT_LOG_NAME = 'hotspot_generator.log'

    # CORS 配置：逗号分隔的允许来源列表
    ALLOWED_ORIGINS = os.environ.get(
        'ALLOWED_ORIGINS',
        'http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000'
    )

    # 账号系统配置
    # SECRET_KEY 用于签名登录令牌；未设置时 auth 模块会生成并持久化随机密钥
    SECRET_KEY = os.environ.get('SECRET_KEY')
    # 登录令牌有效期（秒），默认 30 天
    TOKEN_MAX_AGE = int(os.environ.get('TOKEN_MAX_AGE', str(30 * 24 * 3600)))

    @classmethod
    def get_llm_api_key(cls) -> str | None:
        """获取任意配置的 LLM API 密钥"""
        return cls.ANTHROPIC_API_KEY or cls.OPENAI_API_KEY

    @classmethod
    def get_anthropic_base_url(cls) -> str | None:
        """获取 Anthropic base_url，兼容 OpenAI_BASE_URL 回退"""
        return cls.ANTHROPIC_BASE_URL or cls.OPENAI_BASE_URL
