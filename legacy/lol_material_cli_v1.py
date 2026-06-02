import json
import os
import re
from pathlib import Path
import tarfile
import subprocess
import sys
import time
import requests
import shutil
import concurrent.futures
import threading

print_lock = threading.Lock()
def safe_print(*args, **kwargs):
    with print_lock:
        print(*args, **kwargs)

# --- 全局配置 ---
# API URL
VERSIONS_API_URL = "https://ddragon.leagueoflegends.com/api/versions.json"
# 原始数据文件夹
LEAGUE_DATA_SUBFOLDER_NAME = "联盟官方数据包"

# --- 英雄联盟配置 ---
LOL_ORGANIZED_CHAMPION_SUBFOLDER_NAME = "英雄"
LOL_ORGANIZED_ITEM_SUBFOLDER_NAME = "装备"
LOL_ORGANIZED_RUNE_SUBFOLDER_NAME = "符文"
LOL_BASE_CHAMPION_ICONS_FOLDER_NAME = "头像"
LOL_CHAMPION_SKILLS_FOLDER_NAME = "英雄技能"
IMAGE_SUBFOLDER_MAPPING = {
    "centered": "聚焦图片", "loading": "加载界面", "splash": "插画", "tiles": "皮肤头像"
}
RUNE_CATEGORIES_INFO = {
    "Precision": "精密", "Domination": "主宰", "Sorcery": "巫术", "Resolve": "坚决", "Inspiration": "启迪"
}
STATMODS_FOLDER_NAME = "属性点"
STATMODS_MAPPING = {
    "StatModsTenacityIcon.png": "属性点 韌性.png", "StatModsMovementSpeedIcon.png": "属性点 移速.png",
    "StatModsMagicResIcon.png": "属性点 魔抗.png", "StatModsHealthScalingIcon.png": "属性点 成長生命值.png",
    "StatModsHealthPlusIcon.png": "属性点 生命值.png", "StatModsCDRScalingIcon.png": "属性点 技能急速.png",
    "StatModsAttackSpeedIcon.png": "属性点 攻速.png", "StatModsArmorIcon.png": "属性点 護甲.png",
    "StatModsAdaptiveForceScalingIcon.png": "属性点 成長自適應之力.png", "StatModsAdaptiveForceIcon.png": "属性点 自適應之力.png"
}

# --- 云顶之弈配置 ---
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

# --- 导航树配置 ---
NAVIGABLE_LOL_PATHS_DATA = [
    {"label": "当前版本特定文件 ({version})", "path_parts": ["{version}"], "comment": "📄 包含当前版本的所有数据和图片", "is_localizable_source": False},
    {"label": "  ├─ data (JSON数据)", "path_parts": ["{version}", "data"], "comment": "📄 存储了不同语言的json文件", "is_localizable_source": True},
    {"label": "  ├─ img (版本特定图片)", "path_parts": ["{version}", "img"], "comment": "🖼️ 版本相关图片", "is_localizable_source": False},
    {"label": "  │  ├─ champion (英雄头像)", "path_parts": ["{version}", "img", "champion"], "comment": "🖼️ 该版本基础英雄头像", "is_localizable_source": True},
    {"label": "  │  ├─ item (装备图标)", "path_parts": ["{version}", "img", "item"], "comment": "🛠️ 装备图标", "is_localizable_source": True},
    {"label": "  │  ├─ passive (英雄被动技能图标)", "path_parts": ["{version}", "img", "passive"], "comment": "💥 英雄被动技能图标", "is_localizable_source": True},
    {"label": "  │  ├─ spell (英雄QWER技能图标)", "path_parts": ["{version}", "img", "spell"], "comment": "💥 英雄QWER技能图标", "is_localizable_source": True},
    {"label": "img (通用图片资源)", "path_parts": ["img"], "comment": "🖼️ 与版本不太相关的图片", "is_localizable_source": False},
    {"label": "  ├─ champion (英雄皮肤等)", "path_parts": ["img", "champion"], "comment": "🦸 英雄皮肤、加载图等", "is_localizable_source": True},
    {"label": "  └─ perk-images (符文相关)", "path_parts": ["img", "perk-images"], "comment": "✨ 符文及属性点图标", "is_localizable_source": True},
]
NAVIGABLE_TFT_PATHS_DATA = [
    {"label": "当前版本特定文件 ({version})", "path_parts": ["{version}"], "comment": "📄 包含当前版本的所有数据和图片", "is_tft_source": False},
    {"label": "  ├─ data (JSON数据)", "path_parts": ["{version}", "data"], "comment": "📄 存储了不同语言的json文件", "is_tft_source": True},
    {"label": "  ├─ img (版本特定图片)", "path_parts": ["{version}", "img"], "comment": "🖼️ 版本相关图片", "is_tft_source": False},
    {"label": "  │  ├─ tft-arena (棋盘)", "path_parts": ["{version}", "img", "tft-arena"], "comment": "🗺️ 云顶之弈棋盘皮肤", "is_tft_source": True},
    {"label": "  │  ├─ tft-augment (海克斯强化)", "path_parts": ["{version}", "img", "tft-augment"], "comment": "⚙️ 云顶之弈海克斯强化图标", "is_tft_source": True},
    {"label": "  │  ├─ tft-champion (弈子插画)", "path_parts": ["{version}", "img", "tft-champion"], "comment": "🎨 云顶之弈弈子插画", "is_tft_source": True},
    {"label": "  │  ├─ tft-item (装备)", "path_parts": ["{version}", "img", "tft-item"], "comment": "🛠️ 云顶之弈装备图标", "is_tft_source": True},
    {"label": "  │  ├─ tft-region-portal (地区传送门)", "path_parts": ["{version}", "img", "tft-region-portal"], "comment": "🌀 云顶之弈地区传送门图标", "is_tft_source": True},
    {"label": "  │  ├─ tft-tactician (小小英雄)", "path_parts": ["{version}", "img", "tft-tactician"], "comment": "🐧 云顶之弈小小英雄", "is_tft_source": True},
    {"label": "  │  └─ tft-trait (羁绊)", "path_parts": ["{version}", "img", "tft-trait"], "comment": "🔗 云顶之弈羁绊图标", "is_tft_source": True}
]

# --- 辅助函数 ---
def get_visual_width(s: str) -> int:
    width = 0
    for char in s:
        if '\u4e00' <= char <= '\u9fff': width += 2
        else: width += 1
    return width

def format_time(seconds: float) -> str:
    if seconds < 0: return "--:--"
    if seconds >= 3600: return f"{int(seconds // 3600):02d}:{int((seconds % 3600) // 60):02d}:{int(seconds % 60):02d}"
    elif seconds >= 60: return f"{int(seconds // 60):02d}:{int(seconds % 60):02d}"
    else: return f"{int(seconds):02d}s"

def get_all_versions() -> list[str] | None:
    try:
        print(f"ℹ️ 正在从 API 获取所有可用版本: {VERSIONS_API_URL}")
        response = requests.get(VERSIONS_API_URL, timeout=15)
        response.raise_for_status()
        print("✅ 版本列表获取成功。")
        versions = response.json()
        if versions and isinstance(versions, list): return versions
        print("⚠️ API 返回的数据格式不正确或为空。")
        return None
    except Exception as e:
        print(f"❌ 访问或解析版本 API 时发生错误: {e}")
        return None

