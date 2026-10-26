// Package material 实现素材包的下载、解压与汉化整理,不依赖 MyGo,可单独测试。
package material

// 汉化相关的命名约定与映射表(对应 Flet 版 `src/config/constants.py`)。
// 映射用有序切片,保留 Flet 中的声明顺序。

// LeagueDataSubfolder 是解压后的官方数据包目录名前缀,完整为 `联盟官方数据包-{version}`。
const LeagueDataSubfolder = "联盟官方数据包"

// LoLLocalizedPrefix 是联盟汉化输出目录名前缀,完整为 `联盟数据汉化整理-{version}`。
const LoLLocalizedPrefix = "联盟数据汉化整理"

// 联盟汉化各分类子目录名
const (
	lolChampionSubfolder = "英雄"
	lolItemSubfolder     = "装备"
	lolRuneSubfolder     = "符文"
	lolMasterySubfolder  = "天赋" // 7.23 及更早的天赋系统
	lolBaseIconsFolder   = "头像"
	lolSkillsFolder      = "英雄技能"
)

type pair struct{ from, to string }

// imageSubfolderMapping 是皮肤图片子目录:英文目录名 → 中文目录名。
var imageSubfolderMapping = []pair{
	{"centered", "聚焦图片"},
	{"loading", "加载界面"},
	{"splash", "插画"},
	{"tiles", "皮肤头像"},
}

// runeCategoriesInfo 是符文五系:英文系名 → 中文系名。
var runeCategoriesInfo = []pair{
	{"Precision", "精密"},
	{"Domination", "主宰"},
	{"Sorcery", "巫术"},
	{"Resolve", "坚决"},
	{"Inspiration", "启迪"},
}

// statmodsFolderName 是符文属性点文件夹名。
const statmodsFolderName = "属性点"

// statmodsMapping 是属性点图标:原文件名 → 中文文件名。
var statmodsMapping = []pair{
	{"StatModsTenacityIcon.png", "属性点 韧性.png"},
	{"StatModsMovementSpeedIcon.png", "属性点 移速.png"},
	{"StatModsMagicResIcon.png", "属性点 魔抗.png"},
	{"StatModsHealthScalingIcon.png", "属性点 成长生命值.png"},
	{"StatModsHealthPlusIcon.png", "属性点 生命值.png"},
	{"StatModsCDRScalingIcon.png", "属性点 技能急速.png"},
	{"StatModsAttackSpeedIcon.png", "属性点 攻速.png"},
	{"StatModsArmorIcon.png", "属性点 护甲.png"},
	{"StatModsAdaptiveForceScalingIcon.png", "属性点 成长适应之力.png"},
	{"StatModsAdaptiveForceIcon.png", "属性点 适应之力.png"},
}

// TFTLocalizedPrefix 是云顶汉化输出目录名前缀,完整为 `云顶数据汉化整理-{version}`。
const TFTLocalizedPrefix = "云顶数据汉化整理"

// tftCategory 是云顶汉化的一类配置。
type tftCategory struct {
	jsonFile     string // zh_CN 下的 JSON 文件名
	targetFolder string // 中文子目录名
	imgGroup     string // img 下的子目录名
}

// tftLocalizationConfig 是云顶汉化各类配置。
// 注意 JSON 文件名与 img 组名不完全一致(augments→augment、portals→portal)。
var tftLocalizationConfig = []tftCategory{
	{"tft-arena.json", "棋盘皮肤", "tft-arena"},
	{"tft-augments.json", "海克斯强化", "tft-augment"},
	{"tft-champion.json", "弈子", "tft-champion"},
	{"tft-item.json", "装备", "tft-item"},
	{"tft-tactician.json", "小小英雄", "tft-tactician"},
	{"tft-trait.json", "羁绊", "tft-trait"},
	{"tft-region-portals.json", "地区传送门", "tft-region-portal"},
}
