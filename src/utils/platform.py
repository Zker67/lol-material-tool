"""
Platform specific utilities
"""
import sys
import re

def is_windows():
    return sys.platform == "win32"

def is_mac():
    return sys.platform == "darwin"

def sanitize_filename_for_rename(name: str | None) -> str:
    """
    Sanitize filename to remove illegal characters for both Windows and Unix-like systems.
    """
    if name is None: return "Unknown_Name"
    return re.sub(r'[\\/*?:"<>|]', '', name)
