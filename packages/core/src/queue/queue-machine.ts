import type { RepeatMode } from '../types/player.js';
import type { Track } from '../types/track.js';

export interface QueueSnapshot {
  readonly queue: readonly Track[];
  readonly originalQueue: readonly Track[];
  readonly currentIndex: number;
  readonly history: readonly Track[];
  readonly repeatMode: RepeatMode;
  readonly isShuffled: boolean;
}

export interface QueueMachineOptions {
  readonly initialTracks?: readonly Track[];
  readonly initialIndex?: number;
  readonly repeatMode?: RepeatMode;
  readonly isShuffled?: boolean;
  readonly maxHistoryLength?: number;
}

/**
 * Deterministic, headless queue state machine.
 *
 * Provides robust queue navigation, Fisher-Yates shuffle with lossless un-shuffle,
 * persistent history tracking, and repeat mode compliance.
 */
export class QueueMachine {
  private queue: Track[] = [];
  private originalQueue: Track[] = [];
  private currentIndex: number = -1;
  private history: Track[] = [];
  private repeatMode: RepeatMode = 'off';
  private isShuffled: boolean = false;
  private readonly maxHistoryLength: number;

  public constructor(options?: QueueMachineOptions) {
    this.maxHistoryLength = options?.maxHistoryLength ?? 100;
    this.repeatMode = options?.repeatMode ?? 'off';

    if (options?.initialTracks && options.initialTracks.length > 0) {
      this.setQueue(options.initialTracks, options.initialIndex ?? 0);
    }
  }

  /**
   * Sets a new list of tracks and sets the active index.
   */
  public setQueue(tracks: readonly Track[], startIndex: number = 0): void {
    this.originalQueue = [...tracks];
    this.queue = [...tracks];
    this.isShuffled = false;
    this.currentIndex = Math.max(0, Math.min(startIndex, this.queue.length - 1));
  }

  /**
   * Appends or inserts a track relative to current playing item.
   */
  public addTrack(track: Track, position: 'next' | 'end' = 'end'): void {
    if (position === 'next' && this.currentIndex !== -1 && this.currentIndex < this.queue.length) {
      const insertIdx = this.currentIndex + 1;
      this.queue.splice(insertIdx, 0, track);
      this.originalQueue.push(track);
    } else {
      this.queue.push(track);
      this.originalQueue.push(track);
      if (this.currentIndex === -1) {
        this.currentIndex = 0;
      }
    }
  }

  /**
   * Batch adds multiple tracks.
   */
  public addTracks(tracks: readonly Track[], position: 'next' | 'end' = 'end'): void {
    if (position === 'next' && this.currentIndex !== -1) {
      const insertIdx = this.currentIndex + 1;
      this.queue.splice(insertIdx, 0, ...tracks);
      this.originalQueue.push(...tracks);
    } else {
      this.queue.push(...tracks);
      this.originalQueue.push(...tracks);
      if (this.currentIndex === -1 && this.queue.length > 0) {
        this.currentIndex = 0;
      }
    }
  }

