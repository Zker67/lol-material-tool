package material

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func decode(t *testing.T, s string) any {
	t.Helper()
	dec := json.NewDecoder(strings.NewReader(s))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		t.Fatal(err)
	}
	return v
}

func TestSanitizeRemovesIllegal(t *testing.T) {
	if got := sanitize(`a/b:c*d?e"f<g>h|i\j`); got != "abcdefghij" {
		t.Errorf("sanitize = %q", got)
	}
	if got := sanitize("黑暗之女 安妮"); got != "黑暗之女 安妮" {
		t.Errorf("sanitize = %q", got)
	}
}

func TestVersionStringDetection(t *testing.T) {
	for s, want := range map[string]bool{"14.10.1": true, "14.10": false, "14.x.1": false, "latest": false, "1..2": false} {
		if got := isVersionString(s); got != want {
			t.Errorf("isVersionString(%q) = %v", s, got)
		}
	}
}

func TestParseSkin(t *testing.T) {
	cases := []struct {
		stem string
		id   string
		num  int64
		ok   bool
	}{
		{"Aatrox_0", "Aatrox", 0, true},
		{"MonkeyKing_12", "MonkeyKing", 12, true},
		{"NoNumber", "", 0, false},
		{"Bad_x", "", 0, false},
		{"_3", "", 0, false},
		{"Bad-Id_3", "", 0, false},
	}
	for _, c := range cases {
		id, num, ok := parseSkinFilename(c.stem)
		if id != c.id || num != c.num || ok != c.ok {
			t.Errorf("parseSkinFilename(%q) = %q, %d, %v", c.stem, id, num, ok)
		}
	}
}

func TestStripPerk(t *testing.T) {
	if got := stripPerkPrefix("perk-images/Styles/7201_Precision.png"); got != "Styles/7201_Precision.png" {
		t.Errorf("got %q", got)
	}
	if got := stripPerkPrefix("Styles/x.png"); got != "Styles/x.png" {
		t.Errorf("got %q", got)
	}
}

func TestSkinBaseDefaultAndNamed(t *testing.T) {
	info := decode(t, `{"name":"黑暗之女","title":"安妮","skins":[{"num":0,"name":"default"},{"num":1,"name":"圣诞快乐"}]}`)
	if got, ok := computeSkinFileBase(info, 0, "黑暗之女", "安妮"); !ok || got != "黑暗之女 安妮" {
		t.Errorf("num 0 = %q, %v", got, ok)
	}
	if got, ok := computeSkinFileBase(info, 1, "黑暗之女", "安妮"); !ok || got != "圣诞快乐" {
		t.Errorf("num 1 = %q, %v", got, ok)
	}
	info2 := decode(t, `{"name":"X","title":"Y","skins":[{"num":2,"name":"default"}]}`)
	if got, ok := computeSkinFileBase(info2, 2, "X", "Y"); !ok || got != "X Y" {
		t.Errorf("default only = %q, %v", got, ok)
	}
	if _, ok := computeSkinFileBase(info2, 99, "X", "Y"); ok {
		t.Error("missing num should fail")
	}
}

func TestSkinNumOf(t *testing.T) {
	for in, want := range map[string]int64{`{"num":3}`: 3, `{"id":"103001"}`: 1, `{"id":103012}`: 12, `{"num":0,"id":"103005"}`: 0} {
		if got, ok := skinNumOf(decode(t, in)); !ok || got != want {
			t.Errorf("skinNumOf(%s) = %d, %v", in, got, ok)
		}
	}
	if _, ok := skinNumOf(decode(t, `{"id":"x"}`)); ok {
		t.Error("bad id should fail")
	}
}

func TestFindChampFallbacks(t *testing.T) {
	data := decode(t, `{"Aatrox":{"name":"a"},"Fiddlesticks":{"name":"f"},"lower":{"name":"l"}}`)
	for id, want := range map[string]string{"Aatrox": "a", "AATROX": "a", "FiddleSticks": "f", "LOWER": "l"} {
		info, ok := findChamp(data, id)
		if !ok || str(info, "name") != want {
			t.Errorf("findChamp(%q) = %v, %v", id, info, ok)
		}
	}
	if _, ok := findChamp(data, "Nobody"); ok {
		t.Error("unknown id should fail")
	}
	if _, ok := findChamp(nil, "Aatrox"); ok {
		t.Error("nil data should fail")
	}
}

