package material

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// writeTgz 按顺序把条目写成 .tgz;内容为空字符串且名字以 / 结尾的是目录。
func writeTgz(t *testing.T, path string, entries [][2]string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(f)
	tw := tar.NewWriter(gz)
	mtime := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	for _, e := range entries {
		hdr := &tar.Header{Name: e[0], Mode: 0o644, ModTime: mtime, Typeflag: tar.TypeReg, Size: int64(len(e[1]))}
		if strings.HasSuffix(e[0], "/") {
			hdr.Typeflag, hdr.Mode, hdr.Size = tar.TypeDir, 0o755, 0
		}
		if err := tw.WriteHeader(hdr); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(e[1])); err != nil {
			t.Fatal(err)
		}
	}
	for _, c := range []interface{ Close() error }{tw, gz, f} {
		if err := c.Close(); err != nil {
			t.Fatal(err)
		}
	}
}

func TestExtractWritesTreeAndRemovesTgz(t *testing.T) {
	dir := t.TempDir()
	tgz := filepath.Join(dir, "dragontail-1.2.3.tgz")
	entries := [][2]string{
		{"1.2.3/", ""},
		{"1.2.3/data/zh_CN/item.json", `{"data":{}}`},
		{"./img/perk-images/a.png", "a"},
		{"../escape.txt", "evil"},
		{"1.2.3/../../escape2.txt", "evil"},
	}
	for i := 0; i < 120; i++ {
		entries = append(entries, [2]string{"1.2.3/img/item/" + string(rune('a'+i%26)) + strings.Repeat("x", i/26) + ".png", "p"})
	}
	writeTgz(t, tgz, entries)

	var events []Progress
	out, err := Extract(context.Background(), tgz, dir, "1.2.3", func(p Progress) { events = append(events, p) })
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(dir, LeagueDataSubfolder+"-1.2.3"); out != want {
		t.Errorf("out = %q", out)
	}
	if exists(tgz) {
		t.Error("tgz should be removed after extract")
	}
	got := listTree(t, out)
	if got["1.2.3/data/zh_CN/item.json"] != `{"data":{}}` || got["img/perk-images/a.png"] != "a" || len(got) != 122 {
		t.Errorf("tree has %d files", len(got))
	}
	for _, p := range []string{filepath.Join(dir, "escape.txt"), filepath.Join(filepath.Dir(dir), "escape.txt"), filepath.Join(dir, "escape2.txt")} {
		if exists(p) {
			t.Errorf("%s escaped the output directory", p)
		}
	}
	info, _ := os.Stat(filepath.Join(out, "img", "perk-images", "a.png"))
	if info == nil || !info.ModTime().Equal(time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)) {
		t.Errorf("mtime not preserved: %v", info)
	}
	last := events[len(events)-1]
	if !last.Done || last.Current != 125 || last.Total != 125 || len(events) != 3 {
		t.Errorf("events = %+v", events)
	}

	// 重跑:先清空同名目录
	writeFile(t, filepath.Join(out, "stale.txt"), "old")
	writeTgz(t, tgz, entries[:2])
	if _, err := Extract(context.Background(), tgz, dir, "1.2.3", nil); err != nil {
		t.Fatal(err)
	}
	if exists(filepath.Join(out, "stale.txt")) {
		t.Error("old output should be cleared")
	}
}

func TestExtractErrors(t *testing.T) {
	dir := t.TempDir()
	if _, err := Extract(context.Background(), filepath.Join(dir, "missing.tgz"), dir, "1.0.0", nil); err == nil || !strings.Contains(err.Error(), "打开压缩包失败") {
		t.Errorf("missing err = %v", err)
	}
	bad := filepath.Join(dir, "bad.tgz")
	writeFile(t, bad, "not gzip")
	if _, err := Extract(context.Background(), bad, dir, "1.0.0", nil); err == nil || !strings.Contains(err.Error(), "读取压缩包失败") {
		t.Errorf("bad err = %v", err)
	}
	if !exists(bad) {
		t.Error("tgz must be kept when extract fails")
	}

	ok := filepath.Join(dir, "ok.tgz")
	writeTgz(t, ok, [][2]string{{"a.txt", "a"}})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Extract(ctx, ok, dir, "1.0.0", nil); !errors.Is(err, ErrCanceled) {
		t.Errorf("cancel err = %v", err)
	}
}

func TestDragontailURL(t *testing.T) {
	if got := DragontailURL("14.10.1"); got != "https://ddragon.leagueoflegends.com/cdn/dragontail-14.10.1.tgz" {
		t.Errorf("got %q", got)
	}
}

// 以下测试访问真实的 Riot Data Dragon。

func liveVersion(t *testing.T) string {
	t.Helper()
	if testing.Short() {
		t.Skip("访问网络,-short 时跳过")
	}
	versions, err := ListVersions(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(versions) == 0 || !strings.Contains(versions[0], ".") {
		t.Fatalf("versions = %v", versions[:min(3, len(versions))])
	}
	return versions[0]
}

func TestListVersionsLive(t *testing.T) {
	liveVersion(t)
	versions, _ := ListVersions(context.Background())
	for _, v := range versions {
		if strings.HasPrefix(v, "lolpatch_") {
			t.Fatalf("lolpatch versions should be filtered: %s", v)
		}
	}
}

func TestCheckPackLive(t *testing.T) {
	version := liveVersion(t)
	info, err := CheckPack(context.Background(), version)
	if err != nil || !info.Available || info.Size < 100<<20 {
		t.Errorf("latest = %+v, %v", info, err)
	}
	// 7.24.2 官方没有全量包
	info, err = CheckPack(context.Background(), "7.24.2")
	if err != nil || info.Available || info.Size != 0 {
		t.Errorf("7.24.2 = %+v, %v", info, err)
	}
}

func TestDownloadSmallFileLive(t *testing.T) {
	version := liveVersion(t)
	dir := t.TempDir()
	url := "https://ddragon.leagueoflegends.com/cdn/" + version + "/data/zh_CN/runesReforged.json"
	var events []Progress
	path, err := download(context.Background(), url, "runes.json", filepath.Join(dir, "sub"), func(p Progress) { events = append(events, p) })
	if err != nil {
		t.Fatal(err)
	}
	if _, err := loadJSON(path); err != nil {
		t.Fatalf("downloaded file is not valid JSON: %v", err)
	}
	last := events[len(events)-1]
	info, _ := os.Stat(path)
	if !last.Done || last.Current != uint64(info.Size()) || last.Speed != nil || *last.Eta != 0 || last.Message != "下载完成 runes.json" {
		t.Errorf("last event = %+v", last)
	}
}

func TestDownloadMissingVersionLive(t *testing.T) {
	liveVersion(t)
	_, err := Download(context.Background(), "0.0.0-missing", t.TempDir(), nil)
	if err == nil || !strings.Contains(err.Error(), "下载响应异常:HTTP 4") {
		t.Errorf("err = %v", err)
	}
}

func TestDownloadCancelLive(t *testing.T) {
	version := liveVersion(t)
	dir := t.TempDir()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var first Progress
	_, err := Download(ctx, version, dir, func(p Progress) {
		if first.Message == "" {
			first = p
			cancel() // 收到第一帧进度后取消
		}
	})
	if !errors.Is(err, ErrCanceled) {
		t.Fatalf("err = %v", err)
	}
	if first.Total < 100<<20 || first.Speed == nil || first.Current == 0 {
		t.Errorf("first progress = %+v", first)
	}
	if exists(filepath.Join(dir, "dragontail-"+version+".tgz")) {
		t.Error("partial file should be removed")
	}
}
