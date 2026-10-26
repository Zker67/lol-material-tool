package material

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// 联盟(LoL)与云顶(TFT)汉化:把官方数据包按中文命名重组到「联盟数据汉化整理-{version}」
// 与「云顶数据汉化整理-{version}」。移植自 Tauri 版 `localize.rs`,输出须与其逐文件一致:
// JSON 对象按 key 的字节序遍历(同 serde_json 默认的 BTreeMap),重名时后写覆盖先写。

// ---------------------------------------------------------------------------
// 基础辅助
// ---------------------------------------------------------------------------

// sanitize 去除文件名中的非法字符(对应 Flet `sanitize_filename_for_rename`)。
func sanitize(name string) string {
	return strings.Map(func(r rune) rune {
		if strings.ContainsRune(`\/*?:"<>|`, r) {
			return -1
		}
		return r
	}, name)
}

// isVersionString 判断是否形如 `数字.数字.数字`。
func isVersionString(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return false
	}
	for _, p := range parts {
		if p == "" || strings.Trim(p, "0123456789") != "" {
			return false
		}
	}
	return true
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func isFile(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

func exists(path string) bool {
	_, err := os.Lstat(path)
	return err == nil
}

// detectVersion 探测数据包目录下形如 `x.y.z` 且含 `data/` 与 `img/` 的版本子目录名。
func detectVersion(dataDir string) (string, bool) {
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return "", false
	}
	for _, e := range entries {
		path := filepath.Join(dataDir, e.Name())
		if !isDir(path) {
			continue
		}
		if isVersionString(e.Name()) && isDir(filepath.Join(path, "data")) && isDir(filepath.Join(path, "img")) {
			return e.Name(), true
		}
	}
	return "", false
}

// firstExisting 返回首个存在的目录。
func firstExisting(paths ...string) (string, bool) {
	for _, p := range paths {
		if isDir(p) {
			return p, true
		}
	}
	return "", false
}

// stripPerkPrefix 去掉符文图标路径里的 `perk-images/` 前缀(对应 Flet `relative_to("perk-images")`)。
func stripPerkPrefix(icon string) string {
	return strings.TrimPrefix(icon, "perk-images/")
}

// parseSkinFilename 解析皮肤文件名 `Champ_N`(已去扩展名)为 (英雄 id, 皮肤序号)。
func parseSkinFilename(stem string) (string, int64, bool) {
	idx := strings.LastIndexByte(stem, '_')
	if idx < 0 {
		return "", 0, false
	}
	id, num := stem[:idx], stem[idx+1:]
	if id == "" || num == "" {
		return "", 0, false
	}
	for i := 0; i < len(id); i++ {
		c := id[i]
		if !('0' <= c && c <= '9' || 'a' <= c && c <= 'z' || 'A' <= c && c <= 'Z') {
			return "", 0, false
		}
	}
	n, err := strconv.ParseInt(num, 10, 64)
	if err != nil {
		return "", 0, false
	}
	return id, n, true
}

// jsonObject 是解码后的 JSON 对象。
type jsonObject = map[string]any

// field 取对象的字段,v 不是对象或字段不存在时返回 nil。
func field(v any, key string) any {
	o, _ := v.(jsonObject)
	return o[key]
}

// str 取对象中字符串字段的值,不是字符串时返回 ""。
func str(v any, key string) string {
	s, _ := field(v, key).(string)
	return s
}

// imageFull 取 `image.full` 字段。
func imageFull(v any) (string, bool) {
	s, ok := field(field(v, "image"), "full").(string)
	return s, ok
}

// int64Of 把整数形式的 JSON 数字转为 int64(对应 serde_json `as_i64`)。
func int64Of(v any) (int64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	i, err := strconv.ParseInt(string(n), 10, 64)
	return i, err == nil
}

