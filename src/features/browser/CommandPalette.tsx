import { useEffect, useMemo, useState } from "react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { matches, useCatalog, useTFTSeasons } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useUI, type Section, type Selection } from "@/store/ui";
import { AssetImage } from "./AssetImage";
import type { Catalog } from "@/mygo";
import { championFullName, effectiveSeason, seasonFilter, seasonOptions, skinKey, TFT_FACE_CROP, tftKey } from "./sections";

interface Hit {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  section: Section;
  selection: Selection;
  /** 云顶条目本身,跳转时判断是否在当前赛季 */
  tft?: Catalog["tft"][number];
}

const LIMIT = 8;

/** Ctrl+K:跨英雄、皮肤、装备、符文、云顶搜索并跳转 */
export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const version = useUI((s) => s.version);
  const setSection = useUI((s) => s.setSection);
  const select = useUI((s) => s.select);
  const setFilters = useUI((s) => s.setFilters);
  const { data: cat } = useCatalog(version);
  const seasons = useTFTSeasons(version, open);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const groups = useMemo(() => {
    if (!cat || !query.trim()) return [];
    const champions: Hit[] = [];
    const skins: Hit[] = [];
    for (const c of cat.champions) {
      if (champions.length < LIMIT && matches(query, c.name, c.title, c.id))
        champions.push({ key: `c-${c.id}`, title: championFullName(c), subtitle: "", icon: c.icon, section: "champions", selection: { kind: "champion", id: c.id } });
      for (const s of c.skins) {
        if (skins.length >= LIMIT || s.parent != null || !matches(query, s.name)) continue;
        const id = skinKey(c, s);
        skins.push({ key: `s-${id}`, title: s.name, subtitle: championFullName(c), icon: s.tile, section: "champions", selection: { kind: "champion", id: c.id, skinId: id } });
      }
    }
    const items = cat.items
      .filter((it) => it.inStore && matches(query, it.name, it.id))
      .slice(0, LIMIT)
      .map<Hit>((it) => ({ key: `i-${it.id}`, title: it.name, subtitle: it.gold ? `${it.gold} 金币` : "", icon: it.icon, section: "items", selection: { kind: "item", id: it.id } }));
    const runes = cat.runeStyles
      .flatMap((st) => st.runes.map((r) => ({ r, st })))
      .filter(({ r }) => matches(query, r.name))
      .slice(0, LIMIT)
      .map<Hit>(({ r, st }) => ({ key: `r-${r.id}`, title: r.name, subtitle: st.name, icon: r.icon, section: "runes", selection: { kind: "rune", id: r.id } }));
    const tft = cat.tft
      .filter((e) => matches(query, e.name))
      .slice(0, LIMIT)
      .map<Hit>((e) => ({
        key: `t-${tftKey(e)}`,
        title: e.name,
        subtitle: [e.category, e.set && `S${e.set}`].filter(Boolean).join(" · "),
        icon: e.icon,
        section: "tft",
        selection: { kind: "tft", id: tftKey(e), category: e.category },
        tft: e,
      }));
    return [
      { title: "英雄", hits: champions },
      { title: "皮肤", hits: skins },
      { title: "装备", hits: items },
      { title: "符文", hits: runes },
      { title: "云顶之弈", hits: tft },
    ].filter((g) => g.hits.length > 0);
  }, [cat, query]);

  const go = (h: Hit) => {
    setSection(h.section);
    if (h.selection?.kind === "tft" && h.tft && cat) {
      // 赛季各分类共用;目标不在当前赛季时切到全部,免得网格里找不到它
      const season = effectiveSeason(useUI.getState().filters.tftSet, seasonOptions(cat, seasons.data));
      setFilters(seasonFilter(season, seasons.data)(h.tft) ? { tftCategory: h.selection.category } : { tftCategory: h.selection.category, tftSet: "" });
    }
    select(h.selection);
    setOpen(false);
    setQuery("");
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="搜索素材" description="搜索英雄、皮肤、装备、符文与云顶素材">
      {/* 结果已由 groups 筛好,关掉 cmdk 自带的按 value 过滤 */}
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder={`在 ${version ?? ""} 中搜索英雄、皮肤、装备…`} />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>{query.trim() ? "没有找到" : "输入名称、称号或英文名"}</CommandEmpty>
          {groups.map((g) => (
            <CommandGroup key={g.title} heading={g.title}>
              {g.hits.map((h) => (
                <CommandItem key={h.key} value={h.key} onSelect={() => go(h)} className="gap-2.5">
                  <AssetImage
                    path={h.icon}
                    alt={h.title}
                    className={cn("size-7 shrink-0 rounded-sm", h.selection?.kind === "tft" && h.selection.category === "弈子" && TFT_FACE_CROP)}
                  />
                  <span className="truncate">{h.title}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{h.subtitle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
