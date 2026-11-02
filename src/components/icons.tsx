import { useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./icons.css";

/**
 * 自绘图标(24 格):线稿 + 半透明底 + 金属渐变主体 + 暗色切面刻线,颜色跟随 currentColor。
 * 侧边栏导航与游戏切换使用;只接收 className。
 * 动画见 icons.css:h-* 是按钮悬停时的一次性动作,l-* 是选中时的循环动作,两者挂在不同部件上。
 */
export interface IconProps {
  className?: string;
}

/** 切面刻线用背景色,在金属面上刻出棱线 */
const CUT = "#010a13";
const cut = { fill: "none", stroke: CUT, strokeWidth: 0.9 } as const;
const soft = { fill: "currentColor", stroke: "none", opacity: 0.22 } as const;
const thin = { strokeWidth: 0.9, opacity: 0.55 } as const;
/** 悬停时描出的线:pathLength=1 + dasharray 1,静止时完整显示 */
const drawn = { pathLength: 1, strokeDasharray: "1 1" } as const;
const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });
const origin = (o: string): CSSProperties => ({ transformOrigin: o });

/** SVG id 不能带 useId 生成的特殊字符 */
const useSvgId = () => "ic" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

/** 四芒星:闪光点缀 */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r}l${r * 0.28} ${r * 0.72} ${r * 0.72} ${r * 0.28}-${r * 0.72} ${r * 0.28}-${r * 0.28} ${r * 0.72}-${r * 0.28}-${r * 0.72}-${r * 0.72}-${r * 0.28} ${r * 0.72}-${r * 0.28}z`;

function Icon({ className, children }: IconProps & { children: (metal: string) => ReactNode }) {
  const id = useSvgId();
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
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      {children(`url(#${id})`)}
    </svg>
  );
}

/* ---------- 游戏切换 ---------- */

/** 英雄联盟:一个 L,金属渐变 + 内侧棱线;悬停一道高光扫过并弹一下,选中时高光定期扫过 */
export function LolMark({ className }: IconProps) {
  const id = useSvgId();
  const d = "M4.5 2.5h9.5l-2 2.25V17.5h10l-2.5 4H4.5l1.75-2.25V4.75z";
  return (
    <svg viewBox="0 0 24 24" className={cn("ic", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.6} />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d={d} />
        </clipPath>
      </defs>
      <g className="h-pop">
        <path d={d} fill={`url(#${id}g)`} />
        <path d="M8.25 5.5V19h10.5" {...cut} opacity={0.6} />
        <g clipPath={`url(#${id}c)`}>
          <path className="h-sweep l-sweep" d="M-9 26-1-2h3l-8 28z" fill="#fff" opacity={0.65} />
        </g>
      </g>
    </svg>
  );
}

/** 云顶之弈:断开的六边形 + T + 环绕的弧;悬停时弧描出、T 落下,选中时弧端星光闪烁 */
export function TftMark({ className }: IconProps) {
  const id = useSvgId();
  return (
    <svg viewBox="0 0 24 24" className={cn("ic", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" />
          <stop offset="1" stopColor="currentColor" stopOpacity={0.6} />
        </linearGradient>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.4 10.5V7L12 2l8.6 5v1.5" />
        <path d="M20.6 13.5V17L12 22l-8.6-5v-.75" />
        <path className="h-draw l-pulse" {...drawn} d="M3.2 12.4C1.4 16 8.2 18.5 15 16.3c3.6-1.2 6.2-3.4 6.6-5.6" />
      </g>
      <g className="h-drop">
        <path d="M6.75 6h10.5l-1 2.75h-2.75v8.5h-3v-8.5H7.75z" fill={`url(#${id})`} />
        <path d="M12 9v7.5" {...cut} opacity={0.5} />
      </g>
      <path className="l-twinkle" d={sparkle(21.6, 10.4, 1.8)} fill="currentColor" />
    </svg>
  );
}

/* ---------- 英雄联盟 ---------- */

/** 英雄:带翼头盔。悬停:面甲亮起、两翼张开;选中:顶上宝石呼吸、面甲微光 */
export function ChampionIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path className="h-wing-l" style={origin("100% 50%")} d="M5.25 8.25 2 6.5l.6 4.4 2.65 1.6" />
          <path className="h-wing-r" style={origin("0% 50%")} d="M18.75 8.25 22 6.5l-.6 4.4-2.65 1.6" />
          <path {...soft} d="M12 3.5 18.5 6.6v5.65c0 4-2.75 7.05-6.5 8.45-3.75-1.4-6.5-4.45-6.5-8.45V6.6z" />
          <path d="M12 3.5 18.5 6.6v5.65c0 4-2.75 7.05-6.5 8.45-3.75-1.4-6.5-4.45-6.5-8.45V6.6z" />
          <path {...thin} d="M12 5.6 16.5 7.8v4.45c0 2.85-1.85 5.15-4.5 6.3" />
          <g className="h-visor">
            <path className="l-pulse" fill={metal} stroke="none" d="M7.75 9.5h8.5l-.75 1.75h-2.6v5.25h-1.8v-5.25H8.5z" />
          </g>
          <path className="l-breathe" fill="currentColor" stroke="none" d="M12 .9 13.2 2.6 12 4.3 10.8 2.6z" />
        </>
      )}
    </Icon>
  );
}

