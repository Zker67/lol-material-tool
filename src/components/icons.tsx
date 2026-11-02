import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./icons.css";

/**
 * 自绘图标:24 格线稿 + 半透明底 + 实心点缀,颜色跟随 currentColor。
 * 侧边栏导航与游戏切换使用;只接收 className。
 * 动画见 icons.css:按钮悬停播放一次,选中(aria-current / aria-checked)时循环。
 */
export interface IconProps {
  className?: string;
}

const solid = { fill: "currentColor", stroke: "none" } as const;
const soft = { fill: "currentColor", stroke: "none", opacity: 0.28 } as const;
const thin = { strokeWidth: 0.9, opacity: 0.55 } as const;
/** 主轮廓:描线动画需要 pathLength=1 */
const outline = { pathLength: 1, strokeDasharray: "1 1", className: "anim a-draw" } as const;
const a = (name: string, extra?: string) => cn("anim", `a-${name}`, extra);

function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("ic", className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ---------- 游戏切换 ---------- */

/** 英雄联盟:一个 L,顶端外挑、底边斜切;一道高光扫过 */
export function LolMark({ className }: IconProps) {
  const clip = useId();
  const d = "M4.5 2.5h9.5l-2 2.25V17.5h10l-2.5 4H4.5l1.75-2.25V4.75z";
  return (
    <svg viewBox="0 0 24 24" className={cn("ic", className)} aria-hidden="true">
      <clipPath id={clip}>
        <path d={d} />
      </clipPath>
      <path d={d} fill="currentColor" />
      <g clipPath={`url(#${clip})`}>
        <path className={a("sweep")} d="M-8 26 0-2h3.5l-8 28z" fill="#fff" opacity={0.6} />
      </g>
    </svg>
  );
}

/** 云顶之弈:断开的六边形 + T + 一道环绕的弧 */
export function TftMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn("ic", className)} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.4 10.5V7L12 2l8.6 5v1.5" />
        <path d="M20.6 13.5V17L12 22l-8.6-5v-.75" />
        <path {...outline} d="M3.2 12.4C1.4 16 8.2 18.5 15 16.3c3.6-1.2 6.2-3.4 6.6-5.6" />
      </g>
      <path d="M6.75 6h10.5l-1 2.75h-2.75v8.5h-3v-8.5H7.75z" fill="currentColor" />
    </svg>
  );
}

/* ---------- 英雄联盟 ---------- */

/** 英雄:头盔,T 形面甲发光 */
export function ChampionIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M12 5.25 16.75 7.5v5c0 2.9-1.9 5.2-4.75 6.3-2.85-1.1-4.75-3.4-4.75-6.3v-5z" />
      <path {...outline} d="M12 2.75 19.25 6v6.5c0 4.25-3 7.5-7.25 8.75C7.75 20 4.75 16.75 4.75 12.5V6z" />
      <path {...solid} className={a("flash")} d="M8.25 9.25h7.5V11h-2.85v4.75h-1.8V11H8.25z" />
      <path {...thin} d="M7.25 6.9 9.5 5.9" />
    </Icon>
  );
}

/** 装备:切角方槽里一颗切面宝石,角上闪光 */
export function ItemIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...outline} d="M7.5 3h9L21 7.5v9L16.5 21h-9L3 16.5v-9z" />
      <path {...thin} d="M8.4 5.25h7.2l3.15 3.15v7.2l-3.15 3.15H8.4l-3.15-3.15V8.4z" />
      <g className={a("pulse")}>
        <path {...soft} opacity={0.55} d="M9.75 7.75h4.5l2.25 3h-9z" />
        <path {...solid} d="M7.5 11.25h9L12 16.75z" />
      </g>
      <path {...solid} className={a("twinkle")} d="M17.5 3.9 18 5.5l1.6.5-1.6.5-.5 1.6-.5-1.6-1.6-.5 1.6-.5z" />
    </Icon>
  );
}