func names(items []any) []string {
	var out []string
	for _, it := range items {
		out = append(out, str(it, "name"))
	}
	return out
}

func TestTFTItemsFromDataList(t *testing.T) {
	got := names(collectTFTItems(decode(t, `{"data":[{"name":"b"},{"name":"a"}]}`)))
	if !slices.Equal(got, []string{"b", "a"}) {
		t.Errorf("got %v", got)
	}
}

func TestTFTItemsFromDataDictSortedByKey(t *testing.T) {
	got := names(collectTFTItems(decode(t, `{"data":{"Y":{"name":"b"},"X":{"name":"a"}}}`)))
	if !slices.Equal(got, []string{"a", "b"}) {
		t.Errorf("got %v", got)
	}
}

func TestTFTItemsFromSets(t *testing.T) {
	raw := decode(t, `{"data":{},"sets":{"11":{"champions":[{"name":"b"},{"name":"c"}]},"10":{"champions":[{"name":"a"}]},"9":{}}}`)
	got := names(collectTFTItems(raw))
	if !slices.Equal(got, []string{"a", "b", "c"}) {
		t.Errorf("got %v", got)
	}
}

// writeFile 写入文件并创建父目录。
func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

// listTree 返回 root 下所有文件的相对路径及其内容。
func listTree(t *testing.T, root string) map[string]string {
	t.Helper()
	out := map[string]string{}
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		data, err := os.ReadFile(path)
		out[filepath.ToSlash(rel)] = string(data)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// makeFixturePack 在 dir 下造一个最小的已解压数据包,结构同 dragontail。
func makeFixturePack(t *testing.T, dir string) string {
	t.Helper()
	pack := filepath.Join(dir, LeagueDataSubfolder+"-1.2.3")
	ver := filepath.Join(pack, "1.2.3")
	data := filepath.Join(ver, "data", "zh_CN")

	writeFile(t, filepath.Join(data, "championFull.json"), `{"data":{
		"Annie":{"name":"黑暗之女","title":"安妮","skins":[{"num":0,"name":"default"},{"num":1,"name":"哥特/萝莉"},{"num":2,"name":"default"}],
			"spells":[{"name":"碎裂之火","image":{"full":"AnnieQ.png"}},{"name":"W","image":{"full":"AnnieW.png"}},{"name":"E","image":{"full":"AnnieE.png"}},{"name":"R","image":{"full":"AnnieR.png"}},{"name":"多余","image":{"full":"AnnieX.png"}}],
			"passive":{"name":"嗜火","image":{"full":"Annie_Passive.png"}}},
		"Fiddlesticks":{"name":"远古恐惧","title":"费德提克","skins":[{"num":0,"name":"default"}]}}}`)
	writeFile(t, filepath.Join(data, "item.json"), `{"data":{"1001":{"name":"鞋子"},"1002":{"name":""}}}`)
	writeFile(t, filepath.Join(data, "runesReforged.json"), `[{"name":"精密","icon":"perk-images/Styles/7201_Precision.png",
		"slots":[{"runes":[{"name":"强攻","icon":"perk-images/Styles/Precision/PressTheAttack.png"}]}]}]`)
	writeFile(t, filepath.Join(data, "tft-item.json"), `{"data":{"B":{"name":"无尽之刃","image":{"full":"b.png"}},"A":{"name":"无尽之刃","image":{"full":"a.png"}}}}`)
	writeFile(t, filepath.Join(data, "tft-trait.json"), `{"data":[{"name":"法师","image":{"full":"mage.png"}},{"name":"","image":{"full":"x.png"}},"bad"]}`)
	writeFile(t, filepath.Join(data, "tft-champion.json"), `{"data":{},"sets":{"2":{"champions":[{"name":"安妮","image":{"full":"annie.png"}}]}}}`)
	writeFile(t, filepath.Join(data, "tft-augments.json"), `{"data":{"X":{"name":"海克斯","image":{"full":"aug.png"}}}}`)

	img := filepath.Join(ver, "img")
	for _, f := range []string{"Annie_0.jpg", "Annie_1.jpg", "Annie_2.jpg", "FiddleSticks_0.jpg", "Nobody_0.jpg", "Annie_9.jpg"} {
		writeFile(t, filepath.Join(img, "champion", "splash", f), "splash "+f)
	}
	writeFile(t, filepath.Join(img, "champion", "tiles", "Annie_0.jpg"), "tile")
	writeFile(t, filepath.Join(img, "champion", "Annie.png"), "icon annie")
	writeFile(t, filepath.Join(img, "champion", "FiddleSticks.png"), "icon fiddle")
	for _, f := range []string{"AnnieQ.png", "AnnieW.png", "AnnieE.png", "AnnieR.png", "AnnieX.png"} {
		writeFile(t, filepath.Join(img, "spell", f), f)
	}
	writeFile(t, filepath.Join(img, "passive", "Annie_Passive.png"), "passive")
	writeFile(t, filepath.Join(img, "item", "1001.png"), "boots")
	writeFile(t, filepath.Join(img, "item", "1002.png"), "unnamed")
	writeFile(t, filepath.Join(img, "item", "9999.png"), "unknown")
	writeFile(t, filepath.Join(img, "tft-item", "a.png"), "item a")
	writeFile(t, filepath.Join(img, "tft-item", "b.png"), "item b")
	writeFile(t, filepath.Join(img, "tft-trait", "mage.png"), "mage")
	writeFile(t, filepath.Join(img, "tft-champion", "annie.png"), "tft annie")
	writeFile(t, filepath.Join(img, "tft-augment", "aug.png"), "aug")
	// 符文图标在版本目录之外(不变量 §4)
	perk := filepath.Join(pack, "img", "perk-images")
	writeFile(t, filepath.Join(perk, "Styles", "7201_Precision.png"), "precision")
	writeFile(t, filepath.Join(perk, "Styles", "Precision", "PressTheAttack.png"), "pta")
	writeFile(t, filepath.Join(perk, "StatMods", "StatModsArmorIcon.png"), "armor")
	return pack
}

func TestLocalizeLoLFixture(t *testing.T) {
	dir := t.TempDir()
	pack := makeFixturePack(t, dir)

	var events []Progress
	out, err := LocalizeLoL(context.Background(), pack, func(p Progress) { events = append(events, p) })
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, LoLLocalizedPrefix+"-1.2.3"); out != want {
		t.Errorf("out = %q, want %q", out, want)
	}
	want := map[string]string{
		"英雄/插画/黑暗之女 安妮/黑暗之女 安妮.jpg":     "splash Annie_2.jpg", // 序号 2 只有 default,覆盖序号 0
		"英雄/插画/黑暗之女 安妮/哥特萝莉.jpg":        "splash Annie_1.jpg",
		"英雄/插画/远古恐惧 费德提克/远古恐惧 费德提克.jpg": "splash FiddleSticks_0.jpg",
		"英雄/插画/Nobody_0.jpg":            "splash Nobody_0.jpg",
		"英雄/插画/Annie_9.jpg":             "splash Annie_9.jpg",
		"英雄/皮肤头像/黑暗之女 安妮/黑暗之女 安妮.jpg":   "tile",
		"英雄/头像/黑暗之女 安妮.png":             "icon annie",
		"英雄/头像/远古恐惧 费德提克.png":           "icon fiddle",
		"英雄/英雄技能/黑暗之女 安妮/Q技能 碎裂之火.png":  "AnnieQ.png",
		"英雄/英雄技能/黑暗之女 安妮/W技能 W.png":     "AnnieW.png",
		"英雄/英雄技能/黑暗之女 安妮/E技能 E.png":     "AnnieE.png",
		"英雄/英雄技能/黑暗之女 安妮/R技能 R.png":     "AnnieR.png",
		"英雄/英雄技能/黑暗之女 安妮/S技能 多余.png":    "AnnieX.png",
		"英雄/英雄技能/黑暗之女 安妮/被动技能 嗜火.png":   "passive",
		"装备/鞋子.png":         "boots",
		"符文/精密/精密.png":      "precision",
		"符文/精密/强攻.png":      "pta",
		"符文/属性点/属性点 护甲.png": "armor",
	}
	got := listTree(t, out)
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
	for k := range got {
		if _, ok := want[k]; !ok {
			t.Errorf("unexpected file %s", k)
		}
	}
	for _, d := range []string{"符文/主宰", "符文/启迪", "英雄/英雄技能/远古恐惧 费德提克"} {
		if !isDir(filepath.Join(out, d)) {
			t.Errorf("missing dir %s", d)
		}
	}
	if last := events[len(events)-1]; !last.Done || last.Current != 100 || last.Message != "联盟汉化完成" {
		t.Errorf("last event = %+v", last)
	}

	// 重跑保持幂等
	if _, err := LocalizeLoL(context.Background(), pack, nil); err != nil {
		t.Fatal(err)
	}
	if again := listTree(t, out); len(again) != len(got) {
		t.Errorf("rerun produced %d files, want %d", len(again), len(got))
	}
}

