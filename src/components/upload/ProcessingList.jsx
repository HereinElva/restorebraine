import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, X, Image, RotateCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ProcessingList({ files, onRemove, processing, onRetry }) {
  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      <AnimatePresence>
        {files.map((fileItem, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
              fileItem.status === 'success' 
                ? 'bg-green-50 border-green-200' 
                : fileItem.status === 'error'
                ? 'bg-red-50 border-red-200'
                : fileItem.status === 'processing'
                ? 'bg-purple-50 border-purple-200'
                : 'bg-white border-gray-200'
            }`}
          >
            {/* Thumbnail or Icon */}
            <div className="flex-shrink-0">
              {fileItem.file && (
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={URL.createObjectURL(fileItem.file)}
                    alt={fileItem.file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium text-gray-900 truncate">
                  {fileItem.file.name}
                </p>
                
                {/* Status Badge */}
                <div className="flex-shrink-0 ml-2">
                  {fileItem.status === 'pending' && (
                    <Badge variant="outline" className="text-xs">
                      Pending
                    </Badge>
                  )}
                  {fileItem.status === 'processing' && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {fileItem.status === 'success' && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Complete
                    </Badge>
                  )}
                  {fileItem.status === 'error' && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {fileItem.status === 'processing' && (
                <div className="mb-2">
                  <Progress value={fileItem.progress} className="h-1.5" />
                </div>
              )}

              {/* AI Description or Error */}
              {fileItem.ai_description && (
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                  {fileItem.ai_description}
                </p>
              )}
              {fileItem.error && (
                <p className="text-sm text-red-600 mt-1">
                  {fileItem.error}
                </p>
              )}

              {fileItem.status === 'processing' && fileItem.phase && (
                <p className="text-xs text-purple-600 capitalize mt-0.5">{fileItem.phase}…</p>
              )}
              {fileItem.status === 'pending' && (
                <p className="text-sm text-gray-500 mt-1">
                  {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex-shrink-0 flex gap-1">
              {fileItem.status === 'error' && onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRetry(index)}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  title="Retry upload"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              )}
              {fileItem.status !== 'processing' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  className="flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}