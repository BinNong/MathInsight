1. 使用git工具提交代码
### Agent 提交并自动打 tag — Prompt 指令（中文）

指令目标：把工作区变更提交到当前分支，基于提供或推断的版本号创建注释 tag，并推送分支与 tag 到远端。

使用方式（给 Agent 的完整 Prompt）：
1. 确认当前 git 仓库根目录；若不是，请先切换到仓库根。
2. 确定目标分支（若未指定，使用 `git rev-parse --abbrev-ref HEAD` 获取当前分支）。
3. 确定版本号：
    - 优先使用用户传入的版本号（格式 x.y.z）。
    - 若无传入，尝试从 package.json / pyproject.toml 等读取 version 字段。
    - 若仍无，生成时间戳 tag，格式 `vYYYYMMDD-HHMMSS`。
4. 检查未暂存变更并提示（可自动 `git add -A` 或先询问用户是否包含所有变更）。
5. 执行提交：
    - 默认提交信息：`chore(release): release v{version}`（若用户提供 commit message 则使用用户信息）。
    - 命令：`git add -A`，`git commit -m "chore(release): release v{version}"`（若没有变更则跳过提交）。
6. 创建注释 tag：
    - 命令：`git tag -a v{version} -m "Release v{version}"`（若 tag 已存在则改为 `git tag -f` 或先删除再建，需先询问用户）。
7. 推送分支与 tags：
   ⚠️如果检测没有远程仓库配置，就不需要推送
    - 推分支：`git push origin {branch}`
    - 推 tags：`git push origin --tags`
8. 完成后返回结果：分支名、tag 名、推送结果（stdout/stderr）、任何错误提示及下一步建议（例如发布到 CI/CD）。

安全检查与交互规则：
- 在推送到受保护分支（如 main/master）之前必须确认（提示用户确认）。
- 若远端不存在或无权限应返回具体错误并停止。
- 所有可破坏性操作（强制覆盖 tag、强制推送）必须先征得确认。

示例交互模板（Agent 内部执行脚本示例，用于参考）：
- 获取分支：git rev-parse --abbrev-ref HEAD
- 暂存并提交：git add -A && git commit -m "chore(release): release v{version}"
- 打 tag：git tag -a v{version} -m "Release v{version}"
- 推送：git push origin {branch} && git push origin --tags

把以上步骤按顺序自动化执行，遇到需要用户决策的点（版本冲突、受保护分支、已存在 tag）向用户发起确认请求。