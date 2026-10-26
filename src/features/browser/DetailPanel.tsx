import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Download, FolderDown, History, Maximize2, MousePointerClick, Sparkles } from "lucide-react";
import type { Catalog, Champion, ExportItem, SkinArt } from "@/mygo";
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
import { championExportItems, championFullName, plainText, ROLE_LABELS, skinKey, tftKey } from "./sections";

/** 把一项素材另存为 */
async function saveAs(path: string, name: string) {
  try {
    const dest = await Assets.saveAs(path, name);
    if (dest) toast.success("已保存", { description: dest });
  } catch (e) {
    toast.error("保存失败", { description: errorMessage(e) });
  }
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

function ChampionDetail({ catalog, champion, skinId }: { catalog: Catalog; champion: Champion; skinId?: string }) {
  const historyArt = useUI((s) => s.historyArt);
  const setHistoryArt = useUI((s) => s.setHistoryArt);
  const select = useUI((s) => s.select);
  const baseSkins = champion.skins.filter((s) => s.parent == null);
  const skin = baseSkins.find((s) => skinKey(champion, s) === skinId) ?? baseSkins[0];
  const [variant, setVariant] = useState<Variant>("splash");
  const [lightbox, setLightbox] = useState(false);

  const patch = useHistoryPatch(catalog.version);
  const wantArt = historyArt || !!skin?.hasChromas;
  const art = useChampionArt(catalog.version, champion.key, wantArt && !!patch.data);
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
          </div>
        </div>
      </div>

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
        {skin && <div className="text-sm text-hex-gold-light">{skin.name}</div>}
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
        <div className="space-y-1.5">
          {champion.spells.map((sp) => (
            <div key={sp.slot + sp.name} className="flex items-start gap-2.5 rounded-md border border-transparent p-1 hover:border-border">
              <button type="button" title="另存为" onClick={() => saveAs(sp.icon, `${sp.slot === "P" ? "被动技能" : `${sp.slot}技能`} ${sp.name}.png`)}>
                <AssetImage path={sp.icon} alt={sp.name} className="size-10 shrink-0 rounded-sm border border-hex-gold-dark" />
              </button>
              <div className="min-w-0">
                <div className="text-sm text-hex-gold-light">
                  <span className="mr-1.5 font-mono text-xs text-hex-blue">{sp.slot}</span>
                  {sp.name}
                </div>
                {sp.description && <p className="line-clamp-3 text-[11px] leading-relaxed whitespace-pre-line text-muted-foreground">{plainText(sp.description)}</p>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Button className="w-full gap-2" onClick={() => exportTo(`${championFullName(champion)}-${catalog.version}`, championExportItems(champion))}>
        <FolderDown className="size-4" /> 导出该英雄全部素材
      </Button>
    </div>
  );
}

/** 只有一张图的素材详情:装备、符文、召唤师技能、云顶 */
function SimpleDetail({ title, subtitle, icon, lines, fileName }: { title: string; subtitle?: string; icon: string; lines?: string[]; fileName: string }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center rounded-md border border-hex-gold-dark/60 bg-hex-bg-2 p-6">
        <AssetImage path={icon} alt={title} fit="contain" className="size-32 bg-transparent" />
      </div>
      <div>
        <div className="font-heading text-xl font-bold text-hex-gold">{title}</div>
        {subtitle && <div className="text-sm text-hex-gold-light">{subtitle}</div>}
      </div>
      {lines?.filter(Boolean).map((l) => (
        <p key={l} className="text-sm leading-relaxed text-muted-foreground">
          {l}
        </p>
      ))}
      <Button variant="outline" className="w-full gap-2" onClick={() => saveAs(icon, fileName)}>
        <Download className="size-4" /> 另存为
      </Button>
    </div>
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
        if (it)
          body = (
            <SimpleDetail
              title={it.name}
              subtitle={it.gold ? `${it.gold} 金币 · ID ${it.id}` : `ID ${it.id}`}
              icon={it.icon}
              lines={[it.plaintext, it.inStore ? "" : "不在商店出售"]}
              fileName={`${it.name}.png`}
            />
          );
        break;
      }
      case "rune": {
        for (const st of catalog.runeStyles) {
          if (`style-${st.id}` === selection.id) body = <SimpleDetail title={st.name} subtitle="符文系" icon={st.icon} fileName={`${st.name}.png`} />;
          const r = st.runes.find((x) => x.id === selection.id);
          if (r) body = <SimpleDetail title={r.name} subtitle={`${st.name} · ${r.slot === 0 ? "基石" : `第 ${r.slot} 行`}`} icon={r.icon} fileName={`${r.name}.png`} />;
        }
        const legacy = [...catalog.legacyRunes.map((r) => ({ ...r, id: `rune-${r.id}`, group: "符文" })), ...catalog.masteries.map((m) => ({ ...m, id: `mastery-${m.id}`, group: "天赋" }))];
        const l = legacy.find((x) => x.id === selection.id);
        if (l) body = <SimpleDetail title={l.name} subtitle={`${l.group}(7.23 及以前)`} icon={l.icon} fileName={`${l.name}.png`} />;
        break;
      }
      case "named": {
        const s = catalog[selection.group].find((x) => x.id === selection.id);
        if (s) body = <SimpleDetail title={s.name} subtitle="召唤师技能" icon={s.icon} fileName={`${s.name}.png`} />;
        break;
      }
      case "tft": {
        const e = catalog.tft.find((x) => tftKey(x) === selection.id);
        if (e) body = <SimpleDetail title={e.name} subtitle={[e.category, e.set && `S${e.set}`, e.id].filter(Boolean).join(" · ")} icon={e.icon} fileName={`${e.name}.png`} />;
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