func TestLocalizeTFTFixture(t *testing.T) {
	dir := t.TempDir()
	pack := makeFixturePack(t, dir)

	var events []Progress
	out, err := LocalizeTFT(context.Background(), pack, func(p Progress) { events = append(events, p) })
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"装备/无尽之刃.png":   "item b", // 对象按 key 字节序遍历,B 后写覆盖 A
		"羁绊/法师.png":     "mage",
		"弈子/安妮.png":     "tft annie",
		"海克斯强化/海克斯.png": "aug",
	}
	got := listTree(t, out)
	if len(got) != len(want) {
		t.Errorf("got %v", got)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
	if len(events) != len(tftLocalizationConfig)+2 || events[3].Current != 28 {
		t.Errorf("events = %+v", events)
	}
}

func TestLocalizeNoVersion(t *testing.T) {
	dir := t.TempDir()
	if _, err := LocalizeLoL(context.Background(), dir, nil); err == nil || !strings.Contains(err.Error(), "找到有效数据") {
		t.Errorf("err = %v", err)
	}
	if _, err := LocalizeTFT(context.Background(), dir, nil); err == nil {
		t.Error("want error")
	}
}

func TestLocalizeCanceled(t *testing.T) {
	pack := makeFixturePack(t, t.TempDir())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := LocalizeLoL(ctx, pack, nil); !errors.Is(err, ErrCanceled) {
		t.Errorf("lol err = %v", err)
	}
	if _, err := LocalizeTFT(ctx, pack, nil); !errors.Is(err, ErrCanceled) {
		t.Errorf("tft err = %v", err)
	}
}

