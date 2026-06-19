import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SQUARE_FOLDER_ACTION_CLASS } from "./folderActionStyles";

export default function DuplicateDetector({ photos, folders, squareStyle = false }) {
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const queryClient = useQueryClient();

  const findDuplicates = () => {
    setChecking(true);
    
    // Find photos that appear in multiple folders
    const photoFolderMap = {};
    
    folders.forEach(folder => {
      const photoIds = folder.data?.photo_ids || folder.photo_ids || [];
      photoIds.forEach(photoId => {
        if (!photoFolderMap[photoId]) {
          photoFolderMap[photoId] = [];
        }
        photoFolderMap[photoId].push(folder);
      });
    });
    
    // Find duplicates (photos in more than one folder)
    const dupes = [];
    Object.entries(photoFolderMap).forEach(([photoId, folderList]) => {
      if (folderList.length > 1) {
        const photo = photos.find(p => (p.data?.id || p.id) === photoId);
        if (photo) {
          dupes.push({
            photo: photo.data || photo,
            folders: folderList
          });
        }
      }
    });
    
    setDuplicates(dupes);
    setShowDialog(true);
    setChecking(false);
  };

  const consolidateDuplicates = async () => {
    setConsolidating(true);
    
    try {
      // For each duplicate, keep it only in the first folder
      for (const dupe of duplicates) {
        const [keepFolder, ...removeFolders] = dupe.folders;
        
        for (const folder of removeFolders) {
          const folderId = folder.data?.id || folder.id;
          const photoIds = folder.data?.photo_ids || folder.photo_ids || [];
          const updatedIds = photoIds.filter(id => id !== dupe.photo.id);
          await base44.entities.Folder.update(folderId, {
            photo_ids: updatedIds
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowDialog(false);
      setDuplicates([]);
    } catch (error) {
      console.error("Error consolidating:", error);
    } finally {
      setConsolidating(false);
    }
  };

  return (
    <>
      {squareStyle ? (
        <button
          type="button"
          data-rb-folder-action="duplicates"
          onClick={findDuplicates}
          disabled={checking}
          className={SQUARE_FOLDER_ACTION_CLASS}
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <Copy className="w-5 h-5 text-blue-500" />}
          <span>Duplicates</span>
        </button>
      ) : (
        <Button
          onClick={findDuplicates}
          disabled={checking}
          className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white gap-2"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          Check Duplicates
        </Button>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {duplicates.length > 0 ? (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              Duplicate Check
            </DialogTitle>
            <DialogDescription>
              {duplicates.length > 0 
                ? `Found ${duplicates.length} photo${duplicates.length !== 1 ? 's' : ''} in multiple folders.`
                : "No duplicates found! Your library is clean."
              }
            </DialogDescription>
          </DialogHeader>

          {duplicates.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3">
                {duplicates.map((dupe, i) => (
                  <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                    <img 
                      src={dupe.photo.file_url} 
                      className="w-12 h-12 object-cover rounded"
                      alt=""
                    />
                    <div className="flex-1 min-w-0">
                     <p className="text-sm text-gray-600 truncate">
                       {dupe.photo.ai_description ? `${dupe.photo.ai_description.slice(0, 50)}...` : 'No description'}
                     </p>
                     <p className="text-xs text-amber-600">
                       In: {dupe.folders.map(f => f.data?.name || f.name).join(", ")}
                     </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={consolidateDuplicates}
                disabled={consolidating}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                {consolidating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Consolidate (keep in first folder only)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}