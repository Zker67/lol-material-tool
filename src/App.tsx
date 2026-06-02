import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { FolderOpen, Download, X, Loader2, Languages } from "lucide-react";
import { TitleBar } from "./components/TitleBar";
import { HextechProgressBar } from "./components/HextechProgressBar";
import { useTaskProgress } from "./hooks/useTaskProgress";
import { listVersions, downloadPack, extractPack, runLolLocalization, cancelTask } from "./lib/api";
import { formatBytes, formatSpeed, formatEta } from "./lib/utils";

function App() {
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState("");
  const [destDir, setDestDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [resultDir, setResultDir] = useState<string | null>(null);
  const [localizedDir, setLocalizedDir] = useState<string | null>(null);
  const { progress, reset } = useTaskProgress();

  const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

  useEffect(() => {
    listVersions()
      .then((vs) => {
        setVersions(vs);
        if (vs.length) setVersion(vs[0]);
      })
      .catch((e) => addLog(`获取版本列表失败:${e}`));
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
    if (resultDir) await openPath(resultDir);
  };

  const localize = async () => {
    if (!resultDir) return;
    setBusy(true);
    setLocalizedDir(null);
    reset();
    try {
      addLog("开始联盟汉化 …");
      const out = await runLolLocalization(resultDir);
      addLog(`汉化完成:${out}`);
      setLocalizedDir(out);
    } catch (e) {
      addLog(`汉化失败:${e}`);
    } finally {
      setBusy(false);
    }
  };

  const openLocalized = async () => {
    if (localizedDir) await openPath(localizedDir);
  };

  const ratio = progress && progress.total > 0 ? progress.current / progress.total : 0;
  const indeterminate = !!progress && progress.total === 0 && !progress.done;
  const stageLabel =
    progress?.stage === "download" ? "下载中" : progress?.stage === "extract" ? "解压中" : "汉化中";

  return (
    <div className="flex flex-col h-screen bg-hex-bg text-hex-text overflow-hidden">
      <TitleBar />
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <header>
            <h1 className="text-2xl font-display font-bold text-hex-gold tracking-wide">
              英雄联盟素材获取工具
            </h1>
            <p className="mt-1 text-sm text-hex-text-muted">
              从 Riot Data Dragon 一键获取并解压官方素材数据包
            </p>
          </header>

          {/* 版本选择(M4 将增强为赛季↔版本联动) */}
          <section className="space-y-2">
            <label className="text-sm text-hex-gold-light">数据包版本</label>
            <select
              value={version}
              disabled={busy || versions.length === 0}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-hex-panel border border-hex-gold-dark/50 px-3 py-2 text-sm text-hex-text focus:border-hex-gold outline-none disabled:opacity-50"
            >
              {versions.length === 0 && <option>加载中…</option>}
              {versions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </section>

          {/* 保存目录 */}
          <section className="space-y-2">
            <label className="text-sm text-hex-gold-light">保存目录</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={destDir}
                placeholder="点击右侧按钮选择…"
                className="flex-1 bg-hex-panel border border-hex-gold-dark/50 px-3 py-2 text-sm text-hex-text-muted outline-none"
              />
              <button
                onClick={pickDir}
                disabled={busy}
                className="flex items-center gap-1 px-3 py-2 text-sm bg-hex-blue-dark/40 border border-hex-blue/40 text-hex-blue hover:bg-hex-blue-dark/70 transition-colors disabled:opacity-50"
              >
                <FolderOpen size={16} /> 选择
              </button>
            </div>
          </section>

          {/* 操作 */}
          <section className="flex gap-3">
            {!busy ? (
              <button
                onClick={start}
                className="flex items-center gap-2 px-5 py-2.5 bg-hex-gold-dark/60 border border-hex-gold text-hex-gold-light font-semibold hover:bg-hex-gold-dark transition-colors"
              >
                <Download size={18} /> 获取数据包
              </button>
            ) : (
              <button
                onClick={cancel}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-900/50 border border-red-500/60 text-red-200 font-semibold hover:bg-red-900/80 transition-colors"
              >
                <X size={18} /> 取消
              </button>
            )}
            {resultDir && !busy && (
              <button
                onClick={localize}
                className="flex items-center gap-2 px-5 py-2.5 bg-hex-blue-dark/50 border border-hex-blue text-hex-blue font-semibold hover:bg-hex-blue-dark transition-colors"
              >
                <Languages size={18} /> 开始汉化
              </button>
            )}
            {resultDir && !busy && (
              <button
                onClick={openResult}
                className="flex items-center gap-2 px-4 py-2.5 bg-hex-panel border border-hex-gold-dark/50 text-hex-gold hover:border-hex-gold transition-colors"
              >
                <FolderOpen size={16} /> 打开数据包
              </button>
            )}
            {localizedDir && !busy && (
              <button
                onClick={openLocalized}
                className="flex items-center gap-2 px-4 py-2.5 bg-hex-panel border border-hex-gold-dark/50 text-hex-gold hover:border-hex-gold transition-colors"
              >
                <FolderOpen size={16} /> 打开汉化结果
              </button>
            )}
          </section>

          {/* 进度 */}
          {busy && progress && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-hex-gold-light">
                <Loader2 size={16} className="animate-spin" />
                <span>{stageLabel}</span>
              </div>
              <HextechProgressBar ratio={ratio} indeterminate={indeterminate} />
              <div className="flex justify-between text-xs text-hex-text-muted">
                <span className="truncate pr-2">{progress.message}</span>
                <span className="shrink-0">
                  {progress.stage === "download" && progress.total > 0 && (
                    <>
                      {formatBytes(progress.current)} / {formatBytes(progress.total)}
                      {progress.speed ? ` · ${formatSpeed(progress.speed)}` : ""}
                      {progress.eta != null ? ` · 剩 ${formatEta(progress.eta)}` : ""}
                    </>
                  )}
                </span>
              </div>
            </section>
          )}

          {/* 日志 */}
          <section className="space-y-1">
            <label className="text-sm text-hex-gold-light">日志</label>
            <div className="h-40 overflow-auto bg-hex-bg-2 border border-hex-gold-dark/30 p-3 text-xs font-mono text-hex-text-muted space-y-0.5">
              {logs.length === 0 ? (
                <div className="opacity-50">暂无日志</div>
              ) : (
                logs.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
