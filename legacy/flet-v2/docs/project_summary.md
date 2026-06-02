# 英雄联盟素材包获取工具 — 开发交接技术笔记

> 记录 v2(模块化 Flet GUI)的关键实现与打包注意事项。
> 最近修订:2026-06-02(随项目结构整理同步更新文件路径引用)。

## 🧭 代码导航

| 位置 | 职责 |
| :--- | :--- |
| `src/main.py` | 入口,转调 `src.app.main`;启动命令 `python -m src.main`(须在项目根目录) |
| `src/app.py` | 应用初始化:Windows `AppUserModelID` 设置、PyInstaller `_MEIPASS` 资源路径解析、`ft.app(...)` 拉起界面 |
| `src/ui/views/home.py` | 主界面(下载 / 汉化 / 导航 / 说明等标签页),海克斯科技风格 |
| `src/core/` | `downloader`(下载)、`extractor`(解压)、`localizer`(依官方中文数据汉化整理) |
| `src/config/` | `theme`(主题色)、`constants`(常量) |
| `src/utils/` | `system`、`platform`(跨平台:文件名净化、平台判断等) |
| `scripts/convert_icon.py` | 由 `app_icon.png` 生成 `.ico`(Win 全尺寸 / 高清)与 `.icns`(Mac) |

## 🪟 Windows 任务栏图标

`src/app.py` 通过 `ctypes` 调用 `SetCurrentProcessExplicitAppUserModelID`,显式设置 AppUserModelID(`bilibili.cangxiaojie.lolmaterialtool.2.0`),使打包后任务栏图标正确归组与显示。`assets/` 同时提供 `icon.ico`(全尺寸,EXE 文件图标)与 `icon_max_res.ico`(仅 256×256,强制高清下采样)两套图标素材。

## 📦 打包

| 配置 | 平台 | 状态 |
| :--- | :--- | :--- |
| `build_config/win_build.spec` | Windows | ✅ 入口 `../src/main.py`,资源 `../assets`,图标 `../assets/icon.ico`,可直接打包 |
| `build_config/mac_build.spec` | macOS | ⚠️ 过时:入口仍为历史文件 `main_gui_mac.py`,图标 `app_icon.*` 路径未指向 `assets/`,需修正后使用 |
| `build_config/legacy_build.spec` | macOS | ⚠️ 早期遗留,问题同上 |

> 资源定位:打包后通过 `sys._MEIPASS` 找到内嵌的 `assets/`(见 `src/app.py`);开发态直接读项目内 `assets/`。

## 🍎 macOS 注意事项

- 同一份 `src/` 代码跨平台运行(平台分支见 `src/utils/platform`)。
- 生成的 `.app` 未经 Apple 开发者证书签名;在其他 Mac 首次运行若提示「无法打开」,需在「系统设置 → 隐私与安全性」中放行。
- macOS 打包前需先修复 `mac_build.spec` 的入口与图标路径(见上表)。

## 🗂️ 历史版本

`legacy/lol_material_cli_v1.py` 为最初单文件 CLI 版本,与 v2 无代码依赖,仅作参考(详见 `legacy/README.md`)。
