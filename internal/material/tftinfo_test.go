package material

import (
	"context"
	"slices"
	"strings"
	"testing"
)

func TestTFTHash(t *testing.T) {
	// effects 里的哈希键,对应说明中的变量名(大小写无关)
	if got := tftHash("HealPct"); got != tftHash("healpct") || len(got) != 10 || got[0] != '{' {
		t.Errorf("hash = %q", got)
	}
	get := numberLookup(map[string]any{tftHash("BonusDamage"): 30.0, "AD": 0.35})
	if v := get("BonusDamage"); !slices.Equal(v, []float64{30}) {
		t.Errorf("hashed lookup = %v", v)
	}
	if v := get("ad"); !slices.Equal(v, []float64{0.35}) {
		t.Errorf("case-insensitive lookup = %v", v)
	}
}

func TestResolveTFTText(t *testing.T) {
	get := variableLookup(map[string][]float64{"Damage": {460, 690, 1275}, "Percent": {0.800000011920929, 0.800000011920929, 0.800000011920929}, "AD": {0.35000000596}})
	cases := map[string]string{
		"造成@ModifiedDamage@伤害":                  "造成460/690/1275伤害",
		"@Percent*100@%":                        "80%",
		"@AD*100%@%":                            "35%",
		"@Missing@ 与 @TFTUnitProperty.trait:X@": "@Missing@ 与 @TFTUnitProperty.trait:X@",
		"(%i:scaleAP%)%i:Set16Ixtal%":           "(<tftstat>法术强度</tftstat>)",
	}
	for in, want := range cases {
		if got := resolveTFTText(in, get); got != want {
			t.Errorf("resolve(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDropPairedShowIf(t *testing.T) {
	in := "a<ShowIf.X>有</ShowIf.X><ShowIfNot.X>无</ShowIfNot.X><ShowIf.Y>棱彩</ShowIf.Y>"
	if got := dropPairedShowIf(in); got != "a<ShowIfNot.X>无</ShowIfNot.X><ShowIf.Y>棱彩</ShowIf.Y>" {
		t.Errorf("got %q", got)
	}
}

func TestResolveTraitText(t *testing.T) {
	tr := cdTFTTrait{Desc: "说明@Base@<br><expandRow>(@MinUnits@) @Crit@%</expandRow>"}
	for _, e := range []struct {
		min  int64
		crit float64
	}{{2, 25}, {4, 50}} {
		tr.Effects = append(tr.Effects, struct {
			MinUnits  int64          `json:"minUnits"`
			MaxUnits  int64          `json:"maxUnits"`
			Style     int64          `json:"style"`
			Variables map[string]any `json:"variables"`
		}{MinUnits: e.min, Style: 1, Variables: map[string]any{"Crit": e.crit, "Base": 7.0}})
	}
	if got := resolveTraitText(tr); got != "说明7<br><row>(2) 25%</row><row>(4) 50%</row>" {
		t.Errorf("expandRow = %q", got)
	}
	tr.Desc = "<row>(@MinUnits@) A@Crit@</row><br><row>(@MinUnits@) B@Crit@</row>"
	if got := resolveTraitText(tr); got != "<row>(2) A25</row><row>(4) B50</row>" {
		t.Errorf("row = %q", got)
	}
}

func TestCDragonGameAsset(t *testing.T) {
	if got := cdragonGameAsset("13.1", "ASSETS/UX/TFT/ChampionSplashes/TFT8_Vayne.TFT_Set8.dds"); got != "cdragon/13.1/game/assets/ux/tft/championsplashes/tft8_vayne.tft_set8.png" {
		t.Errorf("got %q", got)
	}
	if cdragonGameAsset("13.1", "") != "" {
		t.Error("empty path should stay empty")
	}
}

func TestChampionStatsStars(t *testing.T) {
	stats := championStats(map[string]any{"hp": 444.0, "damage": 40.0, "armor": 20.0, "mana": 60.0, "initialMana": 0.0})
	want := map[string][]string{
		"生命值": {"444", "799", "1439"}, // 444 × 1.8 = 799.2、× 3.24 = 1438.56,取整
		"攻击力": {"40", "60", "90"},
		"护甲":  {"20", "20", "20"},
		"法力值": {"0 / 60", "0 / 60", "0 / 60"},
	}
	for _, s := range stats {
		if w, ok := want[s.Label]; ok && (!slices.Equal(s.Stars, w) || s.Value != w[0]) {
			t.Errorf("%s = %q / %v, want %v", s.Label, s.Value, s.Stars, w)
		}
		delete(want, s.Label)
	}
	if len(want) > 0 {
		t.Errorf("missing %v", want)
	}
}

// TestTFTSeasonsLive 核对赛季名单:16.21 有中文名、默认赛季与装备 / 强化名单;13.1 只有弈子与羁绊名单。
func TestTFTSeasonsLive(t *testing.T) {
	s := liveStore(t)
	ctx := context.Background()
	lib := NewTFTLibrary(s)

	seasons, err := lib.Seasons(ctx, "16.21")
	if err != nil {
		t.Fatal(err)
	}
	byNum := map[string]TFTSeason{}
	defaults := 0
	for i, se := range seasons {
		byNum[se.Number] = se
		if se.Default {
			defaults++
		}
		if i > 0 && seasons[i-1].Number == se.Number {
			t.Errorf("duplicate season %s", se.Number)
		}
	}
	s17, ok := byNum["17"]
	if !ok || s17.Name != "星神" || !slices.Contains(s17.Members["装备"], "TFT_Item_InfinityEdge") || len(s17.Members["海克斯强化"]) == 0 {
		t.Errorf("S17 = %s %q, %d items, %d augments", s17.Number, s17.Name, len(s17.Members["装备"]), len(s17.Members["海克斯强化"]))
	}
	if !slices.ContainsFunc(s17.Members["弈子"], func(id string) bool { return strings.HasPrefix(id, "TFT17_") }) {
		t.Errorf("S17 champions = %v", s17.Members["弈子"][:min(5, len(s17.Members["弈子"]))])
	}
	if defaults != 1 || seasons[0].Number != "18" {
		t.Errorf("defaults = %d, first = %s", defaults, seasons[0].Number)
	}
	t.Logf("16.21 seasons: %d, S17 %d champions / %d traits / %d items / %d augments", len(seasons),
		len(s17.Members["弈子"]), len(s17.Members["羁绊"]), len(s17.Members["装备"]), len(s17.Members["海克斯强化"]))

	old, err := lib.Seasons(ctx, "13.1")
	if err != nil {
		t.Fatal(err)
	}
	if i := slices.IndexFunc(old, func(se TFTSeason) bool { return se.Number == "8" }); i < 0 || len(old[i].Members["弈子"]) == 0 || old[i].Members["装备"] != nil || !old[i].Default {
		t.Errorf("13.1 seasons = %+v", old)
	}
}

// TestTFTDetailLive 用真实数据核对:Data Dragon 目录里的云顶条目都能找到资料,说明里的数值基本都代入了。
func TestTFTDetailLive(t *testing.T) {
	s := liveStore(t)
	ctx := context.Background()
	lib := NewTFTLibrary(s)
	cats := NewCatalogs(s)
	for _, c := range []struct{ version, patch string }{{"16.21.1", "16.21"}, {"13.1.1", "13.1"}} {
		cat, err := cats.Get(ctx, c.version)
		if err != nil {
			t.Fatal(err)
		}
		found, total, described, unresolved := map[string]int{}, map[string]int{}, 0, 0
		for _, e := range cat.TFT {
			total[e.Category]++
			d, err := lib.Detail(ctx, c.patch, e.Category, e.ID)
			if err != nil {
				t.Fatalf("%s: %v", c.patch, err)
			}
			if d == nil {
				continue
			}
			found[e.Category]++
			text := d.Description
			if d.Ability != nil {
				text += d.Ability.Description
			}
			if text != "" {
				described++
			}
			for _, m := range tftVar.FindAllString(text, -1) {
				if !strings.Contains(m, ":") {
					unresolved++
				}
			}
		}
		t.Logf("%s: found %v / total %v, described %d, unresolved vars %d", c.patch, found, total, described, unresolved)
		for _, cat := range []string{"装备", "海克斯强化", "弈子", "羁绊", "小小英雄", "棋盘皮肤"} {
			if total[cat] > 0 && found[cat]*100 < total[cat]*95 {
				t.Errorf("%s %s: only %d / %d have details", c.patch, cat, found[cat], total[cat])
			}
		}
	}

	ie, err := lib.Detail(ctx, "16.21", "装备", "TFT_Item_InfinityEdge")
	if err != nil || ie == nil {
		t.Fatalf("infinity edge: %v", err)
	}
	if !slices.Equal(ie.Composition, []string{"TFT_Item_BFSword", "TFT_Item_SparringGloves"}) || len(ie.Stats) == 0 || strings.Contains(ie.Description, "@") {
		t.Errorf("infinity edge = %+v", ie)
	}
	sword, _ := lib.Detail(ctx, "16.21", "装备", "TFT_Item_BFSword")
	if sword == nil || !slices.Contains(sword.Into, "TFT_Item_InfinityEdge") || !slices.Contains(sword.Tags, "基础装备") {
		t.Errorf("bf sword = %+v", sword)
	}
	ahri, _ := lib.Detail(ctx, "16.21", "弈子", "TFT15_Ahri")
	if ahri == nil || ahri.Ability == nil || !strings.Contains(ahri.Ability.Description, "460/690/1275") || len(ahri.Traits) != 2 || ahri.Splash == "" {
		t.Fatalf("ahri = %+v", ahri)
	}
	if hp := ahri.Stats[0]; hp.Label != "生命值" || !slices.Equal(hp.Stars, []string{"650", "1170", "2106"}) {
		t.Errorf("ahri hp = %+v", hp)
	}
	for _, p := range []string{ahri.Splash, ahri.Ability.Icon} {
		if _, err := s.Get(ctx, p); err != nil {
			t.Errorf("%s: %v", p, err)
		}
	}
	trait, _ := lib.Detail(ctx, "16.21", "羁绊", ahri.Traits[0])
	if trait == nil || !slices.Contains(trait.Champions, "TFT15_Ahri") || len(trait.Breakpoints) == 0 {
		t.Errorf("trait = %+v", trait)
	}
	legend, _ := lib.Detail(ctx, "16.21", "小小英雄", "13010")
	if legend == nil || legend.Description == "" || legend.Species == "" || legend.Rarity == "" {
		t.Errorf("little legend = %+v", legend)
	}
	arena, _ := lib.Detail(ctx, "16.21", "棋盘皮肤", "1029")
	if arena == nil || arena.Description == "" {
		t.Errorf("arena = %+v", arena)
	}
	if d, err := lib.Detail(ctx, "16.21", "装备", "NoSuchItem"); d != nil || err != nil {
		t.Errorf("missing item = %v, %v", d, err)
	}
	if _, err := lib.Detail(ctx, "../x", "装备", "a"); err == nil {
		t.Error("invalid patch should fail")
	}
}

func TestTFTUnitsLive(t *testing.T) {
	s := liveStore(t)
	ctx := context.Background()
	lib := NewTFTLibrary(s)
	units, err := lib.Units(ctx, "16.21")
	if err != nil {
		t.Fatal(err)
	}
	cat, err := NewCatalogs(s).Get(ctx, "16.21.1")
	if err != nil {
		t.Fatal(err)
	}
	total, found := 0, 0
	for _, e := range cat.TFT {
		if e.Category == "弈子" {
			total++
			if _, ok := units[e.ID]; ok {
				found++
			}
		}
	}
	if total == 0 || found*100 < total*95 {
		t.Errorf("only %d / %d units have filter data", found, total)
	}
	ahri, ok := units["TFT15_Ahri"]
	detail, _ := lib.Detail(ctx, "16.21", "弈子", "TFT15_Ahri")
	if !ok || ahri.Role != "APCaster" || ahri.Range != 4 || detail == nil || !slices.Equal(ahri.Traits, detail.Traits) {
		t.Errorf("ahri = %+v, detail traits = %v", ahri, detail)
	}
	if _, err := lib.Units(ctx, "../x"); err == nil {
		t.Error("invalid patch should fail")
	}
}
