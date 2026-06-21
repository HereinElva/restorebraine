# Build Restorebraine 1.0.1

See **[OMEGA-1.0.1.md](./OMEGA-1.0.1.md)** for the full guide.

```bash
cd ~/restorebraine
bash scripts/mac-sync-github.sh
bash scripts/mac-build.sh --no-git
```

Xcode: delete app from iPhone → Clean → Run → Archive.

Log must show: `COMPLETE APP REPLACE` + `Restorebraine DEPLOY OK`.
