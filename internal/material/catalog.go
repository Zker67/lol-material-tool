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
}

// Item 是一件装备。
type Item struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Icon      string   `json:"icon"`
	Tags      []string `json:"tags"`
	Plaintext string   `json:"plaintext"`
	Gold      int64    `json:"gold"`
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
	Slot int `json:"slot"`
}

// NamedAsset 是只有名称与图标的素材:旧符文、天赋、召唤师技能。
type NamedAsset struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
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
	c := Champion{ID: id, Key: str(info, "key"), Name: str(info, "name"), Title: str(info, "title"), Tags: strList(field(info, "tags"))}
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
			c.Spells = append(c.Spells, Spell{Slot: slot, Name: str(sp, "name"), Icon: ddPath(version, "img/spell/"+full), Description: str(sp, "description")})
		}
	}
	return c
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
			Plaintext: str(info, "plaintext"), InStore: field(info, "inStore") != false}
		it.Gold, _ = int64Of(field(field(info, "gold"), "total"))
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
				style.Runes = append(style.Runes, RuneEntry{ID: fmt.Sprint(rid), Name: str(r, "name"), Icon: "ddragon/cdn/img/" + str(r, "icon"), Slot: i})
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
		out = append(out, NamedAsset{ID: id, Name: str(info, "name"), Icon: ddPath(version, "img/"+imgGroup+"/"+full)})
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
		e := TFTEntry{ID: id, Name: name, Icon: ddPath(version, "img/"+group+"/"+full), Category: c.targetFolder}
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
