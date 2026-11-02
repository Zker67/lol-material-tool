package material

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg" // 解码 jpg 素材
	"image/png"
	"os"
	"path/filepath"
	"strings"
)

// 单张素材的保存与复制:保存到固定的保存位置、重名不覆盖,复制图片时统一转成 PNG。

// Settings 是用户设置,存成 JSON。
type Settings struct {
	// SaveDir 是素材的固定保存位置,空表示还没设置。
	SaveDir string `json:"saveDir"`
}

// LoadSettings 读取设置文件;文件不存在时返回空设置。
func LoadSettings(file string) (Settings, error) {
	var s Settings
	data, err := os.ReadFile(file)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	if err := json.Unmarshal(data, &s); err != nil {
		return s, fmt.Errorf("设置文件损坏:%w", err)
	}
	return s, nil
}

// SaveSettings 写入设置文件,先写临时文件再改名,避免写一半损坏。
func SaveSettings(file string, s Settings) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		return err
	}
	tmp := file + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, file)
}

// fileName 清洗文件名,扩展名换成源文件的实际扩展名(素材可能是 png 也可能是 jpg)。
func fileName(name, src string) (string, error) {
	base := strings.TrimSpace(sanitize(filepath.Base(strings.ReplaceAll(name, "/", " "))))
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if base == "" || base == "." || base == ".." {
		return "", fmt.Errorf("非法的文件名:%q", name)
	}
	return base + filepath.Ext(src), nil
}

// SaveCopy 把 src 复制到 dir 下,文件名取自 name;重名时追加 (2)、(3)…,不覆盖已有文件。返回写入的完整路径。
func SaveCopy(src, dir, name string) (string, error) {
	file, err := fileName(name, src)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("创建保存目录失败:%w", err)
	}
	ext := filepath.Ext(file)
	stem := strings.TrimSuffix(file, ext)
	target := filepath.Join(dir, file)
	for i := 2; ; i++ {
		_, err := os.Stat(target)
		if errors.Is(err, os.ErrNotExist) {
			break
		}
		if err != nil {
			return "", err
		}
		target = filepath.Join(dir, fmt.Sprintf("%s (%d)%s", stem, i, ext))
	}
	if err := copyFile(src, target); err != nil {
		return "", fmt.Errorf("写入 %s 失败:%w", filepath.Base(target), err)
	}
	return target, nil
}

// SaveName 返回保存时实际使用的文件名(扩展名按源文件),给另存为对话框做默认名。
func SaveName(name, src string) (string, error) {
	return fileName(name, src)
}

// PNGBytes 读取 png / jpg 图片并编码为 PNG;系统剪贴板只接收 PNG。
func PNGBytes(file string) ([]byte, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	if bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) {
		return data, nil
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("无法识别的图片格式:%w", err)
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
