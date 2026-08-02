# Base44 paste batches — for Base44 in-app AI chat

Base44 AI cannot read your Mac. Paste ONE batch file at a time into Base44 chat.

## Prompt to paste WITH each batch

```
Apply every FILE block below to the Restorebraine code editor.
Write each file at the exact path shown. Do not Publish yet.
```

Then paste the contents of the batch file.

## Batches (in order)

1. `BASE44-BATCH-01-oauth-auth.txt` — 9 files — OAuth + auth (paste first)
2. `BASE44-BATCH-02-app-shell.txt` — 9 files — App shell + signed-out UI
3. `BASE44-BATCH-03-gallery-core.txt` — 7 files — Gallery pages + MobileGallery + Organize
4. `BASE44-BATCH-04-gallery-components.txt` — 10 files — Gallery components (Omega 3 stack)
5. `BASE44-BATCH-05-context-layout-css.txt` — 5 files — Navigation context + CSS (shell files in batch 02)
6. `BASE44-BATCH-06-upload.txt` — 5 files — Upload page + components
7. `BASE44-BATCH-07-media-libs.txt` — 14 files — Media organize + upload libs (Omega 3)
8. `BASE44-BATCH-08-utils-pages.txt` — 12 files — Utils, hooks, remaining pages

Total: 71 files across 8 batches

After batch 8 (or 9): click Publish ONCE in Base44.
Mac: npm run align:watch
