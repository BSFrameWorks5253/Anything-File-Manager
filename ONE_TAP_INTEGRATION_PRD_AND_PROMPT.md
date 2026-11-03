# MASTER PROMPT: Inter-App Service Integration — Anything File Manager (AFM) ↔ One Tap Ecosystem

> **Document Type**: Master Architecture Specification & Integration Prompt  
> **Source Module**: Anything File Manager (AFM)  
> **Ecosystem Host**: One Tap Desktop Suite  
> **Target Audience**: AI Agents, Systems Engineers, and Desktop Application Developers

---

## 1. System Vision & Integration Objective

You are tasked with wiring **Anything File Manager (AFM)** directly into the **One Tap Production Suite** so that AFM acts as the high-speed visual command center, seamlessly calling, monitoring, and triggering One Tap's background engines.

Instead of operating as an isolated file browser, AFM must deeply communicate with One Tap's 6 core micro-services:
1. **Title Adder Engine** (FFmpeg GPU Intro/Outro overlays via local HTTP API & IPC)
2. **Premiere Pro Project Generator** (`create_premiere_projects.py` & XML sequence engine)
3. **Production Task Tracker DB** (Shared SQLite tracking for renders, stages, and editor metrics)
4. **DriveSync & Hash Verifier** (Chunked MD5/SHA-256 backup reconciliation daemon)
5. **Photo / Video (PV) Separator** (Camera card ingest & asset segregation)
6. **Dynamic Island & Notification Bridge** (Shared ambient task status across desktop windows)

---

## 2. Inter-App Communication Topology

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      ANYTHING FILE MANAGER (AFM)                       │
│  [Visual Explorer]  [Cumulative Runtime]  [Hierarchy Classifier]       │
└────────────┬───────────────────────────┬───────────────────────────────┘
             │ (Local HTTP Bridge)       │ (Direct Shared SQLite DB)
             │ Port: 49152               │ Path: %APPDATA%/OneTap/tracker.db
             ▼                           ▼
┌─────────────────────────────┐ ┌────────────────────────────────────────┐
│ ONE TAP TITLE ADDER DAEMON  │ │      TASK TRACKER & METRICS DB         │
│ • POST /api/load-session    │ │ • Query stage history & render times   │
│ • GET  /api/health          │ │ • Record editing & review milestones   │
│ • POST /api/render-batch    │ │ • Track editor velocity per session    │
└────────────┬────────────────┘ └────────────────────────────────────────┘
             │ (Shared Process Exec)
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ONE TAP SYSTEM & CLI WORKERS                       │
│ • create_premiere_projects.py (Sequence XML & .prproj generator)       │
│ • hashVerifier.ts & driveSync (Checksum mirror & backup guard)         │
│ • pvSeparator.ipc.ts (Raw photo & video sorting engine)                │
│ • dynamicIsland.ts (Ambient progress & system sound cues)              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 6 One Tap Service Bridges

### Service 1: One Tap Title Adder Bridge (HTTP & IPC)
- **Local Bridge Port**: `http://127.0.0.1:49152`
- **Health Check**: `GET http://127.0.0.1:49152/api/health`
- **Load Folder Session**:
  ```http
  POST http://127.0.0.1:49152/api/load-session
  Content-Type: application/json

  {
    "folderPath": "F:\\In Process\\1448-03 Mumbai\\1448-03-13 _01M",
    "sourceApp": "AnythingFileManager",
    "autoScan": true
  }
  ```
- **AFM UI Action**:
  - Context menu on any Date/Session folder or Slot folder: `Send to Title Adder`.
  - Inspector drawer button with live connection badge (`Online (49152)` or `One Tap Offline`).

### Service 2: Premiere Pro Project & XML Service
- **Engine**: One Tap's Python script `create_premiere_projects.py` and native XML builder.
- **AFM Capabilities**:
  - Date Session Folder scope: Generates frame-accurate XML sequence with 4 standard bins:
    - `01_FOOTAGE` (Separated by camera and slot)
    - `02_AUDIO` (Multi-track audio routing)
    - `03_GRAPHICS_TITLES` (Titles and cards)
    - `04_EXPORTS`
  - Strict `<in>`, `<out>`, and `<duration>` frame math at 25.0 / 50.0 / 29.97 fps to avoid trailing black frames.
  - Option to trigger CEP extension or open project directly in Premiere Pro.

### Service 3: Task Tracker & Production Analytics Database
- **Database Location**:
  `path.join(app.getPath('userData'), '..', 'One Tap', 'tracker.db')` or fallback in AFM directory.
