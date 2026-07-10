import { mergeApiFoldersWithLocal } from '@/lib/folder-membership';
import { loadFolderSnapshotCacheSync } from '@/lib/folder-membership-cache';
import {
  loadGalleryPhotosCacheSync,
  loadGalleryUserEmailSync,
  loadGalleryUserSnapshotSync,
} from '@/lib/gallery-photos-cache';

/** Instant gallery restore from localStorage — runs before first paint. */
export function hydrateGalleryCacheSync(queryClient) {
  if (!queryClient) return null;

  const cachedUser = loadGalleryUserSnapshotSync();
  const email = cachedUser?.email || loadGalleryUserEmailSync();
  if (!email) return null;

  if (!queryClient.getQueryData(['current-user'])) {
    queryClient.setQueryData(['current-user'], cachedUser || { email });
  }

  const cachedPhotos = loadGalleryPhotosCacheSync(email);
  const existingPhotos = queryClient.getQueryData(['photos', email]);
  if (cachedPhotos.length && (!existingPhotos || !existingPhotos.length)) {
    queryClient.setQueryData(['photos', email], cachedPhotos);
  }

  const cachedFolders = loadFolderSnapshotCacheSync(email);
  if (cachedFolders.length) {
    queryClient.setQueryData(['folders', email], (prev) =>
      mergeApiFoldersWithLocal(prev ?? [], cachedFolders),
    );
  }

  return { email, photos: cachedPhotos, folders: cachedFolders };
}
