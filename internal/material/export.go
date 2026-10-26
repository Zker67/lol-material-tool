package material

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// 导出浏览器里选中的素材:从缓存(没有则先下载)复制到目标目录,按中文名命名。

// ExportItem 是一项待导出的素材。
type ExportItem struct {
	// Path 是缓存相对路径。
	Path string `json:"path"`
	// Name 是输出的相对路径,用 / 分隔子目录,如 `九尾妖狐 阿狸/插画/高丽风情 阿狸.jpg`。
	Name string `json:"name"`
}

// ExportResult 是导出结果。
type ExportResult struct {
	Dir     string `json:"dir"`
	Written int    `json:"written"`
	// Missing 是远程不存在而跳过的数量。
	Missing int `json:"missing"`
}

// safeOutputName 清洗输出相对路径的每一段;为空时返回 false。
func safeOutputName(name string) (string, bool) {
	var parts []string
	for _, seg := range strings.Split(name, "/") {
		seg = strings.TrimSpace(sanitize(seg))
		if seg == "" || seg == "." || seg == ".." {
			continue
		}
		parts = append(parts, seg)
	}
	if len(parts) == 0 {
		return "", false
	}
	return filepath.Join(parts...), true
}

// Export 把 items 导出到 destDir,推送 export 阶段进度。
func Export(ctx context.Context, s *Store, destDir string, items []ExportItem, onProgress ProgressFunc) (ExportResult, error) {
	res := ExportResult{Dir: destDir}
	if len(items) == 0 {
		return res, errors.New("没有可导出的素材")
	}
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return res, fmt.Errorf("创建导出目录失败:%w", err)
	}
	total := uint64(len(items))
	for i, it := range items {
		if err := checkCancel(ctx); err != nil {
			return res, err
		}
		name, ok := safeOutputName(it.Name)
		if !ok {
			return res, fmt.Errorf("非法的导出名称:%q", it.Name)
		}
		local, err := s.Get(ctx, it.Path)
		switch {
		case errors.Is(err, ErrAssetNotFound):
			res.Missing++
		case ctx.Err() != nil:
			return res, ErrCanceled
		case err != nil:
			return res, err
		default:
			target := filepath.Join(destDir, name)
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return res, fmt.Errorf("创建目录失败:%w", err)
			}
			if err := copyFile(local, target); err != nil {
				return res, fmt.Errorf("写入 %s 失败:%w", name, err)
			}
			res.Written++
		}
		onProgress.emit(Progress{Stage: StageExport, Current: uint64(i + 1), Total: total,
			Message: fmt.Sprintf("正在导出…%d / %d", i+1, total)})
	}
	msg := fmt.Sprintf("导出完成,共 %d 个文件", res.Written)
	if res.Missing > 0 {
		msg += fmt.Sprintf(",%d 个官方已不提供", res.Missing)
	}
	onProgress.emit(Progress{Stage: StageExport, Current: total, Total: total, Message: msg, Done: true})
	return res, nil
}