// skinNumOf 取皮肤序号:优先 num 字段;早期版本(如 3.6.14)没有 num,
// 由全局皮肤 ID 的后三位推出(103001 → 1)。
func skinNumOf(skin any) (int64, bool) {
	if n, ok := int64Of(field(skin, "num")); ok {
		return n, true
	}
	id, err := strconv.ParseInt(idString(field(skin, "id")), 10, 64)
	if err != nil || id < 0 {
		return 0, false
	}
	return id % 1000, true
}

// sortedValues 按 key 的字节序返回对象的值。
func sortedValues(o jsonObject) []any {
	keys := make([]string, 0, len(o))
	for k := range o {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	values := make([]any, len(keys))
	for i, k := range keys {
		values[i] = o[k]
	}
	return values
}

// findChamp 在 championFull.json 的 data 中按 id 查英雄(带大小写 / Fiddlesticks 兜底)。
func findChamp(champData any, champID string) (any, bool) {
	data, ok := champData.(jsonObject)
	if !ok {
		return nil, false
	}
	if v, ok := data[champID]; ok {
		return v, true
	}
	// 首字母大写其余小写
	capitalized := ""
	if r, size := utf8.DecodeRuneInString(champID); size > 0 {
		capitalized = strings.ToUpper(string(r)) + strings.ToLower(champID[size:])
	}
	if v, ok := data[capitalized]; ok {
		return v, true
	}
	if v, ok := data[strings.ToLower(champID)]; ok {
		return v, true
	}
	if strings.EqualFold(champID, "fiddlesticks") {
		if v, ok := data["Fiddlesticks"]; ok {
			return v, true
		}
	}
	return nil, false
}

// computeSkinFileBase 计算皮肤图重命名后的基名(对应 Flet 中的 `next(...)` 逻辑)。
//   - 序号 0 → 「称号 本名」
//   - 否则取 skins 中 num 匹配且 name != "default" 的名字
//   - 若该序号只有 default → 退回「称号 本名」;序号不存在 → false
func computeSkinFileBase(info any, skinNum int64, name, title string) (string, bool) {
	if skinNum == 0 {
		return name + " " + title, true
	}
	o, _ := info.(jsonObject)
	skins, ok := o["skins"].([]any)
	if !ok {
		return "", false
	}
	for _, s := range skins {
		sm, _ := s.(jsonObject)
		if n, ok := skinNumOf(sm); ok && n == skinNum {
			if sn, ok := sm["name"].(string); ok && !strings.EqualFold(sn, "default") {
				return sn, true
			}
		}
	}
	for _, s := range skins {
		sm, _ := s.(jsonObject)
		if n, ok := skinNumOf(sm); ok && n == skinNum {
			if sn, ok := sm["name"].(string); ok && strings.EqualFold(sn, "default") {
				return name + " " + title, true
			}
		}
	}
	return "", false
}

// loadJSON 读取 JSON 文件并返回根值;数字保留为 json.Number。
func loadJSON(path string) (any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("读取 %s 失败:%w", path, err)
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, fmt.Errorf("解析 %s 失败:%w", path, err)
	}
	return v, nil
}

