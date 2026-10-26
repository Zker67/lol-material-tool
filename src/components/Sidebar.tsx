import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Boxes,
  CircleHelp,
  CloudDownload,
  Crown,
  Database,
  FolderCog,
  Gem,
  Map as MapIcon,
  Shirt,
  Sparkles,
  Swords,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { Assets } from "@/mygo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { errorMessage, openPath } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";
import { useUI, type Section } from "@/store/ui";

const GROUPS: { title: string; items: { key: Section; label: string; icon: LucideIcon }[] }[] = [
  {
    title: "素材浏览",
    items: [
      { key: "champions", label: "英雄", icon: Swords },
      { key: "skins", label: "皮肤", icon: Shirt },
      { key: "items", label: "装备", icon: Gem },
      { key: "runes", label: "符文", icon: Sparkles },
      { key: "summoners", label: "召唤师技能", icon: Wand2 },
      { key: "tft", label: "云顶之弈", icon: Crown },
    ],
  },
  {
    title: "整包工具",
    items: [
      { key: "download", label: "整包下载", icon: CloudDownload },
      { key: "localize", label: "汉化整理", icon: FolderCog },
      { key: "nav", label: "导航", icon: MapIcon },
      { key: "help", label: "说明", icon: CircleHelp },
    ],
  },
];

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

/** 左侧导航 */
export function Sidebar() {
  const section = useUI((s) => s.section);
  const setSection = useUI((s) => s.setSection);
  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Boxes className="size-5 text-hex-gold" />
        <div className="leading-tight">
          <div className="font-heading text-sm font-bold tracking-wide text-hex-gold">英雄联盟素材</div>
          <div className="text-[10px] text-muted-foreground">获取 · 浏览 · 整理</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground/80 uppercase">{g.title}</div>
            {g.items.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                  section === key
                    ? "bg-sidebar-accent font-semibold text-hex-gold before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-hex-gold"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border px-2 py-2">
        <CacheButton />
        <div className="px-2.5 text-[10px] text-muted-foreground/70">by Bilibili 仓小杰 · 完全免费</div>
      </div>
    </aside>
  );
}
