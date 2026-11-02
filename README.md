# lol-material-tool · 英雄联盟素材包获取 & 整理工具

从 Riot 官方 **Data Dragon** 在线浏览任意版本的英雄联盟 / 云顶之弈素材,或一键获取整包并把海量图标**按官方中文名批量重命名、自动归档**,供视频创作者、Wiki 编辑、二创作者直接取用。

基于 **MyGo(Go + React)** 构建:Go 负责下载 / 解压 / 批量文件处理,界面跑在系统 WebView2 里,打包后是一个约 12 MB 的程序。历经 Flet(Python)→ Tauri 2(Rust)→ MyGo 三代;Flet 与 v1 存档于 `legacy/`,Tauri 版见 git 历史(提交 `5bfd72e`)。

---

## 📑 目录

- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [目录结构](#-目录结构)
- [快速开始](#-快速开始)
- [数据来源与说明](#-数据来源与说明)
- [路线图](#️-路线图)
- [文档导航](#-文档导航)

## ✨ 功能特性

- **数据包获取**:拉取 Riot 官方版本列表,赛季 ↔ 版本号两级联动选择;流式下载 `dragontail-{版本}.tgz`(数百 MB),实时进度 / 速度 / 剩余时间,可取消。
- **自动解压**:gzip + tar 解包到 `联盟官方数据包-{版本}/`,幂等可重跑。
- **联盟汉化整理**:英雄(称号 + 本名文件夹)/ 皮肤大图 / 头像 / 技能(QWER + 被动)/ 装备 / 符文(含属性点),按中文名重命名归档到 `联盟数据汉化整理-{版本}/`。
- **云顶汉化整理**:弈子 / 装备 / 海克斯强化 / 棋盘皮肤 / 小小英雄 / 羁绊 / 地区传送门 共七类,输出 `云顶数据汉化整理-{版本}/`。
- **素材浏览**:不下载整包,按版本在线浏览,侧边栏切换英雄联盟(英雄与皮肤 / 装备 / 符文 / 召唤师技能)与云顶之弈(弈子 / 羁绊 / 装备 / 海克斯强化 / 小小英雄 / 棋盘皮肤 / 地区传送门);按定位、分类、赛季等筛选到单个英雄或单件装备;虚拟滚动网格 + 详情面板。
- **文字资料**:英雄背景故事、使用 / 对抗技巧、四项评分与基础属性;技能说明与冷却 / 消耗 / 距离;装备属性与效果、价格、合成树(可沿树跳转到材料与上级装备);符文先选系,详情里显示游戏同款符文树,点符文看图标与说明;召唤师技能冷却与解锁等级;云顶弈子费用与海克斯强化说明;皮肤背景、稀有度与皮肤系列。均可一键复制。
- **英雄与皮肤合一**:同一页切换按英雄或按皮肤显示;皮肤按英雄分组,可只看某位英雄,点组标题查看英雄详情;详情面板分「素材 / 资料」两页。
- **版本对比**:任选两个版本,标出新增 / 改名 / 移除的条目。
- **历史原画**:官方只保留最新原画,详情中可切换到 CommunityDragon 的该版本原画与炫彩(7.1 起)。
- **复制与保存**:任意素材图右键可复制图片 / 保存 / 另存为 / 复制名称,详情面板文字可直接选中复制;第一次保存时选一个固定保存位置,之后保存和导出都直接放进去不再询问,侧边栏「保存位置」可查看、更改或清除(存于应用数据目录的 `settings.json`)。
- **导出与搜索**:一键导出某英雄全部素材或当前分区;Ctrl + K 跨分类搜索。
- **本地缓存**:经 `lmt://` 协议由 Go 端拉取并缓存,看过的版本离线可看;侧边栏可查看占用与清理。
- **旧版本兼容**:老数据包没有 `championFull.json` 时逐英雄读取、旧皮肤缺 `num` 时由 id 推算、7.x 以前的旧符文 / 天赋单独归档、无整包或无云顶数据的版本提前提示。
- **侧边栏界面**:素材浏览可切换英雄联盟 / 云顶之弈,各自列出分区;下方固定整包下载 / 汉化整理 / 导航(精选素材站)/ 说明。
- **Hextech 视觉**:深蓝底 + 金色描边 + 青色发光,自绘无边框标题栏。

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 桌面容器 | [MyGo](https://mygo.egoist.dev/) 0.6(系统 WebView2,无边框窗口 + 自绘标题栏) |
| 前端 | React 19 · TypeScript 7 · Vite 8 · Tailwind CSS 4 · shadcn/ui · lucide-react |
| 前端数据 | TanStack Query(请求缓存)· TanStack Virtual(大网格)· Zustand(界面状态) |
| 后端 | Go 1.27 标准库:`net/http`(流式下载)· `compress/gzip` + `archive/tar`(解压)· `encoding/json` |
| 前后端通信 | `mygo generate` 生成的类型化客户端 `src/mygo.ts`(服务 `Tasks` / `Assets` / `Desktop`,事件 `task:progress`);图片与 JSON 走自定义协议 `lmt://` |
| 工具 | Bun(包管理与脚本) |

## 📁 目录结构

```
lol-material-tool/
├── main.go                     # MyGo 入口:窗口、绑定服务 Tasks / Assets / Desktop、lmt 协议、进度事件
├── internal/material/          # Go 业务逻辑(不依赖 MyGo,可单独 go test)
│   ├── ddragon.go              #   版本列表 / 数据包 URL
│   ├── download.go             #   流式下载 + 进度 + 取消
│   ├── extract.go              #   tgz 解压(路径安全)
│   ├── localize.go             #   联盟 + 云顶汉化整理
│   ├── constants.go            #   汉化映射与配置
│   ├── cache.go                #   素材磁盘缓存(lmt:// 协议的数据源)
│   ├── catalog.go              #   按版本汇总英雄 / 装备 / 符文 / 云顶目录
│   ├── cdragon.go              #   CommunityDragon 历史原画与炫彩
│   ├── export.go               #   浏览器中的批量导出
│   ├── save.go                 #   单张保存(重名不覆盖)、复制图片转 PNG、用户设置
│   └── *_test.go               #   单元 / 合成数据包 / 真实接口测试
├── src/                        # React 前端
│   ├── App.tsx                 #   侧边栏 + 页面容器,整包工具的状态
│   ├── mygo.ts                 #   mygo generate 生成的类型化客户端(勿手改)
│   ├── components/             #   TitleBar / Sidebar / HextechProgressBar
│   │   ├── panels/             #   整包下载 / 汉化 / 导航 / 说明 四个页面
│   │   └── ui/                 #   shadcn/ui 组件
│   ├── features/browser/       #   素材浏览:网格、详情、符文树、版本选择、Ctrl+K 搜索
│   ├── store/                  #   ui.ts(Zustand 界面状态)
│   ├── data/                   #   navigation.ts / help.ts(导航、说明页数据)
│   ├── hooks/                  #   useTaskProgress(订阅后端进度事件)
│   └── lib/                    #   api.ts(后端调用封装)/ assets.ts(素材查询)/ save.ts(保存与复制)/ utils.ts
├── mygo.config.ts              # 应用名、标识、图标与前端构建配置
├── assets/                     # 应用图标(app_icon.png 为打包图标)
├── legacy/                     # 历史版本(仅参考,不参与构建)
│   ├── flet-v2/                #   Flet(Python)v2 完整存档
│   └── lol_material_cli_v1.py  #   v1 单文件 CLI
├── plans/                      # 设计与里程碑文档(单一信息源)
└── package.json
```

## 🚀 快速开始

需要 [Go](https://go.dev/dl/) 1.27+ 与 [Bun](https://bun.sh)。Windows 10 另需 WebView2 Runtime(Windows 11 自带)。

```bash
# 安装依赖
bun install

# 开发模式(启动 Vite 并运行桌面窗口,改 Go 代码自动重启)
bun run dev

# Go 业务逻辑测试(含访问 Riot 真实接口的测试;加 -short 跳过联网)
go test ./internal/...

# 前端类型检查
bun run typecheck

# 打包:build/windows-amd64/ 下生成 lol-material-tool.exe 与安装包
bun run build
```

## 🌐 数据来源与说明

所有素材均实时拉取自 **Riot Games 官方 Data Dragon**(`ddragon.leagueoflegends.com`),本工具不二次分发任何游戏资源,仅做下载、浏览与按中文名归类整理,供学习与创作使用。

- Data Dragon 的原画 / 加载图只提供最新版本;各版本的历史原画来自社区镜像 **CommunityDragon**(`raw.communitydragon.org`,非官方,7.1 起)。
- 部分旧版本(如 7.24.2)官方没有整包,但仍可在「素材浏览」中查看;云顶数据自 13.1 起提供。
- 浏览缓存位于 `%LOCALAPPDATA%\lol-material-tool\assets`。

> *lol-material-tool isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.*

## 🗺️ 路线图

| 里程碑 | 状态 | 内容 |
|---|---|---|
| M1 下载管道 | ✅ | 版本列表 / 下载 / 解压 + 进度 |
| M2 联盟汉化 | ✅ | 英雄 / 皮肤 / 技能 / 装备 / 符文 |
| M3 云顶汉化 | ✅ | 弈子 / 装备 / 海克斯 / 羁绊 等 7 类 |
| M4 四标签 UI | ✅ | 下载 / 汉化 / 导航 / 说明 |
| M5 打包 + 开源 | ⏳ | Windows 打包 / LICENSE / 主题图标 / 去敏定稿 |
| MyGo 重写 | ⚠️ | 后端改 Go、容器改 MyGo、前端工具链升级;Go 测试与打包通过,GUI 待验收 |
| 素材浏览 + 旧版本兼容 | ⚠️ | 按版本浏览 / 对比 / 历史原画 / 导出;Go 测试与打包通过,GUI 待验收 |

详见 [`plans/`](./plans/)。

## 📚 文档导航

- [`plans/README.md`](./plans/README.md) — 计划总索引
- [`plans/2026-10-26-mygo-rewrite.md`](./plans/2026-10-26-mygo-rewrite.md) — MyGo 重写:选型、接口对照与验证
- [`plans/2026-10-26-asset-browser.md`](./plans/2026-10-26-asset-browser.md) — 素材浏览与旧版本兼容:数据源调研、设计与验证
- [`plans/2026-06-02-tauri-rewrite.md`](./plans/2026-06-02-tauri-rewrite.md) — Tauri 重写设计、里程碑与汉化业务不变量
- [`legacy/README.md`](./legacy/README.md) — 历史版本(Flet v2 / v1 CLI)说明

## 👤 作者

zker67 · GitHub [@Zker67](https://github.com/Zker67) · B站「仓小杰」

## 📄 许可证

[MIT](./LICENSE) © zker67
