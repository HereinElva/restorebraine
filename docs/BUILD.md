# Build Restorebraine — one Terminal command

## If Mac feels disconnected from GitHub

Run these **in order** (copy each line):

```bash
cd ~/restorebraine
```

```bash
git fetch https://github.com/HereinElva/restorebraine.git cursor/fix-native-localhost-oauth-bacf
```

```bash
git checkout -B cursor/fix-native-localhost-oauth-bacf FETCH_HEAD
```

```bash
git reset --hard FETCH_HEAD
```

```bash
ls scripts/mac-build.sh
```

If `mac-build.sh` shows up, Mac matches GitHub. Then:

```bash
bash scripts/mac-build.sh --no-git
```

After the next sync, use: `bash scripts/mac-sync-github.sh` (does the same thing).

## Three separate copies (this is the confusion)

| Copy | What it is | How it updates |
|------|------------|----------------|
| **GitHub** | Source code | We push from cloud agent |
| **Your Mac** | Local repo + Xcode | `mac-sync-github.sh` |
| **Base44 website** | Hosted web app | Manual paste (optional — **not needed for iPhone build**) |

**iPhone build uses your Mac/git only.** Base44 can stay on v162 — bundled build still gets v178.

## Build (after sync)

```bash
bash scripts/mac-build.sh
```

Xcode: **Clean → Run → Archive**


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
