import { useState, useEffect } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Globe,
  Search,
  ExternalLink,
  Compass,
  ShieldAlert,
  Image as ImageIcon,
  Volume2,
  Sparkles,
  X,
} from "lucide-react";
import type { NavBlock } from "../../data/navigation";
import { NAV_COLUMNS } from "../../data/navigation";

// 1. 大分类定义
interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
}

const CATEGORIES: CategoryDef[] = [
  { key: "all", label: "全部资源", icon: Compass },
  { key: "recommended", label: "推荐与工具", icon: Sparkles },
  { key: "icons", label: "游戏图标", icon: Globe },
  { key: "art", label: "视觉原画", icon: ImageIcon },
  { key: "audio", label: "音频与音效", icon: Volume2 },
];

// 匹配大分类函数
function matchCategory(block: NavBlock, category: string): boolean {
  if (category === "all") return true;

  const title = block.title.toLowerCase();
  if (category === "recommended") {
    return title.includes("我制作的") || title.includes("综合");
  }
  if (category === "icons") {
    return title.includes("图标");
  }
  if (category === "art") {
    return title.includes("插画") || title.includes("3d");
  }
  if (category === "audio") {
    return title.includes("音效") || title.includes("声音");
  }
  return false;
}

// 2. Favicon 抓取组件，具有平滑降级与加载状态
function Favicon({ url, fallbackIcon, name }: { url: string; fallbackIcon?: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (!url) {
      setStatus("error");
      return;
    }
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname;
      // 使用 Google S2 Favicon API 服务进行抓取，质量极佳
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
      setStatus("loading");
    } catch (e) {
      setStatus("error");
    }
  }, [url]);

  if (status === "error") {
    if (fallbackIcon) {
      return (
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-hex-bg-2 rounded border border-hex-gold-dark/30 text-lg shadow-inner select-none">
          {fallbackIcon}
        </div>
      );
    }
    // 基于名称首字母生成漂亮的渐变色背景作为 fallback
    const char = name.trim().charAt(0).toUpperCase();
    const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const gradients = [
      "from-blue-600 to-cyan-500",
      "from-purple-600 to-pink-500",
      "from-emerald-600 to-teal-500",
      "from-amber-600 to-orange-500",
      "from-red-600 to-rose-500",
      "from-indigo-600 to-violet-500",
    ];
    const gradient = gradients[hash % gradients.length];
    return (
      <div
        className={`w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} rounded border border-hex-gold-dark/20 shadow-md text-white font-bold text-sm select-none`}
      >
        {char}
      </div>
    );
  }

  return (
    <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center bg-hex-bg-2 rounded border border-hex-gold-dark/20 overflow-hidden shadow-inner select-none">
      {status === "loading" && (
        <div className="absolute inset-0 bg-hex-bg-2 animate-pulse flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-hex-text-muted animate-spin" />
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={name}
          className={`w-5 h-5 object-contain transition-opacity duration-300 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}

// 3. Featured 推荐卡片
function FeaturedBlock({ block }: { block: Extract<NavBlock, { kind: "featured" }> }) {
  return (
    <div className="rounded-lg border-2 border-hex-gold/50 bg-gradient-to-br from-hex-bg-2/80 to-hex-gold-dark/15 p-5 shadow-[0_0_20px_rgba(200,170,110,0.12)] relative overflow-hidden">
      {/* 海克斯科技转角发光装饰 */}
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none border-t-2 border-r-2 border-hex-gold/20 translate-x-2 -translate-y-2 rotate-45" />

      <div className="flex items-center gap-2 mb-4 border-b border-hex-gold-dark/30 pb-2.5">
        <Sparkles className="w-5 h-5 text-hex-gold animate-pulse" />
        <h3 className="text-base font-display font-bold text-hex-gold tracking-wider uppercase">
          {block.title}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {block.items.map((it) => (
          <div
            key={it.url}
            onClick={() => openUrl(it.url)}
            className="group flex items-center gap-3 p-3 rounded bg-hex-panel/50 border border-hex-gold/20 hover:border-hex-gold hover:bg-hex-gold-dark/15 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-hex-bg-2 rounded border border-hex-gold-dark/40 text-xl group-hover:scale-110 transition-transform">
              {it.icon}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-hex-gold-light group-hover:text-hex-gold transition-colors break-words">
                {it.name}
              </span>
              <span className="text-[11px] text-hex-text-muted mt-0.5">
                点击打开 zker67 独立工具
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-hex-text-muted opacity-40 group-hover:opacity-100 transition-opacity self-center ml-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 4. 普通链接卡片
function LinksBlock({ block }: { block: Extract<NavBlock, { kind: "links" }> }) {
  return (
    <div className="rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/50 hover:shadow-[0_0_15px_rgba(200,170,110,0.06)] transition-all duration-300">
      <div className="flex items-center gap-2 mb-4 border-b border-hex-gold-dark/20 pb-2">
        <h3 className="text-base font-display font-bold text-hex-gold tracking-wide">
          {block.title}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {block.items.map((it) => (
          <div
            key={it.url}
            onClick={() => openUrl(it.url)}
            className="group flex items-center gap-3 p-3 rounded bg-hex-bg-2/30 border border-hex-gold-dark/15 hover:border-hex-gold/60 hover:bg-hex-gold-dark/10 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 shadow-sm"
          >
            <Favicon url={it.url} name={it.name} />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium text-hex-gold-light group-hover:text-hex-gold transition-colors break-words">
                {it.name}
              </span>
              {it.desc && (
                <span className="text-xs text-hex-text-muted mt-0.5 break-words" title={it.desc}>
                  {it.desc}
                </span>
              )}
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-hex-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 5. 聚合来源卡片
function SourcesBlock({ block }: { block: Extract<NavBlock, { kind: "sources" }> }) {
  return (
    <div className="rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/50 hover:shadow-[0_0_15px_rgba(200,170,110,0.06)] transition-all duration-300">
      <div className="flex items-center gap-2 mb-4 border-b border-hex-gold-dark/20 pb-2">
        <h3 className="text-base font-display font-bold text-hex-gold tracking-wide">
          {block.title}
        </h3>
      </div>
      <div className="space-y-3.5">
        {block.rows.map((row) => {
          const firstUrl = row.items[0]?.url || "";
          return (
            <div
              key={row.label}
              className="flex items-start gap-3.5 p-3 rounded bg-hex-bg-2/40 border border-hex-gold-dark/15 hover:border-hex-gold-dark/30 transition-colors"
            >
              <Favicon url={firstUrl} name={row.label} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-hex-gold mb-2 tracking-wide uppercase">
                  {row.label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.items.map((it) => (
                    <button
                      key={it.url}
                      onClick={() => openUrl(it.url)}
                      className="px-2.5 py-1 text-xs text-hex-gold-light bg-hex-panel/90 hover:bg-hex-gold-dark/25 border border-hex-gold-dark/35 hover:border-hex-gold rounded transition-all duration-200 flex items-center gap-1 shadow-sm hover:shadow-[0_0_8px_rgba(200,170,110,0.18)]"
                    >
                      {it.name}
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 6. 分组混排卡片
function MixedBlock({ block }: { block: Extract<NavBlock, { kind: "mixed" }> }) {
  return (
    <div className="rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/50 hover:shadow-[0_0_15px_rgba(200,170,110,0.06)] transition-all duration-300">
      <div className="flex items-center gap-2 mb-4 border-b border-hex-gold-dark/20 pb-2">
        <h3 className="text-base font-display font-bold text-hex-gold tracking-wide">
          {block.title}
        </h3>
      </div>
      <div className="space-y-4">
        {block.groups.map((group, gi) => (
          <div key={gi} className="space-y-2">
            {group.label && (
              <div className="flex items-center gap-2 px-1">
                <span className="w-1 h-3.5 bg-hex-gold rounded-full" />
                <span className="text-xs font-bold text-hex-gold-light tracking-wide">
                  {group.label.replace(":", "")}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2.5">
              {group.items.map((it) => (
                <div
                  key={it.url}
                  onClick={() => openUrl(it.url)}
                  className="group flex items-center gap-3 p-2.5 rounded bg-hex-bg-2/30 border border-hex-gold-dark/15 hover:border-hex-gold/60 hover:bg-hex-gold-dark/10 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 shadow-sm"
                >
                  <Favicon url={it.url} name={it.name} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-hex-gold-light group-hover:text-hex-gold transition-colors break-words">
                      {it.name}
                    </span>
                    {it.desc && (
                      <span className="text-xs text-hex-text-muted mt-0.5 break-words" title={it.desc}>
                        {it.desc}
                      </span>
                    )}
                  </div>
                  <ExternalLink className="w-3 h-3 text-hex-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 渲染派发组件
function Block({ block }: { block: NavBlock }) {
  switch (block.kind) {
    case "featured":
      return <FeaturedBlock block={block} />;
    case "links":
      return <LinksBlock block={block} />;
    case "sources":
      return <SourcesBlock block={block} />;
    case "mixed":
      return <MixedBlock block={block} />;
    default:
      return null;
  }
}

// 7. 导航页主组件
export function NavPanel() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allBlocks = NAV_COLUMNS.flat();

  // 第一步：按分类匹配
  const blocksToShow = allBlocks.filter((block) => matchCategory(block, activeCategory));

  // 第二步：按搜索关键字进行细颗粒过滤
  const filteredBlocks = blocksToShow
    .map((block) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return block;

      // 如果卡片标题本身匹配，保留该卡片全部项
      if (block.title.toLowerCase().includes(query)) {
        return block;
      }

      // 否则对其子链接进行过滤匹配
      if (block.kind === "featured") {
        const matchedItems = block.items.filter((it) => it.name.toLowerCase().includes(query));
        if (matchedItems.length > 0) {
          return { ...block, items: matchedItems };
        }
      } else if (block.kind === "links") {
        const matchedItems = block.items.filter(
          (it) =>
            it.name.toLowerCase().includes(query) ||
            (it.desc && it.desc.toLowerCase().includes(query))
        );
        if (matchedItems.length > 0) {
          return { ...block, items: matchedItems };
        }
      } else if (block.kind === "sources") {
        const matchedRows = block.rows
          .map((row) => {
            const matchedItems = row.items.filter((it) => it.name.toLowerCase().includes(query));
            return { ...row, items: matchedItems };
          })
          .filter((row) => row.items.length > 0);

        if (matchedRows.length > 0) {
          return { ...block, rows: matchedRows };
        }
      } else if (block.kind === "mixed") {
        const matchedGroups = block.groups
          .map((g) => {
            const matchedItems = g.items.filter(
              (it) =>
                it.name.toLowerCase().includes(query) ||
                (it.desc && it.desc.toLowerCase().includes(query))
            );
            return { ...g, items: matchedItems };
          })
          .filter((g) => g.items.length > 0);

        if (matchedGroups.length > 0) {
          return { ...block, groups: matchedGroups };
        }
      }

      return null;
    })
    .filter((b): b is NavBlock => b !== null);

  // 统计最终过滤后显示的链接数
  const totalLinksCount = filteredBlocks.reduce((acc, block) => {
    if (block.kind === "featured" || block.kind === "links") {
      return acc + block.items.length;
    }
    if (block.kind === "sources") {
      return acc + block.rows.reduce((sum, r) => sum + r.items.length, 0);
    }
    if (block.kind === "mixed") {
      return acc + block.groups.reduce((sum, g) => sum + g.items.length, 0);
    }
    return acc;
  }, 0);

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* 左侧海克斯科技风格导航栏 */}
      <aside className="w-52 flex-shrink-0 flex flex-col justify-between bg-hex-bg-2/30 border border-hex-gold-dark/20 rounded-lg p-4">
        <div className="space-y-5">
          <div className="px-1.5 pb-2 border-b border-hex-gold-dark/10">
            <h2 className="text-xs font-display font-bold text-hex-gold tracking-widest uppercase">
              导航分类
            </h2>
            <p className="text-[9px] text-hex-text-muted mt-0.5 tracking-wider font-mono">
              MATERIAL NAVIGATION
            </p>
          </div>

          <nav className="space-y-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => {
                    setActiveCategory(cat.key);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 group text-left ${
                    isActive
                      ? "bg-hex-gold-dark/20 text-hex-gold border-l-2 border-hex-gold shadow-[inset_1px_0_0_rgba(200,170,110,0.1)] font-bold"
                      : "text-hex-text-muted hover:text-hex-gold-light hover:bg-hex-panel/20 border-l-2 border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive
                        ? "text-hex-gold"
                        : "text-hex-text-muted group-hover:text-hex-gold-light"
                    }`}
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 底部小标志 */}
        <div className="px-1.5 pt-3 border-t border-hex-gold-dark/10 flex items-center gap-1.5 text-[10px] text-hex-text-muted select-none">
          <Sparkles className="w-3 h-3 text-hex-gold animate-pulse" />
          <span>Lol Material Nav</span>
        </div>
      </aside>

      {/* 右侧主显示面板 */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* 顶部工具栏: 搜索与统计 */}
        <div className="flex-shrink-0 flex items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
              <Search className="w-4 h-4 text-hex-text-muted" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜寻原画、音效、3D模型..."
              className="w-full bg-hex-bg-2/50 text-hex-text placeholder-hex-text-muted/50 pl-9 pr-9 py-1.5 rounded border border-hex-gold-dark/30 focus:border-hex-gold focus:outline-none text-xs transition-all duration-300 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-hex-text-muted hover:text-hex-gold-light"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="text-[11px] text-hex-text-muted bg-hex-bg-2/30 px-2.5 py-1.5 rounded border border-hex-gold-dark/10 flex items-center gap-1 tracking-wide">
            <span>找到</span>
            <span className="font-bold text-hex-gold px-0.5">{totalLinksCount}</span>
            <span>个资源</span>
          </div>
        </div>

        {/* 卡片展示区域 */}
        <div className="flex-1 overflow-auto pr-1">
          {filteredBlocks.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-4">
              {filteredBlocks.map((block, bi) => (
                <Block key={bi} block={block} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed border-hex-gold-dark/20 bg-hex-bg-2/10 p-6 text-center select-none">
              <ShieldAlert className="w-8 h-8 text-hex-gold/60 mb-2" />
              <p className="text-xs text-hex-gold-light font-medium">未找到匹配的资源项</p>
              <p className="text-[11px] text-hex-text-muted mt-1">请尝试更换分类或调整搜索词</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
