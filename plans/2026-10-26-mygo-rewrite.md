# MyGo 重写:lol-material-tool

> **状态**:⚠️ 基础完成。Go 后端、MyGo 容器、前端迁移与工具链升级已完成,`go test` / 类型检查 / `mygo build` 通过;**GUI 端到端实拉待用户验收**。
> **范围**:把 Tauri 2(Rust 后端)换成 MyGo(Go 后端 + 系统 WebView2),沿用 React 前端;同时把包管理换成 Bun,前端工具链升级到 TypeScript 7 / Vite 8 / Tailwind CSS 4。
> **基线**:Tauri 版 = 提交 `5bfd72e`(未在仓库内存档,见 git 历史)。

---

## 1. 选型

| 层 | 选择 | 理由 |
|---|---|---|
| 桌面容器 | MyGo 0.6.4 Web 页面窗口 | 只做桌面、优先 Windows;沿用现有 React 界面;Go 标准库覆盖下载 / gzip / tar / JSON,无需第三方依赖 |
| 不选 MyGo 原生 UI | — | Hextech 视觉高度风格化,且要整体重写 4 个面板 |
| 包管理 | Bun | MyGo Web 模板的默认工具链;`mygo-cli` 也可经 Node 运行,但统一用 Bun |
| 前端 | React 19 / TS 7 / Vite 8 / Tailwind 4 | Tailwind 用官方 `@tailwindcss/upgrade` 迁移,接入 `@tailwindcss/vite`;v3 默认边框色的兼容规则保留在 `src/index.css` |

风险:MyGo 仍是 0.x,升级前读 Releases;Go 模块与 `mygo-cli` / `mygo-runtime` 版本须一致(当前均为 0.6.4)。

## 2. 接口对照

| Tauri | MyGo |
|---|---|
| `invoke("list_versions" …)` 等 6 个命令 | 绑定服务 `Tasks`:`listVersions` / `downloadPack` / `extractPack` / `runLolLocalization` / `runTftLocalization` / `cancelTask` |
| 事件 `task://progress` + `listen` | 类型化事件 `task:progress`(`events.taskProgress.on`) |
| 全局 `CancelFlag` | 每个任务一个 `context`,`cancelTask` 取消当前任务;窗口关闭也会取消 |
| `plugin-dialog` `open({directory})` | `Desktop.pickDirectory`(`mygo.Dialog.Open`) |
| `plugin-opener` `openPath` / `openUrl` | `Desktop.openPath` / `Desktop.openURL`(`mygo.Shell`) |
| `decorations:false` + `data-tauri-drag-region` | `Frameless: true` + CSS `--app-region: drag` |
| `getCurrentWindow()` + `tauri://resize` | `mygo-runtime` 的 `currentWindow` + DOM `resize` |
| Rust 错误字符串 | Go `error` → 前端 `CallError`,日志取 `errorMessage(e)` |

## 3. 不变量

沿用 [Tauri 重写 §3](./2026-06-02-tauri-rewrite.md) 的 10 条汉化不变量,另加:

- JSON 对象按 key 的**字节序**遍历(同 Tauri 版 serde_json 默认的 BTreeMap),重名素材后写覆盖先写;Go 的 map 无序,必须排序(`sortedValues`)。
- 解压跳过含 `..` 的条目,去掉根与 `.` 前缀(同 Rust tar `unpack_in`),保留文件修改时间。

## 4. 验证

| 项 | 方法 | 结果 |
|---|---|---|
| Go 逻辑 | `go test ./internal/...`:单元测试、合成数据包的解压 / 联盟 / 云顶集成测试、Riot 真实接口(版本、下载、404、取消) | 通过 |
| 前端 | `bun run typecheck`、`bun run build:web` | 通过 |
| 打包 | `bun run build` → `lol-material-tool.exe`(11.3 MB)与安装包(3.8 MB);加入素材浏览后为 12.1 MB / 4.0 MB;启动冒烟 | 通过 |
| GUI | 真实窗口里走完下载 → 解压 → 汉化,检查标题栏拖动、最大化、取消、打开文件夹与外链 | 待用户验收 |

未与 Tauri 版做真实数据包的逐文件对拍(按决定不保留 Tauri 版、不占用磁盘)。汉化逻辑的一致性靠逐条移植 + 合成数据包测试覆盖各分支(皮肤序号 / default 回退 / 大小写兜底 / 符文根路径 / 属性点 / TFT 三种 data 形态 / 重名覆盖顺序)。

后续的素材浏览与旧版本兼容见 [2026-10-26-asset-browser.md](./2026-10-26-asset-browser.md)。

## 5. 回滚

完整的 Tauri 应用在提交 `5bfd72e`。
