import { useQuery } from "@tanstack/react-query";
import { isMyGo, runtime } from "mygo-runtime";
import { Assets, Tasks, type Catalog, type ChampionArt } from "../mygo";

/**
 * 素材路径(如 `ddragon/cdn/16.21.1/img/champion/Ahri.png`)→ 页面可加载的地址。
 * 应用内经 Go 的 `lmt://` 协议走本地缓存(Windows 上 WebView2 映射为 http://lmt.localhost);
 * 在普通浏览器里预览页面时直接连官方地址。
 */
const REMOTE: Record<string, string> = {
  ddragon: "https://ddragon.leagueoflegends.com/",
  cdragon: "https://raw.communitydragon.org/",
};

let base: string | null = null;
function assetBase(): string {
  if (base === null) {
    base = !isMyGo() ? "" : runtime().platform === "win32" ? "http://lmt.localhost/" : "lmt://localhost/";
  }
  return base;
}

export function assetURL(path: string | null | undefined): string {
  if (!path) return "";
  const b = assetBase();
  if (b) return b + path.split("/").map(encodeURIComponent).join("/");
  const [src, ...rest] = path.split("/");
  return (REMOTE[src] ?? "") + rest.join("/");
}

/** 版本列表(首项最新) */
export function useVersions() {
  return useQuery({
    queryKey: ["versions"],
    queryFn: () => Tasks.listVersions(),
    staleTime: 60 * 60 * 1000,
  });
}

/** 某个版本的素材目录 */
export function useCatalog(version: string | null | undefined) {
  return useQuery({
    queryKey: ["catalog", version],
    queryFn: async () => (await Assets.catalog(version!)) as Catalog,
    enabled: !!version,
    staleTime: Infinity,
  });
}

/** 某个版本对应的 CommunityDragon 补丁,没有时为 "" */
export function useHistoryPatch(version: string | null | undefined) {
  return useQuery({
    queryKey: ["historyPatch", version],
    queryFn: () => Assets.historyPatch(version!),
    enabled: !!version,
    staleTime: Infinity,
  });
}

/** 某个版本下英雄的历史原画与炫彩(CommunityDragon) */
export function useChampionArt(version: string | null | undefined, key: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["championArt", version, key],
    queryFn: async () => (await Assets.championArt(version!, key!)) as ChampionArt,
    enabled: enabled && !!version && !!key,
    staleTime: Infinity,
    retry: false,
  });
}

/** 版本差异中的状态 */
export type DiffState = "added" | "removed" | "renamed";

/** 比较两组带 id 与 name 的条目:返回当前版本条目的状态,以及只在对比版本里存在的条目 */
export function diffEntries<T extends { id: string; name: string }>(
  current: T[],
  compare: T[] | undefined,
): { state: Map<string, DiffState>; removed: T[]; previousName: Map<string, string> } {
  const state = new Map<string, DiffState>();
  const previousName = new Map<string, string>();
  if (!compare) return { state, removed: [], previousName };
  const old = new Map(compare.map((e) => [e.id, e]));
  const now = new Set(current.map((e) => e.id));
  for (const e of current) {
    const prev = old.get(e.id);
    if (!prev) state.set(e.id, "added");
    else if (prev.name !== e.name) {
      state.set(e.id, "renamed");
      previousName.set(e.id, prev.name);
    }
  }
  const removed = compare.filter((e) => !now.has(e.id));
  for (const e of removed) state.set(e.id, "removed");
  return { state, removed, previousName };
}

/** 小写后的搜索匹配 */
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}
