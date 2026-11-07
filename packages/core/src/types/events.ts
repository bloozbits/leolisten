import type { Track } from './track.js';
import type { PlaybackError, PlaybackMode, PlaybackState } from './player.js';

/**
 * Event payloads emitted by the Leolisen core audio engine.
 */
export type CoreEventMap = {
  'playback:state': [state: PlaybackState];
  'playback:time': [
    payload: {
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
    },
  ];
  'playback:trackChange': [track: Track | null];
  'playback:modeChange': [mode: PlaybackMode];
  'playback:volumeChange': [payload: { readonly volume: number; readonly muted: boolean }];
  'playback:error': [error: PlaybackError];
  'queue:updated': [
    payload: {
      readonly queue: readonly Track[];
      readonly currentIndex: number;
      readonly history: readonly Track[];
    },
  ];
  'queue:trackAdded': [payload: { readonly track: Track; readonly index: number }];
  'queue:trackRemoved': [payload: { readonly trackId: string; readonly index: number }];
  'cache:progress': [
    payload: {
      readonly trackId: string;
      readonly progress: number; // 0.0 to 1.0
      readonly totalBytes: number;
      readonly downloadedBytes: number;
    },
  ];
  'cache:completed': [payload: { readonly trackId: string; readonly sizeBytes: number }];
  'cache:evicted': [payload: { readonly trackId: string }];
  'storage:sync': [
    payload: {
      readonly type: 'favorites' | 'history' | 'playlists' | 'settings';
    },
  ];
};

export type EventListener<TArgs extends readonly unknown[]> = (...args: TArgs) => void;
export type Unsubscribe = () => void;

/**
 * Platform-agnostic, strictly typed event emitter with zero node/browser runtime dependencies.
 */
export class TypedEventEmitter<TEvents extends { [K in keyof TEvents]: readonly unknown[] }> {
  private readonly listeners = new Map<
    keyof TEvents,
    Set<EventListener<readonly unknown[]>>
  >();

  /**
   * Subscribes a listener to an event.
   * Returns an idempotent unsubscribe callback for seamless React/lifecycle cleanup.
   */
  public on<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
  ): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const genericListener = listener as EventListener<readonly unknown[]>;
    set.add(genericListener);

    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Subscribes a listener to run at most once.
   */
  public once<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
  ): Unsubscribe {
    const unsub = this.on(event, ((...args: TEvents[K]) => {
      unsub();
      listener(...args);
    }) as EventListener<TEvents[K]>);
    return unsub;
  }

  /**
   * Unsubscribes a listener from an event.
   */
  public off<K extends keyof TEvents>(
    event: K,
    listener: EventListener<TEvents[K]>,
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as EventListener<readonly unknown[]>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emits an event to all subscribed listeners.
   */
  public emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    // Iterate over a shallow copy to prevent modification issues during callback invocation
    const callbacks = Array.from(set);
    for (const callback of callbacks) {
      try {
        callback(...args);
      } catch (err) {
        // Unhandled listener errors must never break the core loop
        if (event !== ('playback:error' as unknown as K)) {
          // Fallback log or silent capture
        }
      }
    }
  }

  /**
   * Removes all listeners for a given event, or all listeners if event is omitted.
   */
  public removeAllListeners(event?: keyof TEvents): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Returns the count of registered listeners for an event.
   */
  public listenerCount(event: keyof TEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
