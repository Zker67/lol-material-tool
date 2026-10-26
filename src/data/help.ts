/**
 * 说明页(侧边栏「说明」)数据:联系方式 + 软件介绍 + 使用指南。
 * 联系方式为公开侧 zker67(B 站「仓小杰」/ 微信 zker67)。
 */

/** 联系方式 */
export interface HelpContact {
  /** 图标类型 */
  icon: "video" | "chat";
  label: string;
  value: string;
  /** 有则可点击跳转 */
  url?: string;
  /** 可复制(如微信号) */
  copyable?: boolean;
  note?: string;
}

export const HELP_CONTACT_INTRO = "后续更新、功能建议或 Bug 反馈,欢迎通过以下方式联系:";

export const HELP_CONTACTS: HelpContact[] = [
  { icon: "video", label: "Bilibili", value: "仓小杰", url: "https://space.bilibili.com/13540581" },
  { icon: "chat", label: "微信", value: "zker67", copyable: true, note: "(添加请注明来意)" },
];

/** 说明段落:可选小标题 + 若干行正文 */
export interface HelpPara {
  heading?: string;
  lines: string[];
}

export interface HelpSection {
  title: string;
  paras: HelpPara[];
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    title: "📖 软件介绍 & 工作原理",
    paras: [
      { lines: ["本工具专为英雄联盟与云顶之弈创作者设计,旨在解决中文素材获取和查找困难的问题。"] },
      {
        heading: "核心逻辑:",
        lines: [
          "1. 自动获取 Riot Games 官方 Data Dragon 接口的最新版本列表。",
          "2. 下载指定版本的 dragontail 压缩包(包含游戏全量静态资源)。",
          "3. 解析 data/zh_CN/ 目录下的官方中文 JSON 数据文件。",
          "4. 根据 JSON 中的映射关系,将图片从 ID 批量重命名为中文名称(如 '1.png' → '安妮.png')。",
          "5. 按照英雄、装备、符文、云顶羁绊等分类自动归档整理。",
        ],
      },
      {
        heading: "💾 数据来源:",
        lines: [
          "所有资源均直接拉取自 Riot Games 官方服务器 (ddragon.leagueoflegends.com),保证素材的原生性与安全性。",
          "「历史原画」来自社区镜像 CommunityDragon (raw.communitydragon.org),非官方,覆盖 7.1 起的版本。",
        ],
      },
    ],
  },
  {
    title: "🔍 素材浏览",
    paras: [
      {
        lines: [
          "• 左侧「素材浏览」可在线查看任意版本的英雄、皮肤、装备、符文、召唤师技能和云顶素材,无需下载整包。",
          "• 详情里有技能、装备、符文等的官方说明与数值,以及英雄背景和技巧,可一键复制。",
          "• 皮肤按英雄分组,可在「英雄」筛选里只看某位英雄。",
          "• 顶部切换版本;选择「对比」版本可标出新增、改名和移除的条目。",
          "• 官方只保留最新原画;英雄详情里打开「该版本历史原画」可查看该版本当时的原画和炫彩。",
          "• Ctrl + K 跨分类搜索;详情中可单张另存,或一键导出该英雄全部素材。",
          "• 看过的图片缓存在本地,左下角「素材缓存」可查看占用或清理。",
        ],
      },
    ],
  },
  {
    title: "🛠️ 详细使用指南",
    paras: [
      {
        heading: "第一步:获取素材",
        lines: [
          "• 在「整包下载」页面选择赛季和具体版本号(通常选择最新版)。",
          "• 点击「获取数据包」,等待进度条完成。文件较大,请耐心等待;部分旧版本官方未提供整包,会直接提示。",
        ],
      },
      {
        heading: "第二步:汉化整理",
        lines: [
          "• 切换到「汉化整理」页面。若刚完成下载,源路径会自动填充。",
          "• 点击「联盟汉化」或「云顶汉化」。",
          "• 程序将自动读取数据并生成中文命名的文件夹。",
        ],
      },
      {
        heading: "第三步:使用素材",
        lines: ["• 点击完成后的「打开汉化结果」按钮,即可直接使用整理好的中文素材。"],
      },
    ],
  },
];
