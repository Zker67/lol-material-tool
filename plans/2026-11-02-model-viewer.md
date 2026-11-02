# 3D 模型查看与导出(第一阶段):lol-material-tool

> **状态**:📋 待执行。只做**静态模型**(绑定姿势,无骨骼动画),数据来自 CommunityDragon 已转好的 OBJ + PNG。
> **范围**:在 [素材浏览](./2026-10-26-asset-browser.md) 的英雄 / 皮肤详情中新增「模型」页签:按版本查看任意皮肤的 3D 模型,可旋转缩放、开关部件、截透明背景图、导出 GLB 或 OBJ + PNG。

---

## 1. 目标与非目标

| 目标 | 非目标(第二阶段再议) |
|---|---|
| 按版本加载某个皮肤的全部部件(身体、尾巴、武器、宠物等)并正确贴图 | 骨骼 `.skl`、动画 `.anm`、摆姿势 |
| 默认隐藏游戏里初始隐藏的部件(如大招形态、道具),可手动打开 | 读本地游戏 WAD、解析 `.skn` 二进制 |
| 截图:透明背景 PNG,分辨率高于窗口 | 特效(particles)、材质高级效果(菲涅尔、流光、遮罩) |
| 导出:GLB(带贴图)、OBJ + PNG 原文件 | 小兵野怪、小小英雄、云顶棋盘(结构不同,另立计划) |
| 复用现有 `lmt://` 缓存、保存位置、导出进度 | 抓取 Khada(modelviewer.lol)的数据 |

## 2. 数据源实测(2026-11-02,以阿狸为样本)

目录列表走 `https://raw.communitydragon.org/json/{patch}/...`(即缓存里的 `cdragon/json/`),文件走 `https://raw.communitydragon.org/{patch}/...`。**不带 User-Agent 的请求会 403**(Python urllib 实测);Go 默认 UA 现在能通,但实现时要在 `Store` 里显式设置 UA。

| 事实 | 影响 |
|---|---|
| `game/data/characters/ahri/skins/skin{N}.bin.json` 是皮肤配置,`N` 即 Data Dragon 的皮肤 `num`(不补零) | 用目录里已有的 `num` 直接定位 |
| bin 里带 `skinMeshProperties` 的那一项给出 `simpleSkin`(`.skn` 路径)、默认 `texture`、`materialOverride[]`(按 `submesh` 指定 `texture` 或 `Material`)、`initialSubmeshToHide`、`skinScale` | 部件、贴图、默认隐藏全部以 bin 为准,不靠文件名猜测 |
| 10.1 起 bin 的顶层键可能是哈希(`{2a5deb8f}`),13.1 起是可读名 `Characters/Ahri/Skins/Skin0` | 遍历顶层值找含 `skinMeshProperties` 的对象,不按键名取 |
| `Material` 指向同一 bin 里的 `StaticMaterialDef`,其 `samplerValues` 中 `TextureName == "Diffuse_Texture"` 的 `texturePath` 就是漫反射贴图 | 解析材质时只取 Diffuse,找不到就回退默认 `texture` |
| `initialSubmeshToHide` 是空格或「逗号 + 空格」分隔的部件名,如 `Tail_Large Body_Proxy`、`Skin14_Tail_All_Mat, Ult_Form, ...` | 按 `[\s,]+` 拆分 |
| `.skn` 旁边有同名目录,里面每个部件一个 OBJ,**文件名就是 submesh 名**:`ahri_base/Body.obj`、`Eyes.obj`、`Tails.obj`;skin14 有 9 个部件,skin28 带 `Props` / `Stairs` | 部件列表 = 列出该目录的 `*.obj` |
| OBJ 只有 `v` / `vt` / `vn` / `f`,没有 `mtllib` / `usemtl` / 分组;面行有多余斜杠(`75/75/75/`) | 贴图由我们按部件指定;需确认 three.js `OBJLoader` 能容忍这种面行 |
| bin 里的贴图是 `.tex`(新)或 `.dds`(旧),CDragon 同路径提供小写 `.png`(还有 `2x_` / `4x_` 缩小版) | 路径转小写、扩展名换成 `.png` |
| 少数补丁的文件带构建后缀:13.10 的目录叫 `ahri_base.skins_ahri_asu_prepro/`,贴图叫 `ahri_base_tx_cm.skins_ahri_asu_prepro.png` | 精确名找不到时,在同目录列表里找「主名 + `.` + 后缀」的变体 |
| 覆盖范围:16.21、15.1、14.1、13.24、13.10、13.1、12.1、11.10、10.10、10.1、9.23、9.18、9.12 都有 OBJ;**9.1 没有模型目录,8.1、7.1 整个 skins 目录 404** | 不写死起始版本;取不到时显示「该版本没有模型」 |
| 旧版本模型完全不同(13.1 是阿狸重做前的 `ahri/gumiho_base_body_MD_dfddd3.obj`,单个部件) | 天然支持「按版本看旧模型」,和历史原画一致 |
| 英雄目录名是小写英雄 alias(`ahri`) | 从现有 `ChampionArtFor` 读取的英雄 JSON 中取 `alias` 后转小写,不用 Data Dragon 的 id 猜 |

