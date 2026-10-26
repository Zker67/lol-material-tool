package material

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
)

// 素材目录:把 Data Dragon 某个版本的 JSON 整理成统一结构,供浏览器展示。
// 各年代的差异在这里吸收:3.12 前没有 championFull.json、7.23 前是旧符文与天赋、
// 16.11 起 skins 里混入炫彩(带 parentSkin)、云顶数据 13.1 起才有。
// 素材路径都是缓存相对路径(见 Store),页面经 `lmt://` 协议加载。

// Catalog 是某个版本的全部素材目录。
type Catalog struct {
	// Version 是 Data Dragon 版本号,如 16.21.1。
	Version string `json:"version"`
	// Language 是名称所用的语言,zh_CN 缺失时回退 en_US。
	Language    string       `json:"language"`
	Champions   []Champion   `json:"champions"`
	Items       []Item       `json:"items"`
	RuneStyles  []RuneStyle  `json:"runeStyles"`
	LegacyRunes []NamedAsset `json:"legacyRunes"`
	Masteries   []NamedAsset `json:"masteries"`
	Summoners   []NamedAsset `json:"summoners"`
	TFT         []TFTEntry   `json:"tft"`
}

// Champion 是一位英雄。
type Champion struct {
	// ID 是英文 ID,如 MonkeyKing。
	ID string `json:"id"`
	// Key 是数字 ID,如 62,CommunityDragon 用它定位。
	Key   string   `json:"key"`
	Name  string   `json:"name"`
	Title string   `json:"title"`
	Tags  []string `json:"tags"`
	Icon  string   `json:"icon"`
	Skins []Skin   `json:"skins"`
	// Spells 依次为被动、Q、W、E、R(数量随版本数据)。
	Spells []Spell `json:"spells"`
	// Blurb 是背景故事摘要,Lore 是全文;文本可能含 <br> 等标记。
	Blurb     string   `json:"blurb"`
	Lore      string   `json:"lore"`
	AllyTips  []string `json:"allyTips"`
	EnemyTips []string `json:"enemyTips"`
	// Partype 是资源类型,如 法力、能量。
	Partype string       `json:"partype"`
	Info    ChampionInfo `json:"info"`
	// Stats 是基础属性,键同 Data Dragon(hp、hpperlevel、armor…)。
	Stats map[string]float64 `json:"stats"`
}

// ChampionInfo 是官方给英雄的四项评分(0–10)。
type ChampionInfo struct {
	Attack     int64 `json:"attack"`
	Defense    int64 `json:"defense"`
	Magic      int64 `json:"magic"`
	Difficulty int64 `json:"difficulty"`
}

// Skin 是一款皮肤或炫彩。
type Skin struct {
	// ID 是全局皮肤 ID(英雄 key × 1000 + 序号)。
	ID   string `json:"id"`
	Num  int64  `json:"num"`
	Name string `json:"name"`
	// Parent 是炫彩所属皮肤的序号,普通皮肤为 null。
	Parent *int64 `json:"parent"`
	// HasChromas 表示该皮肤有炫彩。
	HasChromas bool `json:"hasChromas"`
	// 官方原画(不分版本,始终是最新版);炫彩没有。
	Splash   string `json:"splash"`
	Loading  string `json:"loading"`
	Tile     string `json:"tile"`
	Centered string `json:"centered"`
}

