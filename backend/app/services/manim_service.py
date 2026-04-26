"""
Manim 动画生成服务
使用 LLM 生成 Manim 代码并渲染视频
"""
import os
import uuid
import subprocess
import re
from typing import Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

import anthropic

# 临时文件目录
DOWNLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'downloads')
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# Manim 场景代码模板
MANIM_TEMPLATE = '''from manim import *

class GeneratedScene(Scene):
    def construct(self):
{code}
'''

class ManimService:
    """Manim 动画生成服务类"""

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: str = "claude-sonnet-4-20250514"):
        """
        初始化服务

        Args:
            api_key: LLM API 密钥（可选，从环境变量读取）
            base_url: API 基础 URL（用于兼容 OpenAI 兼容接口）
            model: 使用的模型名称
        """
        # 从环境变量读取API密钥
        if not api_key:
            api_key = os.environ.get('ANTHROPIC_API_KEY') or os.environ.get('OPENAI_API_KEY')
        base_url = os.environ.get('ANTHROPIC_BASE_URL')

        # 支持自定义 base_url（如 MiniMax）
        if base_url:
            self.client = anthropic.Anthropic(api_key=api_key, base_url=base_url)
        else:
            self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.max_iterations = 10

    def generate_animation(self, description: str, resolution: str = "720p", fps: int = 30) -> Dict[str, Any]:
        """
        生成 Manim 动画

        Args:
            description: 用户描述
            resolution: 分辨率 (720p, 1080p, 4k)
            fps: 帧率

        Returns:
            dict: 包含 video_url, iterations, message
        """
        # 解析分辨率
        resolution_map = {
            "720p": "1280x720",
            "1080p": "1920x1080",
            "4k": "3840x2160"
        }
        resolution_str = resolution_map.get(resolution, "1280x720")

        # 生成代码
        iterations = 0
        last_error = None

        for iteration in range(1, self.max_iterations + 1):
            iterations = iteration

            if iteration == 1:
                # 第一次生成
                code = self._generate_code(description)
            else:
                # 修复错误
                code = self._fix_code(description, last_error)

            # 保存代码到文件
            code_file = self._save_code_file(code)
            if not code_file:
                last_error = "Failed to save code file"
                continue

            # 尝试渲染
            video_path, error = self._render_video(code_file, resolution_str, fps)

            if video_path and os.path.exists(video_path):
                # 成功
                relative_path = f"/downloads/{os.path.basename(video_path)}"
                return {
                    "success": True,
                    "video_url": relative_path,
                    "iterations": iterations,
                    "message": "生成成功"
                }

            last_error = error or "Unknown error"

        # 超过最大迭代次数
        return {
            "success": False,
            "error": "尝试多次仍失败，请简化描述",
            "iterations": iterations
        }

    def _generate_code(self, description: str) -> str:
        """使用 LLM 生成 Manim 代码"""
        prompt = f"""你是一个Manim动画专家。根据用户描述生成可运行的Manim Python代码。

要求：
1. 只输出Python代码，不要其他解释
2. 使用Manim Community版本 (from manim import *)
3. 代码要完整可运行
4. 画面要美观，适合教学演示
5. 场景类名必须是 GeneratedScene，继承 Scene
6. 注意：不要在类内部再定义其他类！只定义一个类！

用户描述：{description}

生成的代码："""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system="你是一个Manim动画专家，擅长生成高质量的数学动画代码。",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        # 提取文本内容（跳过ThinkingBlock）
        content = ""
        for block in response.content:
            if hasattr(block, 'type') and block.type == 'text':
                content = block.text
                break
            elif hasattr(block, 'text'):
                content = block.text

        if not content:
            return "from manim import *\n\nclass GeneratedScene(Scene):\n    def construct(self):\n        pass"

        code = self._extract_code(content)
        # 确保类名是 GeneratedScene
        code = re.sub(r'class \w+\(Scene\):', 'class GeneratedScene(Scene):', code)

        # 确保有 manim 导入
        if 'from manim import' not in code:
            code = 'from manim import *\n\n' + code

        return code

    def _fix_code(self, description: str, error: str) -> str:
        """使用 LLM 修复代码错误"""
        prompt = f"""上次生成的代码执行失败，错误信息如下：
{error}

用户原始描述：{description}

请修复上述问题，重新生成可运行的Manim代码。
只输出Python代码，不要其他解释。
场景类名必须是 GeneratedScene，继承 Scene。

修复后的代码："""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4000,
            system="你是一个Manim动画专家，擅长修复代码错误。",
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )

        # 提取文本内容（跳过ThinkingBlock）
        content = ""
        for block in response.content:
            if hasattr(block, 'type') and block.type == 'text':
                content = block.text
                break
            elif hasattr(block, 'text'):
                content = block.text

        if not content:
            return "from manim import *\n\nclass GeneratedScene(Scene):\n    def construct(self):\n        pass"

        code = self._extract_code(content)
        # 确保类名是 GeneratedScene
        code = re.sub(r'class \w+\(Scene\):', 'class GeneratedScene(Scene):', code)

        # 确保有 manim 导入
        if 'from manim import' not in code:
            code = 'from manim import *\n\n' + code

        return code

    def _extract_code(self, content: str) -> str:
        """从 LLM 响应中提取代码"""
        # 移除 ThinkingBlock（MiniMax模型的思考过程）
        content = re.sub(r"ThinkingBlock\([^)]+\)", "", content)

        # 尝试找到代码块
        code_match = re.search(r'```python\n(.*?)```', content, re.DOTALL)
        if code_match:
            code = code_match.group(1).strip()
            
            # 找到第一个出现在行首的 class（不在其他缩进内）
            lines = code.split('\n')
            result_lines = []
            in_main_class = False
            for line in lines:
                # 如果是顶级的 class 定义
                if line.startswith('class ') and not in_main_class:
                    in_main_class = True
                    result_lines.append(line)
                elif in_main_class:
                    # 如果遇到另一个顶级的 class，停止
                    if line.startswith('class '):
                        break
                    result_lines.append(line)
            if result_lines:
                code = '\n'.join(result_lines).strip()
                # 确保有正确的缩进
                if 'def construct' in code:
                    return code
            return code

        # 如果没有代码块，尝试找类定义
        code_match = re.search(r'class GeneratedScene\(Scene\):.*', content, re.DOTALL)
        if code_match:
            code = code_match.group(0)
            # 确保代码完整（包含整个construct方法）
            if 'def construct' in code:
                return code.strip()

        # 直接返回内容（移除多余空白）
        return content.strip()

    def _save_code_file(self, code: str) -> Optional[str]:
        """保存代码到临时文件"""
        try:

            # 直接使用 LLM 返回的代码（已经包含完整的类定义）
            # 不再使用 MANIM_TEMPLATE 避免嵌套类
            full_code = code

            # 保存到临时文件
            filename = f"manim_{uuid.uuid4().hex[:8]}.py"
            filepath = os.path.join(DOWNLOADS_DIR, filename)

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_code)

            return filepath
        except Exception as e:
                        return None

    def _indent_code(self, code: str, spaces: int) -> str:
        """为代码添加缩进"""
        lines = code.split('\n')
        indented_lines = []
        for line in lines:
            if line.strip():
                indented_lines.append(' ' * spaces + line)
            else:
                indented_lines.append(line)
        return '\n'.join(indented_lines)

    def _render_video(self, code_file: str, resolution: str, fps: int) -> tuple:
        """渲染视频"""
        try:
            # manim 会在当前工作目录创建 media 文件夹
            # 使用 code_file 所在目录作为工作目录
            work_dir = os.path.dirname(code_file)
            output_filename = os.path.basename(code_file).replace('.py', '')
            output_dir = work_dir  # manim 会在此目录下创建 media/videos/

            # 使用低质量模式渲染 (-ql = low quality, 快速测试)
            # 注意：Manim v0.20+ 不支持 -r 分辨率参数，使用默认分辨率
            cmd = [
                "manim",
                code_file,
                "GeneratedScene",
                "-ql",  # 低质量快速渲染
                "--fps", str(fps),
                "-o", output_filename,
                "--media_dir", output_dir,
                "--disable_caching"
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # 2分钟超时
            )

            # 检查是否成功
            if result.returncode == 0:
                # 查找生成的视频文件 - manim 使用文件名作为目录名
                code_name = os.path.basename(code_file).replace('.py', '')
                # manim v0.20+ 使用 480p30 作为低质量默认分辨率
                possible_paths = [
                    os.path.join(output_dir, "videos", code_name, "480p30", f"{code_name}.mp4"),
                    os.path.join(output_dir, "videos", code_name, "480p30", "GeneratedScene.mp4"),
                    os.path.join(output_dir, "videos", code_name, "480p15", f"{code_name}.mp4"),
                    os.path.join(output_dir, "videos", code_name, "480p15", "GeneratedScene.mp4"),
                ]
                for video_path in possible_paths:
                    if os.path.exists(video_path):
                        # 复制到 DOWNLOADS_DIR 以便提供下载
                        import shutil
                        dest_path = os.path.join(DOWNLOADS_DIR, f"{os.path.basename(video_path)}")
                        shutil.copy2(video_path, dest_path)
                        return dest_path, None

                # 如果找不到，尝试搜索整个 videos 目录
                videos_dir = os.path.join(output_dir, "videos")
                if os.path.exists(videos_dir):
                    for root, dirs, files in os.walk(videos_dir):
                        for f in files:
                            if f.endswith(".mp4") and not f.startswith("partial_"):
                                video_path = os.path.join(root, f)
                                # 复制到 DOWNLOADS_DIR 以便提供下载
                                import shutil
                                dest_path = os.path.join(DOWNLOADS_DIR, f"{os.path.basename(video_path)}")
                                shutil.copy2(video_path, dest_path)
                                return dest_path, None

            # 提取错误信息
            error = result.stderr or result.stdout
            if not error:
                error = "Unknown error during rendering"

            return None, error

        except subprocess.TimeoutExpired:
            return None, "渲染超时，请简化动画描述"
        except Exception as e:
            return None, str(e)
