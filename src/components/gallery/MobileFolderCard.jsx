import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";

export default function MobileFolderCard({ folder, photos, onClick }) {
  const folderPhotos = photos.filter(p => folder.photo_ids?.includes(p.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tapping, setTapping] = useState(false);

  // Cycle through photos every 3 seconds
  useEffect(() => {
    if (folderPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % folderPhotos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [folderPhotos.length]);

  const currentPhoto = folderPhotos[currentIndex];

  const handleClick = () => {
    setTapping(true);
    setTimeout(() => setTapping(false), 400);
    onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      animate={tapping ? { rotate: [0, -4, 4, -4, 4, 0], scale: [1, 0.95, 0.95, 0.95, 0.95, 1] } : {}}
      transition={{ duration: 0.4 }}
      className="rounded-xl overflow-hidden shadow-sm border border-gray-100 text-left w-full aspect-square relative"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Slideshow image */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100">
        {currentPhoto ? (
          currentPhoto.file_type === 'video' ? (
            <div className="relative w-full h-full">
              <img
                src={currentPhoto.file_url.replace(/\.[^.]+$/, '.jpg')}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {/* fallback: show cover */}
              {folder.cover_photo_url && (
                <img src={folder.cover_photo_url} className="w-full h-full object-cover absolute inset-0" />
              )}
              <div className="absolute top-1 right-1 bg-black/50 rounded-full w-4 h-4 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
              </div>
            </div>
          ) : (
            <motion.img
              key={currentIndex}
              src={currentPhoto.file_url}
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          )
        ) : (
          <FolderOpen className="w-8 h-8 text-purple-300 absolute inset-0 m-auto" />
        )}
      </div>

      {/* Gradient overlay + name */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-white text-xs font-semibold truncate drop-shadow leading-tight">{folder.name}</p>
        <p className="text-white/70 text-[10px]">{folder.photo_ids?.length || 0}</p>
      </div>

      {/* Slideshow dots */}
      {folderPhotos.length > 1 && (
        <div className="absolute top-1 left-0 right-0 flex justify-center gap-0.5">
          {folderPhotos.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-300 ${
                i === currentIndex % Math.min(folderPhotos.length, 5)
                  ? 'w-3 bg-white'
                  : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}