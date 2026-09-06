import { base44 } from '@/api/base44Client';
import { normalizeFolderRecord } from '@/lib/folder-membership';

let claimInFlight = null;

/** Stamp orphaned Folder/Photo records with the signed-in user (server function). */
export async function claimOrphanedUserData() {
  if (claimInFlight) return claimInFlight;
  claimInFlight = base44.functions
    .invoke('claimOrphanedData')
    .then((result) => {
      if (typeof window !== 'undefined') {
        window.__restorebraineFolderClaimStatus = result?.data?.message || 'claim ok';
      }
      return result;
    })
    .catch((error) => {
      const msg = error?.message || String(error);
      console.error('claimOrphanedData failed:', error);
      if (typeof window !== 'undefined') {
        window.__restorebraineFolderClaimStatus = `claim FAILED: ${msg}`;
      }
      return null;
    })
    .finally(() => {
      claimInFlight = null;
    });
  return claimInFlight;
}

/** Load folders scoped to the signed-in user — same pattern as Photo.filter. */
export async function listUserFolders(email, { timeoutMs = 12000 } = {}) {
  if (!email) return [];

  const withTimeout = (promise, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);

  try {
    const filtered = await withTimeout(
      base44.entities.Folder.filter({ created_by: email }, '-created_date', 200),
      'Folder.filter',
    );
    return (filtered || []).map(normalizeFolderRecord);
  } catch (filterError) {
    console.warn('Folder.filter failed, falling back to Folder.list:', filterError);
  }

  try {
    const listed = await withTimeout(
      base44.entities.Folder.list('-created_date', 200),
      'Folder.list',
    );
    return (listed || [])
      .map(normalizeFolderRecord)
      .filter((folder) => !folder.created_by || folder.created_by === email);
  } catch (listError) {
    console.warn('Folder.list failed:', listError);
    return [];
  }
}

export function withFolderOwner(payload, email) {
  if (!email) return payload;
  return { ...payload, created_by: email };
}
