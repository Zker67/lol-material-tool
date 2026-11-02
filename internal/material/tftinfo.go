package material

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"maps"
	"math"
	"os"
	"path"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
)

// 云顶资料(CommunityDragon,非官方):Data Dragon 的云顶数据只有名称与图标(海克斯强化、地区传送门带说明),
// 说明、数值、合成、技能、羁绊档位与外观描述来自 CommunityDragon 同补丁的数据,按 ID 对应:
//   - cdragon/tft/zh_cn.json:装备与海克斯强化(apiName)、各赛季的弈子与羁绊(apiName);
//   - v1/companions.json:小小英雄(itemId);v1/tftmapskins.json:棋盘皮肤(itemId)。
// 说明里的 @变量@ 按该条目自己的数值代入(弈子技能按 1/2/3 星列出),
// 变量名可能是 FNV-1a 哈希({xxxxxxxx});运行时才有的值(含 : 的变量、算出来的总伤害)保留原样,页面显示为「?」。

// TFTStat 是一项属性,如 生命值 650。
type TFTStat struct {
	Label string `json:"label"`
	// Value 是装备的属性加成,或弈子 1 星的数值。
	Value string `json:"value"`
	// Stars 只有弈子有:1、2、3 星的数值。
	Stars []string `json:"stars"`
}

// TFTAbility 是弈子的技能。
type TFTAbility struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
	// Description 已代入数值,星级不同的数值用 / 分隔。
	Description string `json:"description"`
}

// TFTBreakpoint 是羁绊的一档。
type TFTBreakpoint struct {
	MinUnits int64 `json:"minUnits"`
	// Style 是档位颜色:1 青铜、3 白银、4 彩色、5 黄金、6 棱彩。
	Style int64 `json:"style"`
}

// TFTDetail 是一项云顶素材的详细资料,各分类只填用得到的字段;ID 均与 TFTEntry.ID 对应。
type TFTDetail struct {
	// Patch 是资料所属的 CommunityDragon 补丁。
	Patch string `json:"patch"`
	// Description 是已代入数值的说明(Riot 富文本);小小英雄、棋盘皮肤为背景描述。
	Description string `json:"description"`
	// Stats 是装备提供的属性,或弈子 1–3 星的基础属性。
	Stats []TFTStat `json:"stats"`
	// Tags 是中文标签,如 基础装备、唯一。
	Tags []string `json:"tags"`
	// Composition 是合成材料,Into 是可合成的装备。
	Composition []string `json:"composition"`
	Into        []string `json:"into"`
	// Traits 是弈子的羁绊,或纹章、海克斯强化关联的羁绊。
	Traits []string `json:"traits"`
	// Ability、Splash 只有弈子有。
	Ability *TFTAbility `json:"ability"`
	Splash  string      `json:"splash"`
	// Breakpoints 与 Champions 只有羁绊有(Champions 按费用排序)。
	Breakpoints []TFTBreakpoint `json:"breakpoints"`
	Champions   []string        `json:"champions"`
	// Rarity 是稀有度;Species 是小小英雄种类,Series 是棋盘皮肤系列。
	Rarity  string `json:"rarity"`
	Species string `json:"species"`
	Series  string `json:"series"`
}

// TFTLibrary 按补丁缓存云顶资料。
type TFTLibrary struct {
	store   *Store
	mu      sync.Mutex
	byPatch map[string]*tftSlot
}

type tftSlot struct {
	mu   sync.Mutex
	data *tftData
}

// tftDetails 是一个补丁的全部云顶资料,按 TFTEntry.Category 分组。
type tftDetails map[string]map[string]*TFTDetail

// tftData 是一个补丁解析出的资料与赛季。
type tftData struct {
	details tftDetails
	seasons []TFTSeason
	units   map[string]TFTUnit
}

// TFTUnit 是弈子用于筛选的信息,键与 TFTEntry.ID 对应。
type TFTUnit struct {
	// Traits 是羁绊 ID。
	Traits []string `json:"traits"`
	// Role 是原始定位,如 ADTank、APCaster(前缀 AD / AP 为伤害类型);没有时为空。
	Role string `json:"role"`
	// Range 是攻击距离(格);没有时为 0。
	Range float64 `json:"range"`
}

