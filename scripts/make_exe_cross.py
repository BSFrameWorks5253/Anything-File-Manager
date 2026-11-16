#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║     ANYTHING FILE MANAGER — BUILD & RELEASE STUDIO                   ║
║     Cross-platform build system inspired by One Tap                  ║
║     Builds: Windows NSIS Installer (.exe)                            ║
║     Automated GitHub Release Uploading & Semver Management           ║
╚══════════════════════════════════════════════════════════════════════╝
Run:
  python scripts/make_exe_cross.py           (Opens Interactive Dark GUI)
  python scripts/make_exe_cross.py --build   (Headless Build)
  python scripts/make_exe_cross.py --dist    (Headless Build + Package)
  python scripts/make_exe_cross.py --upload  (Build + Package + Upload)
"""

import json
import os
import re
import sys
import time
import shutil
import hashlib
import tempfile
import threading
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

# Configure UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

IS_WIN = sys.platform == 'win32'
NPM_CMD = 'npm.cmd' if IS_WIN else 'npm'

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('scripts', 'bin') else os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# ─────────────────────────────────────────────────────────────────────────────
#  ENVIRONMENT & GITHUB TOKEN
# ─────────────────────────────────────────────────────────────────────────────
def load_env():
    env_path = '.env'
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k, v = k.strip(), v.strip()
                if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                    v = v[1:-1]
                os.environ[k] = v
    except Exception:
        pass

load_env()

def get_github_token() -> str:
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN', '')
    if not token:
        try:
            r = subprocess.run(['git', 'remote', 'get-url', 'origin'], capture_output=True, text=True, timeout=5, shell=IS_WIN)
            if r.returncode == 0:
                m = re.search(r'https://([^@]+)@github\.com', r.stdout)
                if m:
                    token = m.group(1)
        except Exception:
            pass
    return token.strip()

# ─────────────────────────────────────────────────────────────────────────────
#  VERSION MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
def get_current_version() -> str:
    try:
        with open('package.json', 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
            return data.get('version', '26.11.19')
    except Exception:
        return '26.11.19'

def set_version(new_version: str, log_fn=print):
    new_version = new_version.strip().lstrip('vV')
    try:
        with open('package.json', 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        old_ver = data.get('version', '')
        data['version'] = new_version
        content = json.dumps(data, indent=2)
        with open('package.json', 'w', encoding='utf-8', newline='\n') as f:
            f.write(content + '\n')
        log_fn(f"✓ Version updated: {old_ver} → {new_version}")
        return True
    except Exception as e:
        log_fn(f"✗ Failed to update version: {e}")
        return False

def compute_bumped_version(current: str, part: str = 'patch') -> str:
    segments = current.split('.')
    while len(segments) < 3:
        segments.append('0')
    try:
        major, minor, patch = int(segments[0]), int(segments[1]), int(segments[2])
    except ValueError:
        return current

    if part == 'major':
        return f"{major + 1}.0.0"
    elif part == 'minor':
        return f"{major}.{minor + 1}.0"
    else:
        return f"{major}.{minor}.{patch + 1}"

# ─────────────────────────────────────────────────────────────────────────────
#  BUILD SYSTEM
# ─────────────────────────────────────────────────────────────────────────────
def run_command(cmd, log_fn=print, check=True):
    log_fn(f"\n▶ Executing: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        shell=IS_WIN,
        cwd=ROOT_DIR
    )
    for line in proc.stdout:
        log_fn(line.rstrip())
    proc.wait()
    if check and proc.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {proc.returncode}")
    return proc.returncode

def clean_build_artifacts(log_fn=print):
    log_fn("🧹 Cleaning previous build artifacts...")
    targets = ['dist', 'dist-electron', 'release']
    for t in targets:
        p = os.path.join(ROOT_DIR, t)
        if os.path.exists(p):
            try:
                shutil.rmtree(p, ignore_errors=True)
                log_fn(f"  Removed: {t}/")
            except Exception as e:
                log_fn(f"  Warning removing {t}: {e}")
    log_fn("✓ Cleanup complete.")

def build_frontend(log_fn=print):
    log_fn("\n📦 Step 1/3: Compiling Vite Frontend...")
    run_command([NPM_CMD, 'run', 'build:vite'], log_fn=log_fn)
    log_fn("✓ Frontend built successfully.")

def build_electron(log_fn=print):
    log_fn("\n⚡ Step 2/3: Compiling Electron Backend...")
    run_command([NPM_CMD, 'run', 'build:electron'], log_fn=log_fn)
    log_fn("✓ Electron backend built successfully.")

def package_installer(log_fn=print):
    log_fn("\n🔨 Step 3/3: Packaging NSIS Installer (electron-builder)...")
    # Verify package.json is free of UTF-8 BOM
    with open('package.json', 'rb') as f:
        head = f.read(3)
        if head == b'\xef\xbb\xbf':
            log_fn("  Fixing UTF-8 BOM in package.json...")
            content = f.read().decode('utf-8')
            with open('package.json', 'w', encoding='utf-8', newline='\n') as out_f:
                out_f.write(content)

    run_command([NPM_CMD, 'exec', '--', 'electron-builder', '--win', 'nsis'], log_fn=log_fn)

    # Locate generated installer in C:\temp\afm-release or release/
    version = get_current_version()
    search_dirs = [r'C:\temp\afm-release', os.path.join(ROOT_DIR, 'release')]
    found_installer = None

    for d in search_dirs:
        if os.path.exists(d):
            for fname in os.listdir(d):
                if fname.startswith('Anything-File-Manager-Setup-V-') and fname.endswith('.exe'):
                    found_installer = os.path.join(d, fname)
                    break
        if found_installer:
            break

    os.makedirs(os.path.join(ROOT_DIR, 'release'), exist_ok=True)

    if found_installer and os.path.exists(found_installer):
        dest_named = os.path.join(ROOT_DIR, 'release', os.path.basename(found_installer))
        dest_setup = os.path.join(ROOT_DIR, 'release', 'setup.exe')
        shutil.copy2(found_installer, dest_named)
        shutil.copy2(found_installer, dest_setup)
        log_fn(f"\n✓ Staged Installer: release/{os.path.basename(dest_named)}")
        log_fn(f"✓ Staged Standalone: release/setup.exe")
        log_fn(f"  Size: {os.path.getsize(dest_setup) / (1024*1024):.2f} MB")
        return dest_named, dest_setup
    else:
        log_fn("⚠ Warning: Installer generated in output directory, could not stage locally.")
        return None, None

def full_build(log_fn=print):
    start_time = time.time()
    log_fn("════════════════════════════════════════════════════════════════")
    log_fn(f"  BUILDING ANYTHING FILE MANAGER v{get_current_version()}")
    log_fn("════════════════════════════════════════════════════════════════")
    build_frontend(log_fn=log_fn)
    build_electron(log_fn=log_fn)
    named, setup = package_installer(log_fn=log_fn)
    elapsed = time.time() - start_time
    log_fn(f"\n🎉 BUILD FINISHED IN {elapsed:.1f}s!")
    log_fn("════════════════════════════════════════════════════════════════")
    return named, setup

# ─────────────────────────────────────────────────────────────────────────────
#  GITHUB RELEASE UPLOAD
# ─────────────────────────────────────────────────────────────────────────────
def upload_to_github(log_fn=print):
    token = get_github_token()
    if not token:
        log_fn("✗ Error: No GitHub token found in GH_TOKEN / GITHUB_TOKEN or git remote.")
        return False

    repo = "BSFrameWorks5253/Anything-File-Manager"
    release_id = "434178509"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "AFM-BuildStudio"
    }

    # Find installer
    setup_file = os.path.join(ROOT_DIR, 'release', 'setup.exe')
    if not os.path.exists(setup_file):
        # Look in temp
        temp_dir = r'C:\temp\afm-release'
        if os.path.exists(temp_dir):
            for f in os.listdir(temp_dir):
                if f.startswith('Anything-File-Manager-Setup-V-') and f.endswith('.exe'):
                    os.makedirs(os.path.join(ROOT_DIR, 'release'), exist_ok=True)
                    shutil.copy2(os.path.join(temp_dir, f), setup_file)
                    shutil.copy2(os.path.join(temp_dir, f), os.path.join(ROOT_DIR, 'release', f))
                    break

    if not os.path.exists(setup_file):
        log_fn("✗ Error: setup.exe not found in release/ directory. Build installer first.")
        return False

    version = get_current_version()
    named_file = os.path.join(ROOT_DIR, 'release', f"Anything-File-Manager-Setup-V-{version}.exe")
    if not os.path.exists(named_file):
        shutil.copy2(setup_file, named_file)

    log_fn("\n☁ Connecting to GitHub Release...")
    try:
        # 1. Fetch release assets
        req = urllib.request.Request(f"https://api.github.com/repos/{repo}/releases/{release_id}", headers=headers)
        with urllib.request.urlopen(req) as resp:
            rel_data = json.loads(resp.read().decode('utf-8'))

        existing_assets = {a['name']: a['id'] for a in rel_data.get('assets', [])}
        upload_files = [setup_file, named_file]

        for file_path in upload_files:
            file_name = os.path.basename(file_path)
            # Delete old asset if exists
            if file_name in existing_assets:
                asset_id = existing_assets[file_name]
                log_fn(f"  Deleting existing asset {file_name} (ID: {asset_id})...")
                del_req = urllib.request.Request(
                    f"https://api.github.com/repos/{repo}/releases/assets/{asset_id}",
                    headers=headers,
                    method='DELETE'
                )
                try:
                    with urllib.request.urlopen(del_req) as _:
                        pass
                    log_fn(f"  ✓ Deleted {file_name}")
                except Exception as e:
                    log_fn(f"  Warning deleting asset: {e}")

            # Upload asset
            file_size = os.path.getsize(file_path)
            log_fn(f"  Uploading {file_name} ({file_size / (1024*1024):.2f} MB)...")
            upload_url = f"https://uploads.github.com/repos/{repo}/releases/{release_id}/assets?name={file_name}"
            
            with open(file_path, 'rb') as f:
                upload_bytes = f.read()

            up_headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
                "User-Agent": "AFM-BuildStudio"
            }
            up_req = urllib.request.Request(upload_url, data=upload_bytes, headers=up_headers, method='POST')
            with urllib.request.urlopen(up_req) as up_resp:
                res_json = json.loads(up_resp.read().decode('utf-8'))
                log_fn(f"  ✓ Successfully uploaded {file_name} (ID: {res_json.get('id')})")

        log_fn("\n🎉 GITHUB RELEASE UPLOAD COMPLETED SUCCESSFULLY!")
        return True
    except Exception as e:
        log_fn(f"✗ Upload failed: {e}")
        return False

# ─────────────────────────────────────────────────────────────────────────────
#  INTERACTIVE DARK GUI (TKINTER)
# ─────────────────────────────────────────────────────────────────────────────
def launch_gui():
    try:
        import tkinter as tk
        from tkinter import ttk, messagebox, scrolledtext
    except ImportError:
        print("Tkinter not available. Running in headless build mode.")
        full_build()
        return

    root = tk.Tk()
    root.title("Anything File Manager — Build & Release Studio")
    root.geometry("820x680")
    root.minsize(720, 560)
    root.configure(bg="#0c0f17")

    # Dark Theme Styles
    style = ttk.Style()
    style.theme_use('clam')
    style.configure(".", background="#0c0f17", foreground="#e2e8f0", font=('Segoe UI', 9))
    style.configure("TLabel", background="#0c0f17", foreground="#e2e8f0")
    style.configure("Header.TLabel", font=('Segoe UI', 13, 'bold'), foreground="#38bdf8")
    style.configure("SubHeader.TLabel", font=('Segoe UI', 9), foreground="#94a3b8")
    style.configure("Action.TButton", font=('Segoe UI', 9, 'bold'), background="#2563eb", foreground="#ffffff")
    style.map("Action.TButton", background=[('active', '#1d4ed8')])
    style.configure("Green.TButton", font=('Segoe UI', 9, 'bold'), background="#059669", foreground="#ffffff")
    style.map("Green.TButton", background=[('active', '#047857')])

    # ── Header ──
    hdr_frame = tk.Frame(root, bg="#111625", padx=16, pady=12, highlightthickness=1, highlightbackground="#1e293b")
    hdr_frame.pack(fill='x', padx=12, pady=(12, 6))

    tk.Label(hdr_frame, text="⚡ ANYTHING FILE MANAGER — BUILD STUDIO", bg="#111625", fg="#60a5fa", font=('Segoe UI', 13, 'bold')).pack(anchor='w')
    tk.Label(hdr_frame, text="Automated Vite, Electron, NSIS Installer & GitHub Release Studio (Inspired by One Tap)", bg="#111625", fg="#94a3b8", font=('Segoe UI', 8)).pack(anchor='w')

    # ── Version Controls Frame ──
    ver_frame = tk.Frame(root, bg="#111625", padx=16, pady=10, highlightthickness=1, highlightbackground="#1e293b")
    ver_frame.pack(fill='x', padx=12, pady=6)

    tk.Label(ver_frame, text="VERSION MANAGEMENT", bg="#111625", fg="#38bdf8", font=('Segoe UI', 9, 'bold')).grid(row=0, column=0, columnspan=5, sticky='w', pady=(0, 6))

    ver_var = tk.StringVar(value=get_current_version())
    tk.Label(ver_frame, text="Current Version:", bg="#111625", fg="#cbd5e1").grid(row=1, column=0, sticky='w')
    ver_entry = tk.Entry(ver_frame, textvariable=ver_var, width=12, bg="#1e293b", fg="#ffffff", insertbackground="white", font=('Segoe UI', 9, 'bold'), relief='flat')
    ver_entry.grid(row=1, column=1, sticky='w', padx=8)

    def do_bump(part):
        nxt = compute_bumped_version(ver_var.get(), part)
        ver_var.set(nxt)
        set_version(nxt, log_msg)

    tk.Button(ver_frame, text="+ Patch", bg="#334155", fg="#ffffff", font=('Segoe UI', 8), relief='flat', padx=8, pady=2, command=lambda: do_bump('patch')).grid(row=1, column=2, padx=4)
    tk.Button(ver_frame, text="+ Minor", bg="#334155", fg="#ffffff", font=('Segoe UI', 8), relief='flat', padx=8, pady=2, command=lambda: do_bump('minor')).grid(row=1, column=3, padx=4)
    tk.Button(ver_frame, text="+ Major", bg="#334155", fg="#ffffff", font=('Segoe UI', 8), relief='flat', padx=8, pady=2, command=lambda: do_bump('major')).grid(row=1, column=4, padx=4)

    # ── Build Action Bar ──
    act_frame = tk.Frame(root, bg="#111625", padx=16, pady=10, highlightthickness=1, highlightbackground="#1e293b")
    act_frame.pack(fill='x', padx=12, pady=6)

    is_building = [False]

    def log_msg(msg: str):
        log_box.insert(tk.END, msg + "\n")
        log_box.see(tk.END)

    def run_async(func):
        if is_building[0]:
            messagebox.showwarning("Busy", "A build task is already running!")
            return
        is_building[0] = True
        status_lbl.config(text="● Building...", fg="#eab308")

        def worker():
            try:
                func()
                status_lbl.config(text="● Ready", fg="#22c55e")
            except Exception as e:
                log_msg(f"\n✗ Error: {e}")
                status_lbl.config(text="● Error", fg="#ef4444")
            finally:
                is_building[0] = False

        threading.Thread(target=worker, daemon=True).start()

    tk.Button(act_frame, text="🚀 Full Build & Package", bg="#2563eb", activebackground="#1d4ed8", fg="#ffffff", font=('Segoe UI', 9, 'bold'), relief='flat', padx=12, pady=6, command=lambda: run_async(lambda: full_build(log_msg))).pack(side='left', padx=4)
    tk.Button(act_frame, text="📦 Package (.exe)", bg="#0d9488", activebackground="#0f766e", fg="#ffffff", font=('Segoe UI', 9, 'bold'), relief='flat', padx=10, pady=6, command=lambda: run_async(lambda: package_installer(log_msg))).pack(side='left', padx=4)
    tk.Button(act_frame, text="☁ Upload Release", bg="#7c3aed", activebackground="#6d28d9", fg="#ffffff", font=('Segoe UI', 9, 'bold'), relief='flat', padx=10, pady=6, command=lambda: run_async(lambda: upload_to_github(log_msg))).pack(side='left', padx=4)
    tk.Button(act_frame, text="🧹 Clean", bg="#475569", activebackground="#334155", fg="#ffffff", font=('Segoe UI', 9), relief='flat', padx=10, pady=6, command=lambda: run_async(lambda: clean_build_artifacts(log_msg))).pack(side='left', padx=4)

    status_lbl = tk.Label(act_frame, text="● Ready", bg="#111625", fg="#22c55e", font=('Segoe UI', 9, 'bold'))
    status_lbl.pack(side='right', padx=8)

    # ── Console Log View ──
    log_frame = tk.Frame(root, bg="#080a10", highlightthickness=1, highlightbackground="#1e293b")
    log_frame.pack(fill='both', expand=True, padx=12, pady=(6, 12))

    log_box = scrolledtext.ScrolledText(log_frame, bg="#080a10", fg="#38bdf8", insertbackground="white", font=('Consolas', 9), relief='flat')
    log_box.pack(fill='both', expand=True, padx=4, pady=4)

    log_msg("Anything File Manager — Build Studio Initialized.")
    log_msg(f"Active Version: v{get_current_version()}")
    log_msg("Ready to compile, package, and release. (Note: Exe is not auto-run).\n")

    root.mainloop()

# ─────────────────────────────────────────────────────────────────────────────
#  CLI ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    args = sys.argv[1:]
    if '--build' in args:
        build_frontend()
        build_electron()
    elif '--dist' in args or '--package' in args:
        full_build()
    elif '--upload' in args:
        upload_to_github()
    elif '--clean' in args:
        clean_build_artifacts()
    else:
        # If Tkinter GUI is supported, open the Dark Build Studio
        try:
            launch_gui()
        except Exception:
            full_build()