func TestLocalizeBadJSON(t *testing.T) {
	pack := makeFixturePack(t, t.TempDir())
	writeFile(t, filepath.Join(pack, "1.2.3", "data", "zh_CN", "item.json"), "{bad")
	if _, err := LocalizeLoL(context.Background(), pack, nil); err == nil || !strings.Contains(err.Error(), "解析") {
		t.Errorf("err = %v", err)
	}
}

// makeLegacyPack 造一个按真实数据包布局的旧版本(3.x):原画在根目录 img/champion/ 下,
// 没有 championFull.json,只有单英雄 JSON,符文与天赋为旧系统。
func makeLegacyPack(t *testing.T, dir string) string {
	t.Helper()
	pack := filepath.Join(dir, LeagueDataSubfolder+"-3.6.14")
	ver := filepath.Join(pack, "3.6.14")
	data := filepath.Join(ver, "data", "zh_CN")
	writeFile(t, filepath.Join(data, "champion.json"), `{"data":{"Ahri":{"name":"九尾妖狐","title":"阿狸"}}}`)
	writeFile(t, filepath.Join(data, "champion", "Ahri.json"), `{"data":{"Ahri":{"name":"九尾妖狐","title":"阿狸",
		"skins":[{"id":"103000","name":"default"},{"id":"103001","name":"高丽风情"}],
		"spells":[{"name":"欺诈宝珠","image":{"full":"AhriOrbofDeception.png"}}],
		"passive":{"name":"摄魂夺魄","image":{"full":"Ahri_SoulEater.png"}}}}}`)
	writeFile(t, filepath.Join(data, "champion", "readme.txt"), "not json")
	writeFile(t, filepath.Join(data, "item.json"), `{"data":{"1001":{"name":"速度之靴"}}}`)
	writeFile(t, filepath.Join(data, "rune.json"), `{"data":{"5001":{"name":"攻击力印记","image":{"full":"r_1_1.png"}},"5002":{"name":"","image":{"full":"r_1_2.png"}}}}`)
	writeFile(t, filepath.Join(data, "mastery.json"), `{"data":{"4111":{"name":"双刃剑","image":{"full":"4111.png"}}}}`)

	writeFile(t, filepath.Join(ver, "img", "champion", "Ahri.png"), "icon")
	writeFile(t, filepath.Join(ver, "img", "spell", "AhriOrbofDeception.png"), "q")
	writeFile(t, filepath.Join(ver, "img", "passive", "Ahri_SoulEater.png"), "p")
	writeFile(t, filepath.Join(ver, "img", "item", "1001.png"), "boots")
	writeFile(t, filepath.Join(ver, "img", "rune", "r_1_1.png"), "rune")
	writeFile(t, filepath.Join(ver, "img", "rune", "r_1_2.png"), "unnamed")
	writeFile(t, filepath.Join(ver, "img", "mastery", "4111.png"), "mastery")
	writeFile(t, filepath.Join(pack, "img", "champion", "splash", "Ahri_0.jpg"), "splash 0")
	writeFile(t, filepath.Join(pack, "img", "champion", "splash", "Ahri_1.jpg"), "splash 1")
	writeFile(t, filepath.Join(pack, "img", "champion", "loading", "Ahri_0.jpg"), "loading 0")
	return pack
}