// TFTSeason 是一个赛季,以及该赛季实际用到的条目(CommunityDragon setData 中的主模式 TFTSet{n})。
type TFTSeason struct {
	// Number 是赛季编号,与 TFTEntry.Set 一致,如 17。
	Number string `json:"number"`
	// Name 是中文赛季名,如 星神;客户端数据里没有时为空。
	Name string `json:"name"`
	// Default 表示这是该版本游戏的默认赛季。
	Default bool `json:"default"`
	// Members 是本赛季的条目 ID,键为分类(弈子、羁绊、装备、海克斯强化);
	// 早期补丁(如 13.1)没有装备与海克斯强化名单,对应的键缺失。
	Members map[string][]string `json:"members"`
}

// NewTFTLibrary 创建以 store 为缓存的云顶资料服务。
func NewTFTLibrary(store *Store) *TFTLibrary {
	return &TFTLibrary{store: store, byPatch: map[string]*tftSlot{}}
}

// load 返回某个补丁解析好的数据;同一补丁只解析一次,失败不缓存,下次重试。
func (l *TFTLibrary) load(ctx context.Context, patch string) (*tftData, error) {
	if !patchName.MatchString(patch) {
		return nil, fmt.Errorf("不支持的补丁:%s", patch)
	}
	l.mu.Lock()
	slot := l.byPatch[patch]
	if slot == nil {
		slot = &tftSlot{}
		l.byPatch[patch] = slot
	}
	l.mu.Unlock()

	slot.mu.Lock()
	defer slot.mu.Unlock()
	if slot.data == nil {
		data, err := loadTFTData(ctx, l.store, patch)
		if err != nil {
			return nil, err
		}
		slot.data = data
	}
	return slot.data, nil
}

// Detail 返回某个补丁下一项云顶素材的资料,没有时返回 nil。
func (l *TFTLibrary) Detail(ctx context.Context, patch, category, id string) (*TFTDetail, error) {
	data, err := l.load(ctx, patch)
	if err != nil {
		return nil, err
	}
	return data.details[category][id], nil
}

// Units 返回某个补丁下全部弈子的羁绊、定位与攻击距离,供按条件筛选。
func (l *TFTLibrary) Units(ctx context.Context, patch string) (map[string]TFTUnit, error) {
	data, err := l.load(ctx, patch)
	if err != nil {
		return nil, err
	}
	return data.units, nil
}

// Seasons 返回某个补丁下的赛季(从新到旧)。
func (l *TFTLibrary) Seasons(ctx context.Context, patch string) ([]TFTSeason, error) {
	data, err := l.load(ctx, patch)
	if err != nil {
		return nil, err
	}
	return data.seasons, nil
}

// readTyped 读取缓存中的 JSON 到 v;依次尝试 rels,远程都不存在时返回 ErrAssetNotFound。
func readTyped(ctx context.Context, s *Store, v any, rels ...string) error {
	err := ErrAssetNotFound
	for _, rel := range rels {
		var local string
		if local, err = s.Get(ctx, rel); errors.Is(err, ErrAssetNotFound) {
			continue
		} else if err != nil {
			return err
		}
		data, err := os.ReadFile(local)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(data, v); err != nil {
			return fmt.Errorf("解析 %s 失败:%w", rel, err)
		}
		return nil
	}
	return err
}

type cdTFTItem struct {
	APIName            string         `json:"apiName"`
	Name               string         `json:"name"`
	Desc               string         `json:"desc"`
	Effects            map[string]any `json:"effects"`
	Composition        []string       `json:"composition"`
	AssociatedTraits   []string       `json:"associatedTraits"`
	IncompatibleTraits []string       `json:"incompatibleTraits"`
	Tags               []string       `json:"tags"`
	Unique             bool           `json:"unique"`
	IsAugment          bool           `json:"isAugment"`
}

type cdTFTVariable struct {
	Name  string `json:"name"`
	Value []any  `json:"value"`
}

