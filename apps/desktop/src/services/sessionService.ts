import { TrackItem } from '../types/music';
import { RepeatState } from '../components/player/PlayerControls';

const HISTORY_KEY = 'leolisten:listening_history';
const SESSION_KEY = 'leolisten:playback_session';
const HISTORY_EVENT = 'leolisten:history_changed';
const MAX_HISTORY = 50;

export interface SavedPlaybackSession {
  track: TrackItem | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatState;
  isShuffle: boolean;
  queue: TrackItem[];
  upNextTracks: TrackItem[];
  savedAt: number;
}

/**
 * Returns the list of recently listened tracks in descending chronological order.
 */
export function getListeningHistory(): TrackItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[SessionService] Error loading listening history:', err);
    return [];
  }
}

/**
 * Records a track into the user's listening history.
 * Pushes to the front, deduplicates older occurrences, and caps at MAX_HISTORY.
 */
export function recordTrackToHistory(track: TrackItem): void {
  if (!track || !track.id || typeof window === 'undefined') return;
  try {
    const history = getListeningHistory().filter((t) => t.id !== track.id);
    history.unshift(track);
    const trimmed = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT, { detail: { history: trimmed, track } }));
  } catch (err) {
    console.warn('[SessionService] Error recording track history:', err);
  }
}

/**
 * Subscribes to changes in listening history.
 */
export function subscribeToHistory(callback: (history: TrackItem[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    callback(getListeningHistory());
  };
  window.addEventListener(HISTORY_EVENT, handler);
  window.addEventListener('storage', (e) => {
    if (e.key === HISTORY_KEY) {
      handler();
    }
  });
  return () => {
    window.removeEventListener(HISTORY_EVENT, handler);
  };
}

/**
 * Persists current audio playback position and player state so user resumes seamlessly.
 */
export function savePlaybackSession(session: SavedPlaybackSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('[SessionService] Error saving playback session:', err);
  }
}

/**
 * Retrieves the last saved playback session to restore on startup.
 */
export function getSavedPlaybackSession(): SavedPlaybackSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedPlaybackSession;
  } catch (err) {
    console.warn('[SessionService] Error retrieving playback session:', err);
    return null;
  }
}