/** 装备:切角方槽里的切面宝石。悬停:宝石翻转、角上星光迸出;选中:星光定期闪烁、宝石微光 */
export function ItemIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path d="M7.25 2.75h9.5l4.5 4.5v9.5l-4.5 4.5h-9.5l-4.5-4.5v-9.5z" />
          <path {...thin} d="M8.2 5h7.6L19 8.2v7.6L15.8 19H8.2L5 15.8V8.2z" />
          <g className="h-flip">
            <g className="l-pulse">
              <path fill="currentColor" stroke="none" opacity={0.55} d="M9.4 7.5h5.2l2.3 3.25H7.1z" />
              <path fill={metal} stroke="none" d="M7.1 10.75h9.8L12 17.25z" />
              <path {...cut} d="M7.1 10.75h9.8M10.6 7.5l-.9 3.25L12 17.25l2.3-6.5-.9-3.25" />
            </g>
          </g>
          <path className="h-burst l-twinkle" d={sparkle(18.4, 5.6, 2.2)} fill="currentColor" stroke="none" />
        </>
      )}
    </Icon>
  );
}

/** 符文:基石符文。悬停:外环描出、星芒转四分之一圈;选中:四枚符印依次点亮、星芒呼吸 */
export function RuneIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <circle className="h-draw" {...drawn} cx="12" cy="12" r="8.75" />
          <circle {...soft} cx="12" cy="12" r="5.75" />
          <circle {...thin} cx="12" cy="12" r="5.75" />
          {[
            "M12 1.6 13 3.25 12 4.9 11 3.25z",
            "M22.4 12 20.75 13 19.1 12l1.65-1z",
            "M12 22.4 11 20.75 12 19.1l1 1.65z",
            "M1.6 12 3.25 11 4.9 12 3.25 13z",
          ].map((d, i) => (
            <path key={d} className="l-seq" style={delay(i * 0.6)} d={d} fill="currentColor" stroke="none" />
          ))}
          <g className="h-turn">
            <g className="l-breathe">
              <path fill={metal} stroke="none" d="M12 7.1 13.35 10.65 16.9 12 13.35 13.35 12 16.9 10.65 13.35 7.1 12 10.65 10.65z" />
              <path {...cut} d="M12 7.6v8.8M7.6 12h8.8" opacity={0.6} />
            </g>
          </g>
        </>
      )}
    </Icon>
  );
}

/** 召唤师技能:闪现。悬停:闪电从左侧瞬移进来、拖出残影;选中:电光闪烁、星火明灭 */
export function SummonerIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path className="h-trail" style={origin("100% 50%")} {...thin} d="M2.75 9.25h3M2 12.5h2.75M3 15.75h2.25" />
          <g className="h-blink">
            <g className="l-flicker">
              <path fill={metal} stroke="none" d="M14 2.5 6.75 13h4.9l-1.6 8.5 7.45-10.75h-4.9z" />
              <path {...cut} d="M12.6 4.6 9.1 11.6" opacity={0.6} />
            </g>
          </g>
          <path className="h-burst l-twinkle" style={delay(0.25)} d={sparkle(19.25, 4.5, 2)} fill="currentColor" stroke="none" />
          <circle className="l-twinkle" style={delay(1.3)} cx="19" cy="18" r="1" fill="currentColor" stroke="none" />
        </>
      )}
    </Icon>
  );
}

/* ---------- 云顶之弈 ---------- */