// copyFile 复制文件(覆盖)。
func copyFile(src, dest string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// copyOverwrite 复制文件(覆盖),忽略错误。
func copyOverwrite(src, dest string) {
	copyFile(src, dest)
}

// moveOverwrite 移动文件(目标存在先删,绕开 Windows rename 限制),忽略错误。
func moveOverwrite(src, dest string) {
	if exists(dest) {
		os.Remove(dest)
	}
	os.Rename(src, dest)
}

// copyDirAll 递归复制目录(对应 Python `shutil.copytree`)。
func copyDirAll(src, dest string) error {
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	for _, e := range entries {
		path := filepath.Join(src, e.Name())
		target := filepath.Join(dest, e.Name())
		if isDir(path) {
			if err := copyDirAll(path, target); err != nil {
				return err
			}
		} else if err := copyFile(path, target); err != nil {
			return err
		}
	}
	return nil
}

func localizeProgress(current uint64, message string, done bool) Progress {
	return Progress{Stage: StageLocalize, Current: current, Total: 100, Message: message, Done: done}
}

// ---------------------------------------------------------------------------
// 联盟汉化子任务
// ---------------------------------------------------------------------------

// lolMoveSkinImages 皮肤图重命名 + 按英雄建「称号 本名」文件夹并移动。
func lolMoveSkinImages(ctx context.Context, onProgress ProgressFunc, championDir string, champData any) error {
	var processed uint64
	for _, m := range imageSubfolderMapping {
		catPath := filepath.Join(championDir, m.to)
		if !isDir(catPath) {
			continue
		}
		entries, err := os.ReadDir(catPath)
		if err != nil {
			continue
		}
		for _, e := range entries {
			item := filepath.Join(catPath, e.Name())
			if !isFile(item) {
				continue
			}
			fname := e.Name()
			if !strings.HasSuffix(strings.ToLower(fname), ".jpg") {
				continue
			}
			champID, skinNum, ok := parseSkinFilename(fname[:len(fname)-4])
			if !ok {
				continue
			}
			info, ok := findChamp(champData, champID)
			if !ok {
				continue
			}
			name, title := str(info, "name"), str(info, "title")
			if name == "" || title == "" {
				continue
			}
			fileBase, ok := computeSkinFileBase(info, skinNum, name, title)
			if !ok {
				continue
			}
			heroFolder := filepath.Join(catPath, sanitize(name+" "+title))
			os.MkdirAll(heroFolder, 0o755)
			moveOverwrite(item, filepath.Join(heroFolder, sanitize(fileBase)+".jpg"))
			processed++
			if processed%200 == 0 {
				if err := checkCancel(ctx); err != nil {
					return err
				}
				onProgress.emit(localizeProgress(20, fmt.Sprintf("正在处理皮肤图像…已 %d 张", processed), false))
			}
		}
	}
	return nil
}

// lolBaseIcons 英雄基础头像:`{ChampId}.png` → `头像/{称号 本名}.png`(复制)。
func lolBaseIcons(imgChamp, dest string, champData any) error {
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return fmt.Errorf("创建头像目录失败:%w", err)
	}
	entries, err := os.ReadDir(imgChamp)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		fname := e.Name()
		if !strings.HasSuffix(strings.ToLower(fname), ".png") {
			continue
		}
		info, ok := findChamp(champData, fname[:len(fname)-4])
		if !ok {
			continue
		}
		name, title := str(info, "name"), str(info, "title")
		if name == "" || title == "" {
			continue
		}
		copyOverwrite(filepath.Join(imgChamp, fname), filepath.Join(dest, sanitize(name+" "+title)+".png"))
	}
	return nil
}

// lolSkillIcons 英雄技能:QWER 主动 + 被动,按英雄分文件夹(复制)。
func lolSkillIcons(verRoot, skillsDest string, champData any) error {
	srcSpell := filepath.Join(verRoot, "img", "spell")
	srcPassive := filepath.Join(verRoot, "img", "passive")
	if !isDir(srcSpell) || !isDir(srcPassive) {
		return nil
	}
	if err := os.MkdirAll(skillsDest, 0o755); err != nil {
		return fmt.Errorf("创建技能目录失败:%w", err)
	}
	data, ok := champData.(jsonObject)
	if !ok {
		return nil
	}
	keys := []string{"Q", "W", "E", "R"}
	for _, info := range sortedValues(data) {
		name, title := str(info, "name"), str(info, "title")
		if name == "" || title == "" {
			continue
		}
		heroFolder := filepath.Join(skillsDest, sanitize(name+" "+title))
		os.MkdirAll(heroFolder, 0o755)
		if spells, ok := field(info, "spells").([]any); ok {
			for i, spell := range spells {
				key := "S"
				if i < 4 {
					key = keys[i]
				}
				orig, ok1 := imageFull(spell)
				sname, ok2 := field(spell, "name").(string)
				if ok1 && ok2 {
					src := filepath.Join(srcSpell, orig)
					if isFile(src) {
						copyOverwrite(src, filepath.Join(heroFolder, sanitize(key+"技能 "+sname)+".png"))
					}
				}
			}
		}
		if passive, ok := info.(jsonObject)["passive"]; ok {
			orig, ok1 := imageFull(passive)
			pname, ok2 := field(passive, "name").(string)
			if ok1 && ok2 {
				src := filepath.Join(srcPassive, orig)
				if isFile(src) {
					copyOverwrite(src, filepath.Join(heroFolder, sanitize("被动技能 "+pname)+".png"))
				}
			}
		}
	}
	return nil
}