type cdTFTChampion struct {
	APIName string `json:"apiName"`
	Name    string `json:"name"`
	Cost    int64  `json:"cost"`
	Icon    string `json:"icon"`
	Ability *struct {
		Name      string          `json:"name"`
		Desc      string          `json:"desc"`
		Icon      string          `json:"icon"`
		Variables []cdTFTVariable `json:"variables"`
	} `json:"ability"`
	Stats  map[string]any `json:"stats"`
	Traits []string       `json:"traits"`
	// Role 是定位,如 ADTank、APCaster;新赛季刚上线时常常缺失。
	Role string `json:"role"`
}

type cdTFTTrait struct {
	APIName string `json:"apiName"`
	Name    string `json:"name"`
	Desc    string `json:"desc"`
	Effects []struct {
		MinUnits  int64          `json:"minUnits"`
		MaxUnits  int64          `json:"maxUnits"`
		Style     int64          `json:"style"`
		Variables map[string]any `json:"variables"`
	} `json:"effects"`
}

type cdTFTSet struct {
	// Number、Mutator、Items、Augments 只有 setData 里有(早期补丁没有 items / augments)
	Number    int             `json:"number"`
	Mutator   string          `json:"mutator"`
	Champions []cdTFTChampion `json:"champions"`
	Traits    []cdTFTTrait    `json:"traits"`
	Items     []string        `json:"items"`
	Augments  []string        `json:"augments"`
}

// cdTFTSetInfo 是 v1/tftsets.json 里的一个赛季;早期补丁没有 SetName。
type cdTFTSetInfo struct {
	SetName        string `json:"SetName"`
	SetCoreName    string `json:"SetCoreName"`
	SetDisplayName string `json:"SetDisplayName"`
}

type cdTFTRoot struct {
	Items []cdTFTItem `json:"items"`
	// Sets 是各赛季的主数据,SetData 另含双人、狂暴等模式的变体,先用前者
	Sets    map[string]cdTFTSet `json:"sets"`
	SetData []cdTFTSet          `json:"setData"`
}

type cdCosmetic struct {
	ItemID      int64  `json:"itemId"`
	Description string `json:"description"`
	Rarity      string `json:"rarity"`
	SpeciesName string `json:"speciesName"`
	GroupName   string `json:"groupName"`
}

func loadTFTData(ctx context.Context, s *Store, patch string) (*tftData, error) {
	base := "cdragon/" + patch + "/"
	var root cdTFTRoot
	if err := readTyped(ctx, s, &root, base+"cdragon/tft/zh_cn.json", base+"cdragon/tft/en_us.json"); err != nil {
		return nil, fmt.Errorf("读取补丁 %s 的云顶资料失败:%w", patch, err)
	}
	data := tftDetails{"装备": {}, "海克斯强化": {}, "弈子": {}, "羁绊": {}, "小小英雄": {}, "棋盘皮肤": {}}

	// 装备与海克斯强化同在 items 里,按 apiName 两边都登记,页面按分类取
	into := map[string][]string{}
	for _, it := range root.Items {
		if !it.IsAugment {
			for _, c := range slices.Compact(slices.Sorted(slices.Values(it.Composition))) {
				into[c] = append(into[c], it.APIName)
			}
		}
	}
	for _, it := range root.Items {
		d := &TFTDetail{Patch: patch, Description: resolveTFTText(it.Desc, numberLookup(it.Effects)),
			Composition: it.Composition, Into: into[it.APIName], Traits: it.AssociatedTraits}
		if !it.IsAugment { // 海克斯强化的 effects 是效果参数,不是属性
			d.Stats = itemStats(it.Effects)
		}
		for _, t := range it.Tags {
			if label := tftItemTags[strings.ToLower(t)]; label != "" {
				d.Tags = append(d.Tags, label)
			}
		}
		if it.Unique {
			d.Tags = append(d.Tags, "唯一")
		}
		data["装备"][it.APIName] = d
		data["海克斯强化"][it.APIName] = d
	}

	sets := make([]cdTFTSet, 0, len(root.Sets)+len(root.SetData))
	for _, k := range slices.Sorted(maps.Keys(root.Sets)) {
		sets = append(sets, root.Sets[k])
	}
	sets = append(sets, root.SetData...)
	units := map[string]TFTUnit{}
	for _, set := range sets {
		addTFTSet(data, units, patch, set)
	}

	// 外观:读不到只是不显示描述
	plugin := base + "plugins/rcp-be-lol-game-data/global/"
	for _, f := range []struct{ file, category string }{{"companions.json", "小小英雄"}, {"tftmapskins.json", "棋盘皮肤"}} {
		var list []cdCosmetic
		if err := readTyped(ctx, s, &list, plugin+"zh_cn/v1/"+f.file, plugin+"default/v1/"+f.file); err != nil {
			if errors.Is(err, ErrAssetNotFound) {
				continue
			}
			return nil, err
		}
		for _, c := range list {
			data[f.category][strconv.FormatInt(c.ItemID, 10)] = &TFTDetail{Patch: patch, Description: strings.TrimSpace(c.Description),
				Rarity: tftRarity[strings.ToLower(c.Rarity)], Species: c.SpeciesName, Series: c.GroupName}
		}
	}

	seasons, err := loadTFTSeasons(ctx, s, plugin, root.SetData)
	if err != nil {
		return nil, err
	}
	return &tftData{details: data, seasons: seasons, units: units}, nil
}

