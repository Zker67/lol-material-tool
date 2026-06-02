"""
GUI Logger Component
"""
import threading
import flet as ft
from src.config.theme import H_GOLD_LIGHT, H_RED, H_CYAN, H_GOLD

class GuiLogger:
    def __init__(self):
        self.log_views = []
        self.lock = threading.Lock()

    def add_view(self, view: ft.ListView):
        self.log_views.append(view)

    def log(self, message: str):
        with self.lock:
            color = H_GOLD_LIGHT
            if "❌" in message: color = H_RED
            elif "✅" in message: color = H_CYAN
            elif "🚀" in message: color = H_GOLD
            
            for view in self.log_views:
                view.controls.append(ft.Text(message, size=12, font_family="Consolas", color=color))
                if len(view.controls) > 1000:
                    view.controls.pop(0)
                try:
                    view.update()
                except Exception:
                    # In case the page is already closed or network issue
                    pass

    def clear(self):
        with self.lock:
            for view in self.log_views:
                view.controls.clear()
                try:
                    view.update()
                except Exception:
                    pass
