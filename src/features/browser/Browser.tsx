import { useEffect, useMemo } from "react";
import { FolderDown, Loader2, X } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HextechProgressBar } from "@/components/HextechProgressBar";
import { cancelTask, errorMessage, type TaskProgress } from "@/lib/api";
import { useCatalog, useTFTSeasons, useTFTUnits, useVersions } from "@/lib/assets";
import { ENTER } from "@/lib/motion";
import { useUI, type DiffFilter, type Section } from "@/store/ui";
import { AssetGrid, SimpleGrid, type GridEntry, type GridGroup } from "./AssetGrid";
import { DetailPanel, exportTo } from "./DetailPanel";
import { VersionPicker } from "./VersionPicker";
import type { Champion } from "@/mygo";
import { ChampionPicker } from "./ChampionPicker";
import { OptionPicker } from "./OptionPicker";
import { RuneStyleCard } from "./RuneTree";
import { SeasonBar } from "./SeasonBar";
import { TftUnitFilters } from "./TftUnitFilters";
import {
  ITEM_TAGS,
  ROLE_LABELS,
  TFT_SEASONAL,
  championsSection,
  effectiveSeason,
  itemsSection,
  runesSection,
  seasonFilter,
  seasonOptions,
  skinKey,
  skinsSection,
  summonersSection,
  tftSection,
  tftUnitFilter,
  type ChampionView,
  type RuneGroup,
  type SectionResult,
} from "./sections";

const TITLES: Partial<Record<Section, string>> = {
  champions: "英雄",
  items: "装备",
  runes: "符文",
  summoners: "召唤师技能",
};

/** 网格实际显示的内容:英雄分区可切换为按皮肤显示 */
type View = Section | "skins";

/** 云顶里横图分类的高宽比(弈子 256×128、小小英雄 512×344),其余分类是方图 */
const TFT_ASPECT: Record<string, number> = { 弈子: 1 / 2, 小小英雄: 344 / 512 };

/** 筛选控件旁的小标签 */
function FilterLabel({ children }: { children: string }) {
  return <span className="text-xs text-muted-foreground">{children}</span>;
}

