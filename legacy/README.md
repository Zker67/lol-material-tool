# legacy — 历史版本存档

本目录存放「lol-material-tool」的**历史实现**,仅作参考与追溯,**不参与现行 Tauri 版的运行与构建**。

## 目录结构

| 路径 | 版本 | 说明 |
|---|---|---|
| `lol_material_cli_v1.py` | v1 | 单文件命令行版本(原文件名含中文与 `&`,已规范化)。基于 `input()` 菜单,在单个文件内串起下载、解压、汉化整理全流程。 |
| `flet-v2/` | v2 | 模块化 Flet 图形界面整套快照:`src/`(主程序)、`requirements.txt`、`build_config/`(PyInstaller)、`docs/project_summary.md`(交接笔记)、`scripts/`、原 `README.md`。 |

## 与现行版本(Tauri)的关系

- 现行版本正用 **Tauri 2(Rust + React)** 重写,设计见 [`../plans/2026-06-02-tauri-rewrite.md`](../plans/2026-06-02-tauri-rewrite.md)。
- v1 与 v2 互不 import,**无代码依赖**;二者保留为重写的**业务逻辑参考来源**——尤其 `flet-v2/src/core/localizer.py` 的汉化分类逻辑(称号/本名拼名、符文图标根路径回退、属性点硬编码字典、TFT 多形态兼容等关键细节,已在重写设计的「§3 不变量」固化)。

## 注意

- ⚠️ v1 脚本与 v2 GUI 均**未在现行环境重新验证**,可能依赖已变更的官方接口。
- ⚠️ `flet-v2/` 的图标资源原引用项目根 `assets/`,归档后相对路径已变,作为**冻结代码存档**不保证可直接运行;如需复跑请自行修正资源路径。
