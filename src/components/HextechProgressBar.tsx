interface Props {
  /** 进度比例 0~1 */
  ratio: number;
  /** 不确定模式(无总量,显示流动动画) */
  indeterminate?: boolean;
}

/** Hextech 金色风格进度条:青铜细框,金色填充前端带一点亮光;不确定时一道光带循环扫过 */
export function HextechProgressBar({ ratio, indeterminate }: Props) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="relative h-2.5 w-full overflow-hidden border border-hex-gold-dark/60 bg-hex-bg-2 p-px">
      {indeterminate ? (
        <div className="hex-sweep absolute inset-y-px left-0 w-1/3 bg-linear-to-r from-transparent via-hex-gold to-transparent" />
      ) : (
        <div
          className="relative h-full bg-linear-to-r from-hex-gold-dark via-hex-gold to-hex-gold-light transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        >
          {pct > 0 && pct < 100 && (
            <span className="absolute inset-y-0 right-0 w-1 bg-white/90 shadow-[0_0_8px_2px_rgb(240_230_210/0.7)]" />
          )}
        </div>
      )}
    </div>
  );
}
