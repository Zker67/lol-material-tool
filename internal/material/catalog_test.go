package material

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestRemoteURL(t *testing.T) {
	ok := map[string]string{
		"ddragon/cdn/16.21.1/img/champion/Ahri.png": "https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/Ahri.png",
		"cdragon/json/": "https://raw.communitydragon.org/json/",
	}
	for rel, want := range ok {
		if got, valid := remoteURL(rel); !valid || got != want {
			t.Errorf("remoteURL(%q) = %q, %v", rel, got, valid)
		}
	}
	for _, rel := range []string{"", "other/x.png", "ddragon", "ddragon/../x", "ddragon//x", `ddragon/a\b`, "ddragon/./x"} {
		if _, valid := remoteURL(rel); valid {
			t.Errorf("remoteURL(%q) should be invalid", rel)
		}
	}
}

func TestTTL(t *testing.T) {
	if ttl("ddragon/cdn/16.21.1/data/zh_CN/item.json") != 0 || ttl("cdragon/14.10/plugins/x.png") != 0 {
		t.Error("versioned paths should never expire")
	}
	if ttl("ddragon/cdn/img/champion/splash/Ahri_0.jpg") == 0 || ttl("cdragon/latest/x.png") == 0 || ttl("ddragon/api/versions.json") != time.Hour {
		t.Error("unversioned paths should expire")
	}
}

func TestPatchForAndAssetMapping(t *testing.T) {
	patches := []string{"7.1", "10.1", "10.10", "16.21"}
	for v, want := range map[string]string{"16.21.1": "16.21", "10.10.3216176": "10.10", "10.1.1": "10.1", "6.24.1": "", "0.151.2": "", "x": ""} {
		if got := PatchFor(v, patches); got != want {
			t.Errorf("PatchFor(%q) = %q, want %q", v, got, want)
		}
	}
	if got := cdragonAsset("14.10", "/lol-game-data/assets/ASSETS/Characters/Ahri/Skins/Skin01/Images/ahri_splash_centered_1.jpg"); got !=
		"cdragon/14.10/plugins/rcp-be-lol-game-data/global/default/assets/characters/ahri/skins/skin01/images/ahri_splash_centered_1.jpg" {
		t.Errorf("got %q", got)
	}
	if cdragonAsset("14.10", "") != "" || cdragonAsset("14.10", "/other/x.png") != "" {
		t.Error("unmapped paths should be empty")
	}
	got := []string{"16.2", "7.1", "10.10", "10.9"}
	slices.SortFunc(got, comparePatch)
	if !slices.Equal(got, []string{"7.1", "10.9", "10.10", "16.2"}) {
		t.Errorf("sorted = %v", got)
	}
}

func TestSafeOutputName(t *testing.T) {
	if got, ok := safeOutputName("九尾妖狐 阿狸/插画/高丽:风情?.jpg"); !ok || got != filepath.Join("九尾妖狐 阿狸", "插画", "高丽风情.jpg") {
		t.Errorf("got %q", got)
	}
	if got, ok := safeOutputName("../../evil/../x.png"); !ok || got != filepath.Join("evil", "x.png") {
		t.Errorf("got %q", got)
	}
	if _, ok := safeOutputName("/../"); ok {
		t.Error("empty name should fail")
	}
}

// 以下测试访问真实的 Data Dragon 与 CommunityDragon。

func liveStore(t *testing.T) *Store {
	t.Helper()
	if testing.Short() {
		t.Skip("访问网络,-short 时跳过")
	}
	return NewStore(t.TempDir())
}