## 3. 设计

### Go 端(`internal/material/model.go`,不依赖 MyGo)

```go
type SkinModel struct {
    Patch string      `json:"patch"`
    Scale float64     `json:"scale"`  // skinScale,缺省 1
    Parts []ModelPart `json:"parts"`
}

type ModelPart struct {
    Name    string `json:"name"`    // submesh 名,即 OBJ 文件名去掉扩展名
    OBJ     string `json:"obj"`     // 缓存相对路径 cdragon/{patch}/game/assets/...
    Texture string `json:"texture"` // 缓存相对路径;解析不到时为 ""
    Hidden  bool   `json:"hidden"`  // 游戏里初始隐藏
}

func SkinModelFor(ctx context.Context, s *Store, patch, alias string, num int) (*SkinModel, error)
```

解析顺序:
1. 读 `skin{num}.bin.json`,找到 `skinMeshProperties`;没有就返回 `ErrAssetNotFound`。
2. `simpleSkin` 转小写、去掉 `.skn` 得到 OBJ 目录;列出它的父目录,精确匹配或按「主名.后缀」匹配到真实目录名,再列出其中的 `*.obj`。
3. 每个部件的贴图:`materialOverride` 中 `texture` 优先;有 `Material` 时取同 bin 中该材质的 `Diffuse_Texture`;都没有用默认 `texture`。路径 `.tex` / `.dds` → `.png`,在列表中找不到时同样尝试带后缀的变体。
4. `initialSubmeshToHide` 中的部件标记 `Hidden`。
5. 只校验和拼接路径,下载仍由 `Store` 完成(OBJ 和 PNG 都是带版本号的路径,永久缓存)。

### 绑定(`main.go`)

- `Assets.SkinModel(version, key string, num int) (*material.SkinModel, error)`:与 `ChampionArt` 一样先用 `HistoryPatch` 把版本对应到补丁,再取 alias,最后调用 `SkinModelFor`。
- `Assets.SaveData(name string, data []byte) (string, error)`:截图 PNG 和 GLB 由前端生成,需要一个直接写字节的保存接口;复用 `SaveCopy` 的「重名追加序号」规则,保存位置未设置时与现有 `Save` 一样报错,由前端先选位置。
- 改完运行 `bun run generate` 重新生成 `src/mygo.ts`。

### 前端

- 依赖:只加 `three` 和 `@types/three`(`bun add three`、`bun add -d @types/three`),用自带的 `OBJLoader`、`OrbitControls`、`GLTFExporter`;**不加** `@react-three/fiber` / `drei`。查看器组件用 `React.lazy` 动态导入,three 不进首屏包。
- `src/features/browser/ModelViewer.tsx`:
  - 每个部件一个 `Mesh`,`MeshBasicMaterial` + 贴图(游戏角色基本是贴图本色,不打光更接近游戏),`alphaTest` 处理镂空;UV 方向(`texture.flipY`)按实测确定。
  - 按包围盒自动对准镜头;左键旋转、右键平移、滚轮缩放,双击复位。
  - 工具条:部件开关(默认隐藏的部件不勾选)、背景切换(透明棋盘格 / 深色)、截图、导出。
