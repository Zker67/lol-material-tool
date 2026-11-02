import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, Download, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { copyImage, saveAsset } from "@/lib/save";
import { cn } from "@/lib/utils";
import { AssetImage } from "./AssetImage";

/** 大图预览里的一张图 */
export interface Preview {
  path: string;
  title: string;
  fileName: string;
  /** 底部缩略图,不填时用原图 */
  thumb?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface View {
  scale: number;
  x: number;
  y: number;
}
const FIT: View = { scale: 1, x: 0, y: 0 };

/** 以 (cx, cy)(相对容器中心)为不动点把缩放改到 next */
function zoomAt(v: View, next: number, cx: number, cy: number): View {
  const scale = clamp(next, MIN_SCALE, MAX_SCALE);
  if (scale === MIN_SCALE) return FIT;
  const k = scale / v.scale;
  return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="rounded-md p-2 text-hex-gold-light/80 transition-colors hover:bg-white/10 hover:text-hex-gold-light disabled:opacity-30 disabled:hover:bg-transparent"
        >
          {children}
        </button>
      </TooltipTrigger>
      {/* 顶栏紧贴自绘标题栏,提示向下弹出才不会被挡住 */}
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * 全屏大图预览:滚轮以光标为中心缩放,放大后拖动平移,双击放大 / 还原,
 * ← → 切换上一张 / 下一张,+ - 缩放,0 还原。
 */
export function Lightbox({
  items,
  index,
  onIndexChange,
  open,
  onOpenChange,
}: {
  items: Preview[];
  index: number;
  onIndexChange: (i: number) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(FIT);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const item = items[index];
  const many = items.length > 1;

  // 换图或重新打开时回到适应窗口
  useEffect(() => setView(FIT), [index, open]);

  const go = (step: number) => many && onIndexChange((index + step + items.length) % items.length);

  /** 鼠标位置相对舞台中心的坐标 */
  const fromCenter = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    return [clientX - r.left - r.width / 2, clientY - r.top - r.height / 2] as const;
  };

  // 滚轮缩放要阻止默认滚动,React 的 onWheel 是被动监听,这里手动挂非被动监听
  useEffect(() => {
    const el = stageRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const [cx, cy] = fromCenter(e.clientX, e.clientY);
      setView((v) => zoomAt(v, v.scale * Math.exp(-e.deltaY * 0.0015), cx, cy));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "+" || e.key === "=") setView((v) => zoomAt(v, v.scale * 1.25, 0, 0));
      else if (e.key === "-") setView((v) => zoomAt(v, v.scale / 1.25, 0, 0));
      else if (e.key === "0") setView(FIT);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 || view.scale === 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onDoubleClick = (e: ReactMouseEvent) => {
    const [cx, cy] = fromCenter(e.clientX, e.clientY);
    setView((v) => (v.scale > 1 ? FIT : zoomAt(v, 2.5, cx, cy)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 从自绘标题栏(h-9,层级高于弹窗)下方开始铺满,避免顶栏按钮被标题栏挡住 */}
      <DialogContent
        showCloseButton={false}
        className="top-9 left-0 flex h-[calc(100vh-2.25rem)] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black/92 p-0 ring-0 sm:max-w-none"
      >
        <DialogDescription className="sr-only">滚轮缩放,拖动平移,左右方向键切换</DialogDescription>

        {/* 顶栏:名称、序号、缩放比例和操作 */}
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-linear-to-b from-black/80 to-transparent px-4 pt-3 pb-8">
          <DialogTitle className="min-w-0 truncate font-heading text-base font-semibold text-hex-gold-light select-text">{item?.title}</DialogTitle>
          {many && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {index + 1} / {items.length}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg bg-white/5 px-1 backdrop-blur">
            <ToolButton label="缩小(-)" disabled={view.scale <= MIN_SCALE} onClick={() => setView((v) => zoomAt(v, v.scale / 1.25, 0, 0))}>
              <ZoomOut className="size-4" />
            </ToolButton>
            <span className="w-12 text-center font-mono text-xs text-hex-gold-light/80">{Math.round(view.scale * 100)}%</span>
            <ToolButton label="放大(+)" disabled={view.scale >= MAX_SCALE} onClick={() => setView((v) => zoomAt(v, v.scale * 1.25, 0, 0))}>
              <ZoomIn className="size-4" />
            </ToolButton>
            <ToolButton label="还原(0)" disabled={view.scale === 1} onClick={() => setView(FIT)}>
              <RotateCcw className="size-4" />
            </ToolButton>
            <span className="mx-1 h-4 w-px bg-white/15" />
            <ToolButton label="复制图片" disabled={!item?.path} onClick={() => item && copyImage(item.path)}>
              <Copy className="size-4" />
            </ToolButton>
            <ToolButton label="保存" disabled={!item?.path} onClick={() => item && saveAsset(item.path, item.fileName)}>
              <Download className="size-4" />
            </ToolButton>
            <span className="mx-1 h-4 w-px bg-white/15" />
            <ToolButton label="关闭(Esc)" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </ToolButton>
          </div>
        </div>

        {/* 舞台:滚轮缩放、拖动平移、双击放大 */}
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={onDoubleClick}
          className={cn("relative min-h-0 flex-1 touch-none overflow-hidden select-none", view.scale > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"))}
        >
          <div
            className={cn("absolute inset-x-6 top-14 bottom-4", !dragging && "transition-transform duration-150 ease-out")}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            <AssetImage key={item?.path} path={item?.path} alt={item?.fileName ?? ""} fit="contain" className="size-full bg-transparent" />
          </div>

          {many && (
            <>
              <button
                type="button"
                aria-label="上一张"
                onClick={() => go(-1)}
                className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-hex-gold-light ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-black/75 hover:text-hex-gold"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="下一张"
                onClick={() => go(1)}
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-black/50 p-2.5 text-hex-gold-light ring-1 ring-white/10 backdrop-blur transition-colors hover:bg-black/75 hover:text-hex-gold"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* 底部缩略图,点击跳到那一张 */}
        {many && (
          <div className="shrink-0 overflow-x-auto px-4 pt-2 pb-3">
            {/* w-max + mx-auto:放得下时居中,放不下时从左边开始横向滚动 */}
            <div className="mx-auto flex w-max gap-1.5">
              {items.map((it, i) => (
                <button
                  key={`${it.path}-${i}`}
                  type="button"
                  aria-label={it.title}
                  onClick={() => onIndexChange(i)}
                  className={cn(
                    "size-12 shrink-0 overflow-hidden rounded-md transition-all",
                    i === index ? "ring-2 ring-hex-blue" : "opacity-50 ring-1 ring-white/10 hover:opacity-100",
                  )}
                >
                  <AssetImage path={it.thumb || it.path} alt="" className="size-full" />
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