// lolItemImages 装备:`{ItemId}.png` → `装备/{中文名}.png`(复制)。
func lolItemImages(verRoot, itemDest string) error {
	src := filepath.Join(verRoot, "img", "item")
	jsonPath := filepath.Join(verRoot, "data", "zh_CN", "item.json")
	if !isDir(src) || !isFile(jsonPath) {
		return nil
	}
	root, err := loadJSON(jsonPath)
	if err != nil {
		return err
	}
	rootObj, _ := root.(jsonObject)
	data, ok := rootObj["data"].(jsonObject)
	if !ok {
		return nil
	}
	if err := os.MkdirAll(itemDest, 0o755); err != nil {
		return fmt.Errorf("创建装备目录失败:%w", err)
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return fmt.Errorf("读取装备图失败:%w", err)
	}
	for _, e := range entries {
		fname := e.Name()
		if !strings.HasSuffix(strings.ToLower(fname), ".png") {
			continue
		}
		info, ok := data[fname[:len(fname)-4]]
		if !ok {
			continue
		}
		name := str(info, "name")
		if name == "" {
			continue
		}
		copyOverwrite(filepath.Join(src, fname), filepath.Join(itemDest, sanitize(name)+".png"))
	}
	return nil
}

// lolRuneImages 符文:五系分类图标 + 各符文 + 属性点(复制)。runesReforged.json 顶层是数组。
func lolRuneImages(dataDir, verRoot, runeDest string) error {
	srcPerk, ok := firstExisting(
		filepath.Join(dataDir, "img", "perk-images"),
		filepath.Join(verRoot, "img", "perk-images"),
	)
	if !ok {
		return nil
	}
	jsonPath := filepath.Join(verRoot, "data", "zh_CN", "runesReforged.json")
	if !isFile(jsonPath) {
		return nil
	}
	runesData, err := loadJSON(jsonPath)
	if err != nil {
		return err
	}
	arr, ok := runesData.([]any)
	if !ok {
		return nil
	}

	if err := os.MkdirAll(runeDest, 0o755); err != nil {
		return fmt.Errorf("创建符文目录失败:%w", err)
	}
	for _, c := range runeCategoriesInfo {
		os.MkdirAll(filepath.Join(runeDest, c.to), 0o755)
	}
	statmodsDir := filepath.Join(runeDest, statmodsFolderName)
	os.MkdirAll(statmodsDir, 0o755)

	for _, cat := range arr {
		catName, catIcon := str(cat, "name"), str(cat, "icon")
		if catName == "" || catIcon == "" {
			continue
		}
		destCat := filepath.Join(runeDest, catName)
		os.MkdirAll(destCat, 0o755)
		srcCatIcon := filepath.Join(srcPerk, stripPerkPrefix(catIcon))
		if isFile(srcCatIcon) {
			copyOverwrite(srcCatIcon, filepath.Join(destCat, sanitize(catName)+".png"))
		}
		slots, _ := field(cat, "slots").([]any)
		for _, slot := range slots {
			runes, ok := field(slot, "runes").([]any)
			if !ok {
				continue
			}
			for _, rune := range runes {
				rname, ricon := str(rune, "name"), str(rune, "icon")
				if rname == "" || ricon == "" {
					continue
				}
				srcRune := filepath.Join(srcPerk, stripPerkPrefix(ricon))
				if isFile(srcRune) {
					copyOverwrite(srcRune, filepath.Join(destCat, sanitize(rname)+".png"))
				}
			}
		}
	}

	srcStatmods := filepath.Join(srcPerk, "StatMods")
	if isDir(srcStatmods) {
		for _, m := range statmodsMapping {
			src := filepath.Join(srcStatmods, m.from)
			if isFile(src) {
				copyOverwrite(src, filepath.Join(statmodsDir, m.to))
			}
		}
	}
	return nil
}

