# Tauri 重写设计:lol-material-tool

> **状态**:🚧 M1~M4 已完成(下载 / 联盟汉化 / 云顶汉化 / 四标签 UI,HEAD `e85aee6`,未 push),**M5 打包+开源待执行**;端到端 GUI 实拉待用户验收。
> **范围**:将 Flet v2(Python)整体重写为 **Tauri 2 桌面应用**(Rust 后端 + React 前端)
> **核心原则**:① 复用 `z-image-gui` 已验证的 Tauri 骨架 ② 严守 `localizer` 的「业务真相」不变量 ③ 先打通「下载 → 解压」管道,再逐块迁移汉化(分期交付)
> **基线**:Flet v2 = root-commit `ee552f0`,完整保留于 git 历史作参考;重写在同一 repo 内演进。

---

## 1. 背景判断

- 已定路线第三步「立即重写 Tauri」:跳过 Flet 版开源,直接用 Rust + 前端重写,Flet 仅留作参考。
- **为什么 Tauri**:① 与同作者已开源的 `z-image-gui`(Tauri 2 + React 19 + TS + Vite)技术栈统一,骨架/范式可大量复用;② 产物体积与启动性能优于 Flet 打包;③ Rust 后端做网络/解压/批量文件 IO 比 Python 更稳更快,正好补上 Flet 版「下载实为单线程」的短板。
- **现状**:整理 + 重命名已完成,干净基线已 `git init` 并提交(`ee552f0`),工作树干净,可放心在其上演进。

---

## 2. 成功标准(可验证)

1. 端到端跑通:**选赛季/版本 → 下载 `dragontail-{ver}.tgz` → 解压 → 联盟汉化 / 云顶汉化**,产物目录结构与 Flet 版**逐字节级一致**(同 `name+" "+title` 命名、同分类层级)。
2. 下载为**真并发**(分块或多文件并发),并有真实进度/速度/ETA,兑现原 README「多线程下载」承诺。
3. **Hextech 主题**视觉还原(深蓝底 + 金描边 + 青发光 + 渐变),无边框自绘标题栏。
4. 至少 **Windows** 可打包出可执行产物;跨平台路径/文件名清洗正确。
5. 「导航」「说明」两个静态页内容平移。

> **对拍验证法**:重写每个汉化子任务后,用同一版本号分别跑 Flet 版与 Tauri 版,`diff -r` 两个产物目录,差异为零才算迁移正确。

---

## 3. 不变量(汉化业务真相 —— 重写绝不能破坏)

> 这些是 `localizer.py` 里藏的、靠读代码才能发现的语义。Rust 端必须逐条复刻,否则汉化结果错乱。

1. **称号/本名映射(最核心)**:Data Dragon `championFull.json` 里 `name` = 中文**称号**(暗裔剑魔)、`title` = 中文**本名**(亚托克斯)。英雄文件夹名 = `name + " " + title` = `暗裔剑魔 亚托克斯`,**不是** `name` 本身。
2. **英文 ID 大小写容错** + `Fiddlesticks` 特判(查字典时需 `capitalize`/`lower` 兜底)。
3. **皮肤号 → 皮肤名**:文件名正则 `([A-Za-z0-9]+)_(\d+)\.jpg`;`skin_num==0` 用默认名(`name title`),否则在 `info["skins"]` 按 `num` 匹配该皮肤 `name`(排除 `default`)。
4. **符文图标根路径**:**优先** `<数据源根>/img/perk-images`(版本号目录之外),**回退** `{ver}/img/perk-images`;JSON 里 `icon` 形如 `perk-images/Styles/xxx.png`,需 `relative_to("perk-images")` 剥前缀再拼。
5. **属性点无 JSON**:`perk-images/StatMods/` 下图标无官方翻译,靠 `constants.py:STATMODS_MAPPING` 硬编码英→中(`StatModsArmorIcon.png` → `属性点 护甲.png`)。
6. **TFT 三种 JSON `data` 形态**都要兼容:`data` 是 list / `data` 是 dict(取 values)/ 无 `data` 但有 `sets`(从各赛季 `champions` 聚合,主要给 tft-champion)。
7. **副作用行为**:汉化产物落在**数据源目录的父目录**(`联盟数据汉化整理-{ver}/` / `云顶数据汉化整理-{ver}/`);解压前若同名目录存在先 `rmtree` 清空;解压成功后 `os.remove` 删 `.tgz`。
8. **常量原样迁移**:`IMAGE_SUBFOLDER_MAPPING`(皮肤四类:聚焦图片/加载界面/插画/皮肤头像)、`RUNE_CATEGORIES_INFO`(精密/主宰/巫术/坚决/启迪)、`STATMODS_MAPPING`(10 个属性点)、`TFT_LOCALIZATION_CONFIG`(7 类配置)。
9. **数据源唯一 = Riot 官方 CDN**:版本 `GET https://ddragon.leagueoflegends.com/api/versions.json`(`[0]` 最新);数据包 `GET https://ddragon.leagueoflegends.com/cdn/dragontail-{ver}.tgz`(全量,数百 MB)。
10. **文件名清洗**:去 `\ / * ? : " < > |`。

