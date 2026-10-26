package material

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// CommunityDragon(社区维护,非官方):按补丁取历史原画与炫彩。
// Data Dragon 的原画地址不带版本号,只有最新版;CommunityDragon 每个补丁(7.1 起)
// 都有英雄 JSON,里面给出当时的原画路径。路径格式随年代变化,所以一律以 JSON 为准,
// 按官方文档把 `/lol-game-data/assets/` 映射到 `plugins/rcp-be-lol-game-data/global/default/`(全部小写)。
// 中文 JSON 约 9.12 起才有,更早回退英文;皮肤名称以 Data Dragon 的中文为准,按皮肤 ID 对应。

var patchName = regexp.MustCompile(`^\d+\.\d+$`)

// ChampionArt 是某个补丁下一位英雄的皮肤原画与炫彩。
type ChampionArt struct {
	// Patch 是 CommunityDragon 补丁目录,如 16.21。
	Patch string    `json:"patch"`
	Skins []SkinArt `json:"skins"`
}

// SkinArt 是一款皮肤在该补丁下的原画。
type SkinArt struct {
	// ID 是全局皮肤 ID,与 Skin.ID 对应。
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Splash     string   `json:"splash"`
	Uncentered string   `json:"uncentered"`
	Tile       string   `json:"tile"`
	LoadScreen string   `json:"loadScreen"`
	Chromas    []Chroma `json:"chromas"`
}

// Chroma 是一款炫彩。
type Chroma struct {
	ID     string   `json:"id"`
	Name   string   `json:"name"`
	Image  string   `json:"image"`
	Colors []string `json:"colors"`
}

// CDragonPatches 返回 CommunityDragon 上的补丁目录(从旧到新)。
func CDragonPatches(ctx context.Context, s *Store) ([]string, error) {
	listing, err := s.JSON(ctx, "cdragon/json/")
	if err != nil {
		return nil, fmt.Errorf("读取 CommunityDragon 补丁列表失败:%w", err)
	}
	arr, _ := listing.([]any)
	var patches []string
	for _, e := range arr {
		if name := str(e, "name"); str(e, "type") == "directory" && patchName.MatchString(name) {
			patches = append(patches, name)
		}
	}
	slices.SortFunc(patches, comparePatch)
	return patches, nil
}

func comparePatch(a, b string) int {
	pa, pb := strings.Split(a, "."), strings.Split(b, ".")
	for i := range 2 {
		x, _ := strconv.Atoi(pa[i])
		y, _ := strconv.Atoi(pb[i])
		if x != y {
			return x - y
		}
	}
	return 0
}

// PatchFor 把 Data Dragon 版本(16.21.1、10.10.3216176)对应到 CommunityDragon 补丁(16.21);
// 该补丁不存在时返回 ""。
func PatchFor(version string, patches []string) string {
	parts := strings.Split(version, ".")
	if len(parts) < 2 {
		return ""
	}
	p := parts[0] + "." + parts[1]
	if slices.Contains(patches, p) {
		return p
	}
	return ""
}

// cdragonAsset 把 JSON 里的 `/lol-game-data/assets/...` 映射为缓存相对路径。
func cdragonAsset(patch, p string) string {
	rest, ok := strings.CutPrefix(p, "/lol-game-data/assets/")
	if !ok || rest == "" {
		return ""
	}
	return "cdragon/" + patch + "/plugins/rcp-be-lol-game-data/global/default/" + strings.ToLower(rest)
}

// ChampionArtFor 读取某个补丁下英雄(数字 key)的皮肤原画与炫彩。
func ChampionArtFor(ctx context.Context, s *Store, patch, key string) (*ChampionArt, error) {
	if !patchName.MatchString(patch) {
		return nil, fmt.Errorf("不支持的补丁:%s", patch)
	}
	if _, err := strconv.Atoi(key); err != nil {
		return nil, fmt.Errorf("不支持的英雄 key:%s", key)
	}
	var root any
	var err error
	for _, lang := range []string{"zh_cn", "default"} {
		root, err = s.JSON(ctx, "cdragon/"+patch+"/plugins/rcp-be-lol-game-data/global/"+lang+"/v1/champions/"+key+".json")
		if !errors.Is(err, ErrAssetNotFound) {
			break
		}
	}
	if err != nil {
		return nil, fmt.Errorf("读取补丁 %s 的英雄数据失败:%w", patch, err)
	}
	art := &ChampionArt{Patch: patch}
	skins, _ := field(root, "skins").([]any)
	for _, sk := range skins {
		sa := SkinArt{
			ID:         idString(field(sk, "id")),
			Name:       str(sk, "name"),
			Splash:     cdragonAsset(patch, str(sk, "splashPath")),
			Uncentered: cdragonAsset(patch, str(sk, "uncenteredSplashPath")),
			Tile:       cdragonAsset(patch, str(sk, "tilePath")),
			LoadScreen: cdragonAsset(patch, str(sk, "loadScreenPath")),
		}
		chromas, _ := field(sk, "chromas").([]any)
		for _, ch := range chromas {
			sa.Chromas = append(sa.Chromas, Chroma{
				ID:     idString(field(ch, "id")),
				Name:   str(ch, "name"),
				Image:  cdragonAsset(patch, str(ch, "chromaPath")),
				Colors: strList(field(ch, "colors")),
			})
		}
		art.Skins = append(art.Skins, sa)
	}
	return art, nil
}
