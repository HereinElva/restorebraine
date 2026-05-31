import React, { useState, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import UploadZone from "@/components/upload/UploadZone";
import MobileUpload from "@/components/upload/MobileUpload";
import PaymentModal from "@/components/upload/PaymentModal";
import {
  getStorageLimit,
  getTiersNeeded,
  wouldExceedStorageLimit,
} from "@/lib/storage-billing";
import { installStripeReturnRefresh } from "@/lib/stripe-checkout";

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // ~5 min cap for large videos

async function analyzeMedia(fileUrl, fileType, filename) {
  const isVideo = fileType === "video";
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Analyze this ${isVideo ? "video" : "photo"} named "${filename}".
Return a concise searchable description (1-2 sentences) and 5-10 relevant tags.
Focus on people, places, activities, objects, and mood.`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        ai_description: { type: "string" },
        ai_tags: { type: "array", items: { type: "string" } },
      },
      required: ["ai_description", "ai_tags"],
    },
  });

  return {
    ai_description: result.ai_description || filename,
    ai_tags: Array.isArray(result.ai_tags) ? result.ai_tags : [],
  };
}

export default function Upload() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: () => base44.auth.me(),
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["photos", currentUser?.email],
    queryFn: () => base44.entities.Photo.filter({ created_by: currentUser.email }, "-created_date"),
    enabled: !!currentUser?.email,
    initialData: [],
  });

  const currentPhotoCount = photos.length;
  const currentPaidTier = currentUser?.paid_tier || 0;
  const storageLimit = getStorageLimit(currentPaidTier);
  useEffect(() => {
    return installStripeReturnRefresh(() => {
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    });
  }, [queryClient]);


  const addFilesToQueue = (incoming) => {
    const list = Array.from(incoming || []);
    const queued = list.map((file) => ({
      file,
      status: "pending",
      progress: 0,
      error: null,
      ai_description: null,
      ai_tags: null,
    }));
    setFiles((prev) => [...prev, ...queued]);
  };

  const handleFileSelection = useCallback(
    (incoming) => {
      const list = Array.from(incoming || []);
      if (!list.length) return;

      const oversized = list.find((f) => f.type.startsWith("video/") && f.size > MAX_VIDEO_BYTES);
      if (oversized) {
        alert(`${oversized.name} is too large. Videos must be under 5 minutes / 500MB.`);
        return;
      }

      if (wouldExceedStorageLimit(currentPhotoCount, list.length, currentPaidTier)) {
        setPendingFiles(list);
        setShowPayment(true);
        return;
      }

      addFilesToQueue(list);
    },
    [currentPhotoCount, currentPaidTier]
  );

  const handlePaymentComplete = async () => {
    setShowPayment(false);
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    if (pendingFiles?.length) {
      addFilesToQueue(pendingFiles);
      setPendingFiles(null);
    }
  };

  const processSingleFile = async (fileItem, index) => {
    setFiles((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: "processing", progress: 10, error: null } : item
      )
    );

    try {
      const fileType = fileItem.file.type.startsWith("video/") ? "video" : "image";
      const uploadResult = await base44.integrations.Core.UploadFile({ file: fileItem.file });

      setFiles((prev) =>
        prev.map((item, i) => (i === index ? { ...item, progress: 45 } : item))
      );

      const analysis = await analyzeMedia(uploadResult.file_url, fileType, fileItem.file.name);

      setFiles((prev) =>
        prev.map((item, i) => (i === index ? { ...item, progress: 80 } : item))
      );

      await base44.entities.Photo.create({
        file_url: uploadResult.file_url,
        file_type: fileType,
        ai_description: analysis.ai_description,
        ai_tags: analysis.ai_tags,
        upload_date: new Date().toISOString(),
        original_filename: fileItem.file.name,
      });

      setFiles((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                status: "success",
                progress: 100,
                ai_description: analysis.ai_description,
                ai_tags: analysis.ai_tags,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Upload failed:", error);
      setFiles((prev) =>
        prev.map((item, i) =>
          i === index
            ? { ...item, status: "error", error: error.message || "Upload failed", progress: 0 }
            : item
        )
      );
    }
  };

  const processPhotos = async () => {
    const pendingIndexes = files
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "pending")
      .map(({ index }) => index);

    if (!pendingIndexes.length) return;

    const pendingCount = pendingIndexes.length;
    if (wouldExceedStorageLimit(currentPhotoCount, pendingCount, currentPaidTier)) {
      setPendingFiles(pendingIndexes.map((i) => files[i].file));
      setShowPayment(true);
      return;
    }

    setProcessing(true);
    for (const index of pendingIndexes) {
      await processSingleFile(files[index], index);
    }
    setProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["photos"] });
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const retryFile = async (index) => {
    setFiles((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: "pending", progress: 0, error: null } : item
      )
    );
    setProcessing(true);
    await processSingleFile(files[index], index);
    setProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["photos"] });
  };

  const allProcessed = files.length > 0 && files.every((f) => f.status === "success" || f.status === "error");
  const hasSuccess = files.some((f) => f.status === "success");
  const tiersNeeded = getTiersNeeded(
    currentPhotoCount,
    pendingFiles?.length || 0,
    currentPaidTier
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload</h1>
            <p className="text-gray-600 mt-1">
              {currentPhotoCount} of {storageLimit} files used
              {currentPaidTier > 0 ? ` (${currentPaidTier} paid tier${currentPaidTier > 1 ? "s" : ""})` : ""}
            </p>
          </div>
        </div>

        {isMobile ? (
          <MobileUpload
            files={files}
            processing={processing}
            allProcessed={allProcessed}
            hasSuccess={hasSuccess}
            currentPhotoCount={currentPhotoCount}
            handleFileSelection={handleFileSelection}
            processPhotos={processPhotos}
            removeFile={removeFile}
            retryFile={retryFile}
          />
        ) : (
          <>
            <UploadZone onFilesSelected={handleFileSelection} />
            {files.length > 0 && (
              <div className="mt-6">
                {!processing && !allProcessed && files.some((f) => f.status === "pending") && (
                  <button
                    onClick={processPhotos}
                    className="w-full mb-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-2xl py-4 font-semibold"
                  >
                    Analyze & Save {files.filter((f) => f.status === "pending").length} Files
                  </button>
                )}
                <MobileUpload
                  files={files}
                  processing={processing}
                  allProcessed={allProcessed}
                  hasSuccess={hasSuccess}
                  currentPhotoCount={currentPhotoCount}
                  handleFileSelection={handleFileSelection}
                  processPhotos={processPhotos}
                  removeFile={removeFile}
                  retryFile={retryFile}
                />
              </div>
            )}
          </>
        )}
      </div>

      {showPayment && (
        <PaymentModal
          currentPhotoCount={currentPhotoCount}
          pendingUploadCount={pendingFiles?.length || tiersNeeded * 250}
          currentPaidTier={currentPaidTier}
          tiersNeeded={tiersNeeded}
          onClose={() => {
            setShowPayment(false);
            setPendingFiles(null);
          }}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </div>
  );
}
