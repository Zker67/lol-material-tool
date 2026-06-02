use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::State;

mod constants;
mod ddragon;
mod download;
mod extract;
mod localize;

/// 任务进度事件,通过 `task://progress` 推送到前端。
#[derive(Clone, serde::Serialize)]
pub struct ProgressEvent {
    /// 阶段:"download" | "extract" | "localize"
    pub stage: String,
    /// 当前进度(下载阶段为字节数,解压阶段为已处理条目数)
    pub current: u64,
    /// 总量(下载阶段为总字节;解压阶段总数未知时为 0)
    pub total: u64,
    /// 下载速度(字节/秒),仅下载阶段有意义
    pub speed: Option<f64>,
    /// 预计剩余秒数
    pub eta: Option<f64>,
    /// 人类可读的状态文本
    pub message: String,
    /// 该阶段是否已完成
    pub done: bool,
}

/// 全局取消标志,被各任务循环轮询。
#[derive(Default)]
pub struct CancelFlag(pub Arc<AtomicBool>);

/// 请求取消当前任务(置位标志,由进行中的下载/解压循环感知)。
#[tauri::command]
fn cancel_task(state: State<CancelFlag>) {
    state.0.store(true, Ordering::SeqCst);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(CancelFlag::default())
        .invoke_handler(tauri::generate_handler![
            ddragon::list_versions,
            download::download_pack,
            extract::extract_pack,
            localize::run_lol_localization,
            localize::run_tft_localization,
            cancel_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
