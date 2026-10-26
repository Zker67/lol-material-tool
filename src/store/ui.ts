import { create } from "zustand";
import { DEFAULT_FILTERS, type Filters } from "@/features/browser/sections";

/** 侧边栏的分区:素材浏览 + 原有工具页 */
export type Section =
  | "champions"
  | "skins"
  | "items"
  | "runes"
  | "summoners"
  | "tft"
  | "download"
  | "localize"
  | "nav"
  | "help";

export const BROWSER_SECTIONS: Section[] = ["champions", "skins", "items", "runes", "summoners", "tft"];

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

interface UIState {
  section: Section;
  /** 浏览的版本,null 表示最新 */
  version: string | null;
  /** 对比的版本,null 表示不对比 */
  compareVersion: string | null;
  diffFilter: DiffFilter;
  search: string;
  selection: Selection;
  /** 原画来源:官方最新 / 该版本历史(CommunityDragon) */
  historyArt: boolean;
  paletteOpen: boolean;
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  setSection: (s: Section) => void;
  setVersion: (v: string | null) => void;
  setCompareVersion: (v: string | null) => void;
  setDiffFilter: (f: DiffFilter) => void;
  setSearch: (q: string) => void;
  select: (s: Selection) => void;
  setHistoryArt: (on: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  section: "champions",
  version: null,
  compareVersion: null,
  diffFilter: "all",
  search: "",
  selection: null,
  historyArt: false,
  paletteOpen: false,
  filters: DEFAULT_FILTERS,
  setFilters: (patch) => set((st) => ({ filters: { ...st.filters, ...patch } })),
  setSection: (section) => set({ section, search: "", diffFilter: "all" }),
  setVersion: (version) => set({ version }),
  setCompareVersion: (compareVersion) => set({ compareVersion, diffFilter: "all" }),
  setDiffFilter: (diffFilter) => set({ diffFilter }),
  setSearch: (search) => set({ search }),
  select: (selection) => set({ selection }),
  setHistoryArt: (historyArt) => set({ historyArt }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
