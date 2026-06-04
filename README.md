# lol-material-tool · 英雄联盟素材包获取 & 整理工具

从 Riot 官方 **Data Dragon** 一键获取指定版本的英雄联盟 / 云顶之弈数据包,并把海量图标**按官方中文名批量重命名、自动归档**,供视频创作者、Wiki 编辑、二创作者直接取用。

基于 **Tauri 2(Rust + React)** 重写自早期 Flet(Python)版本,主打更小的体积、更快更稳的下载 / 解压与批量文件处理。

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
- **四标签界面**:下载 / 汉化 / 导航(精选 LoL & TFT 素材站速查)/ 说明(工作原理与使用指南)。
- **Hextech 视觉**:深蓝底 + 金色描边 + 青色发光,自绘无边框标题栏。

## 🧱 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 · TypeScript · Vite 7 · Tailwind CSS 3.4 · lucide-react |
| 后端 | Rust · Tauri 2 · reqwest(流式下载)· flate2 + tar(解压)· serde |
| 插件 | tauri-plugin-dialog / opener / fs |

## 📁 目录结构

```
lol-material-tool/
├── src/                        # React 前端
│   ├── App.tsx                 #   状态总线 + 四标签容器
│   ├── components/             #   TitleBar / Tabs / HextechProgressBar
│   │   └── panels/             #   下载 / 汉化 / 导航 / 说明 四个页面
│   ├── data/                   #   navigation.ts / help.ts(导航、说明页数据)
│   ├── hooks/                  #   useTaskProgress(订阅后端进度事件)
│   └── lib/                    #   api.ts(invoke 封装)/ utils.ts
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── ddragon.rs          #   版本 / 数据包 URL 与数据模型
│   │   ├── download.rs         #   流式下载 + 进度 + 取消
│   │   ├── extract.rs          #   tgz 解压
│   │   ├── localize.rs         #   联盟 + 云顶汉化整理
│   │   ├── constants.rs        #   汉化映射与配置(自 Flet constants 迁移)
│   │   └── lib.rs              #   命令注册
│   ├── capabilities/           #   Tauri 权限
│   └── tauri.conf.json
├── assets/                     # 应用图标(当前为占位,后续替换为 LoL 主题)
├── legacy/                     # 历史版本(仅参考,不参与构建)
│   ├── flet-v2/                #   Flet(Python)v2 完整存档
│   └── lol_material_cli_v1.py  #   v1 单文件 CLI
├── plans/                      # 设计与里程碑文档(单一信息源)
└── package.json
```

## 🚀 快速开始

> Windows 上若 `npm` 找不到 node,请确保 `C:\Program Files\nodejs` 在 PATH(或在 git-bash 内 `export PATH="/c/Program Files/nodejs:$PATH"`)。

```bash
# 安装依赖
npm install

# 开发模式(自动编译 Rust + 启动桌面窗口;首次较慢)
npm run tauri dev

# 仅前端类型检查 + 构建
npm run build

# 打包桌面应用(当前优先 Windows)
npm run tauri build
```

## 🌐 数据来源与说明

所有素材均实时拉取自 **Riot Games 官方 Data Dragon**(`ddragon.leagueoflegends.com`),本工具不二次分发任何游戏资源,仅做下载与按中文名归类整理,供学习与创作使用。

> *lol-material-tool isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.*

## 🗺️ 路线图

| 里程碑 | 状态 | 内容 |
|---|---|---|
| M1 下载管道 | ✅ | 版本列表 / 下载 / 解压 + 进度 |
| M2 联盟汉化 | ✅ | 英雄 / 皮肤 / 技能 / 装备 / 符文 |
| M3 云顶汉化 | ✅ | 弈子 / 装备 / 海克斯 / 羁绊 等 7 类 |
| M4 四标签 UI | ✅ | 下载 / 汉化 / 导航 / 说明 |
| M5 打包 + 开源 | ⏳ | Windows 打包 / LICENSE / 主题图标 / 去敏定稿 |

详见 [`plans/`](./plans/)。

## 📚 文档导航

- [`plans/README.md`](./plans/README.md) — 计划总索引
- [`plans/2026-06-02-tauri-rewrite.md`](./plans/2026-06-02-tauri-rewrite.md) — Tauri 重写设计、里程碑与汉化业务不变量
- [`legacy/README.md`](./legacy/README.md) — 历史版本(Flet v2 / v1 CLI)说明

## 👤 作者

zker67 · GitHub [@Zker67](https://github.com/Zker67) · B站「仓小杰」

## 📄 许可证

[MIT](./LICENSE) © zker67
