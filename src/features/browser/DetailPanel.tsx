import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, Download, FolderDown, FolderInput, History, ImageDown, Maximize2, MousePointerClick, Sparkles, X } from "lucide-react";
import type { Catalog, Champion, ExportItem, Item, Skin, SkinArt } from "@/mygo";
import { Desktop, Tasks } from "@/mygo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, pickDirectory } from "@/lib/api";
import { useChampionArt, useHistoryPatch } from "@/lib/assets";
import { copyImage, copyText, ensureSaveDir, saveAsset, saveAssetAs } from "@/lib/save";
import { cn } from "@/lib/utils";
import { useUI, type DetailTab } from "@/store/ui";
import { AssetImage } from "./AssetImage";
import { plainText, RichText } from "./RichText";
import { RuneTree } from "./RuneTree";
import { championExportItems, championFullName, itemTagLabel, ROLE_LABELS, skinKey, tftKey, type RuneTreeRow } from "./sections";

/** 图上的小操作按钮:半透明玻璃底 */
function GlassButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="rounded-md bg-black/55 p-1.5 text-hex-gold-light backdrop-blur transition-colors hover:bg-black/75 hover:text-hex-gold"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 一张素材的常用操作:复制图片、保存到固定位置、另存为 */
function AssetActions({ path, name }: { path: string; name: string }) {
  if (!path) return null;
  return (
    <div className="flex gap-1">
      <GlassButton label="复制图片" onClick={() => copyImage(path)}>
        <Copy className="size-3.5" />
      </GlassButton>
      <GlassButton label="保存" onClick={() => saveAsset(path, name)}>
        <ImageDown className="size-3.5" />
      </GlassButton>
      <GlassButton label="另存为…" onClick={() => saveAssetAs(path, name)}>
        <FolderInput className="size-3.5" />
      </GlassButton>
    </div>
  );
}

