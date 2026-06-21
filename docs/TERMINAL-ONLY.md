# Terminal-only — Base44 publish (no Safari, no guessing)

Every step is a Terminal command. Base44 is only: **open file → Cmd+A → Cmd+V → Save**.

## Start

```bash
cd ~/restorebraine
git pull origin cursor/fix-native-localhost-oauth-bacf
bash scripts/base44-copy-one.sh --reset
```

## Repeat 35 times

```bash
bash scripts/base44-copy-one.sh
```

Each run:
1. Copies **one file** to clipboard
2. Terminal prints the **exact Base44 path**
3. You paste and Save in Base44
4. Run the same command again for the next file

Check progress anytime:

```bash
bash scripts/base44-copy-one.sh --status
```

## After file 35

Click **Publish** in Base44. Wait 60 seconds.

## Check result (Terminal only — no Safari)

```bash
bash scripts/base44-check-live.sh
```

- **PASS** → run native:
  ```bash
  bash scripts/mac-resync-omega.sh --native-only
  ```
- **FAIL** → run `bash scripts/base44-copy-one.sh --reset` and do all 35 again, then Publish.

## Resume if you stopped at file 12

```bash
bash scripts/base44-copy-one.sh 12
bash scripts/base44-copy-one.sh
bash scripts/base44-copy-one.sh
# ... until done
```

## All commands in order

| Step | Terminal command |
|------|------------------|
| 1 | `cd ~/restorebraine` |
| 2 | `git pull origin cursor/fix-native-localhost-oauth-bacf` |
| 3 | `bash scripts/base44-copy-one.sh --reset` |
| 4–38 | `bash scripts/base44-copy-one.sh` (35 times, paste+save each time) |
| 39 | Click **Publish** in Base44 |
| 40 | `bash scripts/base44-check-live.sh` |
| 41 | `bash scripts/mac-resync-omega.sh --native-only` (if PASS) |
