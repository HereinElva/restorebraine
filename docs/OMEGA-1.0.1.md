# Restorebraine 1.0.1

Single build path. Omega App Store **1.0.1 (3)** architecture plus all fixes since.

## Build (one command)

```bash
cd ~/restorebraine
bash scripts/mac-sync-github.sh
bash scripts/mac-build.sh --no-git
```

Or combined:

```bash
bash scripts/mac-build.sh
```

If iPhone still shows old app:

```bash
bash scripts/mac-build.sh --nuclear
```

## Xcode (complete replace)

1. **Delete app from iPhone** (long-press → Remove App)
2. **Clean Build Folder** (Shift+Cmd+K)
3. **Run** (Cmd+R) — log must show `COMPLETE APP REPLACE` and `Restorebraine DEPLOY OK`
4. **Archive** → Upload

## What's included (1.0.1)

| Feature | Status |
|---------|--------|
| Back to Gallery (no sign-out) | ✓ |
| Sign out only via Sign Out button | ✓ |
| Stay logged in (native persistence) | ✓ |
| Launch screen (logo + gradient) | ✓ |
| Folders: Organize, Custom, Duplicates, Select | ✓ |
| Login: Google, Apple, Microsoft, email | ✓ |
| Xcode full replace every build | ✓ |

## Three copies explained

| Copy | Role | Sync |
|------|------|------|
| **GitHub** | Source of truth | `mac-sync-github.sh` |
| **Capacitor / iPhone** | Bundled full app | `mac-build.sh` |
| **Base44 website** | Optional hosted web | Only needed for `--hosted` mode |

**Default bundled build does not need Base44.** The full app ships inside the iPhone build.

## Modes

| Command | When |
|---------|------|
| `bash scripts/mac-build.sh` | **Default** — full 1.0.1 app on iPhone |
| `bash scripts/mac-build.sh --hosted` | Omega thin shell (needs Base44 live updated) |

## Verify

```bash
node scripts/verify-restorebraine-sync.mjs
bash scripts/verify-xcode-app-bundle.sh
```

## Reference

- App Store build 3: `docs/APPSTORE-BUILD-1.0.1-3.md`
- Omega gallery baseline: tag `omega-v4-core`

## Do not use

Old scripts redirect to `mac-build.sh`. Do not run `mac-ios-v4-deploy.sh` directly.
