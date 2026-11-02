import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Boxes,
  CircleHelp,
  CloudDownload,
  Crown,
  Database,
  DoorOpen,
  FolderDown,
  FolderCog,
  Gem,
  Grid3x3,
  Hammer,
  Hexagon,
  Link2,
  Map as MapIcon,
  PawPrint,
  Search,
  Sparkles,
  Swords,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Assets } from "@/mygo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { errorMessage, openPath, pickDirectory } from "@/lib/api";
import { loadSaveDir, setSaveDir, useSaveDir } from "@/lib/save";
import { cn, formatBytes } from "@/lib/utils";
import { useUI, type Game, type Section } from "@/store/ui";

/** 侧边栏一项:云顶的各分类共用 tft 分区,用 tftCategory 区分 */
interface NavItem {
  key: Section;
  label: string;
  icon: LucideIcon;
  tftCategory?: string;
}

const GAMES: { key: Game; label: string; items: NavItem[] }[] = [
  {
    key: "lol",
    label: "英雄联盟",
    items: [
      { key: "champions", label: "英雄", icon: Swords },
      { key: "items", label: "装备", icon: Gem },
      { key: "runes", label: "符文", icon: Sparkles },
      { key: "summoners", label: "召唤师技能", icon: Wand2 },
    ],
  },
  {
    key: "tft",
    label: "云顶之弈",
    items: [
      { key: "tft", tftCategory: "弈子", label: "弈子", icon: Crown },
      { key: "tft", tftCategory: "羁绊", label: "羁绊", icon: Link2 },
      { key: "tft", tftCategory: "装备", label: "装备", icon: Hammer },
      { key: "tft", tftCategory: "海克斯强化", label: "海克斯强化", icon: Hexagon },
      { key: "tft", tftCategory: "小小英雄", label: "小小英雄", icon: PawPrint },
      { key: "tft", tftCategory: "棋盘皮肤", label: "棋盘皮肤", icon: Grid3x3 },
      { key: "tft", tftCategory: "地区传送门", label: "地区传送门", icon: DoorOpen },
    ],
  },
];

const TOOLS: NavItem[] = [
  { key: "download", label: "整包下载", icon: CloudDownload },
  { key: "localize", label: "汉化整理", icon: FolderCog },
  { key: "nav", label: "导航", icon: MapIcon },
  { key: "help", label: "说明", icon: CircleHelp },
];

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-semibold text-hex-gold before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-hex-gold"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </button>
  );
}

function GroupTitle({ children }: { children: string }) {
  return <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/80 uppercase">{children}</div>;
}

