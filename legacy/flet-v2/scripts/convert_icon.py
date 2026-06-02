from PIL import Image

def create_ico(source_path, output_path):
    try:
        img = Image.open(source_path)
        
        # 生成 256x256 PNG 用于任务栏 (尝试修复图标丢失问题)
        img_256 = img.resize((256, 256), Image.Resampling.LANCZOS)
        img_256.save("taskbar_icon_256.png", "PNG")
        print(f"Successfully created taskbar_icon_256.png (256x256)")

        # 1. 生成全尺寸 ICO (用于 EXE 文件图标，保证兼容性)
        full_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
        img.save("icon.ico", format='ICO', sizes=full_sizes)
        print(f"Successfully created icon.ico (Full sizes)")

        # 2. 生成仅包含大尺寸的 ICO (用于任务栏显示，强制清晰度)
        # 仅保留 256x256，强制系统使用最高清素材进行下采样
        max_res_sizes = [(256, 256)]
        img.save("icon_max_res.ico", format='ICO', sizes=max_res_sizes)
        print(f"Successfully created icon_max_res.ico (256x256 only)")

        # 3. 生成 MacOS 专用 ICNS 图标
        # ICNS 支持多种尺寸，Pillow 会自动处理
        if hasattr(Image, 'open'): # Simple check, Pillow supports ICNS save
            img.save("app_icon.icns", format='ICNS', sizes=[(1024, 1024), (512, 512), (256, 256), (128, 128), (64, 64), (32, 32)])
            print(f"Successfully created app_icon.icns for MacOS")
            
    except Exception as e:
        print(f"Error creating icon: {e}")

if __name__ == "__main__":
    create_ico("app_icon.png", "icon.ico")