def open_folder_in_explorer(folder_path: Path):
    if not folder_path.exists(): print(f"❗ 错误: 文件夹 {folder_path} 不存在，无法打开。"); return
    print(f"\n📂 正在尝试打开并定位到文件夹: {folder_path}")
    try:
        if sys.platform == "win32": command = ['explorer', str(folder_path)]
        elif sys.platform == "darwin": command = ['open', str(folder_path)]
        else: command = ['xdg-open', str(folder_path)]
        subprocess.run(command)
        print(f"✅ 已尝试在文件管理器中打开 {folder_path.name}。")
    except Exception as e: print(f"❗ 打开文件夹 {folder_path.name} 时发生错误: {e}。请手动打开。")

def get_local_data_version(league_data_path: Path) -> str | None:
    if not league_data_path.is_dir(): return None
    for item in league_data_path.iterdir():
        if item.is_dir() and re.fullmatch(r'\d+\.\d+\.\d+', item.name):
            if (item / "data").is_dir() and (item / "img").is_dir(): return item.name
    return None

def download_and_extract_data_pack(version_str: str, output_directory_root: Path | None = None) -> tuple[Path | None, str | None]:
    if not version_str: print("❌ 版本号无效。"); return None, None
    url = f"https://ddragon.leagueoflegends.com/cdn/dragontail-{version_str}.tgz"
    base_downloads_path = Path(output_directory_root or Path.home() / "Downloads")
    original_data_extraction_path = base_downloads_path / LEAGUE_DATA_SUBFOLDER_NAME
    tgz_file_path = base_downloads_path / Path(url).name
    try:
        print(f"🚀 开始下载联盟官方数据包 (版本: {version_str}): {url}")
        print(f"⏳ .tgz 文件临时保存为: {tgz_file_path}")
        start_time = time.time()
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            downloaded_size = 0
            with open(tgz_file_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    elapsed_time = time.time() - start_time
                    speed = (downloaded_size / (1024*1024)) / elapsed_time if elapsed_time > 0 else 0
                    remaining_time = ((total_size - downloaded_size) / (1024*1024)) / speed if speed > 0 and total_size > 0 else -1
                    print(f"\r📊 {downloaded_size/(1024*1024):.2f}/{total_size/(1024*1024):.2f} MB ({downloaded_size*100/total_size if total_size > 0 else 0:.2f}%) | {speed:.2f} MB/s | 已用: {format_time(elapsed_time)} | 剩余: {format_time(remaining_time)}   ", end="")
            print(f"\n✅ .tgz 文件下载完成！总用时: {format_time(time.time() - start_time)}")
        if original_data_extraction_path.exists():
            print(f"ℹ️ 目标文件夹 「{LEAGUE_DATA_SUBFOLDER_NAME}」 已存在，将清空并重新解压。")
            try: shutil.rmtree(original_data_extraction_path)
            except Exception as e_rm: print(f"❌ 清空旧的 「{LEAGUE_DATA_SUBFOLDER_NAME}」 文件夹失败: {e_rm}。"); return None, version_str
        original_data_extraction_path.mkdir(parents=True, exist_ok=True)
        print(f"💾 解压后的文件将保存到: {original_data_extraction_path}")
        print(f"\n📦 文件 {tgz_file_path.name} 已下载。开始解压...")
        with tarfile.open(tgz_file_path, "r:gz") as tgz:
            members = tgz.getmembers()
            total_members = len(members)
            print(f"ℹ️ 压缩包内共计 {total_members} 个文件/文件夹。")
            for i, member in enumerate(members):
                tgz.extract(member, path=original_data_extraction_path, filter='data')
                progress_percentage = ((i + 1) / total_members) * 100 if total_members > 0 else 0
                print(f"\r🔄 正在解压: {i+1}/{total_members} 个项目 ({progress_percentage:.2f}%) - {member.name[:50]:<50}...", end="")
            print(f"\n✅ tgz 文件内容已全部解压到: {original_data_extraction_path}")
        return original_data_extraction_path, version_str
    except Exception as e: print(f"\n❌ 下载或解压时发生错误: {e}"); return None, version_str
    finally:
        if tgz_file_path.exists():
            try: os.remove(tgz_file_path); print(f"🗑️ 已删除临时 .tgz 文件: {tgz_file_path.name}")
            except OSError as e_del: print(f"❗ 删除 {tgz_file_path.name} 时出错: {e_del}")

def sanitize_filename_for_rename(name: str | None) -> str:
    if name is None: return "Unknown_Name"
    return re.sub(r'[\\/*?:"<>|]', '', name)

# --- 英雄联盟汉化函数 ---
def lol_rename_and_organize_skin_subfolders(organized_champion_path: Path) -> tuple[bool, int, int, int]:
    if not organized_champion_path.is_dir(): print(f"❌ 错误: 英雄汉化根目录 {organized_champion_path} 不存在。"); return False, 0,0,0
    created, errors, skipped = 0, 0, 0
    for old, new_zh in IMAGE_SUBFOLDER_MAPPING.items():
        old_f, new_f = organized_champion_path / old, organized_champion_path / new_zh
        if old_f.is_dir():
            if old_f == new_f: skipped += 1; continue
            try:
                if new_f.exists(): shutil.rmtree(new_f)
                old_f.rename(new_f); print(f"  ✅ 皮肤类别文件夹: {old_f.name} -> {new_f.name}"); created += 1
            except OSError as e: print(f"  ❌ 重命名皮肤类别文件夹 {old_f.name} 失败: {e}"); errors += 1
        elif new_f.is_dir(): skipped += 1
        else: print(f"  ⚠️ 警告: 原始皮肤类别文件夹 {old_f.name} 和目标 {new_f.name} 均未找到。"); errors += 1
    return errors == 0, created, skipped, errors

def lol_rename_and_move_skin_images_task(original_data_path: Path, organized_champion_path: Path, version_str: str, champ_data: dict = None) -> tuple[bool, dict]:
    fail_stats = {name: {"created_newly": 0, "skipped": 0, "errors": 0} for name in IMAGE_SUBFOLDER_MAPPING.values()}
    if not version_str: safe_print("❌ 错误: 未提供版本号 (JPG)。"); return False, fail_stats
    
    if champ_data is None:
        json_file = original_data_path / version_str / "data" / "zh_CN" / "championFull.json"
        if not json_file.is_file(): safe_print(f"❌ 错误: JSON 文件 {json_file} 未找到 (JPG)。"); return False, fail_stats
        try:
            with open(json_file, 'r', encoding='utf-8') as f: champ_data = json.load(f).get("data", {})
        except Exception as e: safe_print(f"❌ 加载或解析 JSON (JPG) 失败: {e}"); return False, fail_stats
    
    category_stats = {name: {"created_newly": 0, "skipped": 0, "errors": 0} for name in IMAGE_SUBFOLDER_MAPPING.values()}
    overall_success = True
    
    def process_image(item, chi_cat, cat_path):
        res = {"status": "skipped", "cat": chi_cat}
        if not item.is_file() or not item.name.lower().endswith(".jpg"): return res
        match = re.match(r'([A-Za-z0-9]+)_(\d+)\.jpg', item.name, re.IGNORECASE)
        if not match: return res
        
        champ_id, skin_num_str = match.groups(); skin_num = int(skin_num_str)
        info = champ_data.get(champ_id) or champ_data.get(champ_id.capitalize()) or champ_data.get(champ_id.lower())
        if not info and champ_id.lower() == "fiddlesticks": info = champ_data.get("Fiddlesticks")
        
        if not info:
            safe_print(f"  ⏭️ JPG: 英雄ID {champ_id} ({item.name}) 未找到。")
            res["status"] = "error"; return res
            
        epithet, actual_name = info.get("name"), info.get("title")
        if not epithet or not actual_name:
            safe_print(f"  ⏭️ 英雄 {champ_id} 名称/称号缺失。")
            res["status"] = "error"; return res
            
        hero_folder = cat_path / sanitize_filename_for_rename(f"{epithet} {actual_name}")
        hero_folder.mkdir(exist_ok=True)
        
        file_base = f"{epithet} {actual_name}" if skin_num == 0 else next((s.get("name") for s in info.get("skins", []) if s.get("num") == skin_num and s.get("name", "").lower() != "default"), f"{epithet} {actual_name}" if any(s.get("num") == skin_num and s.get("name", "").lower() == "default" for s in info.get("skins", [])) else None)
        
        if not file_base:
            safe_print(f"  ⏭️ 英雄 {champ_id} 皮肤 {skin_num} 名称信息不足 ({item.name})。")
            res["status"] = "error"; return res
            
        new_filename = f"{sanitize_filename_for_rename(file_base)}.jpg"
        new_filepath = hero_folder / new_filename
        
        try:
            if new_filepath.exists(): os.remove(new_filepath)
            shutil.move(str(item), str(new_filepath))
            # safe_print(f"  ✅ JPG 移动: {item.name} -> {hero_folder.name}/{new_filename}")
            res["status"] = "created"; return res
        except Exception as e:
            safe_print(f"  ❌ JPG 移动 {item.name} 失败: {e}")
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = []
        for eng_cat, chi_cat in IMAGE_SUBFOLDER_MAPPING.items():
            cat_path = organized_champion_path / chi_cat
            if not cat_path.is_dir(): continue
            for item in list(cat_path.iterdir()):
                futures.append(executor.submit(process_image, item, chi_cat, cat_path))
        
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            c = r["cat"]
            if s == "created": category_stats[c]["created_newly"] += 1
            elif s == "skipped": category_stats[c]["skipped"] += 1
            elif s == "error": category_stats[c]["errors"] += 1; overall_success = False
            
    return overall_success, category_stats

def lol_rename_and_organize_skill_icons(original_data_path: Path, skills_base_path: Path, version_str: str, champion_data: dict) -> tuple[bool, int, int, int]:
    if not champion_data: safe_print("❌ 错误: 缺少英雄 JSON 数据 (技能)。"); return False, 0, 0, 0
    src_spell = original_data_path / version_str / "img" / "spell"
    src_passive = original_data_path / version_str / "img" / "passive"
    if not src_spell.is_dir() or not src_passive.is_dir(): safe_print(f"❌ 错误: 原始技能/被动文件夹不存在。"); return False, 0, 0, 0
    skills_base_path.mkdir(exist_ok=True)
    
    created, errors, skipped = 0, 0, 0
    
    def process_skill(champ_id, info):
        res = {"created": 0, "errors": 0, "skipped": 0}
        epithet, name = info.get("name"), info.get("title")
        if not epithet or not name:
            safe_print(f"⏭️ 英雄 {champ_id} 名称/称号缺失 (技能)。")
            res["errors"] += 5; return res
            
        hero_skill_folder = skills_base_path / sanitize_filename_for_rename(f"{epithet} {name}")
        hero_skill_folder.mkdir(exist_ok=True)
        
        keys = ['Q', 'W', 'E', 'R']
        for i, spell in enumerate(info.get("spells", [])):
            key = keys[i] if i < len(keys) else "S"
            orig_file, spell_name = spell.get("image", {}).get("full"), spell.get("name")
            if not orig_file or not spell_name:
                safe_print(f"⏭️ {champ_id} {key}技能信息缺失。")
                res["errors"] += 1; continue
                
            src_f = src_spell / orig_file
            new_f_name = f"{sanitize_filename_for_rename(f'{key}技能 {spell_name}')}.png"
            final_f = hero_skill_folder / new_f_name
            
            if not src_f.is_file():
                safe_print(f"⏭️ 源文件 {src_f} 未找到。")
                res["errors"] += 1; continue
                
            try:
                if final_f.exists(): os.remove(final_f)
                shutil.copy2(src_f, final_f)
                # safe_print(f"  ✅ 技能: {orig_file} -> {hero_skill_folder.name}/{new_f_name}")
                res["created"] += 1
            except Exception as e:
                safe_print(f"  ❌ 处理技能 {orig_file} 失败: {e}")
                res["errors"] += 1
                
        passive = info.get("passive")
        if passive:
            orig_pass_file, pass_name = passive.get("image", {}).get("full"), passive.get("name")
            if orig_pass_file and pass_name:
                src_pf = src_passive / orig_pass_file
                new_pf_name = f"{sanitize_filename_for_rename(f'被动技能 {pass_name}')}.png"
                final_pf = hero_skill_folder / new_pf_name
                
                if not src_pf.is_file():
                    safe_print(f"⏭️ 源被动文件 {src_pf} 未找到。")
                    res["errors"] += 1
                else:
                    try:
                        if final_pf.exists(): os.remove(final_pf)
                        shutil.copy2(src_pf, final_pf)
                        # safe_print(f"  ✅ 被动: {orig_pass_file} -> {hero_skill_folder.name}/{new_pf_name}")
                        res["created"] += 1
                    except Exception as e:
                        safe_print(f"  ❌ 处理被动 {orig_pass_file} 失败: {e}")
                        res["errors"] += 1
            else:
                safe_print(f"⏭️ {champ_id} 被动信息缺失。")
                res["errors"] += 1
        else:
            safe_print(f"⏭️ {champ_id} 未找到被动。")
            res["errors"] += 1
        return res

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_skill, cid, info) for cid, info in champion_data.items()]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            created += r["created"]
            errors += r["errors"]
            skipped += r["skipped"]
            
    return errors == 0, created, skipped, errors

