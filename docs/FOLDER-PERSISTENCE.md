# Folder persistence across reinstall

## What was wrong

Folders looked permanent on your phone but were often stored in **device cache** (Capacitor Preferences / localStorage). That cache is **wiped when you delete the app**.

Photos survived reinstall because they use `Photo.filter({ created_by: email })` on the server. Folders used unscoped `Folder.list` and often had no `created_by`, so after reinstall the server returned nothing.

## Fix (v294)

1. **`claimOrphanedData` on gallery load** — stamps orphaned folders with your account email
2. **`Folder.filter({ created_by: email })`** — loads only your folders from the server
3. **`created_by` set on every folder create** — custom folders and AI organize
4. **Local cache remains** — fast reload on same device, but server is source of truth

## Base44 publish (paste these files, Publish once)

- `src/lib/folder-server-sync.js` (new)
- `src/lib/folder-membership.js`
- `src/components/gallery/CustomFolderButton.jsx`
- `src/deploy-marker.js`

## After publish

Sign out → sign in → folders should reload from server. Delete/reinstall app → folders should return (same account).

**Note:** Folders created *before* this fix that never saved to the server cannot be recovered after reinstall.
