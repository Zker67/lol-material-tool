//! 汉化相关的命名约定与映射表(对应 Flet 版 `src/config/constants.py`)。
//! 映射用 `&[(&str, &str)]` 静态数组,保留 Flet 中的声明顺序。

/// 解压后的官方数据包目录名前缀,完整为 `联盟官方数据包-{version}`。
pub const LEAGUE_DATA_SUBFOLDER: &str = "联盟官方数据包";

/// 联盟汉化输出目录名前缀,完整为 `联盟数据汉化整理-{version}`。
pub const LOL_LOCALIZED_PREFIX: &str = "联盟数据汉化整理";

// 联盟汉化各分类子目录名
pub const LOL_CHAMPION_SUBFOLDER: &str = "英雄";
pub const LOL_ITEM_SUBFOLDER: &str = "装备";
pub const LOL_RUNE_SUBFOLDER: &str = "符文";
pub const LOL_BASE_ICONS_FOLDER: &str = "头像";
pub const LOL_SKILLS_FOLDER: &str = "英雄技能";

/// 皮肤图片子目录:英文目录名 → 中文目录名。
pub const IMAGE_SUBFOLDER_MAPPING: &[(&str, &str)] = &[
    ("centered", "聚焦图片"),
    ("loading", "加载界面"),
    ("splash", "插画"),
    ("tiles", "皮肤头像"),
];

/// 符文五系:英文系名 → 中文系名。
pub const RUNE_CATEGORIES_INFO: &[(&str, &str)] = &[
    ("Precision", "精密"),
    ("Domination", "主宰"),
    ("Sorcery", "巫术"),
    ("Resolve", "坚决"),
    ("Inspiration", "启迪"),
];

/// 符文属性点文件夹名。
pub const STATMODS_FOLDER_NAME: &str = "属性点";

/// 属性点图标:原文件名 → 中文文件名。
pub const STATMODS_MAPPING: &[(&str, &str)] = &[
    ("StatModsTenacityIcon.png", "属性点 韧性.png"),
    ("StatModsMovementSpeedIcon.png", "属性点 移速.png"),
    ("StatModsMagicResIcon.png", "属性点 魔抗.png"),
    ("StatModsHealthScalingIcon.png", "属性点 成长生命值.png"),
    ("StatModsHealthPlusIcon.png", "属性点 生命值.png"),
    ("StatModsCDRScalingIcon.png", "属性点 技能急速.png"),
    ("StatModsAttackSpeedIcon.png", "属性点 攻速.png"),
    ("StatModsArmorIcon.png", "属性点 护甲.png"),
    ("StatModsAdaptiveForceScalingIcon.png", "属性点 成长适应之力.png"),
    ("StatModsAdaptiveForceIcon.png", "属性点 适应之力.png"),
];
