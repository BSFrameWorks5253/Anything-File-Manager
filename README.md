# MediaView Studio — Universal Media Asset Viewer & Inspector
> Child App of the **Anything Creative Ecosystem**

MediaView Studio is a high-performance desktop media workstation designed to view, inspect, and organize any photo or video format across local and external drives.

## Key Capabilities

1. **Universal Format Playback & Viewing**:
   - **Photos**: JPG, JPEG, PNG, WEBP, GIF, SVG, BMP, ICO, AVIF, TIFF, and RAW camera formats (`.cr2`, `.cr3`, `.nef`, `.arw`, `.dng`, `.raf`).
   - **Videos**: MP4, MOV, MKV, AVI, WEBM, M4V, TS, WMV, FLV, M2TS, MPG.

2. **Visual File Manager with Dynamic Thumbnails**:
   - Real photo thumbnail cards with aspect ratio preservation.
   - Real video frame thumbnail extraction with **live duration / timelapse badge** (e.g. `10s`, `45s`, `1m 20s`).
   - Filter pills: All, Photos Only, Videos Only, Timelapses (videos ≤ 60s).
   - Fast drive switcher, subfolder navigator, and search filter.

3. **High-Definition Interactive Frame Zoom**:
   - Zoom in on any video frame up to **800% (8x)** using mouse wheel or on-screen zoom controls.
   - Click-and-drag panning across the zoomed video frame with smooth physics.
   - One-click `Fit / 100%` reset button.

4. **1-Frame Precision Stepping & Snapshot Capture**:
   - Frame-by-frame navigation (`⏮ -1f` / `+1f ⏭`) with on-screen buttons or Left / Right keyboard arrow keys when paused.
   - Native resolution frame grab (`📸 Snapshot`) that exports the exact current frame to JPEG or PNG.

5. **Anything Ecosystem Child App Integration**:
   - Dynamic luxury splash screen via `loader-config.json`.
   - Single-instance lock and Windows Explorer double-click file association support (`MediaViewer.exe "path/to/video.mp4"`).
   - Inherits master authentication via `ecosystem-auth-client.js`.

## Quick Start

- **Launch**: Run `LAUNCH_MEDIA_VIEWER.bat`
- **Development**: Run `DEV_MEDIA_VIEWER.bat`
- **Build**: Run `START_MEDIA_VIEWER.bat` or `npm run build`
