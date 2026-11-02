import { useMemo } from "react";
import { X } from "lucide-react";
import type { Catalog, TFTUnit } from "@/mygo";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUI } from "@/store/ui";
import { OptionPicker } from "./OptionPicker";
import { DEFAULT_FILTERS, TFT_DAMAGE_LABELS, TFT_ROLE_LABELS, hasTftUnitFilter, splitTftRole, tftCostKey, type Filters } from "./sections";

type TFTEntry = Catalog["tft"][number];

const ALL = "all";

/**
 * 弈子的筛选条件:费用、羁绊、定位、伤害类型、攻击距离。
 * 选项只列当前赛季弈子里实际出现的值;定位等资料来自 CommunityDragon,读到之前只显示费用。
 * 定位与伤害类型取自游戏数据里弈子的 CharacterRole,有的赛季(如 S18)大多数弈子没有,
 * 有定位的弈子不到一半时不显示这两项,免得一筛就漏掉大部分弈子。
 */
export function TftUnitFilters({
  entries,
  units,
  traitNames,
}: {
  /** 当前赛季的全部弈子(未按条件筛选) */
  entries: TFTEntry[];
  units: Record<string, TFTUnit> | undefined;
  traitNames: Map<string, string>;
}) {
  const filters = useUI((s) => s.filters);
  const setFilters = useUI((s) => s.setFilters);

  const options = useMemo(() => {
    const costs = new Set(entries.map((e) => tftCostKey(e.cost)));
    const traits = new Map<string, number>();
    const roles = new Set<string>();
    const damages = new Set<string>();
    const ranges = new Set<number>();
    let withRole = 0;
    for (const e of entries) {
      const u = units?.[e.id];
      if (!u) continue;
      for (const name of new Set((u.traits ?? []).map((id) => traitNames.get(id)).filter((n): n is string => !!n))) {
        traits.set(name, (traits.get(name) ?? 0) + 1);
      }
      const { damage, role } = splitTftRole(u.role);
      if (role) {
        roles.add(role);
        withRole++;
      }
      if (damage) damages.add(damage);
      if (u.range > 0) ranges.add(u.range);
    }
    const roleReady = withRole * 2 >= entries.length;
    return {
      costs: ["1", "2", "3", "4", "5", "other"].filter((c) => costs.has(c)),
      traits: [...traits]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .map(([name, n]) => ({ value: name, label: name, hint: String(n) })),
      roles: roleReady
        ? Object.entries(TFT_ROLE_LABELS)
            .filter(([k]) => roles.has(k))
            .map(([value, label]) => ({ value, label }))
        : [],
      damages: roleReady
        ? Object.entries(TFT_DAMAGE_LABELS)
            .filter(([k]) => damages.has(k))
            .map(([value, label]) => ({ value, label }))
        : [],
      ranges: [...ranges].sort((a, b) => a - b).map((r) => ({ value: String(r), label: `${r} 格` })),
    };
  }, [entries, units, traitNames]);

  const set = (patch: Partial<Filters>) => setFilters(patch);
  const reset = () =>
    setFilters({
      tftCost: DEFAULT_FILTERS.tftCost,
      tftTrait: DEFAULT_FILTERS.tftTrait,
      tftRole: DEFAULT_FILTERS.tftRole,
      tftDamage: DEFAULT_FILTERS.tftDamage,
      tftRange: DEFAULT_FILTERS.tftRange,
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.costs.length > 1 && (
        <ToggleGroup type="single" size="sm" variant="outline" value={filters.tftCost || ALL} onValueChange={(v) => v && set({ tftCost: v === ALL ? "" : v })}>
          <ToggleGroupItem value={ALL} className="px-2.5 text-xs">
            全部
          </ToggleGroupItem>
          {options.costs.map((c) => (
            <ToggleGroupItem key={c} value={c} className="px-2.5 text-xs">
              {c === "other" ? "其他" : `${c} 费`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {options.traits.length > 0 && (
        <OptionPicker label="羁绊" value={filters.tftTrait} options={options.traits} onChange={(v) => set({ tftTrait: v })} />
      )}
      {(options.roles.length > 0 || filters.tftRole) && (
        <OptionPicker label="定位" value={filters.tftRole} options={options.roles} onChange={(v) => set({ tftRole: v })} />
      )}
      {(options.damages.length > 0 || filters.tftDamage) && (
        <OptionPicker label="伤害" value={filters.tftDamage} options={options.damages} onChange={(v) => set({ tftDamage: v })} />
      )}
      {options.ranges.length > 1 && (
        <OptionPicker label="射程" value={filters.tftRange} options={options.ranges} onChange={(v) => set({ tftRange: v })} />
      )}
      {hasTftUnitFilter(filters) && (
        <Button size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs text-muted-foreground" onClick={reset}>
          <X className="size-3.5" /> 清除条件
        </Button>
      )}
    </div>
  );
}
