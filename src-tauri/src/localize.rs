//! 联盟(LoL)汉化:把官方数据包按中文命名重组到「联盟数据汉化整理-{version}」。
//! 移植自 Flet 版 `src/core/localizer.py` 与 `src/ui/views/home.py` 的编排逻辑。
//! M2 先做串行版(正确性优先),并发优化留待后续里程碑。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

use crate::constants::*;
use crate::{CancelFlag, ProgressEvent};

// ---------------------------------------------------------------------------
// 基础辅助
// ---------------------------------------------------------------------------

/// 去除文件名中的非法字符(对应 Flet `sanitize_filename_for_rename`)。
fn sanitize(name: &str) -> String {
    name.chars()
        .filter(|c| !matches!(c, '\\' | '/' | '*' | '?' | ':' | '"' | '<' | '>' | '|'))
        .collect()
}

/// 判断是否形如 `数字.数字.数字`。
fn is_version_string(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()))
}

/// 探测数据包目录下形如 `x.y.z` 且含 `data/` 与 `img/` 的版本子目录名。
fn detect_version(data_dir: &Path) -> Option<String> {
    for entry in fs::read_dir(data_dir).ok()?.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        if is_version_string(&name) && path.join("data").is_dir() && path.join("img").is_dir() {
            return Some(name);
        }
    }
    None
}

/// 返回首个存在的目录。
fn first_existing(paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().find(|p| p.is_dir()).cloned()
}

/// 去掉符文图标路径里的 `perk-images/` 前缀(对应 Flet `relative_to("perk-images")`)。
fn strip_perk_prefix(icon: &str) -> &str {
    icon.strip_prefix("perk-images/").unwrap_or(icon)
}

/// 解析皮肤文件名 `Champ_N`(已去扩展名)为 (英雄 id, 皮肤序号)。
fn parse_skin_filename(stem: &str) -> Option<(String, i64)> {
    let idx = stem.rfind('_')?;
    let (id, num) = stem.split_at(idx);
    let num = &num[1..]; // 去掉 '_'
    if id.is_empty() || num.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    Some((id.to_string(), num.parse().ok()?))
}

/// 在 championFull.json 的 data 中按 id 查英雄(带大小写 / Fiddlesticks 兜底)。
fn find_champ<'a>(champ_data: &'a Value, champ_id: &str) -> Option<&'a Value> {
    let data = champ_data.as_object()?;
    if let Some(v) = data.get(champ_id) {
        return Some(v);
    }
    // 首字母大写其余小写
    let mut cap = String::new();
    let mut chars = champ_id.chars();
    if let Some(f) = chars.next() {
        cap.extend(f.to_uppercase());
        cap.push_str(&chars.as_str().to_lowercase());
    }
    if let Some(v) = data.get(cap.as_str()) {
        return Some(v);
    }
    if let Some(v) = data.get(champ_id.to_lowercase().as_str()) {
        return Some(v);
    }
    if champ_id.eq_ignore_ascii_case("fiddlesticks") {
        if let Some(v) = data.get("Fiddlesticks") {
            return Some(v);
        }
    }
    None
}

/// 计算皮肤图重命名后的基名(对应 Flet 中的 `next(...)` 逻辑)。
/// - 序号 0 → 「称号 本名」
/// - 否则取 skins 中 num 匹配且 name != "default" 的名字
/// - 若该序号只有 default → 退回「称号 本名」;序号不存在 → None
fn compute_skin_file_base(info: &Value, skin_num: i64, name: &str, title: &str) -> Option<String> {
    if skin_num == 0 {
        return Some(format!("{name} {title}"));
    }
    let skins = info.get("skins").and_then(|s| s.as_array())?;
    for s in skins {
        if s.get("num").and_then(|n| n.as_i64()) == Some(skin_num) {
            if let Some(sn) = s.get("name").and_then(|n| n.as_str()) {
                if !sn.eq_ignore_ascii_case("default") {
                    return Some(sn.to_string());
                }
            }
        }
    }
    for s in skins {
        if s.get("num").and_then(|n| n.as_i64()) == Some(skin_num) {
            if let Some(sn) = s.get("name").and_then(|n| n.as_str()) {
                if sn.eq_ignore_ascii_case("default") {
                    return Some(format!("{name} {title}"));
                }
            }
        }
    }
    None
}

