import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Copy, Download, FolderDown, History, Maximize2, MousePointerClick, Sparkles } from "lucide-react";
import type { Catalog, Champion, ExportItem, Item, SkinArt } from "@/mygo";
import { Assets, Tasks } from "@/mygo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, pickDirectory } from "@/lib/api";
import { useChampionArt, useHistoryPatch } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { useUI } from "@/store/ui";
import { AssetImage } from "./AssetImage";
import { plainText, RichText } from "./RichText";
import { championExportItems, championFullName, itemTagLabel, ROLE_LABELS, skinKey, tftKey } from "./sections";

/** 把一项素材另存为 */
async function saveAs(path: string, name: string) {
  try {
    const dest = await Assets.saveAs(path, name);
    if (dest) toast.success("已保存", { description: dest });
  } catch (e) {
    toast.error("保存失败", { description: errorMessage(e) });
  }
}

/** 复制文本到剪贴板;WebView 拒绝剪贴板接口时退回 execCommand */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast.success("已复制");
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

/** 选目录后导出一组素材 */
export async function exportTo(folder: string, items: ExportItem[]) {
  const dir = await pickDirectory().catch(() => null);
  if (!dir) return;
  const sep = dir.includes("\\") ? "\\" : "/";
  try {
    const res = await Tasks.exportAssets(`${dir}${sep}${folder}`, items);
    toast.success(`已导出 ${res.written} 个文件`, {
      description: res.missing ? `${res.missing} 个官方已不提供 · ${res.dir}` : res.dir,
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

/** 点击看大图 */
function Lightbox({ path, title, open, onOpenChange }: { path: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,1400px)] border-hex-gold-dark p-2 sm:max-w-[min(92vw,1400px)]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <AssetImage path={path} alt={title} fit="contain" className="h-[80vh] w-full bg-hex-bg" />
      </DialogContent>
    </Dialog>
  );
}

type Variant = "splash" | "centered" | "loading" | "tile";
const VARIANTS: { key: Variant; label: string; aspect: string }[] = [
  { key: "splash", label: "插画", aspect: "1215 / 717" },
  { key: "centered", label: "聚焦", aspect: "1280 / 720" },
  { key: "loading", label: "加载", aspect: "308 / 560" },
  { key: "tile", label: "头像", aspect: "1 / 1" },
];

const RARITY: Record<string, string> = { kEpic: "史诗", kLegendary: "传说", kMythic: "神话", kUltimate: "终极" };

/** 皮肤名称 + 稀有度、系列、背景(来自 CommunityDragon) */
function SkinInfo({ name, art }: { name: string; art?: SkinArt }) {
  const badges = [RARITY[art?.rarity ?? ""], art?.legacy ? "绝版" : "", ...(art?.skinLines ?? [])].filter(Boolean);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold text-hex-gold-light">{name}</span>
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
  const select = useUI((s) => s.select);
  const baseSkins = champion.skins.filter((s) => s.parent == null);
  const skin = baseSkins.find((s) => skinKey(champion, s) === skinId) ?? baseSkins[0];
  const [variant, setVariant] = useState<Variant>("splash");
  const [lightbox, setLightbox] = useState(false);

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
  const imageName = `${skin?.name ?? championFullName(champion)}.jpg`;

  let artNote = "官方原画只有最新版本";
  if (historyArt) {
    if (patch.isLoading || art.isLoading) artNote = "正在读取历史原画…";
    else if (!patch.data) artNote = "CommunityDragon 没有该版本(7.1 起提供)";
    else if (art.error) artNote = errorMessage(art.error);
    else if (!historyPath) artNote = `补丁 ${patch.data} 没有这张图`;
    else artNote = `补丁 ${patch.data} 的原画 · CommunityDragon`;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <AssetImage path={champion.icon} alt={champion.name} className="size-14 shrink-0 rounded-md border border-hex-gold-dark" />
        <div className="min-w-0">
          <div className="truncate font-heading text-xl font-bold text-hex-gold">{champion.name}</div>
          <div className="truncate text-sm text-hex-gold-light">{champion.title}</div>
          <div className="mt-1 flex gap-1">
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
        </div>
      </div>

      <ChampionIntro champion={champion} />

      <Section
        title="原画"
        extra={
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <History className="size-3.5" />
            该版本历史原画
            <Switch checked={historyArt} onCheckedChange={setHistoryArt} className="scale-90" />
          </label>
        }
      >
        <ToggleGroup type="single" size="sm" variant="outline" value={variant} onValueChange={(v) => v && setVariant(v as Variant)}>
          {VARIANTS.map((v) => (
            <ToggleGroupItem key={v.key} value={v.key} className="px-3 text-xs">
              {v.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <button
          type="button"
          onClick={() => path && setLightbox(true)}
          className="group relative block w-full overflow-hidden rounded-md border border-hex-gold-dark/60"
        >
          <AssetImage
            path={path}
            alt={imageName}
            fit="contain"
            className={cn("w-full bg-hex-bg", variant === "loading" ? "mx-auto max-h-96" : "")}
            style={{ aspectRatio: current.aspect, maxHeight: variant === "loading" ? 384 : undefined }}
          />
          {path && (
            <Maximize2 className="absolute top-2 right-2 size-4 text-hex-gold-light opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
          )}
        </button>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{artNote}</span>
          <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" disabled={!path} onClick={() => saveAs(path, imageName)}>
            <Download className="size-3.5" /> 另存为
          </Button>
        </div>
        <Lightbox path={path} title={imageName} open={lightbox} onOpenChange={setLightbox} />
      </Section>

      <Section title={`皮肤 · ${baseSkins.length}`}>
        <div className="grid grid-cols-4 gap-1.5">
          {baseSkins.map((s) => {
            const id = skinKey(champion, s);
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => select({ kind: "champion", id: champion.id, skinId: id })}
                    className={cn(
                      "relative overflow-hidden rounded-sm border transition-all",
                      s === skin ? "border-hex-blue shadow-[0_0_10px_rgb(10_200_185/0.4)]" : "border-border hover:border-hex-gold/70",
                    )}
                  >
                    <AssetImage path={historyArt ? artById.get(s.id)?.tile || s.tile : s.tile} alt={s.name} className="aspect-square w-full" />
                    {s.hasChromas && <Sparkles className="absolute top-0.5 right-0.5 size-3 text-hex-gold drop-shadow" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{s.name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        {skin && <SkinInfo name={skin.name} art={skinArt} />}
      </Section>

      {skin?.hasChromas && (
        <Section title={`炫彩 · ${skinArt?.chromas?.length ?? "…"}`}>
          {!patch.data ? (
            <div className="text-xs text-muted-foreground">炫彩图来自 CommunityDragon,该版本不提供(7.1 起)</div>
          ) : art.isLoading ? (
            <div className="text-xs text-muted-foreground">正在读取炫彩…</div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {(skinArt?.chromas ?? []).map((ch) => (
                <Tooltip key={ch.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => ch.image && saveAs(ch.image, `${ch.name || ch.id}.png`)}
                      className="overflow-hidden rounded-sm border border-border bg-hex-bg-2 hover:border-hex-gold/70"
                    >
                      <AssetImage path={ch.image} alt={ch.name} fit="contain" className="aspect-square w-full bg-transparent" />
                      <div className="flex h-1.5">
                        {(ch.colors ?? []).map((c) => (
                          <span key={c} className="flex-1" style={{ background: c }} />
                        ))}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{ch.name || ch.id} · 点击另存</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </Section>
      )}

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
                <button type="button" title="另存为" onClick={() => saveAs(sp.icon, `${sp.slot === "P" ? "被动技能" : `${sp.slot}技能`} ${sp.name}.png`)}>
                  <AssetImage path={sp.icon} alt={sp.name} className="size-10 shrink-0 rounded-sm border border-hex-gold-dark" />
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

      <Button className="w-full gap-2" onClick={() => exportTo(`${championFullName(champion)}-${catalog.version}`, championExportItems(champion))}>
        <FolderDown className="size-4" /> 导出该英雄全部素材
      </Button>
    </div>
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
      <div className="flex justify-center rounded-md border border-hex-gold-dark/60 bg-hex-bg-2 p-6">
        <AssetImage path={icon} alt={title} fit="contain" className="size-32 bg-transparent" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="font-heading text-xl font-bold text-hex-gold">{title}</div>
          {copy && (
            <span className="ml-auto">
              <CopyButton text={`${title}\n${copy}`} />
            </span>
          )}
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
      </div>
      {children}
      <Button variant="outline" className="w-full gap-2" onClick={() => saveAs(icon, fileName)}>
        <Download className="size-4" /> 另存为
      </Button>
    </div>
  );
}

/** 一排可点击的装备图标(合成路线) */
function ItemRow({ title, ids, items }: { title: string; ids: string[] | null; items: Map<string, Item> }) {
  const select = useUI((s) => s.select);
  const list = (ids ?? []).map((id) => items.get(id)).filter((x): x is Item => !!x);
  if (list.length === 0) return null;
  return (
    <Section title={title}>
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
      subtitle={[...gold, `ID ${item.id}`].filter(Boolean).join(" · ")}
      icon={item.icon}
      fileName={`${item.name}.png`}
      badges={[...(item.tags ?? []).map((t) => itemTagLabel(t) ?? ""), item.inStore ? "" : "不在商店出售"]}
      copy={[item.plaintext, plainText(item.description)].filter(Boolean).join("\n")}
    >
      {item.plaintext && <p className="text-sm text-hex-gold-light/90">{item.plaintext}</p>}
      <RichText text={item.description} className="text-[13px]" />
      <ItemRow title="合成材料" ids={item.from} items={items} />
      <ItemRow title="可合成" ids={item.into} items={items} />
    </SimpleDetail>
  );
}

const slotLabel = (slot: number) => (slot === 0 ? "基石" : `第 ${slot} 行`);

function RuneDetail({ catalog, id }: { catalog: Catalog; id: string }) {
  const select = useUI((s) => s.select);
  for (const st of catalog.runeStyles) {
    if (`style-${st.id}` === id)
      return (
        <SimpleDetail title={st.name} subtitle="符文系" icon={st.icon} fileName={`${st.name}.png`}>
          <div className="space-y-1">
            {st.runes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => select({ kind: "rune", id: r.id })}
                className="flex w-full items-start gap-2.5 rounded-md p-1.5 text-left hover:bg-accent/40"
              >
                <AssetImage path={r.icon} alt={r.name} fit="contain" className="size-9 shrink-0 bg-transparent" />
                <div className="min-w-0">
                  <div className="text-sm text-hex-gold-light">
                    {r.name}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{slotLabel(r.slot)}</span>
                  </div>
                  <RichText text={r.shortDesc} className="text-[11px]" />
                </div>
              </button>
            ))}
          </div>
        </SimpleDetail>
      );
    const r = st.runes.find((x) => x.id === id);
    if (r) {
      const long = !!r.longDesc && plainText(r.longDesc) !== plainText(r.shortDesc);
      return (
        <SimpleDetail
          title={r.name}
          subtitle={`${st.name} · ${slotLabel(r.slot)}`}
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
      );
    }
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
              subtitle={[e.category, e.set && `S${e.set}`, e.id].filter(Boolean).join(" · ")}
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
    <ScrollArea className="h-full">
      <div className="p-4">{body}</div>
    </ScrollArea>
  );
}