// loadTFTSeasons 从 setData 取各赛季主模式(mutator 为 TFTSet{n})的条目名单,
// 中文名与默认赛季来自 v1/tftsets.json(读不到只是没有名称)。
func loadTFTSeasons(ctx context.Context, s *Store, plugin string, setData []cdTFTSet) ([]TFTSeason, error) {
	var info struct {
		LCTFTModeData struct {
			ActiveSets []cdTFTSetInfo `json:"mActiveSets"`
			DefaultSet cdTFTSetInfo   `json:"mDefaultSet"`
		} `json:"LCTFTModeData"`
	}
	if err := readTyped(ctx, s, &info, plugin+"zh_cn/v1/tftsets.json", plugin+"default/v1/tftsets.json"); err != nil && !errors.Is(err, ErrAssetNotFound) {
		return nil, err
	}
	names := map[string]string{}
	for _, si := range append(info.LCTFTModeData.ActiveSets, info.LCTFTModeData.DefaultSet) {
		// 只认赛季本身的条目;回归赛季、活动模式借用了别的赛季名,早期补丁的名称只是「云顶之弈」
		if (si.SetName == "" || si.SetName == si.SetCoreName) && si.SetDisplayName != "云顶之弈" {
			names[si.SetCoreName] = si.SetDisplayName
		}
	}

	var seasons []TFTSeason
	for _, set := range setData {
		core := fmt.Sprintf("TFTSet%d", set.Number)
		if set.Mutator != core {
			continue
		}
		members := map[string][]string{}
		for _, c := range set.Champions {
			members["弈子"] = append(members["弈子"], c.APIName)
		}
		for _, t := range set.Traits {
			members["羁绊"] = append(members["羁绊"], t.APIName)
		}
		if len(set.Items) > 0 {
			members["装备"] = set.Items
		}
		if len(set.Augments) > 0 {
			members["海克斯强化"] = set.Augments
		}
		seasons = append(seasons, TFTSeason{Number: strconv.Itoa(set.Number), Name: names[core], Default: info.LCTFTModeData.DefaultSet.SetCoreName == core, Members: members})
	}
	slices.SortFunc(seasons, func(a, b TFTSeason) int {
		x, _ := strconv.Atoi(a.Number)
		y, _ := strconv.Atoi(b.Number)
		return y - x
	})
	return seasons, nil
}