/// 读取 JSON 文件并返回根 Value。
fn load_json(path: &Path) -> Result<Value, String> {
    let text =
        fs::read_to_string(path).map_err(|e| format!("读取 {} 失败:{e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("解析 {} 失败:{e}", path.display()))
}

/// 复制文件(覆盖)。
fn copy_overwrite(src: &Path, dest: &Path) {
    let _ = fs::copy(src, dest);
}

/// 移动文件(目标存在先删,绕开 Windows rename 限制)。
fn move_overwrite(src: &Path, dest: &Path) {
    if dest.exists() {
        let _ = fs::remove_file(dest);
    }
    let _ = fs::rename(src, dest);
}

/// 递归复制目录(对应 Python `shutil.copytree`)。
fn copy_dir_all(src: &Path, dest: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dest.join(entry.file_name());
        if path.is_dir() {
            copy_dir_all(&path, &target)?;
        } else {
            fs::copy(&path, &target)?;
        }
    }
    Ok(())
}

fn check_cancel(cancel: &Arc<AtomicBool>) -> Result<(), String> {
    if cancel.load(Ordering::SeqCst) {
        Err("已取消".into())
    } else {
        Ok(())
    }
}

fn emit_localize(app: &AppHandle, current: u64, message: &str, done: bool) {
    let _ = app.emit(
        "task://progress",
        ProgressEvent {
            stage: "localize".into(),
            current,
            total: 100,
            speed: None,
            eta: None,
            message: message.into(),
            done,
        },
    );
}

// ---------------------------------------------------------------------------
// 各汉化子任务
// ---------------------------------------------------------------------------

/// 皮肤图重命名 + 按英雄建「称号 本名」文件夹并移动。
fn lol_move_skin_images(
    app: &AppHandle,
    cancel: &Arc<AtomicBool>,
    champion_dir: &Path,
    champ_data: &Value,
) -> Result<(), String> {
    let mut processed: u64 = 0;
    for &(_eng, zh) in IMAGE_SUBFOLDER_MAPPING {
        let cat_path = champion_dir.join(zh);
        if !cat_path.is_dir() {
            continue;
        }
        let entries: Vec<_> = match fs::read_dir(&cat_path) {
            Ok(rd) => rd.flatten().collect(),
            Err(_) => continue,
        };
        for entry in entries {
            let item = entry.path();
            if !item.is_file() {
                continue;
            }
            let fname = entry.file_name().to_string_lossy().into_owned();
            if !fname.to_lowercase().ends_with(".jpg") {
                continue;
            }
            let stem = &fname[..fname.len() - 4];
            let (champ_id, skin_num) = match parse_skin_filename(stem) {
                Some(x) => x,
                None => continue,
            };
            let info = match find_champ(champ_data, &champ_id) {
                Some(i) => i,
                None => continue,
            };
            let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let title = info.get("title").and_then(|v| v.as_str()).unwrap_or("");
            if name.is_empty() || title.is_empty() {
                continue;
            }
            let file_base = match compute_skin_file_base(info, skin_num, name, title) {
                Some(b) => b,
                None => continue,
            };
            let hero_folder = cat_path.join(sanitize(&format!("{name} {title}")));
            let _ = fs::create_dir_all(&hero_folder);
            move_overwrite(&item, &hero_folder.join(format!("{}.jpg", sanitize(&file_base))));
            processed += 1;
            if processed % 200 == 0 {
                check_cancel(cancel)?;
                emit_localize(app, 20, &format!("正在处理皮肤图像…已 {processed} 张"), false);
            }
        }
    }
    Ok(())
}

/// 英雄基础头像:`{ChampId}.png` → `头像/{称号 本名}.png`(复制)。
fn lol_base_icons(img_champ: &Path, dest: &Path, champ_data: &Value) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| format!("创建头像目录失败:{e}"))?;
    let rd = match fs::read_dir(img_champ) {
        Ok(rd) => rd,
        Err(_) => return Ok(()),
    };
    for entry in rd.flatten() {
        let fname = entry.file_name().to_string_lossy().into_owned();
        if !fname.to_lowercase().ends_with(".png") {
            continue;
        }
        let champ_id = &fname[..fname.len() - 4];
        let info = match find_champ(champ_data, champ_id) {
            Some(i) => i,
            None => continue,
        };
        let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let title = info.get("title").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() || title.is_empty() {
            continue;
        }
        let new_name = format!("{}.png", sanitize(&format!("{name} {title}")));
        copy_overwrite(&entry.path(), &dest.join(new_name));
    }
    Ok(())
}

