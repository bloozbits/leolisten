import { TrackItem } from '../types/music';
import { getRealAudioStream } from './innertubeService';

const DOWNLOADED_TRACKS_KEY = 'leolisten:downloaded_tracks';
const EVENT_NAME = 'leolisten:download_status_changed';
const CACHE_NAME = 'leolisten-offline-audio-v1';

const downloadingIds = new Set<string>();

/**
 * Checks whether the application is running inside a native desktop container (Tauri or Electron).
 */
export function isDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI__ ||
    (window as any).electron ||
    (window as any).__LEO_DESKTOP__
  );
}

/**
 * Retrieves all downloaded tracks from persistent local storage.
 */
export function getDownloadedTracks(): TrackItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DOWNLOADED_TRACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[DownloadService] Error reading downloaded tracks:', err);
    return [];
  }
}

/**
 * Checks if a track is currently being downloaded.
 */
export function isTrackDownloading(trackId: string): boolean {
  return downloadingIds.has(trackId);
}

/**
 * Checks if a track is stored in the user's Downloads library.
 */
export function isTrackDownloaded(trackId?: string): boolean {
  if (!trackId || typeof window === 'undefined') return false;
  const list = getDownloadedTracks();
  return list.some((t) => t.id === trackId);
}

/**
 * Adds a track to the Downloads library collection.
 */
export function addDownloadedTrack(track: TrackItem, extra?: Partial<TrackItem>): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getDownloadedTracks();
    const existingIndex = list.findIndex((t) => t.id === track.id);
    const updatedTrack: TrackItem = {
      ...track,
      ...extra,
      downloadedAt: Date.now(),
    };

    if (existingIndex !== -1) {
      list[existingIndex] = updatedTrack;
    } else {
      list.unshift(updatedTrack);
    }

    localStorage.setItem(DOWNLOADED_TRACKS_KEY, JSON.stringify(list));
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { trackId: track.id, track: updatedTrack, status: 'downloaded', list },
      })
    );
  } catch (err) {
    console.warn('[DownloadService] Error saving downloaded track:', err);
  }
}

/**
 * Removes a track from the Downloads library and deletes its offline cache.
 */
export async function removeDownloadedTrack(trackId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const list = getDownloadedTracks().filter((t) => t.id !== trackId);
    localStorage.setItem(DOWNLOADED_TRACKS_KEY, JSON.stringify(list));

    // Remove from browser CacheStorage
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.delete(`/offline-audio/${trackId}`);
      } catch (e) {
        // non-blocking
      }
    }

    // Remove from native desktop filesystem if running in desktop container
    if (isDesktopApp()) {
      try {
        if ((window as any).__TAURI__?.invoke) {
          await (window as any).__TAURI__.invoke('leolisten_delete_downloaded_track', { id: trackId });
        } else if ((window as any).electron?.deleteDownloadedTrack) {
          await (window as any).electron.deleteDownloadedTrack(trackId);
        }
      } catch (e) {
        // non-blocking
      }
    }

    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { trackId, status: 'removed', list },
      })
    );
  } catch (err) {
    console.warn('[DownloadService] Error removing downloaded track:', err);
  }
}

/**
 * Retrieves the local offline stream URL (blob or local file URI) if the track is downloaded.
 * Enables instant, zero-bandwidth playback without an internet connection.
 */
export async function getOfflineAudioUrl(trackId: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  const track = getDownloadedTracks().find((t) => t.id === trackId);
  if (!track) return null;

  // 1. Native Desktop local file path
  if (track.localFilePath) {
    if ((window as any).__TAURI__?.core?.convertFileSrc) {
      return (window as any).__TAURI__.core.convertFileSrc(track.localFilePath);
    }
    return `file:///${track.localFilePath.replace(/\\/g, '/')}`;
  }

  // 2. Web browser CacheStorage
  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const res = await cache.match(`/offline-audio/${trackId}`);
      if (res) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      console.warn('[DownloadService] Offline CacheStorage audio lookup failed:', err);
    }
  }

  return null;
}

/**
 * Downloads a track and records it to the Downloads library.
 * Works seamlessly in both Web browser and Native Desktop application runtimes.
 */
export async function downloadTrack(track: TrackItem, force = false): Promise<boolean> {
  if (downloadingIds.has(track.id)) return false;
  if (!force && isTrackDownloaded(track.id)) {
    // Already downloaded, prevent duplicate re-downloading
    return true;
  }

  try {
    downloadingIds.add(track.id);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { trackId: track.id, status: 'downloading' },
      })
    );

    const stream = await getRealAudioStream(track.id);
    if (!stream || !stream.streamUrl) {
      throw new Error('Audio stream unavailable');
    }

    const ext = stream.codec === 'opus' ? 'opus' : 'webm';
    const cleanArtist = (track.artist || 'Unknown Artist').replace(/[/\\?%*:|"<>]/g, '');
    const cleanTitle = (track.title || 'Track').replace(/[/\\?%*:|"<>]/g, '');
    const filename = `${cleanArtist} - ${cleanTitle}.${ext}`;

    let localFilePath: string | undefined = undefined;

    // 1. Native Desktop Application path (Tauri or Electron)
    if (isDesktopApp()) {
      try {
        if ((window as any).__TAURI__?.invoke) {
          const res = await (window as any).__TAURI__.invoke('leolisten_download_track', {
            id: track.id,
            url: stream.streamUrl,
            filename,
          });
          if (res?.filePath) {
            localFilePath = res.filePath;
          }
        } else if ((window as any).electron?.downloadTrack) {
          const res = await (window as any).electron.downloadTrack({
            track,
            url: stream.streamUrl,
            filename,
          });
          if (res?.filePath) {
            localFilePath = res.filePath;
          }
        }
      } catch (desktopErr) {
        console.warn('[DownloadService] Native desktop download call note:', desktopErr);
      }
    }

    // 2. Web browser download stream
    const isBrowser = !isDesktopApp();
    const downloadUrl = isBrowser
      ? `/yt-download-stream?url=${encodeURIComponent(stream.streamUrl)}&filename=${encodeURIComponent(filename)}`
      : stream.streamUrl;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 3. Cache audio binary in browser CacheStorage for offline playback
    if ('caches' in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        const audioFetch = await fetch(downloadUrl);
        if (audioFetch.ok) {
          await cache.put(`/offline-audio/${track.id}`, audioFetch);
        }
      } catch (cacheErr) {
        console.warn('[DownloadService] Offline CacheStorage cache note:', cacheErr);
      }
    }

    // 4. Save to Downloads library collection
    addDownloadedTrack(track, { localFilePath });
    return true;
  } catch (err) {
    console.warn(`[DownloadService] Failed to download track ${track.title}:`, err);
    return false;
  } finally {
    downloadingIds.delete(track.id);
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { trackId: track.id, status: 'idle' },
      })
    );
  }
}

/**
 * Subscribes to changes in download statuses and the Downloads library.
 */
export function subscribeToDownloads(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener('storage', (e) => {
    if (e.key === DOWNLOADED_TRACKS_KEY) {
      callback();
    }
  });
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
  };
}
