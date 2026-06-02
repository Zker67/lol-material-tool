import { openUrl } from "@tauri-apps/plugin-opener";
import { Video, MessageSquare } from "lucide-react";
import { HELP_CONTACT_INTRO, HELP_CONTACTS, HELP_SECTIONS } from "../../data/help";

/** 说明页:联系作者 + 软件介绍 + 使用指南(数据来自 data/help.ts) */
export function HelpPanel() {
  return (
    <div className="h-full overflow-auto pr-1 space-y-5 max-w-3xl">
      {/* 联系作者 & 反馈 */}
      <section className="rounded-lg border border-hex-gold-dark/40 bg-hex-blue-dark/10 p-5">
        <h2 className="text-lg font-display font-bold text-hex-gold border-b border-hex-gold-dark/50 pb-2 mb-3">
          📧 联系作者 & 反馈
        </h2>
        <p className="text-sm text-hex-gold-light mb-3">{HELP_CONTACT_INTRO}</p>
        <div className="space-y-2">
          {HELP_CONTACTS.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.icon === "video" ? (
                <Video size={18} className="text-hex-blue shrink-0" />
              ) : (
                <MessageSquare size={18} className="text-hex-blue shrink-0" />
              )}
              <span className="text-hex-gold-light">{c.label}:</span>
              {c.url ? (
                <button
                  onClick={() => openUrl(c.url!)}
                  className="text-hex-blue hover:text-hex-blue-light underline underline-offset-2 font-semibold"
                >
                  {c.value}
                </button>
              ) : (
                <span className="text-hex-blue font-semibold select-text">{c.value}</span>
              )}
              {c.note && <span className="text-xs text-hex-text-muted">{c.note}</span>}
            </div>
          ))}
        </div>
      </section>

      {/* 软件介绍 / 使用指南 */}
      {HELP_SECTIONS.map((sec) => (
        <section
          key={sec.title}
          className="rounded-lg border border-hex-gold-dark/40 bg-hex-blue-dark/10 p-5"
        >
          <h2 className="text-lg font-display font-bold text-hex-gold border-b border-hex-gold-dark/50 pb-2 mb-3">
            {sec.title}
          </h2>
          <div className="space-y-3">
            {sec.paras.map((p, pi) => (
              <div key={pi} className="space-y-1">
                {p.heading && <div className="text-sm font-semibold text-hex-blue">{p.heading}</div>}
                {p.lines.map((line, li) => (
                  <p key={li} className="text-sm text-hex-gold-light leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