/// 英雄技能:QWER 主动 + 被动,按英雄分文件夹(复制)。
fn lol_skill_icons(ver_root: &Path, skills_dest: &Path, champ_data: &Value) -> Result<(), String> {
    let src_spell = ver_root.join("img").join("spell");
    let src_passive = ver_root.join("img").join("passive");
    if !src_spell.is_dir() || !src_passive.is_dir() {
        return Ok(());
    }
    fs::create_dir_all(skills_dest).map_err(|e| format!("创建技能目录失败:{e}"))?;
    let data = match champ_data.as_object() {
        Some(d) => d,
        None => return Ok(()),
    };
    let keys = ['Q', 'W', 'E', 'R'];
    for info in data.values() {
        let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let title = info.get("title").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() || title.is_empty() {
            continue;
        }
        let hero_folder = skills_dest.join(sanitize(&format!("{name} {title}")));
        let _ = fs::create_dir_all(&hero_folder);
        if let Some(spells) = info.get("spells").and_then(|s| s.as_array()) {
            for (i, spell) in spells.iter().enumerate() {
                let key = if i < 4 { keys[i] } else { 'S' };
                let orig = spell
                    .get("image")
                    .and_then(|im| im.get("full"))
                    .and_then(|v| v.as_str());
                let sname = spell.get("name").and_then(|v| v.as_str());
                if let (Some(orig), Some(sname)) = (orig, sname) {
                    let src = src_spell.join(orig);
                    if src.is_file() {
                        let new_name = format!("{}.png", sanitize(&format!("{key}技能 {sname}")));
                        copy_overwrite(&src, &hero_folder.join(new_name));
                    }
                }
            }
        }
        if let Some(passive) = info.get("passive") {
            let orig = passive
                .get("image")
                .and_then(|im| im.get("full"))
                .and_then(|v| v.as_str());
            let pname = passive.get("name").and_then(|v| v.as_str());
            if let (Some(orig), Some(pname)) = (orig, pname) {
                let src = src_passive.join(orig);
                if src.is_file() {
                    let new_name = format!("{}.png", sanitize(&format!("被动技能 {pname}")));
                    copy_overwrite(&src, &hero_folder.join(new_name));
                }
            }
        }
    }
    Ok(())
}

/// 装备:`{ItemId}.png` → `装备/{中文名}.png`(复制)。
fn lol_item_images(ver_root: &Path, item_dest: &Path) -> Result<(), String> {
    let src = ver_root.join("img").join("item");
    let json = ver_root.join("data").join("zh_CN").join("item.json");
    if !src.is_dir() || !json.is_file() {
        return Ok(());
    }
    let item_data = load_json(&json)?
        .get("data")
        .cloned()
        .unwrap_or(Value::Null);
    let data = match item_data.as_object() {
        Some(d) => d,
        None => return Ok(()),
    };
    fs::create_dir_all(item_dest).map_err(|e| format!("创建装备目录失败:{e}"))?;
    for entry in fs::read_dir(&src)
        .map_err(|e| format!("读取装备图失败:{e}"))?
        .flatten()
    {
        let fname = entry.file_name().to_string_lossy().into_owned();
        if !fname.to_lowercase().ends_with(".png") {
            continue;
        }
        let item_id = &fname[..fname.len() - 4];
        let info = match data.get(item_id) {
            Some(i) => i,
            None => continue,
        };
        let name = info.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() {
            continue;
        }
        copy_overwrite(&entry.path(), &item_dest.join(format!("{}.png", sanitize(name))));
    }
    Ok(())
}

