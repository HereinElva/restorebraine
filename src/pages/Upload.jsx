import React, { useState, useCallback, useEffect, useRef } from "react";
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
import {
  MAX_BATCH_SIZE,
  processSingleUpload,
  processUploadBatch,
  validateFiles,
} from "@/lib/media-upload";

export default function Upload() {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null);
  const autoProcessRef = useRef(false);
  const filesRef = useRef(files);
  filesRef.current = files;

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

  const updateFileAt = useCallback((index, patch) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }, []);

  const addFilesToQueue = useCallback((incoming) => {
    const list = Array.from(incoming || []);
    const queued = list.map((file) => ({
      file,
      status: "pending",
      progress: 0,
      error: null,
      ai_description: null,
      ai_tags: null,
      phase: null,
    }));
    setFiles((prev) => [...prev, ...queued]);
    autoProcessRef.current = true;
  }, []);

  const handleFileSelection = useCallback(
    (incoming) => {
      const { valid, error } = validateFiles(incoming);
      if (error) {
        alert(error);
        return;
      }
      if (!valid.length) return;

      if (wouldExceedStorageLimit(currentPhotoCount, valid.length, currentPaidTier)) {
        setPendingFiles(valid);
        setShowPayment(true);
        return;
      }

      addFilesToQueue(valid);
    },
    [addFilesToQueue, currentPhotoCount, currentPaidTier],
  );

  const handlePaymentComplete = async () => {
    setShowPayment(false);
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    if (pendingFiles?.length) {
      addFilesToQueue(pendingFiles);
      setPendingFiles(null);
    }
  };

  const processPhotos = useCallback(async () => {
    const currentFiles = filesRef.current;
    const pendingItems = currentFiles
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === "pending");

    if (!pendingItems.length || processing) return;

    const pendingCount = pendingItems.length;
    if (wouldExceedStorageLimit(currentPhotoCount, pendingCount, currentPaidTier)) {
      setPendingFiles(pendingItems.map(({ item }) => item.file));
      setShowPayment(true);
      return;
    }

    const indexes = pendingItems.map(({ index }) => index);
    const queueItems = pendingItems.map(({ item }) => item);

    setFiles((prev) =>
      prev.map((item, i) =>
        indexes.includes(i) ? { ...item, status: "processing", progress: 5 } : item,
      ),
    );
    setProcessing(true);

    try {
      await processUploadBatch(queueItems, {
        onItemUpdate: (batchIndex, patch) => {
          updateFileAt(indexes[batchIndex], patch);
        },
      });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    } catch (error) {
      console.error("Batch upload failed:", error);
    } finally {
      setProcessing(false);
    }
  }, [currentPhotoCount, currentPaidTier, processing, queryClient, updateFileAt]);

  useEffect(() => {
    if (!autoProcessRef.current || processing || showPayment) return;

    const hasPending = files.some((f) => f.status === "pending");
    if (hasPending) {
      autoProcessRef.current = false;
      processPhotos();
    }
  }, [files, processing, showPayment, processPhotos]);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const retryFile = async (index) => {
    const fileItem = filesRef.current[index];
    if (!fileItem) return;

    updateFileAt(index, { status: "pending", progress: 0, error: null, phase: null });
    setProcessing(true);

    await processSingleUpload(fileItem, {
      onUpdate: (patch) => updateFileAt(index, patch),
    });

    setProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["photos"] });
  };

  const allProcessed =
    files.length > 0 && files.every((f) => f.status === "success" || f.status === "error");
  const hasSuccess = files.some((f) => f.status === "success");
  const tiersNeeded = getTiersNeeded(
    currentPhotoCount,
    pendingFiles?.length || 0,
    currentPaidTier,
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
            <p className="text-sm text-gray-500 mt-0.5">
              Up to {MAX_BATCH_SIZE} files per batch · processed in parallel
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
