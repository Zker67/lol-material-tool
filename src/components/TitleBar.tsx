import { useState, useEffect } from "react";
import { currentWindow, isMyGo } from "mygo-runtime";
import { X, Minus, Square, Copy } from "lucide-react";

export function TitleBar() {
  // 在普通浏览器里预览页面时没有 MyGo 运行时,窗口控制不做事
  const appWindow = isMyGo()
    ? currentWindow
    : {
        isMaximized: async () => false,
        minimize: async () => {},
        maximize: async () => {},
        unmaximize: async () => {},
        close: async () => {},
      };
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 初始状态
    appWindow.isMaximized().then(setIsMaximized);

    // 监听窗口缩放(含贴边布局)以同步最大化状态
    const onResize = async () => setIsMaximized(await appWindow.isMaximized());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const minimize = () => appWindow.minimize();
  const toggleMaximize = async () => {
    const max = await appWindow.isMaximized();
    if (max) {
      await appWindow.unmaximize();
      setIsMaximized(false);
    } else {
      await appWindow.maximize();
      setIsMaximized(true);
    }
  };
  const close = () => appWindow.close();

  return (
    <div className="w-full shrink-0 h-9 bg-hex-bg border-b border-hex-gold-dark/40 flex justify-between items-center pl-3 z-100 select-none relative">
      <div className="absolute top-0 left-0 w-full h-px bg-linear-to-r from-transparent via-hex-gold/40 to-transparent pointer-events-none" />

      {/* 标题区(可拖拽) */}
      <div className="flex items-center gap-2 relative z-10 w-full h-full [--app-region:drag]">
        <div className="w-2 h-2 bg-hex-gold rounded-full pointer-events-none" />
        <span className="text-xs font-display font-semibold text-hex-gold tracking-[0.2em] pointer-events-none">
          LOL MATERIAL TOOL
        </span>
      </div>

      {/* 窗口控制 */}
      <div className="flex items-center h-full relative z-20">
        <button
          onClick={minimize}
          className="h-full w-12 flex items-center justify-center text-hex-text-muted hover:bg-hex-blue-dark/60 hover:text-hex-blue transition-colors"
          title="最小化"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={toggleMaximize}
          className="h-full w-12 flex items-center justify-center text-hex-text-muted hover:bg-hex-gold-dark/60 hover:text-hex-gold transition-colors"
          title={isMaximized ? "向下还原" : "最大化"}
        >
          {isMaximized ? <Copy size={14} className="rotate-180" /> : <Square size={14} />}
        </button>
        <button
          onClick={close}
          className="h-full w-12 flex items-center justify-center text-hex-text-muted hover:bg-red-600 hover:text-white transition-colors"
          title="关闭"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
