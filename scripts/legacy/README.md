# Deprecated scripts

These scripts now redirect to the single build path:

```bash
bash scripts/mac-sync-github.sh   # Mac ← GitHub
bash scripts/mac-build.sh         # full iPhone rebuild + Xcode replace
```

| Old script | Redirects to |
|------------|--------------|
| mac-ios-v4-deploy.sh | mac-build.sh |
| mac-capacitor-web-sync.sh | mac-build.sh --bundled --no-git |
| mac-appstore-deploy.sh | mac-build.sh --hosted |
| mac-resync-omega.sh | mac-build.sh |
| mac-nuclear-scrub.sh | mac-build.sh --nuclear |
| mac-start-fresh.sh | mac-build.sh |

Base44 paste scripts (wizard, copy-one) are optional — only for updating the website.
Bundled iPhone builds do not require Base44.
