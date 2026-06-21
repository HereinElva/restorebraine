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
import { runMediaOrganize } from "@/lib/run-media-organize";
import { ORGANIZE_ICON_CLASS, ORGANIZE_LABEL_CLASS, SQUARE_FOLDER_ACTION_CLASS, SQUARE_FOLDER_ACTION_STYLE } from "./folderActionStyles";

export default function OrganizeButton({ photos, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const [sharpenTags, setSharpenTags] = useState(false);
  const queryClient = useQueryClient();

  const weakCount = photos.filter(isWeakMetadata).length;

  const handleOrganize = async () => {
    if (photos.length < 1) {
      alert("Add photos before organizing.");
      return;
    }

    setShowDialog(false);
    setOrganizing(true);

    try {
      const result = await runMediaOrganize({
        photos,
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
        alert("No groups found to organize.");
      } else if (result.missed > 0) {
        alert(
          `Done! ${result.totalSaved} of ${result.totalToOrganize} items organized into ${result.foldersSaved} folders. ${result.missed} items had no clear group — press Organize again to retry.`
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
              Sorts every unsorted photo and video from Recents into folders. Items already in folders are left in place.
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
                    .match(/\b(consolidate|merge|combine|take all folders|move folders|reorganize folders)\b/);
                  if (needsOrganized && !includeOrganized) setIncludeOrganized(true);
                }}
                className="min-h-[100px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sharpen-tags"
                checked={sharpenTags}
                onCheckedChange={setSharpenTags}
              />
              <Label htmlFor="sharpen-tags" className="text-sm font-normal cursor-pointer">
                Sharpen visual tags before organizing (slower, uses more AI requests)
                {weakCount > 0 && (
                  <span className="text-gray-500 ml-1">({weakCount} item{weakCount !== 1 ? "s" : ""} need better tags)</span>
                )}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-organized"
                checked={includeOrganized}
                onCheckedChange={setIncludeOrganized}
              />
              <Label htmlFor="include-organized" className="text-sm font-normal cursor-pointer">
                Re-organize everything — consolidate all existing folders and re-sort all media from scratch.
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
