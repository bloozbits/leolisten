import { TrackItem } from '../types/music';

const LIKED_SONGS_KEY = 'leolisten:liked_songs';
const EVENT_NAME = 'leolisten:liked_songs_changed';

/**
 * Returns all saved Liked Songs from localStorage.
 */
export function getLikedSongs(): TrackItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIKED_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[LikedSongsService] Error reading liked songs:', err);
    return [];
  }
}

/**
 * Checks if a track is in the Liked Songs collection.
 */
export function isSongLiked(trackId?: string): boolean {
  if (!trackId || typeof window === 'undefined') return false;
  const list = getLikedSongs();
  return list.some((t) => t.id === trackId);
}

/**
 * Toggles a track's liked status in persistent storage.
 * Returns true if the song is now liked, false if unliked.
 */
export function toggleLikeSong(track: TrackItem): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const list = getLikedSongs();
    const existingIndex = list.findIndex((t) => t.id === track.id);
    let isNowLiked = false;

    if (existingIndex !== -1) {
      list.splice(existingIndex, 1);
      isNowLiked = false;
    } else {
      list.unshift(track);
      isNowLiked = true;
    }

    localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list, track, isNowLiked } }));
    return isNowLiked;
  } catch (err) {
    console.warn('[LikedSongsService] Error updating liked songs:', err);
    return false;
  }
}

/**
 * Removes a track from Liked Songs by its ID.
 */
export function removeLikedSong(trackId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = getLikedSongs();
    const filtered = list.filter((t) => t.id !== trackId);
    localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { list: filtered } }));
  } catch (err) {
    console.warn('[LikedSongsService] Error removing liked song:', err);
  }
}

/**
 * Subscribes to changes in Liked Songs across the application.
 */
export function subscribeToLikedSongs(callback: (tracks: TrackItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => { };

  const handler = () => {
    callback(getLikedSongs());
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === LIKED_SONGS_KEY) {
      handler();
    }
  });

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
  };
}

