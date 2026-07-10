# Omega 3 — bundled iOS reference (v261)

Known-good Restorebraine **bundled** build — organize, folder persistence, and gallery refresh all working.

| Item | Value |
|------|--------|
| **Git tag** | `omega-3` |
| **Branch** | `cursor/fix-organize-partial-save-bacf` |
| **Commit** | `8fc6d2c` |
| **Build** | v261 |
| **Deploy stamp** | `kbrown v4-core v261 · 2026-06-21 23:31` |
| **PR** | https://github.com/HereinElva/restorebraine/pull/14 |

## What this Omega includes

1. **Organize batch sorting** — up to 20 loose photos per tap; tap again to continue
2. **Folder persistence** — folders survive app close, reopen, and pull-to-refresh (sync localStorage snapshot + API merge)
3. **Multi-round organize** — second and later batches complete without stalling on "Finishing…"
4. **Clear success alerts** — e.g. "Saved 20 photos — now 9 folders (1 new). 72 still loose…"
5. **Pull-to-refresh** — spinner always clears (6s safety timeout + refetch with 8s cap)
6. **Organize button UI** — fixed tile height during progress; idle icon/text matches other action buttons
7. **All Omega 2 features** — upload, gallery tabs, Back to Gallery, native OAuth, etc.

## Restore to Omega 3

```bash
cd ~/restorebraine
git fetch origin --tags
git checkout cursor/fix-organize-partial-save-bacf
git reset --hard omega-3
bash build-iphone.sh --no-git
```

Xcode: delete app → Clean Build Folder → Run. Confirm **v261** in deploy stamp.

## Hard reset to tag only

```bash
git fetch origin --tags
git reset --hard omega-3
```

## Relation to other Omega tags

| Tag | Role |
|-----|------|
| `omega-v4-core` | Gallery/folder **UI baseline** (v80) — protected by `verify-omega-baseline.mjs` |
| `omega-2` | Bundled snapshot (v217) — upload + local organize, pre-persistence fixes |
| **`omega-3`** | **Current bundled snapshot (v261)** — organize persistence + multi-batch + refresh fixes |

**Omega 3 is the recommended restore point for bundled iPhone builds.**
