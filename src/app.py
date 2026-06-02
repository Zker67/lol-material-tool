"""
Main Application Entry Point
"""
import sys
import os
import ctypes
import flet as ft

from src.ui.views.home import init_home_view

def main():
    print("正在启动 Hextech GUI...")
    try:
        # Set AppUserModelID for Windows taskbar icon
        if sys.platform == "win32":
            myappid = 'bilibili.cangxiaojie.lolmaterialtool.2.0' # Updated ID for V2
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
            
        # Dynamic assets directory handling
        assets_dir = "assets"
        # Check if running as PyInstaller bundle
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            assets_dir = os.path.join(sys._MEIPASS, "assets")
        
        # Start Flet app
        ft.app(target=init_home_view, assets_dir=assets_dir)
        
    except Exception as e:
        print(f"启动失败: {e}")
        input("按回车键退出...")

if __name__ == "__main__":
    main()
