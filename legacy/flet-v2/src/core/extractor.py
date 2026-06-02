"""
Extractor module for unpacking data packs
"""
import tarfile
import shutil
import os
import threading
from pathlib import Path
from typing import Callable, Optional

from src.config.constants import LEAGUE_DATA_SUBFOLDER_NAME

def extract_data_pack(
    tgz_file_path: Path,
    version_str: str,
    output_directory_root: Path,
    log_func: Callable[[str], None],
    progress_func: Callable[[float], None],
    status_func: Callable[[str], None],
    cancel_event: threading.Event
) -> Optional[Path]:
    """
    Extract the downloaded .tgz data pack.
    """
    folder_name = f"{LEAGUE_DATA_SUBFOLDER_NAME}-{version_str}"
    original_data_extraction_path = output_directory_root / folder_name

    try:
        if original_data_extraction_path.exists():
            log_func(f"ℹ️ 目标文件夹 「{folder_name}」 已存在，将清空并重新解压。")
            try:
                shutil.rmtree(original_data_extraction_path)
            except Exception as e_rm:
                log_func(f"❌ 清空旧的文件夹失败: {e_rm}。")
                return None
        
        original_data_extraction_path.mkdir(parents=True, exist_ok=True)
        log_func(f"📦 开始解压...")
        status_func("正在解压...")
        
        with tarfile.open(tgz_file_path, "r:gz") as tgz:
            members = tgz.getmembers()
            total_members = len(members)
            for i, member in enumerate(members):
                if cancel_event.is_set():
                    log_func("🛑 解压已取消。")
                    return None
                tgz.extract(member, path=original_data_extraction_path, filter='data')
                if i % 100 == 0:
                    progress = (i + 1) / total_members
                    progress_func(progress)
                    status_func(f"解压中: {progress:.1%}")
        
        log_func(f"✅ 解压完成: {original_data_extraction_path}")
        return original_data_extraction_path

    except Exception as e:
        log_func(f"\n❌ 解压时发生错误: {e}")
        return None
    finally:
        if tgz_file_path.exists():
            try:
                os.remove(tgz_file_path)
            except OSError:
                pass
