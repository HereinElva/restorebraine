import { base44 } from '@/api/base44Client';
import { ensureClientSessionToken } from '@/lib/session-bootstrap';
import {
  fetchGalleryFoldersWithMembership,
  mergeApiFoldersWithLocal,
} from '@/lib/folder-membership';
import { loadFullFolderSnapshotAsync, loadFolderSnapshotCacheSync } from '@/lib/folder-membership-cache';

export async function fetchGalleryUser() {
  ensureClientSessionToken();
  return base44.auth.me();
}

export async function fetchGalleryPhotos(email) {
  ensureClientSessionToken();
  const me = email ? { email } : await base44.auth.me();
  if (!me?.email) return { me: null, photos: [] };
  const photos = await base44.entities.Photo.filter({ created_by: me.email }, '-created_date');
  return { me, photos: photos || [] };
}

export async function fetchGalleryFolders(email, photos = []) {
  ensureClientSessionToken();
  const me = email ? { email } : await base44.auth.me();
  if (!me?.email) return { me: null, folders: [] };
  const snapshot = await loadFullFolderSnapshotAsync(me.email);
  const folders = await fetchGalleryFoldersWithMembership(me.email, photos);
  return { me, folders: mergeApiFoldersWithLocal(folders, snapshot) };
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