def lol_rename_base_champion_icons_task(src_folder: Path, dest_folder: Path, champion_data: dict):
    if not src_folder.is_dir() or not champion_data: safe_print(f"❌ 源头像文件夹或JSON数据缺失 (PNG)。"); return False, 0, 0, 0
    dest_folder.mkdir(exist_ok=True)
    created, errors, skipped = 0, 0, 0
    
    def process_icon(filename):
        res = {"status": "skipped"}
        if not filename.lower().endswith(".png"): return res
        
        champ_id = filename[:-4]
        info = champion_data.get(champ_id) or champion_data.get(champ_id.capitalize()) or champion_data.get(champ_id.lower())
        if not info and champ_id.lower() == "fiddlesticks": info = champion_data.get("Fiddlesticks")
        
        if not info:
            safe_print(f"⏭️ PNG: ID {champ_id} ({filename}) 未在JSON找到。")
            res["status"] = "error"; return res
            
        epithet, name = info.get("name"), info.get("title")
        if not epithet or not name:
            safe_print(f"⏭️ PNG: {champ_id} 名称/称号缺失 ({filename})。")
            res["status"] = "error"; return res
            
        new_filename = f"{sanitize_filename_for_rename(f'{epithet} {name}')}.png"
        dest_fp = dest_folder / new_filename
        
        if (src_folder / filename) == dest_fp: return res
        
        try:
            if dest_fp.exists(): os.remove(dest_fp)
            shutil.copy2(src_folder / filename, dest_fp)
            # safe_print(f"  ✅ PNG: {filename} -> {new_filename}")
            res["status"] = "created"; return res
        except Exception as e:
            safe_print(f"  ❌ PNG复制 {filename} 失败: {e}")
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_icon, f) for f in os.listdir(src_folder)]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": created += 1
            elif s == "skipped": skipped += 1
            elif s == "error": errors += 1
            
    return errors == 0, created, skipped, errors

