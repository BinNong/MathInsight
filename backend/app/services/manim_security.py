"""
Manim 代码安全分析器

基于 Python AST 的静态分析，拦截危险导入、函数调用与属性访问。
相比正则黑名单更鲁棒，能防御换行、字符串拼接、别名等绕过手段。
"""
import ast
import re
from typing import List, Optional


# 允许导入的模块白名单（前缀匹配，允许子模块）
_ALLOWED_MODULES = {
    "manim",
    "math",
    "numpy",
    "np",  # 常见别名，但 import np 本身无意义，这里仅作防御性保留
}

# 危险模块：禁止以任何形式导入
_DANGEROUS_MODULES = {
    "os",
    "sys",
    "subprocess",
    "socket",
    "requests",
    "urllib",
    "pathlib",
    "shutil",
    "importlib",
    "pickle",
    "marshal",
    "builtins",
    "__builtin__",
    "site",
    "warnings",
    "traceback",
    "platform",
    "pkgutil",
    "inspect",
}

# 危险的内置函数/名称（直接调用或作为名称出现）
_DANGEROUS_NAMES = {
    "eval",
    "exec",
    "compile",
    "open",
    "input",
    "raw_input",
    "__import__",
    "exit",
    "quit",
    "help",
}

# 危险的属性访问（obj.attr 中的 attr）
_DANGEROUS_ATTRIBUTES = {
    "system",
    "popen",
    "call",
    "run",
    "check_output",
    "fork",
    "kill",
    "remove",
    "unlink",
    "rmdir",
    "mkdir",
    "makedirs",
    "rename",
    "replace",
    "copy",
    "copyfile",
    "copytree",
    "rmtree",
    "move",
    "chmod",
    "chown",
    "execvp",
    "execve",
    "spawn",
    "socket",
    "connect",
    "send",
    "recv",
    "read",
    "write",
    "close",
}

# 正则快速初筛规则（保留作为第一道防线）
_CODE_BLACKLIST_PATTERNS = [
    r"^\s*import\s+(os|sys|subprocess|socket|requests|urllib|pathlib|shutil|importlib|pickle|marshal)\b",
    r"^\s*from\s+(os|sys|subprocess|socket|requests|urllib|pathlib|shutil|importlib|pickle|marshal)\s+import",
    r"\b__import__\s*\(",
    r"\beval\s*\(",
    r"\bexec\s*\(",
    r"\bcompile\s*\(",
    r"\bopen\s*\(",
    r"\bfile\s*\(",
    r"\binput\s*\(",
    r"\braw_input\s*\(",
]


class CodeSecurityError(Exception):
    """代码安全检查未通过"""
    pass


def _module_allowed(name: str) -> bool:
    """判断模块名是否允许导入"""
    base = name.split(".")[0]
    if base in _DANGEROUS_MODULES:
        return False
    return base in _ALLOWED_MODULES


def _is_dunder_access(node: ast.AST) -> bool:
    """判断是否访问 __builtins__ / __import__ 等危险 dunder"""
    if isinstance(node, ast.Name):
        return node.id.startswith("__") and node.id.endswith("__")
    if isinstance(node, ast.Attribute):
        return node.attr.startswith("__") and node.attr.endswith("__")
    return False


class _SecurityVisitor(ast.NodeVisitor):
    """AST 访问器，收集代码中的安全问题"""

    def __init__(self):
        self.issues: List[str] = []

    def _add_issue(self, message: str, node: ast.AST):
        line = getattr(node, "lineno", 0)
        self.issues.append(f"{message} (line {line})")

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            base = alias.name.split(".")[0]
            if base in _DANGEROUS_MODULES:
                self._add_issue(f"禁止导入模块 '{alias.name}'", node)
            elif not _module_allowed(alias.name):
                self._add_issue(f"不允许导入模块 '{alias.name}'", node)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        module = node.module or ""
        base = module.split(".")[0]
        if base in _DANGEROUS_MODULES:
            self._add_issue(f"禁止从模块 '{module}' 导入", node)
        elif module and not _module_allowed(module):
            self._add_issue(f"不允许从模块 '{module}' 导入", node)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        func = node.func
        if isinstance(func, ast.Name):
            if func.id in _DANGEROUS_NAMES:
                self._add_issue(f"禁止调用内置函数 '{func.id}'", node)
        elif isinstance(func, ast.Attribute):
            if func.attr in _DANGEROUS_ATTRIBUTES:
                self._add_issue(f"禁止调用危险方法 '{func.attr}'", node)
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        if node.attr in _DANGEROUS_ATTRIBUTES:
            self._add_issue(f"禁止访问危险属性 '{node.attr}'", node)
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name):
        # 禁止单独出现 eval/exec/open 等名称作为值使用
        # 但允许局部变量/参数重名（虽然也不建议，但这里只拦截全局危险内置名）
        if node.id in _DANGEROUS_NAMES and isinstance(node.ctx, ast.Load):
            self._add_issue(f"禁止引用危险名称 '{node.id}'", node)
        self.generic_visit(node)

    def visit_Subscript(self, node: ast.Subscript):
        if _is_dunder_access(node.value):
            self._add_issue("禁止通过下标访问 dunder 对象", node)
        self.generic_visit(node)


def quick_blacklist_check(code: str) -> Optional[str]:
    """正则快速初筛，返回第一个命中规则或 None"""
    for pattern in _CODE_BLACKLIST_PATTERNS:
        if re.search(pattern, code, re.IGNORECASE | re.MULTILINE):
            return pattern
    return None


def ensure_code_safe(code: str) -> None:
    """
    综合安全检查：先正则初筛，再 AST 深度分析。

    抛出 CodeSecurityError，附带具体违规位置。
    """
    hit = quick_blacklist_check(code)
    if hit:
        raise CodeSecurityError(f"正则初筛命中危险模式: {hit}")

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        # 语法错误会在渲染前单独校验，这里不当作安全问题
        return

    visitor = _SecurityVisitor()
    visitor.visit(tree)
    if visitor.issues:
        raise CodeSecurityError("; ".join(visitor.issues))