---

## 4. 技术选型

### 4.1 前端栈 —— 推荐:照搬 z-image-gui
- **React 19 + TypeScript + Vite + Tailwind 3.4**。理由:同作者已开源验证的骨架,目录三层(`components`/`hooks`/`lib`)、`TitleBar` 自绘标题栏、`tauri.conf.json`/`vite.config.ts`/`tsconfig` 模板、`config.ts`/`utils.ts` 范式都可直接迁移,维护心智统一。
- 备选(均放弃复用红利,不推荐):Vue 3 / 纯 Vanilla TS。

### 4.2 Rust 依赖基线
```toml
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "stream"] }
flate2 = "1"          # gzip 解压
tar = "0.4"           # tar 解包(自带 path 安全)
futures = "0.3"       # 并发下载
tokio = { version = "1", features = ["fs", "rt-multi-thread"] }
rayon = "1"           # 批量重命名/分类并行 IO
# Tauri 插件:fs / dialog / opener / http(沿用 z-image 选型)
```

### 4.3 进度通信范式 —— 新增(z-image 所缺)
z-image 没有「Rust emit 进度 + 前端 listen」范式(进度全靠前端 state)。下载/解压/汉化都是长任务,**必须新增**:
- Rust:命令注入 `AppHandle`,循环里 `app.emit("task://progress", ProgressEvent{...})`(需 `use tauri::Emitter;`)。
- 统一事件载荷:`ProgressEvent { stage: "download"|"extract"|"localize", current: u64, total: u64, speed?: f64, eta?: f64, message: String, done: bool }`。
- 取消:`tokio_util::CancellationToken` 或 `Arc<AtomicBool>`,命令开头注册、循环里检查。
- 前端:`listen<ProgressEvent>('task://progress', cb)`,effect 返回时 `unlisten.then(f=>f())` 清理(照搬 `TitleBar.tsx` 范式)。

### 4.4 状态管理
先用纯 `useState`(z-image 已证明中小桌面工具够用);若 4 Tab + 任务状态确实复杂再引 Zustand。

---

## 5. 目标架构

### 5.1 Rust 后端 `src-tauri/src/`
```
src-tauri/src/
├── main.rs              # 薄:调 lib::run()
├── lib.rs              # Builder + 插件注册 + invoke_handler
├── ddragon.rs          # 版本/数据包 URL、JSON 数据模型(serde)
├── download.rs         # 并发流式下载 + emit 进度 + 取消
├── extract.rs          # tgz 解压(flate2+tar)+ emit 进度
├── localize/
│   ├── mod.rs          # 编排 + 进度节点
│   ├── league.rs       # 联盟 7 类(皮肤大图/头像/技能/装备/符文/属性点/子目录)
│   ├── tft.rs          # 云顶 7 类(TFT_LOCALIZATION_CONFIG 驱动)
│   └── consts.rs       # 三组映射 + TFT 配置(从 constants.py 迁移)
└── platform.rs         # 文件名清洗、打开文件夹(部分用 opener 插件)
```
**命令清单**:`list_versions` / `download_pack` / `extract_pack` / `localize_league` / `localize_tft` / `cancel_task` / `pick_directory`(dialog 插件)/ `open_folder`(opener 插件)。错误范式 `Result<T, String>`(够用,必要时升 `thiserror`)。

### 5.2 前端 `src/`
```
src/
├── App.tsx             # 状态总线 + 4 Tab(下载/汉化/导航/说明)
├── components/         # TitleBar(复用)/ HextechButton / HextechProgressBar / LogView / 下载页 / 汉化页 ...
├── hooks/              # useTaskProgress(listen 封装)/ useCompactMode(复用)
└── lib/
    ├── api.ts          # invoke 封装(camelCase↔snake_case)
    ├── events.ts       # ProgressEvent 类型 + listen 订阅
    ├── constants.ts    # 外链导航数据、文案
    └── utils.ts        # convertFileSrc(素材预览)、路径工具(复用 z-image)
```

### 5.3 复用 / 剔除 / 新增
- **直接复用**(z-image):目录三层骨架、`TitleBar` + `decorations:false`、`tauri.conf.json`/`vite`/`tsconfig`/`tailwind`/`postcss` 模板、Cargo 插件基线(`fs/dialog/opener/http`)、`utils.ts` 路径/Blob 工具、`api.ts` invoke 范式、`main.tsx` 禁右键。
- **剔除**(z-image 业务专属):`wd14.rs`、`generateImage/optimizePrompt/...`、`openai` + `@react-three/*` + `three`、赛博朋克视觉组件、越狱提示词。
- **新增**:§4.3 进度 emit/listen 范式;`localize/` 整个汉化引擎;Hextech 主题(Tailwind 配色 + 发光/渐变 CSS)。

---

## 6. 分期交付

