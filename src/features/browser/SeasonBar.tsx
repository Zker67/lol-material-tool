import { useId } from "react";
import { Loader2 } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { SeasonOption } from "./sections";

/** 一个赛季按钮:赛季号用大号金色渐变字;选中的金边发光底板在赛季之间滑动 */
function SeasonChip({
  number,
  name,
  badge,
  active,
  dim,
  onClick,
}: {
  number: string;
  name?: string;
  badge?: string;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative isolate flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1 transition-colors duration-200",
        active
          ? "border-transparent text-hex-gold-light"
          : "border-hex-gold-dark/50 bg-hex-bg-2/60 text-muted-foreground hover:border-hex-gold/60 hover:text-hex-gold-light",
        dim && "opacity-45",
      )}
    >
      {active && (
        <motion.span
          layoutId="season-active"
          className="pointer-events-none absolute -inset-px -z-10 overflow-hidden rounded-md border border-hex-gold bg-linear-to-b from-hex-gold/25 via-hex-gold/10 to-hex-bg-2/80 shadow-[0_0_14px_rgb(200_170_110/0.35),inset_0_1px_0_rgb(240_230_210/0.25)]"
        >
          <span className="absolute inset-x-2 bottom-0 h-px bg-linear-to-r from-transparent via-hex-gold-light to-transparent" />
        </motion.span>
      )}
      <span
        className={cn(
          "font-display text-lg leading-none font-bold tracking-wide",
          active ? "bg-linear-to-b from-hex-gold-light to-hex-gold bg-clip-text text-transparent" : "text-hex-gold/70",
        )}
      >
        {number}
      </span>
      {name && <span className="text-xs">{name}</span>}
      {badge && <span className="rounded-sm bg-hex-blue/15 px-1 text-[9px] leading-4 text-hex-blue">{badge}</span>}
    </button>
  );
}

/**
 * 云顶工具栏顶部的赛季条:所选赛季在各分类间共用,切换分类不重置。
 * 不分赛季的分类(小小英雄等)整条变暗并注明。
 */
export function SeasonBar({
  options,
  value,
  onChange,
  category,
  seasonal,
  loading,
}: {
  options: SeasonOption[];
  /** 生效的赛季,"" 为全部 */
  value: string;
  onChange: (season: string) => void;
  category: string;
  seasonal: boolean;
  loading: boolean;
}) {
  const groupId = useId();
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 font-heading text-xs font-semibold tracking-[0.3em] text-hex-gold/80">赛季</span>
      <LayoutGroup id={groupId}>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto px-px py-1">
          {options.map((o) => (
            <SeasonChip
              key={o.number}
              number={`S${o.number}`}
              name={o.name}
              badge={o.isDefault ? "当前" : undefined}
              active={value === o.number}
              dim={!seasonal}
              onClick={() => onChange(o.number)}
            />
          ))}
          <SeasonChip number="全部" active={value === ""} dim={!seasonal} onClick={() => onChange("")} />
        </div>
      </LayoutGroup>
      {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
      {!seasonal && <span className="shrink-0 text-[11px] text-muted-foreground">{category}不分赛季</span>}
    </div>
  );
}
