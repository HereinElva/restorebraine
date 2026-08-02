/**
 * Overlapping upload and save pools — uploads never wait on DB writes.
 */
export async function runUploadSavePipeline({
  items,
  uploadConcurrency,
  saveConcurrency,
  uploadOne,
  saveOne,
}) {
  const results = new Array(items.length);
  let nextUpload = 0;
  let activeUploads = 0;
  let activeSaves = 0;
  const saveQueue = [];

  return new Promise((resolve, reject) => {
    const maybeDone = () => {
      if (
        nextUpload >= items.length &&
        activeUploads === 0 &&
        activeSaves === 0 &&
        saveQueue.length === 0
      ) {
        resolve(results);
      }
    };

    const pumpSaves = () => {
      while (saveQueue.length > 0 && activeSaves < saveConcurrency) {
        const job = saveQueue.shift();
        activeSaves += 1;
        saveOne(job)
          .then((result) => {
            results[job.index] = result;
          })
          .catch((error) => {
            results[job.index] = {
              index: job.index,
              success: false,
              error: error?.message || 'Save failed',
            };
          })
          .finally(() => {
            activeSaves -= 1;
            pumpSaves();
            maybeDone();
          });
      }
    };

    const startUpload = (item, index) => {
      activeUploads += 1;
      uploadOne(item, index)
        .then((uploaded) => {
          if (uploaded?.file_url) {
            saveQueue.push({ item, index, uploaded });
            pumpSaves();
          } else {
            results[index] = uploaded || { index, success: false };
          }
        })
        .catch((error) => {
          results[index] = {
            index,
            success: false,
            error: error?.message || 'Upload failed',
          };
        })
        .finally(() => {
          activeUploads -= 1;
          while (nextUpload < items.length && activeUploads < uploadConcurrency) {
            const i = nextUpload;
            nextUpload += 1;
            startUpload(items[i], i);
          }
          maybeDone();
        });
    };

    if (!items.length) {
      resolve([]);
      return;
    }

    try {
      const initial = Math.min(uploadConcurrency, items.length);
      for (let i = 0; i < initial; i++) {
        const index = nextUpload;
        nextUpload += 1;
        startUpload(items[index], index);
      }
    } catch (error) {
      reject(error);
    }
  });
}
