import { useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { assetURL } from "@/lib/assets";

/** 素材图:加载中显示占位,失败(官方已不提供)显示提示图标 */
export function AssetImage({
  path,
  alt,
  className,
  style,
  fit = "cover",
}: {
  path: string | null | undefined;
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

  return (
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
}
