import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";

const SLIDESHOW_MAX = 8;
const SLIDE_MS = 3000;

/** Folder tile — cycles through folder contents (capped for performance). */
export default function MobileFolderCard({ folder, folderPhotos = [], onClick }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tapping, setTapping] = useState(false);

  const slides = useMemo(() => folderPhotos.slice(0, SLIDESHOW_MAX), [folderPhotos]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [folder.id, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % slides.length);
    }, SLIDE_MS);
    return () => clearInterval(interval);
  }, [slides.length]);

  const currentPhoto = slides[currentIndex];
  const dotCount = Math.min(slides.length, 5);

  const handleClick = () => {
    setTapping(true);
    setTimeout(() => setTapping(false), 400);
    onClick();
  };

  const coverFallback = folder.cover_photo_url || '';

  return (
    <motion.button
      onClick={handleClick}
      animate={tapping ? { rotate: [0, -4, 4, -4, 4, 0], scale: [1, 0.95, 0.95, 0.95, 0.95, 1] } : {}}
      transition={{ duration: 0.4 }}
      className="rounded-xl overflow-hidden shadow-sm border border-gray-100 text-left w-full aspect-square relative"
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100">
        {currentPhoto ? (
          currentPhoto.file_type === 'video' ? (
            <div className="relative w-full h-full">
              {coverFallback ? (
                <img
                  src={coverFallback}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <img
                  src={currentPhoto.file_url.replace(/\.[^.]+$/, '.jpg')}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="async"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="absolute top-1 right-1 bg-black/50 rounded-full w-4 h-4 flex items-center justify-center">
                <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
              </div>
            </div>
          ) : (
            <motion.img
              key={`${folder.id}-${currentIndex}`}
              src={currentPhoto.file_url}
              alt=""
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              loading="eager"
              decoding="async"
            />
          )
        ) : coverFallback ? (
          <img
            src={coverFallback}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <FolderOpen className="w-8 h-8 text-purple-300 absolute inset-0 m-auto" />
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-1.5">
        <p className="text-white text-xs font-semibold truncate drop-shadow leading-tight">{folder.name}</p>
        <p className="text-white/70 text-[10px]">{folder.photo_ids?.length || 0}</p>
      </div>

      {slides.length > 1 && (
        <div className="absolute top-1 left-0 right-0 flex justify-center gap-0.5">
          {Array.from({ length: dotCount }, (_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-300 ${
                i === currentIndex % dotCount ? 'w-3 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
}