/// 符文:五系分类图标 + 各符文 + 属性点(复制)。runesReforged.json 顶层是数组。
fn lol_rune_images(data_dir: &Path, ver_root: &Path, rune_dest: &Path) -> Result<(), String> {
    let src_perk = match first_existing(&[
        data_dir.join("img").join("perk-images"),
        ver_root.join("img").join("perk-images"),
    ]) {
        Some(p) => p,
        None => return Ok(()),
    };
    let json = ver_root.join("data").join("zh_CN").join("runesReforged.json");
    if !json.is_file() {
        return Ok(());
    }
    let runes_data = load_json(&json)?;
    let arr = match runes_data.as_array() {
        Some(a) => a,
        None => return Ok(()),
    };

    fs::create_dir_all(rune_dest).map_err(|e| format!("创建符文目录失败:{e}"))?;
    for &(_eng, zh) in RUNE_CATEGORIES_INFO {
        let _ = fs::create_dir_all(rune_dest.join(zh));
    }
    let statmods_dir = rune_dest.join(STATMODS_FOLDER_NAME);
    let _ = fs::create_dir_all(&statmods_dir);

    for cat in arr {
        let cat_name = cat.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let cat_icon = cat.get("icon").and_then(|v| v.as_str()).unwrap_or("");
        if cat_name.is_empty() || cat_icon.is_empty() {
            continue;
        }
        let dest_cat = rune_dest.join(cat_name);
        let _ = fs::create_dir_all(&dest_cat);
        let src_cat_icon = src_perk.join(strip_perk_prefix(cat_icon));
        if src_cat_icon.is_file() {
            copy_overwrite(&src_cat_icon, &dest_cat.join(format!("{}.png", sanitize(cat_name))));
        }
        if let Some(slots) = cat.get("slots").and_then(|s| s.as_array()) {
            for slot in slots {
                let runes = match slot.get("runes").and_then(|r| r.as_array()) {
                    Some(r) => r,
                    None => continue,
                };
                for rune in runes {
                    let rname = rune.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let ricon = rune.get("icon").and_then(|v| v.as_str()).unwrap_or("");
                    if rname.is_empty() || ricon.is_empty() {
                        continue;
                    }
                    let src_rune = src_perk.join(strip_perk_prefix(ricon));
                    if src_rune.is_file() {
                        copy_overwrite(&src_rune, &dest_cat.join(format!("{}.png", sanitize(rname))));
                    }
                }
            }
        }
    }

    let src_statmods = src_perk.join("StatMods");
    if src_statmods.is_dir() {
        for &(orig, new) in STATMODS_MAPPING {
            let src = src_statmods.join(orig);
            if src.is_file() {
                copy_overwrite(&src, &statmods_dir.join(new));
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 主编排 + 命令
// ---------------------------------------------------------------------------

/// 联盟汉化主流程(同步,运行在阻塞线程池中)。
fn localize_lol(app: &AppHandle, cancel: &Arc<AtomicBool>, data_dir: &Path) -> Result<String, String> {
    let version = detect_version(data_dir).ok_or_else(|| {
        format!(
            "未在 {} 找到有效数据(需含 x.y.z/data 与 x.y.z/img)",
            data_dir.display()
        )
    })?;
    emit_localize(app, 0, &format!("开始联盟汉化(版本 {version})…"), false);

    let target_root = data_dir.parent().unwrap_or(data_dir);
    let out_root = target_root.join(format!("{LOL_LOCALIZED_PREFIX}-{version}"));
    fs::create_dir_all(&out_root).map_err(|e| format!("创建输出目录失败:{e}"))?;

    // 英雄目录:每次重建以保证幂等
    let champion_dir = out_root.join(LOL_CHAMPION_SUBFOLDER);
    if champion_dir.exists() {
        fs::remove_dir_all(&champion_dir).map_err(|e| format!("清理旧英雄目录失败:{e}"))?;
    }
    fs::create_dir_all(&champion_dir).map_err(|e| format!("创建英雄目录失败:{e}"))?;

    let ver_root = data_dir.join(&version);
    let img_champion = first_existing(&[
        ver_root.join("img").join("champion"),
        data_dir.join("img").join("champion"),
    ]);

    // 1. 复制皮肤图子目录(英文名)
    check_cancel(cancel)?;
    if let Some(ref img_champ) = img_champion {
        for &(eng, _zh) in IMAGE_SUBFOLDER_MAPPING {
            let src = img_champ.join(eng);
            if src.is_dir() {
                let dest = champion_dir.join(eng);
                if dest.exists() {
                    let _ = fs::remove_dir_all(&dest);
                }
                copy_dir_all(&src, &dest).map_err(|e| format!("复制皮肤目录 {eng} 失败:{e}"))?;
            }
        }
    }
    emit_localize(app, 10, "正在整理皮肤文件夹…", false);

    // 2. 皮肤子目录改中文
    check_cancel(cancel)?;
    for &(eng, zh) in IMAGE_SUBFOLDER_MAPPING {
        let old = champion_dir.join(eng);
        let new = champion_dir.join(zh);
        if old.is_dir() && old != new {
            if new.exists() {
                let _ = fs::remove_dir_all(&new);
            }
            let _ = fs::rename(&old, &new);
        }
    }
    emit_localize(app, 20, "正在处理皮肤图像(耗时较长)…", false);

    // 加载 championFull.json 的 data 部分
    let champ_json = ver_root.join("data").join("zh_CN").join("championFull.json");
    let champion_data = load_json(&champ_json)
        .ok()
        .and_then(|v| v.get("data").cloned())
        .unwrap_or(Value::Null);

    // 3. 皮肤图重命名移动
    check_cancel(cancel)?;
    lol_move_skin_images(app, cancel, &champion_dir, &champion_data)?;
    emit_localize(app, 60, "正在处理头像资源…", false);

    // 4. 英雄头像
    check_cancel(cancel)?;
    if let Some(ref img_champ) = img_champion {
        lol_base_icons(img_champ, &champion_dir.join(LOL_BASE_ICONS_FOLDER), &champion_data)?;
    }
    emit_localize(app, 70, "正在处理技能资源…", false);

    // 5. 技能
    check_cancel(cancel)?;
    lol_skill_icons(&ver_root, &champion_dir.join(LOL_SKILLS_FOLDER), &champion_data)?;
    emit_localize(app, 80, "正在处理装备资源…", false);

    // 6. 装备
    check_cancel(cancel)?;
    lol_item_images(&ver_root, &out_root.join(LOL_ITEM_SUBFOLDER))?;
    emit_localize(app, 90, "正在处理符文资源…", false);

    // 7. 符文
    check_cancel(cancel)?;
    lol_rune_images(data_dir, &ver_root, &out_root.join(LOL_RUNE_SUBFOLDER))?;

    emit_localize(app, 100, "联盟汉化完成", true);
    Ok(out_root.to_string_lossy().into_owned())
}

/// 对已解压的官方数据包目录执行联盟汉化,返回汉化输出目录路径。
#[tauri::command]
pub async fn run_lol_localization(
    app: AppHandle,
    state: State<'_, CancelFlag>,
    data_dir: String,
) -> Result<String, String> {
    state.0.store(false, Ordering::SeqCst);
    let cancel = state.0.clone();
    let data_dir = PathBuf::from(data_dir);

    let result = tokio::task::spawn_blocking(move || localize_lol(&app, &cancel, &data_dir))
        .await
        .map_err(|e| format!("汉化任务异常:{e}"))?;
    result
}

// ---------------------------------------------------------------------------
// 单元测试
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_removes_illegal() {
        assert_eq!(sanitize("a/b:c*d?e\"f<g>h|i\\j"), "abcdefghij");
        assert_eq!(sanitize("黑暗之女 安妮"), "黑暗之女 安妮");
    }

    #[test]
    fn version_string_detection() {
        assert!(is_version_string("14.10.1"));
        assert!(!is_version_string("14.10"));
        assert!(!is_version_string("14.x.1"));
        assert!(!is_version_string("latest"));
    }

    #[test]
    fn parse_skin() {
        assert_eq!(parse_skin_filename("Aatrox_0"), Some(("Aatrox".into(), 0)));
        assert_eq!(parse_skin_filename("MonkeyKing_12"), Some(("MonkeyKing".into(), 12)));
        assert_eq!(parse_skin_filename("NoNumber"), None);
        assert_eq!(parse_skin_filename("Bad_x"), None);
    }

    #[test]
    fn strip_perk() {
        assert_eq!(
            strip_perk_prefix("perk-images/Styles/7201_Precision.png"),
            "Styles/7201_Precision.png"
        );
        assert_eq!(strip_perk_prefix("Styles/x.png"), "Styles/x.png");
    }

    #[test]
    fn skin_base_default_and_named() {
        let info = serde_json::json!({
            "name": "黑暗之女", "title": "安妮",
            "skins": [{"num":0,"name":"default"},{"num":1,"name":"圣诞快乐"}]
        });
        assert_eq!(
            compute_skin_file_base(&info, 0, "黑暗之女", "安妮"),
            Some("黑暗之女 安妮".into())
        );
        assert_eq!(
            compute_skin_file_base(&info, 1, "黑暗之女", "安妮"),
            Some("圣诞快乐".into())
        );
        let info2 = serde_json::json!({"name":"X","title":"Y","skins":[{"num":2,"name":"default"}]});
        assert_eq!(compute_skin_file_base(&info2, 2, "X", "Y"), Some("X Y".into()));
        assert_eq!(compute_skin_file_base(&info2, 99, "X", "Y"), None);
    }
}