// addTFTSet 登记一个赛季(或模式)的弈子与羁绊;已登记过的 apiName 不覆盖。
func addTFTSet(data tftDetails, units map[string]TFTUnit, patch string, set cdTFTSet) {
	traitID := map[string]string{} // 弈子数据里的羁绊是名称,按本赛季的羁绊表换成 ID
	for _, t := range set.Traits {
		traitID[t.Name] = t.APIName
	}
	members := map[string][]cdTFTChampion{}
	for _, c := range set.Champions {
		var traits []string
		for _, name := range c.Traits {
			if id := traitID[name]; id != "" {
				traits = append(traits, id)
				members[id] = append(members[id], c)
			}
		}
		if _, ok := data["弈子"][c.APIName]; ok {
			continue
		}
		d := &TFTDetail{Patch: patch, Stats: championStats(c.Stats), Traits: traits, Splash: cdragonGameAsset(patch, c.Icon)}
		reach, _ := numberOf(c.Stats["range"])
		units[c.APIName] = TFTUnit{Traits: traits, Role: c.Role, Range: reach}
		if a := c.Ability; a != nil {
			vars := map[string][]float64{}
			for _, v := range a.Variables {
				vars[v.Name] = starValues(v.Value)
			}
			d.Ability = &TFTAbility{Name: a.Name, Icon: cdragonGameAsset(patch, a.Icon), Description: resolveTFTText(a.Desc, variableLookup(vars))}
		}
		data["弈子"][c.APIName] = d
	}
	for _, t := range set.Traits {
		if _, ok := data["羁绊"][t.APIName]; ok {
			continue
		}
		d := &TFTDetail{Patch: patch, Description: resolveTraitText(t)}
		for _, e := range t.Effects {
			d.Breakpoints = append(d.Breakpoints, TFTBreakpoint{MinUnits: e.MinUnits, Style: e.Style})
		}
		list := members[t.APIName]
		slices.SortStableFunc(list, func(a, b cdTFTChampion) int { return int(a.Cost - b.Cost) })
		for _, c := range list {
			if !slices.Contains(d.Champions, c.APIName) {
				d.Champions = append(d.Champions, c.APIName)
			}
		}
		data["羁绊"][t.APIName] = d
	}
}

// cdragonGameAsset 把游戏文件路径(assets/....tex / .dds)映射为 CommunityDragon 转好的 PNG。
func cdragonGameAsset(patch, p string) string {
	if p == "" {
		return ""
	}
	p = strings.ToLower(strings.TrimPrefix(p, "/"))
	return "cdragon/" + patch + "/game/" + strings.TrimSuffix(p, path.Ext(p)) + ".png"
}

var tftItemTags = map[string]string{"component": "基础装备", "consumable": "消耗品"}

var tftRarity = map[string]string{"default": "普通", "epic": "史诗", "legendary": "传说", "mythic": "神话", "ultimate": "终极"}

// numberOf 把 JSON 数字(或数字字符串)转为 float64。
func numberOf(v any) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case string:
		f, err := strconv.ParseFloat(x, 64)
		return f, err == nil
	}
	return 0, false
}

// starValues 取弈子技能 1、2、3 星的数值(数组下标 1–3);数组太短时取全部。
func starValues(raw []any) []float64 {
	if len(raw) >= 4 {
		raw = raw[1:4]
	}
	out := make([]float64, 0, len(raw))
	for _, v := range raw {
		f, _ := numberOf(v)
		out = append(out, f)
	}
	return out
}

// fmtNumber 去掉浮点误差(0.35000000596 → 0.35),最多两位小数。
func fmtNumber(f float64) string {
	return strconv.FormatFloat(math.Round(f*100)/100, 'f', -1, 64)
}

// tftHash 是 Riot 资源里字段名的哈希:小写后的 FNV-1a 32 位,写作 {xxxxxxxx}。
func tftHash(name string) string {
	h := fnv.New32a()
	h.Write([]byte(strings.ToLower(name)))
	return fmt.Sprintf("{%08x}", h.Sum32())
}

// lookup 按变量名取数值,找不到时返回 nil。
type lookup func(name string) []float64

// variableLookup 在一组变量里找名称(不分大小写,也认哈希名);
// 算出来的 ModifiedX 退回基础值 X / BaseX(即 100% 法强、攻击力时的数值)。
func variableLookup(vars map[string][]float64) lookup {
	index := map[string][]float64{}
	for k, v := range vars {
		index[strings.ToLower(k)] = v
	}
	get := func(name string) []float64 {
		if v, ok := index[strings.ToLower(name)]; ok {
			return v
		}
		return index[tftHash(name)]
	}
	return func(name string) []float64 {
		if v := get(name); v != nil {
			return v
		}
		if rest, ok := strings.CutPrefix(name, "Modified"); ok && rest != "" {
			if v := get(rest); v != nil {
				return v
			}
			return get("Base" + rest)
		}
		return nil
	}
}

func numberLookup(effects map[string]any) lookup {
	vars := map[string][]float64{}
	for k, v := range effects {
		if f, ok := numberOf(v); ok {
			vars[k] = []float64{f}
		}
	}
	return variableLookup(vars)
}

