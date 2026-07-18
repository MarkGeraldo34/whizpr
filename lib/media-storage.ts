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
export async function storeEmergencyMedia(file: File): Promise<StoredMedia> {
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

  // Media is public (shown on the feed to any visitor), so the path must not
  // embed the reporter's wallet address — that would de-anonymize them via
  // the media URL even though the feed API itself never returns their
  // address. A random id plus addRandomSuffix below is enough to avoid
  // collisions without linking the file back to who uploaded it.
  const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
  const pathname = `alerts/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;

  const blob = await put(pathname, file, {
    access: 'public',
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
