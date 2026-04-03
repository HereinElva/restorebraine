import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role to find ALL orphaned records (no created_by)
  const allPhotos = await base44.asServiceRole.entities.Photo.list('-created_date', 1000);
  const allFolders = await base44.asServiceRole.entities.Folder.list('-created_date', 500);

  const orphanedPhotos = allPhotos.filter(p => !p.created_by);
  const orphanedFolders = allFolders.filter(f => !f.created_by);

  // Stamp them all with the current user's email
  let photosFixed = 0;
  let foldersFixed = 0;

  for (const photo of orphanedPhotos) {
    await base44.asServiceRole.entities.Photo.update(photo.id, { created_by: user.email });
    photosFixed++;
  }

  for (const folder of orphanedFolders) {
    await base44.asServiceRole.entities.Folder.update(folder.id, { created_by: user.email });
    foldersFixed++;
  }

  return Response.json({
    success: true,
    photosFixed,
    foldersFixed,
    message: `Claimed ${photosFixed} photos and ${foldersFixed} folders.`
  });
});