// tftVar 匹配 @Name@、@Name*100@、@TFTUnitProperty.trait:X@ 等占位符。
var tftVar = regexp.MustCompile(`@([^@\s<>]+)@`)

// tftIcon 匹配属性图标 %i:scaleAP%。
var tftIcon = regexp.MustCompile(`%i:(\w+)%`)

// tftIconLabels 是属性图标对应的文字;其余(赛季专属图标)去掉。
var tftIconLabels = map[string]string{
	"scaleap": "法术强度", "scalead": "攻击力", "tftbasead": "基础攻击力", "scalehealth": "生命值", "scaleas": "攻击速度",
	"scalearmor": "护甲", "scalemr": "魔抗", "scalemana": "法力值", "scalemanaregen": "法力回复", "tftmanaregen": "法力回复",
	"scalecrit": "暴击几率", "scalecritmult": "暴击伤害", "scaleda": "伤害增幅", "scaledr": "伤害减免", "scalesv": "全能吸血",
	"scalerange": "攻击距离", "scalehpregen": "生命回复", "goldcoins": "金币", "star": "星",
}

// resolveTFTText 代入 @变量@ 并把属性图标换成文字。
func resolveTFTText(text string, get lookup) string {
	text = dropPairedShowIf(text)
	text = tftVar.ReplaceAllStringFunc(text, func(m string) string {
		expr := m[1 : len(m)-1]
		if strings.Contains(expr, ":") {
			return m // 运行时才有的值
		}
		parts := strings.Split(strings.TrimSuffix(expr, "%"), "*")
		values := get(parts[0])
		if values == nil {
			return m
		}
		mult := 1.0
		for _, p := range parts[1:] {
			f, err := strconv.ParseFloat(strings.TrimSuffix(p, "%"), 64)
			if err != nil {
				return m
			}
			mult *= f
		}
		out := make([]string, len(values))
		for i, v := range values {
			out[i] = fmtNumber(v * mult)
		}
		if len(slices.Compact(slices.Clone(out))) == 1 {
			return out[0]
		}
		return strings.Join(out, "/")
	})
	return tftIcon.ReplaceAllStringFunc(text, func(m string) string {
		if label := tftIconLabels[strings.ToLower(tftIcon.FindStringSubmatch(m)[1])]; label != "" {
			return "<tftstat>" + label + "</tftstat>"
		}
		return ""
	})
}

var showIfNot = regexp.MustCompile(`(?i)<ShowIfNot\.([\w.]+)>`)

// dropPairedShowIf:说明里「条件成立 / 不成立」两种写法都有时只留不成立的通用写法,
// 只有 ShowIf 的段落(如棱彩条件)保留。
func dropPairedShowIf(text string) string {
	for _, m := range showIfNot.FindAllStringSubmatch(text, -1) {
		open, close := "<showif."+strings.ToLower(m[1])+">", "</showif."+strings.ToLower(m[1])+">"
		for {
			lower := strings.ToLower(text)
			i := strings.Index(lower, open)
			if i < 0 {
				break
			}
			j := strings.Index(lower[i:], close)
			if j < 0 {
				break
			}
			text = text[:i] + text[i+j+len(close):]
		}
	}
	return text
}

var (
	traitRow       = regexp.MustCompile(`(?is)<row>(.*?)</row>`)
	traitExpandRow = regexp.MustCompile(`(?is)<expandRow>(.*?)</expandRow>`)
)

