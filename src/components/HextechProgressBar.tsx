interface Props {
  /** 进度比例 0~1 */
  ratio: number;
  /** 不确定模式(无总量,显示流动动画) */
  indeterminate?: boolean;
}

/** Hextech 金色风格进度条 */
export function HextechProgressBar({ ratio, indeterminate }: Props) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="h-3 w-full bg-hex-bg-2 border border-hex-gold-dark/50 overflow-hidden relative">
      {indeterminate ? (
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-hex-gold to-transparent animate-pulse" />
      ) : (
        <div
          className="h-full bg-gradient-to-r from-hex-gold-dark via-hex-gold to-hex-gold-light transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
