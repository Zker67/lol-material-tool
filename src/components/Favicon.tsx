import { useState, useEffect } from "react";
import { Globe } from "lucide-react";

/**
 * 站点 favicon 抓取组件:经 Google S2 服务取图,带加载态与平滑降级
 * (优先 emoji 占位图标 → 名称首字母渐变块)。导航页与下载页共用。
 */
export function Favicon({
  url,
  fallbackIcon,
  name,
}: {
  url: string;
  fallbackIcon?: string;
  name: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    if (!url) {
      setStatus("error");
      return;
    }
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname;
      // 使用 Google S2 Favicon API 服务进行抓取，质量极佳
      setSrc(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`);
      setStatus("loading");
    } catch (e) {
      setStatus("error");
    }
  }, [url]);

  if (status === "error") {
    if (fallbackIcon) {
      return (
        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-hex-bg-2 rounded border border-hex-gold-dark/30 text-lg shadow-inner select-none">
          {fallbackIcon}
        </div>
      );
    }
    // 基于名称首字母生成漂亮的渐变色背景作为 fallback
    const char = name.trim().charAt(0).toUpperCase();
    const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const gradients = [
      "from-blue-600 to-cyan-500",
      "from-purple-600 to-pink-500",
      "from-emerald-600 to-teal-500",
      "from-amber-600 to-orange-500",
      "from-red-600 to-rose-500",
      "from-indigo-600 to-violet-500",
    ];
    const gradient = gradients[hash % gradients.length];
    return (
      <div
        className={`w-8 h-8 flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} rounded border border-hex-gold-dark/20 shadow-md text-white font-bold text-sm select-none`}
      >
        {char}
      </div>
    );
  }

  return (
    <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center bg-hex-bg-2 rounded border border-hex-gold-dark/20 overflow-hidden shadow-inner select-none">
      {status === "loading" && (
        <div className="absolute inset-0 bg-hex-bg-2 animate-pulse flex items-center justify-center">
          <Globe className="w-3.5 h-3.5 text-hex-text-muted animate-spin" />
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={name}
          className={`w-5 h-5 object-contain transition-opacity duration-300 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}
