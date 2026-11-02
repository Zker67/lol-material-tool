import { useState, type CSSProperties } from "react";
import { Copy, Download, ImageOff, Type } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { assetURL } from "@/lib/assets";
import { copyImage, copyText, saveAsset } from "@/lib/save";

/** 素材图:加载中显示占位,失败(官方已不提供)显示提示图标;右键可复制、保存 */
export function AssetImage({
  path,
  alt,
  className,
  style,
  fit = "cover",
}: {
  path: string | null | undefined;
  /** 素材名称,也用作保存的文件名;为空(装饰用的模糊底图)时没有右键菜单 */
  alt: string;
  className?: string;
  style?: CSSProperties;
  fit?: "cover" | "contain";
}) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [prev, setPrev] = useState(path);
  if (prev !== path) {
    setPrev(path);
    setState("loading");
  }
  const src = assetURL(path);

  const image = (
    <div className={cn("relative overflow-hidden bg-muted", className)} style={style}>
      {state === "loading" && src && <div className="absolute inset-0 animate-pulse bg-hex-bg-2" />}
      {(state === "error" || !src) && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/60" title="官方未提供该素材">
          <ImageOff className="size-5" />
        </div>
      )}
      {src && state !== "error" && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
          className={cn(
            "size-full transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );

  if (!path || !alt || state === "error") return image;
  const name = alt.replace(/\.(jpe?g|png)$/i, "");
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{image}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => copyImage(path)}>
          <Copy /> 复制图片
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => saveAsset(path, name)}>
          <Download /> 保存
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => copyText(name)}>
          <Type /> 复制名称
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
