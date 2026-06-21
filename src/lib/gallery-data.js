import { base44 } from '@/api/base44Client';
import { ensureClientSessionToken } from '@/lib/session-bootstrap';

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

export async function fetchGalleryFolders(email) {
  ensureClientSessionToken();
  const me = email ? { email } : await base44.auth.me();
  if (!me?.email) return { me: null, folders: [] };
  const result = await base44.entities.Folder.list('-created_date', 200);
  const folders = (result || []).filter((f) => !f.created_by || f.created_by === me.email);
  return { me, folders };
}

export async function loadGalleryData(queryClient) {
  ensureClientSessionToken();
  const { me, photos } = await fetchGalleryPhotos();
  if (me?.email) {
    queryClient.setQueryData(['current-user'], me);
    queryClient.setQueryData(['photos', me.email], photos);
    const { folders } = await fetchGalleryFolders(me.email);
    queryClient.setQueryData(['folders', me.email], folders);
  }
  return { me, photos };
}
