package material

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// Riot Data Dragon 接口:版本列表与下载地址拼接。

const versionsURL = "https://ddragon.leagueoflegends.com/api/versions.json"

// ListVersions 获取全部可用版本号,数组首项为最新版(不变量 §9)。
func ListVersions(ctx context.Context) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, versionsURL, nil)
	if err != nil {
		return nil, fmt.Errorf("请求版本列表失败:%w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求版本列表失败:%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return nil, fmt.Errorf("版本列表响应异常:HTTP %s", resp.Status)
	}
	var all []string
	if err := json.NewDecoder(resp.Body).Decode(&all); err != nil {
		return nil, fmt.Errorf("解析版本列表失败:%w", err)
	}
	// lolpatch_* 只是补丁标记,没有任何数据文件
	versions := make([]string, 0, len(all))
	for _, v := range all {
		if !strings.HasPrefix(v, "lolpatch_") {
			versions = append(versions, v)
		}
	}
	return versions, nil
}

// DragontailURL 拼接 dragontail 全量包下载地址(不变量 §9)。
func DragontailURL(version string) string {
	return "https://ddragon.leagueoflegends.com/cdn/dragontail-" + version + ".tgz"
}

// PackInfo 是某个版本全量包的可用情况。
type PackInfo struct {
	// Available 表示官方提供该版本的全量包(部分版本如 7.24.2、0.151.2 没有)。
	Available bool `json:"available"`
	// Size 是全量包字节数,不可用时为 0。
	Size uint64 `json:"size"`
}

// CheckPack 用 HEAD 请求检查某个版本的全量包是否存在及其大小。
func CheckPack(ctx context.Context, version string) (PackInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, DragontailURL(version), nil)
	if err != nil {
		return PackInfo{}, fmt.Errorf("检查数据包失败:%w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return PackInfo{}, fmt.Errorf("检查数据包失败:%w", err)
	}
	resp.Body.Close()
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode <= 299:
		return PackInfo{Available: true, Size: uint64(max(resp.ContentLength, 0))}, nil
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound:
		return PackInfo{}, nil
	default:
		return PackInfo{}, fmt.Errorf("检查数据包失败:HTTP %s", resp.Status)
	}
}