def lol_rename_item_images_task(original_data_path: Path, organized_item_path: Path, version_str: str) -> tuple[bool, int, int, int]:
    if not version_str: safe_print("❌ 未提供版本号 (装备)。"); return False, 0, 0, 0
    src_path = original_data_path / version_str / "img" / "item"
    json_path = original_data_path / version_str / "data" / "zh_CN" / "item.json"
    if not src_path.is_dir() or not json_path.is_file(): safe_print(f"❌ 原始装备图片或JSON文件夹不存在。"); return False, 0, 0, 0
    try:
        with open(json_path, 'r', encoding='utf-8') as f: item_data = json.load(f).get("data", {})
    except Exception as e: safe_print(f"❌ 加载或解析装备 JSON 失败: {e}"); return False, 0, 0, 0
    organized_item_path.mkdir(exist_ok=True)
    created, errors, skipped = 0, 0, 0
    
    def process_item(filename):
        res = {"status": "skipped"}
        if not filename.lower().endswith(".png"): return res
        
        item_id = filename[:-4]
        info = item_data.get(item_id)
        if not info:
            safe_print(f"⏭️ 装备: ID {item_id} ({filename}) 未在JSON找到。")
            res["status"] = "error"; return res
            
        name_zh = info.get("name")
        if not name_zh:
            safe_print(f"⏭️ 装备: ID {item_id} 中文名缺失 ({filename})。")
            res["status"] = "error"; return res
            
        new_filename = f"{sanitize_filename_for_rename(name_zh)}.png"
        dest_file = organized_item_path / new_filename
        
        try:
            if dest_file.exists(): os.remove(dest_file)
            shutil.copy2(src_path / filename, dest_file)
            # safe_print(f"  ✅ 装备图片: {filename} -> {new_filename}")
            res["status"] = "created"; return res
        except Exception as e:
            safe_print(f"  ❌ 复制装备 {filename} 失败: {e}")
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_item, f) for f in os.listdir(src_path)]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": created += 1
            elif s == "skipped": skipped += 1
            elif s == "error": errors += 1
            
    return errors == 0, created, skipped, errors