/** 符文:刻度环绕的圆环,中心一颗四芒星 */
export function RuneIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...outline} cx="12" cy="12" r="8" />
      <path {...thin} className={a("spin")} d="M12 1.75v1.5M22.25 12h-1.5M12 22.25v-1.5M1.75 12h1.5M18.9 5.1l-.9.9M5.1 18.9l.9-.9M18.9 18.9l-.9-.9M5.1 5.1l.9.9" />
      <circle {...soft} cx="12" cy="12" r="5.25" />
      <path {...solid} className={a("pulse")} d="M12 7.25 13.4 10.6 16.75 12 13.4 13.4 12 16.75 10.6 13.4 7.25 12 10.6 10.6z" />
    </Icon>
  );
}

/** 召唤师技能:闪现的闪电,外圈虚线旋转 */
export function SummonerIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...thin} className={a("spin")} cx="12" cy="12" r="9" strokeDasharray="2.5 3" />
      <path {...soft} d="M14.25 3 7 13.25h4.75L10.25 21l7.25-10.25h-4.75z" />
      <path {...solid} className={a("flash")} d="M13.25 5.5 8.75 12.25h3.75l-1 5.25 4.75-7h-3.75z" />
    </Icon>
  );
}

/* ---------- 云顶之弈 ---------- */

/** 弈子:棋子,底座上跳动 */
export function UnitIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <g className={a("bob")}>
        <circle {...soft} cx="12" cy="6.5" r="2.75" />
        <circle {...outline} cx="12" cy="6.5" r="2.75" />
        <path d="M9.25 10.75h5.5M10.25 11 9 17h6l-1.25-6" />
      </g>
      <path {...solid} d="M6.25 17.5h11.5l.75 3.25H5.5z" />
    </Icon>
  );
}

/** 羁绊:两枚相扣的六边形,彼此靠拢 */
export function TraitIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <g className={a("in-r")}>
        <path {...soft} d="M15.5 6.5 20.26 9.25v5.5L15.5 17.5l-4.76-2.75v-5.5z" />
        <path d="M15.5 6.5 20.26 9.25v5.5L15.5 17.5l-4.76-2.75v-5.5z" />
      </g>
      <g className={a("in-l")}>
        <path {...outline} d="M8.5 6.5 13.26 9.25v5.5L8.5 17.5l-4.76-2.75v-5.5z" />
      </g>
      <path {...solid} className={a("pulse")} d="M12 10.25 13.5 11.1v1.8L12 13.75l-1.5-.85v-1.8z" />
    </Icon>
  );
}

/** 云顶装备:铁砧上迸出火花 */
export function ForgeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M3.5 9h11.75c.3 1.9 1.9 3.4 3.9 3.5h1.35v1.25h-5l-1.75 3h-4.5L7.5 13.9C5.2 13.6 3.5 11.6 3.5 9.9z" />
      <path {...outline} d="M3.5 9h11.75c.3 1.9 1.9 3.4 3.9 3.5h1.35v1.25h-5l-1.75 3h-4.5L7.5 13.9C5.2 13.6 3.5 11.6 3.5 9.9z" />
      <path className={a("twinkle")} d="M12.5 2.75v2.5M16.25 3.75 15 5.9M8.75 3.75 10 5.9" />
      <path {...solid} d="M6.75 18.25h10.5V21H6.75z" />
    </Icon>
  );
}

/** 海克斯强化:双层六边形,箭头上升 */
export function AugmentIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...outline} d="M12 2.5 20.25 7.25v9.5L12 21.5l-8.25-4.75v-9.5z" />
      <path {...soft} d="M12 6 17.2 9v6L12 18l-5.2-3V9z" />
      <path {...solid} className={a("rise")} d="M12 7.5 15.75 11.5h-2.25v4.25h-3V11.5H8.25z" />
    </Icon>
  );
}

