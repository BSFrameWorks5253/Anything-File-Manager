#!/usr/bin/env python3
"""
Quick runner for Anything File Manager Build Studio
Run: python make_exe.py
"""
import os
import sys
import subprocess

script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts', 'make_exe_cross.py')
cmd = [sys.executable, script_path] + sys.argv[1:]
sys.exit(subprocess.call(cmd))
