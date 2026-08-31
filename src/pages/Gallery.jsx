import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { hasStoredSessionToken } from "@/screens/SignInScreen";
import { ensureClientSessionToken } from "@/lib/session-bootstrap";
import { loadGalleryData } from "@/lib/gallery-data";
import { resetAppScrollPosition } from "@/lib/scroll-reset";
import { Search, Image as ImageIcon, Sparkles, MousePointer2 } from "lucide-react";
import PullToRefresh from "../components/gallery/PullToRefresh";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SelectablePhotoGrid from "../components/gallery/SelectablePhotoGrid";
import PhotoModal from "../components/gallery/PhotoModal";
import EmptyState from "../components/gallery/EmptyState";
import OrganizeButton from "../components/gallery/OrganizeButton";
import CustomFolderButton from "../components/gallery/CustomFolderButton";
import FolderGrid from "../components/gallery/FolderGrid";
import FolderView from "../components/gallery/FolderView";
import SelectionToolbar from "../components/gallery/SelectionToolbar";
import DuplicateDetector from "../components/gallery/DuplicateDetector";
import { DragDropContext } from "@hello-pangea/dnd";
import { useNavigation } from "../components/NavigationContext";
import { useTabState } from "../components/TabStateContext";
import MobileGallery from "../components/gallery/MobileGallery";
import { setGalleryOrganizeSnapshot, toStoredPhotoIds, normalizePhotoId } from "@/lib/gallery-organize-snapshot";
import { fetchGalleryFoldersWithMembership, mergeApiFoldersWithLocal } from "@/lib/folder-membership";
import { loadFullFolderSnapshotAsync, loadFolderSnapshotCacheSync } from "@/lib/folder-membership-cache";
import "../components/gallery/mobile-gallery-layout.css";
 
// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------
 
const VIDEO_KEYWORDS = new Set(['video', 'videos']);
const IMAGE_KEYWORDS = new Set(['picture', 'pictures', 'image', 'images', 'photo', 'photos']);
 
