import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderPlus, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatLLMError } from "@/lib/invoke-llm-retry";
import { useAuth } from "@/lib/AuthContext";
import {
  foldersForGalleryView,
  getGalleryOrganizeSnapshot,
  getUnorganizedPhotos,
  normalizePhotoId,
  setGalleryOrganizeSnapshot,
} from "@/lib/gallery-organize-snapshot";
import { mergeApiFoldersWithLocal, reconcileOrganizeBatch } from "@/lib/folder-membership";
import { getGalleryUserEmail, galleryFoldersKey, galleryPhotosKey } from "@/lib/gallery-query-keys";
import { loadGalleryData } from "@/lib/gallery-data";
import { runMediaOrganize } from "@/lib/run-media-organize";
import { ORGANIZE_ICON_CLASS, ORGANIZE_LABEL_CLASS, SQUARE_FOLDER_ACTION_CLASS, SQUARE_FOLDER_ACTION_STYLE } from "./folderActionStyles";

function truncateProgress(text, max = 22) {
  if (!text || text.length <= max) return text || "Organizing...";
  return `${text.slice(0, max - 1)}…`;
}

function organizeResultMessage({ totalSaved, totalToOrganize, missed, foldersSaved }) {
  if (totalSaved <= 0) {
    return "Organize could not save photos into folders. Pull down to refresh, then try again.";
  }
  if (missed > 0) {
    return `Done! ${totalSaved} of ${totalToOrganize} loose photos sorted into ${foldersSaved} folders. Tap Organize again for the ${missed} remaining.`;
  }
  return `Done! ${totalSaved} loose photo${totalSaved !== 1 ? "s" : ""} sorted into ${foldersSaved} folder${foldersSaved !== 1 ? "s" : ""}.`;
}

export default function OrganizeButton({ photos, folders: foldersProp, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  const snapshot = getGalleryOrganizeSnapshot();
  const folders = foldersProp ?? snapshot.folders;
  const unorganizedCount = getUnorganizedPhotos(photos, folders).length;

  const handleOrganize = async () => {
    if (photos.length < 1) {
      alert("Add photos before organizing.");
      return;
    }

    if (!includeOrganized && unorganizedCount === 0) {
      alert(
        "No loose photos in your gallery right now. Check \"Re-organize everything\" to re-sort all media."
      );
      return;
    }

    setShowDialog(false);
    setOrganizing(true);
    setProgressLabel("Starting…");

    try {
      const result = await runMediaOrganize({
        photos,
        folders,
        includeOrganized,
        customInstructions,
        onProgress: setProgressLabel,
      });

      if (!result.ok) {
        alert(result.reason);
        return;
      }

      const email = getGalleryUserEmail(queryClient, authUser?.email);
      const freshPhotos = queryClient.getQueryData(galleryPhotosKey(email)) ?? photos;

      if (result.afterFolders?.length) {
        const normalizedFolders = foldersForGalleryView(result.afterFolders, freshPhotos);
        queryClient.setQueryData(galleryFoldersKey(email), normalizedFolders);
        setGalleryOrganizeSnapshot({ photos: freshPhotos, folders: normalizedFolders });
      }

      // Sync from server; merge so a slow API response does not undo Recents clearing
      await loadGalleryData(queryClient);
      const syncedPhotos = queryClient.getQueryData(galleryPhotosKey(email)) ?? freshPhotos;
      let syncedFolders = queryClient.getQueryData(galleryFoldersKey(email)) ?? [];
      let merged = foldersForGalleryView(
        mergeApiFoldersWithLocal(syncedFolders, result.afterFolders || []),
        syncedPhotos,
      );

      const reconciled = await reconcileOrganizeBatch({
        batchPhotos: result.photosToOrganize || [],
        afterFolders: merged,
        labelByPhotoNormId: result.labelByPhotoNormId,
        onProgress: setProgressLabel,
      });
      merged = foldersForGalleryView(reconciled.folders, syncedPhotos);

      queryClient.setQueryData(galleryFoldersKey(email), merged);
      setGalleryOrganizeSnapshot({ photos: syncedPhotos, folders: merged });

      const batchNormIds = new Set(
        (result.photosToOrganize || []).map((p) => normalizePhotoId(p.id)).filter(Boolean),
      );
      const remainingLoose = getUnorganizedPhotos(syncedPhotos, merged).filter((p) =>
        batchNormIds.has(normalizePhotoId(p.id)),
      ).length;
      const totalToOrganize = result.totalToOrganize;
      const totalSaved = totalToOrganize - remainingLoose;
      const missed = remainingLoose;

      alert(
        organizeResultMessage({
          totalSaved,
          totalToOrganize,
          missed,
          foldersSaved: result.foldersSaved,
        }),
      );
    } catch (error) {
      console.error("Error organizing:", error);
      alert(formatLLMError(error));
    } finally {
      setOrganizing(false);
      setProgressLabel("");
    }
  };

  return (
    <>
      {squareStyle ? (
        <button
          type="button"
          data-rb-folder-action="organize"
          onClick={() => setShowDialog(true)}
          disabled={organizing || photos.length < 1}
          className={`relative ${SQUARE_FOLDER_ACTION_CLASS}`}
          style={SQUARE_FOLDER_ACTION_STYLE}
        >
          {organizing ? (
            <Loader2 className={`${ORGANIZE_ICON_CLASS} animate-spin`} />
          ) : (
            <Sparkles className={ORGANIZE_ICON_CLASS} />
          )}
          <span className={ORGANIZE_LABEL_CLASS} data-rb-organize-label>
            {organizing ? truncateProgress(progressLabel) : "Organize"}
          </span>
        </button>
      ) : (
        <Button
          onClick={() => setShowDialog(true)}
          disabled={organizing || photos.length < 1}
          className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white gap-2"
        >
          {organizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Organizing...
            </>
          ) : (
            <>
              <FolderPlus className="w-4 h-4 mr-2" />
              Organize
            </>
          )}
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Organize Media</DialogTitle>
            <DialogDescription className="sr-only">
              Sort loose photos and videos from Recents into folders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="instructions">
                Custom Instructions (Optional)
                {customInstructions && (
                  <span className="ml-2 text-xs text-purple-600 font-semibold">✓ Instructions added</span>
                )}
              </Label>
              <Textarea
                id="instructions"
                placeholder="e.g., 'Group by month and year' or 'Keep vacation photos separate' or 'Put all grass and field photos together'"
                value={customInstructions}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomInstructions(value);
                  const needsOrganized = value
                    .toLowerCase()
                    .match(/\b(consolidate|merge|combine|take all folders|move folders|reorganize folders|re-organize everything)\b/);
                  if (needsOrganized && !includeOrganized) setIncludeOrganized(true);
                }}
                className="min-h-[100px]"
                autoFocus={false}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-organized"
                checked={includeOrganized}
                onCheckedChange={setIncludeOrganized}
              />
              <Label htmlFor="include-organized" className="text-sm font-normal cursor-pointer">
                Re-organize everything — delete existing folders and re-sort all media from scratch.
              </Label>
            </div>

            {includeOrganized && (
              <p className="text-xs text-orange-600 font-medium ml-6">
                ⚠️ This will delete all existing folders and rebuild them. Your photos won&apos;t be deleted.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOrganize}
              className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Auto Organize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
