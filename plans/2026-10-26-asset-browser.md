# 素材浏览与旧版本兼容:lol-material-tool

> **状态**:⚠️ 基础完成。P0 旧版本兼容、P1 素材浏览、P2 对比 / 历史原画 / 导出已实现;`go test`(含真实接口)、类型检查、`mygo build` 通过;**界面效果待用户验收**。
> **范围**:在 [MyGo 重写](./2026-10-26-mygo-rewrite.md) 的基础上,(1) 修正整包汉化对旧版本数据包的适配;(2) 新增不下载整包、按版本在线浏览素材的界面。

---

## 1. 数据源调研(2026-10-26 实测)

### Data Dragon(官方)

| 事实 | 影响 |
|---|---|
| 502 个版本,`lolpatch_*` 无数据 | 版本列表过滤 `lolpatch_` |
| `championFull.json` 自 3.12.26 起;更早只有 `champion/{id}.json` | 汉化与目录都回退为逐英雄读取 |
| 很老的皮肤没有 `num` 字段 | 用 `id % 1000` 推算(`skinNumOf`) |
| `rune.json` / `mastery.json` 到 7.23;`runesReforged.json` 自 8.1;7.24.1 都没有 | 旧符文归档到「符文」、天赋到「天赋」 |
| 云顶 JSON 自 13.1.1;`tft-region-portals` 自 14.12.1;`map.json` 自 5.1.1 | 无云顶数据时提前报错,不创建空目录 |
| 原画 / 加载图 / 头像大图只有不带版本的最新路径 `cdn/img/champion/...`,带版本返回 403 | 浏览默认显示最新原画;历史原画走 CommunityDragon |
| 整包里原画等位于**根** `img/champion/{splash,...}`,`{ver}/img/champion` 只有头像 | 修复汉化第 1 步:先找根目录,再找版本目录(此前皮肤原画实际从未被复制) |
| 16.11 起 `skins` 含炫彩(带 `parentSkin`) | 炫彩不单独出图,挂在父皮肤下 |
| 7.24.2、10.10.3216176、0.151.2 等没有 dragontail 整包 | 下载前 `HEAD` 检查,无整包时禁用开始按钮 |
| CORS 为 `*` | 浏览器开发模式可直接回退到远程地址 |

### CommunityDragon(社区,非官方)

| 事实 | 影响 |
|---|---|
| 版本 7.1 – 最新,外加 latest / pbe | 历史原画只覆盖 7.1 起,更早版本提示不可用 |
| zh_cn 英雄 JSON 在 9.1 – 9.12 之间才出现 | 先试 zh_cn,失败回退 default |
| `/lol-game-data/assets/` 映射到 `plugins/rcp-be-lol-game-data/global/default/`(小写) | 一律用每个版本 JSON 里给出的路径做映射,不拼接猜测 |

## 2. 设计

```
侧边栏               工具栏:版本 · 对比 · 搜索 · Ctrl+K · 导出
├ 素材浏览           ┌──────────────────────────┬──────────────┐
│ 英雄 皮肤 装备      │ 筛选条(定位 / 分类 / 赛季) │              │
│ 符文 召唤师 云顶    │ 虚拟滚动网格               │  详情面板     │
├ 整包工具           │(新增 / 改名 / 移除角标)    │ (可拖动宽度) │
│ 下载 汉化 导航 说明 └──────────────────────────┴──────────────┘
└ 素材缓存
```