function SectionFilters({ section, champions }: { section: Section; champions: Champion[] }) {
  const filters = useUI((s) => s.filters);
  const setFilters = useUI((s) => s.setFilters);
  const historyArt = useUI((s) => s.historyArt);
  const setHistoryArt = useUI((s) => s.setHistoryArt);

  if (section === "champions")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={filters.championView}
          onValueChange={(v) => v && setFilters({ championView: v as ChampionView })}
        >
          <ToggleGroupItem value="champions" className="px-2.5 text-xs">英雄</ToggleGroupItem>
          <ToggleGroupItem value="skins" className="px-2.5 text-xs">皮肤</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup type="single" size="sm" variant="outline" value={filters.role || "all"} onValueChange={(v) => v && setFilters({ role: v === "all" ? "" : v })}>
          <ToggleGroupItem value="all" className="px-2.5 text-xs">全部</ToggleGroupItem>
          {Object.entries(ROLE_LABELS).map(([k, label]) => (
            <ToggleGroupItem key={k} value={k} className="px-2.5 text-xs">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {filters.championView === "skins" && (
          <>
            <ChampionPicker champions={champions} value={filters.skinChampion} onChange={(id) => setFilters({ skinChampion: id })} />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              详情显示该版本历史原画 <Switch checked={historyArt} onCheckedChange={setHistoryArt} className="scale-90" />
            </label>
          </>
        )}
      </div>
    );
  if (section === "items")
    return (
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          只看商店装备 <Switch checked={filters.storeOnly} onCheckedChange={(v) => setFilters({ storeOnly: v })} className="scale-90" />
        </label>
        <OptionPicker
          label="属性"
          value={filters.itemTag}
          options={Object.entries(ITEM_TAGS).map(([value, label]) => ({ value, label }))}
          onChange={(v) => setFilters({ itemTag: v })}
        />
      </div>
    );
  return null;
}

function RunesView({ groups, selectedId, onSelect }: { groups: RuneGroup[]; selectedId?: string; onSelect: (e: GridEntry) => void }) {
  if (groups.length === 0) return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">没有符合条件的符文</div>;
  // 7.24 起的符文系:这里只选系,符文树在右侧详情里;旧符文 / 天赋仍用网格
  const styles = groups.filter((g) => g.rows || g.head);
  const grids = groups.filter((g) => !g.rows && !g.head);
  const inStyle = (g: RuneGroup) => g.head?.id === selectedId || !!g.rows?.some((r) => r.entries.some((e) => e.id === selectedId));
  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 px-4 pt-3 pb-4">
        {styles.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {styles.map((g) => (
              <RuneStyleCard
                key={g.key}
                styleId={g.key}
                title={g.title}
                icon={g.icon ?? ""}
                rows={g.rows ?? []}
                active={inStyle(g)}
                onSelect={() => onSelect(g.head ?? { id: `style-${g.key}`, title: g.title, image: g.icon ?? "" })}
              />
            ))}
          </div>
        )}
        {grids.map((g) => (
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
  const filters = useUI((s) => s.filters);
  const selection = useUI((s) => s.selection);
  const select = useUI((s) => s.select);

  const versions = useVersions();
  useEffect(() => {
    if (!version && versions.data?.length) setVersion(versions.data[0]);
  }, [version, versions.data, setVersion]);

  // Esc 关闭详情栏;弹窗打开或在输入框里时不处理
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[role="dialog"]')) return;
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable='true']")) return;
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const catalog = useCatalog(version);
  const compare = useCatalog(compareVersion);
  const cat = catalog.data;
  const cmp = compareVersion ? compare.data : undefined;

  // 云顶赛季:各分类共用,没选过时用该版本的默认赛季
  const setFilters = useUI((s) => s.setFilters);
  const seasons = useTFTSeasons(version, section === "tft");
  const seasonOpts = useMemo(() => (cat ? seasonOptions(cat, seasons.data) : []), [cat, seasons.data]);
  const season = effectiveSeason(filters.tftSet, seasonOpts);
  const inSeason = useMemo(() => seasonFilter(season, seasons.data), [season, seasons.data]);
  // 弈子另按费用、羁绊、定位等条件筛选;条件的选项取自当前赛季的弈子
  const unitView = section === "tft" && filters.tftCategory === "弈子";
  const units = useTFTUnits(version, unitView);
  const traitNames = useMemo(() => new Map((cat?.tft ?? []).filter((e) => e.category === "羁绊").map((e) => [e.id, e.name])), [cat]);
  const seasonUnits = useMemo(() => (cat && unitView ? cat.tft.filter((e) => e.category === "弈子" && inSeason(e)) : []), [cat, unitView, inSeason]);
  const keepTft = useMemo(() => {
    if (!unitView) return inSeason;
    const ok = tftUnitFilter(filters, units.data, traitNames);
    return (e: Parameters<typeof inSeason>[0]) => inSeason(e) && ok(e);
  }, [unitView, inSeason, filters, units.data, traitNames]);
  const seasonal = TFT_SEASONAL.has(filters.tftCategory);
  const view: View = section === "champions" && filters.championView === "skins" ? "skins" : section;
  const tftAspect = section === "tft" ? TFT_ASPECT[filters.tftCategory] : undefined;

  const result = useMemo((): (SectionResult & { groups?: RuneGroup[]; skinGroups?: GridGroup[] }) | null => {
    if (!cat) return null;
    switch (view) {
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
        return tftSection(cat, cmp, search, filters, diffFilter, keepTft);
    }
    return null;
  }, [cat, cmp, view, search, filters, diffFilter, keepTft]);

  // 选中的条目对应到网格里的 ID
  const selectedId =
    selection?.kind === "champion" ? (view === "skins" ? selection.skinId : selection.id) : selection && "id" in selection ? selection.id : undefined;

  const onSelect = (e: GridEntry) => {
    if (!cat) return;
    switch (view) {
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
  // 云顶各分类在侧边栏单独列出,标题直接用分类名;导出目录加「云顶」前缀,避免和英雄联盟的装备重名
  const title = section === "tft" ? filters.tftCategory : (TITLES[section] ?? "");
  const exportTitle = section === "tft" ? `云顶${seasonal && season ? `S${season}` : ""}${filters.tftCategory}` : title;
  const emptyHint =
    section === "tft" && cat && cat.tft.length === 0
      ? "该版本没有云顶数据(13.1 起提供)"
      : section === "runes" && cat && cat.runeStyles.length + cat.legacyRunes.length + cat.masteries.length === 0
        ? "该版本没有符文数据"
        : undefined;

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="relative shrink-0 space-y-2.5 bg-linear-to-b from-hex-bg-2/80 to-sidebar/40 px-4 py-3">
        {/* 底边:中间亮、两端淡出的青铜线 */}
        <div className="hex-rule absolute inset-x-0 bottom-0" />
        {section === "tft" && cat && cat.tft.length > 0 && (
          <SeasonBar
            options={seasonOpts}
            value={season}
            onChange={(s) => setFilters({ tftSet: s, tftTrait: "" })}
            category={filters.tftCategory}
            seasonal={seasonal}
            loading={seasons.isLoading}
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="hex-title font-heading text-xl font-bold">{title}</h2>
          {result && (
            <span className="mr-3 text-xs text-muted-foreground">
              <span className="font-display text-sm font-semibold text-hex-gold/80">{result.total}</span> 项
            </span>
          )}
          <VersionPicker label="版本" versions={versions.data ?? []} value={version} onChange={(v) => v && setVersion(v)} />
          <VersionPicker
            label="对比"
            allowNone
            versions={versions.data ?? []}
            value={compareVersion}
            onChange={setCompareVersion}
            disabledVersion={version}
          />
          {exporting ? (
            <Button size="sm" variant="destructive" className="ml-auto h-8 gap-1.5" onClick={() => cancelTask()}>
              <X className="size-3.5" /> 取消导出
            </Button>
          ) : (
            <Button
              size="sm"
              className="ml-auto h-8 gap-1.5"
              disabled={!result || result.exportItems.length === 0}
              onClick={() => result && exportTo(`素材导出-${version}-${exportTitle}`, result.exportItems)}
            >
              <FolderDown className="size-3.5" /> 导出 {result?.exportItems.length ?? 0} 项
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SectionFilters section={section} champions={cat?.champions ?? []} />
          {unitView && seasonUnits.length > 0 && <TftUnitFilters entries={seasonUnits} units={units.data} traitNames={traitNames} />}
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
        <ResizablePanel id="grid" defaultSize="66" minSize="35">
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
            // 换分区、云顶分类或赛季时网格淡入
            <motion.div key={`${view}:${section === "tft" ? `${filters.tftCategory}:${season}` : ""}`} {...ENTER} className="h-full">
              <AssetGrid
                key={view}
                entries={result.entries}
                groups={result.skinGroups}
                activeGroup={selection?.kind === "champion" ? selection.id : undefined}
                onGroupClick={(g) => select({ kind: "champion", id: g.key })}
                tileWidth={view === "champions" ? 104 : view === "skins" ? 132 : 92}
                aspect={view === "skins" ? 560 / 308 : (tftAspect ?? 1)}
                fit={view === "champions" || view === "skins" || tftAspect ? "cover" : "contain"}
                selectedId={selectedId}
                onSelect={onSelect}
                empty={emptyHint}
              />
            </motion.div>
          )}
        </ResizablePanel>
        {/* 没有点击内容时不显示详情栏 */}
        {selection && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel id="detail" defaultSize="34" minSize="24" maxSize="55" className="bg-sidebar/40">
              <DetailPanel catalog={cat} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
