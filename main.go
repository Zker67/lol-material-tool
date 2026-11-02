// lol-material-tool:英雄联盟 / 云顶之弈官方素材一键获取与汉化整理工具(MyGo 桌面应用)。
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/egoist/mygo"

	"github.com/Zker67/lol-material-tool/internal/material"
)

// TaskProgress 推送下载 / 解压 / 汉化 / 导出任务的进度。
var TaskProgress = mygo.NewEvent[material.Progress]("task:progress")

// Tasks 是前端调用的素材任务:版本列表、下载、解压、汉化与导出。
// 同一时间只跟踪一个任务的取消,与界面一次只运行一个任务一致。
type Tasks struct {
	store *material.Store

	mu     sync.Mutex
	seq    uint64
	cancel context.CancelFunc
}

// begin 为新任务创建可由 CancelTask 取消的 context,返回其结束函数。
func (t *Tasks) begin(ctx context.Context) (context.Context, func()) {
	ctx, cancel := context.WithCancel(ctx)
	t.mu.Lock()
	t.seq++
	id := t.seq
	t.cancel = cancel
	t.mu.Unlock()
	return ctx, func() {
		cancel()
		t.mu.Lock()
		defer t.mu.Unlock()
		if t.seq == id {
			t.cancel = nil
		}
	}
}

func emitProgress(p material.Progress) {
	TaskProgress.Broadcast(p)
}

// ListVersions 获取全部版本号,首项为最新版。
func (t *Tasks) ListVersions(ctx context.Context) ([]string, error) {
	return material.ListVersions(ctx)
}

// CheckPack 检查某个版本是否有官方全量包及其大小。
func (t *Tasks) CheckPack(ctx context.Context, version string) (material.PackInfo, error) {
	return material.CheckPack(ctx, version)
}

// ExportAssets 把浏览器中选中的素材按中文名导出到 destDir。
func (t *Tasks) ExportAssets(ctx context.Context, destDir string, items []material.ExportItem) (material.ExportResult, error) {
	ctx, end := t.begin(ctx)
	defer end()
	return material.Export(ctx, t.store, destDir, items, emitProgress)
}

// DownloadPack 下载指定版本数据包到目标目录,返回 .tgz 完整路径。
func (t *Tasks) DownloadPack(ctx context.Context, version string, destDir string) (string, error) {
	ctx, end := t.begin(ctx)
	defer end()
	return material.Download(ctx, version, destDir, emitProgress)
}

// ExtractPack 解压 .tgz 到 {destDir}/联盟官方数据包-{version}/,返回解压根目录路径。
func (t *Tasks) ExtractPack(ctx context.Context, tgzPath string, destDir string, version string) (string, error) {
	ctx, end := t.begin(ctx)
	defer end()
	return material.Extract(ctx, tgzPath, destDir, version, emitProgress)
}

// RunLolLocalization 对已解压的官方数据包目录执行联盟汉化,返回汉化输出目录路径。
func (t *Tasks) RunLolLocalization(ctx context.Context, dataDir string) (string, error) {
	ctx, end := t.begin(ctx)
	defer end()
	return material.LocalizeLoL(ctx, dataDir, emitProgress)
}

// RunTftLocalization 对已解压的官方数据包目录执行云顶汉化,返回汉化输出目录路径。
func (t *Tasks) RunTftLocalization(ctx context.Context, dataDir string) (string, error) {
	ctx, end := t.begin(ctx)
	defer end()
	return material.LocalizeTFT(ctx, dataDir, emitProgress)
}

// CancelTask 请求取消当前任务。
func (t *Tasks) CancelTask() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.cancel != nil {
		t.cancel()
	}
}

// Assets 是素材浏览器的数据:各版本目录、历史原画、缓存,以及单张素材的保存与复制。
type Assets struct {
	store    *material.Store
	catalogs *material.Catalogs
	// settingsFile 保存固定保存位置等用户设置
	settingsFile string

	mu      sync.Mutex
	patches []string
}

// Catalog 返回某个版本的素材目录(英雄、皮肤、技能、装备、符文、召唤师技能、云顶)。
func (a *Assets) Catalog(ctx context.Context, version string) (*material.Catalog, error) {
	return a.catalogs.Get(ctx, version)
}

// cdragonPatches 返回 CommunityDragon 补丁列表,成功后缓存在内存中。
func (a *Assets) cdragonPatches(ctx context.Context) ([]string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.patches == nil {
		patches, err := material.CDragonPatches(ctx, a.store)
		if err != nil {
			return nil, err
		}
		a.patches = patches
	}
	return a.patches, nil
}

// HistoryPatch 返回某个版本对应的 CommunityDragon 补丁,没有时返回 ""(7.1 之前)。
func (a *Assets) HistoryPatch(ctx context.Context, version string) (string, error) {
	patches, err := a.cdragonPatches(ctx)
	if err != nil {
		return "", err
	}
	return material.PatchFor(version, patches), nil
}

// ChampionArt 返回某个版本下英雄(数字 key)的历史原画与炫彩(CommunityDragon)。
func (a *Assets) ChampionArt(ctx context.Context, version string, key string) (*material.ChampionArt, error) {
	patch, err := a.HistoryPatch(ctx, version)
	if err != nil {
		return nil, err
	}
	if patch == "" {
		return nil, errors.New("CommunityDragon 没有该版本的数据(7.1 起提供)")
	}
	return material.ChampionArtFor(ctx, a.store, patch, key)
}

