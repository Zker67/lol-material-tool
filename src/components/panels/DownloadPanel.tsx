import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { FolderOpen, Download, X, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { HextechProgressBar } from "../HextechProgressBar";
import type { TaskProgress } from "../../lib/api";
import { formatBytes, formatSpeed, formatEta } from "../../lib/utils";

interface Props {
  versions: string[];
  version: string;
  onVersionChange: (v: string) => void;
  onRefresh: () => void;
  destDir: string;
  onPickDir: () => void;
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
  resultDir: string | null;
  onOpenResult: () => void;
  progress: TaskProgress | null;
  logs: string[];
}

/** 下载页固定的「相关链接」 */
const RELATED_LINKS = [
  { name: "素材包来源", url: "https://developer.riotgames.com/docs/lol#data-dragon" },
  { name: "国服更新公告", url: "https://lol.qq.com/gicp/news/423/2/1334/1.html" },
];

/** 下载页:赛季↔版本两级联动 + 目录选择 + 下载解压 + 进度 + 日志 */
export function DownloadPanel({
  versions,
  version,
  onVersionChange,
  onRefresh,
  destDir,
  onPickDir,
  busy,
  onStart,
  onCancel,
  resultDir,
  onOpenResult,
  progress,
  logs,
}: Props) {
  // 赛季(major)集合:由全部版本号取首段去重,数字降序
  const majors = useMemo(() => {
    const set = new Set(versions.map((v) => v.split(".")[0]));
    return [...set].sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0));
  }, [versions]);

  const [major, setMajor] = useState("");

  // 版本列表刷新后,若当前赛季失效则同步为已选版本所属赛季或最新赛季
  useEffect(() => {
    if (!majors.length) return;
    if (!majors.includes(major)) {
      const fromVersion = version ? version.split(".")[0] : "";
      setMajor(majors.includes(fromVersion) ? fromVersion : majors[0]);
    }
  }, [majors, version, major]);

  // 当前赛季下的版本号
  const filtered = useMemo(
    () => versions.filter((v) => v.startsWith(major + ".")),
    [versions, major]
  );

  const onMajorChange = (m: string) => {
    setMajor(m);
    const f = versions.filter((v) => v.startsWith(m + "."));
    if (f.length) onVersionChange(f[0]);
  };

  const showProgress =
    !!progress && busy && (progress.stage === "download" || progress.stage === "extract");
  const ratio = progress && progress.total > 0 ? progress.current / progress.total : 0;
  const indeterminate = !!progress && progress.total === 0 && !progress.done;
  const stageLabel = progress?.stage === "extract" ? "解压中" : "下载中";

  return (
    <div className="flex gap-6 h-full">
      {/* 左:操作区 */}
      <div className="flex-[3] min-w-0 space-y-5 overflow-auto pr-1">
        <h2 className="text-xl font-display font-bold text-hex-gold border-b border-hex-gold-dark/50 pb-2">
          素材获取
        </h2>

        {/* 赛季 ↔ 版本号 两级联动 */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-hex-gold-light">赛季</span>
          <select
            value={major}
            disabled={busy || majors.length === 0}
            onChange={(e) => onMajorChange(e.target.value)}
            className="bg-hex-panel border border-hex-gold-dark/50 px-3 py-2 text-sm text-hex-text focus:border-hex-gold outline-none disabled:opacity-50"
          >
            {majors.length === 0 && <option>—</option>}
            {majors.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-sm text-hex-gold-light">版本号</span>
          <select
            value={version}
            disabled={busy || filtered.length === 0}
            onChange={(e) => onVersionChange(e.target.value)}
            className="bg-hex-panel border border-hex-gold-dark/50 px-3 py-2 text-sm text-hex-text focus:border-hex-gold outline-none disabled:opacity-50 min-w-[8rem]"
          >
            {filtered.length === 0 && <option>加载中…</option>}
            {filtered.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={onRefresh}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-hex-blue-dark/40 border border-hex-blue/40 text-hex-blue hover:bg-hex-blue-dark/70 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} /> 刷新版本列表
          </button>
        </div>

        {/* 保存目录 */}
        <div className="space-y-2">
          <label className="text-sm text-hex-gold-light">目标目录</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={destDir}
              placeholder="点击右侧按钮选择…"
              className="flex-1 bg-hex-panel border border-hex-gold-dark/50 px-3 py-2 text-sm text-hex-text-muted outline-none"
            />
            <button
              onClick={onPickDir}
              disabled={busy}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-hex-blue-dark/40 border border-hex-blue/40 text-hex-blue hover:bg-hex-blue-dark/70 transition-colors disabled:opacity-50"
            >
              <FolderOpen size={16} /> 选择
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {!busy ? (
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 bg-hex-gold-dark/60 border border-hex-gold text-hex-gold-light font-semibold hover:bg-hex-gold-dark transition-colors"
            >
              <Download size={18} /> 获取数据包
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-900/50 border border-red-500/60 text-red-200 font-semibold hover:bg-red-900/80 transition-colors"
            >
              <X size={18} /> 取消
            </button>
          )}
          {resultDir && !busy && (
            <button
              onClick={onOpenResult}
              className="flex items-center gap-2 px-4 py-2.5 bg-hex-panel border border-hex-gold-dark/50 text-hex-gold hover:border-hex-gold transition-colors"
            >
              <FolderOpen size={16} /> 打开数据包
            </button>
          )}
        </div>

        {/* 进度 */}
        {showProgress && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-hex-gold-light">
              <Loader2 size={16} className="animate-spin" />
              <span>{stageLabel}</span>
            </div>
            <HextechProgressBar ratio={ratio} indeterminate={indeterminate} />
            <div className="flex justify-between text-xs text-hex-text-muted">
              <span className="truncate pr-2">{progress.message}</span>
              <span className="shrink-0">
                {progress.stage === "download" && progress.total > 0 && (
                  <>
                    {formatBytes(progress.current)} / {formatBytes(progress.total)}
                    {progress.speed ? ` · ${formatSpeed(progress.speed)}` : ""}
                    {progress.eta != null ? ` · 剩 ${formatEta(progress.eta)}` : ""}
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        {/* 相关链接 */}
        <div className="space-y-2 pt-2">
          <div className="text-sm font-semibold text-hex-gold">相关链接</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {RELATED_LINKS.map((l) => (
              <button
                key={l.url}
                onClick={() => openUrl(l.url)}
                className="text-hex-blue hover:text-hex-blue-light underline underline-offset-2 inline-flex items-center gap-1"
              >
                <ExternalLink size={13} /> {l.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右:实时日志 */}
      <div className="flex-[2] min-w-0 flex flex-col">
        <div className="text-sm font-semibold text-hex-gold mb-2">实时日志</div>
        <div className="flex-1 overflow-auto bg-hex-bg-2 border border-hex-gold-dark/30 p-3 text-xs font-mono text-hex-text-muted space-y-0.5">
          {logs.length === 0 ? (
            <div className="opacity-50">暂无日志</div>
          ) : (
            logs.map((l, i) => <div key={i}>{l}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
