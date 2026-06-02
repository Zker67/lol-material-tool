import { invoke } from "@tauri-apps/api/core";

/** 后端 `task://progress` 推送的进度事件,对应 Rust 的 ProgressEvent */
export interface TaskProgress {
  stage: "download" | "extract" | "localize";
  current: number;
  total: number;
  speed: number | null;
  eta: number | null;
  message: string;
  done: boolean;
}

/** 获取全部版本号(首项为最新版) */
export function listVersions(): Promise<string[]> {
  return invoke<string[]>("list_versions");
}

/** 下载指定版本数据包到目标目录,返回 .tgz 完整路径 */
export function downloadPack(version: string, destDir: string): Promise<string> {
  return invoke<string>("download_pack", { version, destDir });
}

/** 解压 .tgz 到 {destDir}/联盟官方数据包-{version}/,返回解压根目录路径 */
export function extractPack(tgzPath: string, destDir: string, version: string): Promise<string> {
  return invoke<string>("extract_pack", { tgzPath, destDir, version });
}

/** 对已解压的官方数据包目录执行联盟汉化,返回汉化输出目录路径 */
export function runLolLocalization(dataDir: string): Promise<string> {
  return invoke<string>("run_lol_localization", { dataDir });
}

/** 请求取消当前任务 */
export function cancelTask(): Promise<void> {
  return invoke("cancel_task");
}
