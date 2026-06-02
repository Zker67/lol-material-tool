"""
Home View Module
"""
import threading
import time
import flet as ft
from pathlib import Path

# Config
from src.config.theme import (
    H_BLUE_DARK, H_BLUE_MED, H_GOLD, H_GOLD_LIGHT, H_CYAN, H_RED
)
from src.config.constants import (
    LEAGUE_DATA_SUBFOLDER_NAME,
    LOL_ORGANIZED_CHAMPION_SUBFOLDER_NAME,
    LOL_BASE_CHAMPION_ICONS_FOLDER_NAME,
    LOL_CHAMPION_SKILLS_FOLDER_NAME,
    LOL_ORGANIZED_ITEM_SUBFOLDER_NAME,
    LOL_ORGANIZED_RUNE_SUBFOLDER_NAME,
    TFT_LOCALIZATION_CONFIG
)

# Components
from src.ui.components.hextech import HextechButton, HextechProgressBar
from src.ui.components.logger import GuiLogger

# Core Logic
from src.core.downloader import get_all_versions, download_data_pack
from src.core.extractor import extract_data_pack
from src.core.localizer import (
    get_local_data_version,
    lol_rename_and_organize_skin_subfolders,
    lol_rename_and_move_skin_images_task,
    lol_rename_base_champion_icons_task,
    lol_rename_and_organize_skill_icons,
    lol_rename_item_images_task,
    lol_rename_rune_images_task,
    process_tft_json_for_localization
)

# Utils
from src.utils.system import open_folder_in_explorer

