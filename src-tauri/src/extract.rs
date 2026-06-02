//! .tgz(gzip + tar)解压,推送进度;成功后删除压缩包(不变量 §7)。

use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use std::sync::atomic::Ordering;

use flate2::read::GzDecoder;
use tar::Archive;
use tauri::{AppHandle, Emitter, State};

use crate::{CancelFlag, ProgressEvent};

/// 解压 `.tgz` 到目标目录下的同名子目录;成功后删除 `.tgz`,返回解压根目录路径。
#[tauri::command]
pub async fn extract_pack(
    app: AppHandle,
    state: State<'_, CancelFlag>,
    tgz_path: String,
    dest_dir: String,
) -> Result<String, String> {
    state.0.store(false, Ordering::SeqCst);
    let cancel = state.0.clone();

    let tgz = PathBuf::from(&tgz_path);
    let stem = tgz
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "dragontail".into());
    let out_dir = PathBuf::from(&dest_dir).join(&stem);

    // 解压是 CPU/IO 密集的同步操作,放到阻塞线程池
    let app_cloned = app.clone();
    let out_dir_cloned = out_dir.clone();
    let tgz_for_read = tgz.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<u64, String> {
        // 不变量 §7:解压前清掉同名目录,保证幂等
        if out_dir_cloned.exists() {
            std::fs::remove_dir_all(&out_dir_cloned)
                .map_err(|e| format!("清理旧目录失败:{e}"))?;
        }
        std::fs::create_dir_all(&out_dir_cloned)
            .map_err(|e| format!("创建解压目录失败:{e}"))?;

        let file = File::open(&tgz_for_read).map_err(|e| format!("打开压缩包失败:{e}"))?;
        let gz = GzDecoder::new(BufReader::new(file));
        let mut archive = Archive::new(gz);

        let mut count: u64 = 0;
        for entry in archive.entries().map_err(|e| format!("读取压缩包失败:{e}"))? {
            if cancel.load(Ordering::SeqCst) {
                return Err("已取消".into());
            }
            let mut entry = entry.map_err(|e| format!("读取条目失败:{e}"))?;
            entry
                .unpack_in(&out_dir_cloned)
                .map_err(|e| format!("解压条目失败:{e}"))?;
            count += 1;

            if count % 50 == 0 {
                let _ = app_cloned.emit(
                    "task://progress",
                    ProgressEvent {
                        stage: "extract".into(),
                        current: count,
                        total: 0,
                        speed: None,
                        eta: None,
                        message: format!("正在解压…已处理 {count} 个文件"),
                        done: false,
                    },
                );
            }
        }

        Ok(count)
    })
    .await
    .map_err(|e| format!("解压任务异常:{e}"))?;

    let count = result?;

    // 不变量 §7:解压成功后删除 .tgz
    let _ = tokio::fs::remove_file(&tgz).await;

    let _ = app.emit(
        "task://progress",
        ProgressEvent {
            stage: "extract".into(),
            current: count,
            total: count,
            speed: None,
            eta: Some(0.0),
            message: format!("解压完成,共 {count} 个文件"),
            done: true,
        },
    );

    Ok(out_dir.to_string_lossy().into_owned())
}
