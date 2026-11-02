import { useEffect, useMemo, useState } from "react";
import { openUrl } from "../../lib/api";
import { FolderOpen, Download, X, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { HextechProgressBar } from "../HextechProgressBar";
import { Favicon } from "../Favicon";
import type { TaskProgress } from "../../lib/api";
import type { PackInfo } from "../../mygo";
import { formatBytes, formatSpeed, formatEta } from "../../lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, LogPanel, PanelTitle } from "./PanelParts";

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
  /** 选中版本的全量包:undefined 检查中,null 检查失败 */
  packInfo: PackInfo | null | undefined;
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
  packInfo,
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
    <div className="flex h-full gap-6">
      {/* 左:操作区 */}
      <div className="min-w-0 flex-3 space-y-6 overflow-auto pr-1">
        <PanelTitle>整包下载</PanelTitle>

        {/* 赛季 ↔ 版本号 两级联动 */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="赛季">
              <Select value={major} disabled={busy || majors.length === 0} onValueChange={onMajorChange}>
                <SelectTrigger className="w-24 font-display text-base">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {majors.map((m) => (
                    <SelectItem key={m} value={m} className="font-display">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="版本号">
              <Select value={version} disabled={busy || filtered.length === 0} onValueChange={onVersionChange}>
                <SelectTrigger className="w-36 font-display text-base">
                  <SelectValue placeholder="加载中…" />
                </SelectTrigger>
                <SelectContent>
                  {filtered.map((v) => (
                    <SelectItem key={v} value={v} className="font-display">
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button variant="outline" onClick={onRefresh} disabled={busy}>
              <RefreshCw /> 刷新版本列表
            </Button>
          </div>

          {/* 全量包大小 / 是否提供 */}
          <div className="text-xs">
            {packInfo === undefined && <span className="text-hex-text-muted">正在检查数据包…</span>}
            {packInfo?.available && (
              <span className="text-hex-text-muted">
                全量包约 <span className="font-display text-sm font-semibold text-hex-gold-light">{formatBytes(packInfo.size)}</span>
              </span>
            )}
            {packInfo && !packInfo.available && <span className="text-destructive">官方未提供该版本的全量包,可换一个版本,或在「素材浏览」中在线查看</span>}
          </div>
        </div>

        {/* 保存目录 */}
        <Field label="保存到">
          <div className="flex gap-2">
            <Input readOnly value={destDir} placeholder="选择一个文件夹" className="flex-1 text-hex-text-muted select-text" />
            <Button variant="outline" onClick={onPickDir} disabled={busy}>
              <FolderOpen /> 选择
            </Button>
          </div>
        </Field>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {!busy ? (
            <Button size="lg" className="h-10 px-6 text-base" onClick={onStart} disabled={!!packInfo && !packInfo.available}>
              <Download className="size-4.5" /> 获取数据包
            </Button>
          ) : (
            <Button size="lg" variant="destructive" className="h-10 px-6 text-base" onClick={onCancel}>
              <X className="size-4.5" /> 取消
            </Button>
          )}
          {resultDir && !busy && (
            <Button size="lg" variant="outline" className="h-10" onClick={onOpenResult}>
              <FolderOpen /> 打开数据包
            </Button>
          )}
        </div>

        {/* 进度 */}
        {showProgress && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-hex-gold-light">
              <Loader2 className="size-4 animate-spin" />
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

        {/* 相关链接(与导航页一致的图标卡片) */}
        <div className="space-y-2 pt-2">
          <div className="font-heading text-sm font-semibold text-hex-gold">相关链接</div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {RELATED_LINKS.map((l) => (
              <button
                key={l.url}
                onClick={() => openUrl(l.url)}
                className="group flex cursor-pointer items-center gap-3 border border-hex-gold-dark/30 bg-hex-bg-2/40 p-3 text-left transition-colors hover:border-hex-gold/60 hover:bg-hex-gold-dark/10"
              >
                <Favicon url={l.url} name={l.name} />
                <span className="min-w-0 flex-1 text-sm font-medium wrap-break-word text-hex-gold-light transition-colors group-hover:text-hex-gold">
                  {l.name}
                </span>
                <ExternalLink className="ml-1 h-3.5 w-3.5 text-hex-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 右:实时日志 */}
      <LogPanel logs={logs} />
    </div>
  );
}
