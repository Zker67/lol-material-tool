import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

/** 单个 tab 定义 */
export interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface Props {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}

/** 顶部 tab 切换栏(Hextech 金色下划线高亮当前页) */
export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex shrink-0 border-b border-hex-gold-dark/40 bg-hex-bg-2/40 px-2">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 text-sm font-display font-semibold tracking-wide transition-colors border-b-2 -mb-px",
              isActive
                ? "text-hex-gold border-hex-gold"
                : "text-hex-text-muted border-transparent hover:text-hex-gold-light"
            )}
          >
            <Icon size={16} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
