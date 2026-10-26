import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import type { DiffState } from "@/lib/assets";
import { AssetImage } from "./AssetImage";

/** 网格里的一格 */
export interface GridEntry {
  id: string;
  title: string;
  subtitle?: string;
  image: string;
  diff?: DiffState;
  /** 改名前的名称 */
  previousName?: string;
}

/** 网格中的一组(如某位英雄的皮肤),组标题可点击 */
export interface GridGroup {
  key: string;
  title: string;
  subtitle?: string;
  icon?: string;
  entries: GridEntry[];
}

const DIFF_BADGE: Record<DiffState, { label: string; className: string }> = {
  added: { label: "新增", className: "bg-hex-blue/90 text-hex-bg" },
  renamed: { label: "改名", className: "bg-hex-gold/90 text-hex-bg" },
  removed: { label: "移除", className: "bg-destructive/90 text-white" },
};

const GAP = 10;
/** 卡片标题区高度(与 AssetTile 的 h-[42px] 一致)+ 上下边框 */
const CAPTION = 42 + 2;
/** 分组标题行高度 */
const HEADER = 44;

type Row = { kind: "header"; group: GridGroup } | { kind: "tiles"; entries: GridEntry[] };

/** 一格素材卡片 */
export function AssetTile({
  entry,
  imageStyle,
  selected,
  onSelect,
  fit,
}: {
  entry: GridEntry;
  imageStyle: CSSProperties;
  selected: boolean;
  onSelect: () => void;
  fit?: "cover" | "contain";
}) {
  const badge = entry.diff ? DIFF_BADGE[entry.diff] : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      title={entry.previousName ? `原名:${entry.previousName}` : entry.title}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-md border bg-card text-left transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-hex-gold/70 hover:shadow-[0_0_14px_rgb(200_170_110/0.25)]",
        selected ? "border-hex-blue shadow-[0_0_16px_rgb(10_200_185/0.35)]" : "border-border",
        entry.diff === "removed" && "opacity-55",
      )}
    >
      <AssetImage path={entry.image} alt={entry.title} fit={fit} className="w-full" style={imageStyle} />
      {badge && (
        <span className={cn("absolute top-1.5 left-1.5 rounded-sm px-1.5 py-0.5 text-[10px] font-bold", badge.className)}>
          {badge.label}
        </span>
      )}
      <div className="flex h-[42px] flex-col justify-center px-2">
        <span className="truncate text-sm font-semibold text-hex-gold-light group-hover:text-hex-gold">{entry.title}</span>
        {entry.subtitle && <span className="truncate text-[11px] text-muted-foreground">{entry.subtitle}</span>}
      </div>
    </button>
  );
}

/**
 * 虚拟滚动的素材网格:按容器宽度排列列数,只渲染可见的行。
 * aspect 是图片高宽比(1 为方形,1.82 为加载图竖图)。
 * 传入 groups 时按组显示,每组前有一行标题(entries 只用于判断是否为空)。
 */
export function AssetGrid({
  entries,
  groups,
  onGroupClick,
  activeGroup,
  tileWidth,
  aspect,
  selectedId,
  onSelect,
  fit,
  empty,
}: {
  entries: GridEntry[];
  groups?: GridGroup[];
  onGroupClick?: (g: GridGroup) => void;
  activeGroup?: string;
  tileWidth: number;
  aspect: number;
  selectedId?: string;
  onSelect: (e: GridEntry) => void;
  fit?: "cover" | "contain";
  empty?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inner = Math.max(width - 2 * 16, 0);
  const columns = Math.max(1, Math.floor((inner + GAP) / (tileWidth + GAP)));
  const cell = columns > 0 ? (inner - GAP * (columns - 1)) / columns : tileWidth;
  const rowHeight = cell * aspect + CAPTION + GAP;

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups ?? [{ key: "", title: "", entries }]) {
      if (groups) out.push({ kind: "header", group: g });
      for (let i = 0; i < g.entries.length; i += columns) out.push({ kind: "tiles", entries: g.entries.slice(i, i + columns) });
    }
    return out;
  }, [groups, entries, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i].kind === "header" ? HEADER : rowHeight),
    overscan: 4,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, rows, virtualizer]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 pt-3 pb-4">
      {entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{empty ?? "没有符合条件的素材"}</div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((vr) => {
            const row = rows[vr.index];
            if (row.kind === "header") {
              const g = row.group;
              return (
                <button
                  key={vr.key}
                  type="button"
                  onClick={() => onGroupClick?.(g)}
                  className={cn(
                    "group absolute left-0 flex w-full items-center gap-2.5 border-b border-border pb-1.5 text-left",
                    g.key === activeGroup && "border-hex-blue/60",
                  )}
                  style={{ top: vr.start, height: HEADER - 8 }}
                >
                  {g.icon && <AssetImage path={g.icon} alt={g.title} className="size-8 shrink-0 rounded-sm border border-hex-gold-dark" />}
                  <span className="font-heading text-sm font-semibold text-hex-gold group-hover:text-hex-gold-light">{g.title}</span>
                  {g.subtitle && <span className="truncate text-xs text-muted-foreground">{g.subtitle}</span>}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{g.entries.length} 款</span>
                </button>
              );
            }
            return (
            <div
              key={vr.key}
              className="absolute left-0 grid w-full"
              style={{
                top: vr.start,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                columnGap: GAP,
              }}
            >
              {row.entries.map((e) => (
                <AssetTile
                  key={e.id}
                  entry={e}
                  imageStyle={{ height: cell * aspect }}
                  fit={fit}
                  selected={e.id === selectedId}
                  onSelect={() => onSelect(e)}
                />
              ))}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** 不需要虚拟滚动的小网格(符文等),宽度自适应 */
export function SimpleGrid({
  entries,
  tileWidth,
  selectedId,
  onSelect,
}: {
  entries: GridEntry[];
  tileWidth: number;
  selectedId?: string;
  onSelect: (e: GridEntry) => void;
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileWidth}px, 1fr))` }}>
      {entries.map((e) => (
        <AssetTile
          key={e.id}
          entry={e}
          imageStyle={{ aspectRatio: "1 / 1" }}
          fit="contain"
          selected={e.id === selectedId}
          onSelect={() => onSelect(e)}
        />
      ))}
    </div>
  );
}