def lol_rename_rune_images_task(original_data_path: Path, organized_rune_path: Path, version_str: str, suppress_summary_internal=False):
    if not suppress_summary_internal: safe_print(f"\n✨ 符文 开始处理...")
    if not version_str: safe_print("❌ 未提供版本号 (符文)。"); return False, dict(EMPTY_STATS), dict(EMPTY_STATS), dict(EMPTY_STATS)
    src_perk_path = original_data_path / "img" / "perk-images"
    json_rune_path = original_data_path / version_str / "data" / "zh_CN" / "runesReforged.json"
    if not src_perk_path.is_dir(): src_perk_path = original_data_path / version_str / "img" / "perk-images"
    if not src_perk_path.is_dir(): safe_print(f"❌ 原始符文图片文件夹不存在。"); return False, dict(EMPTY_STATS), dict(EMPTY_STATS), dict(EMPTY_STATS)
    if not json_rune_path.is_file(): safe_print(f"❌ 无法找到符文 JSON 文件。"); return False, dict(EMPTY_STATS), dict(EMPTY_STATS), dict(EMPTY_STATS)
    try:
        with open(json_rune_path, 'r', encoding='utf-8') as f: runes_data = json.load(f)
        if not suppress_summary_internal: safe_print(f"✅ 符文 JSON 文件加载成功。")
    except Exception as e: safe_print(f"❌ 加载或解析符文 JSON 文件失败: {e}"); return False, dict(EMPTY_STATS), dict(EMPTY_STATS), dict(EMPTY_STATS)
    
    organized_rune_path.mkdir(exist_ok=True)
    for cat_name in RUNE_CATEGORIES_INFO.values(): (organized_rune_path / cat_name).mkdir(exist_ok=True)
    (organized_rune_path / STATMODS_FOLDER_NAME).mkdir(exist_ok=True)
    
    main_stats = {"created_newly": 0, "skipped": 0, "errors": 0}
    sub_stats = {"created_newly": 0, "skipped": 0, "errors": 0}
    statmod_stats = {"created_newly": 0, "skipped": 0, "errors": 0}
    
    tasks = []
    
    def process_rune_category(cat_data):
        m_stats = {"created": 0, "errors": 0, "skipped": 0}
        s_stats = {"created": 0, "errors": 0, "skipped": 0}
        
        cat_name, cat_icon = cat_data.get("name"), cat_data.get("icon")
        if not cat_name or not cat_icon:
            safe_print(f"⚠️ 警告: JSON中符文系数据不完整。")
            return "cat", m_stats, s_stats
            
        dest_cat_folder = organized_rune_path / cat_name
        src_cat_icon = src_perk_path / Path(cat_icon).relative_to("perk-images")
        
        if src_cat_icon.is_file():
            new_cat_filename = f"{sanitize_filename_for_rename(cat_name)}.png"
            dest_cat_file = dest_cat_folder / new_cat_filename
            try:
                if dest_cat_file.exists(): os.remove(dest_cat_file)
                shutil.copy2(src_cat_icon, dest_cat_file)
                # safe_print(f"  ✅ 符文系图标: {Path(cat_icon).name} -> {cat_name}/{new_cat_filename}")
                m_stats["created"] += 1
            except Exception as e:
                safe_print(f"  ❌ 复制符文系图标 {Path(cat_icon).name} 失败: {e}")
                m_stats["errors"] += 1
        else:
            safe_print(f"  ⚠️ 未找到符文系图标源文件: {src_cat_icon}")
            m_stats["errors"] += 1
            
        for slot in cat_data.get("slots", []):
            for rune in slot.get("runes", []):
                rune_name, rune_icon = rune.get("name"), rune.get("icon")
                if not rune_name or not rune_icon:
                    safe_print(f"  ⏭️ 符文信息不完整 ({cat_name} 系)。")
                    s_stats["errors"] += 1; continue
                    
                src_rune_icon = src_perk_path / Path(rune_icon).relative_to("perk-images")
                new_rune_filename = f"{sanitize_filename_for_rename(rune_name)}.png"
                dest_rune_file = dest_cat_folder / new_rune_filename
                
                if not src_rune_icon.is_file():
                    safe_print(f"  ⏭️ 未找到符文图标源文件: {src_rune_icon}")
                    s_stats["errors"] += 1; continue
                    
                try:
                    if dest_rune_file.exists(): os.remove(dest_rune_file)
                    shutil.copy2(src_rune_icon, dest_rune_file)
                    # safe_print(f"    ✅ 具体符文: {Path(rune_icon).name} -> {cat_name}/{new_rune_filename}")
                    s_stats["created"] += 1
                except Exception as e:
                    safe_print(f"    ❌ 复制具体符文 {Path(rune_icon).name} 失败: {e}")
                    s_stats["errors"] += 1
        return "cat", m_stats, s_stats

    def process_statmods():
        sm_stats = {"created": 0, "errors": 0, "skipped": 0}
        src_statmods_path = src_perk_path / "StatMods"
        if src_statmods_path.is_dir():
            for orig, new in STATMODS_MAPPING.items():
                src_file, dest_file = src_statmods_path / orig, organized_rune_path / STATMODS_FOLDER_NAME / new
                if not src_file.is_file():
                    safe_print(f"  ⏭️ 未找到属性点源文件: {src_file}")
                    sm_stats["errors"] += 1; continue
                try:
                    if dest_file.exists(): os.remove(dest_file)
                    shutil.copy2(src_file, dest_file)
                    # safe_print(f"  ✅ 属性点: {orig} -> {STATMODS_FOLDER_NAME}/{new}")
                    sm_stats["created"] += 1
                except Exception as e:
                    safe_print(f"  ❌ 复制属性点 {orig} 失败: {e}")
                    sm_stats["errors"] += 1
        else:
            safe_print(f"❌ 原始属性点图片文件夹 {src_statmods_path} 不存在。")
        return "statmod", sm_stats, None

    with concurrent.futures.ThreadPoolExecutor() as executor:
        for cat_data in runes_data:
            tasks.append(executor.submit(process_rune_category, cat_data))
        tasks.append(executor.submit(process_statmods))
        
        for future in concurrent.futures.as_completed(tasks):
            type_, stats1, stats2 = future.result()
            if type_ == "cat":
                main_stats["created_newly"] += stats1["created"]; main_stats["errors"] += stats1["errors"]; main_stats["skipped"] += stats1["skipped"]
                sub_stats["created_newly"] += stats2["created"]; sub_stats["errors"] += stats2["errors"]; sub_stats["skipped"] += stats2["skipped"]
            elif type_ == "statmod":
                statmod_stats["created_newly"] += stats1["created"]; statmod_stats["errors"] += stats1["errors"]; statmod_stats["skipped"] += stats1["skipped"]

    if not suppress_summary_internal:
        safe_print(f"\n符文 图片汉化完成统计:")
        safe_print(f"  符文系图标: [新建]: {main_stats['created_newly']}, [跳过]: {main_stats['skipped']}, [错误]: {main_stats['errors']}")
        safe_print(f"  具体符文图标: [新建]: {sub_stats['created_newly']}, [跳过]: {sub_stats['skipped']}, [错误]: {sub_stats['errors']}")
        safe_print(f"  属性点图标: [新建]: {statmod_stats['created_newly']}, [跳过]: {statmod_stats['skipped']}, [错误]: {statmod_stats['errors']}")
        
    return (main_stats["errors"] + sub_stats["errors"] + statmod_stats["errors"]) == 0, main_stats, sub_stats, statmod_stats

# --- 英雄联盟汉化执行器 ---
def execute_lol_hero_localization(version, base_path, organized_path, suppress_summary=False):
    if not suppress_summary: safe_print("\n🦸 英雄汉化开始...")
    organized_champion_path = organized_path / LOL_ORGANIZED_CHAMPION_SUBFOLDER_NAME
    hero_stats = {"skin_jpgs_by_type": {name: dict(EMPTY_STATS) for name in IMAGE_SUBFOLDER_MAPPING.values()},"base_icons_png": dict(EMPTY_STATS),"skill_icons": dict(EMPTY_STATS)}
    all_successful = True
    try:
        if organized_champion_path.exists(): shutil.rmtree(organized_champion_path)
        organized_champion_path.mkdir(exist_ok=True)
        if not suppress_summary: safe_print(f"✅ 已创建/确认英雄工作文件夹: {organized_champion_path}")
    except Exception as e: safe_print(f"❌ 创建/清理目录 「{organized_champion_path}」 失败: {e}"); return False, version, hero_stats
    
    if not suppress_summary: safe_print(f"\nℹ️ 开始复制并汉化英雄皮肤图片 (JPG) 文件夹结构...")
    src_img_champ_path = base_path / "img" / "champion"
    if not src_img_champ_path.is_dir(): safe_print(f"❌ 错误: 原始的 img/champion 文件夹 ({src_img_champ_path}) 不存在。"); return False, version, hero_stats
    for eng_folder in IMAGE_SUBFOLDER_MAPPING.keys():
        src_dir = src_img_champ_path / eng_folder; dest_dir = organized_champion_path / eng_folder
        if src_dir.is_dir():
            try:
                if dest_dir.exists(): shutil.rmtree(dest_dir)
                shutil.copytree(src_dir, dest_dir)
            except Exception as e: safe_print(f"   ❌ 复制皮肤类别文件夹 {src_dir.name} 失败: {e}")
    
    rename_success, _, _, _ = lol_rename_and_organize_skin_subfolders(organized_champion_path); all_successful &= rename_success
    
    # Load JSON once
    json_path = base_path / version / "data" / "zh_CN" / "championFull.json"
    champion_data = {}
    if json_path.is_file():
        try:
            with open(json_path, 'r', encoding='utf-8') as f: champion_data = json.load(f).get("data", {})
        except Exception as e: safe_print(f"❌ 加载英雄JSON失败: {e}")
        
    jpg_success, jpg_stats = lol_rename_and_move_skin_images_task(base_path, organized_champion_path, version, champion_data); all_successful &= jpg_success
    hero_stats["skin_jpgs_by_type"] = jpg_stats

    src_base_icons = base_path / version / "img" / "champion"; dest_base_icons = organized_champion_path / LOL_BASE_CHAMPION_ICONS_FOLDER_NAME
    png_success, png_c, png_s, png_e = (False, 0, 0, 0)
    
    if champion_data: png_success, png_c, png_s, png_e = lol_rename_base_champion_icons_task(src_base_icons, dest_base_icons, champion_data)
    hero_stats["base_icons_png"] = {"created_newly": png_c, "skipped": png_s, "errors": png_e}; all_successful &= png_success

    skills_dest_path = organized_champion_path / LOL_CHAMPION_SKILLS_FOLDER_NAME
    skills_success, skills_c, skills_s, skills_e = (False, 0, 0, 0)
    if champion_data: skills_success, skills_c, skills_s, skills_e = lol_rename_and_organize_skill_icons(base_path, skills_dest_path, version, champion_data)
    hero_stats["skill_icons"] = {"created_newly": skills_c, "skipped": skills_s, "errors": skills_e}; all_successful &= skills_success
    
    if not suppress_summary:
        if all_successful: safe_print(f"\n🦸 所有英雄相关汉化操作成功完成。")
        else: safe_print("\n⚠️ 部分英雄相关汉化操作未完全成功完成。")
        for cat, stats in hero_stats.get("skin_jpgs_by_type", {}).items(): safe_print(f"  {cat} (JPG): ✅新建: {stats['created_newly']}, ⏭️跳过: {stats['skipped']}, ❌错误: {stats['errors']}")
        safe_print(f"  头像 (基础PNG): ✅新建: {hero_stats['base_icons_png']['created_newly']}, ⏭️跳过: {hero_stats['base_icons_png']['skipped']}, ❌错误: {hero_stats['base_icons_png']['errors']}")
        safe_print(f"  英雄技能 (QWERP PNG): ✅新建: {hero_stats['skill_icons']['created_newly']}, ⏭️跳过: {hero_stats['skill_icons']['skipped']}, ❌错误: {hero_stats['skill_icons']['errors']}")
    return all_successful, version, hero_stats

