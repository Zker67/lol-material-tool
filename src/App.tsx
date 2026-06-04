import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { CloudDownload, FolderCog, Map as MapIcon, CircleHelp } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { Tabs, type TabDef } from "./components/Tabs";
import { DownloadPanel } from "./components/panels/DownloadPanel";
import { LocalizePanel } from "./components/panels/LocalizePanel";
import { NavPanel } from "./components/panels/NavPanel";
import { HelpPanel } from "./components/panels/HelpPanel";
import { useTaskProgress } from "./hooks/useTaskProgress";
import {
  listVersions,
  downloadPack,
  extractPack,
  runLolLocalization,
  runTftLocalization,
  cancelTask,
} from "./lib/api";

/** 顶部四个 tab(下载 / 汉化 / 导航 / 说明),复刻 Flet 版结构 */
const TABS: TabDef[] = [
  { key: "download", label: "下载", icon: CloudDownload },
  { key: "localize", label: "汉化", icon: FolderCog },
  { key: "nav", label: "导航", icon: MapIcon },
  { key: "help", label: "说明", icon: CircleHelp },
];

function App() {
  const [tab, setTab] = useState("download");
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [destDir, setDestDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultDir, setResultDir] = useState<string | null>(null);
  const [localizedDir, setLocalizedDir] = useState<string | null>(null);
  const { progress, reset } = useTaskProgress();

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const refreshVersions = () => {
    listVersions()
      .then((vs) => {
        setVersions(vs);
        if (vs.length) setVersion(vs[0]);
      })
      .catch((e) => addLog(`获取版本列表失败:${e}`));
  };

  useEffect(() => {
    refreshVersions();
  }, []);

  const pickDir = async () => {
    const dir = await open({ directory: true, multiple: false });
    if (typeof dir === "string") setDestDir(dir);
  };

  const start = async () => {
    if (!version) return addLog("请先选择版本");
    if (!destDir) return addLog("请先选择保存目录");
    setBusy(true);
    setResultDir(null);
    setLocalizedDir(null);
    reset();
    try {
      addLog(`开始下载 ${version} …`);
      const tgz = await downloadPack(version, destDir);
      addLog(`下载完成:${tgz}`);
      addLog("开始解压 …");
      const out = await extractPack(tgz, destDir, version);
      addLog(`解压完成:${out}`);
      setResultDir(out);
    } catch (e) {
      addLog(`任务失败:${e}`);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await cancelTask();
    addLog("已请求取消 …");
  };

  const openResult = async () => {
    if (!resultDir) return;
    try {
      await openPath(resultDir);
    } catch (e) {
      addLog(`打开数据包失败:${e}`);
    }
  };

  const runLocalize = async (label: string, fn: (d: string) => Promise<string>) => {
    if (!resultDir) return;
    setBusy(true);
    setLocalizedDir(null);
    reset();
    try {
      addLog(`开始${label} …`);
      const out = await fn(resultDir);
      addLog(`${label}完成:${out}`);
      setLocalizedDir(out);
    } catch (e) {
      addLog(`${label}失败:${e}`);
    } finally {
      setBusy(false);
    }
  };

  const openLocalized = async () => {
    if (!localizedDir) return;
    try {
      await openPath(localizedDir);
    } catch (e) {
      addLog(`打开汉化结果失败:${e}`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-hex-bg text-hex-text overflow-hidden">
      <TitleBar />

      {/* 产品标题(作者署名为公开身份 zker67) */}
      <header className="shrink-0 flex items-baseline justify-between px-6 py-3 border-b border-hex-gold-dark/30">
        <h1 className="text-lg font-display font-bold text-hex-gold tracking-wide">
          英雄联盟素材包获取 &amp; 整理工具
        </h1>
        <span className="text-xs text-hex-text-muted">by Bilibili 仓小杰 · 完全免费</span>
      </header>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <main className="flex-1 overflow-hidden px-6 py-5">
        {tab === "download" && (
          <DownloadPanel
            versions={versions}
            version={version}
            onVersionChange={setVersion}
            onRefresh={refreshVersions}
            destDir={destDir}
            onPickDir={pickDir}
            busy={busy}
            onStart={start}
            onCancel={cancel}
            resultDir={resultDir}
            onOpenResult={openResult}
            progress={progress}
            logs={logs}
          />
        )}
        {tab === "localize" && (
          <LocalizePanel
            resultDir={resultDir}
            busy={busy}
            onLolLocalize={() => runLocalize("联盟汉化", runLolLocalization)}
            onTftLocalize={() => runLocalize("云顶汉化", runTftLocalization)}
            localizedDir={localizedDir}
            onOpenLocalized={openLocalized}
            progress={progress}
            logs={logs}
          />
        )}
        {tab === "nav" && <NavPanel />}
        {tab === "help" && <HelpPanel />}
      </main>
    </div>
  );
}

export default App;