- **取图**:前端只请求 `lmt://` 协议(Windows 上为 `http://lmt.localhost/`),由 Go `Store` 拉取 Data Dragon / CommunityDragon 并写入 `%LOCALAPPDATA%\lol-material-tool\assets`。带版本号的路径永久缓存,`versions.json` 与 CommunityDragon 版本索引 1 小时,其余 7 天;并发上限 12,同一路径合并请求,404 在内存记 10 分钟,离线时返回旧缓存。
- **目录**:`Assets.catalog(version)` 在 Go 端把一个版本的英雄 / 皮肤 / 技能 / 装备 / 符文(新旧)/ 天赋 / 召唤师技能 / 云顶汇总成一个结构,zh_CN 缺失回退 en_US,按版本记忆。
- **对比**:前端对两个版本的目录按 id 求差,得到新增 / 改名 / 移除。
- **历史原画**:`Assets.championArt` 读 CommunityDragon 对应 major.minor 版本的英雄 JSON,给出原画、未居中原画、加载图、炫彩与配色。
- **导出**:`Tasks.exportAssets` 按中文名写文件,走 `task:progress` 进度,可取消;官方已不提供的文件计入 `Missing`,不中断。
- **文字资料**:目录同时带出官方文本——英雄 `lore` / `blurb` / `allytips` / `enemytips` / `info` / `stats`、技能 `description` 与 `cooldownBurn` / `costBurn`(按 `resource` 模板拼出「55/65/75 法力」)/ `rangeBurn`、装备 `description` / `from` / `into` / `gold`、符文 `shortDesc` / `longDesc`、旧符文与天赋 `description`(天赋按等级逐条)、召唤师技能冷却与解锁等级、云顶 `cost` 与 `description` / `shortDescription`;皮肤背景、稀有度、绝版与系列来自 CommunityDragon(`skinlines.json`)。前端 `RichText` 把 Riot 标记解析成节点树再渲染(不用 innerHTML),官方没填的数值(`@HealAmount@`、`<placeholder>`)显示为「?」。
- **皮肤与英雄**:皮肤页按英雄分组(组标题可点开英雄详情),支持只看某位英雄。
- **前端状态**:TanStack Query 管请求缓存,Zustand 管分区 / 版本 / 选中项 / 筛选,TanStack Virtual 渲染上百张卡片的网格。

## 3. 验证

| 项 | 方法 | 结果 |
|---|---|---|
| 旧版本汉化 | 合成 3.6.14 布局数据包(无 championFull、皮肤无 num、根目录原画、rune / mastery)跑 `LocalizeLoL`;13.1 前版本跑 `LocalizeTFT` 报错且不建目录 | 通过 |
| 整包可用性 | 真实接口 `CheckPack`:最新版可用、7.24.2 不可用 | 通过 |
| 目录 | 真实接口:16.21.1 与 3.6.14 的目录(3.6.14 阿狸皮肤数 > 0、有旧符文与天赋) | 通过 |
| 历史原画 | 真实接口:CommunityDragon 7.1 / 10.1 / 14.10 的英雄原画 | 通过 |
| 缓存与导出 | 真实接口拉取并写盘、TTL 规则、路径校验、导出文件名清洗 | 通过 |
| 文字资料 | 真实接口:16.21.1 阿狸背景 / 技巧 / 评分 / 属性、Q 的冷却与「…法力」消耗、无尽之刃描述与合成路线、符文与闪现说明、海克斯强化说明与弈子费用;3.6.14 旧符文与天赋说明;CommunityDragon 14.10 皮肤背景、系列、稀有度;消耗模板与天赋多等级的单元测试;16.21.1 全部 3634 段文本经解析后无残留标记或占位符 | 通过 |
| 前端 / 打包 | `bun run typecheck`、`bun run build` | 通过 |
| 冒烟 | 启动 exe,经 `http://lmt.localhost` 缓存了 16.21.1 的 zh_CN JSON 与首屏头像 | 通过 |
| 界面 | 侧边栏、网格、详情、对比角标、历史原画切换、炫彩、Ctrl+K、导出、下载页整包提示 | 待用户验收 |

## 4. 已知限制

- CommunityDragon 不是官方服务,路径或可用性可能变化;7.1 以前没有历史原画。
- 7.x 以前的整包里原画很少,汉化结果中的皮肤原画会相应缺失。
- 召唤师技能、旧符文、天赋共用简单详情,不做版本内差异以外的历史追溯。
