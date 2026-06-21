# Build Restorebraine — one Terminal command

No Base44 paste. No wizard. No Safari checks.

## Build (recommended)

```bash
cd ~/restorebraine
git pull origin cursor/fix-native-localhost-oauth-bacf
bash scripts/mac-build.sh
```

That one command:

1. Syncs git
2. Wipes old build cache
3. Rebuilds the **entire** app into `ios/App/App/public/`
4. Opens Xcode

## Xcode (3 steps only)

1. **Clean Build Folder** (Shift+Cmd+K)
2. **Run** on iPhone (Cmd+R) — log must show `FULL REPLACE` and `Restorebraine DEPLOY OK`
3. **Archive** → Upload

## What `mac-build.sh` does

| Mode | Command | Result |
|------|---------|--------|
| **Bundled** (default) | `bash scripts/mac-build.sh` | Full v178 app on iPhone — login, gallery, everything from git. **No Base44 needed.** |
| **Hosted** (Omega) | `bash scripts/mac-build.sh --hosted` | Thin shell loads live `restorebraine.base44.app` — same as App Store build 1.0.1 (3) |

Use **bundled** when Base44 publish is stuck. Use **hosted** when Base44 live site is updated.

## Verify after Run

```bash
bash scripts/verify-xcode-app-bundle.sh
```

## Omega / App Store reference

App Store build **1.0.1 (3)** used hosted mode. See `docs/APPSTORE-BUILD-1.0.1-3.md`.

Bundled mode is the fallback when Base44 live site won't update — full app ships inside the iPhone build.

## Do not use

```bash
bash scripts/mac-ios-v4-deploy.sh      # old dev script — use mac-build.sh
bash scripts/base44-copy-one.sh        # only if you need to update the website
```