def init_home_view(page: ft.Page):
    # Setup Page
    page.title = "英雄联盟素材包获取&整理工具 by Bilibili 仓小杰（该软件完全免费）"
    page.window.width = 1300
    page.window.height = 850
    page.bgcolor = ft.Colors.TRANSPARENT
    page.padding = 0
    page.window.frameless = True
    # page.window.bgcolor = ft.Colors.TRANSPARENT # Keep transparent for custom background
    page.window.bgcolor = H_BLUE_DARK # Fallback
    page.window.title_bar_hidden = True
    page.window.title_bar_buttons_hidden = True
    page.window.resizable = True
    
    # Check if we can set icon (platform dependent, handled in app.py generally but good to have fallback)
    # page.window_icon = ... 

    page.fonts = {
        "Beaufort": "https://github.com/KeepCode/League-of-Legends-Fonts/raw/master/BeaufortforLOL-Bold.ttf"
    }
    page.theme_mode = ft.ThemeMode.DARK
    page.theme = ft.Theme(
        font_family="Times New Roman",
        scrollbar_theme=ft.ScrollbarTheme(
            thumb_color={
                ft.ControlState.DEFAULT: H_GOLD,
                ft.ControlState.HOVERED: H_GOLD_LIGHT,
            },
            track_color=H_BLUE_MED,
            track_border_color=H_BLUE_DARK,
        )
    )

    logger = GuiLogger()
    
    download_log_list = ft.ListView(expand=True, auto_scroll=True, spacing=5)
    localization_log_list = ft.ListView(expand=True, auto_scroll=True, spacing=5)
    
    logger.add_view(download_log_list)
    logger.add_view(localization_log_list)

    # State
    download_progress = HextechProgressBar(width=500)
    status_text = ft.Text("等待操作...", color=H_CYAN, font_family="Consolas")
    
    cancel_download_event = threading.Event()
    
    def cancel_download(e):
        cancel_download_event.set()
        cancel_button.visible = False
        cancel_button.update()
        status_text.value = "正在取消..."
        status_text.update()

    cancel_button = HextechButton("取消", ft.Icons.CANCEL, cancel_download)
    cancel_button.visible = False

    original_data_path = Path.home() / "Downloads" / LEAGUE_DATA_SUBFOLDER_NAME
    
    def open_download_folder(e):
        open_folder_in_explorer(original_data_path)

    open_folder_button = HextechButton("打开文件夹", ft.Icons.FOLDER_OPEN, open_download_folder)
    open_folder_button.visible = False
    
    # Localization State
    lol_progress = HextechProgressBar(width=400)
    lol_status = ft.Text("等待执行...", color=H_CYAN, size=12, font_family="Consolas")
    lol_organized_path = None
    
    def open_lol_folder(e):
        if lol_organized_path: open_folder_in_explorer(lol_organized_path)
        
    lol_open_btn = HextechButton("打开文件夹", ft.Icons.FOLDER_OPEN, open_lol_folder)
    lol_open_btn.visible = False

    tft_progress = HextechProgressBar(width=400)
    tft_status = ft.Text("等待执行...", color=H_CYAN, size=12, font_family="Consolas")
    tft_organized_path = None
    
    def open_tft_folder(e):
        if tft_organized_path: open_folder_in_explorer(tft_organized_path)

    tft_open_btn = HextechButton("打开文件夹", ft.Icons.FOLDER_OPEN, open_tft_folder)
    tft_open_btn.visible = False
    
    # Directory Selection
    download_dir_text = ft.Text(str(Path.home() / "Downloads"), color=H_GOLD, size=14, font_family="Consolas")
    loc_target_dir_text = ft.Text(str(original_data_path), color=H_GOLD, size=14, font_family="Consolas")

    def on_download_dir_result(e: ft.FilePickerResultEvent):
        if e.path:
            download_dir_text.value = e.path
            download_dir_text.update()

    def on_loc_dir_result(e: ft.FilePickerResultEvent):
        if e.path:
            nonlocal original_data_path
            original_data_path = Path(e.path)
            loc_target_dir_text.value = str(original_data_path)
            loc_target_dir_text.update()
            
    download_dir_picker = ft.FilePicker()
    download_dir_picker.on_result = on_download_dir_result
    loc_target_dir_picker = ft.FilePicker()
    loc_target_dir_picker.on_result = on_loc_dir_result
    page.overlay.extend([download_dir_picker, loc_target_dir_picker])

    # Logic Wrappers
    all_versions_cache = []

    def log_wrapper(msg):
        logger.log(msg)

    def progress_wrapper_download(val):
        download_progress.value = val
        download_progress.update()

    def status_wrapper_download(msg):
        status_text.value = msg
        status_text.update()

    def filter_versions_by_major(major_ver):
        if not major_ver: return
        filtered = [v for v in all_versions_cache if v.startswith(major_ver + ".")]
        version_dropdown.options = [ft.dropdown.Option(v) for v in filtered]
        if filtered:
            version_dropdown.value = filtered[0]
        else:
            version_dropdown.value = None
        version_dropdown.update()

    def on_major_version_change(e):
        filter_versions_by_major(major_version_dropdown.value)

    def check_versions(e):
        nonlocal all_versions_cache
        logger.log("正在初始化版本检查协议...")
        versions = get_all_versions(log_wrapper)
        if versions:
            all_versions_cache = versions
            # Extract major versions
            major_versions = sorted(list(set([v.split('.')[0] for v in versions])), key=lambda x: int(x) if x.isdigit() else 0, reverse=True)
            
            major_version_dropdown.options = [ft.dropdown.Option(v) for v in major_versions]
            if major_versions:
                major_version_dropdown.value = major_versions[0]
                filter_versions_by_major(major_versions[0])
            
            major_version_dropdown.update()
            logger.log(f"✅ 连接建立成功。最新版本: {versions[0]}")
        else:
            logger.log("❌ 连接失败。")

    def start_download(e):
        v = version_dropdown.value
        if not v:
            logger.log("❌ 错误: 未选择版本。")
            return
        
        logger.log(f"🚀 启动下载序列: {v}...")
        target_dir = Path(download_dir_text.value)
        
        cancel_download_event.clear()
        cancel_button.visible = True
        cancel_button.update()
        
        def task():
            # Step 1: Download
            tgz_path = download_data_pack(
                v, 
                target_dir, 
                log_wrapper, 
                progress_wrapper_download, 
                status_wrapper_download, 
                cancel_download_event
            )
            
            if tgz_path:
                # Step 2: Extract
                extracted_path = extract_data_pack(
                    tgz_path,
                    v,
                    target_dir,
                    log_wrapper,
                    progress_wrapper_download,
                    status_wrapper_download,
                    cancel_download_event
                )

                if extracted_path:
                    nonlocal original_data_path
                    original_data_path = extracted_path
                    loc_target_dir_text.value = str(original_data_path)
                    loc_target_dir_text.update()
                    logger.log(f"✅ 数据源已更新为: {original_data_path}")
                    status_text.value = "下载&解压已完成。可进入「汉化」窗口进行文件翻译整理。"
                    status_text.update()
                    open_folder_button.visible = True
                    open_folder_button.update()
            
            if cancel_download_event.is_set():
                time.sleep(1)
                status_text.value = "等待操作..."
                status_text.update()
                download_progress.value = 0
                download_progress.update()
            
            cancel_button.visible = False
            cancel_button.update()
            page.update()
        
        threading.Thread(target=task, daemon=True).start()

    def run_lol_localization(e):
        v = get_local_data_version(original_data_path)
        if not v:
            logger.log(f"❌ 错误: 未在 {original_data_path} 找到本地数据")
            return
        
        logger.log(f"🚀 启动联盟汉化协议 (版本: {v})")
        target_root = original_data_path.parent
        nonlocal lol_organized_path
        lol_organized_path = target_root / f"联盟数据汉化整理-{v}"
        lol_organized_path.mkdir(parents=True, exist_ok=True)
        
        lol_progress.value = 0
        lol_status.value = "正在初始化..."
        lol_open_btn.visible = False
        lol_open_btn.update()
        lol_progress.update()
        lol_status.update()
        
        def task():
            import shutil
            import json
            
            organized_champion_path = lol_organized_path / LOL_ORGANIZED_CHAMPION_SUBFOLDER_NAME
            if organized_champion_path.exists(): shutil.rmtree(organized_champion_path)
            organized_champion_path.mkdir(exist_ok=True)
            
            # 1. Image Copy
            src_img_champ_path = original_data_path / v / "img" / "champion"
            if not src_img_champ_path.is_dir():
                 # Fallback check
                 src_img_champ_path = original_data_path / "img" / "champion"
            
            from src.config.constants import IMAGE_SUBFOLDER_MAPPING
            if src_img_champ_path.is_dir():
                for eng_folder in IMAGE_SUBFOLDER_MAPPING.keys():
                    src_dir = src_img_champ_path / eng_folder; dest_dir = organized_champion_path / eng_folder
                    if src_dir.is_dir():
                        if dest_dir.exists(): shutil.rmtree(dest_dir)
                        shutil.copytree(src_dir, dest_dir)
            
            lol_progress.value = 0.1
            lol_status.value = "正在整理皮肤文件夹..."
            lol_progress.update(); lol_status.update()
            
            lol_rename_and_organize_skin_subfolders(organized_champion_path, log_wrapper)
            
            lol_progress.value = 0.2
            lol_status.value = "正在处理皮肤图像 (耗时较长)..."
            lol_progress.update(); lol_status.update()
            
            json_path = original_data_path / v / "data" / "zh_CN" / "championFull.json"
            champion_data = {}
            if json_path.is_file():
                with open(json_path, 'r', encoding='utf-8') as f: champion_data = json.load(f).get("data", {})
            
            logger.log("正在处理皮肤资源...")
            lol_rename_and_move_skin_images_task(original_data_path, organized_champion_path, v, log_wrapper, champion_data)
            
            lol_progress.value = 0.6
            lol_status.value = "正在处理头像资源..."
            lol_progress.update(); lol_status.update()
            
            logger.log("正在处理头像资源...")
            src_base_icons = original_data_path / v / "img" / "champion"
            dest_base_icons = organized_champion_path / LOL_BASE_CHAMPION_ICONS_FOLDER_NAME
            lol_rename_base_champion_icons_task(src_base_icons, dest_base_icons, champion_data, log_wrapper)
            
            lol_progress.value = 0.7
            lol_status.value = "正在处理技能资源..."
            lol_progress.update(); lol_status.update()
            
            logger.log("正在处理技能资源...")
            skills_dest_path = organized_champion_path / LOL_CHAMPION_SKILLS_FOLDER_NAME
            lol_rename_and_organize_skill_icons(original_data_path, skills_dest_path, v, champion_data, log_wrapper)
            
            lol_progress.value = 0.8
            lol_status.value = "正在处理装备资源..."
            lol_progress.update(); lol_status.update()
            
            logger.log("正在处理装备资源...")
            organized_item_path = lol_organized_path / LOL_ORGANIZED_ITEM_SUBFOLDER_NAME
            lol_rename_item_images_task(original_data_path, organized_item_path, v, log_wrapper)
            
            lol_progress.value = 0.9
            lol_status.value = "正在处理符文资源..."
            lol_progress.update(); lol_status.update()
            
            logger.log("正在处理符文资源...")
            organized_rune_path = lol_organized_path / LOL_ORGANIZED_RUNE_SUBFOLDER_NAME
            lol_rename_rune_images_task(original_data_path, organized_rune_path, v, log_wrapper)
            
            lol_progress.value = 1.0
            lol_status.value = "联盟汉化完成"
            lol_open_btn.visible = True
            lol_progress.update(); lol_status.update(); lol_open_btn.update()
            
            logger.log("✅ 联盟汉化完成。")
            
        threading.Thread(target=task, daemon=True).start()

    def run_tft_localization(e):
        v = get_local_data_version(original_data_path)
        if not v:
            logger.log(f"❌ 错误: 未找到本地数据。")
            return
            
        logger.log(f"🚀 启动云顶汉化协议 (版本: {v})")
        target_root = original_data_path.parent
        nonlocal tft_organized_path
        tft_organized_path = target_root / f"云顶数据汉化整理-{v}"
        tft_organized_path.mkdir(parents=True, exist_ok=True)
        
        tft_progress.value = 0
        tft_status.value = "正在初始化..."
        tft_open_btn.visible = False
        tft_open_btn.update(); tft_progress.update(); tft_status.update()
        
        def task():
            total = len(TFT_LOCALIZATION_CONFIG)
            for i, config in enumerate(TFT_LOCALIZATION_CONFIG):
                logger.log(f"正在处理: {config['comment']}...")
                tft_status.value = f"正在处理: {config['comment']}..."
                tft_status.update()
                
                process_tft_json_for_localization(config, original_data_path, tft_organized_path, v, log_wrapper)
                
                tft_progress.value = (i + 1) / total
                tft_progress.update()
                
            tft_status.value = "云顶汉化完成"
            tft_open_btn.visible = True
            tft_status.update(); tft_open_btn.update()
            
            logger.log("✅ 云顶汉化完成。")
            
        threading.Thread(target=task, daemon=True).start()

    # UI Components
    major_version_dropdown = ft.Dropdown(
        width=100,
        text_style=ft.TextStyle(color=H_GOLD),
        border_color=H_GOLD,
        bgcolor=H_BLUE_MED,
    )
    major_version_dropdown.on_change = on_major_version_change

    version_dropdown = ft.Dropdown(
        width=200, 
        text_style=ft.TextStyle(color=H_GOLD),
        border_color=H_GOLD,
        bgcolor=H_BLUE_MED,
    )
    
    # Layout Construction
    def create_section_header(text):
        return ft.Container(
            content=ft.Text(text, size=24, color=H_GOLD, font_family="Times New Roman", weight=ft.FontWeight.BOLD),
            border=ft.border.only(bottom=ft.border.BorderSide(2, H_GOLD)),
            padding=ft.padding.only(bottom=10),
            margin=ft.margin.only(bottom=20)
        )

    download_panel = ft.Container(
        content=ft.Row([
            ft.Container(
                content=ft.Column([
                    create_section_header("素材获取"),
                    ft.Row([
                        ft.Text("赛季:", color=H_GOLD, size=16, font_family="Times New Roman"),
                        major_version_dropdown, 
                        ft.Text("版本号:", color=H_GOLD, size=16, font_family="Times New Roman"),
                        version_dropdown, 
                        HextechButton("刷新版本列表", ft.Icons.REFRESH, check_versions)
                    ], spacing=15, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(height=30),
                    ft.Container(height=20),
                    ft.Text("目标目录:", size=12, color=ft.Colors.with_opacity(0.5, H_GOLD_LIGHT)),
                    ft.Row([
                        ft.Icon(ft.Icons.FOLDER_OPEN, color=H_GOLD, size=16),
                        download_dir_text,
                        ft.IconButton(ft.Icons.EDIT, icon_color=H_CYAN, on_click=lambda _: download_dir_picker.get_directory_path(), tooltip="更改目录")
                    ], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(height=20),
                    HextechButton("开始下载并解压", ft.Icons.DOWNLOAD, start_download, width=300),
                    ft.Container(height=30),
                    ft.Text("状态监控", color=H_GOLD, size=14),
                    status_text,
                    ft.Row([download_progress, cancel_button, open_folder_button], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(height=30),
                    ft.Text("相关链接:", color=H_GOLD, size=14, weight=ft.FontWeight.BOLD),
                    ft.Text(
                        spans=[
                            ft.TextSpan("素材包来源", style=ft.TextStyle(color=H_CYAN, decoration=ft.TextDecoration.UNDERLINE), on_click=lambda e: page.launch_url("https://developer.riotgames.com/docs/lol#data-dragon")),
                            ft.TextSpan(" | ", style=ft.TextStyle(color=H_GOLD_LIGHT)),
                            ft.TextSpan("国服更新公告", style=ft.TextStyle(color=H_CYAN, decoration=ft.TextDecoration.UNDERLINE), on_click=lambda e: page.launch_url("https://lol.qq.com/gicp/news/423/2/1334/1.html")),
                        ]
                    )
                ]),
                expand=3,
                padding=20
            ),
            ft.Container(width=1, bgcolor=H_GOLD),
            ft.Container(
                content=ft.Column([
                    ft.Text("实时日志", color=H_GOLD, size=16, weight=ft.FontWeight.BOLD),
                    ft.Container(
                        content=download_log_list,
                        bgcolor=ft.Colors.with_opacity(0.3, "#000000"),
                        border=ft.border.all(1, H_BLUE_MED),
                        border_radius=5,
                        padding=10,
                        expand=True
                    )
                ]),
                expand=2,
                padding=20
            )
        ]),
        bgcolor=ft.Colors.with_opacity(0.9, "#010A13"),
        border=ft.border.all(1, H_GOLD),
        border_radius=10,
        shadow=ft.BoxShadow(spread_radius=1, blur_radius=15, color=ft.Colors.with_opacity(0.5, H_BLUE_DARK)),
        expand=True
    )

    localization_panel = ft.Container(
        content=ft.Row([
            ft.Container(
                content=ft.Column([
                    create_section_header("汉化整理"),
                    ft.Text("请确保已下载数据包后再继续。", color=H_GOLD_LIGHT),
                    ft.Container(height=20),
                    ft.Text("汉化数据源:", size=12, color=ft.Colors.with_opacity(0.5, H_GOLD_LIGHT)),
                    ft.Row([
                        ft.Icon(ft.Icons.FOLDER_SPECIAL, color=H_GOLD, size=16),
                        loc_target_dir_text,
                        ft.IconButton(ft.Icons.EDIT, icon_color=H_CYAN, on_click=lambda _: loc_target_dir_picker.get_directory_path(), tooltip="更改目录")
                    ], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(height=30),
                    ft.Container(height=10),
                    
                    # League Localization Section
                    ft.Row([
                        HextechButton("执行联盟汉化", ft.Icons.TRANSLATE, run_lol_localization, width=200),
                        lol_status
                    ], vertical_alignment=ft.CrossAxisAlignment.CENTER, spacing=15),
                    ft.Container(height=5),
                    ft.Row([lol_progress, lol_open_btn], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    
                    ft.Divider(color=ft.Colors.with_opacity(0.3, H_GOLD), height=30),
                    
                    # TFT Localization Section
                    ft.Row([
                        HextechButton("执行云顶汉化", ft.Icons.GAMEPAD, run_tft_localization, width=200),
                        tft_status
                    ], vertical_alignment=ft.CrossAxisAlignment.CENTER, spacing=15),
                    ft.Container(height=5),
                    ft.Row([tft_progress, tft_open_btn], spacing=10, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                ]),
                expand=3,
                padding=20
            ),
            ft.Container(width=1, bgcolor=H_GOLD),
            ft.Container(
                content=ft.Column([
                    ft.Text("实时日志", color=H_GOLD, size=16, weight=ft.FontWeight.BOLD),
                    ft.Container(
                        content=localization_log_list,
                        bgcolor=ft.Colors.with_opacity(0.3, "#000000"),
                        border=ft.border.all(1, H_BLUE_MED),
                        border_radius=5,
                        padding=10,
                        expand=True
                    )
                ]),
                expand=2,
                padding=20
            )
        ]),
        bgcolor=ft.Colors.with_opacity(0.9, "#010A13"),
        border=ft.border.all(1, H_GOLD),
        border_radius=10,
        shadow=ft.BoxShadow(spread_radius=1, blur_radius=15, color=ft.Colors.with_opacity(0.5, H_BLUE_DARK)),
        expand=True
    )

    # Navigation Panel
    def create_nav_link(text, url, tooltip=None):
        return ft.TextSpan(
            text, 
            style=ft.TextStyle(color=H_CYAN, decoration=ft.TextDecoration.UNDERLINE), 
            on_click=lambda e: page.launch_url(url),
        )

    def create_nav_section(title, content_list):
        return ft.Container(
            content=ft.Column([
                ft.Text(title, color=H_GOLD, size=18, weight=ft.FontWeight.BOLD, font_family="Times New Roman"),
                ft.Container(height=5),
                ft.Column(content_list, spacing=5)
            ]),
            bgcolor=ft.Colors.with_opacity(0.1, H_BLUE_MED),
            border=ft.border.all(1, ft.Colors.with_opacity(0.3, H_GOLD)),
            border_radius=10,
            padding=15,
            margin=ft.margin.only(bottom=15)
        )

    def create_icon_source_row(source_name, items):
        spans = [ft.TextSpan(f"{source_name}: ", style=ft.TextStyle(color=H_GOLD_LIGHT, weight=ft.FontWeight.BOLD))]
        for i, item in enumerate(items):
            spans.append(create_nav_link(item['name'], item['url']))
            if i < len(items) - 1:
                spans.append(ft.TextSpan(" | ", style=ft.TextStyle(color=H_GOLD_LIGHT)))
        return ft.Text(spans=spans, size=13)

    nav_col1 = ft.Column([
        ft.Container(
            content=ft.Column([
                ft.Row([
                    ft.Icon(ft.Icons.AUTO_AWESOME, color=H_GOLD, size=24),
                    ft.Text("我制作的导航工具", color=H_GOLD, size=20, weight=ft.FontWeight.BOLD, font_family="Times New Roman"),
                ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
                ft.Container(height=15),
                ft.Container(
                    content=ft.Column([
                        ft.Row([ft.Text("🎬", size=16), ft.Text(spans=[create_nav_link("英雄联盟剪辑教程文档", "https://zker.craft.me/lol-edit")])], spacing=10),
                        ft.Row([ft.Text("📚", size=16), ft.Text(spans=[create_nav_link("全英雄索引素材库", "https://lol-hero.notion.site/")])], spacing=10),
                        ft.Row([ft.Text("🔖", size=16), ft.Text(spans=[create_nav_link("导航书签页", "https://arc.net/space/3D4FB193-8841-4AED-B774-940D13E587E3")])], spacing=10),
                    ], spacing=10)
                )
            ]),
            gradient=ft.LinearGradient(
                begin=ft.Alignment(-1, -1),
                end=ft.Alignment(1, 1),
                colors=[
                    ft.Colors.with_opacity(0.9, H_BLUE_DARK),
                    ft.Colors.with_opacity(0.3, H_GOLD),
                ],
            ),
            border=ft.border.all(1, H_GOLD),
            border_radius=15,
            padding=25,
            shadow=ft.BoxShadow(
                spread_radius=0,
                blur_radius=20,
                color=ft.Colors.with_opacity(0.2, H_CYAN),
                offset=ft.Offset(0, 0),

            ),
            margin=ft.margin.only(bottom=20)
        ),
        create_nav_section("🌐 综合网站", [
            ft.Column([ft.Text(spans=[create_nav_link("LoL DB", "https://lol-db.com/")]), ft.Text("联盟数据库 (中英对照)", color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12)], spacing=2),
            ft.Column([ft.Text(spans=[create_nav_link("LoL Wiki", "https://wiki.leagueoflegends.com/en-us/")]), ft.Text("官方维基 (纯英文)", color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12)], spacing=2),
            ft.Column([ft.Text(spans=[create_nav_link("Ghostoact (幽灵疾步)", "https://www.ghostoact.com/")]), ft.Text("资讯/资源/日历/插画", color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12)], spacing=2),
            ft.Column([ft.Text(spans=[create_nav_link("布锅锅联盟宇宙", "https://buguoguo.cn/")]), ft.Text("原画/语音/模型整合", color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12)], spacing=2),
        ]),
    ], expand=True, scroll=ft.ScrollMode.HIDDEN)

    nav_col2 = ft.Column([
        create_nav_section("🏞️ 英雄联盟图标", [
            create_icon_source_row("LoL DB", [
                {"name": "装备", "url": "https://lol-db.com/lol-items/?v=latest"},
                {"name": "符文", "url": "https://lol-db.com/lol-runes/?v=latest"},
                {"name": "表情", "url": "https://lol-db.com/lol-emotes/?v=latest"},
                {"name": "成就", "url": "https://lol-db.com/lol-challenges/"},
                {"name": "英雄技能", "url": "https://lol-db.com/lol-champions/?v=latest"},
                {"name": "头像", "url": "https://lol-db.com/lol-icons/?v=latest"},
                {"name": "斗魂强化", "url": "https://lol-db.com/lol-augments/?v=latest#arena"},
            ]),
            create_icon_source_row("Wiki", [
                {"name": "装备", "url": "https://wiki.leagueoflegends.com/en-us/Item#List_of_Items"},
                {"name": "符文", "url": "https://wiki.leagueoflegends.com/en-us/Rune#Trees"},
                {"name": "召唤师技能", "url": "https://wiki.leagueoflegends.com/en-us/Summoner_spell#Available_summoner_spells"},
                {"name": "英雄技能", "url": "https://wiki.leagueoflegends.com/en-us/"},
            ]),
            create_icon_source_row("Ghostoact", [
                {"name": "表情", "url": "https://www.ghostoact.com/act/tools/emotes"},
                {"name": "头像", "url": "https://www.ghostoact.com/act/tools/summonerIcon"},
                {"name": "段位", "url": "https://www.ghostoact.com/act/tools/rankTiers"},
            ]),
        ]),
        create_nav_section("☁️ 云顶之弈图标", [
            create_icon_source_row("LoL DB", [
                {"name": "装备", "url": "https://lol-db.com/tft-items/"},
                {"name": "羁绊", "url": "https://lol-db.com/tft-traits/"},
                {"name": "弈子", "url": "https://lol-db.com/tft-units/"},
                {"name": "海克斯", "url": "https://lol-db.com/tft-augments/"},
                {"name": "奇遇", "url": "https://lol-db.com/tft-anomaly/"},
                {"name": "棋盘", "url": "https://lol-db.com/tft-arenas/"},
                {"name": "攻击特效", "url": "https://lol-db.com/tft-booms/"},
                {"name": "小小英雄", "url": "https://lol-db.com/tft-companions/"},
            ]),
            create_icon_source_row("Wiki", [
                {"name": "装备", "url": "https://wiki.leagueoflegends.com/en-us/TFT:Item#Completed_items"},
                {"name": "弈子", "url": "https://wiki.leagueoflegends.com/en-us/TFT:Teamfight_Tactics"},
            ]),
        ]),
        create_nav_section("🖼️ 插画资源", [
            ft.Text("官方原画:", color=H_GOLD_LIGHT, weight=ft.FontWeight.BOLD),
            ft.Text(spans=[create_nav_link("布锅锅原画库", "https://splash.buguoguo.cn/"), ft.TextSpan(" | "), create_nav_link("LoL Skins", "https://lol-db.com/lol-skins/")]),
            ft.Text(spans=[create_nav_link("Ghostoact 资源库", "https://www.ghostoact.com/arts"), ft.TextSpan(" (皮肤狗牌/国服炫彩/手游插画)", style=ft.TextStyle(color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12))]),
            ft.Container(height=5),
            ft.Text("高清/壁纸:", color=H_GOLD_LIGHT, weight=ft.FontWeight.BOLD),
            ft.Text(spans=[create_nav_link("UHD Paper (4K)", "https://www.uhdpaper.com/search?q=league+of+legends&by-date=true&i=0"), ft.TextSpan(" | "), create_nav_link("Wallhaven", "https://wallhaven.cc/search?q=id%3A537&categories=110&purity=110&sorting=date_added&order=desc&ai_art_filter=1")]),
            ft.Text(spans=[create_nav_link("ArtStation", "https://www.artstation.com/search?sort_by=relevance&query=league%20of%20legends"), ft.TextSpan(" (艺术家原稿)", style=ft.TextStyle(color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT), size=12))]),
        ]),
    ], expand=True, scroll=ft.ScrollMode.HIDDEN)

    nav_col3 = ft.Column([
        create_nav_section("🔊 音效资源", [
            ft.Text(spans=[ft.TextSpan("游戏音效: ", style=ft.TextStyle(color=H_GOLD_LIGHT)), create_nav_link("大寒无雪 (击杀/技能/标记)", "https://voice.twitp.com/hero-detail-0.html")]),
            ft.Text(spans=[ft.TextSpan("台词语音: ", style=ft.TextStyle(color=H_GOLD_LIGHT)), create_nav_link("大寒无雪 (部分)", "https://voice.twitp.com/"), ft.TextSpan(" | "), create_nav_link("布锅锅语音 (全)", "https://voice.buguoguo.cn/#/voice")]),
            ft.Text(spans=[ft.TextSpan("技能音效: ", style=ft.TextStyle(color=H_GOLD_LIGHT)), ft.TextSpan("推荐使用 "), create_nav_link("全英雄数据库", "https://lol-hero.notion.site/?v=218c1631b0a880d399c3000cc98e8bac"), ft.TextSpan(" 查阅 Wiki 下载")]),
        ]),
        create_nav_section("📦 3D 模型", [
            ft.Text(spans=[create_nav_link("卡达 - 英雄联盟3D模型站", "https://3d.buguoguo.cn/")]),
            ft.Text("支持：联盟英雄 / 小小英雄 / 小兵野怪", size=12, color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT)),
            ft.Text("功能：查看动画 / 导出透明图 / 导出GLB模型", size=12, color=ft.Colors.with_opacity(0.7, H_GOLD_LIGHT)),
        ]),
    ], expand=True, scroll=ft.ScrollMode.HIDDEN)

    navigation_panel = ft.Container(
        content=ft.Row([
            ft.Container(nav_col1, expand=24), 
            ft.VerticalDivider(color=H_GOLD, width=1), 
            ft.Container(nav_col2, expand=36), 
            ft.VerticalDivider(color=H_GOLD, width=1), 
            ft.Container(nav_col3, expand=30)
        ], spacing=20, vertical_alignment=ft.CrossAxisAlignment.START),
        bgcolor=ft.Colors.with_opacity(0.9, "#010A13"),
        border=ft.border.all(1, H_GOLD),
        border_radius=10,
        shadow=ft.BoxShadow(spread_radius=1, blur_radius=15, color=ft.Colors.with_opacity(0.5, H_BLUE_DARK)),
        padding=30,
        expand=True
    )

    # Help Panel
    help_panel = ft.Container(
        content=ft.Column([
            create_section_header("📧 联系作者 & 反馈"),
            ft.Container(
                content=ft.Column([
                    ft.Text("后续更新、功能建议或Bug反馈，欢迎通过以下方式联系：", color=H_GOLD_LIGHT, size=13),
                    ft.Container(height=10),
                    ft.Row([
                        ft.Icon(ft.Icons.VIDEO_LIBRARY, color=H_CYAN, size=20),
                        ft.Text("Bilibili: ", color=H_GOLD_LIGHT),
                        ft.Text(spans=[ft.TextSpan("仓小杰", style=ft.TextStyle(color=H_CYAN, decoration=ft.TextDecoration.UNDERLINE, weight=ft.FontWeight.BOLD), on_click=lambda e: page.launch_url("https://space.bilibili.com/13540581"))]),
                    ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Row([
                        ft.Icon(ft.Icons.CHAT, color=H_CYAN, size=20),
                        ft.Text("微信: ", color=H_GOLD_LIGHT),
                        ft.Text("zker67", color=H_CYAN, weight=ft.FontWeight.BOLD, selectable=True),
                        ft.Text("(添加请注明来意)", color=ft.Colors.with_opacity(0.5, H_GOLD_LIGHT), size=12),
                    ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
                ], spacing=5),
                bgcolor=ft.Colors.with_opacity(0.1, H_BLUE_MED),
                border=ft.border.all(1, ft.Colors.with_opacity(0.3, H_GOLD)),
                border_radius=10,
                padding=20,
            ),
            ft.Container(height=10),
            create_section_header("📖 软件介绍 & 工作原理"),
            ft.Container(
                content=ft.Column([
                    ft.Text("本工具专为英雄联盟与云顶之弈创作者设计，旨在解决中文素材获取和查找困难的问题。", color=H_GOLD_LIGHT),
                    ft.Text("核心逻辑：", color=H_CYAN, weight=ft.FontWeight.BOLD),
                    ft.Text("1. 自动获取 Riot Games 官方 Data Dragon 接口的最新版本列表。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("2. 下载指定版本的 dragontail 压缩包（包含游戏全量静态资源）。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("3. 解析 data/zh_CN/ 目录下的官方中文 JSON 数据文件。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("4. 根据 JSON 中的映射关系，将图片从 ID 批量重命名为中文名称（如 '1.png' -> '安妮.png'）。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("5. 按照英雄、装备、符文、云顶羁绊等分类自动归档整理。", color=H_GOLD_LIGHT, size=12),
                    ft.Container(height=10),
                    ft.Text("💾 数据来源：", color=H_CYAN, weight=ft.FontWeight.BOLD),
                    ft.Text("所有资源均直接拉取自 Riot Games 官方服务器 (ddragon.leagueoflegends.com)，保证素材的原生性与安全性。", color=H_GOLD_LIGHT, size=12),
                ], spacing=5),
                bgcolor=ft.Colors.with_opacity(0.1, H_BLUE_MED),
                border=ft.border.all(1, ft.Colors.with_opacity(0.3, H_GOLD)),
                border_radius=10,
                padding=20,
            ),
            ft.Container(height=10),
            create_section_header("🛠️ 详细使用指南"),
            ft.Container(
                content=ft.Column([
                    ft.Text("第一步：获取素材", color=H_GOLD, weight=ft.FontWeight.BOLD),
                    ft.Text("• 在「素材获取」页面选择赛季和具体版本号（通常选择最新版）。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("• 点击“开始下载并解压”，等待进度条完成。文件较大，请耐心等待。", color=H_GOLD_LIGHT, size=12),
                    ft.Container(height=5),
                    ft.Text("第二步：汉化整理", color=H_GOLD, weight=ft.FontWeight.BOLD),
                    ft.Text("• 切换到「汉化整理」页面。若刚完成下载，源路径会自动填充。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("• 点击“执行联盟汉化”或“执行云顶汉化”。", color=H_GOLD_LIGHT, size=12),
                    ft.Text("• 程序将自动读取数据并生成中文命名的文件夹。", color=H_GOLD_LIGHT, size=12),
                    ft.Container(height=5),
                    ft.Text("第三步：使用素材", color=H_GOLD, weight=ft.FontWeight.BOLD),
                    ft.Text("• 点击完成后的“打开文件夹”按钮，即可直接使用整理好的中文素材。", color=H_GOLD_LIGHT, size=12),
                ], spacing=5),
                bgcolor=ft.Colors.with_opacity(0.1, H_BLUE_MED),
                border=ft.border.all(1, ft.Colors.with_opacity(0.3, H_GOLD)),
                border_radius=10,
                padding=20,
            ),
        ], scroll=ft.ScrollMode.ALWAYS),
        bgcolor=ft.Colors.with_opacity(0.9, "#010A13"),
        border=ft.border.all(1, H_GOLD),
        border_radius=10,
        shadow=ft.BoxShadow(spread_radius=1, blur_radius=15, color=ft.Colors.with_opacity(0.5, H_BLUE_DARK)),
        padding=30,
        expand=True
    )

    # Tabs with Custom Style
    tab_contents = [
        ft.Container(download_panel, padding=10),
        ft.Container(localization_panel, padding=10),
        ft.Container(navigation_panel, padding=10),
        ft.Container(help_panel, padding=10)
    ]
    
    main_content_area = ft.Container(content=tab_contents[0], expand=True)

    def on_tab_change(e):
        main_content_area.content = tab_contents[e.control.selected_index]
        main_content_area.update()

    tabs = ft.Tabs(
        selected_index=0,
        animation_duration=300,
        # indicator_color=H_CYAN,
        # label_color=H_GOLD,
        # unselected_label_color=ft.Colors.with_opacity(0.5, H_GOLD_LIGHT),
        # divider_color=H_GOLD,
        tabs=[
            ft.Tab(label="下载", icon=ft.Icons.CLOUD_DOWNLOAD),
            ft.Tab(label="汉化", icon=ft.Icons.FOLDER_SPECIAL),
            ft.Tab(label="导航", icon=ft.Icons.MAP),
            ft.Tab(label="说明", icon=ft.Icons.HELP_OUTLINE),
        ],
        on_change=on_tab_change,
        expand=False
    )
    
    # Layout Adjustment for manual tabs
    # We need to put tabs and content in a column


    # Custom Title Bar
    def minimize_app(e):
        page.window.minimized = True
        page.update()

    def toggle_maximize(e):
        page.window.maximized = not page.window.maximized
        page.update()

    def close_app(e):
        page.window.close()

    title_bar = ft.Container(
        content=ft.Row(
            [
                ft.WindowDragArea(
                    content=ft.Container(
                        content=ft.Row([
                            ft.Icon(ft.Icons.HIVE, color=H_CYAN, size=20),
                            ft.Text(
                                spans=[
                                    ft.TextSpan("英雄联盟素材包获取&整理工具 by ", style=ft.TextStyle(color=H_GOLD, size=14, font_family="Times New Roman", weight=ft.FontWeight.BOLD)),
                                    ft.TextSpan(
                                        "Bilibili 仓小杰", 
                                        style=ft.TextStyle(color=H_CYAN, size=14, font_family="Times New Roman", weight=ft.FontWeight.BOLD, decoration=ft.TextDecoration.UNDERLINE),
                                        on_click=lambda e: page.launch_url("https://space.bilibili.com/13540581")
                                    ),
                                    ft.TextSpan("（该软件完全免费）", style=ft.TextStyle(color=H_GOLD, size=14, font_family="Times New Roman", weight=ft.FontWeight.BOLD)),
                                ]
                            ),
                        ], spacing=10),
                        padding=ft.padding.only(left=10)
                    ),
                    expand=True
                ),
                ft.Row([
                    ft.IconButton(ft.Icons.REMOVE, icon_color=H_GOLD, on_click=minimize_app, tooltip="最小化"),
                    ft.IconButton(ft.Icons.CROP_SQUARE, icon_color=H_GOLD, on_click=toggle_maximize, tooltip="最大化/还原"),
                    ft.IconButton(ft.Icons.CLOSE, icon_color=H_RED, on_click=close_app, tooltip="关闭"),
                ], spacing=0, vertical_alignment=ft.CrossAxisAlignment.CENTER)
            ],
            spacing=0,
            vertical_alignment=ft.CrossAxisAlignment.CENTER
        ),
        bgcolor=H_BLUE_DARK,
        padding=ft.padding.symmetric(vertical=5),
        border=ft.border.only(bottom=ft.border.BorderSide(1, H_GOLD))
    )

    # Background Stack
    page.add(
        ft.Container(
            content=ft.Stack([
                # Decorative Background Elements
                ft.Container(
                    gradient=ft.LinearGradient(
                        begin=ft.Alignment(-1, -1),
                        end=ft.Alignment(1, 1),
                        colors=[H_BLUE_DARK, "#050A14"]
                    ),
                    expand=True
                ),
                ft.Container(
                    content=ft.Icon(ft.Icons.SETTINGS, size=350, color=H_CYAN),
                    opacity=0.15,
                    top=-80, left=-80,
                ),
                ft.Container(
                    width=400, height=400,
                    bgcolor=H_GOLD,
                    border_radius=200,
                    # filter=ft.Blur(120, 120),
                    shadow=ft.BoxShadow(spread_radius=60, blur_radius=120, color=ft.Colors.with_opacity(0.2, H_GOLD)),
                    opacity=0.05,
                    bottom=-100, right=-100
                ),
                # Main Content
                ft.Column([
                    title_bar,
                    tabs,
                    main_content_area
                ], expand=True, spacing=0)
            ], expand=True),
            bgcolor=H_BLUE_DARK,
            border_radius=20,
            border=ft.border.all(2, H_GOLD),
            padding=2,
            margin=5,
            clip_behavior=ft.ClipBehavior.HARD_EDGE,
            expand=True
        )
    )
    
    # Auto-refresh on startup
    threading.Thread(target=check_versions, args=(None,), daemon=True).start()
