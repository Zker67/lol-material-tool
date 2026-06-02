"""
Global Constants
"""

# API URL
VERSIONS_API_URL = "https://ddragon.leagueoflegends.com/api/versions.json"

# League of Legends Data
LEAGUE_DATA_SUBFOLDER_NAME = "联盟官方数据包"
LOL_ORGANIZED_CHAMPION_SUBFOLDER_NAME = "英雄"
LOL_ORGANIZED_ITEM_SUBFOLDER_NAME = "装备"
LOL_ORGANIZED_RUNE_SUBFOLDER_NAME = "符文"
LOL_BASE_CHAMPION_ICONS_FOLDER_NAME = "头像"
LOL_CHAMPION_SKILLS_FOLDER_NAME = "英雄技能"

# Image Mapping
IMAGE_SUBFOLDER_MAPPING = {
    "centered": "聚焦图片",
    "loading": "加载界面",
    "splash": "插画",
    "tiles": "皮肤头像"
}

# Rune Categories
RUNE_CATEGORIES_INFO = {
    "Precision": "精密",
    "Domination": "主宰",
    "Sorcery": "巫术",
    "Resolve": "坚决",
    "Inspiration": "启迪"
}

# StatMods
STATMODS_FOLDER_NAME = "属性点"
STATMODS_MAPPING = {
    "StatModsTenacityIcon.png": "属性点 韧性.png",
    "StatModsMovementSpeedIcon.png": "属性点 移速.png",
    "StatModsMagicResIcon.png": "属性点 魔抗.png",
    "StatModsHealthScalingIcon.png": "属性点 成长生命值.png",
    "StatModsHealthPlusIcon.png": "属性点 生命值.png",
    "StatModsCDRScalingIcon.png": "属性点 技能急速.png",
    "StatModsAttackSpeedIcon.png": "属性点 攻速.png",
    "StatModsArmorIcon.png": "属性点 护甲.png",
    "StatModsAdaptiveForceScalingIcon.png": "属性点 成长适应之力.png",
    "StatModsAdaptiveForceIcon.png": "属性点 适应之力.png"
}

# TFT Configuration
TFT_ORGANIZED_CHAMPION_SUBFOLDER_NAME = "弈子"
TFT_ORGANIZED_ITEM_SUBFOLDER_NAME = "装备"
TFT_ORGANIZED_AUGMENT_SUBFOLDER_NAME = "海克斯强化"
TFT_ORGANIZED_ARENA_SUBFOLDER_NAME = "棋盘皮肤"
TFT_ORGANIZED_TACTICIAN_SUBFOLDER_NAME = "小小英雄"
TFT_ORGANIZED_TRAIT_SUBFOLDER_NAME = "羁绊"
TFT_ORGANIZED_PORTAL_SUBFOLDER_NAME = "地区传送门"

TFT_LOCALIZATION_CONFIG = [
    {"json_file": "tft-arena.json", "target_folder_name": TFT_ORGANIZED_ARENA_SUBFOLDER_NAME, "comment": "棋盘皮肤", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-arena"},
    {"json_file": "tft-augments.json", "target_folder_name": TFT_ORGANIZED_AUGMENT_SUBFOLDER_NAME, "comment": "海克斯强化", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-augment"},
    {"json_file": "tft-champion.json", "target_folder_name": TFT_ORGANIZED_CHAMPION_SUBFOLDER_NAME, "comment": "弈子", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-champion"},
    {"json_file": "tft-item.json", "target_folder_name": TFT_ORGANIZED_ITEM_SUBFOLDER_NAME, "comment": "装备", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-item"},
    {"json_file": "tft-tactician.json", "target_folder_name": TFT_ORGANIZED_TACTICIAN_SUBFOLDER_NAME, "comment": "小小英雄", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-tactician"},
    {"json_file": "tft-trait.json", "target_folder_name": TFT_ORGANIZED_TRAIT_SUBFOLDER_NAME, "comment": "羁绊", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-trait"},
    {"json_file": "tft-region-portals.json", "target_folder_name": TFT_ORGANIZED_PORTAL_SUBFOLDER_NAME, "comment": "地区传送门", "image_object_key": "image", "img_full_json_key": "full", "img_group_override": "tft-region-portal"},
]

EMPTY_STATS = {"created_newly": 0, "skipped": 0, "errors": 0}
