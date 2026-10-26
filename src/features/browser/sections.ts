import type { Catalog, Champion, ExportItem, Skin } from "@/mygo";
import { diffEntries, matches, type DiffState } from "@/lib/assets";
import type { DiffFilter } from "@/store/ui";
import type { GridEntry } from "./AssetGrid";

/** 英雄定位(Data Dragon tags)的中文名 */
export const ROLE_LABELS: Record<string, string> = {
  Fighter: "战士",
  Tank: "坦克",
  Mage: "法师",
  Assassin: "刺客",
  Marksman: "射手",
  Support: "辅助",
};

/** 云顶分类,顺序同汉化配置 */
export const TFT_CATEGORIES = ["弈子", "羁绊", "装备", "海克斯强化", "小小英雄", "棋盘皮肤", "地区传送门"];

/** 各分区的筛选条件 */
export interface Filters {
  role: string;
  storeOnly: boolean;
  itemTag: string;
  tftCategory: string;
  tftSet: string;
}

export const DEFAULT_FILTERS: Filters = { role: "", storeOnly: true, itemTag: "", tftCategory: "弈子", tftSet: "" };

export const championFullName = (c: Champion) => `${c.name} ${c.title}`.trim();

/** 皮肤的稳定 ID:新版本有全局 ID,极早期版本没有时用 英雄_序号 */
export const skinKey = (c: Champion, s: Skin) => s.id || `${c.id}_${s.num}`;

/** 一个分区经筛选、对比后的结果 */
export interface SectionResult {
  entries: GridEntry[];
  /** 当前版本(不含已移除)可导出的素材 */
  exportItems: ExportItem[];
  total: number;
}

/** 按差异筛选并给条目打上差异标记;已移除的条目来自对比版本 */
function withDiff(
  current: GridEntry[],
  removed: GridEntry[],
  diff: { state: Map<string, DiffState>; previousName: Map<string, string> } | null,
  filter: DiffFilter,
): GridEntry[] {
  if (!diff) return current;
  const marked = [...current, ...removed].map((e) => ({
    ...e,
    diff: diff.state.get(e.id),
    previousName: diff.previousName.get(e.id),
  }));
  return filter === "all" ? marked : marked.filter((e) => e.diff === filter);
}

/** 导出名重名时追加 ID,避免互相覆盖 */
function dedupe(items: (ExportItem & { id: string })[]): ExportItem[] {
  const count = new Map<string, number>();
  for (const it of items) count.set(it.name, (count.get(it.name) ?? 0) + 1);
  return items.map(({ id, path, name }) => {
    if ((count.get(name) ?? 0) < 2) return { path, name };
    const dot = name.lastIndexOf(".");
    return { path, name: `${name.slice(0, dot)} (${id})${name.slice(dot)}` };
  });
}

function ext(path: string) {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i) : ".png";
}

export function championsSection(cat: Catalog, cmp: Catalog | undefined, q: string, f: Filters, df: DiffFilter): SectionResult {
  const pick = (c: Catalog) =>
    c.champions.filter((ch) => (!f.role || ch.tags.includes(f.role)) && matches(q, ch.name, ch.title, ch.id));
  const toEntry = (ch: Champion): GridEntry => ({ id: ch.id, title: ch.name, subtitle: ch.title, image: ch.icon });
  const list = pick(cat);
  const diff = cmp ? diffEntries(list.map((c) => ({ id: c.id, name: championFullName(c) })), pick(cmp).map((c) => ({ id: c.id, name: championFullName(c) }))) : null;
  const removed = diff ? pick(cmp!).filter((c) => diff.removed.some((r) => r.id === c.id)).map(toEntry) : [];
  return {
    entries: withDiff(list.map(toEntry), removed, diff, df),
    total: list.length,
    exportItems: dedupe(list.map((c) => ({ id: c.id, path: c.icon, name: `英雄头像/${championFullName(c)}${ext(c.icon)}` }))),
  };
}

interface FlatSkin {
  champion: Champion;
  skin: Skin;
}

function flatSkins(c: Catalog, q: string): FlatSkin[] {
  const out: FlatSkin[] = [];
  for (const champion of c.champions) {
    for (const skin of champion.skins) {
      if (skin.parent != null) continue; // 炫彩在详情里看
      if (matches(q, skin.name, champion.name, champion.title, champion.id)) out.push({ champion, skin });
    }
  }
  return out;
}