/** 弈子:六边形底座上的棋子。悬停:棋子跳起落地;选中:底座泛起涟漪 */
export function UnitIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path className="l-ripple" opacity={0} d="M4.5 18.5 7.25 16.5h9.5l2.75 2-2.75 2h-9.5z" />
          <path fill={metal} stroke="none" d="M4.5 18.5 7.25 16.5h9.5l2.75 2-2.75 2h-9.5z" />
          <path {...cut} d="M7.25 16.5 9 18.5h6l1.75-2M9 18.5l-1.75 2M15 18.5l1.75 2" opacity={0.55} />
          <g className="h-hop" style={origin("50% 100%")}>
            <circle {...soft} cx="12" cy="6.25" r="2.6" />
            <circle cx="12" cy="6.25" r="2.6" />
            <path {...soft} d="M10.4 10.5 9.25 15.5h5.5L13.6 10.5z" />
            <path d="M9.5 10.25h5M10.4 10.5 9.25 15.5h5.5L13.6 10.5" />
          </g>
        </>
      )}
    </Icon>
  );
}

/** 羁绊:相扣的两枚六边形。悬停:两边分开再扣紧、中心纹章弹出;选中:两枚轮流发亮、纹章呼吸 */
export function TraitIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <g className="h-apart-r">
            <g className="l-alt" style={delay(1.3)}>
              <path fill={metal} stroke="none" opacity={0.45} d="M15.5 6.25 20.5 9.15v5.7l-5 2.9-5-2.9v-5.7z" />
              <path d="M15.5 6.25 20.5 9.15v5.7l-5 2.9-5-2.9v-5.7z" />
            </g>
          </g>
          <g className="h-apart-l">
            <g className="l-alt">
              <path {...soft} d="M8.5 6.25 13.5 9.15v5.7l-5 2.9-5-2.9v-5.7z" />
              <path d="M8.5 6.25 13.5 9.15v5.7l-5 2.9-5-2.9v-5.7z" />
            </g>
          </g>
          <g className="h-pop" style={delay(0.3)}>
            <path className="l-breathe" fill="currentColor" stroke="none" d="M12 9.6 13.6 12 12 14.4 10.4 12z" />
          </g>
        </>
      )}
    </Icon>
  );
}

/** 云顶装备:铁砧与锤。悬停:锤子扬起砸下、火花四溅;选中:火星从砧面升起 */
export function ForgeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path {...soft} d="M3.25 9.75h11.5c.35 1.7 1.85 2.95 3.75 3.05h1.25v1.4h-4.6l-1.6 2.6H9.6L8 14.05c-2.65-.2-4.75-2.05-4.75-4.3z" />
          <path d="M3.25 9.75h11.5c.35 1.7 1.85 2.95 3.75 3.05h1.25v1.4h-4.6l-1.6 2.6H9.6L8 14.05c-2.65-.2-4.75-2.05-4.75-4.3z" />
          <path fill={metal} stroke="none" d="M6.75 18h10.25l.75 2.75H6z" />
          <g className="h-strike" style={origin("100% 0%")}>
            <path d="M20 2.25 14.75 7.5" />
            <path fill={metal} stroke="none" d="M11.6 5.4 14.6 2.4l2.6 2.6-3 3z" />
          </g>
          <path className="h-spark" style={{ ...delay(0.3), ...origin("100% 100%") }} d="M8.25 8 6.9 6.6M10 7.6 9.7 5.75M6.6 9 4.9 8.4" />
          {[
            { cx: 9.5, d: 0 },
            { cx: 12, d: 0.7 },
            { cx: 6.5, d: 1.4 },
          ].map((e) => (
            <circle key={e.cx} className="l-ember" style={delay(e.d)} opacity={0} cx={e.cx} cy="8.5" r="0.75" fill="currentColor" stroke="none" />
          ))}
        </>
      )}
    </Icon>
  );
}

/** 海克斯强化:六边形里的两道上箭头。悬停:箭头依次冲上去再回来;选中:箭头自下而上依次点亮 */
export function AugmentIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path d="M12 2.5 20.25 7.25v9.5L12 21.5l-8.25-4.75v-9.5z" />
          <path {...soft} d="M12 5.25 17.9 8.65v6.7L12 18.75l-5.9-3.4v-6.7z" />
          <path {...thin} d="M12 5.25 17.9 8.65v6.7L12 18.75l-5.9-3.4v-6.7z" />
          {[
            { d: "M8.25 15.1 12 11.6l3.75 3.5v2.15L12 13.75l-3.75 3.5z", t: 0 },
            { d: "M8.25 10.6 12 7.1l3.75 3.5v2.15L12 9.25l-3.75 3.5z", t: 0.12 },
          ].map((c, i) => (
            <g key={c.d} className="h-rise" style={delay(c.t)}>
              <path className="l-cascade" style={delay(i * 0.45)} fill={metal} stroke="none" d={c.d} />
            </g>
          ))}
        </>
      )}
    </Icon>
  );
}