/** 小小英雄:带耳朵的圆脸,会眨眼 */
export function LegendIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M6.6 8.4 6.1 5.9l2.3 1.45zM17.4 8.4l.5-2.5-2.3 1.45z" />
      <path {...outline} d="M6 9 5 4.5 9 7q3-1 6 0l4-2.5L18 9q2 2.5 1.5 5.5Q18.5 20 12 20t-7.5-5.5Q4 11.5 6 9z" />
      <g className={a("blink")}>
        <circle {...solid} cx="9.5" cy="12.75" r="1.3" />
        <circle {...solid} cx="14.5" cy="12.75" r="1.3" />
      </g>
      <path {...thin} d="M11 16q1 .75 2 0" />
    </Icon>
  );
}

/** 棋盘皮肤:斜看的棋盘,中间的棋子浮起 */
export function ArenaIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M12 4.5 20.5 10 12 15.5 3.5 10z" />
      <path {...outline} d="M12 4.5 20.5 10 12 15.5 3.5 10z" />
      <path {...thin} d="M7.75 7.25 16.25 12.75M16.25 7.25 7.75 12.75" />
      <path d="M3.5 10v3L12 18.5l8.5-5.5v-3" />
      <path {...solid} className={a("bob")} d="M12 7.6 14.5 9.6 12 11.6 9.5 9.6z" />
    </Icon>
  );
}

/** 地区传送门:拱门里光芒闪动,晶石旋转 */
export function PortalIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} className={a("flash")} d="M8.25 20.5V11.5a3.75 3.75 0 0 1 7.5 0v9z" />
      <path {...outline} d="M5.75 20.5V11a6.25 6.25 0 0 1 12.5 0v9.5" />
      <path d="M3.25 20.5h17.5" />
      <path {...solid} className={a("spin")} d="M12 10 13.75 13 12 16 10.25 13z" />
    </Icon>
  );
}

/* ---------- 整包工具 ---------- */

/** 整包下载:托盘 + 下落的实心箭头(同应用图标) */
export function DownloadIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M5.5 15.5h13v3.5h-13z" />
      <path {...outline} d="M4 13.5V20.5h16v-7" />
      <path {...solid} className={a("drop")} d="M10.5 2.5h3v6.75h3.5L12 14.5 7 9.25h3.5z" />
    </Icon>
  );
}

/** 汉化整理:文件夹里的条目滑动归位 */
export function OrganizeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M3 5h6.5l2 2.5H3z" />
      <path {...outline} d="M3 5h6.5l2 2.5H21V19H3z" />
      <path {...solid} d="M7 10.75h10v1.75H7z" />
      <path {...solid} className={a("slide")} d="M7 14.5h6v1.75H7z" />
    </Icon>
  );
}

/** 导航:罗盘,指针摆动 */
export function CompassIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle {...outline} cx="12" cy="12" r="8.75" />
      <path {...thin} d="M12 4.75v1.5M19.25 12h-1.5M12 19.25v-1.5M4.75 12h1.5" />
      <g className={a("needle")}>
        <path {...solid} d="M15.75 8.25 13.1 13.1 10.9 10.9z" />
        <path {...soft} opacity={0.5} d="M8.25 15.75 10.9 10.9 13.1 13.1z" />
      </g>
      <circle {...solid} cx="12" cy="12" r="0.9" />
    </Icon>
  );
}

/** 说明:翻开的书,书签摆动 */
export function GuideIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path {...soft} d="M5 7c2-.5 4.25-.25 6.25.75v10C9.25 17 7 16.75 5 17.25z" />
      <path {...outline} d="M3.5 5.5c2.75-1 5.75-1 8.5.75 2.75-1.75 5.75-1.75 8.5-.75V19c-2.75-1-5.75-1-8.5.75C9.25 18 6.25 18 3.5 19z" />
      <path d="M12 6.25v13.5" />
      <path {...thin} d="M14.25 10.5h3.5M14.25 13h3.5" />
      <path {...solid} className={a("swing", "o-top")} d="M15 5.1h2.75v5.4l-1.375-1.1L15 10.5z" />
    </Icon>
  );
}
