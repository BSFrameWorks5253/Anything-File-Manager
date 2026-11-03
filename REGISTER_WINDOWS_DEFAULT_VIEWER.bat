@echo off
setlocal enabledelayedexpansion
title MediaView Studio - Windows Default Viewer & Explorer Thumbnails Setup

echo ======================================================================
echo          MEDIAVIEW STUDIO - WINDOWS FILE EXPLORER INTEGRATION
echo ======================================================================
echo.
echo  Configuring MediaView Studio as the default viewer in Windows...
echo  Enabling native Windows File Explorer video and photo thumbnails...
echo.

set "SCRIPT_DIR=%~dp0"
set "APP_DIR=%SCRIPT_DIR%"
set "POWERSHELL_SCRIPT=%TEMP%\register_mediaview_studio.ps1"

(
echo $appDir = '%APP_DIR%' -replace '\\', '\\'
echo $nodeModulesElectron = Join-Path '%APP_DIR%' 'node_modules\electron\dist\electron.exe'
echo $parentElectron = Join-Path '%APP_DIR%' '..\Pixelcharm\node_modules\electron\dist\electron.exe'
echo $electronExe = ''
echo if (Test-Path $nodeModulesElectron^) { $electronExe = $nodeModulesElectron }
echo elseif (Test-Path $parentElectron^) { $electronExe = (Resolve-Path $parentElectron^).Path }
echo else { $electronExe = (Get-Command electron -ErrorAction SilentlyContinue^).Source }
echo.
echo $mainScript = Join-Path '%APP_DIR%' 'dist-electron\main.js'
echo.
echo if ($electronExe -and (Test-Path $mainScript^)^) {
echo     $commandStr = '\"' + $electronExe + '\" \"' + $mainScript + '\" \"%1\"'
echo } else {
echo     $commandStr = 'npm --prefix \"' + '%APP_DIR%' + '\" run start -- \"%1\"'
echo }
echo.
echo Write-Host '[1/4] Configuring ProgIDs for MediaView Studio...' -ForegroundColor Cyan
echo.
echo $videoProgId = 'MediaViewStudio.Video'
echo $imageProgId = 'MediaViewStudio.Image'
echo $videoThumbCLSID = '{c5aec3ec-e812-4677-a9a7-4fee1f9aa000}'
echo $photoThumbCLSID = '{C7657C4A-9F68-40fa-A4DF-96BC08EB3551}'
echo $photoExtractCLSID = '{3F30C968-480A-4C6C-862D-EFC0897BB84B}'
echo.
echo # 1. Video ProgID
echo reg add 'HKCU\Software\Classes\' + $videoProgId /ve /d 'MediaView Studio Video File' /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $videoProgId + '\shell\open\command' /ve /d $commandStr /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $videoProgId + '\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}' /ve /d $videoThumbCLSID /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $videoProgId + '\ShellEx\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}' /ve /d $videoThumbCLSID /f ^| Out-Null
echo.
echo # 2. Image ProgID
echo reg add 'HKCU\Software\Classes\' + $imageProgId /ve /d 'MediaView Studio Image File' /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $imageProgId + '\shell\open\command' /ve /d $commandStr /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $imageProgId + '\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}' /ve /d $photoThumbCLSID /f ^| Out-Null
echo reg add 'HKCU\Software\Classes\' + $imageProgId + '\ShellEx\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}' /ve /d $photoExtractCLSID /f ^| Out-Null
echo.
echo Write-Host '[2/4] Registering Video file extensions with native Explorer thumbnail provider...' -ForegroundColor Cyan
echo $videoExtensions = @('.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.ts', '.wmv', '.flv', '.m2ts', '.mpg', '.mpeg', '.3gp')
echo foreach ($ext in $videoExtensions^) {
echo     $mime = 'video/' + $ext.TrimStart('.'^)
echo     reg add ('HKCU\Software\Classes\' + $ext^) /ve /d $videoProgId /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext^) /v 'PerceivedType' /d 'video' /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext^) /v 'Content Type' /d $mime /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\OpenWithProgids'^) /v $videoProgId /d '' /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}'^) /ve /d $videoThumbCLSID /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\ShellEx\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}'^) /ve /d $videoThumbCLSID /f ^| Out-Null
echo     reg add ('HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\' + $ext + '\OpenWithProgids'^) /v $videoProgId /d '' /f ^| Out-Null
echo     Write-Host ('  + Linked ' + $ext + ' to MediaView Studio & Explorer Video Thumbnail Provider'^) -ForegroundColor DarkGray
echo }
echo.
echo Write-Host '[3/4] Registering Photo file extensions with native Explorer thumbnail provider...' -ForegroundColor Cyan
echo $photoExtensions = @('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.ico', '.avif', '.tiff', '.tif', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.raw')
echo foreach ($ext in $photoExtensions^) {
echo     $mime = 'image/' + $ext.TrimStart('.'^)
echo     reg add ('HKCU\Software\Classes\' + $ext^) /ve /d $imageProgId /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext^) /v 'PerceivedType' /d 'image' /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext^) /v 'Content Type' /d $mime /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\OpenWithProgids'^) /v $imageProgId /d '' /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\ShellEx\{e357fccd-a995-4576-b01f-234630154e96}'^) /ve /d $photoThumbCLSID /f ^| Out-Null
echo     reg add ('HKCU\Software\Classes\' + $ext + '\ShellEx\{BB2E617C-0920-11D1-9A0B-00C04FC2D6C1}'^) /ve /d $photoExtractCLSID /f ^| Out-Null
echo     reg add ('HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\' + $ext + '\OpenWithProgids'^) /v $imageProgId /d '' /f ^| Out-Null
echo     Write-Host ('  + Linked ' + $ext + ' to MediaView Studio & Explorer Photo Thumbnail Provider'^) -ForegroundColor DarkGray
echo }
echo.
echo Write-Host '[4/4] Registering in Windows Settings (Default Apps Capabilities)...' -ForegroundColor Cyan
echo reg add 'HKCU\Software\MediaViewStudio\Capabilities' /v 'ApplicationDescription' /d 'Universal Photo, Video & Media Asset Viewer for Anything Apps' /f ^| Out-Null
echo reg add 'HKCU\Software\MediaViewStudio\Capabilities' /v 'ApplicationName' /d 'MediaView Studio' /f ^| Out-Null
echo foreach ($ext in ($videoExtensions + $photoExtensions^)^) {
echo     $p = if ($videoExtensions -contains $ext^) { $videoProgId } else { $imageProgId }
echo     reg add 'HKCU\Software\MediaViewStudio\Capabilities\FileAssociations' /v $ext /d $p /f ^| Out-Null
echo }
echo reg add 'HKCU\Software\RegisteredApplications' /v 'MediaView Studio' /d 'Software\MediaViewStudio\Capabilities' /f ^| Out-Null
echo.
echo Write-Host 'Flushing Windows Explorer thumbnail and icon cache...' -ForegroundColor Yellow
echo Start-Process -FilePath 'ie4uinit.exe' -ArgumentList '-show' -Wait -ErrorAction SilentlyContinue
echo Write-Host 'Done!' -ForegroundColor Green
) > "%POWERSHELL_SCRIPT%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%"
del "%POWERSHELL_SCRIPT%" 2>nul

echo.
echo ======================================================================
echo  SETUP COMPLETED SUCCESSFULLY!
echo ======================================================================
echo.
echo  MediaView Studio is now registered in Windows:
echo  1. Double-clicking any video or photo will open it in MediaView Studio.
echo  2. Windows File Explorer will continue generating LIVE thumbnails
echo     for all videos and photos.
echo  3. You can also customize associations anytime from the "Default Viewer"
echo     button inside MediaView Studio.
echo.
pause
