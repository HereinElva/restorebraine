import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
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
import { reanalyzeWeakPhotos } from "@/lib/media-analysis";
import { isWeakMetadata } from "@/lib/media-tags";
import {
  buildFolderOptions,
  buildLabelPrompt,
  buildMergePrompt,
  photoDataForOrganize,
} from "@/lib/media-organize";

const CHUNK_SIZE = 40;
const CONCURRENCY = 4;
const MERGE_CHUNK = 25;

async function runConcurrent(tasks, concurrency) {
  const results = new Array(tasks.length);
  let index = 0;
  async function runNext() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, runNext));
  return results;
}

async function labelChunk(chunk, existingFolderNames, customInstructions) {
  const photoData = chunk.map(photoDataForOrganize);
  const folderOptions = buildFolderOptions(existingFolderNames);

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildLabelPrompt({ photoData, folderOptions, customInstructions }),
    response_json_schema: {
      type: "object",
      properties: {
        labels: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              folder: { type: "string" },
            },
          },
        },
      },
    },
  });

  return result.labels || [];
}

async function mergeGroupBatch(groups, existingFolderNames, customInstructions) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: buildMergePrompt({ groups, existingFolderNames, customInstructions }),
    response_json_schema: {
      type: "object",
      properties: {
        folders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              ids: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  });

  return (result.folders || []).map((f) => ({ name: f.name, ids: f.ids || [] }));
}

async function consolidateGroups(initialGroups, existingFolderNames, customInstructions, onProgress) {
  let groups = initialGroups;
  let pass = 1;

  while (groups.length > MERGE_CHUNK) {
    onProgress(`Phase 2 (pass ${pass}): merging ${groups.length} groups…`);
    const batches = [];
    for (let i = 0; i < groups.length; i += MERGE_CHUNK) {
      batches.push(groups.slice(i, i + MERGE_CHUNK));
    }
    const batchResults = await runConcurrent(
      batches.map((batch) => () => mergeGroupBatch(batch, existingFolderNames, customInstructions)),
      CONCURRENCY
    );
    const merged = new Map();
    for (const batch of batchResults) {
      for (const { name, ids } of batch) {
        const key = name.toLowerCase().trim();
        if (!merged.has(key)) merged.set(key, { name, ids: new Set(ids) });
        else ids.forEach((id) => merged.get(key).ids.add(id));
      }
    }
    groups = Array.from(merged.values()).map((g) => ({ name: g.name, ids: [...g.ids] }));
    pass++;
  }

  onProgress(`Phase 2: final consolidation of ${groups.length} groups…`);
  const finalGroups = await mergeGroupBatch(groups, existingFolderNames, customInstructions);

  const finalMap = new Map();
  for (const { name, ids } of finalGroups) {
    const key = name.toLowerCase().trim();
    if (!finalMap.has(key)) finalMap.set(key, { name, ids: new Set(ids) });
    else ids.forEach((id) => finalMap.get(key).ids.add(id));
  }

  return Array.from(finalMap.values()).map((g) => ({
    name: g.name,
    photo_ids: [...g.ids],
  }));
}

