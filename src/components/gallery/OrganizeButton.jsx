import React, { useState, useEffect, useRef } from "react";
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
  loosePhotosForOrganize,
  setGalleryOrganizeSnapshot,
} from "@/lib/gallery-organize-snapshot";
import { persistGalleryFoldersFast, persistGalleryFoldersSync } from "@/lib/folder-membership-cache";
import { mergeApiFoldersWithLocal } from "@/lib/folder-membership";
import { getGalleryUserEmail, galleryFoldersKey, galleryPhotosKey } from "@/lib/gallery-query-keys";
import { runMediaOrganize } from "@/lib/run-media-organize";
import { ORGANIZE_BATCH_SIZE, TARGET_FOLDERS_PER_RUN } from "@/lib/media-organize";
import { ORGANIZE_ICON_CLASS, ORGANIZE_LABEL_CLASS, SQUARE_FOLDER_ACTION_CLASS, SQUARE_FOLDER_ACTION_STYLE } from "./folderActionStyles";

const ORGANIZE_UI_RESET_MS = 75000;

function truncateProgress(text, max = 16) {
  if (!text || text.length <= max) return text || "Organizing...";
  return `${text.slice(0, max - 1)}…`;
}

function organizeResultMessage({
  totalSaved,
  totalToOrganize,
  missed,
  remainingLoose,
  totalFolders,
  newFolderCount,
}) {
  if (totalSaved <= 0) {
    return "Organize could not save photos into folders. Pull down to refresh, then try again.";
  }

  const folderDesc =
    newFolderCount > 0
      ? `${totalFolders} folders (${newFolderCount} new)`
      : `${totalFolders} folders`;

  if (remainingLoose > 0) {
    return `Saved ${totalSaved} photo${totalSaved !== 1 ? "s" : ""} — now ${folderDesc}. ${remainingLoose} still loose — tap Organize again to continue.`;
  }
  if (missed > 0) {
    return `Done! ${totalSaved} of ${totalToOrganize} loose photos sorted — ${folderDesc}. Tap Organize again for the ${missed} remaining.`;
  }
  return `Done! ${totalSaved} loose photo${totalSaved !== 1 ? "s" : ""} sorted — ${folderDesc}.`;
}

export default function OrganizeButton({ photos, folders: foldersProp, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const organizeInFlight = useRef(false);

  const snapshot = getGalleryOrganizeSnapshot();
  const folders = foldersProp ?? snapshot.folders;
  const unorganizedCount = loosePhotosForOrganize(photos, folders).length;

  useEffect(() => {
    const resetOrganizing = () => {
      organizeInFlight.current = false;
      setOrganizing(false);
      setProgressLabel("");
    };
    window.addEventListener("restorebraine-gallery-refresh", resetOrganizing);
    return () => {
      window.removeEventListener("restorebraine-gallery-refresh", resetOrganizing);
      organizeInFlight.current = false;
    };
  }, []);

  const handleOrganize = async () => {
    if (organizeInFlight.current) return;

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
    organizeInFlight.current = true;
    setOrganizing(true);
    setProgressLabel("Starting…");

    const folderIdsBefore = new Set((folders || []).map((f) => f.id));
    const resetUi = () => {
      organizeInFlight.current = false;
      setOrganizing(false);
      setProgressLabel("");
    };
    const uiWatchdog = window.setTimeout(() => {
      resetUi();
      alert("Organize took too long and was reset. Try again.");
    }, ORGANIZE_UI_RESET_MS);

    try {
      const email = getGalleryUserEmail(queryClient, authUser?.email);

      const result = await runMediaOrganize({
        photos,
        folders,
        includeOrganized,
        customInstructions,
        onProgress: setProgressLabel,
        onPartialSave: (partialFolders) => {
          const existing = queryClient.getQueryData(galleryFoldersKey(email)) ?? [];
          const verified = foldersForGalleryView(
            mergeApiFoldersWithLocal(partialFolders, existing),
            photos,
          );
          queryClient.setQueryData(galleryFoldersKey(email), verified);
          setGalleryOrganizeSnapshot({ photos, folders: verified });
        },
        userEmail: email,
      });

      if (!result.ok) {
        alert(result.reason);
        return;
      }

      const syncedPhotos = queryClient.getQueryData(galleryPhotosKey(email)) ?? photos;
      const existingFolders = queryClient.getQueryData(galleryFoldersKey(email)) ?? [];

      const verifiedFolders = foldersForGalleryView(
        mergeApiFoldersWithLocal(result.afterFolders || [], existingFolders),
        syncedPhotos,
      );
      queryClient.setQueryData(galleryFoldersKey(email), verifiedFolders);
      setGalleryOrganizeSnapshot({ photos: syncedPhotos, folders: verifiedFolders });

      if (email && verifiedFolders.length > 0) {
        persistGalleryFoldersSync(email, verifiedFolders);
        persistGalleryFoldersFast(email, verifiedFolders);
      }

      const newFolderCount = verifiedFolders.filter((f) => !folderIdsBefore.has(f.id)).length;

      alert(
        organizeResultMessage({
          totalSaved: result.totalSaved,
          totalToOrganize: result.totalToOrganize,
          missed: result.missed,
          remainingLoose: result.remainingLoose ?? 0,
          totalFolders: verifiedFolders.length,
          newFolderCount,
        }),
      );
    } catch (error) {
      console.error("Error organizing:", error);
      alert(formatLLMError(error));
    } finally {
      window.clearTimeout(uiWatchdog);
      resetUi();
    }
  };

  return (
    <>
      {squareStyle ? (
        <button
          type="button"
          data-rb-folder-action="organize"
          data-rb-organizing={organizing ? "true" : undefined}
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

            {unorganizedCount > ORGANIZE_BATCH_SIZE && !includeOrganized && (
              <p className="text-xs text-gray-500 ml-1">
                Organize sorts up to {ORGANIZE_BATCH_SIZE} loose photos into {TARGET_FOLDERS_PER_RUN} folders per run. Tap again to continue.
              </p>
            )}

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