func TestStoreCachesAndServesLive(t *testing.T) {
	s := liveStore(t)
	ctx := context.Background()
	rel := "ddragon/cdn/16.21.1/img/champion/Ahri.png"
	local, err := s.Get(ctx, rel)
	if err != nil {
		t.Fatal(err)
	}
	info1, _ := os.Stat(local)
	time.Sleep(20 * time.Millisecond)
	if _, err := s.Get(ctx, rel); err != nil {
		t.Fatal(err)
	}
	if info2, _ := os.Stat(local); !info2.ModTime().Equal(info1.ModTime()) {
		t.Error("versioned file should come from cache")
	}
	if _, err := s.Get(ctx, "ddragon/cdn/16.21.1/img/champion/NoSuchChampion.png"); !errors.Is(err, ErrAssetNotFound) {
		t.Errorf("missing err = %v", err)
	}
	if size, err := s.CacheSize(); err != nil || size < 1000 {
		t.Errorf("cache size = %d, %v", size, err)
	}

	srv := httptest.NewServer(s)
	defer srv.Close()
	for path, want := range map[string]int{"/" + rel: 200, "/ddragon/cdn/16.21.1/img/champion/NoSuch.png": 404, "/ddragon/../x": 400, "/elsewhere/x": 400} {
		resp, err := http.Get(srv.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != want {
			t.Errorf("%s = %d, want %d", path, resp.StatusCode, want)
		}
		if want == 200 && resp.Header.Get("Content-Type") != "image/png" {
			t.Errorf("content type = %q", resp.Header.Get("Content-Type"))
		}
	}

	if err := s.ClearCache(); err != nil || exists(s.Dir()) {
		t.Errorf("clear cache: %v", err)
	}
}

func findChampion(t *testing.T, cat *Catalog, id string) Champion {
	t.Helper()
	for _, c := range cat.Champions {
		if c.ID == id {
			return c
		}
	}
	t.Fatalf("champion %s not found in %s", id, cat.Version)
	return Champion{}
}

func TestCatalogLatestLive(t *testing.T) {
	s := liveStore(t)
	cats := NewCatalogs(s)
	cat, err := cats.Get(context.Background(), "16.21.1")
	if err != nil {
		t.Fatal(err)
	}
	if cat.Language != "zh_CN" || len(cat.Champions) < 150 || len(cat.Items) < 100 || len(cat.RuneStyles) != 5 || len(cat.Summoners) < 5 {
		t.Fatalf("catalog = %s %d champs %d items %d styles %d summoners", cat.Language, len(cat.Champions), len(cat.Items), len(cat.RuneStyles), len(cat.Summoners))
	}
	if len(cat.LegacyRunes) != 0 || len(cat.Masteries) != 0 {
		t.Error("16.x has no legacy runes or masteries")
	}
	ahri := findChampion(t, cat, "Ahri")
	if ahri.Name != "九尾妖狐" || ahri.Key != "103" || !strings.HasSuffix(ahri.Icon, "img/champion/Ahri.png") {
		t.Errorf("ahri = %+v", ahri)
	}
	slots := ""
	for _, sp := range ahri.Spells {
		slots += sp.Slot
	}
	if slots != "PQWER" {
		t.Errorf("spell slots = %q", slots)
	}
	// 文本:背景、技巧、评分、属性、技能数值
	if ahri.Blurb == "" || len(ahri.Lore) <= len(ahri.Blurb)/2 || len(ahri.AllyTips) == 0 || len(ahri.EnemyTips) == 0 ||
		ahri.Partype != "法力" || ahri.Info.Magic == 0 || ahri.Stats["hp"] == 0 || ahri.Stats["attackrange"] == 0 {
		t.Errorf("ahri text = blurb %d lore %d tips %d/%d %q %+v hp %v", len(ahri.Blurb), len(ahri.Lore), len(ahri.AllyTips), len(ahri.EnemyTips), ahri.Partype, ahri.Info, ahri.Stats["hp"])
	}
	if q := ahri.Spells[1]; q.Description == "" || q.Cooldown == "" || !strings.HasSuffix(q.Cost, "法力") || q.Range == "" {
		t.Errorf("ahri Q = %+v", q)
	}
	if p := ahri.Spells[0]; p.Description == "" || p.Cooldown != "" || p.Cost != "" {
		t.Errorf("ahri passive = %+v", p)
	}
	var ie *Item
	for i := range cat.Items {
		if cat.Items[i].ID == "3031" {
			ie = &cat.Items[i]
		}
	}
	if ie == nil || !strings.Contains(ie.Description, "<stats>") || len(ie.From) == 0 || ie.GoldBase == 0 || ie.GoldSell == 0 {
		t.Errorf("item 3031 = %+v", ie)
	}
	if r := cat.RuneStyles[0].Runes[0]; r.ShortDesc == "" || r.LongDesc == "" {
		t.Errorf("rune = %+v", r)
	}
	for _, sm := range cat.Summoners {
		if sm.ID == "SummonerFlash" && (sm.Description == "" || sm.Cooldown == "" || sm.Level == 0) {
			t.Errorf("flash = %+v", sm)
		}
	}
	augDesc, champCost := 0, 0
	for _, e := range cat.TFT {
		if e.Category == "海克斯强化" && e.Description != "" {
			augDesc++
		}
		if e.Category == "弈子" && e.Cost > 0 {
			champCost++
		}
	}
	if augDesc == 0 || champCost == 0 {
		t.Errorf("tft augments with description %d, champions with cost %d", augDesc, champCost)
	}
	var base, chroma *Skin
	for i := range ahri.Skins {
		if ahri.Skins[i].Parent == nil && base == nil {
			base = &ahri.Skins[i]
		}
		if ahri.Skins[i].Parent != nil && chroma == nil {
			chroma = &ahri.Skins[i]
		}
	}
	if base == nil || base.Name != "九尾妖狐 阿狸" || base.Splash != "ddragon/cdn/img/champion/splash/Ahri_0.jpg" {
		t.Errorf("base skin = %+v", base)
	}
	if chroma == nil || chroma.Splash != "" {
		t.Errorf("chroma = %+v", chroma)
	}
	cats2 := map[string]int{}
	for _, e := range cat.TFT {
		cats2[e.Category]++
	}
	for _, c := range []string{"弈子", "羁绊", "装备", "海克斯强化", "小小英雄"} {
		if cats2[c] == 0 {
			t.Errorf("tft category %s is empty: %v", c, cats2)
		}
	}
	// 目录数据里的路径都应能取到
	for _, rel := range []string{ahri.Icon, ahri.Spells[0].Icon, base.Splash, cat.Items[0].Icon, cat.RuneStyles[0].Runes[0].Icon, cat.TFT[0].Icon} {
		if _, err := s.Get(context.Background(), rel); err != nil {
			t.Errorf("get %s: %v", rel, err)
		}
	}
	if again, _ := cats.Get(context.Background(), "16.21.1"); again != cat {
		t.Error("catalog should be memoized")
	}
	if _, err := cats.Get(context.Background(), "lolpatch_3.7"); err == nil {
		t.Error("invalid version should fail")
	}
}

func TestCatalogOldVersionsLive(t *testing.T) {
	s := liveStore(t)
	cats := NewCatalogs(s)
	// 3.6.14:没有 championFull.json,旧符文与天赋
	old, err := cats.Get(context.Background(), "3.6.14")
	if err != nil {
		t.Fatal(err)
	}
	ahri := findChampion(t, old, "Ahri")
	if len(ahri.Skins) == 0 || len(ahri.Spells) < 5 || ahri.Name == "" {
		t.Errorf("3.6.14 ahri = %d skins %d spells %q", len(ahri.Skins), len(ahri.Spells), ahri.Name)
	}
	if len(old.LegacyRunes) == 0 || len(old.Masteries) == 0 || len(old.RuneStyles) != 0 || len(old.TFT) != 0 {
		t.Errorf("3.6.14 runes=%d masteries=%d styles=%d tft=%d", len(old.LegacyRunes), len(old.Masteries), len(old.RuneStyles), len(old.TFT))
	}
	if ahri.Lore == "" || old.LegacyRunes[0].Description == "" || old.Masteries[0].Description == "" {
		t.Errorf("3.6.14 text: lore %d rune %q mastery %q", len(ahri.Lore), old.LegacyRunes[0].Description, old.Masteries[0].Description)
	}
	if _, err := s.Get(context.Background(), old.LegacyRunes[0].Icon); err != nil {
		t.Errorf("legacy rune icon: %v", err)
	}
	if _, err := s.Get(context.Background(), ahri.Spells[1].Icon); err != nil {
		t.Errorf("old spell icon: %v", err)
	}
}

func TestSpellTextHelpers(t *testing.T) {
	mk := func(costBurn, resource string) any {
		return jsonObject{"costBurn": costBurn, "resource": resource}
	}
	for _, c := range []struct {
		sp   any
		want string
	}{
		{mk("55/65/75/85/95", "{{ cost }} {{ abilityresourcename }}"), "55/65/75/85/95 法力"},
		{mk("70", "{{ cost }}法力"), "70法力"},
		{mk("0", "无消耗"), "无消耗"},
		{mk("0", "{{ cost }} {{ abilityresourcename }}"), ""},
		{mk("10", "每秒{{ e2 }}生命值"), "10"},
		{mk("", ""), ""},
	} {
		if got := spellCost(c.sp, "法力"); got != c.want {
			t.Errorf("spellCost(%v) = %q, want %q", c.sp, got, c.want)
		}
	}
	if zeroless("0") != "" || zeroless("0/0/0") != "" || zeroless("12/10/8") != "12/10/8" {
		t.Error("zeroless")
	}
	if got := descriptionOf(jsonObject{"description": []any{"a", "b"}}); got != "【1/2】a<br>【2/2】b" {
		t.Errorf("mastery description = %q", got)
	}
	if got := descriptionOf(jsonObject{"description": []any{"only"}}); got != "only" {
		t.Errorf("single rank = %q", got)
	}
}

func TestCDragonArtLive(t *testing.T) {
	s := liveStore(t)
	ctx := context.Background()
	patches, err := CDragonPatches(ctx, s)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(patches, "7.1") || !slices.Contains(patches, "10.1") || patches[0] != "7.1" {
		t.Fatalf("patches = %v…", patches[:min(5, len(patches))])
	}
	for _, c := range []struct {
		patch, wantSplash string
		chromas           bool
	}{
		{"7.1", "cdragon/7.1/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/103/103001.jpg", false},
		{"10.1", "cdragon/10.1/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/103/103001.jpg", true},
		{"14.10", "cdragon/14.10/plugins/rcp-be-lol-game-data/global/default/assets/characters/ahri/skins/skin01/images/ahri_splash_centered_1.jpg", true},
	} {
		art, err := ChampionArtFor(ctx, s, c.patch, "103")
		if err != nil {
			t.Fatalf("%s: %v", c.patch, err)
		}
		var skin1 *SkinArt
		chromas := 0
		for i := range art.Skins {
			if art.Skins[i].ID == "103001" {
				skin1 = &art.Skins[i]
			}
			chromas += len(art.Skins[i].Chromas)
		}
		if skin1 == nil || skin1.Splash != c.wantSplash {
			t.Errorf("%s skin1 = %+v", c.patch, skin1)
			continue
		}
		if _, err := s.Get(ctx, skin1.Splash); err != nil {
			t.Errorf("%s splash: %v", c.patch, err)
		}
		if c.chromas && chromas == 0 {
			t.Errorf("%s should have chromas", c.patch)
		}
		if c.patch == "14.10" {
			described, lined := 0, 0
			for _, sk := range art.Skins {
				if sk.Description != "" {
					described++
				}
				if len(sk.SkinLines) > 0 {
					lined++
				}
			}
			if described == 0 || lined == 0 || skin1.Rarity == "" {
				t.Errorf("14.10 skin text: %d described, %d with lines, rarity %q", described, lined, skin1.Rarity)
			}
		}
	}
	if _, err := ChampionArtFor(ctx, s, "../x", "103"); err == nil {
		t.Error("invalid patch should fail")
	}
}

func TestExportLive(t *testing.T) {
	s := liveStore(t)
	dest := filepath.Join(t.TempDir(), "导出")
	var last Progress
	res, err := Export(context.Background(), s, dest, []ExportItem{
		{Path: "ddragon/cdn/16.21.1/img/champion/Ahri.png", Name: "九尾妖狐 阿狸/头像.png"},
		{Path: "ddragon/cdn/16.21.1/img/item/1001.png", Name: "装备/鞋子?.png"},
		{Path: "ddragon/cdn/16.21.1/img/item/0000.png", Name: "装备/不存在.png"},
	}, func(p Progress) { last = p })
	if err != nil {
		t.Fatal(err)
	}
	if res.Written != 2 || res.Missing != 1 || !last.Done || !strings.Contains(last.Message, "1 个官方已不提供") {
		t.Errorf("res = %+v last = %+v", res, last)
	}
	for _, f := range []string{"九尾妖狐 阿狸/头像.png", "装备/鞋子.png"} {
		if !isFile(filepath.Join(dest, filepath.FromSlash(f))) {
			t.Errorf("missing %s", f)
		}
	}
	if _, err := Export(context.Background(), s, dest, nil, nil); err == nil {
		t.Error("empty export should fail")
	}
}
