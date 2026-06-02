import { Languages, Gamepad2, FolderOpen, Loader2, FolderInput } from "lucide-react";
import { HextechProgressBar } from "../HextechProgressBar";
import type { TaskProgress } from "../../lib/api";

interface Props {
  resultDir: string | null;
  busy: boolean;
  onLolLocalize: () => void;
  onTftLocalize: () => void;
  localizedDir: string | null;
  onOpenLocalized: () => void;
  progress: TaskProgress | null;
  logs: string[];
}

/** 汉化页:数据源 + 联盟/云顶汉化 + 进度 + 日志 */
export function LocalizePanel({
  resultDir,
  busy,
  onLolLocalize,
  onTftLocalize,
  localizedDir,
  onOpenLocalized,
  progress,
  logs,
}: Props) {
  const showProgress = !!progress && busy && progress.stage === "localize";
  const ratio = progress && progress.total > 0 ? progress.current / progress.total : 0;
  const indeterminate = !!progress && progress.total === 0 && !progress.done;
  const disabled = !resultDir || busy;

  return (
    <div className="flex gap-6 h-full">
      {/* 左:操作区 */}
      <div className="flex-[3] min-w-0 space-y-5 overflow-auto pr-1">
        <h2 className="text-xl font-display font-bold text-hex-gold border-b border-hex-gold-dark/50 pb-2">
          汉化整理
        </h2>
        <p className="text-sm text-hex-gold-light">请确保已下载数据包后再继续。</p>

        {/* 汉化数据源 */}
        <div className="space-y-1">
          <label className="text-sm text-hex-gold-light">汉化数据源</label>
          <div className="flex items-center gap-2 bg-hex-panel border border-hex-gold-dark/50 px-3 py-2">
            <FolderInput size={16} className="text-hex-gold shrink-0" />
            <span className="text-sm text-hex-text-muted truncate">
              {resultDir ?? "请先在「下载」页获取数据包"}
            </span>
          </div>
        </div>

        {/* 汉化按钮 */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onLolLocalize}
            disabled={disabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-hex-blue-dark/50 border border-hex-blue text-hex-blue font-semibold hover:bg-hex-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Languages size={18} /> 联盟汉化
          </button>
          <button
            onClick={onTftLocalize}
            disabled={disabled}
            className="flex items-center gap-2 px-5 py-2.5 bg-hex-blue-dark/50 border border-hex-blue text-hex-blue font-semibold hover:bg-hex-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Gamepad2 size={18} /> 云顶汉化
          </button>
          {localizedDir && !busy && (
            <button
              onClick={onOpenLocalized}
              className="flex items-center gap-2 px-4 py-2.5 bg-hex-panel border border-hex-gold-dark/50 text-hex-gold hover:border-hex-gold transition-colors"
            >
              <FolderOpen size={16} /> 打开汉化结果
            </button>
          )}
        </div>

        {/* 进度 */}
        {showProgress && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-hex-gold-light">
              <Loader2 size={16} className="animate-spin" />
              <span>汉化中</span>
            </div>
            <HextechProgressBar ratio={ratio} indeterminate={indeterminate} />
            <div className="text-xs text-hex-text-muted truncate">{progress.message}</div>
          </div>
        )}
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
