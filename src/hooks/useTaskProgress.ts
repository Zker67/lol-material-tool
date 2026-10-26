import { useEffect, useState } from "react";
import { isMyGo } from "mygo-runtime";
import { events } from "../mygo";
import type { TaskProgress } from "../lib/api";

/** 订阅后端 `task:progress` 事件,返回最近一次进度与重置方法 */
export function useTaskProgress() {
  const [progress, setProgress] = useState<TaskProgress | null>(null);

  useEffect(() => {
    // 在普通浏览器里预览页面时没有 MyGo 运行时
    if (!isMyGo()) return;
    return events.taskProgress.on(setProgress);
  }, []);

  const reset = () => setProgress(null);
  return { progress, reset };
}
