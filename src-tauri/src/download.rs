//! dragontail 全量包的流式下载,边下边写并推送进度。

use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::time::Instant;

use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, State};
use tokio::io::AsyncWriteExt;

use crate::ddragon::dragontail_url;
use crate::{CancelFlag, ProgressEvent};

/// 下载指定版本的 dragontail 全量包到目标目录,返回 `.tgz` 完整路径。
#[tauri::command]
pub async fn download_pack(
    app: AppHandle,
    state: State<'_, CancelFlag>,
    version: String,
    dest_dir: String,
) -> Result<String, String> {
    // 开始前清掉上一次的取消标志
    state.0.store(false, Ordering::SeqCst);
    let cancel = state.0.clone();

    let dest = PathBuf::from(&dest_dir);
    tokio::fs::create_dir_all(&dest)
        .await
        .map_err(|e| format!("创建目录失败:{e}"))?;

    let url = dragontail_url(&version);
    let file_name = format!("dragontail-{version}.tgz");
    let tgz_path = dest.join(&file_name);

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载请求失败:{e}"))?;
    if !resp.status().is_success() {
        return Err(format!("下载响应异常:HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);

    let mut file = tokio::fs::File::create(&tgz_path)
        .await
        .map_err(|e| format!("创建文件失败:{e}"))?;

    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();
    let start = Instant::now();
    let mut last_emit = Instant::now();

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            drop(file);
            let _ = tokio::fs::remove_file(&tgz_path).await;
            return Err("已取消".into());
        }
        let chunk = chunk.map_err(|e| format!("下载中断:{e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("写入失败:{e}"))?;
        downloaded += chunk.len() as u64;

        // 限频推送(约每 100ms),避免事件风暴
        if last_emit.elapsed().as_millis() >= 100 {
            emit_download(&app, &file_name, downloaded, total, start, false);
            last_emit = Instant::now();
        }
    }

    file.flush().await.map_err(|e| format!("刷新失败:{e}"))?;
    emit_download(&app, &file_name, downloaded, total.max(downloaded), start, true);

    Ok(tgz_path.to_string_lossy().into_owned())
}

/// 推送一帧下载进度。
fn emit_download(
    app: &AppHandle,
    file_name: &str,
    downloaded: u64,
    total: u64,
    start: Instant,
    done: bool,
) {
    let elapsed = start.elapsed().as_secs_f64();
    let speed = if elapsed > 0.0 {
        downloaded as f64 / elapsed
    } else {
        0.0
    };
    let eta = if !done && speed > 0.0 && total > 0 {
        Some(total.saturating_sub(downloaded) as f64 / speed)
    } else if done {
        Some(0.0)
    } else {
        None
    };
    let message = if done {
        format!("下载完成 {file_name}")
    } else {
        format!("正在下载 {file_name}")
    };
    let _ = app.emit(
        "task://progress",
        ProgressEvent {
            stage: "download".into(),
            current: downloaded,
            total,
            speed: if done { None } else { Some(speed) },
            eta,
            message,
            done,
        },
    );
}
