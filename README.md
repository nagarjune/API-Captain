# API Captain

API Captain is a desktop-first API client and flow runner with workspace-aware collections, request tabs, scripts, environments, and collection runner capabilities.

## Run locally

```bash
npm install
npm run dev
```

Desktop mode:

```bash
npm run dev:desktop
```

Build web bundle:

```bash
npm run build
```

Build desktop installers:

```bash
npm run desktop:build
```

## v0.0.3 Release Notes

This release includes all updates made after `v0.0.2`:

- Restored and pushed full source code structure.
- Workspace-centric data mapping so collections, history, responses, and flows stay scoped per workspace.
- Request builder improvements:
  - multi-tab request editing (Postman-style flow),
  - panel layout controls,
  - improved full-screen fit and row alignment.
- Collections and folders:
  - fixed collection card text overflow,
  - folder tree import support from Postman structures,
  - full context menu support at subfolder level (`New Request`, `New Folder`, `Run`, `Clone`, `Rename`, `Share`, `Generate Docs`, `Collapse`, `Reveal in Finder`, `Settings`, `Open in Terminal`, `Remove`).
- Runner and flows:
  - run setup/results view,
  - success/failure visibility and detailed logs,
  - collection/folder scoped run behavior.
- Settings and preferences:
  - themes behavior fixes and default theme handling,
  - OS-aware keybinding display,
  - support page linked to GitHub only,
  - about page update information.
- Bottom bar and UI refinements:
  - settings moved to bottom controls,
  - improved sidebar scroll behavior.
- Desktop update pipeline:
  - GitHub release update checks,
  - automatic download/install when enabled,
  - `New version available` label beside bottom GitHub icon when auto-updates are disabled.
