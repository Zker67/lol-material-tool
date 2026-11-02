import type { Catalog, Champion, ExportItem, Skin, TFTSeason, TFTUnit } from "@/mygo";
import { diffEntries, matches, type DiffState } from "@/lib/assets";
import type { DiffFilter } from "@/store/ui";
import type { GridEntry, GridGroup } from "./AssetGrid";

/** 英雄定位(Data Dragon tags)的中文名 */
export const ROLE_LABELS: Record<string, string> = {
  Fighter: "战士",
  Tank: "坦克",
  Mage: "法师",
  Assassin: "刺客",
  Marksman: "射手",
  Support: "辅助",
};

/** 装备属性标签的中文名;早期版本的标签是全大写,比较时忽略大小写 */
export const ITEM_TAGS: Record<string, string> = {
  Boots: "鞋子",
  Damage: "攻击力",
  CriticalStrike: "暴击",
  AttackSpeed: "攻速",
  SpellDamage: "法术强度",
  Mana: "法力",
  Health: "生命值",
  Armor: "护甲",
  SpellBlock: "魔抗",
  AbilityHaste: "技能急速",
  LifeSteal: "生命偷取",
  Consumable: "消耗品",
  Trinket: "饰品",
  Vision: "视野",
};

const ITEM_TAG_BY_LOWER = new Map(Object.entries(ITEM_TAGS).map(([k, v]) => [k.toLowerCase(), v]));
export const itemTagLabel = (tag: string) => ITEM_TAG_BY_LOWER.get(tag.toLowerCase());

/** 各分区的筛选条件 */
export interface Filters {
  role: string;
  storeOnly: boolean;
  itemTag: string;
  tftCategory: string;
  /** 云顶赛季,各分类共用:null 为还没选过(用该版本的默认赛季),"" 为全部赛季 */
  tftSet: string | null;
  /** 英雄分区按英雄还是按皮肤显示 */
  championView: ChampionView;
  /** 皮肤显示时只看某位英雄(英雄 ID),空为全部 */
  skinChampion: string;
  /** 弈子筛选,空为不限:费用("1"–"5",other 为其他费用)、羁绊名称、定位、伤害类型、攻击距离(格) */
  tftCost: string;
  tftTrait: string;
  tftRole: string;
  tftDamage: string;
  tftRange: string;
}

export type ChampionView = "champions" | "skins";

export const DEFAULT_FILTERS: Filters = {
  role: "",
  storeOnly: true,
  itemTag: "",
  tftCategory: "弈子",
  tftSet: null,
  championView: "champions",
  skinChampion: "",
  tftCost: "",
  tftTrait: "",
  tftRole: "",
  tftDamage: "",
  tftRange: "",
};

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

function flatSkins(c: Catalog, q: string, f: Filters): FlatSkin[] {
  const out: FlatSkin[] = [];
  for (const champion of c.champions) {
    if (f.skinChampion && champion.id !== f.skinChampion) continue;
    if (f.role && !champion.tags.includes(f.role)) continue;
    for (const skin of champion.skins) {
      if (skin.parent != null) continue; // 炫彩在详情里看
      if (matches(q, skin.name, champion.name, champion.title, champion.id)) out.push({ champion, skin });
    }
  }
  return out;
}

