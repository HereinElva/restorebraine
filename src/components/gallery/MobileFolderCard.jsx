import React, { useState } from "react";
import { motion } from "framer-motion";
import { FolderOpen } from "lucide-react";
import { gridImageProps } from "@/lib/gallery-image";

/** Folder tile — static cover only (no slideshow; avoids loading many full images). */
export default function MobileFolderCard({ folder, onClick }) {
  const [tapping, setTapping] = useState(false);
  const coverUrl = folder.cover_photo_url || '';

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
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-blue-100">
        {coverUrl ? (
          <img
            {...gridImageProps(coverUrl, folder.name)}
            className="w-full h-full object-cover"
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
    </motion.button>
  );
}
