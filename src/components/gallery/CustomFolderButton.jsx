import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { FolderPlus, Plus, X, Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CustomFolderButton({ photos, squareStyle = false }) {
  const [showDialog, setShowDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [folders, setFolders] = useState([]);
  const queryClient = useQueryClient();

  const addFolder = () => {
    setFolders([...folders, { name: "", description: "", photo_ids: [] }]);
  };

  const removeFolder = (index) => {
    setFolders(folders.filter((_, i) => i !== index));
  };

  const updateFolder = (index, field, value) => {
    const updated = [...folders];
    updated[index][field] = value;
    setFolders(updated);
  };

  const togglePhotoInFolder = (folderIndex, photoId) => {
    const updated = [...folders];
    const folder = updated[folderIndex];
    if (folder.photo_ids.includes(photoId)) {
      folder.photo_ids = folder.photo_ids.filter(id => id !== photoId);
    } else {
      folder.photo_ids.push(photoId);
    }
    setFolders(updated);
  };

  const handleCreate = async () => {
    const validFolders = folders.filter(f => f.name.trim() && f.photo_ids.length > 0);
    if (validFolders.length === 0) {
      alert("Please add folder names and select photos.");
      return;
    }

    setCreating(true);

    try {
      for (const folder of validFolders) {
        const coverPhoto = photos.find(p => p.id === folder.photo_ids[0]);
        await base44.entities.Folder.create({
          name: folder.name,
          description: folder.description || "",
          photo_ids: folder.photo_ids,
          cover_photo_url: coverPhoto?.file_url || ""
        });
      }

      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setFolders([]);
      setShowDialog(false);
    } catch (error) {
      console.error("Error creating folders:", error);
      alert("Failed to create folders. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) setFolders([]);
      }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Custom Folders</DialogTitle>
            <DialogDescription>
              Create folders and assign photos manually
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Your Folders</Label>
              <Button onClick={addFolder} size="sm" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Folder
              </Button>
            </div>

            {folders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Click "Add Folder" to create your first folder
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {folders.map((folder, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Folder name"
                          value={folder.name}
                          onChange={(e) => updateFolder(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Description (optional)"
                          value={folder.description}
                          onChange={(e) => updateFolder(index, 'description', e.target.value)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFolder(index)}
                        className="text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div>
                      <Label className="text-sm text-gray-600">
                        Select Photos ({folder.photo_ids.length} selected)
                      </Label>
                      <div className="mt-2 grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-2 border rounded">
                        {photos.map((photo) => {
                          const isSelected = folder.photo_ids.includes(photo.id);
                          return (
                            <div
                              key={photo.id}
                              onClick={() => togglePhotoInFolder(index, photo.id)}
                              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                                isSelected ? 'border-purple-500 ring-2 ring-purple-300' : 'border-gray-200'
                              }`}
                            >
                              <img
                                src={photo.file_url}
                                alt={photo.ai_description}
                                className="w-full h-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                                  <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                    <Check className="w-4 h-4 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={folders.length === 0 || creating}
              className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Folders'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {squareStyle ? (
        <button
          onClick={() => setShowDialog(true)}
          disabled={photos.length === 0}
          className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl bg-white text-gray-700 border border-gray-100 shadow-sm text-sm font-semibold disabled:opacity-50"
        >
          <FolderPlus className="w-5 h-5 text-orange-500" />
          <span>New Folder</span>
        </button>
      ) : (
        <Button
          onClick={() => setShowDialog(true)}
          disabled={photos.length === 0}
          className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          Custom Folder
        </Button>
      )}
    </>
  );
}