// In-memory cache for audio blobs and object URLs
const blobCache = new Map<string, Blob>();
const urlCache = new Map<string, string>();
const cachedTrackIds = new Set<string>();

/**
 * Returns a set of all currently cached track IDs.
 */
export function getCachedTrackIds(): Set<string> {
  return new Set(cachedTrackIds);
}

/**
 * Fetches and caches audio by track ID, returning a playable Object URL.
 */
export async function cacheAndGetAudioUrl(
  trackId: string,
  audioUrl: string
): Promise<{ objectUrl: string }> {
  // Return existing object URL if cached
  if (urlCache.has(trackId)) {
    return { objectUrl: urlCache.get(trackId)! };
  }

  const blob = await getTrackBlob(trackId, audioUrl);
  const objectUrl = URL.createObjectURL(blob);
  urlCache.set(trackId, objectUrl);
  return { objectUrl };
}

/**
 * Fetches an audio blob either from memory cache or network via local proxy or direct fetch.
 */
export async function getTrackBlob(trackId: string, audioUrl: string): Promise<Blob> {
  if (blobCache.has(trackId)) {
    return blobCache.get(trackId)!;
  }

  // Use proxy endpoint to bypass CORS for external music URLs
  const isExternal = audioUrl.startsWith('http://') || audioUrl.startsWith('https://');
  const proxyUrl = isExternal
    ? `/api/bgm-stream?url=${encodeURIComponent(audioUrl)}`
    : audioUrl;

  try {
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      blobCache.set(trackId, blob);
      cachedTrackIds.add(trackId);
      return blob;
    }
  } catch (proxyErr) {
    console.warn(`[bgmCache] Proxy failed for ${audioUrl}, trying direct:`, proxyErr);
  }

  // Fallback to direct fetch
  try {
    const fallbackRes = await fetch(audioUrl);
    if (!fallbackRes.ok) {
      throw new Error(`Failed to load audio (${fallbackRes.status})`);
    }
    const blob = await fallbackRes.blob();
    blobCache.set(trackId, blob);
    cachedTrackIds.add(trackId);
    return blob;
  } catch (err: any) {
    console.error(`[bgmCache] Could not fetch track ${trackId}:`, err);
    throw new Error(`Failed to load audio stream`);
  }
}

/**
 * Clear cached object URLs to free memory.
 */
export function clearBgmCache(): void {
  urlCache.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  urlCache.clear();
  blobCache.clear();
  cachedTrackIds.clear();
}
