# Anything File Manager (AFM)

> High-performance production desktop file manager, asset coordinator, and media workstation.  
> Official module of the **Anything Creative Ecosystem** · Companion to **One Tap**.

---

## Overview

**Anything File Manager (AFM)** is a domain-specific, high-speed file browser built for professional multi-session video production workflows, event documentation units, and creative teams.

Unlike generic OS explorers, AFM understands:
- **Semantic Production Hierarchies**: Master Safar (`1448-03 Mumbai`), Date/Sessions (`1448-03-13 _01M`), and Slot formats (`1448-05-07_01M-01-01N-40905764`).
- **Cumulative Video Runtime ($\sum\text{duration}$)**: Instant recursive clip counting and duration calculation without freezing the UI.
- **Workflow Lifecycle Tracking**: Color-coded pipeline stages persisted in lightweight metadata (`Stage 1 Ingest`, `Stage 2 Synced`, `In Editing`, `Review`, `Rendered`, `Uploaded`, `Backed Up`).
- **Adobe Premiere Pro Pre-Flight Generation**: Automatic sequence XML and `.prproj` creation with 4 standard production bins.
- **Dynamic Taskbar Icon**: Sleek closed-folder desktop shortcut that dynamically opens on your taskbar when running.
- **Standalone macOS Media Player**: Dedicated QuickTime Player window with frame-by-frame scrubbing, 10s skip, and speed control.

---

## Key Features

1. **Native Apple macOS Finder + Windows 11 Hybrid UI**:
   - Ultra-crisp vector folder glyphs and dog-ear document sheets (PDF, XLS, DOCX, Code, ZIP, BAT).
   - Real high-resolution photo & video thumbnails with duration pills.
   - Genuine macOS traffic lights (🔴 🟡 🟢) and pill selection styling.
   - Density resizer: **Compact**, **Normal**, and **Broad** layouts.

2. **Complete Windows Explorer Context Menu**:
   - Right-click any file/folder or background canvas: Open, Open Separately, Quick Look (Space), Copy Path, Inspect, Reveal in Explorer, and One Tap actions.

3. **Miller Columns & Closable Preview Pane**:
   - Deep nested folder navigation without duplicate panels.
   - Embedded Camera RAW (`.CR3`, `.CR2`, `.NEF`, `.ARW`) instant preview extraction.

4. **One Tap Production Suite Integration**:
   - Local HTTP bridge (`localhost:49152`) to trigger **Title Adder**.
   - Shared task tracker SQLite database synchronization.
   - One-click DriveSync backup verification and Photo/Video separation.

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+ (for icon & XML tooling)

### Installation
```bash
git clone https://github.com/BSFrameWorks5253/Anything-File-Manager.git
cd Anything-File-Manager
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

---

## License & Credits
Developed by **Burhanuddin Sounasath** · Anything Creative Ecosystem.
