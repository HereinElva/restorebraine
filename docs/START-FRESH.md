# Start fresh — one command

**Stop using Base44 paste workflows.** Use this:

```bash
cd ~/restorebraine
git pull origin cursor/fix-native-localhost-oauth-bacf
bash scripts/mac-build.sh
```

Xcode: **Clean → Run → Archive**

Full guide: [BUILD.md](./BUILD.md)

## What this replaces

| Old (broken) | New |
|--------------|-----|
| 35-file Base44 wizard | Not needed for iPhone build |
| `mac-resync-omega.sh` | `mac-build.sh` |
| `mac-start-fresh.sh` | `mac-build.sh` |

## Modes

```bash
bash scripts/mac-build.sh              # bundled — full v178 on iPhone (default)
bash scripts/mac-build.sh --hosted     # Omega — loads live Base44 site
```

Bundled = entire app from git, no Base44 dependency.

Hosted = App Store 1.0.1 (3) architecture — login comes from live website.