/** 素材缓存的占用与清理 */
function CacheButton() {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["cacheInfo"], queryFn: () => Assets.cacheInfo(), refetchInterval: 30_000 });
  const clear = async () => {
    try {
      await Assets.clearCache();
      await qc.invalidateQueries({ queryKey: ["cacheInfo"] });
      toast.success("已清理素材缓存");
    } catch (e) {
      toast.error("清理失败", { description: errorMessage(e) });
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Database className="size-3.5" />
          素材缓存 {info.data ? formatBytes(info.data.size) : "…"}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 space-y-3 text-sm">
        <p className="text-muted-foreground">浏览过的图片和数据会缓存在本地,再次查看更快,离线也能看。</p>
        <p className="break-all font-mono text-[11px] text-muted-foreground">{info.data?.dir}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" disabled={!info.data} onClick={() => info.data && openPath(info.data.dir).catch(() => {})}>
            打开目录
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" onClick={clear}>
            清理缓存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Ctrl K 小标签,点击打开跨分类搜索 */
function PaletteHint({ className }: { className?: string }) {
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      className={cn("rounded-sm border border-border px-1 font-mono text-[10px] text-muted-foreground hover:text-foreground", className)}
    >
      Ctrl K
    </button>
  );
}

/** 侧边栏顶部的搜索:浏览分区里筛选当前分类;整包工具页没有可筛选的内容,点击打开跨分类搜索 */
function SidebarSearch({ label }: { label?: string }) {
  const search = useUI((s) => s.search);
  const setSearch = useUI((s) => s.setSearch);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);

  if (!label)
    return (
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-input/30 pr-1.5 pl-2.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Search className="size-3.5" />
        搜索素材
        <span className="ml-auto rounded-sm border border-border px-1 font-mono text-[10px]">Ctrl K</span>
      </button>
    );
  return (
    <div className="relative">
      <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`搜索${label}`} className="h-8 pr-12 pl-8 text-xs" />
      {search ? (
        <button
          type="button"
          aria-label="清空搜索"
          onClick={() => setSearch("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <PaletteHint className="absolute top-1/2 right-1.5 -translate-y-1/2" />
      )}
    </div>
  );
}

/** 固定保存位置:保存和导出的素材都放这里,不再询问 */
function SaveDirButton() {
  const dir = useSaveDir((s) => s.dir);
  useEffect(() => {
    loadSaveDir().catch(() => {});
  }, []);
  const change = async () => {
    const picked = await pickDirectory().catch(() => null);
    if (!picked) return;
    try {
      await setSaveDir(picked);
      toast.success("已设置保存位置", { description: picked });
    } catch (e) {
      toast.error("设置失败", { description: errorMessage(e) });
    }
  };
  const clear = async () => {
    try {
      await setSaveDir("");
      toast.success("已清除,下次保存时会再询问");
    } catch (e) {
      toast.error("清除失败", { description: errorMessage(e) });
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <FolderDown className="size-3.5 shrink-0" />
          <span className="truncate">保存位置 {dir ? dir.split(/[\\/]/).filter(Boolean).pop() : "未设置"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-72 space-y-3 text-sm">
        <p className="text-muted-foreground">保存和导出的素材都直接放到这里,不再询问。</p>
        <p className="font-mono text-[11px] break-all text-muted-foreground">{dir || "未设置,第一次保存时会询问"}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" disabled={!dir} onClick={() => dir && openPath(dir).catch(() => {})}>
            打开
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={change}>
            更改
          </Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={!dir} onClick={clear}>
            清除
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** 左侧导航 */
export function Sidebar() {
  const section = useUI((s) => s.section);
  const setSection = useUI((s) => s.setSection);
  const game = useUI((s) => s.game);
  const setGame = useUI((s) => s.setGame);
  const tftCategory = useUI((s) => s.filters.tftCategory);
  const setFilters = useUI((s) => s.setFilters);
  const current = GAMES.find((g) => g.key === game)!;

  const go = (item: NavItem) => {
    setSection(item.key);
    if (item.tftCategory) setFilters({ tftCategory: item.tftCategory, tftSet: "" });
  };
  const isActive = (item: NavItem) => section === item.key && (!item.tftCategory || item.tftCategory === tftCategory);

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Boxes className="size-5 text-hex-gold" />
        <div className="leading-tight">
          <div className="font-heading text-sm font-bold tracking-wide text-hex-gold">英雄联盟素材</div>
          <div className="text-[10px] text-muted-foreground">获取 · 浏览 · 整理</div>
        </div>
      </div>
      <div className="px-2 pb-1">
        <SidebarSearch label={current.items.find(isActive)?.label} />
      </div>
      {/* 只有素材浏览的分区列表滚动,整包工具固定在底部 */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-0.5">
          <GroupTitle>素材浏览</GroupTitle>
          {/* 英雄联盟 / 云顶之弈 切换,下面只列当前游戏的分区 */}
          <div role="radiogroup" className="mb-1.5 flex rounded-md bg-black/30 p-0.5">
            {GAMES.map((g) => (
              <button
                key={g.key}
                type="button"
                role="radio"
                aria-checked={g.key === game}
                onClick={() => g.key !== game && setGame(g.key)}
                className={cn(
                  "flex-1 rounded-[5px] py-1 text-xs transition-colors",
                  g.key === game ? "bg-hex-gold/15 font-semibold text-hex-gold-light shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          {current.items.map((item) => (
            <NavButton key={item.tftCategory ?? item.key} item={item} active={isActive(item)} onClick={() => go(item)} />
          ))}
        </div>
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-sidebar-border px-2 pt-3 pb-2">
        <GroupTitle>整包工具</GroupTitle>
        {TOOLS.map((item) => (
          <NavButton key={item.key} item={item} active={isActive(item)} onClick={() => go(item)} />
        ))}
      </div>
      <div className="shrink-0 space-y-1 border-t border-sidebar-border px-2 py-2">
        <SaveDirButton />
        <CacheButton />
        <div className="px-2.5 text-[10px] text-muted-foreground/70">by Bilibili 仓小杰 · 完全免费</div>
      </div>
    </aside>
  );
}