// resolveTraitText 代入羁绊说明:<row> 依次对应各档,<expandRow> 对每一档各展开一行(展开在后,
// 免得展开出的行被当成 <row> 重复计数),行外的变量取第一个有该变量的档位。
func resolveTraitText(t cdTFTTrait) string {
	effectLookup := func(i int) lookup {
		e := t.Effects[i]
		vars := map[string][]float64{"MinUnits": {float64(e.MinUnits)}, "MaxUnits": {float64(e.MaxUnits)}}
		for k, v := range e.Variables {
			if f, ok := numberOf(v); ok {
				vars[k] = []float64{f}
			}
		}
		return variableLookup(vars)
	}
	text := t.Desc
	if len(t.Effects) > 0 {
		n := 0
		text = traitRow.ReplaceAllStringFunc(text, func(m string) string {
			defer func() { n++ }()
			if n >= len(t.Effects) {
				return m
			}
			return "<row>" + resolveTFTText(traitRow.FindStringSubmatch(m)[1], effectLookup(n)) + "</row>"
		})
		text = traitExpandRow.ReplaceAllStringFunc(text, func(m string) string {
			tpl := traitExpandRow.FindStringSubmatch(m)[1]
			rows := make([]string, len(t.Effects))
			for i := range t.Effects {
				rows[i] = "<row>" + resolveTFTText(tpl, effectLookup(i)) + "</row>"
			}
			return strings.Join(rows, "")
		})
	}
	text = resolveTFTText(text, func(name string) []float64 {
		for i := range t.Effects {
			if v := effectLookup(i)(name); v != nil {
				return v
			}
		}
		return nil
	})
	// 每行单独成块,行间的 <br> 会多出空行
	return rowGap.ReplaceAllString(text, "</row><row>")
}

var rowGap = regexp.MustCompile(`(?i)</row>\s*(?:<br\s*/?>\s*)+<row>`)

// tftItemStatDefs 是装备的基础属性:effects 里的键 → 文字;scale 为 100 的是小数,乘 100 显示为百分比。
var tftItemStatDefs = []struct {
	key, label string
	scale      float64
	suffix     string
}{
	{"AD", "攻击力", 100, "%"},
	{"AP", "法术强度", 1, ""},
	{"AS", "攻击速度", 1, "%"},
	{"Health", "生命值", 1, ""},
	{"Armor", "护甲", 1, ""},
	{"MagicResist", "魔抗", 1, ""},
	{"Mana", "法力值", 1, ""},
	{"ManaRegen", "法力回复", 1, ""},
	{"CritChance", "暴击几率", 1, "%"},
	{"StatOmnivamp", "全能吸血", 100, "%"},
	{"DamageAmp", "伤害增幅", 100, "%"},
}

func itemStats(effects map[string]any) []TFTStat {
	var out []TFTStat
	for _, d := range tftItemStatDefs {
		if f, ok := numberOf(effects[d.key]); ok && f != 0 {
			out = append(out, TFTStat{Label: d.label, Value: "+" + fmtNumber(f*d.scale) + d.suffix})
		}
	}
	return out
}

// 弈子升星的属性倍率(2 星、3 星):数据里只有 1 星数值,倍率是全局规则,
// 生命值每星 ×1.8,攻击力自 12.14 起每星 ×1.5(云顶资料 13.1 起才有,都适用);其余属性不随星级变化。
var tftStarScale = map[string][2]float64{"hp": {1.8, 3.24}, "damage": {1.5, 2.25}}

func championStats(stats map[string]any) []TFTStat {
	num := func(k string) (float64, bool) { return numberOf(stats[k]) }
	var out []TFTStat
	add := func(label, value string) {
		out = append(out, TFTStat{Label: label, Value: value, Stars: []string{value, value, value}})
	}
	for _, d := range []struct{ key, label string }{{"hp", "生命值"}, {"damage", "攻击力"}, {"attackSpeed", "攻击速度"}, {"armor", "护甲"}, {"magicResist", "魔抗"}} {
		f, ok := num(d.key)
		if !ok {
			continue
		}
		add(d.label, fmtNumber(f))
		if k, scaled := tftStarScale[d.key]; scaled {
			// 游戏里升星后的数值取整显示
			out[len(out)-1].Stars[1] = fmtNumber(math.Round(f * k[0]))
			out[len(out)-1].Stars[2] = fmtNumber(math.Round(f * k[1]))
		}
	}
	if m, ok := num("mana"); ok && m > 0 {
		initial, _ := num("initialMana")
		add("法力值", fmtNumber(initial)+" / "+fmtNumber(m))
	}
	if f, ok := num("range"); ok && f > 0 {
		add("攻击距离", fmtNumber(f)+" 格")
	}
	if f, ok := num("critChance"); ok {
		add("暴击几率", fmtNumber(f*100)+"%")
	}
	if f, ok := num("critMultiplier"); ok {
		add("暴击伤害", fmtNumber(f*100)+"%")
	}
	return out
}