// Spell 是一个技能。
type Spell struct {
	// Slot 是 P / Q / W / E / R,超过 4 个主动技能时为 S。
	Slot        string `json:"slot"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
	// 各级数值,用 / 分隔;被动技能为空。
	Cooldown string `json:"cooldown"`
	Cost     string `json:"cost"`
	Range    string `json:"range"`
}

// Item 是一件装备。
type Item struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Icon      string   `json:"icon"`
	Tags      []string `json:"tags"`
	Plaintext string   `json:"plaintext"`
	// Description 是属性与效果说明(含 <stats>、<passive> 等标记)。
	Description string `json:"description"`
	// Gold 是总价,GoldBase 是合成费,GoldSell 是出售价。
	Gold     int64 `json:"gold"`
	GoldBase int64 `json:"goldBase"`
	GoldSell int64 `json:"goldSell"`
	// From 是合成材料,Into 是可合成的装备(均为装备 ID)。
	From []string `json:"from"`
	Into []string `json:"into"`
	// InStore 为 false 的装备不在商店出售(模式专属、合成中间态等)。
	InStore bool `json:"inStore"`
}

// RuneStyle 是一系符文(8.1 起)。
type RuneStyle struct {
	ID    string      `json:"id"`
	Name  string      `json:"name"`
	Icon  string      `json:"icon"`
	Runes []RuneEntry `json:"runes"`
}

// RuneEntry 是一枚符文。
type RuneEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
	// Slot 是所在的行,0 为基石。
	Slot      int    `json:"slot"`
	ShortDesc string `json:"shortDesc"`
	LongDesc  string `json:"longDesc"`
}

// NamedAsset 是旧符文、天赋、召唤师技能。
type NamedAsset struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
	// Cooldown 与 Level 只有召唤师技能有:冷却秒数、解锁的召唤师等级。
	Cooldown string `json:"cooldown"`
	Level    int64  `json:"level"`
}

// TFTEntry 是一项云顶素材。
type TFTEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
	// Category 是中文分类名,如 弈子、羁绊。
	Category string `json:"category"`
	// Set 是赛季编号(由 ID 前缀 TFT{n}_ 推出),推不出时为空。
	Set string `json:"set"`
	// Description 是说明(海克斯强化、地区传送门等才有)。
	Description string `json:"description"`
	// Cost 是弈子费用;Tier 是小小英雄等原始 tier 字段。
	Cost int64  `json:"cost"`
	Tier string `json:"tier"`
}

// Catalogs 按版本缓存素材目录。
type Catalogs struct {
	store *Store
	mu    sync.Mutex
	byVer map[string]*Catalog
}

// NewCatalogs 创建以 store 为缓存的目录服务。
func NewCatalogs(store *Store) *Catalogs {
	return &Catalogs{store: store, byVer: map[string]*Catalog{}}
}

// Get 返回某个版本的素材目录。
func (c *Catalogs) Get(ctx context.Context, version string) (*Catalog, error) {
	if !isDataVersion(version) {
		return nil, fmt.Errorf("不支持的版本号:%s", version)
	}
	c.mu.Lock()
	cat, ok := c.byVer[version]
	c.mu.Unlock()
	if ok {
		return cat, nil
	}
	cat, err := buildCatalog(ctx, c.store, version)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.byVer[version] = cat
	c.mu.Unlock()
	return cat, nil
}

// isDataVersion 判断是否为 Data Dragon 的数据版本(x.y.z,各段为数字)。
func isDataVersion(v string) bool { return isVersionString(v) }

func ddPath(version, rest string) string { return "ddragon/cdn/" + version + "/" + rest }

// optionalJSON 读取 JSON,远程不存在时返回 nil 且不报错。
func optionalJSON(ctx context.Context, s *Store, rel string) (any, error) {
	v, err := s.JSON(ctx, rel)
	if errors.Is(err, ErrAssetNotFound) {
		return nil, nil
	}
	return v, err
}

func buildCatalog(ctx context.Context, s *Store, version string) (*Catalog, error) {
	cat := &Catalog{Version: version, Language: "zh_CN"}
	champList, err := optionalJSON(ctx, s, ddPath(version, "data/zh_CN/champion.json"))
	if err != nil {
		return nil, err
	}
	if champList == nil {
		cat.Language = "en_US"
		if champList, err = optionalJSON(ctx, s, ddPath(version, "data/en_US/champion.json")); err != nil {
			return nil, err
		}
		if champList == nil {
			return nil, fmt.Errorf("版本 %s 没有可用的数据", version)
		}
	}
	data := func(file string) (any, error) {
		return optionalJSON(ctx, s, ddPath(version, "data/"+cat.Language+"/"+file))
	}

	champs, err := loadCatalogChampions(ctx, s, version, cat.Language, champList)
	if err != nil {
		return nil, err
	}
	cat.Champions = champs

	if root, err := data("item.json"); err != nil {
		return nil, err
	} else {
		cat.Items = catalogItems(version, root)
	}
	if root, err := data("runesReforged.json"); err != nil {
		return nil, err
	} else {
		cat.RuneStyles = catalogRuneStyles(root)
	}
	for _, f := range []struct {
		file, img string
		dest      *[]NamedAsset
	}{
		{"rune.json", "rune", &cat.LegacyRunes},
		{"mastery.json", "mastery", &cat.Masteries},
		{"summoner.json", "spell", &cat.Summoners},
	} {
		root, err := data(f.file)
		if err != nil {
			return nil, err
		}
		*f.dest = catalogNamed(version, f.img, root)
	}
	for _, c := range tftLocalizationConfig {
		root, err := data(c.jsonFile)
		if err != nil {
			return nil, err
		}
		cat.TFT = append(cat.TFT, catalogTFT(version, c, root)...)
	}
	return cat, nil
}

// loadCatalogChampions 读取英雄详情:有 championFull.json 时一次读完,
// 否则(3.12 前)逐个读取 champion/{id}.json。
func loadCatalogChampions(ctx context.Context, s *Store, version, lang string, champList any) ([]Champion, error) {
	full, err := optionalJSON(ctx, s, ddPath(version, "data/"+lang+"/championFull.json"))
	if err != nil {
		return nil, err
	}
	data, _ := field(full, "data").(jsonObject)
	if data == nil {
		list, _ := field(champList, "data").(jsonObject)
		data = jsonObject{}
		var mu sync.Mutex
		var wg sync.WaitGroup
		var firstErr error
		sem := make(chan struct{}, 8)
		for id, brief := range list {
			wg.Add(1)
			go func() {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()
				detail, err := optionalJSON(ctx, s, ddPath(version, "data/"+lang+"/champion/"+id+".json"))
				mu.Lock()
				defer mu.Unlock()
				if err != nil && firstErr == nil {
					firstErr = err
				}
				if d, ok := field(field(detail, "data"), id).(jsonObject); ok {
					data[id] = d
				} else {
					data[id] = brief // 没有详情时至少保留名称与头像
				}
			}()
		}
		wg.Wait()
		if firstErr != nil {
			return nil, firstErr
		}
	}

	champs := make([]Champion, 0, len(data))
	for _, info := range sortedValues(data) {
		champs = append(champs, catalogChampion(version, info))
	}
	return champs, nil
}

func strList(v any) []string {
	arr, _ := v.([]any)
	out := make([]string, 0, len(arr))
	for _, x := range arr {
		if s, ok := x.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func catalogChampion(version string, info any) Champion {
	id := str(info, "id")
	c := Champion{ID: id, Key: str(info, "key"), Name: str(info, "name"), Title: str(info, "title"), Tags: strList(field(info, "tags")),
		Blurb: str(info, "blurb"), Lore: str(info, "lore"), AllyTips: strList(field(info, "allytips")), EnemyTips: strList(field(info, "enemytips")),
		Partype: str(info, "partype"), Stats: map[string]float64{}}
	if c.Lore == "" {
		c.Lore = c.Blurb
	}
	ci := field(info, "info")
	c.Info.Attack, _ = int64Of(field(ci, "attack"))
	c.Info.Defense, _ = int64Of(field(ci, "defense"))
	c.Info.Magic, _ = int64Of(field(ci, "magic"))
	c.Info.Difficulty, _ = int64Of(field(ci, "difficulty"))
	if stats, ok := field(info, "stats").(jsonObject); ok {
		for k, v := range stats {
			if f, ok := floatOf(v); ok {
				c.Stats[k] = f
			}
		}
	}
	if full, ok := imageFull(info); ok {
		c.Icon = ddPath(version, "img/champion/"+full)
	}
	skins, _ := field(info, "skins").([]any)
	for _, s := range skins {
		num, ok := skinNumOf(s)
		if !ok {
			continue
		}
		skin := Skin{ID: idString(field(s, "id")), Num: num, Name: str(s, "name"), HasChromas: field(s, "chromas") == true}
		if strings.EqualFold(skin.Name, "default") {
			skin.Name = strings.TrimSpace(c.Name + " " + c.Title)
		}
		if parent, ok := int64Of(field(s, "parentSkin")); ok {
			skin.Parent = &parent
		} else {
			base := fmt.Sprintf("%s_%d.jpg", id, num)
			skin.Splash = "ddragon/cdn/img/champion/splash/" + base
			skin.Loading = "ddragon/cdn/img/champion/loading/" + base
			skin.Tile = "ddragon/cdn/img/champion/tiles/" + base
			skin.Centered = "ddragon/cdn/img/champion/centered/" + base
		}
		c.Skins = append(c.Skins, skin)
	}
	if p := field(info, "passive"); p != nil {
		if full, ok := imageFull(p); ok {
			c.Spells = append(c.Spells, Spell{Slot: "P", Name: str(p, "name"), Icon: ddPath(version, "img/passive/"+full), Description: str(p, "description")})
		}
	}
	spells, _ := field(info, "spells").([]any)
	for i, sp := range spells {
		slot := "S"
		if i < 4 {
			slot = []string{"Q", "W", "E", "R"}[i]
		}
		if full, ok := imageFull(sp); ok {
			c.Spells = append(c.Spells, Spell{Slot: slot, Name: str(sp, "name"), Icon: ddPath(version, "img/spell/"+full), Description: str(sp, "description"),
				Cooldown: zeroless(str(sp, "cooldownBurn")), Cost: spellCost(sp, c.Partype), Range: zeroless(str(sp, "rangeBurn"))})
		}
	}
	return c
}

// zeroless 把全为 0 的数值(如无冷却、无消耗)当作没有。
func zeroless(s string) string {
	if strings.Trim(s, "0/. ") == "" {
		return ""
	}
	return s
}

var placeholder = regexp.MustCompile(`\{\{\s*([\w]+)\s*\}\}`)

// spellCost 由 resource 模板(如「{{ cost }} {{ abilityresourcename }}」)拼出消耗;
// 模板里有填不出的变量时只给数值。
func spellCost(sp any, partype string) string {
	cost := zeroless(str(sp, "costBurn"))
	tpl := str(sp, "resource")
	if tpl == "" {
		return cost
	}
	unknown := false
	out := placeholder.ReplaceAllStringFunc(tpl, func(m string) string {
		switch strings.ToLower(placeholder.FindStringSubmatch(m)[1]) {
		case "cost":
			return cost
		case "abilityresourcename":
			return partype
		}
		unknown = true
		return ""
	})
	if out = strings.TrimSpace(out); unknown || out == partype || cost == "" && strings.Contains(tpl, "cost") {
		return cost
	}
	return out
}

// floatOf 把 JSON 数字转为 float64。
func floatOf(v any) (float64, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := n.Float64()
	return f, err == nil
}

// descriptionOf 取 description:字符串原样返回;天赋是按等级的字符串数组,逐级列出。
func descriptionOf(info any) string {
	switch d := field(info, "description").(type) {
	case string:
		return d
	case []any:
		ranks := strList(d)
		if len(ranks) == 1 {
			return ranks[0]
		}
		for i, r := range ranks {
			ranks[i] = fmt.Sprintf("【%d/%d】%s", i+1, len(ranks), r)
		}
		return strings.Join(ranks, "<br>")
	}
	return ""
}

func catalogItems(version string, root any) []Item {
	data, _ := field(root, "data").(jsonObject)
	items := make([]Item, 0, len(data))
	for _, id := range sortedKeys(data) {
		info := data[id]
		full, ok := imageFull(info)
		if !ok || str(info, "name") == "" {
			continue
		}
		it := Item{ID: id, Name: str(info, "name"), Icon: ddPath(version, "img/item/"+full), Tags: strList(field(info, "tags")),
			Plaintext: str(info, "plaintext"), Description: str(info, "description"), From: strList(field(info, "from")), Into: strList(field(info, "into")),
			InStore: field(info, "inStore") != false}
		gold := field(info, "gold")
		it.Gold, _ = int64Of(field(gold, "total"))
		it.GoldBase, _ = int64Of(field(gold, "base"))
		it.GoldSell, _ = int64Of(field(gold, "sell"))
		items = append(items, it)
	}
	return items
}

func catalogRuneStyles(root any) []RuneStyle {
	arr, _ := root.([]any)
	styles := make([]RuneStyle, 0, len(arr))
	for _, st := range arr {
		id, _ := int64Of(field(st, "id"))
		style := RuneStyle{ID: fmt.Sprint(id), Name: str(st, "name"), Icon: "ddragon/cdn/img/" + str(st, "icon")}
		slots, _ := field(st, "slots").([]any)
		for i, slot := range slots {
			runes, _ := field(slot, "runes").([]any)
			for _, r := range runes {
				rid, _ := int64Of(field(r, "id"))
				style.Runes = append(style.Runes, RuneEntry{ID: fmt.Sprint(rid), Name: str(r, "name"), Icon: "ddragon/cdn/img/" + str(r, "icon"), Slot: i,
					ShortDesc: str(r, "shortDesc"), LongDesc: str(r, "longDesc")})
			}
		}
		styles = append(styles, style)
	}
	return styles
}

func catalogNamed(version, imgGroup string, root any) []NamedAsset {
	data, _ := field(root, "data").(jsonObject)
	out := make([]NamedAsset, 0, len(data))
	for _, id := range sortedKeys(data) {
		info := data[id]
		full, ok := imageFull(info)
		if !ok || str(info, "name") == "" {
			continue
		}
		a := NamedAsset{ID: id, Name: str(info, "name"), Icon: ddPath(version, "img/"+imgGroup+"/"+full), Description: descriptionOf(info),
			Cooldown: zeroless(str(info, "cooldownBurn"))}
		a.Level, _ = int64Of(field(info, "summonerLevel"))
		out = append(out, a)
	}
	return out
}

var tftSetPrefix = regexp.MustCompile(`^TFT(\d+)_`)

func catalogTFT(version string, c tftCategory, root any) []TFTEntry {
	var out []TFTEntry
	for _, item := range collectTFTItems(root) {
		name := str(item, "name")
		full, ok := imageFull(item)
		if name == "" || !ok || full == "" {
			continue
		}
		group := str(field(item, "image"), "group")
		if group == "" {
			group = c.imgGroup
		}
		id := str(item, "id")
		e := TFTEntry{ID: id, Name: name, Icon: ddPath(version, "img/"+group+"/"+full), Category: c.targetFolder,
			Description: firstNonEmpty(str(item, "description"), str(item, "shortDescription"), str(item, "desc")), Tier: idString(field(item, "tier"))}
		if n, ok := int64Of(field(item, "cost")); ok && n > 0 {
			e.Cost = n
		} else if n, ok := int64Of(field(item, "tier")); ok && c.targetFolder == "弈子" {
			e.Cost = n // 早期数据用 tier 表示费用
		}
		if m := tftSetPrefix.FindStringSubmatch(id); m != nil {
			e.Set = m[1]
		}
		out = append(out, e)
	}
	return out
}

func sortedKeys(o jsonObject) []string {
	keys := make([]string, 0, len(o))
	for k := range o {
		keys = append(keys, k)
	}
	slices.Sort(keys)
	return keys
}

// idString 取字符串或数字形式的 ID。
func idString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case json.Number:
		return x.String()
	}
	return ""
}

func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}
