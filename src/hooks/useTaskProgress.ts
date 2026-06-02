import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { TaskProgress } from "../lib/api";

/** 订阅后端 `task://progress` 事件,返回最近一次进度与重置方法 */
export function useTaskProgress() {
  const [progress, setProgress] = useState<TaskProgress | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    listen<TaskProgress>("task://progress", (event) => {
      if (mounted) setProgress(event.payload);
    }).then((un) => {
      if (mounted) unlistenRef.current = un;
      else un();
    });
    return () => {
      mounted = false;
      unlistenRef.current?.();
    };
  }, []);

  const reset = () => setProgress(null);
  return { progress, reset };
}
