import { useEffect, useRef, useState, type CSSProperties } from "react";
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

const DIFF_BADGE: Record<DiffState, { label: string; className: string }> = {
  added: { label: "新增", className: "bg-hex-blue/90 text-hex-bg" },
  renamed: { label: "改名", className: "bg-hex-gold/90 text-hex-bg" },
  removed: { label: "移除", className: "bg-destructive/90 text-white" },
};

const GAP = 10;
/** 卡片标题区高度(与 AssetTile 的 h-[42px] 一致)+ 上下边框 */
const CAPTION = 42 + 2;

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
 */
export function AssetGrid({
  entries,
  tileWidth,
  aspect,
  selectedId,
  onSelect,
  fit,
  empty,
}: {
  entries: GridEntry[];
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
  const rows = Math.ceil(entries.length / columns);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 4,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, columns, virtualizer]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 pt-3 pb-4">
      {entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{empty ?? "没有符合条件的素材"}</div>
      ) : (
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((row) => (
            <div
              key={row.key}
              className="absolute left-0 grid w-full"
              style={{
                top: row.start,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                columnGap: GAP,
              }}
            >
              {entries.slice(row.index * columns, row.index * columns + columns).map((e) => (
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
          ))}
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
