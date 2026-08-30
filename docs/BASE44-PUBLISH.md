# Base44 Publish — simple steps

**Do not open the giant `base44-publish-v*.txt` file.** Use the wizard instead.

## Before you start

1. Open **Base44** → **Restorebraine** → **Code editor**
2. Keep Base44 open next to Terminal
3. **Do not click Publish** until all 35 files are saved

## Run the wizard (recommended)

```bash
cd ~/restorebraine
bash scripts/base44-publish-wizard.sh
```

The wizard:

1. Copies **one file** to your clipboard
2. Tells you which path to open in Base44 (e.g. `src/Layout.jsx`)
3. You **Select All → Paste → Save** in Base44
4. Press **Enter** in Terminal for the next file

Repeat until all **35 files** are done, then click **Publish once**.

### Resume if you stop partway

```bash
bash scripts/base44-publish-wizard.sh 12   # start at file 12
bash scripts/base44-publish-wizard.sh --list   # show checklist
```

## The 35 files (3 groups)

| Part | Files | What |
|------|-------|------|
| **1** | 1–12 | Boot, auth, login screen |
| **2** | 13–24 | OAuth, session, native helpers |
| **3** | 25–39 | Gallery, payments, Layout, CSS |

You do **not** need to open `base44-publish-v178.txt`. The wizard uses the same files from your git repo.

## After Publish

```bash
node scripts/verify-base44-live.mjs
```

Must show **OK** and deploy **v178** (not v162).

Safari check: https://restorebraine.base44.app — multi-provider login (Google, Apple, Microsoft, email).

## Then native app

```bash
bash scripts/mac-resync-omega.sh --native-only
open ios/App/App.xcworkspace
```

Clean → Run → Archive.

## One file manually (if you prefer)

```bash
pbcopy < src/Layout.jsx
```

Open `src/Layout.jsx` in Base44 → Select All → Paste → Save.

Special case — `src/lib/native-bundle-mode.js`:

```bash
printf '%s\n' "// Base44 hosted web — must be false" "export const LOCAL_NATIVE_BUNDLE = false;" | pbcopy
```

## Do not

- Paste random snippets from the middle of a long txt file
- Publish after only some files
- Edit Base44 by hand without pasting from git

GitHub is the source of truth. The wizard copies from git, one file at a time.
