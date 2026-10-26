package material

import (
	"context"
	"errors"
)

// Stage 是任务所处的阶段。
type Stage string

const (
	StageDownload Stage = "download"
	StageExtract  Stage = "extract"
	StageLocalize Stage = "localize"
	StageExport   Stage = "export"
)

// Progress 是推送到前端的任务进度。
type Progress struct {
	// Stage 是当前阶段。
	Stage Stage `json:"stage"`
	// Current 是当前进度(下载阶段为字节数,解压阶段为已处理条目数)。
	Current uint64 `json:"current"`
	// Total 是总量(下载阶段为总字节;解压阶段总数未知时为 0)。
	Total uint64 `json:"total"`
	// Speed 是下载速度(字节/秒),仅下载阶段有意义。
	Speed *float64 `json:"speed"`
	// Eta 是预计剩余秒数。
	Eta *float64 `json:"eta"`
	// Message 是人类可读的状态文本。
	Message string `json:"message"`
	// Done 表示该阶段是否已完成。
	Done bool `json:"done"`
}

// ProgressFunc 接收任务进度,可为 nil。
type ProgressFunc func(Progress)

func (f ProgressFunc) emit(p Progress) {
	if f != nil {
		f(p)
	}
}

// ErrCanceled 是任务被取消时返回的错误。
var ErrCanceled = errors.New("已取消")

// checkCancel 在 ctx 已取消时返回 ErrCanceled。
func checkCancel(ctx context.Context) error {
	if ctx.Err() != nil {
		return ErrCanceled
	}
	return nil
}

func ptr(v float64) *float64 { return &v }
