<h1 align="center">hacher · 个人智能工作台</h1>

<p align="center">
  <strong>把科研、项目、日程、电子元件和 AI Agent 放进一个本地桌面工作台</strong>
</p>

<p align="center">
  <a href="https://github.com/Jackjiang665/hacher/releases/latest">
    <img src="https://img.shields.io/github/v/release/Jackjiang665/hacher?label=下载" alt="release">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-blue" alt="platform">
  <img src="https://img.shields.io/badge/Electron-43-47848F?logo=electron" alt="electron">
  <img src="https://img.shields.io/badge/data-local--first-2f6b4f" alt="local first">
</p>

---

## 这是什么

hacher 是一个面向研究生、研发人员和个人创业者的 Windows 桌面工作台。它把待办、日程、项目、论文、英语学习、电子元件库存、长期记忆和本地 Agent 终端集中在同一个界面中。

它不是一个只有静态页面的概念 Demo。当前版本已经具备真实的本地数据保存、千问对话与图片识别、arXiv/网页主题检索、PDF 论文库、PowerShell 终端和 Claude Code 数据桥。关闭主窗口后应用会进入系统托盘，终端可以继续运行。

## 当前已经能做什么

### 1. AI 截图识别并自动入库

在“电子元件库”中选择 **批量截图识别入库**，可以一次提交多张淘宝、京东或其他购买记录截图。

- 一次最多处理 20 张图片，支持 PNG、JPEG、WebP 和 GIF，单张不超过 10 MB
- 调用千问视觉模型识别一张图中的多个电子元器件
- 提取元器件名称、分类、型号/规格/封装、购买数量和识别置信度
- 根据图片 SHA-256 哈希跳过已经处理过的重复截图
- 相同“名称 + 规格”的元器件自动合并并累加数量
- 低置信度结果标记为“待核对”，手动编辑后可解除标记
- 保留最近的来源截图文件名，方便回查
- 自动统计库存种类、总数量和低库存项目（数量 ≤ 2）

识别结果不是只展示在聊天框里，而是会真正写入本机元器件仓库；之后可以继续编辑存放位置、调整数量或设为 0。

### 2. 按主题生成每日情报

“每日情报”不是预置的新闻卡片。你可以添加自己的关注主题，例如“大模型不确定性量化”“具身智能”或“电机控制”。

每个主题会执行两条真实检索链路：

1. 千问把中文主题转换为适合论文检索的英文关键词；
2. 通过 arXiv API 获取按提交日期排序的最新论文，同时通过阿里云百炼联网搜索获取可追溯网页资料。

结果会保存题目、作者、摘要、发布日期和原始链接，并在界面中区分“arXiv 论文”和“网页资讯”。应用启动后，同一主题每天最多自动更新一次，也可以点击“全部刷新”立即重新搜索。主题可以随时添加或删除。

### 3. 真实本地终端与 Claude Code 数据桥

“Agent 终端”是基于 xterm.js 和 node-pty 的真实 PowerShell，不是模拟输出。

- 终端工作目录直接指向 hacher 项目
- 可以在界面中启动、重启、清屏和结束终端
- 点击“打开 Claude”可直接启动本机已经安装的 Claude Code
- 终端自动获得 `HACHER_DATA_FILE` 和 `HACHER_PROJECT_ROOT` 环境变量
- Claude 会读取项目中的 `CLAUDE.md`，了解工作台的数据边界和安全规则
- `tools/hacher.cjs` 数据桥可以读取任务、库存、长期记忆、项目、日程、论文、英语计划和关注主题
- Agent 可以新增/完成任务、调整库存、添加长期记忆以及管理关注主题
- 所有写入命令默认只预览；得到确认并添加 `--apply` 后才真正修改
- 数据文件变化会自动同步回 hacher 界面

例如，在终端中可以运行：

```powershell
node tools/hacher.cjs context
node tools/hacher.cjs task list
node tools/hacher.cjs inventory list
node tools/hacher.cjs memory list
node tools/hacher.cjs topic list
```

> Claude Code 需要用户自行安装和登录。hacher 提供的是终端、上下文和受控数据桥，不会附带 Claude 账号。

### 4. 千问助手与长期记忆

应用右侧的 hacher AI 使用用户自己的阿里云百炼 API Key，可以参考当前工作台里的真实数据回答：

- 待办及完成状态
- 元器件数量和存放位置
- 已确认的长期记忆
- 关注主题与英语学习计划
- 本地论文列表
- 项目进度和日程安排
- 最近的对话上下文

聊天支持附加图片。明确说“请记住……”时，内容会加入长期记忆；也可以在“AI 记忆中心”手动添加、查看或删除。记忆保存在本机，只有调用千问回答时才会作为上下文发送。

