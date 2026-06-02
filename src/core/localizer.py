"""
Localizer module for renaming and organizing assets
"""
import os
import shutil
import re
import json
import concurrent.futures
from pathlib import Path
from typing import Callable, Optional

from src.config.constants import (
    IMAGE_SUBFOLDER_MAPPING,
    RUNE_CATEGORIES_INFO,
    STATMODS_FOLDER_NAME,
    STATMODS_MAPPING
)
from src.utils.platform import sanitize_filename_for_rename, is_windows


_IS_WINDOWS = is_windows()
_CPU_COUNT = os.cpu_count() or 4
_WINDOWS_IO_MAX_WORKERS = max(4, min(8, _CPU_COUNT // 2 if _CPU_COUNT > 1 else 1))


def _io_max_workers() -> Optional[int]:
    if _IS_WINDOWS:
        return _WINDOWS_IO_MAX_WORKERS
    return None


def _copy_file_with_overwrite(src_path: Path, dest_path: Path) -> None:
    if _IS_WINDOWS:
        shutil.copyfile(src_path, dest_path)
        return

    if dest_path.exists():
        os.remove(dest_path)
    shutil.copy2(src_path, dest_path)


def _move_file_with_overwrite(src_path: Path, dest_path: Path) -> None:
    if _IS_WINDOWS:
        os.replace(src_path, dest_path)
        return

    if dest_path.exists():
        os.remove(dest_path)
    shutil.move(str(src_path), str(dest_path))

def get_local_data_version(league_data_path: Path) -> Optional[str]:
    """
    Get the version of the local downloaded data pack.
    """
    if not league_data_path.is_dir(): return None
    for item in league_data_path.iterdir():
        if item.is_dir() and re.fullmatch(r'\d+\.\d+\.\d+', item.name):
            if (item / "data").is_dir() and (item / "img").is_dir(): return item.name
    return None

def lol_rename_and_organize_skin_subfolders(organized_champion_path: Path, log_func: Callable[[str], None]) -> tuple[bool, int, int, int]:
    if not organized_champion_path.is_dir(): return False, 0,0,0
    created, errors, skipped = 0, 0, 0
    for old, new_zh in IMAGE_SUBFOLDER_MAPPING.items():
        old_f, new_f = organized_champion_path / old, organized_champion_path / new_zh
        if old_f.is_dir():
            if old_f == new_f: skipped += 1; continue
            try:
                if new_f.exists(): shutil.rmtree(new_f)
                old_f.rename(new_f); log_func(f"  ✅ 皮肤类别: {old_f.name} -> {new_f.name}"); created += 1
            except OSError as e: log_func(f"  ❌ 重命名失败: {e}"); errors += 1
        elif new_f.is_dir(): skipped += 1
        else: errors += 1
    return errors == 0, created, skipped, errors

def lol_rename_and_move_skin_images_task(original_data_path: Path, organized_champion_path: Path, version_str: str, log_func: Callable[[str], None], champ_data: dict = None) -> tuple[bool, dict]:
    fail_stats = {name: {"created_newly": 0, "skipped": 0, "errors": 0} for name in IMAGE_SUBFOLDER_MAPPING.values()}
    
    if champ_data is None:
        json_file = original_data_path / version_str / "data" / "zh_CN" / "championFull.json"
        if not json_file.is_file(): log_func(f"❌ JSON 未找到"); return False, fail_stats
        try:
            with open(json_file, 'r', encoding='utf-8') as f: champ_data = json.load(f).get("data", {})
        except Exception as e: log_func(f"❌ JSON 解析失败: {e}"); return False, fail_stats
    
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
        
        if not info: return res
            
        epithet, actual_name = info.get("name"), info.get("title")
        if not epithet or not actual_name: return res
            
        hero_folder = cat_path / sanitize_filename_for_rename(f"{epithet} {actual_name}")
        hero_folder.mkdir(exist_ok=True)
        
        file_base = f"{epithet} {actual_name}" if skin_num == 0 else next((s.get("name") for s in info.get("skins", []) if s.get("num") == skin_num and s.get("name", "").lower() != "default"), f"{epithet} {actual_name}" if any(s.get("num") == skin_num and s.get("name", "").lower() == "default" for s in info.get("skins", [])) else None)
        
        if not file_base: return res
            
        new_filename = f"{sanitize_filename_for_rename(file_base)}.jpg"
        new_filepath = hero_folder / new_filename
        
        try:
            _move_file_with_overwrite(item, new_filepath)
            res["status"] = "created"; return res
        except Exception:
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
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

def lol_rename_base_champion_icons_task(src_folder: Path, dest_folder: Path, champion_data: dict, log_func: Callable[[str], None]):
    if not src_folder.is_dir() or not champion_data: return False, 0, 0, 0
    dest_folder.mkdir(exist_ok=True)
    created, errors, skipped = 0, 0, 0
    
    def process_icon(filename):
        res = {"status": "skipped"}
        if not filename.lower().endswith(".png"): return res
        
        champ_id = filename[:-4]
        info = champion_data.get(champ_id) or champion_data.get(champ_id.capitalize()) or champion_data.get(champ_id.lower())
        if not info and champ_id.lower() == "fiddlesticks": info = champion_data.get("Fiddlesticks")
        if not info: return res
            
        epithet, name = info.get("name"), info.get("title")
        if not epithet or not name: return res
            
        new_filename = f"{sanitize_filename_for_rename(f'{epithet} {name}')}.png"
        dest_fp = dest_folder / new_filename
        
        if (src_folder / filename) == dest_fp: return res
        
        try:
            _copy_file_with_overwrite(src_folder / filename, dest_fp)
            res["status"] = "created"; return res
        except Exception:
            res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
        futures = [executor.submit(process_icon, f) for f in os.listdir(src_folder)]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": created += 1
            elif s == "skipped": skipped += 1
            elif s == "error": errors += 1
    return errors == 0, created, skipped, errors

def lol_rename_and_organize_skill_icons(original_data_path: Path, skills_base_path: Path, version_str: str, champion_data: dict, log_func: Callable[[str], None]) -> tuple[bool, int, int, int]:
    src_spell = original_data_path / version_str / "img" / "spell"
    src_passive = original_data_path / version_str / "img" / "passive"
    if not src_spell.is_dir() or not src_passive.is_dir(): return False, 0, 0, 0
    skills_base_path.mkdir(exist_ok=True)
    created, errors, skipped = 0, 0, 0
    
    def process_skill(champ_id, info):
        res = {"created": 0, "errors": 0, "skipped": 0}
        epithet, name = info.get("name"), info.get("title")
        if not epithet or not name: res["errors"] += 1; return res
        hero_skill_folder = skills_base_path / sanitize_filename_for_rename(f"{epithet} {name}")
        hero_skill_folder.mkdir(exist_ok=True)
        keys = ['Q', 'W', 'E', 'R']
        for i, spell in enumerate(info.get("spells", [])):
            key = keys[i] if i < len(keys) else "S"
            orig_file, spell_name = spell.get("image", {}).get("full"), spell.get("name")
            if not orig_file or not spell_name: continue
            src_f = src_spell / orig_file
            new_f_name = f"{sanitize_filename_for_rename(f'{key}技能 {spell_name}')}.png"
            final_f = hero_skill_folder / new_f_name
            if not src_f.is_file(): continue
            try:
                _copy_file_with_overwrite(src_f, final_f)
                res["created"] += 1
            except Exception: res["errors"] += 1
        passive = info.get("passive")
        if passive:
            orig_pass_file, pass_name = passive.get("image", {}).get("full"), passive.get("name")
            if orig_pass_file and pass_name:
                src_pf = src_passive / orig_pass_file
                new_pf_name = f"{sanitize_filename_for_rename(f'被动技能 {pass_name}')}.png"
                final_pf = hero_skill_folder / new_pf_name
                if src_pf.is_file():
                    try:
                        _copy_file_with_overwrite(src_pf, final_pf)
                        res["created"] += 1
                    except Exception: res["errors"] += 1
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
        futures = [executor.submit(process_skill, cid, info) for cid, info in champion_data.items()]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            created += r["created"]; errors += r["errors"]; skipped += r["skipped"]
    return errors == 0, created, skipped, errors

def lol_rename_item_images_task(original_data_path: Path, organized_item_path: Path, version_str: str, log_func: Callable[[str], None]) -> tuple[bool, int, int, int]:
    src_path = original_data_path / version_str / "img" / "item"
    json_path = original_data_path / version_str / "data" / "zh_CN" / "item.json"
    if not src_path.is_dir() or not json_path.is_file(): return False, 0, 0, 0
    try:
        with open(json_path, 'r', encoding='utf-8') as f: item_data = json.load(f).get("data", {})
    except Exception: return False, 0, 0, 0
    organized_item_path.mkdir(exist_ok=True)
    created, errors, skipped = 0, 0, 0
    
    def process_item(filename):
        res = {"status": "skipped"}
        if not filename.lower().endswith(".png"): return res
        item_id = filename[:-4]
        info = item_data.get(item_id)
        if not info: return res
        name_zh = info.get("name")
        if not name_zh: return res
        new_filename = f"{sanitize_filename_for_rename(name_zh)}.png"
        dest_file = organized_item_path / new_filename
        try:
            _copy_file_with_overwrite(src_path / filename, dest_file)
            res["status"] = "created"; return res
        except Exception: res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
        futures = [executor.submit(process_item, f) for f in os.listdir(src_path)]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": created += 1
            elif s == "skipped": skipped += 1
            elif s == "error": errors += 1
    return errors == 0, created, skipped, errors

def lol_rename_rune_images_task(original_data_path: Path, organized_rune_path: Path, version_str: str, log_func: Callable[[str], None]):
    src_perk_path = original_data_path / "img" / "perk-images"
    json_rune_path = original_data_path / version_str / "data" / "zh_CN" / "runesReforged.json"
    if not src_perk_path.is_dir(): src_perk_path = original_data_path / version_str / "img" / "perk-images"
    if not src_perk_path.is_dir() or not json_rune_path.is_file(): return False, {}, {}, {}
    try:
        with open(json_rune_path, 'r', encoding='utf-8') as f: runes_data = json.load(f)
    except Exception: return False, {}, {}, {}
    
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
        if not cat_name or not cat_icon: return "cat", m_stats, s_stats
        dest_cat_folder = organized_rune_path / cat_name
        src_cat_icon = src_perk_path / Path(cat_icon).relative_to("perk-images")
        if src_cat_icon.is_file():
            new_cat_filename = f"{sanitize_filename_for_rename(cat_name)}.png"
            dest_cat_file = dest_cat_folder / new_cat_filename
            try:
                _copy_file_with_overwrite(src_cat_icon, dest_cat_file)
                m_stats["created"] += 1
            except Exception: m_stats["errors"] += 1
        for slot in cat_data.get("slots", []):
            for rune in slot.get("runes", []):
                rune_name, rune_icon = rune.get("name"), rune.get("icon")
                if not rune_name or not rune_icon: continue
                src_rune_icon = src_perk_path / Path(rune_icon).relative_to("perk-images")
                new_rune_filename = f"{sanitize_filename_for_rename(rune_name)}.png"
                dest_rune_file = dest_cat_folder / new_rune_filename
                if not src_rune_icon.is_file(): continue
                try:
                    _copy_file_with_overwrite(src_rune_icon, dest_rune_file)
                    s_stats["created"] += 1
                except Exception: s_stats["errors"] += 1
        return "cat", m_stats, s_stats

    def process_statmods():
        sm_stats = {"created": 0, "errors": 0, "skipped": 0}
        src_statmods_path = src_perk_path / "StatMods"
        if src_statmods_path.is_dir():
            for orig, new in STATMODS_MAPPING.items():
                src_file, dest_file = src_statmods_path / orig, organized_rune_path / STATMODS_FOLDER_NAME / new
                if not src_file.is_file(): continue
                try:
                    _copy_file_with_overwrite(src_file, dest_file)
                    sm_stats["created"] += 1
                except Exception: sm_stats["errors"] += 1
        return "statmod", sm_stats, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
        for cat_data in runes_data: tasks.append(executor.submit(process_rune_category, cat_data))
        tasks.append(executor.submit(process_statmods))
        for future in concurrent.futures.as_completed(tasks):
            type_, stats1, stats2 = future.result()
            if type_ == "cat":
                main_stats["created_newly"] += stats1["created"]; main_stats["errors"] += stats1["errors"]
                sub_stats["created_newly"] += stats2["created"]; sub_stats["errors"] += stats2["errors"]
            elif type_ == "statmod":
                statmod_stats["created_newly"] += stats1["created"]; statmod_stats["errors"] += stats1["errors"]
    return True, main_stats, sub_stats, statmod_stats

def process_tft_json_for_localization(config, original_data_path, organized_tft_path, version_str, log_func: Callable[[str], None]):
    stats = {"created_newly": 0, "skipped": 0, "errors": 0}
    json_path = original_data_path / version_str / "data" / "zh_CN" / config["json_file"]
    if not json_path.is_file(): return False, stats
    try:
        with open(json_path, 'r', encoding='utf-8') as f: raw_data = json.load(f)
    except Exception: return False, stats
    
    data_to_iterate = raw_data.get("data", []) if isinstance(raw_data.get("data"), list) else list(raw_data.get("data", {}).values())
    if not data_to_iterate and "sets" in raw_data:
        data_to_iterate = [champ for s in raw_data.get("sets", {}).values() for champ in s.get("champions", [])]
    if not data_to_iterate: return True, stats
    
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
        if not src_img_path.is_file(): return res
        try:
            _copy_file_with_overwrite(src_img_path, dest_img_path)
            res["status"] = "created"; return res
        except Exception: res["status"] = "error"; return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=_io_max_workers()) as executor:
        futures = [executor.submit(process_item, item) for item in data_to_iterate]
        for future in concurrent.futures.as_completed(futures):
            r = future.result()
            s = r["status"]
            if s == "created": stats["created_newly"] += 1
            elif s == "skipped": stats["skipped"] += 1
            elif s == "error": stats["errors"] += 1; all_successful = False
    return all_successful, stats
