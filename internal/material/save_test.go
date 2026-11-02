package material

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

// writeImage 在 dir 下生成一张 4×4 的 jpg 或 png 图片。
func writeImage(t *testing.T, dir, name string) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for i := range img.Pix {
		img.Pix[i] = 200
	}
	img.Set(1, 1, color.RGBA{R: 10, G: 200, B: 185, A: 255})
	var buf bytes.Buffer
	var err error
	if filepath.Ext(name) == ".png" {
		err = png.Encode(&buf, img)
	} else {
		err = jpeg.Encode(&buf, img, nil)
	}
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestSaveCopyUsesSourceExtensionAndNeverOverwrites(t *testing.T) {
	src := writeImage(t, t.TempDir(), "Ahri_0.jpg")
	dest := filepath.Join(t.TempDir(), "保存") // 不存在的目录会被创建

	want := []string{"阿狸 插画.jpg", "阿狸 插画 (2).jpg", "阿狸 插画 (3).jpg"}
	for _, w := range want {
		// 传入的扩展名是 .png,实际按源文件的 .jpg 保存
		got, err := SaveCopy(src, dest, "阿狸 插画.png")
		if err != nil {
			t.Fatal(err)
		}
		if filepath.Base(got) != w {
			t.Fatalf("保存为 %q,期望 %q", filepath.Base(got), w)
		}
	}
	srcData, _ := os.ReadFile(src)
	for _, w := range want {
		data, err := os.ReadFile(filepath.Join(dest, w))
		if err != nil || !bytes.Equal(data, srcData) {
			t.Fatalf("%s 内容与源文件不一致:%v", w, err)
		}
	}
}

func TestSaveCopySanitizesName(t *testing.T) {
	src := writeImage(t, t.TempDir(), "icon.png")
	dest := t.TempDir()
	got, err := SaveCopy(src, dest, `子目录/K/DA: 阿卡丽?.png`)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Dir(got) != dest {
		t.Fatalf("文件写到了 %s 之外:%s", dest, got)
	}
	if base := filepath.Base(got); base != "子目录 K DA 阿卡丽.png" {
		t.Fatalf("文件名清洗结果 %q", base)
	}
	for _, bad := range []string{"", "  ", "..", `???`} {
		if _, err := SaveCopy(src, dest, bad); err == nil {
			t.Fatalf("非法文件名 %q 应当报错", bad)
		}
	}
}

func TestSaveCopyMissingSource(t *testing.T) {
	if _, err := SaveCopy(filepath.Join(t.TempDir(), "nope.png"), t.TempDir(), "x.png"); err == nil {
		t.Fatal("源文件不存在时应当报错")
	}
}

func TestPNGBytes(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"splash.jpg", "icon.png"} {
		data, err := PNGBytes(writeImage(t, dir, name))
		if err != nil {
			t.Fatalf("%s:%v", name, err)
		}
		img, err := png.Decode(bytes.NewReader(data))
		if err != nil {
			t.Fatalf("%s 转出的不是 PNG:%v", name, err)
		}
		if img.Bounds().Dx() != 4 || img.Bounds().Dy() != 4 {
			t.Fatalf("%s 尺寸变了:%v", name, img.Bounds())
		}
	}

	bad := filepath.Join(dir, "broken.jpg")
	if err := os.WriteFile(bad, []byte("not an image"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := PNGBytes(bad); err == nil {
		t.Fatal("损坏的图片应当报错")
	}
}

func TestSettingsRoundTrip(t *testing.T) {
	file := filepath.Join(t.TempDir(), "nested", "settings.json")

	s, err := LoadSettings(file)
	if err != nil || s.SaveDir != "" {
		t.Fatalf("没有设置文件时应返回空设置:%+v %v", s, err)
	}

	want := Settings{SaveDir: `D:\素材`}
	if err := SaveSettings(file, want); err != nil {
		t.Fatal(err)
	}
	got, err := LoadSettings(file)
	if err != nil || got != want {
		t.Fatalf("读回 %+v %v,期望 %+v", got, err, want)
	}
	if _, err := os.Stat(file + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("临时文件没有清理")
	}

	if err := os.WriteFile(file, []byte("{broken"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadSettings(file); err == nil {
		t.Fatal("损坏的设置文件应当报错")
	}
}
