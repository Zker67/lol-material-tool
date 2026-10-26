package material

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// .tgz(gzip + tar)解压,推送进度;成功后删除压缩包(不变量 §7)。

// Extract 解压 `.tgz` 到 `{destDir}/联盟官方数据包-{version}/`;成功后删除 `.tgz`,返回解压根目录路径。
func Extract(ctx context.Context, tgzPath, destDir, version string, onProgress ProgressFunc) (string, error) {
	outDir := filepath.Join(destDir, LeagueDataSubfolder+"-"+version)

	// 不变量 §7:解压前清掉同名目录,保证幂等
	if _, err := os.Stat(outDir); err == nil {
		if err := os.RemoveAll(outDir); err != nil {
			return "", fmt.Errorf("清理旧目录失败:%w", err)
		}
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return "", fmt.Errorf("创建解压目录失败:%w", err)
	}

	count, err := extractTgz(ctx, tgzPath, outDir, onProgress)
	if err != nil {
		return "", err
	}

	// 不变量 §7:解压成功后删除 .tgz
	os.Remove(tgzPath)

	onProgress.emit(Progress{
		Stage:   StageExtract,
		Current: count,
		Total:   count,
		Eta:     ptr(0),
		Message: fmt.Sprintf("解压完成,共 %d 个文件", count),
		Done:    true,
	})
	return outDir, nil
}

func extractTgz(ctx context.Context, tgzPath, outDir string, onProgress ProgressFunc) (uint64, error) {
	file, err := os.Open(tgzPath)
	if err != nil {
		return 0, fmt.Errorf("打开压缩包失败:%w", err)
	}
	defer file.Close()
	gz, err := gzip.NewReader(bufio.NewReaderSize(file, 1<<20))
	if err != nil {
		return 0, fmt.Errorf("读取压缩包失败:%w", err)
	}
	defer gz.Close()
	archive := tar.NewReader(gz)

	buf := make([]byte, 1<<20)
	var count uint64
	for {
		if err := checkCancel(ctx); err != nil {
			return 0, err
		}
		hdr, err := archive.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("读取条目失败:%w", err)
		}
		if err := unpackEntry(archive, hdr, outDir, buf); err != nil {
			return 0, fmt.Errorf("解压条目失败:%w", err)
		}
		count++

		if count%50 == 0 {
			onProgress.emit(Progress{
				Stage:   StageExtract,
				Current: count,
				Message: fmt.Sprintf("正在解压…已处理 %d 个文件", count),
			})
		}
	}
	return count, nil
}

// unpackEntry 把一个条目写到 outDir 下。与 Rust tar 的 `unpack_in` 一致:
// 去掉根与 `.` 前缀,含 `..` 的条目跳过,不写到 outDir 之外。
func unpackEntry(r io.Reader, hdr *tar.Header, outDir string, buf []byte) error {
	rel, ok := safeRelPath(hdr.Name)
	if !ok {
		return nil
	}
	target := filepath.Join(outDir, rel)
	switch hdr.Typeflag {
	case tar.TypeDir:
		return os.MkdirAll(target, 0o755)
	case tar.TypeReg:
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		f, err := os.Create(target)
		if err != nil {
			return err
		}
		if _, err := io.CopyBuffer(f, r, buf); err != nil {
			f.Close()
			return err
		}
		if err := f.Close(); err != nil {
			return err
		}
		if !hdr.ModTime.IsZero() {
			os.Chtimes(target, hdr.ModTime, hdr.ModTime)
		}
	}
	// 链接与设备等其他类型的条目不写出
	return nil
}

// safeRelPath 把条目名转成相对路径;含 `..` 或为空时返回 false。
func safeRelPath(name string) (string, bool) {
	var parts []string
	for _, p := range strings.Split(strings.ReplaceAll(name, `\`, "/"), "/") {
		switch {
		case p == "" || p == ".":
			continue
		case p == "..":
			return "", false
		case len(parts) == 0 && len(p) == 2 && p[1] == ':':
			continue // Windows 盘符前缀
		}
		parts = append(parts, p)
	}
	if len(parts) == 0 {
		return "", false
	}
	return filepath.Join(parts...), true
}
