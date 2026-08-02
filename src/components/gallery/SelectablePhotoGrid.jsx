import React from "react";
import { motion } from "framer-motion";
import { Play, Check } from "lucide-react";
import { Droppable, Draggable } from "@hello-pangea/dnd";

export default function SelectablePhotoGrid({ 
  photos, 
  onPhotoClick, 
  selectionMode = false, 
  selectedIds = [], 
  onToggleSelect,
  fastRender = false,
  folderLabelForPhoto,
  onFolderLabelClick,
}) {
  const handleClick = (photo, e) => {
    if (selectionMode) {
      e.stopPropagation();
      onToggleSelect(photo.id);
    } else {
      onPhotoClick(photo);
    }
  };

  const getMotionProps = (index) => (
    fastRender
      ? { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, delay: Math.min(index * 0.03, 0.3) },
        }
  );

  // If selection mode is active, render with drag-and-drop
  if (selectionMode) {
    return (
      <Droppable droppableId="photo-grid" isDropDisabled={true}>
        {(provided) => (
          <div 
            ref={provided.ref}
            {...provided.droppableProps}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          >
            {photos.map((photo, index) => {
              const isSelected = selectedIds.includes(photo.id);
              
              return (
                <Draggable 
                  key={photo.id} 
                  draggableId={photo.id} 
                  index={index}
                >
                  {(provided, snapshot) => (
                    <motion.div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      {...getMotionProps(index)}
                      onClick={(e) => handleClick(photo, e)}
                      className="group cursor-move relative"
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.5 : 1,
                      }}
                    >
                      <div className={`relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-md hover:shadow-xl transition-all duration-300 ${
                        isSelected ? 'ring-4 ring-purple-500 ring-offset-2' : ''
                      }`}>
                        {photo.file_type === 'video' ? (
                          <>
                            <video
                              src={photo.file_url}
                              className="w-full h-full object-cover"
                              preload="metadata"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                <Play className="w-6 h-6 text-purple-600 ml-1" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img
                            src={photo.file_url}
                            alt={photo.ai_description}
                            className="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                          />
                        )}
                        
                        <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected 
                            ? 'bg-purple-500 border-purple-500' 
                            : 'bg-white/80 border-gray-300 hover:border-purple-400'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-white text-xs line-clamp-2">
                              {photo.ai_description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  }

  // Regular grid without drag-and-drop
  const TileWrapper = fastRender ? 'div' : motion.div;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {photos.map((photo, index) => (
        <TileWrapper
          key={photo.id}
          {...(fastRender ? {} : getMotionProps(index))}
          onClick={(e) => handleClick(photo, e)}
          className="group cursor-pointer relative"
        >
          <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
            {photo.file_type === 'video' ? (
              <>
                <video
                  src={photo.file_url}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-purple-600 ml-1" />
                  </div>
                </div>
              </>
            ) : (
              <img
                src={photo.file_url}
                alt={photo.ai_description}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="eager"
                decoding="async"
                fetchPriority={fastRender && index < 6 ? 'high' : 'auto'}
              />
            )}

            {folderLabelForPhoto?.(photo) ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFolderLabelClick?.(photo);
                }}
                className="absolute top-1 left-1 right-1 text-left"
              >
                <span className="inline-block max-w-full truncate rounded-md bg-purple-700/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  In: {folderLabelForPhoto(photo)}
                </span>
              </button>
            ) : null}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-xs line-clamp-2">
                  {photo.ai_description}
                </p>
              </div>
            </div>
          </div>
        </TileWrapper>
      ))}
    </div>
  );
}