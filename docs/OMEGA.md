# Omega baseline (v55)

**Tag:** `omega` (commit `3988888`)  
**Build stamp:** `kbrown native v55 · 2026-05-31 08:26`

Use this as the known-good reference when login worked and only sign-out UI needed polish.

## What worked in Omega

- Login via OAuth persisted correctly
- Hosted app model (`server.url` → `https://restorebraine.base44.app`)
- Base44 platform login redirect blocked
- One-tap sign-out cleared session (but showed native overlay instead of regular login page)

## Revert to Omega

```bash
cd /Users/ari/Desktop/restorebraine
git fetch origin --tags
git checkout omega
bash scripts/mac-ios-setup.sh
```

Or without detaching:

```bash
git fetch origin cursor/fix-native-xcode-coding-bacf
git reset --hard omega
bash scripts/mac-ios-setup.sh
```

## After Omega (v56+)

- Sign-out returns to the regular in-app login page (not the native overlay)
- Home screen app icon fixes (`CFBundleIconName`, icon regen verification)