/** 皮肤按英雄分组;每组标题是英雄,点标题看英雄详情 */
export function skinsSection(
  cat: Catalog,
  cmp: Catalog | undefined,
  q: string,
  f: Filters,
  df: DiffFilter,
): SectionResult & { groups: GridGroup[] } {
  const toEntry = ({ champion, skin }: FlatSkin): GridEntry => ({
    id: skinKey(champion, skin),
    title: skin.name,
    subtitle: skin.num === 0 ? "经典皮肤" : undefined,
    image: skin.loading,
  });
  const list = flatSkins(cat, q, f);
  const old = cmp ? flatSkins(cmp, q, f) : [];
  const diff = cmp
    ? diffEntries(
        list.map((s) => ({ id: skinKey(s.champion, s.skin), name: s.skin.name })),
        old.map((s) => ({ id: skinKey(s.champion, s.skin), name: s.skin.name })),
      )
    : null;
  const removed = diff ? old.filter((s) => diff.state.get(skinKey(s.champion, s.skin)) === "removed").map(toEntry) : [];
  const entries = withDiff(list.map(toEntry), removed, diff, df);

  const owner = new Map([...old, ...list].map((s) => [skinKey(s.champion, s.skin), s.champion]));
  const groups = new Map<string, GridGroup>();
  for (const e of entries) {
    const c = owner.get(e.id)!;
    let g = groups.get(c.id);
    if (!g) groups.set(c.id, (g = { key: c.id, title: c.name, subtitle: c.title, icon: c.icon, entries: [] }));
    g.entries.push(e);
  }
  return {
    entries,
    groups: [...groups.values()],
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
    c.items.filter((it) => (!f.storeOnly || it.inStore) && (!f.itemTag || it.tags.some((t) => t.toLowerCase() === f.itemTag.toLowerCase())) && matches(q, it.name, it.plaintext, it.id, it.description));
  const toEntry = (it: Catalog["items"][number]): GridEntry => ({
    id: it.id,
    title: it.name,
    subtitle: it.gold ? `${it.gold} 金币` : undefined,
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
/** 符文树的一行:slot 0 为基石 */
export interface RuneTreeRow {
  slot: number;
  entries: GridEntry[];
}

export interface RuneGroup {
  key: string;
  title: string;
  icon?: string;
  entries: GridEntry[];
  /** 符文系(7.24 起的符文树)才有:系本身 + 按行排好的符文 */
  head?: GridEntry;
  rows?: RuneTreeRow[];
}

export function runesSection(cat: Catalog, cmp: Catalog | undefined, q: string, df: DiffFilter): { groups: RuneGroup[]; exportItems: ExportItem[]; total: number } {
  type Row = { id: string; name: string; icon: string; group: string; groupTitle: string; groupIcon?: string; folder: string; slot?: number };
  const rows = (c: Catalog): Row[] => [
    ...c.runeStyles.flatMap((st) => [
      { id: `style-${st.id}`, name: st.name, icon: st.icon, group: st.id, groupTitle: st.name, groupIcon: st.icon, folder: `符文/${st.name}` },
      ...st.runes.map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        group: st.id,
        groupTitle: st.name,
        groupIcon: st.icon,
        folder: `符文/${st.name}`,
        slot: r.slot,
      })),
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
    // 符文系:系本身做树头,符文按行归位
    if (e.id.startsWith("style-")) g.head = e;
    else if (r.slot != null) {
      g.rows ??= [];
      let row = g.rows.find((x) => x.slot === r.slot);
      if (!row) g.rows.push((row = { slot: r.slot, entries: [] }));
      row.entries.push(e);
    }
  }
  for (const g of groups) g.rows?.sort((a, b) => a.slot - b.slot);
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

/** 弈子图是 2:1 横图,人脸多在偏右处;放进方形小图标裁切时取靠右的一段,让脸居中(加在 AssetImage 的 className 上) */
export const TFT_FACE_CROP = "[&_img]:object-[85%_50%]";

/** 云顶条目的 ID 在不同分类间可能重复,加上分类区分 */
export const tftKey = (e: Catalog["tft"][number]) => `${e.category}:${e.id || e.name}`;

/** 分赛季的云顶分类;小小英雄、棋盘皮肤、地区传送门不分赛季 */
export const TFT_SEASONAL = new Set(["弈子", "羁绊", "装备", "海克斯强化"]);

/** 弈子定位(CommunityDragon role 去掉 AD / AP 前缀后)的中文名 */
export const TFT_ROLE_LABELS: Record<string, string> = {
  Tank: "坦克",
  Fighter: "战士",
  Caster: "法师",
  Carry: "射手",
  Reaper: "刺客",
  Specialist: "特殊",
};

/** 弈子伤害类型(role 前缀)的中文名 */
export const TFT_DAMAGE_LABELS: Record<string, string> = { AD: "物理", AP: "魔法" };

/** 拆开原始定位:APCaster → { damage: "AP", role: "Caster" };没有 AD / AP 前缀时 damage 为空 */
export function splitTftRole(raw: string): { damage: string; role: string } {
  const m = /^(AD|AP)(.+)$/.exec(raw);
  if (m) return { damage: m[1], role: m[2] };
  return { damage: "", role: raw.replace(/^H(?=[A-Z])/, "") };
}

export const tftCostKey = (cost: number) => (cost >= 1 && cost <= 5 ? String(cost) : "other");

export const hasTftUnitFilter = (f: Filters) => !!(f.tftCost || f.tftTrait || f.tftRole || f.tftDamage || f.tftRange);

/**
 * 弈子按费用、羁绊、定位、伤害类型、攻击距离筛选;羁绊按名称比较(同名羁绊在不同赛季 ID 不同)。
 * units 还没读到时只按费用筛选;读到后没有资料的弈子在设了其他条件时不显示。
 */
export function tftUnitFilter(
  f: Filters,
  units: Record<string, TFTUnit> | undefined,
  traitNames: Map<string, string>,
): (e: Catalog["tft"][number]) => boolean {
  const facet = f.tftTrait || f.tftRole || f.tftDamage || f.tftRange;
  return (e) => {
    if (f.tftCost && tftCostKey(e.cost) !== f.tftCost) return false;
    if (!facet || !units) return true;
    const u = units[e.id];
    if (!u) return false;
    if (f.tftTrait && !(u.traits ?? []).some((id) => traitNames.get(id) === f.tftTrait)) return false;
    const { damage, role } = splitTftRole(u.role);
    if (f.tftRole && role !== f.tftRole) return false;
    if (f.tftDamage && damage !== f.tftDamage) return false;
    if (f.tftRange && String(u.range) !== f.tftRange) return false;
    return true;
  };
}

/** 赛季条上的一项 */
export interface SeasonOption {
  number: string;
  name: string;
  isDefault: boolean;
}

/**
 * 赛季选项(从新到旧):有 CommunityDragon 名单时只列本版本目录里有弈子的赛季;
 * 名单读不到(加载中、失败)时退回弈子 ID 前缀推出的赛季号。
 */
export function seasonOptions(cat: Catalog, seasons: TFTSeason[] | undefined): SeasonOption[] {
  const champions = cat.tft.filter((e) => e.category === "弈子");
  if (seasons) {
    const ids = new Set(champions.map((e) => e.id));
    return seasons
      .filter((s) => (s.members["弈子"] ?? []).some((id) => ids.has(id)))
      .map((s) => ({ number: s.number, name: s.name, isDefault: s.default }));
  }
  return [...new Set(champions.map((e) => e.set).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a))
    .map((number) => ({ number, name: "", isDefault: false }));
}

/** 实际生效的赛季:选过且本版本有就用所选,否则用默认赛季;"" 为全部 */
export function effectiveSeason(chosen: string | null, options: SeasonOption[]): string {
  if (chosen === "" || (chosen && options.some((o) => o.number === chosen))) return chosen;
  return options.find((o) => o.isDefault)?.number ?? "";
}

/**
 * 某个赛季的条目筛选:有该赛季名单的分类按名单(无尽之刃这类通用装备 ID 里没有赛季号,也在名单里);
 * 没有名单时按 ID 前缀,装备与海克斯强化另外保留通用的 TFT_ 条目。
 */
export function seasonFilter(season: string, seasons: TFTSeason[] | undefined): (e: Catalog["tft"][number]) => boolean {
  if (!season) return () => true;
  const members = seasons?.find((s) => s.number === season)?.members ?? {};
  const sets = new Map(Object.entries(members).map(([k, ids]) => [k, new Set(ids)]));
  return (e) => {
    if (!TFT_SEASONAL.has(e.category)) return true;
    const list = sets.get(e.category);
    if (list) return list.has(e.id);
    return e.set === season || ((e.category === "装备" || e.category === "海克斯强化") && e.id.startsWith("TFT_"));
  };
}

export function tftSection(
  cat: Catalog,
  cmp: Catalog | undefined,
  q: string,
  f: Filters,
  df: DiffFilter,
  /** 赛季筛选,弈子另含按条件筛选 */
  keep: (e: Catalog["tft"][number]) => boolean,
): SectionResult {
  const pick = (c: Catalog) => c.tft.filter((e) => e.category === f.tftCategory && keep(e) && matches(q, e.name, e.id));
  const toEntry = (e: Catalog["tft"][number]): GridEntry => ({
    id: tftKey(e),
    title: e.name,
    subtitle: [e.cost ? `${e.cost} 费` : "", e.set ? `S${e.set}` : e.category].filter(Boolean).join(" · "),
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
