package material

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// dragontail 全量包的流式下载,边下边写并推送进度。

// Download 下载指定版本的 dragontail 全量包到目标目录,返回 `.tgz` 完整路径。
// ctx 取消时中止下载并删除未完成的文件。
func Download(ctx context.Context, version, destDir string, onProgress ProgressFunc) (string, error) {
	return download(ctx, DragontailURL(version), "dragontail-"+version+".tgz", destDir, onProgress)
}

func download(ctx context.Context, url, fileName, destDir string, onProgress ProgressFunc) (string, error) {
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", fmt.Errorf("创建目录失败:%w", err)
	}
	tgzPath := filepath.Join(destDir, fileName)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("下载请求失败:%w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", ErrCanceled
		}
		return "", fmt.Errorf("下载请求失败:%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return "", fmt.Errorf("下载响应异常:HTTP %s", resp.Status)
	}
	total := uint64(max(resp.ContentLength, 0))

	file, err := os.Create(tgzPath)
	if err != nil {
		return "", fmt.Errorf("创建文件失败:%w", err)
	}

	var downloaded uint64
	start := time.Now()
	lastEmit := time.Now()
	buf := make([]byte, 256*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, err := file.Write(buf[:n]); err != nil {
				file.Close()
				return "", fmt.Errorf("写入失败:%w", err)
			}
			downloaded += uint64(n)
			// 限频推送(约每 100ms),避免事件风暴
			if time.Since(lastEmit) >= 100*time.Millisecond {
				onProgress.emit(downloadProgress(fileName, downloaded, total, start, false))
				lastEmit = time.Now()
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			file.Close()
			if ctx.Err() != nil {
				os.Remove(tgzPath)
				return "", ErrCanceled
			}
			return "", fmt.Errorf("下载中断:%w", readErr)
		}
	}

	if err := file.Close(); err != nil {
		return "", fmt.Errorf("刷新失败:%w", err)
	}
	onProgress.emit(downloadProgress(fileName, downloaded, max(total, downloaded), start, true))
	return tgzPath, nil
}

// downloadProgress 生成一帧下载进度。
func downloadProgress(fileName string, downloaded, total uint64, start time.Time, done bool) Progress {
	elapsed := time.Since(start).Seconds()
	speed := 0.0
	if elapsed > 0 {
		speed = float64(downloaded) / elapsed
	}
	p := Progress{Stage: StageDownload, Current: downloaded, Total: total, Done: done}
	switch {
	case done:
		p.Eta = ptr(0)
		p.Message = "下载完成 " + fileName
	default:
		p.Speed = ptr(speed)
		if speed > 0 && total > 0 {
			p.Eta = ptr(float64(total-min(downloaded, total)) / speed)
		}
		p.Message = "正在下载 " + fileName
	}
	return p
}
