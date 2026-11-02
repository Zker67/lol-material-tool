import { Languages, Gamepad2, FolderOpen, Loader2, FolderInput } from "lucide-react";
import { HextechProgressBar } from "../HextechProgressBar";
import type { TaskProgress } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Field, LogPanel, PanelTitle } from "./PanelParts";

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
    <div className="flex h-full gap-6">
      {/* 左:操作区 */}
      <div className="min-w-0 flex-3 space-y-6 overflow-auto pr-1">
        <PanelTitle>汉化整理</PanelTitle>

        {/* 汉化数据源 */}
        <Field label="数据包">
          <div className="flex h-8 items-center gap-2 border border-hex-gold-dark/50 bg-hex-bg-2/60 px-2.5">
            <FolderInput className="size-4 shrink-0 text-hex-gold" />
            <span className={resultDir ? "truncate text-sm text-hex-gold-light/90 select-text" : "truncate text-sm text-hex-text-muted"}>
              {resultDir ?? "先在「整包下载」获取数据包"}
            </span>
          </div>
        </Field>

        {/* 汉化按钮 */}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="h-10 px-6 text-base" onClick={onLolLocalize} disabled={disabled}>
            <Languages className="size-4.5" /> 联盟汉化
          </Button>
          <Button size="lg" className="h-10 px-6 text-base" onClick={onTftLocalize} disabled={disabled}>
            <Gamepad2 className="size-4.5" /> 云顶汉化
          </Button>
          {localizedDir && !busy && (
            <Button size="lg" variant="outline" className="h-10" onClick={onOpenLocalized}>
              <FolderOpen /> 打开汉化结果
            </Button>
          )}
        </div>

        {/* 进度 */}
        {showProgress && progress && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-hex-gold-light">
              <Loader2 className="size-4 animate-spin" />
              <span>汉化中</span>
            </div>
            <HextechProgressBar ratio={ratio} indeterminate={indeterminate} />
            <div className="truncate text-xs text-hex-text-muted">{progress.message}</div>
          </div>
        )}
      </div>

      {/* 右:实时日志 */}
      <LogPanel logs={logs} />
    </div>
  );
}
