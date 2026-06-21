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
import { isWeakMetadata } from "@/lib/media-tags";
import { formatLLMError } from "@/lib/invoke-llm-retry";
import {
  getGalleryOrganizeSnapshot,
  getUnorganizedPhotos,
} from "@/lib/gallery-organize-snapshot";
import { runMediaOrganize } from "@/lib/run-media-organize";
import { ORGANIZE_ICON_CLASS, ORGANIZE_LABEL_CLASS, SQUARE_FOLDER_ACTION_CLASS, SQUARE_FOLDER_ACTION_STYLE } from "./folderActionStyles";

export default function OrganizeButton({ photos, folders: foldersProp, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const [sharpenTags, setSharpenTags] = useState(false);
  const queryClient = useQueryClient();

  const snapshot = getGalleryOrganizeSnapshot();
  const folders = foldersProp ?? snapshot.folders;
  const unorganized = getUnorganizedPhotos(photos, folders);
  const unorganizedCount = unorganized.length;
  const weakInBatch = unorganized.filter(isWeakMetadata).length;

  const handleOrganize = async () => {
    if (photos.length < 1) {
      alert("Add photos before organizing.");
      return;
    }

    if (!includeOrganized && unorganizedCount === 0) {
      alert(
        "No loose photos in your gallery right now. Only photos showing in Recents (not already in a folder) get sorted. Check \"Re-organize everything\" to re-sort all media."
      );
      return;
    }

    setShowDialog(false);
    setOrganizing(true);

    try {
      const result = await runMediaOrganize({
        photos,
        folders,
        includeOrganized,
        sharpenTags,
        customInstructions,
      });

      if (!result.ok) {
        alert(result.reason);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });

      if (result.foldersSaved === 0) {
        alert("Could not create folders for your loose photos. Try again in a minute.");
      } else if (result.missed > 0) {
        alert(
          `Done! ${result.totalSaved} of ${result.totalToOrganize} loose photos sorted into ${result.foldersSaved} folders. Tap Organize again for any remaining items.`
        );
      } else {
        alert(
          `Done! ${result.totalSaved} loose photo${result.totalSaved !== 1 ? "s" : ""} sorted into ${result.foldersSaved} folder${result.foldersSaved !== 1 ? "s" : ""}.`
        );
      }
    } catch (error) {
      console.error("Error organizing:", error);
      alert(formatLLMError(error));
    } finally {
      setOrganizing(false);
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
            {organizing ? "Organizing..." : "Organize"}
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
              <FolderPlus className="w-4 h-4" />
              Organize
            </>
          )}
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organize Media</DialogTitle>
            <DialogDescription>
              {unorganizedCount > 0
                ? `Sort ${unorganizedCount} loose photo${unorganizedCount !== 1 ? "s" : ""} and video${unorganizedCount !== 1 ? "s" : ""} from Recents into folders. AI reads each item's visual description to group similar subjects together. Photos already in folders are skipped.`
                : "Sort loose media from Recents into folders by visual content. Photos already in folders are skipped."}
              {weakInBatch > 0 && unorganizedCount > 0 && (
                <span className="block mt-1 text-purple-600">
                  {weakInBatch} item{weakInBatch !== 1 ? "s have" : " has"} vague descriptions — AI will re-read {weakInBatch === 1 ? "it" : "them"} from the image before sorting.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
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
              />
              <p className="text-xs text-gray-500">
                Custom instructions override default grouping — e.g. separate vacations, group all pets, sort by date.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sharpen-tags"
                checked={sharpenTags}
                onCheckedChange={setSharpenTags}
              />
              <Label htmlFor="sharpen-tags" className="text-sm font-normal cursor-pointer">
                Re-read every loose photo from the image before sorting (most accurate, slowest)
              </Label>
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