涉及“搜索最新论文”的请求会实际调用 arXiv API；没有真实检索结果时，助手被要求明确说明失败，不编造论文、新闻、库存或执行结果。

### 5. 本地工作台基础功能

| 模块 | 当前可用能力 |
|:---|:---|
| 工作台总览 | 汇总未完成任务、重点项目、今日日程、库存数量和低库存提醒 |
| 今日待办 | 新建任务、完成/恢复、按全部/未完成/已完成筛选、统计完成率、让 AI 依据真实待办给出安排建议 |
| 日程安排 | 00:00–24:00 周时间轴、本周清单、分类颜色、编辑与删除、时间重叠提示 |
| 项目中心 | 管理科研、创业、软件、电子、模型、DIY 等项目，记录状态、进度、标签和说明 |
| 论文与科研 | 批量导入 PDF 到本地论文库、文件哈希去重、打开和删除论文；可独立执行最新论文检索 |
| 英语学习 | 创建学习计划，设置水平、目标、每日分钟数和每周天数，记录每日学习并统计累计时长 |
| DIY 项目 | 使用统一项目结构记录 DIY 项目的说明、标签、状态和进度 |
| 电子元件库 | 手动入库、AI 批量截图入库、编辑信息、增减数量、来源追踪和低库存提醒 |
| AI 记忆中心 | 查看、添加和删除长期记忆，供千问对话和终端 Agent 参考 |
| 系统托盘 | 关闭窗口后隐藏到托盘，双击恢复，终端保持运行；托盘菜单可完全退出 |

## 下载与首次使用

### 下载便携版

前往 [Releases](https://github.com/Jackjiang665/hacher/releases/latest) 下载最新的 `hacher-*.exe`。当前发布版面向 Windows x64，双击即可运行，无需安装。

### 配置千问 API

1. 在阿里云百炼控制台创建自己的 API Key；
2. 打开 hacher 左下角“我的工作区”右侧的三点按钮；
3. 进入“千问 API 设置”，填写 Key 和模型名称后保存。

也可以在首次打开右侧 AI 面板时直接完成配置。API Key 不会写入仓库或工作台 JSON，而是保存在当前 Windows 用户的本机环境配置中；界面不会回显已经保存的 Key。

## 数据与隐私

- 工作台主数据：`%APPDATA%\hacher-workbench\hacher-data.json`
- 本地论文库：`%APPDATA%\hacher-workbench\papers\`
- API Key：当前 Windows 用户的本机环境配置
- 项目仓库、Release 包和工作台 JSON 均不包含用户的 API Key
- 普通任务、项目、库存和记忆以本地保存为主
- 只有使用千问对话、联网搜索或图片识别时，相关请求内容才会发送给阿里云百炼

可以在“我的工作区”或“AI 记忆中心”中点击“打开数据位置”直接查看本地文件。

## 当前版本的边界

hacher 仍处于早期版本，以下能力目前尚未完成：

- 仅发布 Windows x64 版本，暂未适配 macOS、Linux 和 ARM
- 没有账号系统、云同步或多设备协作
- 论文库目前负责导入、去重、打开和管理 PDF，尚未自动解析全文或生成论文笔记
- DIY 项目当前使用通用项目结构，独立的 BOM、代码版本和实验记录子模块仍在开发
- hacher AI 默认只回答和提出建议，不会在聊天中自行修改任务、库存、项目或日程
- 需要用户自己的阿里云百炼 API Key 和可用网络；Claude 终端还需要本机已经安装 Claude Code

## 从源码运行与打包

需要 [Node.js 18+](https://nodejs.org/) 和 [Git](https://git-scm.com/)。

```bash
git clone https://github.com/Jackjiang665/hacher.git
cd hacher

# 安装依赖（跳过 postinstall，避免本机 node-gyp 编译）
npm install --ignore-scripts

# 准备仓库内预置的 Windows x64 node-pty 原生组件
node tools/prepare-native.cjs

# 启动开发模式
npm start

# 打包便携版 EXE
npm run pack
```

项目在 `vendor/` 中预置了 Windows x64 的 node-pty 原生组件，通常不需要安装 Visual Studio Build Tools。

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用与本地 IPC
- [xterm.js](https://xtermjs.org/) — 终端界面
- [node-pty](https://github.com/nicedoc/nicedoc) — 真实 PowerShell 伪终端
- 阿里云百炼 / 千问 — 对话、视觉识别和联网搜索
- [arXiv API](https://info.arxiv.org/help/api/) — 真实论文检索
- [electron-builder](https://www.electron.build/) — Windows 便携版打包

## License

UNLICENSED — 个人项目，仅供学习交流。