// lolNamedImages 把 `zh_CN/{jsonFile}` 中 data 的每一项按 `image.full` 从 `img/{imgGroup}`
// 复制为 `{dest}/{name}.png`。用于 7.23 及更早的旧符文(rune.json)与天赋(mastery.json)。
func lolNamedImages(verRoot, jsonFile, imgGroup, dest string) error {
	jsonPath := filepath.Join(verRoot, "data", "zh_CN", jsonFile)
	srcDir := filepath.Join(verRoot, "img", imgGroup)
	if !isFile(jsonPath) || !isDir(srcDir) {
		return nil
	}
	root, err := loadJSON(jsonPath)
	if err != nil {
		return err
	}
	data, ok := field(root, "data").(jsonObject)
	if !ok {
		return nil
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return fmt.Errorf("创建 %s 目录失败:%w", filepath.Base(dest), err)
	}
	for _, info := range sortedValues(data) {
		name := str(info, "name")
		full, ok := imageFull(info)
		if name == "" || !ok || full == "" {
			continue
		}
		src := filepath.Join(srcDir, full)
		if isFile(src) {
			copyOverwrite(src, filepath.Join(dest, sanitize(name)+".png"))
		}
	}
	return nil
}

// loadChampionData 读取英雄数据:优先 championFull.json 的 data;
// 3.12 之前没有该文件,改为合并 `champion/{id}.json` 的 data。读不到时返回 nil。
func loadChampionData(verRoot string) any {
	zh := filepath.Join(verRoot, "data", "zh_CN")
	if root, err := loadJSON(filepath.Join(zh, "championFull.json")); err == nil {
		if data, ok := field(root, "data").(jsonObject); ok {
			return data
		}
	}
	entries, err := os.ReadDir(filepath.Join(zh, "champion"))
	if err != nil {
		return nil
	}
	merged := jsonObject{}
	for _, e := range entries {
		if !strings.HasSuffix(strings.ToLower(e.Name()), ".json") {
			continue
		}
		root, err := loadJSON(filepath.Join(zh, "champion", e.Name()))
		if err != nil {
			continue
		}
		data, _ := field(root, "data").(jsonObject)
		for k, v := range data {
			merged[k] = v
		}
	}
	if len(merged) == 0 {
		return nil
	}
	return merged
}

// ---------------------------------------------------------------------------
// 联盟汉化主流程
// ---------------------------------------------------------------------------

func noVersionError(dataDir string) error {
	return fmt.Errorf("未在 %s 找到有效数据(需含 x.y.z/data 与 x.y.z/img)", dataDir)
}

