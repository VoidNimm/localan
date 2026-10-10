@echo off
title Local Chat - Rembg Server (Capped VRAM 2 GB)
cd /d "%~dp0"

if defined PYTHON_EXE goto :found_python

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
    goto :found_python
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    set "PYTHON_EXE=python"
    goto :found_python
)

echo [ERROR] Python tidak ditemukan di virtualenv (.venv) atau PATH sistem!
echo Pastikan Python 3.10-3.13 terinstal dan ditambahkan ke PATH.
pause
exit /b 1

:found_python

echo ========================================================
echo   Local Chat - Rembg Server (Capped VRAM 2 GB)
echo ========================================================
echo Python    : %PYTHON_EXE%
echo Host      : 127.0.0.1
echo Port      : 7000
echo VRAM Cap  : 2048 MB (GPU CUDA)
echo Policy    : Single Active Model + Auto CPU Fallback
echo API Docs  : http://127.0.0.1:7000/api
echo ========================================================
echo Tekan Ctrl+C di jendela ini untuk menghentikan server.
echo.

"%PYTHON_EXE%" scripts\run_rembg.py --host 127.0.0.1 --port 7000 --vram-limit-mb 2048 --no-ui
if %errorlevel% neq 0 (
    echo.
    echo Server berhenti dengan kode error: %errorlevel%
    pause
)
