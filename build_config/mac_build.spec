# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['main_gui_mac.py'],
    pathex=[],
    binaries=[],
    datas=[('app_icon.png', '.'), ('app_icon.icns', '.')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LoL_Material_Tool',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='x86_64',
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='LoL_Material_Tool',
)

app = BUNDLE(
    coll,
    name='LoL素材工具.app',
    icon='app_icon.icns',
    bundle_identifier='com.cangxiaojie.loltool',
    info_plist={
        'CFBundleName': 'LoL素材工具',
        'CFBundleDisplayName': 'LoL素材工具',
        'CFBundleExecutable': 'LoL_Material_Tool',
        'CFBundleIconFile': 'app_icon.icns',
        'CFBundleIdentifier': 'com.cangxiaojie.loltool',
        'CFBundlePackageType': 'APPL',
        'CFBundleShortVersionString': '1.0.0',
        'NSHighResolutionCapable': True,
        'LSMinimumSystemVersion': '10.13.0',
    },
)
