import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Video,
  MessageSquare,
  HelpCircle,
  Check,
  Copy,
  AlertCircle,
  Info,
  BookmarkCheck,
  Compass,
  Sparkles,
} from "lucide-react";
import { HELP_CONTACT_INTRO, HELP_CONTACTS, HELP_SECTIONS } from "../../data/help";

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
}

const CATEGORIES: CategoryDef[] = [
  { key: "all", label: "全部内容", icon: Compass },
  { key: "about", label: "介绍与原理", icon: Info },
  { key: "guide", label: "使用指南", icon: BookmarkCheck },
  { key: "contact", label: "反馈与作者", icon: MessageSquare },
  { key: "faq", label: "常见问题 FAQ", icon: HelpCircle },
];

export function HelpPanel() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLabel(label);
      setTimeout(() => setCopiedLabel(null), 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  const introSection = HELP_SECTIONS.find((s) => s.title.includes("介绍") || s.title.includes("原理"));
  const guideSection = HELP_SECTIONS.find((s) => s.title.includes("指南") || s.title.includes("使用"));

  // 1. 渲染 - 介绍与原理
  const renderAbout = (isFullWidth = true) => {
    if (!introSection) return null;
    return (
      <section className={`rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/50 hover:shadow-[0_0_15px_rgba(200,170,110,0.04)] transition-all duration-300 ${!isFullWidth && 'max-w-4xl'}`}>
        <h2 className="text-base font-display font-bold text-hex-gold border-b border-hex-gold-dark/20 pb-2.5 mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-hex-gold" />
          <span>{introSection.title}</span>
        </h2>

        <div className="space-y-4">
          {introSection.paras.map((p, pi) => {
            if (!p.heading) {
              return p.lines.map((line, li) => (
                <p key={li} className="text-xs text-hex-gold-light leading-relaxed">
                  {line}
                </p>
              ));
            }

            const isCoreLogic = p.heading.includes("核心逻辑");

            return (
              <div key={pi} className="space-y-2">
                <div className="text-[11px] font-semibold text-hex-blue tracking-wider uppercase flex items-center gap-1.5">
                  <span className="w-1 h-2.5 bg-hex-blue rounded-full" />
                  {p.heading}
                </div>

                {isCoreLogic ? (
                  <div className="grid grid-cols-1 gap-2 pl-1">
                    {p.lines.map((line, li) => {
                      const match = line.match(/^(\d+)\.\s*(.*)/);
                      const num = match ? match[1] : (li + 1).toString();
                      const content = match ? match[2] : line;

                      return (
                        <div key={li} className="flex items-start gap-2.5 p-2 rounded bg-hex-bg-2/30 border border-hex-gold-dark/10">
                          <span className="w-4 h-4 flex-shrink-0 rounded-full bg-hex-gold-dark/30 border border-hex-gold/30 text-hex-gold text-[10px] font-bold flex items-center justify-center font-mono">
                            {num}
                          </span>
                          <span className="text-xs text-hex-gold-light leading-relaxed">
                            {content}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5 pl-2.5">
                    {p.lines.map((line, li) => (
                      <p key={li} className="text-xs text-hex-text-muted leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // 2. 渲染 - 使用指南
  const renderGuide = (isFullWidth = true) => {
    if (!guideSection) return null;
    return (
      <section className={`rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/50 hover:shadow-[0_0_15px_rgba(200,170,110,0.04)] transition-all duration-300 ${!isFullWidth && 'max-w-4xl'}`}>
        <h2 className="text-base font-display font-bold text-hex-gold border-b border-hex-gold-dark/20 pb-2.5 mb-5 flex items-center gap-2">
          <BookmarkCheck className="w-5 h-5 text-hex-gold" />
          <span>{guideSection.title}</span>
        </h2>

        <div className="relative pl-6 border-l-2 border-hex-gold-dark/20 space-y-5 ml-2.5 py-1">
          {guideSection.paras.map((p, pi) => {
            const stepNum = pi + 1;
            return (
              <div key={pi} className="relative">
                <span className="absolute -left-[35px] top-0.5 w-6 h-6 rounded-full bg-hex-bg border-2 border-hex-gold text-hex-gold font-bold text-[10px] flex items-center justify-center shadow-md font-mono">
                  {stepNum}
                </span>

                {p.heading && (
                  <h4 className="text-xs font-bold text-hex-gold-light tracking-wide mb-1.5">
                    {p.heading.replace(/^\w+步:\s*/, "")}
                  </h4>
                )}

                <div className="space-y-1 pl-0.5">
                  {p.lines.map((line, li) => (
                    <p key={li} className="text-[11px] text-hex-text-muted leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // 3. 渲染 - 联系作者 & 反馈
  const renderContact = (isFullWidth = true) => {
    return (
      <section className={`rounded-lg border border-hex-gold-dark/40 bg-gradient-to-b from-hex-panel/20 to-hex-bg-2/20 p-5 hover:border-hex-gold/50 transition-all duration-300 ${!isFullWidth && 'max-w-4xl'}`}>
        <h2 className="text-base font-display font-bold text-hex-gold border-b border-hex-gold-dark/20 pb-2.5 mb-4">
          📧 联系作者 & 反馈
        </h2>
        <p className="text-xs text-hex-text-muted leading-relaxed mb-4">
          {HELP_CONTACT_INTRO}
        </p>

        <div className="space-y-3">
          {HELP_CONTACTS.map((c) => {
            const isCopied = copiedLabel === c.label;
            return (
              <div
                key={c.label}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded bg-hex-bg-2/40 border border-hex-gold-dark/15 hover:border-hex-gold-dark/30 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs">
                  {c.icon === "video" ? (
                    <Video size={15} className="text-hex-blue shrink-0" />
                  ) : (
                    <MessageSquare size={15} className="text-hex-blue shrink-0" />
                  )}
                  <span className="text-hex-gold-light font-medium">{c.label}:</span>
                  <span className="text-hex-text font-semibold select-all font-mono">{c.value}</span>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {c.url ? (
                    <button
                      onClick={() => openUrl(c.url!)}
                      className="px-2.5 py-1 text-[10px] font-medium text-hex-blue bg-hex-blue-dark/10 hover:bg-hex-blue-dark/20 border border-hex-blue-dark/30 hover:border-hex-blue rounded transition-all duration-200"
                    >
                      点击访问
                    </button>
                  ) : c.copyable ? (
                    <button
                      onClick={() => handleCopy(c.value, c.label)}
                      className={`px-2.5 py-1 text-[10px] font-medium rounded border transition-all duration-200 flex items-center gap-1 ${isCopied
                        ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/30"
                        : "bg-hex-gold-dark/10 text-hex-gold hover:text-hex-gold-light hover:bg-hex-gold-dark/20 border-hex-gold-dark/30 hover:border-hex-gold"
                        }`}
                    >
                      {isCopied ? (
                        <>
                          <Check size={9} />
                          <span>已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy size={9} />
                          <span>复制微信号</span>
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-1.5 text-[10px] text-hex-text-muted bg-hex-bg-2/20 p-2.5 rounded border border-hex-gold-dark/10">
          <AlertCircle className="w-3.5 h-3.5 text-hex-gold shrink-0 mt-0.5" />
          <span>温馨提示：作者纯纯铁血打工人，微信添加请务必备注说明来意（如：联盟素材工具）。</span>
        </div>
      </section>
    );
  };

  // 4. 渲染 - FAQ 问答
  const renderFaq = (isFullWidth = true) => {
    return (
      <section className={`rounded-lg border border-hex-gold-dark/40 bg-hex-panel/10 p-5 hover:border-hex-gold/40 transition-all duration-300 ${!isFullWidth && 'max-w-4xl'}`}>
        <h2 className="text-base font-display font-bold text-hex-gold border-b border-hex-gold-dark/20 pb-2.5 mb-4 flex items-center gap-2">
          <HelpCircle className="w-4.5 h-4.5 text-hex-gold" />
          <span>常见问题 FAQ</span>
        </h2>

        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-hex-gold-light">Q: 下载速度慢或请求报错？</h4>
            <p className="text-[11px] text-hex-text-muted leading-relaxed">
              A: 游戏素材包大小为数 GB，均直接请求 Riot Games 官方服务器。下载速度取决于您的本地跨国网络状态。若遇报错，可检查网络并重试。
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-hex-gold-light">Q: 整理汉化生成的文件存放在哪里？</h4>
            <p className="text-[11px] text-hex-text-muted leading-relaxed">
              A: 保存在您在「下载」页面选择的保存文件夹中。在「汉化」页面点击「打开汉化结果」，可直接自动定位到生成好的中文命名的素材目录下。
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-hex-gold-light">Q: 该工具会修改游戏本身的文件吗？</h4>
            <p className="text-[11px] text-hex-text-muted leading-relaxed">
              A: 不会。本整理工具是在本地独立的指定目录下，对官方开放的静态资源包进行解压和分类翻译，绝对不会触碰、篡改游戏客户端的核心数据，请安心使用。
            </p>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* 左侧说明分类侧边栏 */}
      <aside className="w-52 flex-shrink-0 flex flex-col justify-between bg-hex-bg-2/30 border border-hex-gold-dark/20 rounded-lg p-4 select-none">
        <div className="space-y-5">
          <div className="px-1.5 pb-2 border-b border-hex-gold-dark/10">
            <h2 className="text-xs font-display font-bold text-hex-gold tracking-widest uppercase">
              说明中心
            </h2>
            <p className="text-[9px] text-hex-text-muted mt-0.5 tracking-wider font-mono">
              USER DOCUMENTATION
            </p>
          </div>

          <nav className="space-y-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 group text-left ${isActive
                    ? "bg-hex-gold-dark/20 text-hex-gold border-l-2 border-hex-gold shadow-[inset_1px_0_0_rgba(200,170,110,0.1)] font-bold"
                    : "text-hex-text-muted hover:text-hex-gold-light hover:bg-hex-panel/20 border-l-2 border-transparent"
                    }`}
                >
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive
                      ? "text-hex-gold"
                      : "text-hex-text-muted group-hover:text-hex-gold-light"
                      }`}
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* 底部小标志 */}
        <div className="px-1.5 pt-3 border-t border-hex-gold-dark/10 flex items-center gap-1.5 text-[10px] text-hex-text-muted select-none">
          <Sparkles className="w-3 h-3 text-hex-gold animate-pulse" />
          <span>Lol Material Info</span>
        </div>
      </aside>

      {/* 右侧主显示面板 */}
      <div className="flex-1 overflow-auto pr-1">
        {activeCategory === "all" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pb-4">
            {renderAbout(true)}
            {renderGuide(true)}
            {renderContact(true)}
            {renderFaq(true)}
          </div>
        )}
        {activeCategory === "about" && renderAbout(false)}
        {activeCategory === "guide" && renderGuide(false)}
        {activeCategory === "contact" && renderContact(false)}
        {activeCategory === "faq" && renderFaq(false)}
      </div>
    </div>
  );
}
