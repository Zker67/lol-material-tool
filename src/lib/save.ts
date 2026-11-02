import { toast } from "sonner";
import { create } from "zustand";
import { Assets, Desktop } from "../mygo";
import { errorMessage } from "./api";

/** 首次保存时的提示:选好的目录 / "manual" 这次手动选位置 / null 取消 */
type PromptResult = string | "manual" | null;

interface SaveState {
  /** 固定保存位置,"" 为未设置,null 为还没读取 */
  dir: string | null;
  /** 首次保存提示是否打开,以及关闭时把结果交回给等待的保存操作 */
  prompt: ((r: PromptResult) => void) | null;
}

export const useSaveDir = create<SaveState>(() => ({ dir: null, prompt: null }));

/** 从后端读取固定保存位置 */
export async function loadSaveDir(): Promise<string> {
  const dir = await Assets.saveDir();
  useSaveDir.setState({ dir });
  return dir;
}

/** 设置固定保存位置;传 "" 清除,之后保存会再次提示 */
export async function setSaveDir(dir: string): Promise<void> {
  await Assets.setSaveDir(dir);
  useSaveDir.setState({ dir });
}

/** 固定保存位置;还没设置时弹出首次保存提示 */
export async function ensureSaveDir(): Promise<PromptResult> {
  const dir = await loadSaveDir().catch(() => "");
  if (dir) return dir;
  return new Promise<PromptResult>((resolve) => useSaveDir.setState({ prompt: resolve }));
}

/** 关闭首次保存提示并交回结果 */
export function resolveSavePrompt(r: PromptResult) {
  const { prompt } = useSaveDir.getState();
  useSaveDir.setState({ prompt: null });
  prompt?.(r);
}

function savedToast(dest: string) {
  toast.success("已保存", { description: dest, action: { label: "打开文件夹", onClick: () => Desktop.showInFolder(dest) } });
}

/** 弹出系统保存对话框;只在首次保存选「这次手动选择」时使用 */
async function saveAssetAs(path: string, name: string) {
  try {
    const dest = await Assets.saveAs(path, name);
    if (dest) savedToast(dest);
  } catch (e) {
    toast.error("保存失败", { description: errorMessage(e) });
  }
}

/** 保存:直接存到固定保存位置,不再询问;第一次保存时先选位置 */
export async function saveAsset(path: string, name: string) {
  const dir = await ensureSaveDir();
  if (!dir) return;
  if (dir === "manual") return saveAssetAs(path, name);
  try {
    savedToast(await Assets.save(path, name));
  } catch (e) {
    toast.error("保存失败", { description: errorMessage(e) });
  }
}

/** 把素材图片复制到剪贴板(统一转成 PNG) */
export async function copyImage(path: string) {
  try {
    await Assets.copyImage(path);
    toast.success("已复制图片");
  } catch (e) {
    toast.error("复制失败", { description: errorMessage(e) });
  }
}

/** 复制文本到剪贴板;后端不可用时退回浏览器剪贴板 */
export async function copyText(text: string) {
  try {
    await Desktop.copyText(text);
  } catch {
    await navigator.clipboard.writeText(text).catch(() => {});
  }
  toast.success("已复制");
}
