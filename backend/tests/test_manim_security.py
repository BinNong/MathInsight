import pytest

from app.services.manim_security import ensure_code_safe, CodeSecurityError


class TestManimSecurity:
    """Manim 代码 AST 安全分析测试"""

    def test_safe_manim_code(self):
        code = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
"""
        ensure_code_safe(code)  # should not raise

    def test_safe_math_numpy_import(self):
        code = """from manim import *
import math
import numpy as np

class GeneratedScene(Scene):
    def construct(self):
        val = math.sin(np.pi / 2)
        self.add(Text(str(val)))
"""
        ensure_code_safe(code)

    def test_import_os_blocked(self):
        code = """from manim import *
import os

class GeneratedScene(Scene):
    def construct(self):
        pass
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "os" in str(exc_info.value)

    def test_import_subprocess_blocked(self):
        code = """from manim import *
from subprocess import run

class GeneratedScene(Scene):
    def construct(self):
        pass
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "subprocess" in str(exc_info.value)

    def test_multiline_import_blocked(self):
        code = """from manim import *
import \\
    os

class GeneratedScene(Scene):
    def construct(self):
        pass
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "os" in str(exc_info.value)

    def test_eval_blocked(self):
        code = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        x = eval("1+1")
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "eval" in str(exc_info.value)

    def test_exec_blocked(self):
        code = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        exec("print(1)")
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "exec" in str(exc_info.value)

    def test_open_blocked(self):
        code = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        f = open("/etc/passwd")
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "open" in str(exc_info.value)

    def test_os_system_attribute_blocked(self):
        code = """from manim import *
import os

class GeneratedScene(Scene):
    def construct(self):
        os.system("ls")
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "os" in str(exc_info.value) or "system" in str(exc_info.value)

    def test_builtins_eval_blocked(self):
        code = """from manim import *

class GeneratedScene(Scene):
    def construct(self):
        __builtins__["eval"]("1+1")
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "dunder" in str(exc_info.value) or "eval" in str(exc_info.value)

    def test_unknown_module_blocked(self):
        code = """from manim import *
import requests

class GeneratedScene(Scene):
    def construct(self):
        pass
"""
        with pytest.raises(CodeSecurityError) as exc_info:
            ensure_code_safe(code)
        assert "requests" in str(exc_info.value)
