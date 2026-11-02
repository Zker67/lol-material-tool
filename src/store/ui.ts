import { create } from "zustand";
import { DEFAULT_FILTERS, type Filters } from "@/features/browser/sections";

/** 侧边栏的分区:素材浏览 + 原有工具页 */
export type Section =
  | "champions"
  | "items"
  | "runes"
  | "summoners"
  | "tft"
  | "download"
  | "localize"
  | "nav"
  | "help";

export const BROWSER_SECTIONS: Section[] = ["champions", "items", "runes", "summoners", "tft"];

/** 素材浏览的游戏:英雄联盟 / 云顶之弈 */
export type Game = "lol" | "tft";

/** 浏览分区属于哪个游戏;整包工具页不属于任何游戏 */
const gameOf = (s: Section): Game | null => (s === "tft" ? "tft" : BROWSER_SECTIONS.includes(s) ? "lol" : null);

/** 详情面板正在展示的条目 */
export type Selection =
  | { kind: "champion"; id: string; skinId?: string }
  | { kind: "item"; id: string }
  | { kind: "rune"; id: string }
  | { kind: "named"; group: "legacyRunes" | "masteries" | "summoners"; id: string }
  | { kind: "tft"; id: string; category: string }
  | null;

/** 只看哪类版本差异 */
export type DiffFilter = "all" | "added" | "renamed" | "removed";

/** 英雄详情的页签:素材(原画、皮肤、炫彩)/ 资料(背景、技能、属性) */
export type DetailTab = "assets" | "info";

interface UIState {
  section: Section;
  /** 侧边栏当前列出哪个游戏的分区 */
  game: Game;
  /** 浏览的版本,null 表示最新 */
  version: string | null;
  /** 对比的版本,null 表示不对比 */
  compareVersion: string | null;
  diffFilter: DiffFilter;
  search: string;
  selection: Selection;
  /** 原画来源:官方最新 / 该版本历史(CommunityDragon) */
  historyArt: boolean;
  detailTab: DetailTab;
  paletteOpen: boolean;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  setSection: (s: Section) => void;
  setGame: (g: Game) => void;
  setVersion: (v: string | null) => void;
  setCompareVersion: (v: string | null) => void;
  setDiffFilter: (f: DiffFilter) => void;
  setSearch: (q: string) => void;
  select: (s: Selection) => void;
  setHistoryArt: (on: boolean) => void;
  setDetailTab: (tab: DetailTab) => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  section: "champions",
  game: "lol",
  version: null,
  compareVersion: null,
  diffFilter: "all",
  search: "",
  selection: null,
  historyArt: false,
  detailTab: "assets",
  paletteOpen: false,
  filters: DEFAULT_FILTERS,
  setFilters: (patch) => set((st) => ({ filters: { ...st.filters, ...patch } })),
  // 换分区时清空选中,没有点击内容就不显示详情栏
  setSection: (section) => set((st) => ({ section, game: gameOf(section) ?? st.game, search: "", diffFilter: "all", selection: null })),
  // 切换游戏时跳到该游戏的第一个分区
  setGame: (game) =>
    set((st) =>
      game === "lol"
        ? { game, section: "champions", search: "", diffFilter: "all", selection: null }
        : { game, section: "tft", filters: { ...st.filters, tftSet: "" }, search: "", diffFilter: "all", selection: null },
    ),
  setVersion: (version) => set({ version }),
  setCompareVersion: (compareVersion) => set({ compareVersion, diffFilter: "all" }),
  setDiffFilter: (diffFilter) => set({ diffFilter }),
  setSearch: (search) => set({ search }),
  // 点名某个皮肤时切回素材页签,只换英雄则保留当前页签
  select: (selection) => set(selection?.kind === "champion" && selection.skinId ? { selection, detailTab: "assets" } : { selection }),
  setHistoryArt: (historyArt) => set({ historyArt }),
  setDetailTab: (detailTab) => set({ detailTab }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
