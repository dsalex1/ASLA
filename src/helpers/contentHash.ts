import { StorageReference, UploadMetadata, uploadBytes } from 'firebase/storage'

/**
 * sha-256 of the bytes, as hex. 16 chars (64 bits) identifies a blob in the offline
 * cache; `pdfStorageSHA` asks for the full 64 because it compares against values written
 * before this helper existed.
 */
export async function sha(data: Blob | ArrayBuffer | Uint8Array, chars = 16) {
  const digest = await crypto.subtle.digest('SHA-256', data instanceof Blob ? await data.arrayBuffer() : data)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, chars)
}

/** Uploads and returns the content hash, so the stored bytes and the hash cannot drift apart. */
export async function uploadHashed(ref: StorageReference, data: Blob | Uint8Array, metadata?: UploadMetadata) {
  await uploadBytes(ref, data, metadata)
  return await sha(data)
}