- `DetailPanel.tsx` 的 `ChampionDetail`:`DetailTab` 增加 `"model"`,页签顺序「素材 / 资料 / 模型」;跟随当前选中的皮肤(炫彩见第 6 节待确认项)。切换皮肤时销毁旧场景并释放几何体与贴图,避免显存泄漏。
- 截图:离屏用 2 倍尺寸、`alpha: true` 渲染一帧,`toBlob` 后交给 `SaveData`,文件名形如 `高丽风情 阿狸 模型.png`。
- 导出:
  - GLB:`GLTFExporter`(`binary: true`)只导出可见部件,经 `SaveData` 保存为 `{皮肤名}.glb`。
  - 原文件:把各部件 OBJ + PNG 组成 `ExportItem` 交给现有 `Tasks.ExportAssets`,输出 `{英雄}/模型/{皮肤名}/Body.obj …`,进度和取消都复用现有逻辑。
- 文案保持精简:页签「模型」,按钮「截图」「导出 GLB」「导出原文件」,空状态一句「该版本没有模型」。

## 4. 实施步骤

| # | 步骤 | 验证 |
|---|---|---|
| 1 | `model.go` + `model_test.go`:合成 bin JSON 与目录列表的单元测试(哈希键、Material 引用、逗号 / 空格分隔隐藏列表、`.tex` / `.dds` 转换、带后缀的目录与贴图) | `go test -short ./internal/...` |
| 2 | 真实接口测试:阿狸 16.21 skin0 / skin14 / skin28、13.10 skin0(带后缀)、13.1 skin0(旧模型)、9.1 返回不存在;另抽 5 位英雄的 skin0(含名字特殊的英雄,如悟空 `MonkeyKing`、卑尔维斯 `Belveth`)并确认每个部件 OBJ 与贴图都能下载 | `go test ./internal/...` |
| 3 | `Store` 显式设置 User-Agent;`main.go` 增加 `SkinModel`、`SaveData`;`bun run generate` | `go build`、`bun run typecheck` |
| 4 | `bun add three` / `bun add -d @types/three`;`ModelViewer.tsx` + `lib/assets.ts` 查询封装;接入详情面板 | `bun run typecheck`、`bun run build:web` 确认 three 在独立分块 |
| 5 | 截图、GLB、原文件导出 | 用 bun 脚本检查导出的 GLB:文件头为 `glTF`,JSON 块中 mesh 数等于可见部件数且带贴图;原文件导出的 OBJ 数等于部件数 |
| 6 | 更新项目 `README.md` 功能特性与目录结构、`plans/README.md` 状态;`bun run build` 打包 | 打包通过 |
| 7 | 界面效果(贴图方向、默认隐藏部件、截图透明度、交互手感) | **用户在真实窗口验收**,不自行截图自验 |

## 5. 验证标准

- Go:单元测试 + 真实接口测试全部通过;非法 patch / alias / num 被拒绝,路径不能越出 `cdragon/`。
- 前端:`bun run typecheck`、`bun run build` 通过;首屏包体积相对当前增长 < 50 KB(three 在懒加载分块中)。
- 功能(用户验收):阿狸默认皮肤显示身体 + 九尾,无大尾巴;skin14 默认不显示大招形态;切到 13.1 显示旧模型;9.1 显示「该版本没有模型」;截图背景透明;GLB 导入 Blender 带贴图。

## 6. 风险与待确认

| 项 | 处理 |
|---|---|
| **炫彩**:炫彩有自己的 `num` 和 bin,预计只换贴图、复用父皮肤网格 | 第 2 步实测;如果成立,详情里选中炫彩时直接加载炫彩模型,否则第一阶段只支持本体皮肤 |
| 部分部件贴图是空贴图(`empty32.tex`、`z_empty.tex`),或依赖特效材质 | 照常加载(结果透明 / 不可见);部件开关可以手动关闭 |
| 绑定姿势是 T 姿势或游戏内的初始姿势,不像官方原画那样有动作 | 第一阶段的已知限制,在空状态旁不额外解释;动画放到第二阶段 |
| CommunityDragon 非官方,目录结构或命名可能变 | 全部按 bin 和目录列表解析,并用真实接口测试兜底 |
| 单个皮肤 OBJ 合计 2–5 MB,首次加载较慢 | 显示加载进度;带版本号的路径永久缓存,第二次秒开 |
| 版权 | 与原画相同:按需拉取、本地缓存,不随程序分发;README 的免责声明已覆盖 |

## 7. 回滚

全部为新增文件 + 详情面板新增一个页签。回滚时删除 `model.go`、`ModelViewer.tsx`,去掉两个绑定和 `"model"` 页签,`bun remove three @types/three` 后重新 `bun run generate`;现有功能与缓存不受影响。