export function skinsSection(cat: Catalog, cmp: Catalog | undefined, q: string, df: DiffFilter): SectionResult {
  const toEntry = ({ champion, skin }: FlatSkin): GridEntry => ({
    id: skinKey(champion, skin),
    title: skin.name,
    subtitle: championFullName(champion),
    image: skin.loading,
  });
  const list = flatSkins(cat, q);
  const old = cmp ? flatSkins(cmp, q) : [];
  const diff = cmp
    ? diffEntries(
        list.map((s) => ({ id: skinKey(s.champion, s.skin), name: s.skin.name })),
        old.map((s) => ({ id: skinKey(s.champion, s.skin), name: s.skin.name })),
      )
    : null;
  const removed = diff ? old.filter((s) => diff.state.get(skinKey(s.champion, s.skin)) === "removed").map(toEntry) : [];
  return {
    entries: withDiff(list.map(toEntry), removed, diff, df),
    total: list.length,
    exportItems: dedupe(
      list.map(({ champion, skin }) => ({
        id: skinKey(champion, skin),
        path: skin.splash,
        name: `皮肤原画/${championFullName(champion)}/${skin.name}.jpg`,
      })),
    ),
  };
}

export function itemsSection(cat: Catalog, cmp: Catalog | undefined, q: string, f: Filters, df: DiffFilter): SectionResult {
  const pick = (c: Catalog) =>
    c.items.filter((it) => (!f.storeOnly || it.inStore) && (!f.itemTag || it.tags.includes(f.itemTag)) && matches(q, it.name, it.plaintext, it.id));
  const toEntry = (it: Catalog["items"][number]): GridEntry => ({
    id: it.id,
    title: it.name,
    subtitle: it.gold ? `${it.gold} 金币` : it.id,
    image: it.icon,
  });
  const list = pick(cat);
  const diff = cmp ? diffEntries(list, pick(cmp)) : null;
  return {
    entries: withDiff(list.map(toEntry), diff ? diff.removed.map(toEntry) : [], diff, df),
    total: list.length,
    exportItems: dedupe(list.map((it) => ({ id: it.id, path: it.icon, name: `装备/${it.name}${ext(it.icon)}` }))),
  };
}

/** 符文分组:新符文按系,旧版本为旧符文与天赋 */
export interface RuneGroup {
  key: string;
  title: string;
  icon?: string;
  entries: GridEntry[];
}

export function runesSection(cat: Catalog, cmp: Catalog | undefined, q: string, df: DiffFilter): { groups: RuneGroup[]; exportItems: ExportItem[]; total: number } {
  type Row = { id: string; name: string; icon: string; group: string; groupTitle: string; groupIcon?: string; folder: string };
  const rows = (c: Catalog): Row[] => [
    ...c.runeStyles.flatMap((st) => [
      { id: `style-${st.id}`, name: st.name, icon: st.icon, group: st.id, groupTitle: st.name, groupIcon: st.icon, folder: `符文/${st.name}` },
      ...st.runes.map((r) => ({ id: r.id, name: r.name, icon: r.icon, group: st.id, groupTitle: st.name, groupIcon: st.icon, folder: `符文/${st.name}` })),
    ]),
    ...c.legacyRunes.map((r) => ({ id: `rune-${r.id}`, name: r.name, icon: r.icon, group: "legacyRunes", groupTitle: "符文(7.23 及以前)", folder: "符文" })),
    ...c.masteries.map((m) => ({ id: `mastery-${m.id}`, name: m.name, icon: m.icon, group: "masteries", groupTitle: "天赋(7.23 及以前)", folder: "天赋" })),
  ];
  const list = rows(cat).filter((r) => matches(q, r.name, r.groupTitle));
  const old = cmp ? rows(cmp).filter((r) => matches(q, r.name, r.groupTitle)) : [];
  const diff = cmp ? diffEntries(list, old) : null;
  const all = withDiff(
    list.map((r) => ({ id: r.id, title: r.name, subtitle: r.groupTitle, image: r.icon })),
    diff ? diff.removed.map((r) => ({ id: r.id, title: r.name, subtitle: r.groupTitle, image: r.icon })) : [],
    diff,
    df,
  );
  const byId = new Map([...list, ...old].map((r) => [r.id, r]));
  const groups: RuneGroup[] = [];
  for (const e of all) {
    const r = byId.get(e.id)!;
    let g = groups.find((x) => x.key === r.group);
    if (!g) groups.push((g = { key: r.group, title: r.groupTitle, icon: r.groupIcon, entries: [] }));
    g.entries.push(e);
  }
  return {
    groups,
    total: list.length,
    exportItems: dedupe(list.map((r) => ({ id: r.id, path: r.icon, name: `${r.folder}/${r.name}${ext(r.icon)}` }))),
  };
}

