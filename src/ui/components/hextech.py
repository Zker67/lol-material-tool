"""
Hextech Styled UI Components
"""
import flet as ft
from src.config.theme import H_BLUE_MED, H_GOLD, H_BLUE_DARK, H_CYAN, H_GOLD_LIGHT

class HextechButton(ft.Container):
    def __init__(self, text, icon, on_click, width=None):
        super().__init__()
        self.on_click_callback = on_click
        self.width = width
        self.border = ft.border.all(1, H_GOLD)
        self.border_radius = 2
        self.bgcolor = ft.Colors.with_opacity(0.8, H_BLUE_MED)
        self.padding = ft.padding.symmetric(horizontal=20, vertical=15)
        self.ink = True
        self.on_click = self.animate_click
        self.on_hover = self.animate_hover
        
        self.content = ft.Row(
            [
                ft.Icon(icon, color=H_GOLD, size=20),
                ft.Text(text, color=H_GOLD, size=16, font_family="Times New Roman", weight=ft.FontWeight.BOLD)
            ],
            alignment=ft.MainAxisAlignment.CENTER,
            spacing=10
        )

    def animate_hover(self, e):
        self.bgcolor = ft.Colors.with_opacity(0.3, H_GOLD) if e.data == "true" else ft.Colors.with_opacity(0.1, H_BLUE_MED)
        self.content.controls[0].color = H_BLUE_DARK if e.data == "true" else H_GOLD
        self.content.controls[1].color = H_BLUE_DARK if e.data == "true" else H_GOLD
        self.update()

    def animate_click(self, e):
        if self.on_click_callback:
            self.on_click_callback(e)

class HextechProgressBar(ft.Container):
    def __init__(self, width=400):
        super().__init__()
        self.bar = ft.Container(width=0, height=10, bgcolor=H_CYAN, shadow=ft.BoxShadow(spread_radius=1, blur_radius=10, color=H_CYAN))
        self.width = width
        self.height = 14
        self.bgcolor = "#000000"
        self.border = ft.border.all(1, H_GOLD)
        self.content = ft.Stack([self.bar], alignment=ft.Alignment(-1, 0))
        self._value = 0
    
    @property
    def value(self):
        return self._value
        
    @value.setter
    def value(self, val):
        self._value = val
        self.bar.width = self.width * val
        self.bar.update()

    def update(self):
        super().update()
        self.bar.width = self.width * self._value
        self.bar.update()
