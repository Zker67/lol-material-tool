/**
 * 导航页(Tab「导航」)数据。
 * 全部为公开侧 zker67 收集/制作的英雄联盟与云顶之弈素材资源链接,数据驱动渲染。
 */

/** 普通链接,可带一行说明 */
export interface NavItem {
  name: string;
  url: string;
  desc?: string;
}

/** 「来源: a | b | c」一行多链接 */
export interface NavSourceRow {
  label: string;
  items: NavItem[];
}

/** 带可选小标题的一组横排链接 */
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/** 导航区块,按 kind 区分渲染方式 */
export type NavBlock =
  | { kind: "featured"; title: string; items: { icon: string; name: string; url: string }[] }
  | { kind: "links"; title: string; items: NavItem[] }
  | { kind: "sources"; title: string; rows: NavSourceRow[] }
  | { kind: "mixed"; title: string; groups: NavGroup[] };

/** 三列导航布局:每列若干区块 */
export const NAV_COLUMNS: NavBlock[][] = [
  // ── 第 1 列 ───────────────────────────────────────────────
  [
    {
      kind: "featured",
      title: "我制作的导航工具",
      items: [
        { icon: "🎬", name: "英雄联盟剪辑教程文档", url: "https://zker.craft.me/lol-edit" },
        { icon: "📚", name: "全英雄索引素材库", url: "https://lol-hero.notion.site/" },
        {
          icon: "🔖",
          name: "导航书签页",
          url: "https://arc.net/space/3D4FB193-8841-4AED-B774-940D13E587E3",
        },
      ],
    },
    {
      kind: "links",
      title: "🌐 综合网站",
      items: [
        { name: "LoL DB", url: "https://lol-db.com/", desc: "联盟数据库 (中英对照)" },
        { name: "LoL Wiki", url: "https://wiki.leagueoflegends.com/en-us/", desc: "官方维基 (纯英文)" },
        { name: "Ghostoact (幽灵疾步)", url: "https://www.ghostoact.com/", desc: "资讯/资源/日历/插画" },
        { name: "布锅锅联盟宇宙", url: "https://buguoguo.cn/", desc: "原画/语音/模型整合" },
      ],
    },
  ],

  // ── 第 2 列 ───────────────────────────────────────────────
  [
    {
      kind: "sources",
      title: "🏞️ 英雄联盟图标",
      rows: [
        {
          label: "LoL DB",
          items: [
            { name: "装备", url: "https://lol-db.com/lol-items/?v=latest" },
            { name: "符文", url: "https://lol-db.com/lol-runes/?v=latest" },
            { name: "表情", url: "https://lol-db.com/lol-emotes/?v=latest" },
            { name: "成就", url: "https://lol-db.com/lol-challenges/" },
            { name: "英雄技能", url: "https://lol-db.com/lol-champions/?v=latest" },
            { name: "头像", url: "https://lol-db.com/lol-icons/?v=latest" },
            { name: "斗魂强化", url: "https://lol-db.com/lol-augments/?v=latest#arena" },
          ],
        },
        {
          label: "Wiki",
          items: [
            { name: "装备", url: "https://wiki.leagueoflegends.com/en-us/Item#List_of_Items" },
            { name: "符文", url: "https://wiki.leagueoflegends.com/en-us/Rune#Trees" },
            {
              name: "召唤师技能",
              url: "https://wiki.leagueoflegends.com/en-us/Summoner_spell#Available_summoner_spells",
            },
            { name: "英雄技能", url: "https://wiki.leagueoflegends.com/en-us/" },
          ],
        },
        {
          label: "Ghostoact",
          items: [
            { name: "表情", url: "https://www.ghostoact.com/act/tools/emotes" },
            { name: "头像", url: "https://www.ghostoact.com/act/tools/summonerIcon" },
            { name: "段位", url: "https://www.ghostoact.com/act/tools/rankTiers" },
          ],
        },
      ],
    },
    {
      kind: "sources",
      title: "☁️ 云顶之弈图标",
      rows: [
        {
          label: "LoL DB",
          items: [
            { name: "装备", url: "https://lol-db.com/tft-items/" },
            { name: "羁绊", url: "https://lol-db.com/tft-traits/" },
            { name: "弈子", url: "https://lol-db.com/tft-units/" },
            { name: "海克斯", url: "https://lol-db.com/tft-augments/" },
            { name: "奇遇", url: "https://lol-db.com/tft-anomaly/" },
            { name: "棋盘", url: "https://lol-db.com/tft-arenas/" },
            { name: "攻击特效", url: "https://lol-db.com/tft-booms/" },
            { name: "小小英雄", url: "https://lol-db.com/tft-companions/" },
          ],
        },
        {
          label: "Wiki",
          items: [
            { name: "装备", url: "https://wiki.leagueoflegends.com/en-us/TFT:Item#Completed_items" },
            { name: "弈子", url: "https://wiki.leagueoflegends.com/en-us/TFT:Teamfight_Tactics" },
          ],
        },
      ],
    },
    {
      kind: "mixed",
      title: "🖼️ 插画资源",
      groups: [
        {
          label: "官方原画:",
          items: [
            { name: "布锅锅原画库", url: "https://splash.buguoguo.cn/" },
            { name: "LoL Skins", url: "https://lol-db.com/lol-skins/" },
            {
              name: "Ghostoact 资源库",
              url: "https://www.ghostoact.com/arts",
              desc: "皮肤狗牌/国服炫彩/手游插画",
            },
          ],
        },
        {
          label: "高清/壁纸:",
          items: [
            {
              name: "UHD Paper (4K)",
              url: "https://www.uhdpaper.com/search?q=league+of+legends&by-date=true&i=0",
            },
            {
              name: "Wallhaven",
              url: "https://wallhaven.cc/search?q=id%3A537&categories=110&purity=110&sorting=date_added&order=desc&ai_art_filter=1",
            },
            {
              name: "ArtStation",
              url: "https://www.artstation.com/search?sort_by=relevance&query=league%20of%20legends",
              desc: "艺术家原稿",
            },
          ],
        },
      ],
    },
  ],

  // ── 第 3 列 ───────────────────────────────────────────────
  [
    {
      kind: "mixed",
      title: "🔊 音效资源",
      groups: [
        {
          label: "游戏音效:",
          items: [{ name: "大寒无雪 (击杀/技能/标记)", url: "https://voice.twitp.com/hero-detail-0.html" }],
        },
        {
          label: "台词语音:",
          items: [
            { name: "大寒无雪 (部分)", url: "https://voice.twitp.com/" },
            { name: "布锅锅语音 (全)", url: "https://voice.buguoguo.cn/#/voice" },
          ],
        },
        {
          label: "技能音效:",
          items: [
            {
              name: "全英雄数据库",
              url: "https://lol-hero.notion.site/?v=218c1631b0a880d399c3000cc98e8bac",
              desc: "查阅 Wiki 下载",
            },
          ],
        },
      ],
    },
    {
      kind: "links",
      title: "📦 3D 模型",
      items: [
        {
          name: "卡达 - 英雄联盟3D模型站",
          url: "https://3d.buguoguo.cn/",
          desc: "联盟英雄/小小英雄/小兵野怪 · 查看动画/导出透明图/导出GLB模型",
        },
      ],
    },
  ],
];
