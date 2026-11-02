import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Riot 文本里的标记(<stats>、<magicDamage>、<font color>、<br> 等)→ React 节点。
 * 自己解析成树再渲染,不用 innerHTML;未知标记只保留文字。
 * 官方数据里没填的数值(@HealAmount@、<placeholder>)显示为「?」。
 */

interface Node {
  tag: string;
  attrs: string;
  children: (Node | string)[];
}

const GOLD = "font-semibold text-hex-gold";
const KEYWORD = "font-semibold text-hex-gold-light";
const MAGIC = "text-[#7fb2ff]";
const PHYSICAL = "text-[#ff8c42]";
const HEAL = "text-[#5fd36a]";
const RULES = "block italic text-muted-foreground/80";

/** 标记名(小写)→ 样式 */
const TAG_CLASS: Record<string, string> = {
  stats: "block text-hex-gold-light",
  attention: GOLD,
  passive: GOLD,
  active: GOLD,
  unique: GOLD,
  jadeunique: GOLD,
  gold: "text-hex-gold",
  raritymythic: "font-semibold text-[#ff7ad9]",
  raritylegendary: "font-semibold text-[#ff9b47]",
  raritygeneric: GOLD,
  keyword: KEYWORD,
  keywordmajor: KEYWORD,
  keywordname: KEYWORD,
  tftkeyword: KEYWORD,
  spellname: KEYWORD,
  spellpassive: KEYWORD,
  recast: KEYWORD,
  titleleft: KEYWORD,
  magicdamage: MAGIC,
  scaleap: MAGIC,
  scalemr: MAGIC,
  physicaldamage: PHYSICAL,
  scalead: PHYSICAL,
  bonusad: PHYSICAL,
  onhit: PHYSICAL,
  attackspeed: PHYSICAL,
  scalecrit: PHYSICAL,
  scalelethality: PHYSICAL,
  armorpen: PHYSICAL,
  truedamage: "text-white",
  healing: HEAL,
  health: HEAL,
  scalehealth: HEAL,
  lifesteal: HEAL,
  omnivamp: HEAL,
  buffedstat: HEAL,
  statgood: HEAL,
  shield: "text-[#c9d6e0]",
  scalearmor: "text-[#e0c27a]",
  status: "text-[#d7a3ff]",
  keywordstealth: "text-[#b48cff]",
  speed: "text-[#ecd87a]",
  scalemana: "text-[#5aa9e6]",
  nerfedstat: "text-destructive",
  danger: "text-destructive",
  rules: RULES,
  jaderules: RULES,
  tftitemrules: RULES,
  flavortext: RULES,
  dim: "text-muted-foreground/70",
  // 云顶
  tftstat: "mx-0.5 rounded-sm bg-white/8 px-1 text-[10px] text-hex-blue",
  row: "block",
  expandrow: "block",
  tftbonus: KEYWORD,
  tftbold: "font-semibold",
  tftstrong: "font-semibold",
  bright: "text-hex-gold-light",
  scalelevel: KEYWORD,
  spellactive: GOLD,
  tftpassive: GOLD,
  tftactiverank: KEYWORD,
  tftguildactive: KEYWORD,
  set18charmupgrade: KEYWORD,
  tftguildinactive: "text-muted-foreground/70",
  tfttrackerlabel: "text-muted-foreground/70",
  tftradiantitembonus: "text-[#ffd86b]",
  tftshadowitembonus: "text-[#b48cff]",
  scaleshimmer: "text-[#d7a3ff]",
  b: "font-semibold",
  i: "italic",
  li: "block before:mr-1 before:content-['•']",
};

/** 没有结束标记的标记 */
const VOID = new Set(["br", "hr", "placeholder"]);

// 标记必须紧跟 <,属性前有空白;「a < b」这类文字里的 < 不算标记。标记名可含 .(如 ShowIf.xxx)
const TOKEN = /<(\/?)([a-zA-Z][\w.-]*)((?:\s[^<>]*)?)>|([^<]+)|(<)/g;
const TAG = /<\/?[a-zA-Z][\w.-]*(?:\s[^<>]*)?\/?>/g;
const LEADING_BR = /^((?:<[a-zA-Z][\w.-]*(?:\s[^<>]*)?>\s*)*)(?:<br\s*\/?>\s*)+/i;
const TRAILING_BR = /(?:<br\s*\/?>\s*)+((?:<\/[\w.-]+>\s*)*)$/i;

function decode(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\{\{[^}]*\}\}/g, "") // 模板钩子(如 spellmodifierdescriptionappend),没有内容
    .replace(/@[\w.]+@/g, "?"); // 官方没填的数值
}

function parse(source: string): Node {
  const root: Node = { tag: "", attrs: "", children: [] };
  const stack: Node[] = [root];
  for (const m of source.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (m[4] !== undefined || m[5] !== undefined) {
      top.children.push(decode(m[4] ?? m[5]));
      continue;
    }
    const [, closing, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if (VOID.has(tag) || attrs.trim().endsWith("/")) {
      if (!closing) top.children.push({ tag, attrs, children: [] });
      continue;
    }
    if (closing) {
      let i = stack.length - 1;
      while (i > 0 && stack[i].tag !== tag) i--;
      if (i > 0) stack.length = i;
      continue;
    }
    const node: Node = { tag, attrs, children: [] };
    top.children.push(node);
    stack.push(node);
  }
  return root;
}

function fontColor(attrs: string): string | undefined {
  const m = /color\s*=\s*['"]?(#[0-9a-fA-F]{3,8})/.exec(attrs);
  return m?.[1];
}

function render(children: (Node | string)[]): ReactNode[] {
  return children.map((c, i) => {
    if (typeof c === "string") return <Fragment key={i}>{c}</Fragment>;
    if (c.tag === "br") return <br key={i} />;
    if (c.tag === "hr") return <span key={i} className="my-1.5 block border-t border-border" />;
    if (c.tag === "placeholder") return <Fragment key={i}>?</Fragment>;
    const inner = render(c.children);
    if (c.tag === "font") {
      const color = fontColor(c.attrs);
      return (
        <span key={i} style={color ? { color } : undefined}>
          {inner}
        </span>
      );
    }
    const cls = TAG_CLASS[c.tag];
    return cls ? (
      <span key={i} className={cls}>
        {inner}
      </span>
    ) : (
      <Fragment key={i}>{inner}</Fragment>
    );
  });
}

/** 渲染 Riot 文本;去掉首尾多余的换行(包括包在 <mainText> 等标记里的) */
export function RichText({ text, className }: { text: string; className?: string }) {
  let source = (text ?? "").trim();
  for (let prev = ""; prev !== source; ) {
    prev = source;
    source = source.replace(LEADING_BR, "$1").replace(TRAILING_BR, "$1").trim();
  }
  if (!source) return null;
  return <div className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{render(parse(source).children)}</div>;
}

/** 纯文本(复制、搜索用) */
export function plainText(html: string): string {
  return decode(
    (html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li>/gi, "\n• ")
      .replace(/<placeholder>/gi, "?")
      .replace(TAG, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
