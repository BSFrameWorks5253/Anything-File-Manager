@echo off
setlocal enabledelayedexpansion
title MediaView Studio - Restore Windows Default Viewer

echo ======================================================================
echo          MEDIAVIEW STUDIO - RESTORE WINDOWS DEFAULTS
echo ======================================================================
echo.
echo  Removing MediaView Studio file associations from HKCU...
echo  Restoring system default file associations...
echo.

set "POWERSHELL_SCRIPT=%TEMP%\unregister_mediaview_studio.ps1"

(
echo $videoExtensions = @('.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mpg', '.mpeg', '.3gp')
echo $photoExtensions = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.ico', '.avif', '.tiff', '.tif', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.raw')
echo $allExts = $videoExtensions + $photoExtensions
echo.
echo Write-Host 'Cleaning up file extension associations...' -ForegroundColor Cyan
echo foreach ($ext in $allExts^) {
echo     reg delete ('HKCU\Software\Classes\' + $ext^) /f 2^>$null ^| Out-Null
echo     reg delete ('HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\' + $ext + '\OpenWithProgids'^) /v 'MediaViewStudio.Video' /f 2^>$null ^| Out-Null
echo     reg delete ('HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\' + $ext + '\OpenWithProgids'^) /v 'MediaViewStudio.Image' /f 2^>$null ^| Out-Null
echo }
echo.
echo Write-Host 'Removing ProgID entries...' -ForegroundColor Cyan
echo reg delete 'HKCU\Software\Classes\MediaViewStudio.Video' /f 2^>$null ^| Out-Null
echo reg delete 'HKCU\Software\Classes\MediaViewStudio.Image' /f 2^>$null ^| Out-Null
echo reg delete 'HKCU\Software\MediaViewStudio' /f 2^>$null ^| Out-Null
echo reg delete 'HKCU\Software\RegisteredApplications' /v 'MediaView Studio' /f 2^>$null ^| Out-Null
echo.
echo Write-Host 'Flushing Windows Explorer thumbnail and icon cache...' -ForegroundColor Yellow
echo Start-Process -FilePath 'ie4uinit.exe' -ArgumentList '-show' -Wait -ErrorAction SilentlyContinue
echo Write-Host 'Cleanup complete!' -ForegroundColor Green
) > "%POWERSHELL_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%"
del "%POWERSHELL_SCRIPT%" 2>nul

echo.
echo ======================================================================
echo  REVERT COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo  MediaView Studio associations have been removed.
echo.
pause
