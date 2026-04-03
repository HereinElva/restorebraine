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

// How many photos to send per AI call, and how many calls to run at once
const CHUNK_SIZE = 40;
const CONCURRENCY = 4;

/**
 * Run an array of async task-factories with a max concurrency limit.
 */
async function runConcurrent(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function runNext() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, runNext);
  await Promise.all(workers);
  return results;
}

/**
 * Ask the AI to assign a single chunk of photos to folder names.
 * Returns an array of { name, photo_ids } objects.
 */
async function organiseChunk(chunk, customInstructions) {
  const photoData = chunk.map(p => ({
    id: p.id,
    desc: (p.ai_description || '').substring(0, 120),
    tags: (p.ai_tags || []).slice(0, 3).join(', '),
  }));

  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are organizing ${photoData.length} photos/videos into broad thematic folders.

RULES:
1. Assign EVERY item to exactly one folder. Do not skip any.
2. Use broad categories: People & Portraits, Outdoor Activities, Food & Dining,
   Travel & Landmarks, Celebrations & Events, Home & Indoor, Nature & Landscapes,
   Animals & Pets, Screenshots & Documents, or similar.
3. Only create a folder if it has 2+ items.
4. Items that don't fit a group go into "Miscellaneous".
${customInstructions ? `\nUSER INSTRUCTIONS: ${customInstructions}` : ''}

Items:
${JSON.stringify(photoData)}

Return ONLY valid JSON matching the schema. Every item ID must appear exactly once.`,
    response_json_schema: {
      type: "object",
      properties: {
        folders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              photo_ids: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  });

  return result.folders || [];
}

/**
 * Merge folder arrays from multiple chunks into a single deduplicated list.
 * If two chunks produced a folder with the same name, merge their photo_ids.
 */
function mergeFolderResults(chunkResults) {
  const folderMap = new Map(); // name (lowercase) → { name, photo_ids: Set }

  for (const folders of chunkResults) {
    for (const folder of folders) {
      const key = folder.name.toLowerCase().trim();
      if (!folderMap.has(key)) {
        folderMap.set(key, { name: folder.name, ids: new Set(folder.photo_ids || []) });
      } else {
        for (const id of folder.photo_ids || []) {
          folderMap.get(key).ids.add(id);
        }
      }
    }
  }

  return Array.from(folderMap.values()).map(f => ({
    name: f.name,
    photo_ids: [...f.ids],
  }));
}

export default function OrganizeButton({ photos, squareStyle = false }) {
  const [organizing, setOrganizing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [includeOrganized, setIncludeOrganized] = useState(false);
  const queryClient = useQueryClient();

  const handleOrganize = async () => {
    if (photos.length < 2) {
      alert("You need at least 2 photos to organize.");
      return;
    }

    setShowDialog(false);
    setOrganizing(true);

    try {
      const existingFolders = await base44.entities.Folder.list();
      const organizedPhotoIds = new Set(existingFolders.flatMap(f => f.photo_ids || []));

      let photosToOrganize = includeOrganized
        ? photos
        : photos.filter(p => !organizedPhotoIds.has(p.id));

      if (photosToOrganize.length < 2) photosToOrganize = photos;
      if (photosToOrganize.length < 2) {
        alert("Not enough photos to organize.");
        setOrganizing(false);
        return;
      }

      // Split into chunks
      const chunks = [];
      for (let i = 0; i < photosToOrganize.length; i += CHUNK_SIZE) {
        chunks.push(photosToOrganize.slice(i, i + CHUNK_SIZE));
      }

      const totalChunks = chunks.length;
      let completedChunks = 0;

      setProgress(`Analysing ${photosToOrganize.length} items in ${totalChunks} batch${totalChunks > 1 ? 'es' : ''}...`);

      // Build task list and run concurrently
      const tasks = chunks.map((chunk, i) => async () => {
        const result = await organiseChunk(chunk, customInstructions);
        completedChunks++;
        setProgress(
          totalChunks > 1
            ? `Analysing batches… ${completedChunks}/${totalChunks} done`
            : "Creating folders…"
        );
        return result;
      });

      const chunkResults = await runConcurrent(tasks, CONCURRENCY);

      setProgress("Merging results…");

      // Merge all chunk results into unified folder list
      const mergedFolders = mergeFolderResults(chunkResults);

      // Deduplicate: each photo in at most one folder
      const assignedIds = new Set(includeOrganized ? [] : [...organizedPhotoIds]);
      const deduplicatedFolders = [];
      for (const folder of mergedFolders) {
        const uniqueIds = (folder.photo_ids || []).filter(id => {
          if (assignedIds.has(id)) return false;
          assignedIds.add(id);
          return true;
        });
        if (uniqueIds.length >= 2) {
          deduplicatedFolders.push({ ...folder, photo_ids: uniqueIds });
        }
      }

      setProgress("Saving folders…");

      // Create or merge folders in parallel (batches of 5 to avoid rate limits)
      const folderTasks = deduplicatedFolders.map(folder => async () => {
        const matchingFolder = existingFolders.find(
          f => f.name.toLowerCase() === folder.name.toLowerCase()
        );

        if (matchingFolder) {
          const mergedIds = [...new Set([...matchingFolder.photo_ids, ...folder.photo_ids])];
          const coverPhoto = !matchingFolder.cover_photo_url && mergedIds.length > 0
            ? photos.find(p => p.id === mergedIds[0])
            : null;
          await base44.entities.Folder.update(matchingFolder.id, {
            photo_ids: mergedIds,
            ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }),
          });
        } else {
          const coverPhoto = photos.find(p => p.id === folder.photo_ids[0]);
          await base44.entities.Folder.create({
            name: folder.name,
            description: "",
            photo_ids: folder.photo_ids,
            cover_photo_url: coverPhoto?.file_url || "",
          });
        }
      });

      await runConcurrent(folderTasks, 5);

      setProgress("");
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });

      if (deduplicatedFolders.length === 0) {
        alert("No similar photos found to group into folders.");
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
              Customize how your photos and videos should be organized into folders
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
                placeholder="e.g., 'Group by month and year' or 'Keep vacation photos separate' or 'Focus on organizing by people' or 'Consolidate similar folders'"
                value={customInstructions}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomInstructions(value);
                  const needsOrganized = value.toLowerCase().match(/\b(consolidate|merge|combine|take all folders|move folders|reorganize folders)\b/);
                  if (needsOrganized && !includeOrganized) setIncludeOrganized(true);
                }}
                className="min-h-[100px]"
              />
              {customInstructions && customInstructions.toLowerCase().match(/\b(folder|folders)\b/) && !includeOrganized && (
                <p className="text-xs text-orange-600 font-medium">
                  💡 Tip: Check the box below to work with existing folders
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-organized"
                checked={includeOrganized}
                onCheckedChange={setIncludeOrganized}
              />
              <Label htmlFor="include-organized" className="text-sm font-normal cursor-pointer">
                Include photos and videos that are already in folders (Re-organize everything).
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
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

      <div className="relative">
        {squareStyle ? (
          <button
            onClick={() => setShowDialog(true)}
            disabled={organizing || photos.length < 2}
            className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-white text-gray-700 border border-gray-100 shadow-sm text-sm font-semibold disabled:opacity-50"
          >
            {organizing
              ? <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              : <Sparkles className="w-5 h-5 text-purple-500" />}
            <span>{organizing ? 'Organizing...' : 'Organize Media'}</span>
          </button>
        ) : (
          <Button
            onClick={() => setShowDialog(true)}
            disabled={organizing || photos.length < 2}
            className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white gap-2"
          >
            {organizing ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Organizing...</>
            ) : (
              <><FolderPlus className="w-4 h-4" />Organize</>
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