export function summonersSection(cat: Catalog, cmp: Catalog | undefined, q: string, df: DiffFilter): SectionResult {
  const pick = (c: Catalog) => c.summoners.filter((s) => matches(q, s.name, s.id));
  const toEntry = (s: Catalog["summoners"][number]): GridEntry => ({ id: s.id, title: s.name, image: s.icon });
  const list = pick(cat);
  const diff = cmp ? diffEntries(list, pick(cmp)) : null;
  return {
    entries: withDiff(list.map(toEntry), diff ? diff.removed.map(toEntry) : [], diff, df),
    total: list.length,
    exportItems: dedupe(list.map((s) => ({ id: s.id, path: s.icon, name: `召唤师技能/${s.name}${ext(s.icon)}` }))),
  };
}

/** 云顶条目的 ID 在不同分类间可能重复,加上分类区分 */
export const tftKey = (e: Catalog["tft"][number]) => `${e.category}:${e.id || e.name}`;

export function tftSets(cat: Catalog, category: string): string[] {
  const sets = new Set(cat.tft.filter((e) => e.category === category && e.set).map((e) => e.set));
  return [...sets].sort((a, b) => Number(b) - Number(a));
}

export function tftSection(cat: Catalog, cmp: Catalog | undefined, q: string, f: Filters, df: DiffFilter): SectionResult {
  const pick = (c: Catalog) =>
    c.tft.filter((e) => e.category === f.tftCategory && (!f.tftSet || e.set === f.tftSet) && matches(q, e.name, e.id));
  const toEntry = (e: Catalog["tft"][number]): GridEntry => ({
    id: tftKey(e),
    title: e.name,
    subtitle: e.set ? `S${e.set}` : e.category,
    image: e.icon,
  });
  const list = pick(cat);
  const old = cmp ? pick(cmp) : [];
  const keyed = (l: typeof list) => l.map((e) => ({ id: tftKey(e), name: e.name }));
  const diff = cmp ? diffEntries(keyed(list), keyed(old)) : null;
  const removed = diff ? old.filter((e) => diff.state.get(tftKey(e)) === "removed").map(toEntry) : [];
  return {
    entries: withDiff(list.map(toEntry), removed, diff, df),
    total: list.length,
    exportItems: dedupe(
      list.map((e) => ({ id: e.id, path: e.icon, name: `云顶/${e.category}/${e.set ? `S${e.set} ` : ""}${e.name}${ext(e.icon)}` })),
    ),
  };
}

/** 一位英雄的全部素材:头像、技能、各皮肤四种原画 */
export function championExportItems(c: Champion): ExportItem[] {
  const base = championFullName(c);
  const items: (ExportItem & { id: string })[] = [{ id: "icon", path: c.icon, name: `${base}/头像${ext(c.icon)}` }];
  for (const sp of c.spells) {
    const label = sp.slot === "P" ? "被动技能" : `${sp.slot}技能`;
    items.push({ id: sp.slot + sp.name, path: sp.icon, name: `${base}/技能/${label} ${sp.name}${ext(sp.icon)}` });
  }
  for (const s of c.skins) {
    if (s.parent != null) continue;
    for (const [folder, path] of [
      ["插画", s.splash],
      ["聚焦图片", s.centered],
      ["加载界面", s.loading],
      ["皮肤头像", s.tile],
    ] as const) {
      if (path) items.push({ id: `${s.num}-${folder}`, path, name: `${base}/${folder}/${s.name}.jpg` });
    }
  }
  return dedupe(items);
}

/** 去掉技能描述里的 HTML 标记 */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}