// LocalizeLoL 对已解压的官方数据包目录执行联盟汉化,返回汉化输出目录路径。
func LocalizeLoL(ctx context.Context, dataDir string, onProgress ProgressFunc) (string, error) {
	version, ok := detectVersion(dataDir)
	if !ok {
		return "", noVersionError(dataDir)
	}
	onProgress.emit(localizeProgress(0, fmt.Sprintf("开始联盟汉化(版本 %s)…", version), false))

	outRoot := filepath.Join(filepath.Dir(filepath.Clean(dataDir)), LoLLocalizedPrefix+"-"+version)
	if err := os.MkdirAll(outRoot, 0o755); err != nil {
		return "", fmt.Errorf("创建输出目录失败:%w", err)
	}

	// 英雄目录:每次重建以保证幂等
	championDir := filepath.Join(outRoot, lolChampionSubfolder)
	if exists(championDir) {
		if err := os.RemoveAll(championDir); err != nil {
			return "", fmt.Errorf("清理旧英雄目录失败:%w", err)
		}
	}
	if err := os.MkdirAll(championDir, 0o755); err != nil {
		return "", fmt.Errorf("创建英雄目录失败:%w", err)
	}

	verRoot := filepath.Join(dataDir, version)
	imgChampion, hasImgChampion := firstExisting(
		filepath.Join(verRoot, "img", "champion"),
		filepath.Join(dataDir, "img", "champion"),
	)

	// 1. 复制皮肤图子目录(英文名)。官方数据包里 splash / loading / tiles / centered
	// 在根目录的 img/champion/ 下,版本目录的 img/champion/ 只有头像,两处都要找。
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	for _, m := range imageSubfolderMapping {
		src, ok := firstExisting(
			filepath.Join(verRoot, "img", "champion", m.from),
			filepath.Join(dataDir, "img", "champion", m.from),
		)
		if !ok {
			continue
		}
		dest := filepath.Join(championDir, m.from)
		if exists(dest) {
			os.RemoveAll(dest)
		}
		if err := copyDirAll(src, dest); err != nil {
			return "", fmt.Errorf("复制皮肤目录 %s 失败:%w", m.from, err)
		}
	}
	onProgress.emit(localizeProgress(10, "正在整理皮肤文件夹…", false))

	// 2. 皮肤子目录改中文
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	for _, m := range imageSubfolderMapping {
		oldPath := filepath.Join(championDir, m.from)
		newPath := filepath.Join(championDir, m.to)
		if isDir(oldPath) && oldPath != newPath {
			if exists(newPath) {
				os.RemoveAll(newPath)
			}
			os.Rename(oldPath, newPath)
		}
	}
	onProgress.emit(localizeProgress(20, "正在处理皮肤图像(耗时较长)…", false))

	// 加载英雄数据(championFull.json,旧版本合并单英雄 JSON)
	championData := loadChampionData(verRoot)

	// 3. 皮肤图重命名移动
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	if err := lolMoveSkinImages(ctx, onProgress, championDir, championData); err != nil {
		return "", err
	}
	onProgress.emit(localizeProgress(60, "正在处理头像资源…", false))

	// 4. 英雄头像
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	if hasImgChampion {
		if err := lolBaseIcons(imgChampion, filepath.Join(championDir, lolBaseIconsFolder), championData); err != nil {
			return "", err
		}
	}
	onProgress.emit(localizeProgress(70, "正在处理技能资源…", false))

	// 5. 技能
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	if err := lolSkillIcons(verRoot, filepath.Join(championDir, lolSkillsFolder), championData); err != nil {
		return "", err
	}
	onProgress.emit(localizeProgress(80, "正在处理装备资源…", false))

	// 6. 装备
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	if err := lolItemImages(verRoot, filepath.Join(outRoot, lolItemSubfolder)); err != nil {
		return "", err
	}
	onProgress.emit(localizeProgress(90, "正在处理符文资源…", false))

	// 7. 符文
	if err := checkCancel(ctx); err != nil {
		return "", err
	}
	if err := lolRuneImages(dataDir, verRoot, filepath.Join(outRoot, lolRuneSubfolder)); err != nil {
		return "", err
	}
	// 7.23 及更早:旧符文与天赋
	if err := lolNamedImages(verRoot, "rune.json", "rune", filepath.Join(outRoot, lolRuneSubfolder)); err != nil {
		return "", err
	}
	if err := lolNamedImages(verRoot, "mastery.json", "mastery", filepath.Join(outRoot, lolMasterySubfolder)); err != nil {
		return "", err
	}

	onProgress.emit(localizeProgress(100, "联盟汉化完成", true))
	return outRoot, nil
}

