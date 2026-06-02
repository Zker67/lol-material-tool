import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { NavBlock } from "../../data/navigation";
import { NAV_COLUMNS } from "../../data/navigation";

/** 可点击的外链文字 */
function Link({ name, url }: { name: string; url: string }) {
  return (
    <button
      onClick={() => openUrl(url)}
      className="text-hex-blue hover:text-hex-blue-light underline underline-offset-2 text-left"
    >
      {name}
    </button>
  );
}

/** 普通区块外框 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-hex-gold-dark/40 bg-hex-blue-dark/10 p-4">
      <h3 className="text-base font-display font-bold text-hex-gold mb-2">{title}</h3>
      {children}
    </div>
  );
}

/** 按 kind 渲染单个导航区块 */
function Block({ block }: { block: NavBlock }) {
  switch (block.kind) {
    case "featured":
      return (
        <div className="rounded-lg border border-hex-gold/60 bg-gradient-to-br from-hex-blue-dark/40 to-hex-gold-dark/20 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-hex-gold text-lg">✦</span>
            <h3 className="text-lg font-display font-bold text-hex-gold">{block.title}</h3>
          </div>
          <div className="space-y-2">
            {block.items.map((it) => (
              <div key={it.url} className="flex items-center gap-2 text-sm">
                <span>{it.icon}</span>
                <Link name={it.name} url={it.url} />
              </div>
            ))}
          </div>
        </div>
      );
    case "links":
      return (
        <Section title={block.title}>
          <div className="space-y-2">
            {block.items.map((it) => (
              <div key={it.url} className="flex flex-col">
                <Link name={it.name} url={it.url} />
                {it.desc && <span className="text-xs text-hex-text-muted">{it.desc}</span>}
              </div>
            ))}
          </div>
        </Section>
      );
    case "sources":
      return (
        <Section title={block.title}>
          <div className="space-y-2">
            {block.rows.map((row) => (
              <div key={row.label} className="text-sm leading-relaxed">
                <span className="text-hex-gold-light font-semibold">{row.label}: </span>
                {row.items.map((it, i) => (
                  <span key={it.url}>
                    <Link name={it.name} url={it.url} />
                    {i < row.items.length - 1 && (
                      <span className="text-hex-text-muted"> | </span>
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Section>
      );
    case "mixed":
      return (
        <Section title={block.title}>
          <div className="space-y-3">
            {block.groups.map((g, gi) => (
              <div key={gi}>
                {g.label && (
                  <div className="text-hex-gold-light font-semibold text-sm mb-1">{g.label}</div>
                )}
                <div className="flex flex-col gap-1">
                  {g.items.map((it) => (
                    <div key={it.url} className="text-sm">
                      <Link name={it.name} url={it.url} />
                      {it.desc && <span className="text-xs text-hex-text-muted"> · {it.desc}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      );
  }
}

/** 导航页:三列素材资源链接(数据来自 data/navigation.ts) */
export function NavPanel() {
  return (
    <div className="grid grid-cols-3 gap-5 h-full overflow-auto pr-1">
      {NAV_COLUMNS.map((col, ci) => (
        <div key={ci} className="space-y-4">
          {col.map((block, bi) => (
            <Block key={bi} block={block} />
          ))}
        </div>
      ))}
    </div>
  );
}