function CopyButton({ text, label = "复制文本" }: { text: string; label?: string }) {
  if (!text.trim()) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={() => copyText(text)} className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Copy className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** 导出一组素材到固定保存位置下的 folder;第一次导出时先选位置 */
export async function exportTo(folder: string, items: ExportItem[]) {
  const saveDir = await ensureSaveDir();
  const dir = saveDir === "manual" ? await pickDirectory().catch(() => null) : saveDir;
  if (!dir) return;
  const sep = dir.includes("\\") ? "\\" : "/";
  try {
    const res = await Tasks.exportAssets(`${dir}${sep}${folder}`, items);
    toast.success(`已导出 ${res.written} 个文件`, {
      description: res.missing ? `${res.missing} 个官方已不提供 · ${res.dir}` : res.dir,
      action: { label: "打开文件夹", onClick: () => Desktop.openPath(res.dir) },
    });
  } catch (e) {
    toast.error("导出失败", { description: errorMessage(e) });
  }
}

function Section({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xs font-semibold tracking-[0.2em] text-hex-gold/80 uppercase">{title}</h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

interface Preview {
  path: string;
  title: string;
  fileName: string;
}

/** 点击看大图,大图里可复制、保存 */
function Lightbox({ preview, open, onOpenChange }: { preview: Preview | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,1400px)] border-hex-gold-dark p-2 sm:max-w-[min(92vw,1400px)]">
        <AssetImage path={preview?.path} alt={preview?.fileName ?? ""} fit="contain" className="h-[76vh] w-full bg-hex-bg" />
        <div className="flex items-center justify-between gap-2 px-1">
          <DialogTitle className="truncate text-sm font-normal text-hex-gold-light select-text">{preview?.title}</DialogTitle>
          {preview?.path && (
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyImage(preview.path)}>
                <Copy className="size-3.5" /> 复制图片
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => saveAssetAs(preview.path, preview.fileName)}>
                <FolderInput className="size-3.5" /> 另存为…
              </Button>
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => saveAsset(preview.path, preview.fileName)}>
                <Download className="size-3.5" /> 保存
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 原画下方的一排皮肤:滚轮横向滚动,选中的皮肤自动滚到中间 */
function SkinStrip({ champion, skins, current, tileOf }: { champion: Champion; skins: Skin[]; current?: Skin; tileOf: (s: Skin) => string }) {
  const select = useUI((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const currentId = current ? skinKey(champion, current) : "";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // 触控板横向滑动交给原生处理
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      // 滚到头了就让面板继续纵向滚动
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max - 1)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const btn = el?.querySelector<HTMLElement>(`[data-skin="${CSS.escape(currentId)}"]`);
    if (el && btn) el.scrollTo({ left: btn.offsetLeft - (el.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
  }, [currentId]);

  return (
    // contain:inline-size 让这一排不参与外层宽度计算;否则 ScrollArea 的 table 布局会被整排皮肤撑宽
    <div ref={ref} className="relative flex gap-1.5 overflow-x-auto p-0.5 pb-1.5 [contain:inline-size]">
      {skins.map((s) => {
        const id = skinKey(champion, s);
        const active = s === current;
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-skin={id}
                onClick={() => select({ kind: "champion", id: champion.id, skinId: id })}
                className={cn(
                  "relative size-14 shrink-0 overflow-hidden rounded-md transition-all",
                  active ? "ring-2 ring-hex-blue" : "opacity-70 ring-1 ring-white/10 hover:opacity-100 hover:ring-hex-gold/60",
                )}
              >
                <AssetImage path={tileOf(s)} alt={s.name} className="size-full" />
                {s.hasChromas && <Sparkles className="absolute top-0.5 right-0.5 size-3 text-hex-gold drop-shadow" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{s.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** 原画舞台:比例固定,图片完整显示,留白处用同一张图模糊铺底 */
function ArtStage({ path, alt, onOpen, children }: { path: string; alt: string; onOpen: () => void; children?: ReactNode }) {
  return (
    <div className="group relative aspect-[1215/717] w-full overflow-hidden bg-hex-bg">
      <button type="button" onClick={() => path && onOpen()} className="absolute inset-0 block">
        <AssetImage path={path} alt="" className="absolute inset-0 scale-110 bg-transparent opacity-50 blur-2xl" />
        <AssetImage path={path} alt={alt} fit="contain" className="absolute inset-0 bg-transparent" />
      </button>
      {children}
      {path && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <AssetActions path={path} name={alt} />
          <GlassButton label="看大图" onClick={onOpen}>
            <Maximize2 className="size-3.5" />
          </GlassButton>
        </div>
      )}
    </div>
  );
}

/** 分段选择器:同一组里选一项 */
function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" className="flex flex-1 rounded-md bg-black/30 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex-1 rounded-[5px] py-1 text-xs transition-colors",
            o.key === value ? "bg-hex-gold/15 text-hex-gold-light shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Variant = "splash" | "centered" | "loading" | "tile";
const VARIANTS: { key: Variant; label: string }[] = [
  { key: "splash", label: "插画" },
  { key: "centered", label: "聚焦" },
  { key: "loading", label: "加载" },
  { key: "tile", label: "头像" },
];

const RARITY: Record<string, string> = { kEpic: "史诗", kLegendary: "传说", kMythic: "神话", kUltimate: "终极" };

/** 皮肤稀有度、系列、背景(来自 CommunityDragon);皮肤名显示在原画上 */
function SkinInfo({ name, art }: { name: string; art?: SkinArt }) {
  const badges = [RARITY[art?.rarity ?? ""], art?.legacy ? "绝版" : "", ...(art?.skinLines ?? [])].filter(Boolean);
  if (badges.length === 0 && !art?.description) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {badges.map((b) => (
          <Badge key={b} variant="outline" className="h-5 px-1.5 text-[10px] text-hex-gold">
            {b}
          </Badge>
        ))}
        {art?.description && (
          <span className="ml-auto">
            <CopyButton text={`${name}\n${plainText(art.description)}`} />
          </span>
        )}
      </div>
      {art?.description && <RichText text={art.description} />}
    </div>
  );
}

const INFO: { key: keyof Champion["info"]; label: string }[] = [
  { key: "attack", label: "攻击" },
  { key: "defense", label: "防御" },
  { key: "magic", label: "法术" },
  { key: "difficulty", label: "上手难度" },
];

/** 背景故事 + 官方四项评分 */
function ChampionIntro({ champion }: { champion: Champion }) {
  const [full, setFull] = useState(false);
  const text = full ? champion.lore : champion.blurb || champion.lore;
  const hasMore = !!champion.lore && plainText(champion.lore) !== plainText(champion.blurb);
  const hasInfo = INFO.some((i) => champion.info?.[i.key]);
  if (!text && !hasInfo) return null;
  return (
    <Section title="背景" extra={<CopyButton text={`${championFullName(champion)}\n${plainText(champion.lore || champion.blurb)}`} label="复制背景故事" />}>
      {text && <RichText text={text} />}
      {hasMore && (
        <button type="button" onClick={() => setFull(!full)} className="text-xs text-hex-blue hover:underline">
          {full ? "收起" : "阅读全文"}
        </button>
      )}
      {hasInfo && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
          {INFO.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="w-12 shrink-0">{label}</span>
              <div className="flex flex-1 gap-px">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={cn("h-1.5 flex-1 rounded-[1px]", i < champion.info[key] ? "bg-hex-gold" : "bg-border")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/** 使用技巧 / 对抗技巧 */
function ChampionTips({ champion }: { champion: Champion }) {
  const lists = [
    { title: "使用技巧", tips: champion.allyTips ?? [] },
    { title: "对抗技巧", tips: champion.enemyTips ?? [] },
  ].filter((l) => l.tips.length > 0);
  return (
    <>
      {lists.map((l) => (
        <Section key={l.title} title={l.title} extra={<CopyButton text={l.tips.map((t) => plainText(t)).join("\n")} />}>
          <ul className="space-y-1">
            {l.tips.map((t) => (
              <li key={t} className="flex gap-1.5">
                <span className="text-xs text-hex-gold">•</span>
                <RichText text={t.replace(/^\s*-\s*/, "")} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  );
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** 基础属性:1 级数值与每级成长 */
function ChampionStats({ champion }: { champion: Champion }) {
  const st = champion.stats ?? {};
  const resource = champion.partype || "法力";
  const rows: { label: string; base?: number; per?: number; percent?: boolean }[] = [
    { label: "生命值", base: st.hp, per: st.hpperlevel },
    { label: "生命回复", base: st.hpregen, per: st.hpregenperlevel },
    { label: resource, base: st.mp, per: st.mpperlevel },
    { label: `${resource}回复`, base: st.mpregen, per: st.mpregenperlevel },
    { label: "攻击力", base: st.attackdamage, per: st.attackdamageperlevel },
    { label: "攻击速度", base: st.attackspeed, per: st.attackspeedperlevel, percent: true },
    { label: "护甲", base: st.armor, per: st.armorperlevel },
    { label: "魔法抗性", base: st.spellblock, per: st.spellblockperlevel },
    { label: "移动速度", base: st.movespeed },
    { label: "攻击距离", base: st.attackrange },
  ].filter((r) => r.base || r.per);
  if (rows.length === 0) return null;
  return (
    <Section title="基础属性">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-border/50 pb-0.5">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono text-hex-gold-light">
              {fmt(r.base ?? 0)}
              {r.per ? (
                <span className="ml-1 text-[10px] text-hex-blue">
                  +{fmt(r.per)}
                  {r.percent ? "%" : ""}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ChampionDetail({ catalog, champion, skinId }: { catalog: Catalog; champion: Champion; skinId?: string }) {
  const historyArt = useUI((s) => s.historyArt);
  const setHistoryArt = useUI((s) => s.setHistoryArt);
  const tab = useUI((s) => s.detailTab);
  const setTab = useUI((s) => s.setDetailTab);
  const baseSkins = champion.skins.filter((s) => s.parent == null);
  const skin = baseSkins.find((s) => skinKey(champion, s) === skinId) ?? baseSkins[0];
  const [variant, setVariant] = useState<Variant>("splash");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const showPreview = (p: Preview) => {
    setPreview(p);
    setPreviewOpen(true);
  };

  const patch = useHistoryPatch(catalog.version);
  // 皮肤背景、系列、炫彩都来自 CommunityDragon,有对应补丁就读取
  const art = useChampionArt(catalog.version, champion.key, !!patch.data);
  const artById = useMemo(() => new Map((art.data?.skins ?? []).map((s) => [s.id, s])), [art.data]);
  const skinArt: SkinArt | undefined = skin ? artById.get(skin.id) : undefined;

  const officialPath = skin ? { splash: skin.splash, centered: skin.centered, loading: skin.loading, tile: skin.tile }[variant] : "";
  const historyPath = skinArt
    ? { splash: skinArt.uncentered || skinArt.splash, centered: skinArt.splash, loading: skinArt.loadScreen, tile: skinArt.tile }[variant]
    : "";
  const path = historyArt ? historyPath : officialPath;
  const current = VARIANTS.find((v) => v.key === variant)!;
  const imageName = `${skin?.name ?? championFullName(champion)} ${current.label}.jpg`;

  let artNote = "官方原画只有最新版本";
  if (historyArt) {
    if (patch.isLoading || art.isLoading) artNote = "正在读取历史原画…";
    else if (!patch.data) artNote = "该版本没有历史原画(7.1 起提供)";
    else if (art.error) artNote = errorMessage(art.error);
    else if (!historyPath) artNote = `补丁 ${patch.data} 没有这张图`;
    else artNote = `补丁 ${patch.data} 的原画`;
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)} className="gap-4">
      {/* 头部固定在顶部:滚动时名字和导出按钮始终可见;面板窄时按钮只显示图标 */}
      <div className="@container sticky top-0 z-10 -mx-4 -mt-4 space-y-3 border-b border-border/60 bg-background/90 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <AssetImage path={champion.icon} alt={champion.name} className="size-11 shrink-0 rounded-md border border-hex-gold-dark" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading text-lg leading-tight font-bold text-hex-gold">{champion.name}</div>
            <div className="truncate text-xs text-hex-gold-light">{champion.title}</div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!path} onClick={() => saveAsset(path, imageName)}>
                  <Download className="size-3.5" />
                  <span className="hidden @sm:inline">保存当前图</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                保存「{skin?.name ?? championFullName(champion)}」{current.label}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => exportTo(`${championFullName(champion)}-${catalog.version}`, championExportItems(champion))}
                >
                  <FolderDown className="size-3.5" />
                  <span className="hidden @sm:inline">导出全部</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>导出该英雄全部素材</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="assets">素材</TabsTrigger>
          <TabsTrigger value="info">资料</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="assets" className="space-y-5">
        {/* 原画查看器:图片 + 决定显示哪张图的条件(图片类型、历史原画、皮肤)放在一起 */}
        <div className="overflow-hidden rounded-lg border border-hex-gold-dark/40 bg-hex-bg-2/40">
          <ArtStage path={path} alt={imageName} onOpen={() => showPreview({ path, title: skin?.name ?? championFullName(champion), fileName: imageName })}>
            {historyArt && (
              <span className="absolute top-2 left-2 max-w-[70%] truncate rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-hex-gold-light backdrop-blur">
                {artNote}
              </span>
            )}
            {skin && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-3 pt-8 pb-2 text-left">
                <span className="block truncate font-heading text-sm font-semibold text-hex-gold-light drop-shadow">{skin.name}</span>
              </span>
            )}
          </ArtStage>
          <div className="space-y-2.5 p-2.5">
            <div className="flex items-center gap-2">
              <Segmented value={variant} options={VARIANTS} onChange={setVariant} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    size="sm"
                    variant="outline"
                    pressed={historyArt}
                    onPressedChange={setHistoryArt}
                    className="h-7 gap-1 px-2 text-xs data-[state=on]:border-hex-blue/60 data-[state=on]:text-hex-blue"
                  >
                    <History className="size-3.5" />
                    历史
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>{historyArt ? artNote : `显示 ${catalog.version} 当时的原画;${artNote}`}</TooltipContent>
              </Tooltip>
            </div>
            <SkinStrip
              champion={champion}
              skins={baseSkins}
              current={skin}
              tileOf={(s) => (historyArt ? artById.get(s.id)?.tile || s.tile : s.tile)}
            />
          </div>
        </div>

        {skin && <SkinInfo name={skin.name} art={skinArt} />}

        {skin?.hasChromas && (
          <Section title={`炫彩 · ${skinArt?.chromas?.length ?? "…"}`}>
            {!patch.data ? (
              <div className="text-xs text-muted-foreground">该版本没有炫彩图(7.1 起提供)</div>
            ) : art.isLoading ? (
              <div className="text-xs text-muted-foreground">正在读取炫彩…</div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {(skinArt?.chromas ?? []).map((ch, i) => {
                  // 没有官方名称的炫彩按序号命名,不显示内部编号
                  const name = ch.name || `${skin.name} 炫彩 ${i + 1}`;
                  return (
                    <Tooltip key={ch.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => ch.image && showPreview({ path: ch.image, title: name, fileName: `${name}.png` })}
                          className="group relative overflow-hidden rounded-md bg-hex-bg-2/60 ring-1 ring-white/10 transition-all hover:ring-hex-gold/60"
                        >
                          <AssetImage path={ch.image} alt={name} fit="contain" className="aspect-square w-full bg-transparent" />
                          <div className="flex h-1.5">
                            {(ch.colors ?? []).map((c, j) => (
                              <span key={j} className="flex-1" style={{ background: c }} />
                            ))}
                          </div>
                          <Maximize2 className="absolute top-1 right-1 size-3 text-hex-gold-light opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{name}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        <Lightbox preview={preview} open={previewOpen} onOpenChange={setPreviewOpen} />
      </TabsContent>

      <TabsContent value="info" className="space-y-5">
        <div className="flex flex-wrap gap-1">
          {champion.tags.map((t) => (
            <Badge key={t} variant="outline" className="h-5 border-hex-blue/40 px-1.5 text-[10px] text-hex-blue">
              {ROLE_LABELS[t] ?? t}
            </Badge>
          ))}
          {champion.partype && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
              {champion.partype}
            </Badge>
          )}
        </div>

        <ChampionIntro champion={champion} />

        <Section title="技能">
          <div className="space-y-2">
            {champion.spells.map((sp) => {
              const meta = [
                sp.cooldown && `冷却 ${sp.cooldown} 秒`,
                sp.cost && `消耗 ${sp.cost}`,
                sp.range && `距离 ${sp.range === "25000" ? "全图" : sp.range}`,
              ].filter(Boolean);
              return (
                <div key={sp.slot + sp.name} className="group/spell flex items-start gap-2.5 rounded-md border border-transparent p-1.5 hover:border-border">
                  <button
                    type="button"
                    title="另存为"
                    onClick={() => saveAsset(sp.icon, `${sp.slot === "P" ? "被动技能" : `${sp.slot}技能`} ${sp.name}.png`)}
                    className="group/icon relative shrink-0"
                  >
                    <AssetImage path={sp.icon} alt={sp.name} className="size-10 shrink-0 rounded-sm border border-hex-gold-dark" />
                    <span className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/55 opacity-0 transition-opacity group-hover/icon:opacity-100">
                      <Download className="size-4 text-hex-gold-light" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-sm text-hex-gold-light">
                      <span className="font-mono text-xs text-hex-blue">{sp.slot}</span>
                      <span className="truncate">{sp.name}</span>
                      <span className="ml-auto opacity-0 transition-opacity group-hover/spell:opacity-100">
                        <CopyButton text={`${sp.name}\n${plainText(sp.description)}`} />
                      </span>
                    </div>
                    {meta.length > 0 && <div className="text-[11px] text-hex-blue/80">{meta.join(" · ")}</div>}
                    <RichText text={sp.description} className="text-[11px]" />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <ChampionTips champion={champion} />
        <ChampionStats champion={champion} />
      </TabsContent>
    </Tabs>
  );
}

/** 只有一张图的素材详情:装备、符文、召唤师技能、云顶 */
function SimpleDetail({
  title,
  subtitle,
  icon,
  fileName,
  badges,
  copy,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  fileName: string;
  badges?: string[];
  copy?: string;
  children?: ReactNode;
}) {
  const shown = (badges ?? []).filter(Boolean);
  return (
    <div className="space-y-4">
      {/* 标题在左、图标在右,图标保持素材原本的小尺寸 */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate font-heading text-xl font-bold text-hex-gold">{title}</div>
            {copy && <CopyButton text={`${title}\n${copy}`} />}
          </div>
          {subtitle && <div className="text-sm text-hex-gold-light">{subtitle}</div>}
          {shown.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {shown.map((b) => (
                <Badge key={b} variant="outline" className="h-5 border-hex-blue/40 px-1.5 text-[10px] text-hex-blue">
                  {b}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => copyImage(icon)}>
              <Copy className="size-3.5" /> 复制图片
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => saveAsset(icon, fileName)}>
              <Download className="size-3.5" /> 保存
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => saveAssetAs(icon, fileName)}>
              <FolderInput className="size-3.5" /> 另存为…
            </Button>
          </div>
        </div>
        <AssetImage path={icon} alt={fileName} fit="contain" className="size-16 shrink-0 rounded-lg bg-hex-bg-2/60 ring-1 ring-hex-gold-dark/60" />
      </div>
      {children}
    </div>
  );
}

/** 合成树里的一件装备:图标 + 总价,点击跳到该装备 */
function TreeNode({ item, active }: { item: Item; active: boolean }) {
  const select = useUI((s) => s.select);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={() => !active && select({ kind: "item", id: item.id })} className="flex flex-col items-center gap-0.5">
          <AssetImage
            path={item.icon}
            alt={item.name}
            className={cn(
              "size-10 rounded-sm border",
              active ? "border-hex-blue shadow-[0_0_10px_rgb(10_200_185/0.4)]" : "border-hex-gold-dark hover:border-hex-gold",
            )}
          />
          {item.gold > 0 && <span className="font-mono text-[10px] text-hex-gold">{item.gold}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{item.name}</TooltipContent>
    </Tooltip>
  );
}

/** 合成树的一个分支:装备在上,合成材料在下,用连线连起来 */
function TreeBranch({ id, items, currentId, depth }: { id: string; items: Map<string, Item>; currentId: string; depth: number }) {
  const item = items.get(id);
  if (!item) return null;
  // 深度上限防止数据里出现环
  const children = depth < 5 ? (item.from ?? []).filter((c) => items.has(c)) : [];
  return (
    <div className="flex flex-col items-center">
      <TreeNode item={item} active={item.id === currentId} />
      {children.length > 0 && (
        <>
          <span className="h-2.5 w-px bg-hex-gold-dark" />
          <div className="flex">
            {children.map((c, i) => (
              <div key={`${c}-${i}`} className="relative flex flex-col items-center px-1">
                {children.length > 1 && (
                  <span
                    className={cn(
                      "absolute top-0 h-px bg-hex-gold-dark",
                      i === 0 ? "right-0 left-1/2" : i === children.length - 1 ? "right-1/2 left-0" : "inset-x-0",
                    )}
                  />
                )}
                <span className="h-2.5 w-px bg-hex-gold-dark" />
                <TreeBranch id={c} items={items} currentId={currentId} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** 一排可点击的装备图标(可合成的上级装备) */
function ItemRow({ title, ids, items }: { title: string; ids: string[] | null; items: Map<string, Item> }) {
  const select = useUI((s) => s.select);
  // 只列商店里买得到的,模式专属的同名副本只留一件
  const seen = new Set<string>();
  const list = (ids ?? [])
    .map((id) => items.get(id))
    .filter((x): x is Item => !!x && x.inStore && !seen.has(x.name) && !!seen.add(x.name));
  if (list.length === 0) return null;
  return (
    <Section title={`${title} · ${list.length}`}>
      <div className="flex flex-wrap gap-1.5">
        {list.map((it, i) => (
          <Tooltip key={`${it.id}-${i}`}>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => select({ kind: "item", id: it.id })} className="overflow-hidden rounded-sm border border-hex-gold-dark hover:border-hex-gold">
                <AssetImage path={it.icon} alt={it.name} className="size-10" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {it.name}
              {it.gold ? ` · ${it.gold} 金币` : ""}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </Section>
  );
}

function ItemDetail({ catalog, item }: { catalog: Catalog; item: Item }) {
  const items = useMemo(() => new Map(catalog.items.map((x) => [x.id, x])), [catalog.items]);
  const gold = item.gold
    ? [`总价 ${item.gold}`, item.goldBase && item.goldBase !== item.gold ? `合成 ${item.goldBase}` : "", item.goldSell ? `出售 ${item.goldSell}` : ""]
    : [];
  return (
    <SimpleDetail
      title={item.name}
      subtitle={gold.filter(Boolean).join(" · ")}
      icon={item.icon}
      fileName={`${item.name}.png`}
      badges={[...(item.tags ?? []).map((t) => itemTagLabel(t) ?? ""), item.inStore ? "" : "不在商店出售"]}
      copy={[item.plaintext, plainText(item.description)].filter(Boolean).join("\n")}
    >
      {item.plaintext && <p className="text-sm text-hex-gold-light/90">{item.plaintext}</p>}
      <RichText text={item.description} className="text-[13px]" />
      {(item.from ?? []).length > 0 && (
        <Section title="合成树">
          {/* 宽的树在面板内横向滚动,不撑宽面板 */}
          <div className="overflow-x-auto pb-1 [contain:inline-size]">
            <div className="mx-auto w-max">
              <TreeBranch id={item.id} items={items} currentId={item.id} depth={0} />
            </div>
          </div>
        </Section>
      )}
      <ItemRow title="可合成" ids={item.into} items={items} />
    </SimpleDetail>
  );
}

/** 符文系详情:符文树始终在上面,点中某个符文后下面才显示它的图标与说明 */
function StyleDetail({ style, runeId }: { style: Catalog["runeStyles"][number]; runeId?: string }) {
  const select = useUI((s) => s.select);
  const rows: RuneTreeRow[] = [];
  for (const r of style.runes) {
    let row = rows.find((x) => x.slot === r.slot);
    if (!row) rows.push((row = { slot: r.slot, entries: [] }));
    row.entries.push({ id: r.id, title: r.name, image: r.icon });
  }
  rows.sort((a, b) => a.slot - b.slot);
  const r = style.runes.find((x) => x.id === runeId);
  const long = !!r?.longDesc && plainText(r.longDesc) !== plainText(r.shortDesc);
  return (
    <div className="space-y-5">
      <RuneTree
        styleId={style.id}
        title={style.name}
        icon={style.icon}
        rows={rows}
        selectedId={runeId}
        onSelect={(e) => select({ kind: "rune", id: e.id })}
        extra={
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => saveAsset(style.icon, `${style.name}.png`)} className="rounded-sm p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Download className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>保存「{style.name}」图标</TooltipContent>
          </Tooltip>
        }
      />
      {r ? (
        <SimpleDetail
          key={r.id}
          title={r.name}
          icon={r.icon}
          fileName={`${r.name}.png`}
          copy={plainText(r.longDesc || r.shortDesc)}
        >
          <RichText text={r.shortDesc} className="text-[13px] text-hex-gold-light/90" />
          {long && (
            <Section title="详细说明">
              <RichText text={r.longDesc} className="text-[13px]" />
            </Section>
          )}
        </SimpleDetail>
      ) : (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <MousePointerClick className="size-4 opacity-60" />
          点击符文查看图标与说明
        </div>
      )}
    </div>
  );
}

function RuneDetail({ catalog, id }: { catalog: Catalog; id: string }) {
  for (const st of catalog.runeStyles) {
    if (`style-${st.id}` === id) return <StyleDetail style={st} />;
    if (st.runes.some((x) => x.id === id)) return <StyleDetail style={st} runeId={id} />;
  }
  const legacy = [
    ...catalog.legacyRunes.map((r) => ({ ...r, key: `rune-${r.id}`, group: "符文" })),
    ...catalog.masteries.map((m) => ({ ...m, key: `mastery-${m.id}`, group: "天赋" })),
  ];
  const l = legacy.find((x) => x.key === id);
  if (!l) return null;
  return (
    <SimpleDetail title={l.name} subtitle={`${l.group}(7.23 及以前)`} icon={l.icon} fileName={`${l.name}.png`} copy={plainText(l.description)}>
      <RichText text={l.description} className="text-[13px]" />
    </SimpleDetail>
  );
}

/** 右侧详情面板 */
export function DetailPanel({ catalog }: { catalog: Catalog | undefined }) {
  const selection = useUI((s) => s.selection);
  const select = useUI((s) => s.select);

  // 顶栏左侧标明正在看的是哪类素材
  let kind = "";
  if (selection?.kind === "champion") kind = selection.skinId ? "皮肤" : "英雄";
  else if (selection?.kind === "item") kind = "装备";
  else if (selection?.kind === "rune") kind = selection.id.startsWith("mastery-") ? "天赋" : "符文";
  else if (selection?.kind === "named") kind = "召唤师技能";
  else if (selection?.kind === "tft") kind = `云顶 · ${selection.category}`;

  let body: ReactNode = (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <MousePointerClick className="size-6 opacity-60" />
      点击左侧素材查看详情
    </div>
  );
  if (catalog && selection) {
    switch (selection.kind) {
      case "champion": {
        const c = catalog.champions.find((x) => x.id === selection.id);
        if (c) body = <ChampionDetail key={c.id} catalog={catalog} champion={c} skinId={selection.skinId} />;
        break;
      }
      case "item": {
        const it = catalog.items.find((x) => x.id === selection.id);
        if (it) body = <ItemDetail key={it.id} catalog={catalog} item={it} />;
        break;
      }
      case "rune":
        body = <RuneDetail key={selection.id} catalog={catalog} id={selection.id} />;
        break;
      case "named": {
        const s = catalog[selection.group].find((x) => x.id === selection.id);
        if (s)
          body = (
            <SimpleDetail
              title={s.name}
              subtitle="召唤师技能"
              icon={s.icon}
              fileName={`${s.name}.png`}
              badges={[s.cooldown ? `冷却 ${s.cooldown} 秒` : "", s.level ? `召唤师等级 ${s.level} 解锁` : ""]}
              copy={plainText(s.description)}
            >
              <RichText text={s.description} className="text-[13px]" />
            </SimpleDetail>
          );
        break;
      }
      case "tft": {
        const e = catalog.tft.find((x) => tftKey(x) === selection.id);
        if (e)
          body = (
            <SimpleDetail
              title={e.name}
              subtitle={[e.category, e.set && `S${e.set}`].filter(Boolean).join(" · ")}
              icon={e.icon}
              fileName={`${e.name}.png`}
              badges={[e.cost ? `${e.cost} 费` : "", e.category === "小小英雄" && e.tier ? `等级 ${e.tier}` : ""]}
              copy={plainText(e.description)}
            >
              <RichText text={e.description} className="text-[13px]" />
            </SimpleDetail>
          );
        break;
      }
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 不随内容滚动的顶栏,关闭按钮始终点得到 */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border/60 pr-1.5 pl-4">
        <span className="text-xs text-muted-foreground">{kind}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="关闭详情"
              onClick={() => select(null)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>关闭(Esc)</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4 select-text">{body}</div>
      </ScrollArea>
    </div>
  );
}
