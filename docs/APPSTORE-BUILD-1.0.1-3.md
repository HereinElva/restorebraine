# App Store Connect reference: 1.0.1 (3)

Known-good upload from **Jun 9, 2026** (App Store Connect → Build Metadata).

| Field | Value |
|-------|--------|
| **Marketing version** | 1.0.1 |
| **Build number (Apple)** | 3 |
| **Bundle ID** | `com.restorebraine.app` |
| **Binary state** | Validated |
| **Compressed size** | ~5.29 MB |
| **Upload date** | Jun 9, 2026 |

## Git reference

| Item | Value |
|------|--------|
| **Commit** | `456770c` — *Fix iOS App Store icon: replace Base44 placeholder with branded search icon* |
| **Tag** | `appstore-1.0.1-build3` |
| **Internal deploy stamp at upload** | `kbrown native v67` |

```bash
git show appstore-1.0.1-build3:ios/App/App/capacitor.config.json
```

## What made this build work

**Hosted WebView** — the native app was a thin Capacitor shell:

```json
"server": {
  "url": "https://restorebraine.base44.app"
}
```

- No `capacitor://localhost` bundled login
- No custom OAuth bridge fighting Google
- Login = whatever runs on the live Base44 site (same as Safari)
- `main.jsx` was a simple React bootstrap (no bundled-native split)

This is the same architecture as **Omega** (`omega` tag) and **`mac-appstore-deploy.sh`**.

## What changed after build 3 (broke TestFlight login)

| After build 3 | Problem |
|---------------|---------|
| Bundled `capacitor://localhost` deploys | Login buttons stopped working |
| `mac-ios-v4-deploy` / `mac-capacitor-web-sync` as default | Wrong mode uploaded to Apple Developer |
| Complex v4 OAuth bridge | Google passkey / WebView errors |

## Reconstruct for a new App Store upload

You do **not** need to revert UI to v67. Keep gallery fixes, NativeLoginCard, launch screen — only the **shell mode** must match build 3.

```bash
bash scripts/mac-reconstruct-appstore.sh
bash scripts/mac-pre-upload-checklist.sh
```

Then Xcode → **Clean Build Folder** → **Archive** → Upload.

Build number will be **179+** (Apple requires incrementing). That is correct — you are reconstructing the **architecture**, not re-uploading build 3.

## Verify on device before Archive

Purple debug badge should show:

- **mode:** `native-hosted`
- **origin:** `https://restorebraine.base44.app`

NOT `v4-core` or `capacitor://localhost`.

## Compare to current branch

| Build 3 (456770c) | Current (v178+) |
|-------------------|-----------------|
| Hosted WebView | ✅ `mac-appstore-deploy.sh` restores this |
| Simple Sign In → platform login | NativeLoginCard (via Base44 publish) |
| No bundled native mode | Bundled mode exists for **dev only** |
| CFBundleVersion 3 | CFBundleVersion 179+ (required for new upload) |