function tokenise(str = '') {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
 
function scorePhoto(photo, rawQuery) {
  const queryTokens = tokenise(rawQuery);
  if (queryTokens.length === 0) return 1;
 
  const typeTokens = queryTokens.filter(t => VIDEO_KEYWORDS.has(t) || IMAGE_KEYWORDS.has(t));
  const contentTokens = queryTokens.filter(t => !VIDEO_KEYWORDS.has(t) && !IMAGE_KEYWORDS.has(t));
 
  if (typeTokens.some(t => VIDEO_KEYWORDS.has(t)) && photo.file_type !== 'video') return 0;
  if (typeTokens.some(t => IMAGE_KEYWORDS.has(t)) && photo.file_type !== 'image') return 0;
  if (contentTokens.length === 0) return 1;
 
  const desc = (photo.ai_description || '').toLowerCase();
  const tags = (photo.ai_tags || []).map(t => t.toLowerCase());
  const tagText = tags.join(' ');
 
  let score = 0;
  for (const term of contentTokens) {
    const inDesc = desc.includes(term);
    const inTags = tagText.includes(term);
    if (!inDesc && !inTags) return 0;
    if (inTags) score += 3;
    if (inDesc) score += 1;
  }
 
  const phrase = contentTokens.join(' ');
  if (desc.includes(phrase)) score += 10;
  const allInTags = contentTokens.every(t => tags.some(tag => tag.includes(t)));
  if (allInTags) score += 5;
 
  return score;
}
 
// ---------------------------------------------------------------------------
// Cache durations
// staleTime: show cached data immediately, re-fetch in background after this
// gcTime:    keep data in memory for this long after component unmounts
// ---------------------------------------------------------------------------
const CACHE = {
  user:    { staleTime: 5  * 60 * 1000, gcTime: 10 * 60 * 1000 }, // 5 min stale, 10 min gc
  photos:  { staleTime: 2  * 60 * 1000, gcTime: 10 * 60 * 1000 }, // 2 min stale
  folders: { staleTime: 2  * 60 * 1000, gcTime: 10 * 60 * 1000 },
};
 
// ---------------------------------------------------------------------------
 
export default function Gallery() {
  const { pushBack, popBack } = useNavigation();
  const { getTabState, setTabState } = useTabState();
  const { isAuthenticated, user: authUser } = useAuth();
  const canFetchData = isAuthenticated || hasStoredSessionToken();
  const isIOS = true;
 
  const saved = getTabState("Gallery") ?? {};
 
  const [searchQuery, setSearchQuery] = useState(saved.searchQuery ?? "");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [debouncedQuery, setDebouncedQuery] = useState(saved.debouncedQuery ?? "");
  const [selectedFolder, setSelectedFolder] = useState(saved.selectedFolder ?? null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [isMoving, setIsMoving] = useState(false);
  const queryClient = useQueryClient();
 
  useEffect(() => {
    setTabState("Gallery", { searchQuery, debouncedQuery, selectedFolder });
  }, [searchQuery, debouncedQuery, selectedFolder]);

  useEffect(() => {
    if (!canFetchData) return;
    ensureClientSessionToken();
    const refreshGallery = () => {
      ensureClientSessionToken();
      void loadGalleryData(queryClient);
      resetAppScrollPosition();
    };
    void loadGalleryData(queryClient);
    window.addEventListener('restorebraine-session-updated', refreshGallery);
    window.addEventListener('restorebraine-native-oauth-complete', refreshGallery);
    window.addEventListener('restorebraine-gallery-ready', refreshGallery);
    return () => {
      window.removeEventListener('restorebraine-session-updated', refreshGallery);
      window.removeEventListener('restorebraine-native-oauth-complete', refreshGallery);
      window.removeEventListener('restorebraine-gallery-ready', refreshGallery);
    };
  }, [canFetchData, queryClient]);

  useLayoutEffect(() => {
    if (!canFetchData) return;
    resetAppScrollPosition();
    void loadGalleryData(queryClient);
  }, [canFetchData, queryClient]);

  useEffect(() => {
    if (selectedFolder) {
      pushBack(selectedFolder.name, () => {
        setSelectedFolder(null);
        setSelectionMode(false);
        setSelectedIds([]);
      });
    } else {
      popBack();
    }
    return () => popBack();
  }, [selectedFolder?.id]);
 
  // ── Queries with stale-while-revalidate caching ──────────────────────────
  // currentUser is fetched once and cached — no blocking on re-opens
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => {
      ensureClientSessionToken();
      return base44.auth.me();
    },
    enabled: canFetchData,
    staleTime: CACHE.user.staleTime,
    gcTime: CACHE.user.gcTime,
    placeholderData: (prev) => prev ?? authUser ?? undefined,
    retry: 2,
    refetchOnMount: 'always',
  });

  const userEmail = currentUser?.email || authUser?.email;

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['photos', userEmail ?? 'pending'],
    queryFn: async () => {
      ensureClientSessionToken();
      const me = userEmail ? { email: userEmail } : await base44.auth.me();
      if (!me?.email) throw new Error('Gallery requires signed-in user');
      return base44.entities.Photo.filter({ created_by: me.email }, '-created_date');
    },
    enabled: canFetchData,
    staleTime: CACHE.photos.staleTime,
    gcTime: CACHE.photos.gcTime,
    retry: 2,
    refetchOnMount: 'always',
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders', userEmail ?? 'pending'],
    queryFn: async () => {
      ensureClientSessionToken();
      const me = userEmail ? { email: userEmail } : await base44.auth.me();
      if (!me?.email) throw new Error('Gallery requires signed-in user');
      const photosData =
        queryClient.getQueryData(['photos', me.email]) ??
        (await base44.entities.Photo.filter({ created_by: me.email }, '-created_date'));
      const snapshot = await loadFullFolderSnapshotAsync(me.email);
      const fetched = await fetchGalleryFoldersWithMembership(me.email, photosData || []);
      return mergeApiFoldersWithLocal(fetched, snapshot);
    },
    enabled: canFetchData && !!userEmail,
    staleTime: CACHE.folders.staleTime,
    gcTime: CACHE.folders.gcTime,
    placeholderData: (previousData) => {
      if (previousData?.length) return previousData;
      if (!userEmail) return [];
      const snapshot = loadFolderSnapshotCacheSync(userEmail);
      return snapshot.length ? snapshot : [];
    },
    retry: 2,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!userEmail || !canFetchData) return;
    loadFullFolderSnapshotAsync(userEmail).then((snapshot) => {
      if (!snapshot.length) return;
      queryClient.setQueryData(['folders', userEmail], (prev) =>
        mergeApiFoldersWithLocal(prev ?? [], snapshot),
      );
    });
  }, [userEmail, canFetchData, queryClient]);

  useEffect(() => {
    if (!userEmail || !canFetchData) return;
    queryClient.invalidateQueries({ queryKey: ['photos', userEmail] });
  }, [userEmail, canFetchData, queryClient]);

  // Only show the loading spinner on the very first load (no cached data yet)
  const isLoading = photosLoading && photos.length === 0;

  /** Align folder photo_ids with Photo.id values so Recents clears after organize. */
  const foldersForGallery = useMemo(
    () =>
      folders.map((folder) => ({
        ...folder,
        photo_ids: toStoredPhotoIds(folder.photo_ids, photos),
      })),
    [folders, photos],
  );

  useEffect(() => {
    setGalleryOrganizeSnapshot({ photos, folders: foldersForGallery });
  }, [photos, foldersForGallery]);
 
  // Auto-update folders without cover photos
  useEffect(() => {
    const updateFolderCovers = async () => {
      const foldersNeedingCovers = folders.filter(
        f => (!f.cover_photo_url || f.cover_photo_url === '') && f.photo_ids?.length > 0
      );
      if (foldersNeedingCovers.length === 0) return;
      let updated = false;
      for (const folder of foldersNeedingCovers) {
        const coverPhoto = photos.find(p => p.id === folder.photo_ids[0]);
        if (coverPhoto) {
          await base44.entities.Folder.update(folder.id, { cover_photo_url: coverPhoto.file_url });
          updated = true;
        }
      }
      if (updated) queryClient.invalidateQueries({ queryKey: ['folders'] });
    };
    if (photos.length > 0 && folders.length > 0) updateFolderCovers();
  }, [folders, photos, queryClient]);
 
  // Debounce + content moderation
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = searchQuery.toLowerCase().trim();
      const bannedCombinations = [
        { terms: ['child', 'porn'] },
        { terms: ['sexual', 'assault'] },
      ];
      const isBanned = bannedCombinations.some(combo =>
        combo.terms.every(term => query.includes(term))
      );
      if (isBanned) {
        alert('This search is not allowed.');
        setSearchQuery('');
        return;
      }
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
 
  const photosInFolders = new Set(
    foldersForGallery.flatMap((f) => (f.photo_ids || []).map(normalizePhotoId)),
  );
  const availablePhotos = debouncedQuery
    ? photos
    : photos.filter((p) => p?.id != null && !photosInFolders.has(normalizePhotoId(p.id)));
 
  const filteredPhotos = debouncedQuery
    ? availablePhotos
        .map(photo => ({ photo, score: scorePhoto(photo, debouncedQuery) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ photo }) => photo)
    : availablePhotos;
 
  const filteredFolders = debouncedQuery
    ? folders.filter(folder =>
        folder.name.toLowerCase().includes(debouncedQuery.toLowerCase().trim())
      )
    : folders;
 
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
 
  const toggleFolderSelect = (id) => {
    setSelectedFolderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
 
  const handleMoveToFolder = async (folderId) => {
    if (selectedIds.length === 0 && selectedFolderIds.length === 0) return;
    if (selectedFolderIds.includes(folderId)) {
      alert("Cannot move a folder into itself");
      return;
    }
    setIsMoving(true);
 
    let allPhotoIds = [...selectedIds];
    for (const selectedFolderId of selectedFolderIds) {
      const sourceFolder = folders.find(f => f.id === selectedFolderId);
      if (sourceFolder?.photo_ids) allPhotoIds = [...allPhotoIds, ...sourceFolder.photo_ids];
    }
 
    const targetFolder = folders.find(f => f.id === folderId);
    const existingPhotoIds = Array.isArray(targetFolder?.photo_ids) ? targetFolder.photo_ids : [];
    const mergedIds = [...new Set([...existingPhotoIds, ...allPhotoIds])];
    const coverPhoto = !targetFolder?.cover_photo_url && mergedIds.length > 0
      ? photos.find(p => p.id === mergedIds[0])
      : null;
 
    const prevFolders = queryClient.getQueryData(['folders']);
    queryClient.setQueryData(['folders'], (old = []) =>
      old
        .filter(f => !selectedFolderIds.includes(f.id))
        .map(f => f.id === folderId
          ? { ...f, photo_ids: mergedIds, ...(coverPhoto && { cover_photo_url: coverPhoto.file_url }) }
          : f
        )
    );
    setSelectedIds([]);
    setSelectedFolderIds([]);
    setSelectionMode(false);
 
    try {
      await base44.entities.Folder.update(folderId, {
        photo_ids: mergedIds,
        ...(coverPhoto && { cover_photo_url: coverPhoto.file_url })
      });
      for (const selectedFolderId of selectedFolderIds) {
        await base44.entities.Folder.delete(selectedFolderId);
      }
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    } catch (error) {
      console.error("Error moving items:", error);
      queryClient.setQueryData(['folders'], prevFolders);
    } finally {
      setIsMoving(false);
    }
  };
 
  const handleRemoveFromFolder = async () => {
    if (!selectedFolder || selectedIds.length === 0) return;
    setIsMoving(true);
    try {
      const updatedIds = selectedFolder.photo_ids.filter(id => !selectedIds.includes(id));
      await base44.entities.Folder.update(selectedFolder.id, { photo_ids: updatedIds });
      setSelectedFolder({ ...selectedFolder, photo_ids: updatedIds });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setSelectedIds([]);
      setSelectionMode(false);
    } catch (error) {
      console.error("Error removing photos:", error);
    } finally {
      setIsMoving(false);
    }
  };
 
  const handleDeletePhotos = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (!confirm(`Delete ${count} ${count === 1 ? 'item' : 'items'}? This action cannot be undone.`)) return;
    setIsMoving(true);
    const prevPhotos = queryClient.getQueryData(['photos']);
    queryClient.setQueryData(['photos'], (old = []) => old.filter(p => !selectedIds.includes(p.id)));
    setSelectedIds([]);
    setSelectionMode(false);
    try {
      await Promise.all(selectedIds.map(id => base44.entities.Photo.delete(id)));
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    } catch (error) {
      console.error("Error deleting photos:", error);
      queryClient.setQueryData(['photos'], prevPhotos);
      alert('Failed to delete some items. Please try again.');
    } finally {
      setIsMoving(false);
    }
  };
 
  // Pull-to-refresh — refetch gallery data; always completes so spinner clears
  const handleRefresh = async () => {
    window.dispatchEvent(new Event("restorebraine-gallery-refresh"));
    if (!userEmail) return;

    await Promise.race([
      Promise.all([
        queryClient.refetchQueries({ queryKey: ["photos", userEmail] }),
        queryClient.refetchQueries({ queryKey: ["folders", userEmail] }),
      ]).catch((error) => {
        console.warn("Gallery refetch failed:", error);
      }),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  };
 
  if (isIOS) {
    return (
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="rb-mobile-gallery-shell">
        <MobileGallery
          photos={photos}
          folders={foldersForGallery}
          isLoading={isLoading}
          filteredPhotos={filteredPhotos}
          filteredFolders={filteredFolders}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          debouncedQuery={debouncedQuery}
          selectedFolder={selectedFolder}
          setSelectedFolder={setSelectedFolder}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          selectedFolderIds={selectedFolderIds}
          setSelectedFolderIds={setSelectedFolderIds}
          toggleSelect={toggleSelect}
          toggleFolderSelect={toggleFolderSelect}
          queryClient={queryClient}
          pushBack={pushBack}
          popBack={popBack}
          onDeletePhotos={handleDeletePhotos}
          onMoveToFolder={handleMoveToFolder}
        />
        </div>
      </PullToRefresh>
    );
  }
 
  const content = (
    <div className="min-h-screen pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Find Your{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Memories
            </span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Search through your photos and videos using natural language.
          </p>
 
          {photos.length >= 2 && (
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <OrganizeButton photos={photos} folders={foldersForGallery} />
              <CustomFolderButton photos={photos} />
              <DuplicateDetector photos={photos} folders={folders} />
              <Button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedIds([]);
                  setSelectedFolderIds([]);
                }}
                className={`gap-2 ${selectionMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600'} text-white`}
              >
                <MousePointer2 className="w-4 h-4" />
                {selectionMode ? 'Exit Select' : 'Select'}
              </Button>
            </div>
          )}
        </div>
 
        <div className="max-w-3xl mx-auto mb-12">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-300 to-purple-400 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-300" />
            <div className="relative bg-white rounded-2xl shadow-lg border border-purple-100 p-2">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder='Try "sunset on the beach" or "people laughing" or "red car"...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 text-lg focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-400"
                />
                {searchQuery && <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />}
              </div>
            </div>
          </div>
 
          {debouncedQuery && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold text-purple-500">{filteredPhotos.length}</span> item{filteredPhotos.length !== 1 ? 's' : ''}
                {filteredFolders.length > 0 && <> and <span className="font-semibold text-purple-500">{filteredFolders.length}</span> folder{filteredFolders.length !== 1 ? 's' : ''}</>} matching "{debouncedQuery}"
                {filteredPhotos.length > 0 && <span className="ml-1 text-purple-400 text-xs">(sorted by relevance)</span>}
              </p>
            </div>
          )}
        </div>
 
        {filteredFolders.length > 0 && (
          <FolderGrid
            folders={filteredFolders}
            onFolderClick={setSelectedFolder}
            selectionMode={selectionMode}
            selectedFolderIds={selectedFolderIds}
            onToggleFolderSelect={toggleFolderSelect}
          />
        )}
 
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400" />
              <p className="text-gray-600">Loading your media...</p>
            </div>
          </div>
        ) : photos.length === 0 ? (
          <EmptyState />
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No matching items</h3>
            <p className="text-gray-600">Try a different search term</p>
          </div>
        ) : (
          <SelectablePhotoGrid
            photos={filteredPhotos}
            onPhotoClick={setSelectedPhoto}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>
 
      {selectionMode && !selectedFolder && (
        <SelectionToolbar
          selectedCount={selectedIds.length}
          selectedFolderCount={selectedFolderIds.length}
          onCancel={() => { setSelectionMode(false); setSelectedIds([]); setSelectedFolderIds([]); }}
          onSelectAll={() => { setSelectedIds(filteredPhotos.map(p => p.id)); setSelectedFolderIds(folders.map(f => f.id)); }}
          onDeselectAll={() => { setSelectedIds([]); setSelectedFolderIds([]); }}
          folders={folders}
          onMoveToFolder={handleMoveToFolder}
          onDelete={handleDeletePhotos}
          onDeleteFolders={async () => {
            if (selectedFolderIds.length === 0) return;
            if (!confirm(`Delete ${selectedFolderIds.length} folder(s)?`)) return;
            setIsMoving(true);
            try {
              await Promise.all(selectedFolderIds.map(id => base44.entities.Folder.delete(id)));
              queryClient.invalidateQueries({ queryKey: ['folders'] });
              setSelectedFolderIds([]);
              setSelectionMode(false);
            } catch (error) {
              console.error("Error deleting folders:", error);
            } finally {
              setIsMoving(false);
            }
          }}
          isMoving={isMoving}
          selectedPhotos={filteredPhotos.filter(p => selectedIds.includes(p.id))}
        />
      )}
 
      {selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}
    </div>
  );
 
  const wrappedContent = (
    <PullToRefresh onRefresh={handleRefresh}>{content}</PullToRefresh>
  );
 
  return wrappedContent;
}