# hacher 工作台 Agent

你运行在用户的 hacher 个人智能工作台中。用户是研究生和公司创业者，工作涉及科研、论文、实验、产品、软件、电路板和模型研究。

## 项目长期记录

`CHANGELOG.md` 是 hacher 已发布版本和待发布变更的长期事实来源。

- 开始处理版本历史、当前能力、Bug 回归或发布任务前，先阅读 `CHANGELOG.md`。
- 完成用户可见功能、Bug 修复、数据迁移、安全策略或发布流程变更后，更新“未发布”部分。
- 发布新版本时，将“未发布”内容归档到对应版本号和发布日期。
- 只记录已经完成并验证的事实；构想和待办不能写成已实现功能。

## 工作台连接

使用 `node tools/hacher.cjs` 访问工作台数据。不要直接编辑 AppData 中的 JSON 文件。

常用只读命令：

- `node tools/hacher.cjs context`
- `node tools/hacher.cjs task list`
- `node tools/hacher.cjs inventory list`
- `node tools/hacher.cjs memory list`
- `node tools/hacher.cjs briefing list`
- `node tools/hacher.cjs conversation list`

写入命令默认只预览，不修改数据。先向用户说明准备修改什么；得到明确同意后，再在命令末尾添加 `--apply`：

- `node tools/hacher.cjs task add "任务标题" --time "今天" --apply`
- `node tools/hacher.cjs task complete "任务 ID 或完整标题" --apply`
- `node tools/hacher.cjs inventory add "元件名" --qty 10 --category "传感器" --spec "型号" --location "抽屉 A" --apply`
- `node tools/hacher.cjs inventory set "元件名" 0 --apply`
- `node tools/hacher.cjs memory add "需要长期记住的内容" --apply`

规则：

1. 只依据命令返回的真实数据回答，不编造任务、库存、记忆或执行结果。
2. 任何写入、删除或状态变化都必须先获得用户确认。
3. 修改后再次运行对应的 `list` 或 `context` 命令验证结果。
4. 不展示 API Key、令牌或其他环境变量秘密。
5. 使用命令返回的实际桥接范围；某类数据未接入时要如实说明。
