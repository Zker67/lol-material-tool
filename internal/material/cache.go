package material

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// 素材的磁盘缓存:把 Data Dragon / CommunityDragon 的文件按远程路径缓存到本地,
// 同时作为 `lmt://` 协议的处理器供页面加载图片。缓存的相对路径形如
// `ddragon/cdn/16.21.1/img/champion/Ahri.png`、`cdragon/16.21/plugins/...`。

// ErrAssetNotFound 表示远程不存在该素材(HTTP 403 / 404)。
var ErrAssetNotFound = errors.New("素材不存在")

var sources = map[string]string{
	"ddragon": "https://ddragon.leagueoflegends.com/",
	"cdragon": "https://raw.communitydragon.org/",
}

// 带版本号的路径内容不会再变,永久缓存。
var versionedPath = regexp.MustCompile(`^(ddragon/cdn/\d+\.\d+\.\d+/|cdragon/\d+\.\d+/)`)

// Store 是素材缓存。
type Store struct {
	dir    string
	client *http.Client
	sem    chan struct{} // 限制同时访问远程的请求数

	mu       sync.Mutex
	inflight map[string]*fetchCall
	missing  map[string]time.Time // 远程不存在的路径,短时间内不重复请求
}

type fetchCall struct {
	done chan struct{}
	err  error
}

// NewStore 创建缓存目录为 dir 的素材缓存。
func NewStore(dir string) *Store {
	return &Store{
		dir:      dir,
		client:   &http.Client{Timeout: 5 * time.Minute},
		sem:      make(chan struct{}, 12),
		inflight: map[string]*fetchCall{},
		missing:  map[string]time.Time{},
	}
}

// Dir 返回缓存目录。
func (s *Store) Dir() string { return s.dir }

// ttl 返回缓存的有效期,0 表示永久。
func ttl(rel string) time.Duration {
	switch {
	case versionedPath.MatchString(rel):
		return 0
	case rel == "ddragon/api/versions.json" || strings.HasPrefix(rel, "cdragon/json/"):
		return time.Hour
	default: // 不带版本号的原画、符文图标与 latest 补丁,官方偶尔会更新
		return 7 * 24 * time.Hour
	}
}

// remoteURL 把缓存相对路径转换为远程地址;路径不合法时返回 false。
func remoteURL(rel string) (string, bool) {
	if rel == "" || strings.Contains(rel, `\`) || strings.Contains(rel, "//") {
		return "", false
	}
	for _, seg := range strings.Split(strings.TrimSuffix(rel, "/"), "/") {
		if seg == "" || seg == "." || seg == ".." {
			return "", false
		}
	}
	src, rest, ok := strings.Cut(rel, "/")
	base, known := sources[src]
	if !ok || !known {
		return "", false
	}
	return base + rest, true
}

// localPath 是 rel 在缓存目录中的文件;以 / 结尾的目录列表存为 index.json。
func (s *Store) localPath(rel string) string {
	if strings.HasSuffix(rel, "/") {
		rel += "index.json"
	}
	return filepath.Join(s.dir, filepath.FromSlash(rel))
}

// Get 确保 rel 在本地缓存中并返回其文件路径。过期但远程不可达时仍返回旧文件。
func (s *Store) Get(ctx context.Context, rel string) (string, error) {
	url, ok := remoteURL(rel)
	if !ok {
		return "", fmt.Errorf("非法的素材路径:%s", rel)
	}
	local := s.localPath(rel)
	info, statErr := os.Stat(local)
	if statErr == nil {
		if d := ttl(rel); d == 0 || time.Since(info.ModTime()) < d {
			return local, nil
		}
	}

	s.mu.Lock()
	if t, ok := s.missing[rel]; ok && time.Since(t) < 10*time.Minute {
		s.mu.Unlock()
		return "", ErrAssetNotFound
	}
	call, running := s.inflight[rel]
	if !running {
		call = &fetchCall{done: make(chan struct{})}
		s.inflight[rel] = call
	}
	s.mu.Unlock()

	if !running {
		call.err = s.fetch(ctx, url, local)
		s.mu.Lock()
		delete(s.inflight, rel)
		if errors.Is(call.err, ErrAssetNotFound) {
			s.missing[rel] = time.Now()
		}
		s.mu.Unlock()
		close(call.done)
	} else {
		select {
		case <-call.done:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}

	if call.err != nil {
		// 刷新失败但有旧文件(离线等)时继续用旧文件
		if statErr == nil && !errors.Is(call.err, ErrAssetNotFound) {
			return local, nil
		}
		return "", call.err
	}
	return local, nil
}

// fetch 下载 url 到 local,先写临时文件再改名,避免留下半个文件。
func (s *Store) fetch(ctx context.Context, url, local string) error {
	select {
	case s.sem <- struct{}{}:
		defer func() { <-s.sem }()
	case <-ctx.Done():
		return ctx.Err()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("获取素材失败:%w", err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound:
		return ErrAssetNotFound
	case resp.StatusCode < 200 || resp.StatusCode > 299:
		return fmt.Errorf("获取素材失败:HTTP %s", resp.Status)
	}
	if err := os.MkdirAll(filepath.Dir(local), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(local), ".part-*")
	if err != nil {
		return err
	}
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return fmt.Errorf("获取素材失败:%w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	os.Remove(local)
	if err := os.Rename(tmp.Name(), local); err != nil {
		os.Remove(tmp.Name())
		return err
	}
	return nil
}

// JSON 读取缓存中的 JSON 文件;数字保留为 json.Number。
func (s *Store) JSON(ctx context.Context, rel string) (any, error) {
	local, err := s.Get(ctx, rel)
	if err != nil {
		return nil, err
	}
	return loadJSON(local)
}

// ServeHTTP 让 Store 作为 `lmt://` 协议的处理器:`/ddragon/...` 与 `/cdragon/...`。
func (s *Store) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/")
	if _, ok := remoteURL(rel); !ok {
		http.Error(w, "非法的素材路径", http.StatusBadRequest)
		return
	}
	local, err := s.Get(r.Context(), rel)
	switch {
	case errors.Is(err, ErrAssetNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	case err != nil:
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	f, err := os.Open(local)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Cache-Control", "max-age=86400")
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}

// CacheSize 返回缓存占用的字节数。
func (s *Store) CacheSize() (uint64, error) {
	var total uint64
	err := filepath.WalkDir(s.dir, func(_ string, d os.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if !d.IsDir() {
			if info, err := d.Info(); err == nil {
				total += uint64(info.Size())
			}
		}
		return nil
	})
	return total, err
}

// ClearCache 删除全部缓存。
func (s *Store) ClearCache() error {
	s.mu.Lock()
	s.missing = map[string]time.Time{}
	s.mu.Unlock()
	return os.RemoveAll(s.dir)
}