// ---------------------------------------------------------------------------
// 云顶(TFT)汉化
// ---------------------------------------------------------------------------

// collectTFTItems 从 TFT JSON 根提取待处理条目:`data` 为数组直接用;为对象取其 values;
// 若仍为空且存在 `sets`,则取各 set 的 `champions`(tft-champion 的分组结构)。
func collectTFTItems(raw any) []any {
	root, _ := raw.(jsonObject)
	var items []any
	switch data := root["data"].(type) {
	case []any:
		items = data
	case jsonObject:
		items = sortedValues(data)
	}
	if len(items) == 0 {
		if sets, ok := root["sets"].(jsonObject); ok {
			for _, s := range sortedValues(sets) {
				so, _ := s.(jsonObject)
				if champions, ok := so["champions"].([]any); ok {
					items = append(items, champions...)
				}
			}
		}
	}
	return items
}

// processTFTJSON 处理单个 TFT 类别:读取 zh_CN/{json},按 name 把 `img/{imgGroup}/{image.full}`
// 复制为 `{中文类名}/{name}.png`。
func processTFTJSON(c tftCategory, verRoot, tftOut string) error {
	jsonPath := filepath.Join(verRoot, "data", "zh_CN", c.jsonFile)
	if !isFile(jsonPath) {
		return nil
	}
	raw, err := loadJSON(jsonPath)
	if err != nil {
		return err
	}
	items := collectTFTItems(raw)
	if len(items) == 0 {
		return nil
	}
	destFolder := filepath.Join(tftOut, c.targetFolder)
	if err := os.MkdirAll(destFolder, 0o755); err != nil {
		return fmt.Errorf("创建 %s 目录失败:%w", c.targetFolder, err)
	}
	imgGroup := strings.Trim(c.imgGroup, "/")

	for _, item := range items {
		if _, ok := item.(jsonObject); !ok {
			continue
		}
		name := str(item, "name")
		if name == "" {
			continue
		}
		full, ok := imageFull(item)
		if !ok || full == "" {
			continue
		}
		src := filepath.Join(verRoot, "img", imgGroup, full)
		if isFile(src) {
			copyOverwrite(src, filepath.Join(destFolder, sanitize(name)+".png"))
		}
	}
	return nil
}

// LocalizeTFT 对已解压的官方数据包目录执行云顶汉化,返回汉化输出目录路径。
func LocalizeTFT(ctx context.Context, dataDir string, onProgress ProgressFunc) (string, error) {
	version, ok := detectVersion(dataDir)
	if !ok {
		return "", noVersionError(dataDir)
	}
	verRoot := filepath.Join(dataDir, version)
	hasTFT := false
	for _, c := range tftLocalizationConfig {
		hasTFT = hasTFT || isFile(filepath.Join(verRoot, "data", "zh_CN", c.jsonFile))
	}
	if !hasTFT {
		return "", fmt.Errorf("版本 %s 的数据包没有云顶数据(官方数据包自 13.1 起提供)", version)
	}
	onProgress.emit(localizeProgress(0, fmt.Sprintf("开始云顶汉化(版本 %s)…", version), false))

	outRoot := filepath.Join(filepath.Dir(filepath.Clean(dataDir)), TFTLocalizedPrefix+"-"+version)
	if err := os.MkdirAll(outRoot, 0o755); err != nil {
		return "", fmt.Errorf("创建输出目录失败:%w", err)
	}

	total := uint64(len(tftLocalizationConfig))
	for i, c := range tftLocalizationConfig {
		if err := checkCancel(ctx); err != nil {
			return "", err
		}
		onProgress.emit(localizeProgress(uint64(i)*100/total, "正在处理:"+c.targetFolder+"…", false))
		if err := processTFTJSON(c, verRoot, outRoot); err != nil {
			return "", err
		}
	}

	onProgress.emit(localizeProgress(100, "云顶汉化完成", true))
	return outRoot, nil
}
