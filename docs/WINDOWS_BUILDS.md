# Windows CI builds — v0.1 alpha

The source repository is a **Windows desktop app**, not a Vercel web deployment. The browser animation workshop can be hosted separately at a later stage; the desktop overlay and tray require Tauri/WebView2 on Windows.

## GitHub Actions workflow

Workflow: [Windows desktop build](../.github/workflows/windows-build.yml).

Triggers: pushes to `main`, pull requests, and manual **Actions → Windows desktop build → Run workflow**. Builds execute on `windows-2022` (x64/MSVC).

The job (using committed package-lock.json):
1. Checks out the repository, installs Node 22 and stable Rust for MSVC.
2. Runs `npm ci --no-audit --no-fund` and `npm run check`.
3. Builds the Tauri 2 NSIS installer using `npm run tauri:build -- --bundles nsis`.
4. Verifies **exactly one installer** was produced.
5. Uploads a `zpkdx-desktop-companion-windows-alpha-<run number>` artifact containing the installer, `SHA256SUMS.txt`, and `BUILD_INFO.txt`.

Build artifacts are kept for **14 days**. GitHub Actions upload artifacts are temporary build output, not versioned GitHub Releases. This workflow does **not** publish an official release, tag the repository, or sign the installer.

## Download and test

1. Open the repository **Actions** tab.
2. Select **Windows desktop build**, then choose a run with a green check.
3. Under **Artifacts**, download the `zpkdx-desktop-companion-windows-alpha-...` ZIP.
4. Extract the archive. Check the installer hash on Windows (PowerShell):

```powershell
(Get-FileHash -Algorithm SHA256 -Path .\<installer-name>.exe).Hash
Get-Content .\SHA256SUMS.txt
```

The hashes must match. Because the installer is **unsigned**, Windows SmartScreen may warn about it; only execute binaries you have verified from your own trusted GitHub Actions run. This is a development build, not a public distribution recommendation.

## Local development on Windows 11

Install Node 20+, Microsoft C++ Build Tools (Desktop development with C++), stable Rust MSVC and WebView2. In a fresh clone:

```powershell
npm ci
npm run check
npm run tauri:dev
```

Local installer build:

```powershell
npm run tauri:build -- --bundles nsis
```

Expected output folder: `src-tauri/target/release/bundle/nsis/`.

## Certification remains required

Successful compilation **does not establish** that the transparent overlay works correctly with multiple monitors, fractional DPI, fullscreen games, click-through recovery, or imported skins. Follow [RELEASE_GATES.md](RELEASE_GATES.md) and test the app on the reference Windows 11 / RTX 3050 8 GB PC before labeling the release stable.

The native source has no Ollama agent, AI permissions, screen capture, or window interaction physics yet. The published artifact is an animation/overlay alpha only.

## Runtime certification is separate from compilation

The `Source and browser runtime checks` workflow also exercises the **emitted Vite production bundle in Windows-hosted Chromium**: both views must initialize, texture requests must succeed, the canvas must be larger than 2×2, and the animated pixels/import flow must pass. See the draft recovery PR and [RELEASE_GATES.md](RELEASE_GATES.md) for exact results.

**This is not a native WebView2 clean-install test.** A passing NSIS compile and browser smoke does not establish that the installed window, transparent overlay, tray, native IPC, click-through or GPU behavior works. Preview artifacts are not stable releases.