export default function OrganizeButton({ photos, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const [sharpenTags, setSharpenTags] = useState(true);
  const queryClient = useQueryClient();

  const weakCount = photos.filter(isWeakMetadata).length;

  const handleOrganize = async () => {
    if (photos.length < 2) {
      alert("You need at least 2 photos to organize.");
      return;
    }

    setShowDialog(false);
    setOrganizing(true);

    try {
      const existingFolders = await base44.entities.Folder.list();
      const organizedPhotoIds = new Set(existingFolders.flatMap((f) => f.photo_ids || []));
      const existingFolderNames = existingFolders.map((f) => f.name);

      let photosToOrganize = includeOrganized
        ? photos
        : photos.filter((p) => !organizedPhotoIds.has(p.id));

      if (photosToOrganize.length < 2) {
        alert(
          photosToOrganize.length === 0
            ? "All photos are already in folders. Check 'Re-organize everything' to re-sort."
            : "Only 1 loose photo found — need at least 2 to organize."
        );
        setOrganizing(false);
        return;
      }

      if (includeOrganized && existingFolders.length > 0) {
        setProgress(`Clearing ${existingFolders.length} existing folders for re-organization…`);
        await runConcurrent(
          existingFolders.map((f) => () => base44.entities.Folder.delete(f.id)),
          5
        );
      }

      if (sharpenTags) {
        const weakInBatch = photosToOrganize.filter(isWeakMetadata).length;
        if (weakInBatch > 0) {
          setProgress(`Sharpening visual tags for ${weakInBatch} item${weakInBatch !== 1 ? "s" : ""}…`);
          photosToOrganize = await reanalyzeWeakPhotos(photosToOrganize, { onProgress: setProgress });
        }
      }

      const chunks = [];
      for (let i = 0; i < photosToOrganize.length; i += CHUNK_SIZE) {
        chunks.push(photosToOrganize.slice(i, i + CHUNK_SIZE));
      }

      const totalChunks = chunks.length;
      let completedChunks = 0;
      setProgress(
        `Phase 1: labelling ${photosToOrganize.length} item${photosToOrganize.length !== 1 ? "s" : ""} (${totalChunks} batch${totalChunks !== 1 ? "es" : ""})…`
      );

      const labelTasks = chunks.map((chunk) => async () => {
        const labels = await labelChunk(
          chunk,
          includeOrganized ? [] : existingFolderNames,
          customInstructions
        );
        completedChunks++;
        setProgress(`Phase 1: ${completedChunks}/${totalChunks} batches done…`);
        return labels;
      });

      const labelResults = await runConcurrent(labelTasks, CONCURRENCY);
      const allLabels = labelResults.flat();

      const labelledIds = new Set(allLabels.map((l) => l.id));
      for (const photo of photosToOrganize) {
        if (!labelledIds.has(photo.id)) {
          allLabels.push({ id: photo.id, folder: "Miscellaneous" });
        }
      }

      const groupMap = new Map();
      for (const { id, folder } of allLabels) {
        const display = (folder || "Miscellaneous").trim();
        const key = display.toLowerCase();
        if (!groupMap.has(key)) groupMap.set(key, { name: display, ids: new Set() });
        groupMap.get(key).ids.add(id);
      }
      const initialGroups = Array.from(groupMap.values()).map((g) => ({
        name: g.name,
        ids: [...g.ids],
      }));

      const finalFolders = await consolidateGroups(
        initialGroups,
        includeOrganized ? [] : existingFolderNames,
        customInstructions,
        setProgress
      );

      setProgress(`Saving ${finalFolders.length} folders…`);

      const currentFolders = includeOrganized ? [] : existingFolders;

      const seenThisRun = new Set();
      const foldersToSave = [];
      for (const folder of finalFolders) {
        const uniqueIds = (folder.photo_ids || []).filter((id) => {
          if (seenThisRun.has(id)) return false;
          seenThisRun.add(id);
          return true;
        });
        if (uniqueIds.length >= 1) {
          foldersToSave.push({ ...folder, photo_ids: uniqueIds });
        }
      }

      const folderTasks = foldersToSave.map((folder) => async () => {
        const matchingFolder = currentFolders.find(
          (f) => f.name.toLowerCase() === folder.name.toLowerCase()
        );

        if (matchingFolder) {
          const mergedIds = [...new Set([...(matchingFolder.photo_ids || []), ...folder.photo_ids])];
          const coverPhoto =
            !matchingFolder.cover_photo_url && mergedIds.length > 0
              ? photos.find((p) => p.id === mergedIds[0])
              : null;
          await base44.entities.Folder.update(matchingFolder.id, {
            photo_ids: mergedIds,
            ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }),
          });
        } else {
          const coverPhoto = photos.find((p) => p.id === folder.photo_ids[0]);
          await base44.entities.Folder.create({
            name: folder.name,
            description: "",
            photo_ids: folder.photo_ids,
            cover_photo_url: coverPhoto?.file_url || "",
          });
        }
      });

      await runConcurrent(folderTasks, 5);

      const totalSaved = foldersToSave.reduce((sum, f) => sum + f.photo_ids.length, 0);
      const missed = photosToOrganize.length - totalSaved;

      setProgress("");
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });

      if (foldersToSave.length === 0) {
        alert("No groups found to organize.");
      } else if (missed > 0) {
        alert(
          `Done! ${totalSaved} of ${photosToOrganize.length} items organized into ${foldersToSave.length} folders. ${missed} items had no clear group — press Organize again to retry.`
        );
      }
    } catch (error) {
      console.error("Error organizing:", error);
      alert(error?.message || "Failed to organize photos. Please try again.");
      setProgress("");
    } finally {
      setOrganizing(false);
    }
  };

  return (
    <>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organize Media</DialogTitle>
            <DialogDescription>
              AI groups photos and videos by what they look like — grass fields, beaches, pets, food, and more
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
                Sharpen visual tags before organizing
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

      <div className={squareStyle ? "relative w-full min-w-0" : "relative"}>
        {squareStyle ? (
          <button
            onClick={() => setShowDialog(true)}
            disabled={organizing || photos.length < 2}
            className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-white text-gray-700 border border-gray-100 shadow-sm text-sm font-semibold disabled:opacity-50"
          >
            {organizing ? (
              <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            ) : (
              <Sparkles className="w-5 h-5 text-purple-500" />
            )}
            <span>{organizing ? "Organizing..." : "Organize"}</span>
          </button>
        ) : (
          <Button
            onClick={() => setShowDialog(true)}
            disabled={organizing || photos.length < 2}
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

        {progress && (
          <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white rounded-lg shadow-lg border border-orange-200 whitespace-nowrap z-10">
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <Sparkles className="w-3 h-3 animate-pulse" />
              {progress}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