> **进度(2026-06-02)**:M1 ✅ · M2 ✅ · M3 ✅ · M4 ✅ · M5 ⏳ 待执行;HEAD `e85aee6`,未 push;端到端 GUI 实拉待验收。

| 里程碑 | 优先级 | 内容 | 验证 |
|---|---|---|---|
| **M1 脚手架 + 下载管道** | P0 | Tauri 起壳、剔除 z-image 业务、TitleBar+Hextech 外壳;`list_versions`/`download_pack`/`extract_pack` + emit 进度;前端下载页端到端 | 选一个版本能下载+解压出 `联盟官方数据包-{ver}/`,进度/速度实时 |
| **M2 联盟汉化** | P0 | `localize/league.rs` 7 类 + serde 建模 championFull/item/runesReforged;前端汉化页·联盟 | `diff -r` Flet 产物 `联盟数据汉化整理-{ver}/` 零差异 |
| **M3 云顶汉化** | P1 | `localize/tft.rs` 配置驱动 7 类(兼容三种 data 形态) | `diff -r` Flet 产物 `云顶数据汉化整理-{ver}/` 零差异 |
| **M4 UI 打磨** | P1 | 导航/说明静态页、LogView 日志、Hextech 主题细节、真并发下载调优、取消机制 | 视觉对照 Flet;下载并发提速可测 |
| **M5 打包 + 开源准备** | P2 | Windows 打包(后续 macOS)、补 LICENSE、README 定稿去敏 | 出 `.msi/.exe`;去敏复查无私有标识 |

---

## 7. 执行步骤(M1 详化,后续概要)

### M1(P0)
1. **目录布局**(见开放问题②,先按推荐):把现有 Flet `src/` 移入 `legacy/flet-v2/`(与 v1 CLI 并列留参考),腾出标准 Tauri 布局。
2. 用**官方 CLI** 起脚手架:`npm create tauri-app@latest`(React + TS 模板),对齐 z-image 的 `tauri.conf.json`(`identifier` 设 `com.zker67.lol-material-tool`,窗口无边框,产物 `frontendDist:"../dist"`)。**删除脚手架后的嵌套 `.git`**(工作区规范)。
3. 搬 z-image 范式:`TitleBar`、`utils.ts`、`api.ts` 外壳、Cargo 插件基线;剔除 z-image 业务依赖。
4. Rust:`ddragon.rs`(版本/包 URL)+ `download.rs`(reqwest stream 并发 + emit)+ `extract.rs`(flate2+tar + emit)。
5. 前端下载页:赛季↔版本联动下拉、`pick_directory`、`HextechProgressBar` + `useTaskProgress` listen、LogView。
6. **验证**:`npm run tauri dev`,完整下载+解压一个版本,产物结构对照 Flet。`git commit`。

### M2–M5(概要)
- M2:逐个迁移联盟 7 子任务,每个完成即 `diff -r` 对拍 Flet 产物 → commit。
- M3:迁移 TFT 配置驱动逻辑,重点测三种 data 形态 → 对拍 → commit。
- M4:静态页 + 主题 + 并发调优 + 取消 → commit。
- M5:`npm run tauri build` 打 Windows 包;补 LICENSE/README;去敏复查 → commit。

---

## 8. 回滚

- 每个里程碑(乃至每个子任务)独立 `git commit`,可逐步回退。
- Flet v2 完整保留在 `ee552f0` 及 `legacy/flet-v2/`,任何时候可 `git checkout` 或直接参照实现。
- 脚手架阶段若选型不合意,Tauri 产物集中在 `src-tauri/` + 前端 `src/`,删除重来成本低。

---

## 9. 风险与技术债

- **localizer 14 类迁移工作量大、易错**:缓解 = §3 不变量清单 + 每子任务 `diff -r` 对拍 Flet 产物。
- **dragontail 数百 MB**:下载/解压耗时,需真并发 + 稳健进度 + 可取消;注意磁盘占用与解压前清空同名目录的副作用。
- **跨平台**:文件名非法字符、路径分隔符、`os.replace` vs `shutil.move` 的等价 Rust 实现需覆盖 Win/mac。
- **字体 Beaufort**:Flet 远程加载 LoL 官方字体,Tauri 前端同样走 CDN `<link>` 或本地打包,二选一。
- **README「多线程」名实不符**:重写时一并纠正(真并发),避免继续误导。

---

## 10. 开放问题与决议(2026-06-02 已拍板)

1. **前端栈** → ✅ **照搬 z-image-gui**(React 19 + TS + Vite + Tailwind)。
2. **目录布局** → ✅ **移入 `legacy/flet-v2/`**(与 v1 CLI 并列留参考,Tauri 占标准布局,最终确认无用再删)。
3. **分期** → ✅ 采纳 M1→M5 与 P0–P2 优先级(云顶汉化 M3 排在联盟 M2 之后)。
4. **打包目标** → ✅ **首版仅 Windows**(macOS 后续再加;tauri.conf 先配 Win)。
5. **真并发下载** → ✅ 重写时补上真正的并发/分块下载,纠正原 README「多线程」名实不符。
