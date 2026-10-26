import { useEffect, useMemo } from "react";
import { FolderDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HextechProgressBar } from "@/components/HextechProgressBar";
import { cancelTask, errorMessage, type TaskProgress } from "@/lib/api";
import { useCatalog, useVersions } from "@/lib/assets";
import { useUI, type DiffFilter, type Section } from "@/store/ui";
import { AssetGrid, SimpleGrid, type GridEntry, type GridGroup } from "./AssetGrid";
import { DetailPanel, exportTo } from "./DetailPanel";
import { VersionPicker } from "./VersionPicker";
import type { Champion } from "@/mygo";
import { ChampionPicker } from "./ChampionPicker";
import {
  ITEM_TAGS,
  ROLE_LABELS,
  TFT_CATEGORIES,
  championsSection,
  itemsSection,
  runesSection,
  skinKey,
  skinsSection,
  summonersSection,
  tftSection,
  tftSets,
  type RuneGroup,
  type SectionResult,
} from "./sections";

const TITLES: Partial<Record<Section, string>> = {
  champions: "英雄",
  skins: "皮肤",
  items: "装备",
  runes: "符文",
  summoners: "召唤师技能",
  tft: "云顶之弈",
};

/** 筛选控件旁的小标签 */
function FilterLabel({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function SectionFilters({ section, tftSetOptions, champions }: { section: Section; tftSetOptions: string[]; champions: Champion[] }) {
  const filters = useUI((s) => s.filters);
  const setFilters = useUI((s) => s.setFilters);
  const historyArt = useUI((s) => s.historyArt);
  const setHistoryArt = useUI((s) => s.setHistoryArt);

  if (section === "champions")
    return (
      <ToggleGroup type="single" size="sm" variant="outline" value={filters.role || "all"} onValueChange={(v) => v && setFilters({ role: v === "all" ? "" : v })}>
        <ToggleGroupItem value="all" className="px-2.5 text-xs">全部</ToggleGroupItem>
        {Object.entries(ROLE_LABELS).map(([k, label]) => (
          <ToggleGroupItem key={k} value={k} className="px-2.5 text-xs">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  if (section === "skins")
    return (
      <div className="flex items-center gap-3">
        <ChampionPicker champions={champions} value={filters.skinChampion} onChange={(id) => setFilters({ skinChampion: id })} />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          详情显示该版本历史原画 <Switch checked={historyArt} onCheckedChange={setHistoryArt} className="scale-90" />
        </label>
      </div>
    );
  if (section === "items")
    return (
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          只看商店装备 <Switch checked={filters.storeOnly} onCheckedChange={(v) => setFilters({ storeOnly: v })} className="scale-90" />
        </label>
        <Select value={filters.itemTag || "all"} onValueChange={(v) => setFilters({ itemTag: v === "all" ? "" : v })}>
          <SelectTrigger size="sm" className="h-8 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部属性</SelectItem>
            {Object.entries(ITEM_TAGS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  if (section === "tft")
    return (
      <div className="flex items-center gap-3">
        <ToggleGroup type="single" size="sm" variant="outline" value={filters.tftCategory} onValueChange={(v) => v && setFilters({ tftCategory: v, tftSet: "" })}>
          {TFT_CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c} className="px-2.5 text-xs">
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {tftSetOptions.length > 0 && (
          <Select value={filters.tftSet || "all"} onValueChange={(v) => setFilters({ tftSet: v === "all" ? "" : v })}>
            <SelectTrigger size="sm" className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部赛季</SelectItem>
              {tftSetOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  S{s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  return null;
}

function RunesView({ groups, selectedId, onSelect }: { groups: RuneGroup[]; selectedId?: string; onSelect: (e: GridEntry) => void }) {
  if (groups.length === 0) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">没有符合条件的符文</div>;
  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 px-4 pt-3 pb-4">
        {groups.map((g) => (
          <section key={g.key} className="space-y-2.5">
            <h3 className="border-b border-border pb-1.5 font-heading text-sm font-semibold text-hex-gold">{g.title}</h3>
            <SimpleGrid entries={g.entries} tileWidth={92} selectedId={selectedId} onSelect={onSelect} />
          </section>
        ))}
      </div>
    </ScrollArea>
  );
}

/** 素材浏览器:工具栏 + 网格 + 可拖动宽度的详情面板 */
export function Browser({ progress }: { progress: TaskProgress | null }) {
  const section = useUI((s) => s.section);
  const version = useUI((s) => s.version);
  const setVersion = useUI((s) => s.setVersion);
  const compareVersion = useUI((s) => s.compareVersion);
  const setCompareVersion = useUI((s) => s.setCompareVersion);
  const diffFilter = useUI((s) => s.diffFilter);
  const setDiffFilter = useUI((s) => s.setDiffFilter);
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const filters = useUI((s) => s.filters);
  const selection = useUI((s) => s.selection);
  const select = useUI((s) => s.select);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);

  const versions = useVersions();
  useEffect(() => {
    if (!version && versions.data?.length) setVersion(versions.data[0]);
  }, [version, versions.data, setVersion]);

  const catalog = useCatalog(version);
  const compare = useCatalog(compareVersion);
  const cat = catalog.data;
  const cmp = compareVersion ? compare.data : undefined;

  const tftSetOptions = useMemo(() => (cat ? tftSets(cat, filters.tftCategory) : []), [cat, filters.tftCategory]);

  const result = useMemo((): (SectionResult & { groups?: RuneGroup[]; skinGroups?: GridGroup[] }) | null => {
    if (!cat) return null;
    switch (section) {
      case "champions":
        return championsSection(cat, cmp, search, filters, diffFilter);
      case "skins": {
        const r = skinsSection(cat, cmp, search, filters, diffFilter);
        return { ...r, skinGroups: r.groups, groups: undefined };
      }
      case "items":
        return itemsSection(cat, cmp, search, filters, diffFilter);
      case "runes": {
        const r = runesSection(cat, cmp, search, diffFilter);
        return { entries: r.groups.flatMap((g) => g.entries), exportItems: r.exportItems, total: r.total, groups: r.groups };
      }
      case "summoners":
        return summonersSection(cat, cmp, search, diffFilter);
      case "tft":
        return tftSection(cat, cmp, search, filters, diffFilter);
    }
    return null;
  }, [cat, cmp, section, search, filters, diffFilter]);

  // 选中的条目对应到网格里的 ID
  const selectedId =
    selection?.kind === "champion" ? (section === "skins" ? selection.skinId : selection.id) : selection && "id" in selection ? selection.id : undefined;

  const onSelect = (e: GridEntry) => {
    if (!cat) return;
    switch (section) {
      case "champions":
        return select({ kind: "champion", id: e.id });
      case "skins": {
        const owner = cat.champions.find((c) => c.skins.some((s) => skinKey(c, s) === e.id));
        return owner && select({ kind: "champion", id: owner.id, skinId: e.id });
      }
      case "items":
        return select({ kind: "item", id: e.id });
      case "runes":
        return select({ kind: "rune", id: e.id });
      case "summoners":
        return select({ kind: "named", group: "summoners", id: e.id });
      case "tft":
        return select({ kind: "tft", id: e.id, category: filters.tftCategory });
    }
  };

  const exporting = progress?.stage === "export" && !progress.done;
  const title = TITLES[section] ?? "";
  const emptyHint =
    section === "tft" && cat && cat.tft.length === 0
      ? "该版本没有云顶数据(Data Dragon 自 13.1 起提供)"
      : section === "runes" && cat && cat.runeStyles.length + cat.legacyRunes.length + cat.masteries.length === 0
        ? "该版本没有符文数据"
        : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="shrink-0 space-y-2.5 border-b border-border bg-sidebar/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-1 font-heading text-lg font-bold text-hex-gold">{title}</h2>
          {result && <span className="mr-2 text-xs text-muted-foreground">{result.total} 项</span>}
          <VersionPicker label="版本" versions={versions.data ?? []} value={version} onChange={(v) => v && setVersion(v)} />
          <VersionPicker
            label="对比"
            allowNone
            versions={versions.data ?? []}
            value={compareVersion}
            onChange={setCompareVersion}
            disabledVersion={version}
          />
          <div className="relative ml-auto w-56">
            <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索名称 / 称号 / 英文 ID" className="h-8 pr-14 pl-8 text-xs" />
            {search ? (
              <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm border border-border px-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                Ctrl K
              </button>
            )}
          </div>
          {exporting ? (
            <Button size="sm" variant="destructive" className="h-8 gap-1.5" onClick={() => cancelTask()}>
              <X className="size-3.5" /> 取消导出
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={!result || result.exportItems.length === 0}
              onClick={() => result && exportTo(`素材导出-${version}-${title}`, result.exportItems)}
            >
              <FolderDown className="size-3.5" /> 导出 {result?.exportItems.length ?? 0} 项
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SectionFilters section={section} tftSetOptions={tftSetOptions} champions={cat?.champions ?? []} />
          {compareVersion && (
            <div className="flex items-center gap-2">
              <FilterLabel>{`对比 ${compareVersion}`}</FilterLabel>
              <ToggleGroup type="single" size="sm" variant="outline" value={diffFilter} onValueChange={(v) => v && setDiffFilter(v as DiffFilter)}>
                <ToggleGroupItem value="all" className="px-2.5 text-xs">全部</ToggleGroupItem>
                <ToggleGroupItem value="added" className="px-2.5 text-xs">新增</ToggleGroupItem>
                <ToggleGroupItem value="renamed" className="px-2.5 text-xs">改名</ToggleGroupItem>
                <ToggleGroupItem value="removed" className="px-2.5 text-xs">移除</ToggleGroupItem>
              </ToggleGroup>
              {compare.isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
        {exporting && progress && (
          <div className="space-y-1">
            <HextechProgressBar ratio={progress.total ? progress.current / progress.total : 0} />
            <div className="text-[11px] text-muted-foreground">{progress.message}</div>
          </div>
        )}
      </div>

      {/* 网格 + 详情 */}
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="66" minSize="35">
          {catalog.isLoading || versions.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 正在读取 {version ?? ""} 素材目录…
            </div>
          ) : catalog.error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
              读取素材目录失败:{errorMessage(catalog.error)}
            </div>
          ) : !result ? null : section === "runes" ? (
            <RunesView groups={result.groups ?? []} selectedId={selectedId} onSelect={onSelect} />
          ) : section === "summoners" ? (
            <ScrollArea className="h-full">
              <div className="px-4 pt-3 pb-4">
                <SimpleGrid entries={result.entries} tileWidth={92} selectedId={selectedId} onSelect={onSelect} />
              </div>
            </ScrollArea>
          ) : (
            <AssetGrid
              key={section}
              entries={result.entries}
              groups={result.skinGroups}
              activeGroup={selection?.kind === "champion" ? selection.id : undefined}
              onGroupClick={(g) => select({ kind: "champion", id: g.key })}
              tileWidth={section === "champions" ? 104 : section === "skins" ? 132 : 92}
              aspect={section === "skins" ? 560 / 308 : 1}
              fit={section === "champions" || section === "skins" ? "cover" : "contain"}
              selectedId={selectedId}
              onSelect={onSelect}
              empty={emptyHint}
            />
          )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="34" minSize="24" maxSize="55" className="bg-sidebar/40">
          <DetailPanel catalog={cat} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