/** 小小英雄:圆脸小精灵。悬停:歪头、耳朵抖动;选中:轻轻浮动、不时眨眼 */
export function LegendIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <g className="l-float">
          <g className="h-tilt" style={origin("50% 90%")}>
            <g className="h-wiggle-l" style={origin("100% 100%")}>
              <path {...soft} d="M7.6 9.2 5.6 3.75l4.75 4.1z" />
              <path d="M7.6 9.2 5.6 3.75l4.75 4.1" />
            </g>
            <g className="h-wiggle-r" style={origin("0% 100%")}>
              <path {...soft} d="M16.4 9.2l2-5.45-4.75 4.1z" />
              <path d="M16.4 9.2l2-5.45-4.75 4.1" />
            </g>
            <path {...soft} d="M12 7.5c4.4 0 7.25 2.9 7.25 6.4S16.4 20.25 12 20.25 4.75 17.4 4.75 13.9 7.6 7.5 12 7.5z" />
            <path d="M12 7.5c4.4 0 7.25 2.9 7.25 6.4S16.4 20.25 12 20.25 4.75 17.4 4.75 13.9 7.6 7.5 12 7.5z" />
            <g className="l-blink">
              <circle fill={metal} stroke="none" cx="9.35" cy="13.4" r="1.35" />
              <circle fill={metal} stroke="none" cx="14.65" cy="13.4" r="1.35" />
            </g>
            <ellipse {...soft} opacity={0.35} cx="7.6" cy="15.6" rx="1.1" ry=".6" />
            <ellipse {...soft} opacity={0.35} cx="16.4" cy="15.6" rx="1.1" ry=".6" />
            <path {...thin} d="M11.1 16.3q.9.7 1.8 0" />
          </g>
        </g>
      )}
    </Icon>
  );
}

/** 棋盘皮肤:斜看的四格棋盘。悬停:棋盘落下弹起;选中:四格依次泛光 */
export function ArenaIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <g className="h-drop">
          <path fill={metal} stroke="none" opacity={0.35} d="M3.25 10v2.75L12 18.25l8.75-5.5V10L12 15.5z" />
          <path d="M3.25 10v2.75L12 18.25l8.75-5.5V10" />
          <path {...soft} d="M12 4.5 20.75 10 12 15.5 3.25 10z" />
          {[
            "M12 5.75 14.6 7.4 12 9.05 9.4 7.4z",
            "M16.4 8.35 19 10 16.4 11.65 13.8 10z",
            "M12 10.95 14.6 12.6 12 14.25 9.4 12.6z",
            "M7.6 8.35 10.2 10 7.6 11.65 5 10z",
          ].map((d, i) => (
            <path key={d} className="l-wave" style={delay(i * 0.5)} d={d} fill="currentColor" stroke="none" opacity={0.3} />
          ))}
          <path d="M12 4.5 20.75 10 12 15.5 3.25 10z" />
          <path {...thin} d="M7.6 7.25 16.4 12.75M16.4 7.25 7.6 12.75" />
        </g>
      )}
    </Icon>
  );
}

/** 地区传送门:拱门里的漩涡。悬停:漩涡旋转着打开;选中:漩涡缓转、门内光芒起伏 */
export function PortalIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path className="l-glow" fill="currentColor" stroke="none" opacity={0.18} d="M8 20.5V11.5a4 4 0 0 1 8 0v9z" />
          <path d="M5.75 20.5V11a6.25 6.25 0 0 1 12.5 0v9.5" />
          <path {...thin} d="M8 20.5V11.5a4 4 0 0 1 8 0v9" />
          <path d="M3.25 20.5h17.5" />
          <path className="l-breathe" fill={metal} stroke="none" d="M12 3.3 13.15 4.75 12 6.2 10.85 4.75z" />
          <g className="h-open">
            <g className="l-spin">
              <path d="M12 11.4c1.75 0 2.85 1.2 2.85 2.6M12 16.6c-1.75 0-2.85-1.2-2.85-2.6" />
              <circle cx="12" cy="14" r="0.9" fill="currentColor" stroke="none" />
            </g>
          </g>
        </>
      )}
    </Icon>
  );
}

