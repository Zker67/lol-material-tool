import { useEffect, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { Browser } from "./features/browser/Browser";
import { CommandPalette } from "./features/browser/CommandPalette";
import { SaveDirDialog } from "./components/SaveDirDialog";
import { BROWSER_SECTIONS, useUI } from "./store/ui";
import { Tasks, type PackInfo } from "./mygo";
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
  pickDirectory,
  openPath,
  errorMessage,
} from "./lib/api";

function App() {
  const section = useUI((s) => s.section);
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [destDir, setDestDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultDir, setResultDir] = useState<string | null>(null);
  const [localizedDir, setLocalizedDir] = useState<string | null>(null);
  const { progress, reset } = useTaskProgress();
  // 选中版本的官方全量包是否存在(部分版本如 7.24.2 没有);undefined 表示检查中
  const [packInfo, setPackInfo] = useState<PackInfo | null | undefined>(undefined);

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  const refreshVersions = () => {
    listVersions()
      .then((vs) => {
        setVersions(vs);
        if (vs.length) setVersion(vs[0]);
      })
      .catch((e) => addLog(`获取版本列表失败:${errorMessage(e)}`));
  };

  useEffect(() => {
    refreshVersions();
  }, []);

  useEffect(() => {
    if (!version) return;
    let stale = false;
    setPackInfo(undefined);
    Tasks.checkPack(version)
      .then((info) => !stale && setPackInfo(info))
      .catch(() => !stale && setPackInfo(null)); // 检查失败不阻止下载
    return () => {
      stale = true;
    };
  }, [version]);

  const pickDir = async () => {
    try {
      const dir = await pickDirectory();
      if (dir) setDestDir(dir);
    } catch (e) {
      addLog(`选择目录失败:${errorMessage(e)}`);
    }
  };

  const start = async () => {
    if (!version) return addLog("请先选择版本");
    if (packInfo && !packInfo.available) return addLog(`版本 ${version} 官方未提供全量数据包,请换一个版本`);
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
      addLog(`任务失败:${errorMessage(e)}`);
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
      addLog(`打开数据包失败:${errorMessage(e)}`);
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
      addLog(`${label}失败:${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const openLocalized = async () => {
    if (!localizedDir) return;
    try {
      await openPath(localizedDir);
    } catch (e) {
      addLog(`打开汉化结果失败:${errorMessage(e)}`);
    }
  };

  const inBrowser = BROWSER_SECTIONS.includes(section);

  return (
    <div className="flex flex-col h-screen bg-hex-bg text-hex-text overflow-hidden">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className={inBrowser ? "min-w-0 flex-1 overflow-hidden" : "min-w-0 flex-1 overflow-hidden px-6 py-5"}>
          {inBrowser && <Browser progress={progress} />}
          {section === "download" && (
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
              packInfo={packInfo}
            />
          )}
          {section === "localize" && (
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
          {section === "nav" && <NavPanel />}
          {section === "help" && <HelpPanel />}
        </main>
      </div>
      <CommandPalette />
      <SaveDirDialog />
    </div>
  );
}

export default App;