func TestLocalizeLoLRealLayoutAndLegacyData(t *testing.T) {
	dir := t.TempDir()
	pack := makeLegacyPack(t, dir)
	out, err := LocalizeLoL(context.Background(), pack, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"英雄/插画/九尾妖狐 阿狸/九尾妖狐 阿狸.jpg":     "splash 0",
		"英雄/插画/九尾妖狐 阿狸/高丽风情.jpg":        "splash 1",
		"英雄/加载界面/九尾妖狐 阿狸/九尾妖狐 阿狸.jpg":   "loading 0",
		"英雄/头像/九尾妖狐 阿狸.png":             "icon",
		"英雄/英雄技能/九尾妖狐 阿狸/Q技能 欺诈宝珠.png":  "q",
		"英雄/英雄技能/九尾妖狐 阿狸/被动技能 摄魂夺魄.png": "p",
		"装备/速度之靴.png":                   "boots",
		"符文/攻击力印记.png":                  "rune",
		"天赋/双刃剑.png":                    "mastery",
	}
	got := listTree(t, out)
	for k, v := range want {
		if got[k] != v {
			t.Errorf("%s = %q, want %q", k, got[k], v)
		}
	}
	for k := range got {
		if _, ok := want[k]; !ok {
			t.Errorf("unexpected file %s", k)
		}
	}
}

func TestLocalizeTFTWithoutData(t *testing.T) {
	pack := makeLegacyPack(t, t.TempDir())
	_, err := LocalizeTFT(context.Background(), pack, nil)
	if err == nil || !strings.Contains(err.Error(), "没有云顶数据") {
		t.Errorf("err = %v", err)
	}
	if exists(filepath.Join(filepath.Dir(pack), TFTLocalizedPrefix+"-3.6.14")) {
		t.Error("should not create output when there is no TFT data")
	}
}