def execute_lol_item_localization(version, base_path, organized_path, suppress_summary=False):
    if not suppress_summary: print("\n💎 开始执行装备图片汉化流程...")
    organized_item_path = organized_path / LOL_ORGANIZED_ITEM_SUBFOLDER_NAME
    if not base_path.is_dir(): print(f"❌ 错误: 原始数据文件夹 「{LEAGUE_DATA_SUBFOLDER_NAME}」 不存在。"); return False, version, dict(EMPTY_STATS)
    success, c, s, e = lol_rename_item_images_task(base_path, organized_item_path, version)
    if not suppress_summary:
        if success: print(f"\n💎 装备图片汉化操作成功完成。")
        else: print("\n⚠️ 装备图片汉化操作未完全成功完成。")
        print(f"  装备图片: ✅新建: {c}, ⏭️跳过: {s}, ❌错误: {e}")
    return success, version, {"created_newly": c, "skipped": s, "errors": e}

def execute_lol_rune_localization(version, base_path, organized_path, suppress_summary=False):
    if not suppress_summary: print(f"\n✨ 符文 开始执行符文图片汉化流程...")
    organized_rune_path = organized_path / LOL_ORGANIZED_RUNE_SUBFOLDER_NAME
    if not base_path.is_dir(): print(f"❌ 错误: 原始数据文件夹 「{LEAGUE_DATA_SUBFOLDER_NAME}」 不存在。"); return False, version, {}
    success, main, sub, statmod = lol_rename_rune_images_task(base_path, organized_rune_path, version, suppress_summary_internal=suppress_summary)
    stats = {"main_icons": main, "sub_icons": sub, "statmods": statmod}
    if not suppress_summary:
        if success: print(f"\n✨ 符文 图片汉化操作成功完成。")
        else: print("\n⚠️ 符文图片汉化操作未完全成功完成。")
        print(f"  符文系图标: ✅新建: {main['created_newly']}, ⏭️跳过: {main['skipped']}, ❌错误: {main['errors']}")
        print(f"  具体符文图标: ✅新建: {sub['created_newly']}, ⏭️跳过: {sub['skipped']}, ❌错误: {sub['errors']}")
        print(f"  属性点图标: ✅新建: {statmod['created_newly']}, ⏭️跳过: {statmod['skipped']}, ❌错误: {statmod['errors']}")
    return success, version, stats

# --- 云顶之弈汉化核心函数 ---
def process_tft_json_for_localization(config, original_data_path, organized_tft_path, version_str):
    stats = {"created_newly": 0, "skipped": 0, "errors": 0}
    json_path = original_data_path / version_str / "data" / "zh_CN" / config["json_file"]
    if not json_path.is_file(): safe_print(f"❌ 错误: JSON文件 {json_path} 未找到。"); stats["errors"] += 1; return False, stats
    try:
        with open(json_path, 'r', encoding='utf-8') as f: raw_data = json.load(f)
    except Exception as e: safe_print(f"❌ 错误: 加载或解析JSON文件 {config['json_file']} 失败: {e}"); stats["errors"] += 1; return False, stats
    
    data_to_iterate = raw_data.get("data", []) if isinstance(raw_data.get("data"), list) else list(raw_data.get("data", {}).values())
    if not data_to_iterate and "sets" in raw_data:
        data_to_iterate = [champ for s in raw_data.get("sets", {}).values() for champ in s.get("champions", [])]
    if not data_to_iterate: safe_print(f"ℹ️ JSON文件 {config['json_file']} 中没有找到可处理的数据项。"); return True, stats
    
    dest_folder = organized_tft_path / config["target_folder_name"]; dest_folder.mkdir(exist_ok=True)
    all_successful = True
    
    def process_item(item_data):
        res = {"status": "skipped"}
        if not isinstance(item_data, dict): return res
        item_name = item_data.get("name", "")
        if not item_name: return res
        
        img_full = item_data.get(config["image_object_key"], {}).get(config["img_full_json_key"])
        img_group = config["img_group_override"]
        if not img_full or not img_group: return res
        
        src_img_path = original_data_path / version_str / "img" / img_group.strip("/") / img_full
        dest_filename = f"{sanitize_filename_for_rename(item_name)}.png"
        dest_img_path = dest_folder / dest_filename
        
        if not src_img_path.is_file():
            safe_print(f"  ⏭️ 源文件未找到: {src_img_path}")
            return res
            
        try:
            if dest_img_path.exists(): os.remove(dest_img_path)
            shutil.copy2(src_img_path, dest_img_path)
            # safe_print(f"  ✅ {config['target_folder_name']}: {img_full} -> {dest_filename}")
            res["status"] = "created"; return res
        except Exception as e:
            safe_print(f"  ❌ 复制 {img_full} 失败: {e}")
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_item, item) for item in data_to_iterate]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": stats["created_newly"] += 1
            elif s == "skipped": stats["skipped"] += 1
            elif s == "error": stats["errors"] += 1; all_successful = False
            
    return all_successful, stats

