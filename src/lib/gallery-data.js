import { base44 } from '@/api/base44Client';
import { ensureClientSessionToken } from '@/lib/session-bootstrap';
import { withTimeout } from '@/lib/invoke-llm-retry';
import {
  fetchGalleryFoldersWithMembership,
  mergeApiFoldersWithLocal,
} from '@/lib/folder-membership';
import { loadFullFolderSnapshotAsync, loadFolderSnapshotCacheSync } from '@/lib/folder-membership-cache';
import {
  loadGalleryPhotosCacheSync,
  persistGalleryPhotos,
  persistGalleryPhotosSync,
  persistGalleryUserSync,
} from '@/lib/gallery-photos-cache';

const GALLERY_AUTH_TIMEOUT_MS = 8000;
const GALLERY_PHOTOS_TIMEOUT_MS = 18000;
const GALLERY_FOLDERS_TIMEOUT_MS = 15000;

export async function fetchGalleryUser() {
  ensureClientSessionToken();
  return withTimeout(base44.auth.me(), GALLERY_AUTH_TIMEOUT_MS, 'Auth');
}

export async function fetchGalleryPhotos(email) {
  ensureClientSessionToken();
  const me = email ? { email } : await fetchGalleryUser();
  if (!me?.email) return { me: null, photos: [] };

  try {
    const photos = await withTimeout(
      base44.entities.Photo.filter({ created_by: me.email }, '-created_date'),
      GALLERY_PHOTOS_TIMEOUT_MS,
      'Photos',
    );
    const list = photos || [];
    persistGalleryUserSync(me);
    persistGalleryPhotosSync(me.email, list);
    void persistGalleryPhotos(me.email, list);
    return { me, photos: list };
  } catch (error) {
    const cached = loadGalleryPhotosCacheSync(me.email);
    if (cached.length) {
      console.warn('Photo fetch failed, using cache:', error);
      return { me, photos: cached };
    }
    throw error;
  }
}

export async function fetchGalleryFolders(email, photos = []) {
  ensureClientSessionToken();
  const me = email ? { email } : await fetchGalleryUser();
  if (!me?.email) return { me: null, folders: [] };

  try {
    const snapshot = await loadFullFolderSnapshotAsync(me.email);
    const folders = await withTimeout(
      fetchGalleryFoldersWithMembership(me.email, photos),
      GALLERY_FOLDERS_TIMEOUT_MS,
      'Folders',
    );
    return { me, folders: mergeApiFoldersWithLocal(folders, snapshot) };
  } catch (error) {
    const snapshot = loadFolderSnapshotCacheSync(me.email);
    if (snapshot.length) {
      console.warn('Folder fetch failed, using cache:', error);
      return { me, folders: snapshot };
    }
    throw error;
  }
}

export async function loadGalleryData(queryClient) {
  ensureClientSessionToken();
  const { me, photos } = await fetchGalleryPhotos();
  if (me?.email) {
    queryClient.setQueryData(['current-user'], me);
    queryClient.setQueryData(['photos', me.email], photos);
    const snapshotSync = loadFolderSnapshotCacheSync(me.email);
    const { folders } = await fetchGalleryFolders(me.email, photos);
    queryClient.setQueryData(['folders', me.email], (prev) =>
      mergeApiFoldersWithLocal(mergeApiFoldersWithLocal(folders, prev ?? []), snapshotSync),
    );
  }
  return { me, photos };
}
