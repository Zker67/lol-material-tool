# 英雄联盟素材包获取工具 (LoL Material Tool)

> 专为英雄联盟与云顶之弈创作者设计,一键获取、下载并汉化整理官方美术素材。
> **开发者**:Bilibili 仓小杰　·　**界面框架**:Python + Flet　·　**版本**:1.0.0

![App Icon](assets/taskbar_icon.png)

## 📖 项目简介

基于 Python(Flet)的跨平台桌面 GUI,解决创作者获取 Riot Games 官方 Data Dragon 素材时的**下载慢**、**文件名未汉化**、**分类混乱**痛点:自动拉取官方版本列表 → 多线程下载数据包 → 依官方中文数据将文件名汉化,并按英雄 / 皮肤 / 装备 / 符文等维度智能归档。

## ✨ 核心特性

- **🚀 自动版本获取**:实时连接 Riot API,获取全量赛季与版本列表,支持历史版本回溯。
- **⚡ 多线程下载**:针对国内网络环境优化的下载逻辑,支持大文件解压。
- **🇨🇳 深度汉化整理**:
    - **英雄**:自动将 `Aatrox_0.jpg` 转换为 `暗裔剑魔 亚托克斯/暗裔剑魔 亚托克斯.jpg`。
    - **皮肤**:原画、加载图、头像均自动匹配中文皮肤名。
    - **技能 / 被动**:自动归档至对应英雄目录,并标注 Q/W/E/R/被动。
    - **装备 / 符文**:自动汉化文件名并分类(精密 / 巫术 / 启迪等)。
- **♟️ 云顶之弈适配**:独立支持 TFT 赛季数据的下载与整理(棋盘、小小英雄、羁绊、海克斯等)。
- **🎨 Hextech UI**:海克斯科技风格的现代化界面,无边框沉浸式窗口。
- **💻 跨平台支持**:适配 Windows 与 macOS,支持高分屏与系统级任务栏集成。

## 📂 项目结构

```text
lol-material-tool/
├── assets/                 # 图标资源(app_icon.png / icon.ico / icon_max_res.ico / taskbar_icon.png)
├── build_config/           # PyInstaller 打包配置(见「打包构建」)
│   ├── win_build.spec      #   Windows(对应当前 src/main.py 入口)
│   ├── mac_build.spec      #   macOS(历史遗留,待更新)
│   └── legacy_build.spec   #   macOS 早期遗留
├── docs/
│   └── project_summary.md  # 开发交接技术笔记
├── legacy/                 # 历史版本存档(v1 单文件 CLI,仅参考,详见其 README)
│   ├── README.md
│   └── lol_material_cli_v1.py
├── scripts/
│   └── convert_icon.py     # 图标格式转换脚本(PNG → ICO/ICNS,依赖 Pillow)
├── src/                    # 主程序(Flet GUI v2,模块化)
│   ├── main.py             #   入口(python -m src.main)
│   ├── app.py              #   应用初始化(窗口、AppUserModelID、PyInstaller 资源路径)
│   ├── config/             #   theme(主题) / constants(常量)
│   ├── core/               #   downloader(下载) / extractor(解压) / localizer(汉化整理)
│   ├── ui/                 #   components/hextech(组件) / views/home(主界面)
│   └── utils/              #   system / platform(跨平台工具)
├── requirements.txt        # 运行依赖
└── README.md
```

## 🛠️ 安装与运行

### 环境要求
- Python 3.8+

### 安装依赖
在**项目根目录**(`lol-material-tool/`)下执行:
```bash
python -m venv venv
# Windows:  venv\Scripts\activate
# macOS/Linux:  source venv/bin/activate
pip install -r requirements.txt
```

### 启动
```bash
# 必须在项目根目录下运行:包名为 src,入口 src/main.py
python -m src.main
```

## 📦 打包构建

PyInstaller 配置位于 `build_config/`:

| 配置 | 目标平台 | 状态 |
|---|---|---|
| `win_build.spec` | Windows | ✅ 入口已指向 `src/main.py`,可直接使用 |
| `mac_build.spec` / `legacy_build.spec` | macOS | ⚠️ 历史遗留,入口仍指向旧文件 `main_gui_mac.py`,需先更新为 `../src/main.py` 及修正图标路径后方可用 |

Windows 打包(在项目根目录执行):
```bash
pip install pyinstaller
pyinstaller build_config/win_build.spec
```
产物输出到 `dist/`(已被 `.gitignore` 忽略,可随时重新生成)。

## 🗂️ 历史版本

`legacy/lol_material_cli_v1.py` 是最初的单文件命令行版本,与现行 GUI 无代码依赖,仅作参考与追溯,详见 `legacy/README.md`。

## 🗓️ 开发路线 (Roadmap)

- [x] **v1.0.0**:基础功能上线,支持 Win/Mac,完成英雄 / 云顶核心素材汉化。
- [x] **v1.0.1**:修复 Windows 任务栏图标显示问题,优化打包体积。
- [ ] **后续**:模块化界面重构(v2,Flet)已完成;计划评估迁移至 Tauri 桌面框架。

## 🤝 反馈与交流
- **Bilibili**:[仓小杰](https://space.bilibili.com/13540581)

---
*Disclaimer: This project is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.*
