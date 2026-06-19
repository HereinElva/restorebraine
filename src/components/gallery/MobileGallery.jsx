import React, { useState, useRef } from "react";
import { Search, X, Sparkles, ImageIcon, Grid3x3, Layers, MousePointer2, Check, Pencil, Loader2, FolderInput, Folder } from "lucide-react";

import SelectablePhotoGrid from "./SelectablePhotoGrid";
import MobilePhotoModal from "./MobilePhotoModal";
import EmptyState from "./EmptyState";
import OrganizeButton from "./OrganizeButton";
import { SQUARE_FOLDER_ACTION_ACTIVE_CLASS, SQUARE_FOLDER_ACTION_ACTIVE_STYLE, SQUARE_FOLDER_ACTION_CLASS, SQUARE_FOLDER_ACTION_STYLE } from "./folderActionStyles";
import CustomFolderButton from "./CustomFolderButton";
import DuplicateDetector from "./DuplicateDetector";
import MobileFolderCard from "./MobileFolderCard";
import MobileDrawerMenu from "./MobileDrawerMenu";
import { base44 } from "@/api/base44Client";
import { BUILD_NUMBER } from "@/lib/build-info";

export default function MobileGallery({
  photos,
  folders,
  isLoading,
  filteredPhotos,
  filteredFolders,
  searchQuery,
  setSearchQuery,
  debouncedQuery,
  selectedFolder,
  setSelectedFolder,
  selectionMode,
  setSelectionMode,
  selectedIds,
  setSelectedIds,
  selectedFolderIds,
  setSelectedFolderIds,
  toggleSelect,
  toggleFolderSelect,
  queryClient,
  pushBack,
  popBack,
  onDeletePhotos,
  onMoveToFolder,
}) {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [renameFolder, setRenameFolder] = useState(null); // folder being renamed
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [folderMoveDrawerOpen, setFolderMoveDrawerOpen] = useState(false);
  const inputRef = useRef(null);

  const photosInFolders = new Set(folders.flatMap(f => f.photo_ids || []));
  const unorganizedPhotos = photos.filter(p => !photosInFolders.has(p.id));

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setSelectedFolderIds([]);
  };

  // Rename selected folder (only works when exactly 1 folder selected)
  const handleRenameOpen = () => {
    if (selectedFolderIds.length !== 1) return;
    const folder = folders.find(f => f.id === selectedFolderIds[0]);
    if (folder) { setRenameFolder(folder); setRenameName(folder.name); }
  };

  const handleRenameSave = async () => {
    if (!renameFolder || !renameName.trim()) return;
    setRenaming(true);
    await base44.entities.Folder.update(renameFolder.id, { name: renameName.trim() });
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    setRenaming(false);
    setRenameFolder(null);
    exitSelection();
  };

  // Merge selected folders into a target folder
  const handleMerge = async (targetFolderId) => {
    setMergeDrawerOpen(false);
    setMerging(true);
    const targetFolder = folders.find(f => f.id === targetFolderId);
    const sourceIds = selectedFolderIds; // all selected folders merge INTO target
    let allPhotoIds = [...(targetFolder.photo_ids || [])];
    for (const srcId of sourceIds) {
      const src = folders.find(f => f.id === srcId);
      if (src) allPhotoIds = [...allPhotoIds, ...(src.photo_ids || [])];
    }
    const uniqueIds = [...new Set(allPhotoIds)];
    const coverPhoto = photos.find(p => p.id === uniqueIds[0]);
    await base44.entities.Folder.update(targetFolderId, {
      photo_ids: uniqueIds,
      ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }),
    });
    for (const srcId of sourceIds) {
      await base44.entities.Folder.delete(srcId);
    }
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    setMerging(false);
    exitSelection();
  };

  const handleDeleteFolders = async () => {
    if (!selectedFolderIds.length) return;
    if (!confirm(`Delete ${selectedFolderIds.length} folder(s)? Photos will not be deleted.`)) return;
    for (const id of selectedFolderIds) await base44.entities.Folder.delete(id);
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    exitSelection();
  };

  // Folder view
  if (selectedFolder) {
    const folderPhotos = photos.filter(p => (selectedFolder.photo_ids || []).includes(p.id));

    const handleFolderPhotoMove = async (targetFolderId) => {
      setMergeDrawerOpen(false);
      const targetFolder = folders.find(f => f.id === targetFolderId);
      if (!targetFolder) return;
      // Add selected photos to target folder
      const updatedTargetIds = [...new Set([...(targetFolder.photo_ids || []), ...selectedIds])];
      await base44.entities.Folder.update(targetFolderId, {
        photo_ids: updatedTargetIds,
        cover_photo_url: targetFolder.cover_photo_url || photos.find(p => p.id === updatedTargetIds[0])?.file_url,
      });
      // Remove selected photos from current folder
      const updatedSourceIds = (selectedFolder.photo_ids || []).filter(id => !selectedIds.includes(id));
      await base44.entities.Folder.update(selectedFolder.id, { photo_ids: updatedSourceIds });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      exitSelection();
    };

    const handleFolderPhotoDelete = async () => {
      if (!confirm(`Delete ${selectedIds.length} item(s)? This cannot be undone.`)) return;
      await Promise.all(selectedIds.map(id => base44.entities.Photo.delete(id)));
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      exitSelection();
    };

    return (
      <div className="min-h-screen pb-24 px-3 pt-20">
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {folderPhotos.length} item{folderPhotos.length !== 1 ? 's' : ''}
          </p>
          {folderPhotos.length > 0 && (
            <button
              onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}
              className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${selectionMode ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {selectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>
        {folderPhotos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No photos in this folder</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {folderPhotos.map(photo => {
              const isSelected = selectedIds.includes(photo.id);
              return (
                <div
                  key={photo.id}
                  className="relative aspect-square bg-gray-100 overflow-hidden rounded-lg"
                  onClick={() => selectionMode ? toggleSelect(photo.id) : setSelectedPhoto(photo)}
                >
                  {photo.file_type === 'video' ? (
                    <video src={photo.file_url} className="w-full h-full object-cover" preload="metadata" />
                  ) : (
                    <img src={photo.file_url} alt="" className="w-full h-full object-cover" />
                  )}
                  {selectionMode && (
                    <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-white/80 border-gray-400'}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  {selectionMode && isSelected && (
                    <div className="absolute inset-0 bg-purple-500/20 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selectedPhoto && (
          <MobilePhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} folders={folders} />
        )}

        {/* Selection toolbar for folder view */}
        {selectionMode && selectedIds.length > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)]">
            <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-purple-700">
                  {selectedIds.length} photo{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
                <button onClick={exitSelection} className="text-gray-400 text-sm font-medium flex items-center gap-1">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFolderMoveDrawerOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold"
                >
                  <FolderInput className="w-4 h-4" /> Move to Folder
                </button>
                <button
                  onClick={handleFolderPhotoDelete}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move to folder drawer (folder view) */}
        <MobileDrawerMenu open={folderMoveDrawerOpen} onOpenChange={setFolderMoveDrawerOpen} title="Move to Folder">
          {folders.filter(f => f.id !== selectedFolder.id).map(folder => (
            <button
              key={folder.id}
              onClick={() => handleFolderPhotoMove(folder.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg"
            >
              <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="text-sm text-gray-800 truncate">{folder.name}</span>
            </button>
          ))}
        </MobileDrawerMenu>
      </div>
    );
  }

  // Selectable folder card
  const SelectableFolderCard = ({ folder }) => {
    const isSelected = selectedFolderIds.includes(folder.id);
    return (
      <div
        className="relative"
        onClick={() => {
          if (selectionMode) {
            toggleFolderSelect(folder.id);
          } else {
            setSelectedFolder(folder);
            pushBack(folder.name, () => { setSelectedFolder(null); setSelectionMode(false); setSelectedIds([]); });
          }
        }}
      >
        <MobileFolderCard folder={folder} photos={photos} onClick={() => {}} />
        {selectionMode && (
          <div className={`absolute top-1 right-1 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 ${
            isSelected ? 'bg-purple-600 border-purple-600' : 'bg-white/80 border-gray-400'
          }`}>
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </div>
        )}
        {selectionMode && isSelected && (
          <div className="absolute inset-0 rounded-xl bg-purple-500/20 pointer-events-none" />
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24" data-rb-deploy={`v${BUILD_NUMBER}`}>
      {/* Hero Title */}
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">
          Find Your{" "}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Memories
          </span>
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Search using natural language</p>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-2">
        <div className={`flex items-center gap-2 bg-blue-50 rounded-2xl px-4 py-3 transition-all duration-200 border border-blue-100 ${searchFocused ? 'bg-blue-100 ring-2 ring-blue-300' : ''}`}>
          <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${searchFocused ? 'text-blue-500' : 'text-blue-300'}`} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-gray-400 text-gray-900"
          />
          {searchQuery ? (
            <button onClick={() => setSearchQuery("")}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          ) : searchFocused ? (
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          ) : null}
        </div>
        {debouncedQuery && (
          <p className="text-xs text-gray-500 mt-1.5 text-center">
            {filteredPhotos.length} result{filteredPhotos.length !== 1 ? 's' : ''} for "{debouncedQuery}"
          </p>
        )}
      </div>

      {/* Tabs */}
      {!debouncedQuery && (
        <div className="flex px-4 gap-1 mb-1 sticky top-14 z-20 bg-white/95 backdrop-blur-md pb-2">
          <button
            onClick={() => { setActiveTab("all"); exitSelection(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "all" ? "bg-purple-100 text-purple-700" : "text-gray-500"}`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            All ({photos.length})
          </button>
          <button
            onClick={() => setActiveTab("folders")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === "folders" ? "bg-purple-100 text-purple-700" : "text-gray-500"}`}
          >
            <Layers className="w-3.5 h-3.5" />
            Folders ({folders.length})
          </button>
        </div>
      )}

      <div className="px-3 pt-1">
        {debouncedQuery ? (
          <>
            {filteredFolders.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Folders</p>
                <div className="grid grid-cols-4 gap-2">
                  {filteredFolders.map(folder => (
                    <SelectableFolderCard key={folder.id} folder={folder} />
                  ))}
                </div>
              </div>
            )}
            {filteredPhotos.length === 0 ? (
              <div className="text-center py-16">
                <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No results</p>
                <p className="text-gray-400 text-sm">Try a different search</p>
              </div>
            ) : (
              <SelectablePhotoGrid photos={filteredPhotos} onPhotoClick={setSelectedPhoto} selectionMode={false} selectedIds={[]} onToggleSelect={() => {}} />
            )}
          </>
        ) : activeTab === "folders" ? (
          <div>
            {/* Action buttons — each cell wraps one full-width control */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="min-w-0 w-full">
                <OrganizeButton photos={photos} squareStyle />
              </div>
              <div className="min-w-0 w-full">
                <CustomFolderButton photos={photos} squareStyle />
              </div>
              <div className="min-w-0 w-full">
                <DuplicateDetector photos={photos} folders={folders} squareStyle />
              </div>
              <div className="min-w-0 w-full">
                <button
                  type="button"
                  data-rb-folder-action="select"
                  onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); setSelectedFolderIds([]); }}
                  className={selectionMode ? SQUARE_FOLDER_ACTION_ACTIVE_CLASS : SQUARE_FOLDER_ACTION_CLASS}
                  style={selectionMode ? SQUARE_FOLDER_ACTION_ACTIVE_STYLE : SQUARE_FOLDER_ACTION_STYLE}
                >
                  <MousePointer2 className="w-5 h-5" />
                  <span>{selectionMode ? 'Exit Select' : 'Select'}</span>
                </button>
              </div>
            </div>

            {folders.length === 0 ? (
              <div className="text-center py-16">
                <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No folders yet</p>
                <p className="text-gray-400 text-sm">Tap Organize Media to create smart folders</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {folders.map(folder => (
                  <SelectableFolderCard key={folder.id} folder={folder} />
                ))}
              </div>
            )}
          </div>
        ) : (
          // All tab
          <>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400" />
                <p className="text-gray-500 text-sm">Loading memories...</p>
              </div>
            ) : photos.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {folders.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folders</p>
                      <button onClick={() => setActiveTab("folders")} className="text-xs text-purple-500 font-medium">See all</button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {folders.slice(0, 8).map(folder => (
                        <MobileFolderCard
                          key={folder.id}
                          folder={folder}
                          photos={photos}
                          onClick={() => {
                            setSelectedFolder(folder);
                            pushBack(folder.name, () => { setSelectedFolder(null); setSelectionMode(false); setSelectedIds([]); });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {unorganizedPhotos.length > 0 && (
                  <div>
                    {folders.length > 0 && (
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                        Recents ({unorganizedPhotos.length})
                      </p>
                    )}
                    <SelectablePhotoGrid
                      photos={unorganizedPhotos}
                      onPhotoClick={setSelectedPhoto}
                      selectionMode={selectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selectedPhoto && (
        <MobilePhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} folders={folders} />
      )}

      {/* Folder selection toolbar */}
      {selectionMode && (selectedFolderIds.length > 0 || selectedIds.length > 0) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-2rem)]">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 px-4 py-3 flex flex-col gap-3">
            {/* Status row */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-purple-700">
                {selectedFolderIds.length > 0 && `${selectedFolderIds.length} folder${selectedFolderIds.length !== 1 ? 's' : ''}`}
                {selectedFolderIds.length > 0 && selectedIds.length > 0 && ', '}
                {selectedIds.length > 0 && `${selectedIds.length} photo${selectedIds.length !== 1 ? 's' : ''}`}
                {' '}selected
              </span>
              <button onClick={exitSelection} className="text-gray-400 text-sm font-medium flex items-center gap-1">
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>

            {/* Actions row */}
            <div className="flex gap-2 flex-wrap">
              {/* Rename — only when exactly 1 folder selected */}
              {selectedFolderIds.length === 1 && selectedIds.length === 0 && (
                <button
                  onClick={handleRenameOpen}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold"
                >
                  <Pencil className="w-4 h-4" /> Rename
                </button>
              )}

              {/* Merge — when 1+ folders selected */}
              {selectedFolderIds.length >= 1 && selectedIds.length === 0 && (
                <button
                  onClick={() => setMergeDrawerOpen(true)}
                  disabled={merging}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderInput className="w-4 h-4" />}
                  Merge Folders
                </button>
              )}

              {/* Move photos to folder */}
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setFolderMoveDrawerOpen(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold"
                >
                  <FolderInput className="w-4 h-4" /> Move to Folder
                </button>
              )}

              {/* Delete */}
              {(selectedFolderIds.length > 0 || selectedIds.length > 0) && (
                <button
                  onClick={() => {
                    if (selectedFolderIds.length > 0) handleDeleteFolders();
                    if (selectedIds.length > 0) onDeletePhotos();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Merge folders drawer */}
      <MobileDrawerMenu open={mergeDrawerOpen} onOpenChange={setMergeDrawerOpen} title="Merge into folder">
        {folders
          .filter(f => !selectedFolderIds.includes(f.id))
          .map(folder => (
            <button
              key={folder.id}
              onClick={() => handleMerge(folder.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg"
            >
              <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="text-sm text-gray-800 truncate">{folder.name}</span>
            </button>
          ))
        }
      </MobileDrawerMenu>

      {/* Move photos to folder drawer */}
      <MobileDrawerMenu open={folderMoveDrawerOpen} onOpenChange={setFolderMoveDrawerOpen} title="Move to Folder">
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => { setFolderMoveDrawerOpen(false); onMoveToFolder(folder.id); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg"
          >
            <Folder className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-sm text-gray-800 truncate">{folder.name}</span>
          </button>
        ))}
      </MobileDrawerMenu>

      {/* Rename modal */}
      {renameFolder && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center" onClick={() => setRenameFolder(null)}>
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Rename Folder</h3>
            <input
              autoFocus
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
              className="w-full border-2 border-purple-300 rounded-xl px-4 py-3 text-base outline-none focus:border-purple-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRenameFolder(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                disabled={renaming || !renameName.trim()}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {renaming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}