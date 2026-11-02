import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { SLIDE } from "@/lib/motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import App from "./App";
// Rajdhani 随应用打包(只要拉丁字符),离线也能显示;中文仍用系统的微软雅黑
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import "./index.css";

// 禁用默认右键菜单
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* 动效统一用 SLIDE;系统开启「减少动画」时关掉位移与布局动画 */}
      <MotionConfig reducedMotion="user" transition={SLIDE}>
        <TooltipProvider delayDuration={300}>
          <App />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
