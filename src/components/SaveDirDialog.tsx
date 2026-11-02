import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage, pickDirectory } from "@/lib/api";
import { resolveSavePrompt, setSaveDir, useSaveDir } from "@/lib/save";

/** 第一次保存时询问固定保存位置;选好后保存和导出都不再询问 */
export function SaveDirDialog() {
  const open = useSaveDir((s) => s.prompt !== null);

  const choose = async () => {
    const dir = await pickDirectory().catch(() => null);
    if (!dir) return;
    try {
      await setSaveDir(dir);
      resolveSavePrompt(dir);
    } catch (e) {
      toast.error("设置失败", { description: errorMessage(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resolveSavePrompt(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择素材保存位置</DialogTitle>
          <DialogDescription>之后保存和导出的素材都直接放到这个文件夹,不再询问。可在左下角「保存位置」修改。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolveSavePrompt("manual")}>
            这次手动选择
          </Button>
          <Button className="gap-1.5" onClick={choose}>
            <FolderOpen className="size-4" /> 选择文件夹
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
