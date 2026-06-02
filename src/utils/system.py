"""
System level utilities
"""
import sys
import subprocess
from pathlib import Path

def open_folder_in_explorer(folder_path: Path):
    """
    Open the file explorer at the specified folder path.
    Supports Windows, macOS, and Linux.
    """
    if not folder_path.exists(): return
    try:
        if sys.platform == "win32":
            command = ['explorer', str(folder_path)]
        elif sys.platform == "darwin":
            command = ['open', str(folder_path)]
        else:
            command = ['xdg-open', str(folder_path)]
        subprocess.run(command)
    except Exception:
        pass

def format_time(seconds: float) -> str:
    """
    Format seconds into HH:MM:SS or MM:SS string.
    """
    if seconds < 0: return "--:--"
    if seconds >= 3600:
        return f"{int(seconds // 3600):02d}:{int((seconds % 3600) // 60):02d}:{int(seconds % 60):02d}"
    elif seconds >= 60:
        return f"{int(seconds // 60):02d}:{int(seconds % 60):02d}"
    else:
        return f"{int(seconds):02d}s"
