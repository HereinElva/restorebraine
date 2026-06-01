import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Image, Video, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProcessingList from "./ProcessingList";
import { MAX_BATCH_SIZE } from "@/lib/media-upload";

export default function MobileUpload({
  files,
  processing,
  allProcessed,
  hasSuccess,
  currentPhotoCount,
  handleFileSelection,
  processPhotos,
  removeFile,
  retryFile,
}) {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const progress = files.length > 0 ? Math.round((successCount / files.length) * 100) : 0;

  return (
    <div className="min-h-screen pb-24 px-4 pt-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Memories</h1>
        <p className="text-sm text-gray-500 mt-1">
          {currentPhotoCount} {currentPhotoCount === 1 ? 'memory' : 'memories'} stored
        </p>
      </div>

      {/* Big tap-to-upload button (native feel) */}
      {!processing && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => handleFileSelection(e.target.files)}
            className="hidden"
          />

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl p-8 flex flex-col items-center gap-3 shadow-lg shadow-purple-200 mb-4"
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Camera className="w-9 h-9 text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">Add from Camera Roll</p>
              <p className="text-white/70 text-sm mt-1">Photos & Videos • Up to 5 min</p>
            </div>
          </motion.button>

          {/* Tips */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">AI-powered search</p>
                <p className="text-xs text-gray-500">Each upload is analyzed so you can search by description</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Image className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Photos & videos</p>
                <p className="text-xs text-gray-500">JPG, PNG, WebP, GIF, MP4, MOV, AVI</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Video className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">Smart organization</p>
                <p className="text-xs text-gray-500">AI auto-organizes into albums after upload</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Processing state */}
      {files.length > 0 && (
        <div className="mt-4">
          {/* Progress ring summary */}
          {processing && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4 flex items-center gap-4">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                  <circle
                    cx="28" cy="28" r="24"
                    fill="none"
                    stroke="url(#grad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 24}`}
                    strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                    className="transition-all duration-500"
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-600">{progress}%</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Processing...</p>
                <p className="text-sm text-gray-500">{successCount} of {files.length} complete</p>
              </div>
            </div>
          )}

          {allProcessed && hasSuccess && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(createPageUrl("Gallery"))}
              className="w-full bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl p-4 flex items-center justify-between mb-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                <div className="text-left">
                  <p className="font-semibold">Upload Complete!</p>
                  <p className="text-sm text-white/80">{successCount} item{successCount !== 1 ? 's' : ''} added</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          )}

          {!processing && !allProcessed && pendingCount > 0 && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={processPhotos}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-2xl p-4 flex items-center justify-center gap-2 shadow-sm mb-4"
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-semibold">Analyze & Save {pendingCount} {pendingCount === 1 ? 'File' : 'Files'}</span>
            </motion.button>
          )}

          <ProcessingList files={files} onRemove={removeFile} onRetry={retryFile} processing={processing} />
        </div>
      )}
    </div>
  );
}