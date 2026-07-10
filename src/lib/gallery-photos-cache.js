import { persistentStorage } from '@/lib/persistentStorage';

const SNAPSHOT_KEY_PREFIX = 'restorebraine_photo_snapshot:';
const USER_EMAIL_KEY = 'restorebraine_gallery_user_email';
const USER_SNAPSHOT_KEY = 'restorebraine_gallery_user_snapshot';

function snapshotKey(email) {
  return `${SNAPSHOT_KEY_PREFIX}${email || 'unknown'}`;
}

function slimPhotoSnapshot(photos) {
  return (photos || []).map((p) => ({
    id: p.id,
    file_url: p.file_url,
    file_type: p.file_type,
    ai_description: p.ai_description,
    ai_tags: p.ai_tags || [],
    original_filename: p.original_filename,
    upload_date: p.upload_date,
    created_by: p.created_by,
    created_date: p.created_date,
  }));
}

export function loadGalleryUserEmailSync() {
  try {
    const raw = persistentStorage.getSync(USER_EMAIL_KEY);
    return raw && raw.includes('@') ? raw : null;
  } catch {
    return null;
  }
}

export function loadGalleryUserSnapshotSync() {
  try {
    const raw = persistentStorage.getSync(USER_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function persistGalleryUserSync(user) {
  if (!user?.email) return;
  try {
    persistentStorage._mirror(USER_EMAIL_KEY, user.email);
    persistentStorage._mirror(USER_SNAPSHOT_KEY, JSON.stringify({ email: user.email, ...user }));
  } catch {
    /* ignore quota errors */
  }
}

export function loadGalleryPhotosCacheSync(email) {
  if (!email) return [];
  try {
    const raw = persistentStorage.getSync(snapshotKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function loadGalleryPhotosCacheAsync(email) {
  const fromSync = loadGalleryPhotosCacheSync(email);
  if (!email) return fromSync;
  try {
    const raw = await persistentStorage.get(snapshotKey(email));
    if (!raw) return fromSync;
    const parsed = JSON.parse(raw);
    const fromAsync = Array.isArray(parsed) ? parsed : [];
    return fromAsync.length >= fromSync.length ? fromAsync : fromSync;
  } catch {
    return fromSync;
  }
}

export function persistGalleryPhotosSync(email, photos) {
  if (!email || !photos?.length) return;
  try {
    persistentStorage._mirror(snapshotKey(email), JSON.stringify(slimPhotoSnapshot(photos)));
  } catch {
    /* ignore quota errors */
  }
}

export async function persistGalleryPhotos(email, photos) {
  if (!email || !photos?.length) return;
  persistGalleryPhotosSync(email, photos);
  await persistentStorage.set(snapshotKey(email), JSON.stringify(slimPhotoSnapshot(photos)));
}
