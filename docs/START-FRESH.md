# Start fresh — one command

**App Store / TestFlight (current): hosted shell + live Base44 UI.**

```bash
cd ~/restorebraine
bash scripts/mac-sync-github.sh
bash scripts/base44-publish-wizard.sh    # if audit-base44-bundle.mjs fails
node scripts/audit-base44-bundle.mjs       # must PASS
bash scripts/mac-build.sh --hosted --no-git
```

Xcode: **Delete app from iPhone → Clean → Run → Archive**

Full guide: [RELEASE-PIPELINE.md](./RELEASE-PIPELINE.md)

## What this replaces

| Old (broken) | New |
|--------------|-----|
| `mac-recover-v4.sh` / `fix-native-localhost-oauth-bacf` | `mac-sync-github.sh` on `fix-folder-persistence-bacf` |
| `mac-apple-login-bundled.sh` for App Store | `mac-build.sh --hosted` |
| `mac-start-fresh.sh` (bundled default) | `mac-build.sh --hosted` |

## Modes

```bash
bash scripts/mac-build.sh --hosted       # App Store / TestFlight (recommended)
bash scripts/mac-build.sh --bundled      # dev only — full app in ios/public
```

**Hosted** = Capacitor loads `https://restorebraine.base44.app` — folder + Stripe fixes require Base44 Publish.

**Bundled** = `capacitor://localhost` — ignores Base44; use only for local Apple login experiments.