# --- 云顶之弈汉化执行器 ---
def handle_tft_localization_menu(organized_tft_path, version, original_data_path):
    while True:
        print("\n--- 汉化与整理 (云顶) 子菜单 ---")
        options = {str(i + 1): config for i, config in enumerate(TFT_LOCALIZATION_CONFIG)}
        for i, config in enumerate(TFT_LOCALIZATION_CONFIG): print(f"{i+1:2d}. {config['comment']}")
        print(f"{len(options)+1:2d}. 全部汉化 (云顶之弈)")
        print(f"{len(options)+2:2d}. 返回主菜单")
        
        choice = input(">> 请输入选项: ")
        if choice == str(len(options) + 2): print("↩️ 返回主菜单..."); return
        
        action_taken = False; overall_success = True; all_stats = []
        
        if choice == str(len(options) + 1):
            print(f"\n🚀 执行全部云顶之弈汉化 -> 「{organized_tft_path.name}」")
            if organized_tft_path.exists():
                if input(f"   「{organized_tft_path.name}」已存在。是否删除并重新执行？(y/n): ").lower() != 'y': print("   用户取消。"); continue
                try: shutil.rmtree(organized_tft_path); print(f"   🗑️ 已删除旧的「{organized_tft_path.name}」。")
                except Exception as e: print(f"   ❌ 删除失败: {e}"); continue
            organized_tft_path.mkdir(exist_ok=True)
            for config in TFT_LOCALIZATION_CONFIG:
                print(f"\n--- 正在汉化: {config['comment']} ---")
                success, stats = process_tft_json_for_localization(config, original_data_path, organized_tft_path, version)
                all_stats.append({"name": config["comment"], "stats": stats}); overall_success &= success
            action_taken = True
        elif choice in options:
            config = options[choice]; target_cat_folder = organized_tft_path / config["target_folder_name"]
            print(f"\n🚀 准备汉化: {config['comment']}...")
            if target_cat_folder.exists():
                if input(f"   「{config['target_folder_name']}」已存在。是否删除并重新汉化？(y/n): ").lower() != 'y': print("   用户取消。"); continue
                try: shutil.rmtree(target_cat_folder); print(f"   🗑️ 已删除旧的「{config['target_folder_name']}」。")
                except Exception as e: print(f"   ❌ 删除失败: {e}"); continue
            organized_tft_path.mkdir(exist_ok=True)
            overall_success, stats = process_tft_json_for_localization(config, original_data_path, organized_tft_path, version)
            print(f"\n--- {config['comment']} 汉化统计 ---"); print(f"  ✅新建: {stats['created_newly']}, ⏭️跳过: {stats['skipped']}, ❌错误: {stats['errors']}")
            action_taken = True
        else: print("❗ 无效选项，请重新输入。"); continue
        
        if action_taken:
            if overall_success: print(f"\n✅ 操作成功完成！")
            else: print(f"\n⚠️ 部分操作未成功完成。")
            if choice == str(len(options) + 1) and all_stats:
                print("\n--- 云顶之弈全部汉化统计总览 ---")
                total_c, total_s, total_e = 0, 0, 0
                for item in all_stats: s = item['stats']; print(f"  {item['name']}: ✅新建: {s['created_newly']}, ⏭️跳过: {s['skipped']}, ❌错误: {s['errors']}"); total_c += s['created_newly']; total_s += s['skipped']; total_e += s['errors']
                print("---------------------------------"); print(f"📊 总计: ✅新建: {total_c}, ⏭️跳过: {total_s}, ❌错误: {total_e}"); print("---------------------------------")
            open_folder_in_explorer(organized_tft_path); break

# --- 导航与主菜单 ---
def display_welcome_message():
    print("\n" + "=" * 70); print("                  欢迎使用本工具！                  "); print("✨  联盟 & 云顶 数据包下载与汉化整理 ✨")
    print(">>  维护者：仓小杰 (https://space.bilibili.com/13540581)"); print("=" * 70)
    print("\n本工具将为您提供以下便捷功能：")
    print("①  <查看版本信息>: 查看最新的在线版本和您本地已下载的版本。")
    print("②  <下载指定版本>: 从官方版本列表中选择并下载数据包。")
    print("③  <汉化与整理 (联盟)>: 对英雄联盟相关内容进行汉化整理。")
    print("④  <汉化与整理 (云顶)>: 对云顶之弈相关内容进行汉化整理。")
    print("⑤  <导航 (联盟)>: 浏览本地数据包中英雄联盟相关文件夹。")
    print("⑥  <导航 (云顶)>: 浏览本地数据包中云顶之弈相关文件夹。")
    print("⑦  <退出脚本>: 安全退出本工具。")
    print("\n注意：本工具完全免费，这点东西都有人倒卖的话，家里是真得请哈基高了！")
    print("-" * 70)

def display_main_menu():
    print("\n--- 主菜单 ---"); print("①  查看版本信息"); print("②  下载指定版本数据包"); print("③  汉化与整理 (联盟)"); print("④  汉化与整理 (云顶)"); print("⑤  导航 (联盟)"); print("⑥  导航 (云顶)"); print("⑦  退出脚本")

def display_localization_submenu_lol():
    print("\n--- 汉化与整理 (联盟) 子菜单 ---"); print("①  全部汉化（英雄、装备、符文）"); print("②  英雄（皮肤、头像、技能）"); print("③  装备"); print("④  符文"); print("⑤  返回主菜单")

def display_and_navigate_pack(base_data_path, online_version, nav_data, game_name):
    print(f"\n--- 导航{game_name}数据包 ---")
    if not base_data_path.is_dir(): print(f"❌ 「{LEAGUE_DATA_SUBFOLDER_NAME}」文件夹不存在，请先使用选项 ② 下载。"); return
    local_version = get_local_data_version(base_data_path)
    if not local_version:
        if input(f"❌ 本地数据包结构不完整。是否尝试使用选项 ② 下载/修复？(y/n): ").lower() == 'y': return "DOWNLOAD_REQUESTED"
        return
    if online_version and local_version != online_version:
        if input(f"⚠️ 注意: 本地版本 ({local_version}) 与最新在线版本 ({online_version}) 不同。是否仍要导航本地版本？(y/n): ").lower() != 'y': return
    print(f"✅ 当前导航的本地数据包版本为: {local_version}")
    
    processed_items, max_width = [], 0
    for item in nav_data:
        label = f"{len(processed_items)+1:2d}. {item['label'].replace('{version}', local_version)}"; width = get_visual_width(label)
        processed_items.append({"text": label, "visual_width": width, "data": item}); max_width = max(max_width, width)
        
    while True:
        print("\n请选择要打开的文件夹 (输入序号，或输入 'q' 返回主菜单):")
        paths_map = {}
        for i, p_item in enumerate(processed_items):
            item_data = p_item["data"]; path = base_data_path.joinpath(*[p.replace("{version}", local_version) for p in item_data["path_parts"]])
            status = "(存在)" if path.exists() and path.is_dir() else "(不存在)"
            padding = " " * (max_width - p_item["visual_width"] + 3)
            print(f"{p_item['text']}{padding}{item_data['comment']} {status}"); paths_map[i+1] = item_data
        
        user_choice = input(">> 请输入选项: ").lower()
        if user_choice == 'q': break
        try:
            choice_idx = int(user_choice)
            if choice_idx in paths_map:
                folder = base_data_path.joinpath(*[p.replace("{version}", local_version) for p in paths_map[choice_idx]["path_parts"]])
                if folder.exists() and folder.is_dir(): open_folder_in_explorer(folder)
                else: print(f"❗ 错误: 文件夹 {folder} 不存在。")
            else: print("❗ 无效的序号。")
        except ValueError: print("❗ 无效输入。")

