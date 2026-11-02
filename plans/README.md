# 计划文档索引 — lol-material-tool

> 单一信息源:本项目所有设计决策、实施计划、重构方案都在 `plans/` 下管理。
> 本 README 是计划的**唯一入口**,必须与实际文件保持同步。
> 计划方法论、状态标注与 P0–P2 优先级约定沿用工作区规范(完整版见 `z-image-gui/plans/README.md`)。

## 命名约定

```
plans/
├── README.md                       # 本文件:计划总索引
├── YYYY-MM-DD-<kebab-slug>.md       # 单个计划,按创建日期 + 简短英文 slug 命名
└── archive/                        # 已完成且不再活跃的计划归档于此
```

## 状态标注

| 标注 | 含义 |
|------|------|
| ✅ 已完成 | 已执行并验证 |
| ⚠️ 基础完成 | 核心已做,有已知遗留 |
| 📋 待执行 | 方案已写,未开始 |
| ❌ 已废弃 | 被后续方案替代 |

---

## 活跃计划

| 计划 | 状态 | 说明 |
|---|---|---|
| [2026-11-02-model-viewer.md](./2026-11-02-model-viewer.md) | 📋 待执行 | 3D 模型第一阶段:按版本查看皮肤静态模型(CommunityDragon OBJ + PNG),部件开关、透明截图、导出 GLB / 原文件;动画不在本阶段 |
| [2026-10-26-asset-browser.md](./2026-10-26-asset-browser.md) | ⚠️ 基础完成 | 按版本在线浏览素材(对比 / 历史原画 / 导出 / 缓存)+ 旧版本数据包兼容;测试、打包完成,界面待验收 |
| [2026-10-26-mygo-rewrite.md](./2026-10-26-mygo-rewrite.md) | ⚠️ 基础完成 | Tauri → MyGo(Go + React)重写,Bun + TS 7 / Vite 8 / Tailwind 4;测试、打包完成,GUI 待验收 |
| [2026-06-02-tauri-rewrite.md](./2026-06-02-tauri-rewrite.md) | ⚠️ 基础完成 | Flet v2 → Tauri 2(Rust + React)重写。M1 下载 ✅ / M2 联盟汉化 ✅ / M3 云顶汉化 ✅ / M4 四标签 UI ✅(HEAD `e85aee6`,未 push);**M5 打包+开源待执行**,端到端 GUI 实拉待验收 |

## 历史计划

| 计划 | 说明 |
|---|---|
| [2026-06-04-navigation-beautify.md](./archive/2026-06-04-navigation-beautify.md) | 导航界面美化与重构，添加分类、搜索与 Icon 自动抓取 |
