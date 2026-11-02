import type { Transition } from "motion/react";

/**
 * 全应用统一的动效语言:选中块在选项之间「滑过去」(layoutId 共享布局动画),
 * 内容切换时短促淡入。系统开启「减少动画」时由 MotionConfig 关掉位移与布局动画。
 */

/** 选中块滑动:快速落位,轻微回弹 */
export const SLIDE: Transition = { type: "spring", bounce: 0.18, duration: 0.38 };

/** 内容切换(详情、网格换分类):淡入并上移几像素 */
export const ENTER = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

/** 选中块的统一外观:淡金底 + 金色描边 */
export const ACTIVE_PILL = "pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-hex-gold/15 ring-1 ring-hex-gold/70";
