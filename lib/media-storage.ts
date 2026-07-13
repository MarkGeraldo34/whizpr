import { put } from '@vercel/blob';

// Guard against pathologically large uploads chewing through Blob storage
// and function memory. Adjust to fit your plan's limits and expected media
// (a few minutes of phone video easily exceeds this — raise it if needed).
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface StoredMedia {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
}

/**
 * Uploads emergency report media (photo/video) to Vercel Blob and returns a
 * public URL for it. Throws a descriptive error if BLOB_READ_WRITE_TOKEN is
 * missing or the upload otherwise fails, so the route handler can surface a
 * clean 5xx instead of silently dropping the file.
 */
export async function storeEmergencyMedia(
  file: File,
  reporterAddress: string,
): Promise<StoredMedia> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured — cannot store emergency media');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Media file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max is ${
        MAX_UPLOAD_BYTES / (1024 * 1024)
      }MB.`,
    );
  }

  // Namespace by reporter + timestamp so files never collide and it's easy
  // to trace an upload back to who sent it and roughly when.
  const safeAddress = reporterAddress.toLowerCase();
  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const pathname = `alerts/${safeAddress}/${Date.now()}${extension ? `.${extension}` : ''}`;

  // Emergency media can capture victims, bystanders, or crime scenes who
  // never consented to being filmed — store it privately rather than at a
  // guessable public URL. Responders will need an authenticated route
  // (using @vercel/blob's `get()` with access: 'private') to view it.
  const blob = await put(pathname, file, {
    access: 'private',
    contentType: file.type || undefined,
    addRandomSuffix: true,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  };
}
