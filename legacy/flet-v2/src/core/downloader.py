"""
Downloader module for fetching data packs
"""
import requests
import time
from pathlib import Path
import threading
from typing import Callable, Optional

from src.config.constants import VERSIONS_API_URL, LEAGUE_DATA_SUBFOLDER_NAME
from src.utils.system import format_time

def get_all_versions(log_func: Callable[[str], None]) -> Optional[list[str]]:
    """
    Get all available versions from Riot API.
    """
    try:
        log_func(f"ℹ️ 正在从 API 获取所有可用版本: {VERSIONS_API_URL}")
        response = requests.get(VERSIONS_API_URL, timeout=15)
        response.raise_for_status()
        log_func("✅ 版本列表获取成功。")
        versions = response.json()
        if versions and isinstance(versions, list):
            return versions
        log_func("⚠️ API 返回的数据格式不正确或为空。")
        return None
    except Exception as e:
        log_func(f"❌ 访问或解析版本 API 时发生错误: {e}")
        return None

def download_data_pack(
    version_str: str,
    output_directory_root: Path,
    log_func: Callable[[str], None],
    progress_func: Callable[[float], None],
    status_func: Callable[[str], None],
    cancel_event: threading.Event
) -> Optional[Path]:
    """
    Download the data pack for the initialized version.
    Returns the path to the downloaded .tgz file, or None if failed/cancelled.
    """
    if not version_str:
        log_func("❌ 版本号无效。")
        return None

    url = f"https://ddragon.leagueoflegends.com/cdn/dragontail-{version_str}.tgz"
    base_downloads_path = output_directory_root
    tgz_file_path = base_downloads_path / Path(url).name

    try:
        log_func(f"🚀 开始下载联盟官方数据包 (版本: {version_str}): {url}")
        start_time = time.time()
        last_eta_update_time = 0
        eta_str = "--:--"
        
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            total_size = int(r.headers.get('content-length', 0))
            downloaded_size = 0
            
            with open(tgz_file_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if cancel_event.is_set():
                        log_func("🛑 下载已取消。")
                        return None
                        
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    
                    current_time = time.time()
                    if total_size > 0:
                        progress = downloaded_size / total_size
                        
                        # Update ETA every 5s
                        if current_time - last_eta_update_time >= 5:
                            elapsed = current_time - start_time
                            speed_bps = downloaded_size / elapsed if elapsed > 0 else 0
                            remaining = total_size - downloaded_size
                            eta = remaining / speed_bps if speed_bps > 0 else 0
                            eta_str = format_time(eta)
                            last_eta_update_time = current_time
                        
                        # Update Speed (Avg)
                        elapsed = current_time - start_time
                        speed_mbps = (downloaded_size / (1024*1024)) / elapsed if elapsed > 0 else 0
                        
                        if downloaded_size % (1024 * 64) == 0: # Throttle UI updates
                            progress_func(progress)
                            status_func(f"下载中: {progress:.1%} | 速度: {speed_mbps:.2f} MB/s | 预计剩余: {eta_str}")
        
        log_func(f"✅ .tgz 文件下载完成！总用时: {format_time(time.time() - start_time)}")
        return tgz_file_path

    except Exception as e:
        log_func(f"\n❌ 下载时发生错误: {e}")
        return None