// SaveAs 让用户选择位置,把一项素材另存过去;取消时返回 ""。
func (a *Assets) SaveAs(ctx context.Context, path string, suggestedName string) (string, error) {
	local, err := a.store.Get(ctx, path)
	if err != nil {
		return "", err
	}
	defaultName, err := material.SaveName(suggestedName, local)
	if err != nil {
		return "", err
	}
	opts := mygo.SaveDialogOptions{Parent: mygo.CallerWindow(ctx), DefaultPath: defaultName}
	if dir := a.SaveDir(); dir != "" {
		opts.DefaultPath = filepath.Join(dir, defaultName)
	}
	if ext := strings.TrimPrefix(filepath.Ext(local), "."); ext != "" {
		opts.Filters = []mygo.FileFilter{{Name: "图片", Extensions: []string{ext}}}
	}
	dest, err := mygo.Dialog.Save(opts)
	if err != nil || dest == "" {
		return "", err
	}
	data, err := os.ReadFile(local)
	if err != nil {
		return "", err
	}
	return dest, os.WriteFile(dest, data, 0o644)
}

// SaveDir 返回固定保存位置,还没设置时返回 ""。
func (a *Assets) SaveDir() string {
	s, err := material.LoadSettings(a.settingsFile)
	if err != nil {
		return ""
	}
	return s.SaveDir
}

// SetSaveDir 设置固定保存位置;传 "" 表示清除,之后每次保存都会先询问。
func (a *Assets) SetSaveDir(dir string) error {
	if dir != "" {
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			return fmt.Errorf("文件夹不存在:%s", dir)
		}
	}
	s, _ := material.LoadSettings(a.settingsFile)
	s.SaveDir = dir
	return material.SaveSettings(a.settingsFile, s)
}

// Save 把一项素材直接存到固定保存位置,重名时追加序号,返回保存的完整路径。
func (a *Assets) Save(ctx context.Context, path string, name string) (string, error) {
	dir := a.SaveDir()
	if dir == "" {
		return "", errors.New("还没有设置保存位置")
	}
	local, err := a.store.Get(ctx, path)
	if err != nil {
		return "", err
	}
	return material.SaveCopy(local, dir, name)
}

// CopyImage 把一项素材以 PNG 放到系统剪贴板。
func (a *Assets) CopyImage(ctx context.Context, path string) error {
	local, err := a.store.Get(ctx, path)
	if err != nil {
		return err
	}
	data, err := material.PNGBytes(local)
	if err != nil {
		return err
	}
	return mygo.Clipboard.WriteImage(data)
}

// CacheInfo 是素材缓存的位置与占用。
type CacheInfo struct {
	Dir  string `json:"dir"`
	Size uint64 `json:"size"`
}

// CacheInfo 返回素材缓存的位置与占用的字节数。
func (a *Assets) CacheInfo() (CacheInfo, error) {
	size, err := a.store.CacheSize()
	return CacheInfo{Dir: a.store.Dir(), Size: size}, err
}

// ClearCache 删除全部素材缓存。
func (a *Assets) ClearCache() error {
	return a.store.ClearCache()
}

// Desktop 是前端调用的系统能力:选择目录、打开文件夹与链接。
type Desktop struct{}

// PickDirectory 让用户选择一个目录,取消时返回 ""。
func (Desktop) PickDirectory(ctx context.Context) (string, error) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:    mygo.CallerWindow(ctx),
		Directory: true,
	})
	if err != nil || len(paths) == 0 {
		return "", err
	}
	return paths[0], nil
}

// OpenPath 用系统默认程序打开文件或文件夹。
func (Desktop) OpenPath(path string) error {
	return mygo.Shell.OpenPath(path)
}

// OpenURL 在默认浏览器中打开链接。
func (Desktop) OpenURL(url string) error {
	return mygo.Shell.OpenExternal(url)
}

// ShowInFolder 在文件管理器中打开文件所在的文件夹并选中它。
func (Desktop) ShowInFolder(path string) {
	mygo.Shell.ShowItemInFolder(path)
}

// CopyText 把文本放到系统剪贴板。
func (Desktop) CopyText(text string) {
	mygo.Clipboard.WriteText(text)
}

// settingsFile 返回用户设置文件:应用数据目录下的 settings.json。
func settingsFile() string {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		dir = filepath.Join(os.TempDir(), "lol-material-tool")
	}
	return filepath.Join(dir, "settings.json")
}

// cacheDir 返回素材缓存目录:应用的缓存目录下的 assets/。
func cacheDir() string {
	dir, err := mygo.App.Path(mygo.PathCache)
	if err != nil {
		dir = filepath.Join(os.TempDir(), "lol-material-tool")
	}
	return filepath.Join(dir, "assets")
}

func main() {
	store := material.NewStore(cacheDir())
	mygo.Bind(&Tasks{store: store}, &Assets{store: store, catalogs: material.NewCatalogs(store), settingsFile: settingsFile()}, Desktop{})
	// 页面经 lmt://localhost/ddragon/...(Windows 上为 http://lmt.localhost/...)加载素材
	if err := mygo.Protocol.Handle("lmt", store); err != nil {
		log.Fatal(err)
	}

	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{
			Title:           "英雄联盟素材获取工具",
			URL:             "/",
			Width:           1200,
			Height:          800,
			MinWidth:        900,
			MinHeight:       640,
			Frameless:       true,
			BackgroundColor: "#010A13", // 页面的 hex-bg
		})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
