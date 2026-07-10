/** React Query keys for gallery data — keep email resolution consistent everywhere. */
export function getGalleryUserEmail(queryClient, authUserEmail) {
  const cached = queryClient.getQueryData(['current-user']);
  return cached?.email || authUserEmail || 'pending';
}

export function galleryFoldersKey(email) {
  return ['folders', email ?? 'pending'];
}

export function galleryPhotosKey(email) {
  return ['photos', email ?? 'pending'];
}