/* ---------- 整包工具 ---------- */

/** 整包下载:收件托盘与箭头(同应用图标)。悬停:箭头落入、托盘一沉;选中:箭头轻轻起伏 */
export function DownloadIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <g className="h-sink">
            <path className="l-glow" {...soft} d="M3.75 13.75h4l1.5 2.25h5.5l1.5-2.25h4v6.75H3.75z" />
            <path d="M3.75 13.75h4l1.5 2.25h5.5l1.5-2.25h4v6.75H3.75z" />
          </g>
          <g className="h-drop">
            <g className="l-bob">
              <path fill={metal} stroke="none" d="M10.6 2.5h2.8v6.5h3.1L12 13.5 7.5 9h3.1z" />
              <path {...cut} d="M12 3.5v8.5" opacity={0.5} />
            </g>
          </g>
        </>
      )}
    </Icon>
  );
}

/** 汉化整理:文件夹里排好的条目。悬停:条目依次滑入;选中:条目长短交替,像在整理 */
export function OrganizeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path {...soft} d="M3 5.25h6.25l1.75 2.25H3z" />
          <path d="M3 5.25h6.25l1.75 2.25H21v11.75H3z" />
          {[
            { y: 10, w: 10.5 },
            { y: 12.75, w: 8 },
            { y: 15.5, w: 5.5 },
          ].map((b, i) => (
            <g key={b.y} className="h-slide" style={delay(i * 0.08)}>
              <path className="l-sort" style={{ ...delay(i * 0.35), ...origin("0% 50%") }} fill={metal} stroke="none" d={`M6.75 ${b.y}h${b.w}v1.5H6.75z`} />
            </g>
          ))}
        </>
      )}
    </Icon>
  );
}

/** 导航:罗盘。悬停:指针飞转后停回北方;选中:指针左右摆动寻向 */
export function CompassIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle {...soft} cx="12" cy="12" r="6.6" />
          <path {...thin} d="M12 3.75v1.6M20.25 12h-1.6M12 20.25v-1.6M3.75 12h1.6M17.85 6.15l-.8.8M6.15 17.85l.8-.8M17.85 17.85l-.8-.8M6.15 6.15l.8.8" />
          <g className="h-needle">
            <g className="l-sway">
              <path fill={metal} stroke="none" d="M12 5.5 13.6 12h-3.2z" />
              <path fill="currentColor" stroke="none" opacity={0.4} d="M12 18.5 10.4 12h3.2z" />
            </g>
          </g>
          <circle cx="12" cy="12" r="1" fill={CUT} stroke="currentColor" strokeWidth={0.8} />
        </>
      )}
    </Icon>
  );
}

/** 说明:翻开的书。悬停:右页翻过去;选中:书签摆动、星光闪烁 */
export function GuideIcon(p: IconProps) {
  return (
    <Icon {...p}>
      {(metal) => (
        <>
          <path {...soft} d="M3.5 6.25c2.75-1 5.75-1 8.5.75v13c-2.75-1.75-5.75-1.75-8.5-.75z" />
          <path d="M3.5 6.25c2.75-1 5.75-1 8.5.75 2.75-1.75 5.75-1.75 8.5-.75V19.5c-2.75-1-5.75-1-8.5.75-2.75-1.75-5.75-1.75-8.5-.75z" />
          <path d="M12 7v13.25" />
          <path {...thin} d="M5.75 10q2.5-.6 4.25.25M5.75 13q2.5-.6 4.25.25" />
          <g className="h-page" style={origin("0% 50%")}>
            <path {...soft} d="M12 7c2.75-1.75 5.75-1.75 8.5-.75V19.5c-2.75-1-5.75-1-8.5.75z" />
            <path {...thin} d="M14 13.25q2.4-.85 4.25-.25M14 16q2.4-.85 4.25-.25" />
          </g>
          <path className="l-sway" style={origin("50% 0%")} fill={metal} stroke="none" d="M15.25 5.6h2.5v5.15l-1.25-1-1.25 1z" />
          <path className="l-twinkle" d={sparkle(5.25, 3.25, 1.8)} fill="currentColor" stroke="none" />
        </>
      )}
    </Icon>
  );
}
