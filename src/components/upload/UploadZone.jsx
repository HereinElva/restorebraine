import React, { useState, useRef } from "react";
import { Upload, Image, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UploadZone({ onFilesSelected }) {
  const [isDragging, setIsDragging] = useState(false);
  const [debugMsg, setDebugMsg] = useState("Component loaded");
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    setDebugMsg("onChange triggered!");
    const files = e.target.files;
    setDebugMsg(`Got ${files?.length || 0} files`);
    
    if (files && files.length > 0) {
      setDebugMsg(`Calling onFilesSelected with ${files.length} files...`);
      try {
        await onFilesSelected(files);
        setDebugMsg("onFilesSelected completed!");
      } catch (err) {
        setDebugMsg(`Error: ${err.message}`);
      }
    } else {
      setDebugMsg("No files selected (cancelled)");
    }
    e.target.value = '';
  };

  const handleButtonClick = () => {
    setDebugMsg("Button clicked! Opening file picker...");
    fileInputRef.current?.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setDebugMsg("Files dropped!");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onFilesSelected(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
        <p className="text-sm text-yellow-800 font-mono">Debug: {debugMsg}</p>
      </div>
      
      <Card className={`border-2 border-dashed transition-all duration-300 ${
        isDragging
          ? "border-purple-400 bg-purple-50 scale-105"
          : "border-purple-200 hover:border-purple-300 hover:bg-purple-50/50"
      }`}>
        <div className="p-12 text-center">
          <div className="relative inline-block mb-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              isDragging 
                ? "bg-gradient-to-br from-blue-400 to-purple-500 scale-110" 
                : "bg-gradient-to-br from-blue-200 to-purple-300"
            }`}>
              {isDragging ? (
                <Upload className="w-10 h-10 text-white" />
              ) : (
                <div className="flex items-center gap-1">
                  <Image className="w-8 h-8 text-purple-600" />
                  <Video className="w-8 h-8 text-purple-600" />
                </div>
              )}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {isDragging ? "Drop your files here" : "Upload Photos & Videos"}
          </h3>
          <p className="text-gray-600 mb-6">
            Drag and drop your photos and videos here, or click the button below
          </p>

          <Button
            type="button"
            onClick={handleButtonClick}
            className="bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white gap-2"
          >
            <Upload className="w-4 h-4" />
            Select Files
          </Button>

          <p className="text-sm text-gray-500 mt-6">
            Supports: JPG, PNG, WebP, GIF, MP4, MOV, AVI • Multiple files supported
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </Card>
    </div>
  );
}