- **Shared Schema Tables**:
  - `sessions` (`session_id`, `folder_path`, `safar_code`, `date_session`, `stage`, `total_runtime`, `updated_at`)
  - `renders` (`render_id`, `slot_code`, `its_id`, `input_file`, `output_file`, `duration_secs`, `render_time_secs`, `status`, `created_at`)
- **AFM Integration**:
  - Whenever an editor changes a stage tag (e.g., `Stage 1` $\rightarrow$ `In Editing` $\rightarrow$ `Rendered`), AFM writes to both the local `.afm_meta.json` AND records a transition log in `tracker.db`.
  - Inspector displays historical render times and editor productivity stats sourced from One Tap.

### Service 4: DriveSync & Storage Backup Guard
- **Engine**: One Tap's `driveSync.ipc.ts` and `hashVerifier.ts`.
- **AFM Features**:
  - Context menu: `Verify Mirror with DriveSync`.
  - Checks if files in the selected Date folder exist in `Backup Drive` or `Google Drive Mirror`.
  - Calculates non-blocking MD5 checksums on demand to verify asset integrity.
  - Disk Health Pill in toolbar: Warns in real-time if working drive space falls below 15% or 100 GB.

### Service 5: Photo / Video (PV) Separator
- **Engine**: One Tap's `pvSeparator.ipc.ts`.
- **AFM Features**:
  - When raw camera cards (SD, CFexpress) are dumped with mixed files (`.CR3`, `.JPG`, `.MP4`, `.MOV`), AFM offers a 1-click action: `Separate Photos & Videos`.
  - Automatically routes photography to `Pictures\` or `Photos\` and raw clips into slot subfolders.

### Service 6: Dynamic Island & Ambient Notification Feed
- **Engine**: One Tap's `dynamicIsland.ts` and `audioEngine.ts`.
- **AFM Features**:
  - During long scans, cumulative runtime calculations, or XML generation, AFM dispatches progress events to the One Tap Dynamic Island.
  - Plays subtle sound cues upon completion.

---

## 4. Master Implementation Prompt (Copy & Paste to AI Agent)

```markdown
# TASK: Wire Anything File Manager (AFM) to One Tap Ecosystem Services

You are developing the service layer of **Anything File Manager (AFM)** located at:
`c:\Users\Burhanuddin\OneDrive\Desktop\Anything\Anything Apps\Media Viewer`

The companion app **One Tap** is located at:
`c:\Users\Burhanuddin\OneDrive\Desktop\Anything\Anything Apps\One Tap`

Implement the complete **OneTapBridgeService** in AFM that integrates the two applications:

### Step 1: Create `src/services/oneTapService.ts` in AFM
Implement a robust singleton service `oneTapService`:
1. `checkHealth()`: Checks `http://127.0.0.1:49152/api/health` with a 1.5s timeout. Returns `{ online: boolean, version?: string }`.
2. `sendFolderToTitleAdder(folderPath: string)`: Sends `POST http://127.0.0.1:49152/api/load-session` with `{ folderPath, sourceApp: 'AFM' }`. Returns feedback message.
3. `getTaskTrackerStats(dateSession: string)`: Queries One Tap's SQLite tracker DB for past render logs and stage history for this session.
4. `generatePremiereProject(folderPath: string, preset: '1080p' | '4k', fps: number)`: Calls AFM's native IPC `afm:generatePremiereProject` with the pre-flight settings.
5. `verifyBackupSync(folderPath: string, targetBackupDir: string)`: Scans folder and compares file sizes and hashes against the backup directory.

### Step 2: Register One Tap Actions in AFM Context Menu & Inspector
1. In `src/components/explorer/ExplorerContextMenu.tsx`:
   - Add `"Send to Title Adder (One Tap)"` with lightning icon.
   - Add `"Generate Premiere Sequence XML"`.
   - Add `"Check DriveSync Backup Status"`.
2. In `src/components/afm/AfmInspectorPanel.tsx`:
   - Display a live One Tap Service Status badge (`One Tap 49152: Connected` vs `Offline`).
   - Add a 1-click button to trigger Title Adder session loading.
   - Display cumulative duration $\sum\text{duration}$ directly formatted for One Tap export sheets.

### Step 3: Implement IPC Handler in `electron/ipc/afm.ipc.ts`
1. Wire `afm:sendToTitleAdder` to send HTTP POST to port 49152.
2. Wire `afm:checkOneTapHealth` to ping port 49152.
3. Handle errors gracefully (e.g. if One Tap is not currently running, display a helpful notification: "Start One Tap to enable automated titling & syncing").

### Step 4: Verification Gate
- Run `npm run build` in AFM. Ensure 0 TypeScript or Vite build errors.
- Ensure the app falls back gracefully when One Tap is offline, without crashing or freezing the file manager.
```
