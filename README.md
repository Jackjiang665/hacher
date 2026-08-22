<h1 align="center">hacher · 个人智能工作台</h1>

<p align="center">
  <strong>一个为科研、创业和 DIY 打造的本地桌面工作台</strong>
</p>

<p align="center">
  <a href="https://github.com/Jackjiang665/hacher/releases/latest">
    <img src="https://img.shields.io/github/v/release/Jackjiang665/hacher?label=下载" alt="release">
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-blue" alt="platform">
  <img src="https://img.shields.io/badge/Electron-43-47848F?logo=electron" alt="electron">
</p>

---

## ✦ 这是什么

hacher 是一个 **完全本地运行** 的桌面工作台，把任务管理、日程、项目跟踪、论文管理、元件库存、AI 记忆和终端聚合在一个界面里。关闭窗口不会退出——缩到右下角托盘，终端继续跑。

## ✦ 功能模块

| 模块 | 说明 |
|:---|:---|
| 🏠 工作台总览 | 一眼看清今日任务、重点项目和待处理通知 |
| ✅ 今日待办 | 创建、分类、完成每日任务 |
| 📅 日程安排 | 周视图 + 日视图，管理日程和事件 |
| 📁 项目中心 | 科研 / 创业 / 软件 / DIY，分类跟踪进度 |
| 📄 论文与科研 | 导入 PDF，管理论文阅读笔记和科研资料 |
| 🇬🇧 英语学习 | 学习计划与记录 |
| 📰 每日情报 | 关注主题，聚合最新论文与资讯 |
| 🔧 DIY 项目 | 记录电路、代码、BOM 和测试过程 |
| 🔩 电子元件库 | 管理库存数量、位置，低库存自动提醒 |
| 🧠 AI 记忆中心 | 让 AI 记住你的偏好、项目上下文和长期信息 |
| 💻 Agent 终端 | 内嵌 PowerShell 终端，可直接启动 Claude Code |

## ✦ 下载安装

### 直接用（推荐）

前往 [Releases 页面](https://github.com/Jackjiang665/hacher/releases/latest) 下载最新的 `hacher-*.exe`，双击即可运行，无需安装。

### 从源码构建

需要 [Node.js 18+](https://nodejs.org/) 和 [Git](https://git-scm.com/)。

```bash
# 克隆仓库
git clone https://github.com/Jackjiang665/hacher.git
cd hacher

# 安装依赖（跳过 postinstall 避免 node-gyp 编译）
npm install --ignore-scripts

# 复制预编译的终端原生组件
node tools/prepare-native.cjs

# 启动开发模式
npm start

# 打包成便携版 exe
npm run pack
```

> 💡 项目已预置 Windows x64 的 node-pty 原生组件（`vendor/` 目录），无需安装 Visual Studio Build Tools。

## ✦ 使用说明

- **关闭窗口**：软件会最小化到系统托盘，不会退出，终端保持运行
- **恢复窗口**：双击托盘图标，或右键托盘 → "显示主窗口"
- **完全退出**：右键托盘图标 → "退出"
- **数据位置**：`%APPDATA%\hacher-workbench\hacher-data.json`
- **配置千问**：点击左下角“我的工作区”右侧的三点按钮 → “千问 API 设置”，填写自己的阿里云百炼 API Key；Key 仅保存在当前 Windows 用户的本机配置中

## ✦ 技术栈

- [Electron](https://www.electronjs.org/) — 桌面应用框架
- [xterm.js](https://xtermjs.org/) — 终端模拟器
- [node-pty](https://github.com/nicedoc/nicedoc) — 伪终端原生模块
- [electron-builder](https://www.electron.build/) — 打包工具

## ✦ License

UNLICENSED — 个人项目，仅供学习交流。
