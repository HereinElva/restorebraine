import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const build = readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

console.log(`
Base44 does NOT auto-update from GitHub. After git pull + npm run build, you must Publish in Base44.

1. Open https://app.base44.com → Restorebraine → Code editor
2. Sync or paste updated files from your Mac repo (minimum set):
   - src/index.css
   - src/components/gallery/MobileGallery.jsx
   - src/components/gallery/OrganizeButton.jsx
   - src/components/gallery/CustomFolderButton.jsx
   - src/components/gallery/DuplicateDetector.jsx
   - src/components/gallery/folderActionStyles.js
   - src/deploy-marker.js
3. Click Publish (top right)
4. Verify live site HTML references a NEW asset hash (not index-BmFZls3B.js)
5. Expected deploy stamp: v${build}

iOS native app loads restorebraine.base44.app — until Publish, the app keeps the old UI.

Quick test without Base44: npm run build:native-local → Xcode Run
`);
