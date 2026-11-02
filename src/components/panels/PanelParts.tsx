import type { ReactNode } from "react";

/** 工具页标题:金色金属字 + 下方淡出的青铜线 */
export function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="hex-title font-heading text-2xl font-bold">{children}</h2>
      <div className="hex-rule" />
    </div>
  );
}

/** 表单项:上方小标题,下方控件 */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-hex-gold-light/80">{label}</div>
      {children}
    </div>
  );
}

/** 右侧实时日志:深色等宽文字面板,最新一条高亮 */
export function LogPanel({ logs }: { logs: string[] }) {
  return (
    <div className="flex min-w-0 flex-2 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold text-hex-gold">实时日志</span>
        {logs.length > 0 && <span className="text-[11px] text-muted-foreground">{logs.length} 条</span>}
      </div>
      <div className="flex-1 space-y-1 overflow-auto border border-hex-gold-dark/40 bg-hex-bg-2/70 p-3 font-mono text-xs text-hex-text-muted shadow-[inset_0_2px_12px_rgb(0_0_0/0.45)] select-text">
        {logs.length === 0 ? (
          <div className="text-muted-foreground/50">开始任务后,进度和结果会显示在这里</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className={i === logs.length - 1 ? "text-hex-gold-light" : undefined}>
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
