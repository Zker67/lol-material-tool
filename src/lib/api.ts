import { Desktop, Tasks, type Progress } from "../mygo";

/** 后端 `task:progress` 推送的进度事件,对应 Go 的 material.Progress */
export type TaskProgress = Progress;

/** 获取全部版本号(首项为最新版) */
export function listVersions(): Promise<string[]> {
  return Tasks.listVersions();
}

/** 下载指定版本数据包到目标目录,返回 .tgz 完整路径 */
export function downloadPack(version: string, destDir: string): Promise<string> {
  return Tasks.downloadPack(version, destDir);
}

/** 解压 .tgz 到 {destDir}/联盟官方数据包-{version}/,返回解压根目录路径 */
export function extractPack(tgzPath: string, destDir: string, version: string): Promise<string> {
  return Tasks.extractPack(tgzPath, destDir, version);
}

/** 对已解压的官方数据包目录执行联盟汉化,返回汉化输出目录路径 */
export function runLolLocalization(dataDir: string): Promise<string> {
  return Tasks.runLolLocalization(dataDir);
}

/** 对已解压的官方数据包目录执行云顶汉化,返回汉化输出目录路径 */
export function runTftLocalization(dataDir: string): Promise<string> {
  return Tasks.runTftLocalization(dataDir);
}

/** 请求取消当前任务 */
export function cancelTask(): Promise<void> {
  return Tasks.cancelTask();
}

/** 选择一个目录,取消时返回 null */
export async function pickDirectory(): Promise<string | null> {
  return (await Desktop.pickDirectory()) || null;
}

/** 用系统默认程序打开文件或文件夹 */
export function openPath(path: string): Promise<void> {
  return Desktop.openPath(path);
}

/** 在默认浏览器中打开链接 */
export function openUrl(url: string): Promise<void> {
  return Desktop.openURL(url);
}

/** 取出后端错误(CallError)的文本,用于日志 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
