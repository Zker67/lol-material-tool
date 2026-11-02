import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AssetImage } from "./AssetImage";
import { DIFF_BADGE, type GridEntry } from "./AssetGrid";
import type { RuneTreeRow } from "./sections";

/** 各符文系在游戏里的主题色,按符文系 ID */
const STYLE_COLORS: Record<string, string> = {
  "8000": "#c8aa6e", // 精密
  "8100": "#d44242", // 主宰
  "8200": "#9faafc", // 巫术
  "8300": "#49aab9", // 启迪
  "8400": "#a1d586", // 坚决
};

export const runeStyleColor = (styleId: string) => STYLE_COLORS[styleId] ?? "#c8aa6e";

/** 透明度混色,用于按符文系主题色画线和光晕 */
const mix = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

function RuneNode({ entry, keystone, color, selected, onSelect }: { entry: GridEntry; keystone: boolean; color: string; selected: boolean; onSelect: () => void }) {
  const badge = entry.diff ? DIFF_BADGE[entry.diff] : null;
  const ring: CSSProperties | undefined = selected ? { boxShadow: `0 0 0 2px ${color}, 0 0 14px ${mix(color, 60)}` } : undefined;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.previousName ? `原名:${entry.previousName}` : entry.title}
      className={cn("group relative flex max-w-16 min-w-0 flex-1 flex-col items-center gap-1", entry.diff === "removed" && "opacity-50")}
    >
      <span
        style={ring}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full bg-hex-bg transition-all",
          keystone ? "size-14" : "size-10 p-0.5 ring-1 ring-white/10",
          !selected && "opacity-75 grayscale-[35%] group-hover:opacity-100 group-hover:grayscale-0",
        )}
      >
        <AssetImage path={entry.image} alt={entry.title} fit="contain" className="size-full rounded-full bg-transparent" />
      </span>
      {badge && (
        <span className={cn("absolute -top-1 left-1/2 -translate-x-1/2 rounded-sm px-1 text-[9px] leading-tight font-bold", badge.className)}>{badge.label}</span>
      )}
      <span className={cn("line-clamp-2 text-center text-[10px] leading-tight", selected ? "text-hex-gold-light" : "text-muted-foreground group-hover:text-foreground")}>
        {entry.title}
      </span>
    </button>
  );
}

/** 像游戏里一样的符文树:符文系在顶部,下面依次是基石行和三行小符文,一条竖线贯穿 */
export function RuneTree({
  styleId,
  title,
  icon,
  rows,
  selectedId,
  onSelect,
  extra,
}: {
  styleId: string;
  title: string;
  icon: string;
  rows: RuneTreeRow[];
  selectedId?: string;
  onSelect: (e: GridEntry) => void;
  /** 标题行右侧的操作 */
  extra?: ReactNode;
}) {
  const color = runeStyleColor(styleId);
  return (
    <div
      className="rounded-lg border bg-hex-bg-2/40 p-3"
      style={{ borderColor: mix(color, 30), backgroundImage: `linear-gradient(to bottom, ${mix(color, 12)}, transparent 40%)` }}
    >
      <div className="flex items-center gap-2">
        <AssetImage path={icon} alt={title} fit="contain" className="size-8 shrink-0 bg-transparent" />
        <span className="font-heading text-base font-semibold tracking-wider" style={{ color }}>
          {title}
        </span>
        <span className="ml-auto">{extra}</span>
      </div>
      <div className="relative mt-3 space-y-3">
        {/* 贯穿各行的竖线,画在图标后面 */}
        <span className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2" style={{ background: mix(color, 35) }} />
        {rows.map((row) => (
          <div key={row.slot} className={cn("relative flex justify-center gap-2", row.slot === 0 && "pb-2")}>
            {row.entries.map((e) => (
              <RuneNode key={e.id} entry={e} keystone={row.slot === 0} color={color} selected={e.id === selectedId} onSelect={() => onSelect(e)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 中间栏选择符文系的卡片:图标、名称、基石预览,有版本差异时标出数量 */
export function RuneStyleCard({
  styleId,
  title,
  icon,
  rows,
  active,
  onSelect,
}: {
  styleId: string;
  title: string;
  icon: string;
  rows: RuneTreeRow[];
  active: boolean;
  onSelect: () => void;
}) {
  const color = runeStyleColor(styleId);
  const entries = rows.flatMap((r) => r.entries);
  const keystones = rows.find((r) => r.slot === 0)?.entries ?? [];
  const diffs = (["added", "renamed", "removed"] as const).map((d) => ({ d, n: entries.filter((e) => e.diff === d).length })).filter((x) => x.n > 0);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-lg border p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        borderColor: mix(color, active ? 80 : 25),
        backgroundImage: `linear-gradient(135deg, ${mix(color, active ? 22 : 10)}, transparent 60%)`,
        boxShadow: active ? `0 0 18px ${mix(color, 30)}` : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <AssetImage path={icon} alt={title} fit="contain" className="size-12 shrink-0 bg-transparent" />
        <div className="min-w-0">
          <div className="font-heading text-lg font-bold tracking-wider" style={{ color }}>
            {title}
          </div>
          <div className="text-[11px] text-muted-foreground">{entries.length} 个符文</div>
        </div>
      </div>
      {keystones.length > 0 && (
        <div className="flex gap-1.5">
          {keystones.map((k) => (
            <AssetImage key={k.id} path={k.image} alt={k.title} fit="contain" className="size-9 rounded-full bg-hex-bg/60" />
          ))}
        </div>
      )}
      {diffs.length > 0 && (
        <div className="flex gap-1">
          {diffs.map(({ d, n }) => (
            <span key={d} className={cn("rounded-sm px-1.5 py-0.5 text-[10px] font-bold", DIFF_BADGE[d].className)}>
              {DIFF_BADGE[d].label} {n}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