def main():
    display_welcome_message()
    latest_online_version = None
    original_data_path = Path.home() / "Downloads" / LEAGUE_DATA_SUBFOLDER_NAME
    while True:
        display_main_menu()
        choice = input(">> 请输入主菜单选项 (1-7): ")
        if choice == '1':
            print("\nℹ️ 正在检查版本信息...")
            all_versions = get_all_versions()
            if all_versions: latest_online_version = all_versions[0]; print(f"   ✅ 当前最新的在线版本是: {latest_online_version}")
            else: print("   ⚠️ 未能获取到最新版本信息。")
            local_version = get_local_data_version(original_data_path)
            if local_version:
                print(f"   ℹ️ 您本地已下载的版本是: {local_version}")
                if latest_online_version and local_version == latest_online_version: print("   ✅ 恭喜！您的本地版本已是最新。")
                elif latest_online_version: print("   ⚠️ 您的本地版本不是最新的。")
            else: print(f"   ℹ️ 未在下载文件夹中找到本地「{LEAGUE_DATA_SUBFOLDER_NAME}」。")
            continue
        if choice == '2':
            print("\n🚀 准备下载「联盟官方数据包」..."); all_versions = get_all_versions()
            if not all_versions: print("❌ 无法获取可用版本列表，下载中止。"); continue
            latest_online_version = all_versions[0]
            print("\n请选择要下载的版本 (最新的版本在最上方):")
            for i, ver in enumerate(all_versions[:20]): print(f"  {i+1:2d}. {ver}")
            if len(all_versions) > 20: print("  ...")
            selected_version = None
            while not selected_version:
                user_input = input(f">> 请输入序号 (1-20)，或直接输入版本号，或输入 'q' 返回: ").strip()
                if user_input.lower() == 'q': break
                try:
                    idx = int(user_input) - 1
                    if 0 <= idx < len(all_versions): selected_version = all_versions[idx]
                except ValueError:
                    if user_input in all_versions: selected_version = user_input
                if not selected_version: print(f"❗ 无效的输入 '{user_input}'。")
            if not selected_version: print("↩️ 已取消下载..."); continue
            print(f"✅ 已选择版本: {selected_version}")
            local_version_dl = get_local_data_version(original_data_path)
            perform_download = False
            if local_version_dl and local_version_dl == selected_version:
                if input(f"   ✅ 您选择的版本 ({selected_version}) 已存在。是否重新下载？(y/n): ").lower() == 'y': perform_download = True
                else: open_folder_in_explorer(original_data_path)
            else:
                if local_version_dl: print(f"   本地版本 ({local_version_dl}) 与您选择的版本 ({selected_version}) 不同。")
                perform_download = True
            if perform_download:
                _, downloaded_version = download_and_extract_data_pack(selected_version)
                if downloaded_version:
                    print("✅ 「联盟官方数据包」下载和解压成功！")
                    if input("\n💡 是否立即执行「全部汉化 (联盟)」？(y/n): ").lower() == 'y':
                        organized_path = Path.home() / "Downloads" / f"联盟数据汉化整理-{downloaded_version}"
                        if organized_path.exists():
                            if input(f"   「{organized_path.name}」已存在。是否删除并重新执行？(y/n): ").lower() != 'y': print("   用户取消。"); continue
                            try: shutil.rmtree(organized_path)
                            except Exception as e: print(f"   ❌ 删除失败: {e}"); continue
                        organized_path.mkdir(exist_ok=True)
                        print("\n🚀 执行全部汉化 (联盟)...")
                        h_s, _, _ = execute_lol_hero_localization(downloaded_version, original_data_path, organized_path, True)
                        i_s, _, _ = execute_lol_item_localization(downloaded_version, original_data_path, organized_path, True)
                        r_s, _, _ = execute_lol_rune_localization(downloaded_version, original_data_path, organized_path, True)
                        if h_s and i_s and r_s: print("\n✅✅✅ 「全部汉化 (联盟)」操作已成功完成！")
                        else: print("\n⚠️⚠️⚠️ 部分「全部汉化 (联盟)」操作未成功完成。")
                        open_folder_in_explorer(organized_path)
            continue
        if choice in ['3', '4']:
            if not original_data_path.is_dir():
                if input(f"❌ 「{LEAGUE_DATA_SUBFOLDER_NAME}」不存在。是否现在下载？(y/n): ").lower() == 'y': choice = '2'; continue
                else: print("   操作取消。"); continue
            local_version = get_local_data_version(original_data_path)
            if not local_version: print(f"❌ 在「{original_data_path}」中找不到有效版本。"); continue
            
            game_name = "联盟" if choice == '3' else "云顶"
            organized_path = Path.home() / "Downloads" / f"{game_name}数据汉化整理-{local_version}"
            print(f"ℹ️ 检测到本地数据包版本为: {local_version}")
            print(f"ℹ️ 本次汉化将输出到: 「{organized_path.name}」")
            
            if choice == '3': # 联盟
                while True:
                    display_localization_submenu_lol()
                    sub_choice = input(">> 请输入汉化子菜单选项 (1-5): ")
                    if sub_choice == '5': print("↩️ 返回主菜单..."); break
                    if sub_choice in ['1', '2', '3', '4']:
                        if organized_path.exists() and sub_choice == '1':
                            if input(f"   「{organized_path.name}」已存在。是否删除并重新执行？(y/n): ").lower() != 'y': print("   用户取消。"); continue
                            try: shutil.rmtree(organized_path)
                            except Exception as e: print(f"   ❌ 删除失败: {e}"); continue
                        organized_path.mkdir(exist_ok=True)
                        success = False
                        if sub_choice == '1':
                            h_s,_,_ = execute_lol_hero_localization(local_version, original_data_path, organized_path, True)
                            i_s,_,_ = execute_lol_item_localization(local_version, original_data_path, organized_path, True)
                            r_s,_,_ = execute_lol_rune_localization(local_version, original_data_path, organized_path, True)
                            success = h_s and i_s and r_s
                        elif sub_choice == '2': success,_,_ = execute_lol_hero_localization(local_version, original_data_path, organized_path)
                        elif sub_choice == '3': success,_,_ = execute_lol_item_localization(local_version, original_data_path, organized_path)
                        elif sub_choice == '4': success,_,_ = execute_lol_rune_localization(local_version, original_data_path, organized_path)
                        if success: open_folder_in_explorer(organized_path)
                        break
                    else: print("❗ 无效选项。")
            elif choice == '4': # 云顶
                handle_tft_localization_menu(organized_path, local_version, original_data_path)
            continue
        if choice in ['5', '6']:
            if not latest_online_version:
                versions = get_all_versions()
                if versions: latest_online_version = versions[0]
            game_name = "联盟" if choice == '5' else "云顶"
            nav_data = NAVIGABLE_LOL_PATHS_DATA if choice == '5' else NAVIGABLE_TFT_PATHS_DATA
            result = display_and_navigate_pack(original_data_path, latest_online_version, nav_data, game_name)
            if result == "DOWNLOAD_REQUESTED": choice = '2'; print("\n🔄 自动跳转至下载功能..."); continue
            continue
        if choice == '7': print("\n👋 感谢使用，脚本已退出。"); sys.exit()
        else: print("❗ 无效主菜单选项，请输入 1-7。")

if __name__ == "__main__":
    main()