  /**
   * Removes a track at a specific index.
   */
  public removeTrack(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;

    const [removed] = this.queue.splice(index, 1);
    if (!removed) return null;

    // Remove from originalQueue
    const origIdx = this.originalQueue.findIndex((t) => t.id === removed.id);
    if (origIdx !== -1) {
      this.originalQueue.splice(origIdx, 1);
    }

    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = this.queue.length - 1;
      }
    }

    return removed;
  }

  /**
   * Reorders a track from one index to another.
   */
  public moveTrack(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const currentTrack = this.currentTrack;
    const [moved] = this.queue.splice(fromIndex, 1);
    if (!moved) return;
    this.queue.splice(toIndex, 0, moved);

    // Update currentIndex to follow currently playing track
    if (currentTrack) {
      this.currentIndex = this.queue.findIndex((t) => t.id === currentTrack.id);
    }
  }

  /**
   * Advances to the next track according to repeat mode and queue boundaries.
   * Pushes completed track into playback history.
   */
  public next(force: boolean = false): Track | null {
    const current = this.currentTrack;

    if (!force && this.repeatMode === 'one' && current) {
      return current;
    }

    if (current) {
      this.pushHistory(current);
    }

    if (this.queue.length === 0) return null;

    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.currentTrack;
    }

    if (this.repeatMode === 'all') {
      this.currentIndex = 0;
      return this.currentTrack;
    }

    // End of queue reached and repeat is off
    return null;
  }

  /**
   * Retreats to previous track, or re-plays current track if played past threshold.
   */
  public previous(currentPositionSec: number = 0, thresholdSec: number = 3): Track | null {
    const current = this.currentTrack;

    // If played more than threshold seconds, seek back to start of current track
    if (currentPositionSec > thresholdSec && current) {
      return current;
    }

    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.currentTrack;
    }

    // If at queue start, check if history has a previous track
    if (this.history.length > 0) {
      const prevFromHistory = this.history.pop();
      if (prevFromHistory) {
        this.queue.unshift(prevFromHistory);
        this.currentIndex = 0;
        return prevFromHistory;
      }
    }

    // If repeat is 'all', jump to the end of the queue
    if (this.repeatMode === 'all' && this.queue.length > 0) {
      this.currentIndex = this.queue.length - 1;
      return this.currentTrack;
    }

    return current;
  }

  /**
   * Jumps directly to a target queue index.
   */
  public jumpTo(index: number): Track | null {
    if (index < 0 || index >= this.queue.length) return null;
    if (this.currentTrack) {
      this.pushHistory(this.currentTrack);
    }
    this.currentIndex = index;
    return this.currentTrack;
  }

  /**
   * Toggles shuffle.
   * When enabled: keeps the active track at index 0 and shuffles the remaining tracks.
   * When disabled: restores exact original un-shuffled queue while keeping current track active.
   */
  public toggleShuffle(): boolean {
    if (this.isShuffled) {
      // Un-shuffle: restore originalQueue
      const activeTrack = this.currentTrack;
      this.queue = [...this.originalQueue];
      this.isShuffled = false;

      if (activeTrack) {
        const restoredIdx = this.queue.findIndex((t) => t.id === activeTrack.id);
        this.currentIndex = restoredIdx !== -1 ? restoredIdx : 0;
      }
    } else {
      // Shuffle
      if (this.queue.length <= 1) {
        this.isShuffled = true;
        return true;
      }

      const activeTrack = this.currentTrack;
      const remaining = this.queue.filter((_, idx) => idx !== this.currentIndex);

      // Fisher-Yates shuffle
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = remaining[i]!;
        remaining[i] = remaining[j]!;
        remaining[j] = temp;
      }

      this.queue = activeTrack ? [activeTrack, ...remaining] : remaining;
      this.currentIndex = activeTrack ? 0 : -1;
      this.isShuffled = true;
    }

    return this.isShuffled;
  }

  /**
   * Sets repeat mode.
   */
  public setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
  }

  /**
   * Cycles through repeat modes: off -> all -> one -> off.
   */
  public cycleRepeatMode(): RepeatMode {
    switch (this.repeatMode) {
      case 'off':
        this.repeatMode = 'all';
        break;
      case 'all':
        this.repeatMode = 'one';
        break;
      case 'one':
        this.repeatMode = 'off';
        break;
    }
    return this.repeatMode;
  }

  /**
   * Clears queue and history.
   */
  public clear(): void {
    this.queue = [];
    this.originalQueue = [];
    this.history = [];
    this.currentIndex = -1;
    this.isShuffled = false;
  }

  // --- Getters ---

  public get currentTrack(): Track | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
      return null;
    }
    return this.queue[this.currentIndex] ?? null;
  }

  public get tracks(): readonly Track[] {
    return this.queue;
  }

  public get historyTracks(): readonly Track[] {
    return this.history;
  }

  public get index(): number {
    return this.currentIndex;
  }

  public get repeat(): RepeatMode {
    return this.repeatMode;
  }

  public get shuffled(): boolean {
    return this.isShuffled;
  }

  public get hasNext(): boolean {
    if (this.queue.length === 0) return false;
    if (this.repeatMode !== 'off') return true;
    return this.currentIndex < this.queue.length - 1;
  }

  public get hasPrevious(): boolean {
    if (this.currentIndex > 0) return true;
    if (this.history.length > 0) return true;
    return this.repeatMode === 'all' && this.queue.length > 0;
  }

  public get remainingCount(): number {
    if (this.currentIndex === -1) return this.queue.length;
    return Math.max(0, this.queue.length - 1 - this.currentIndex);
  }

  /**
   * Creates an immutable serializable snapshot of the queue state.
   */
  public getSnapshot(): QueueSnapshot {
    return {
      queue: [...this.queue],
      originalQueue: [...this.originalQueue],
      currentIndex: this.currentIndex,
      history: [...this.history],
      repeatMode: this.repeatMode,
      isShuffled: this.isShuffled,
    };
  }

  /**
   * Restores queue machine from an existing snapshot.
   */
  public restoreSnapshot(snapshot: QueueSnapshot): void {
    this.queue = [...snapshot.queue];
    this.originalQueue = [...snapshot.originalQueue];
    this.currentIndex = snapshot.currentIndex;
    this.history = [...snapshot.history];
    this.repeatMode = snapshot.repeatMode;
    this.isShuffled = snapshot.isShuffled;
  }

  private pushHistory(track: Track): void {
    this.history.push(track);
    if (this.history.length > this.maxHistoryLength) {
      this.history.shift();
    }
  }
}
