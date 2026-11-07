import type { Unsubscribe } from './events.js';
import type { PlaybackError } from './player.js';

/**
 * ============================================================================
 * HTTP CLIENT PORT
 * ============================================================================
 * Abstract HTTP interface allowing Leolisen to run in React Native (fetch),
 * Tauri/Desktop (native rust HTTP or node-fetch), and Web (browser fetch).
 */

export interface HttpRequestOptions {
  readonly headers?: Record<string, string>;
  readonly params?: Record<string, string | number | boolean>;
  readonly timeoutMs?: number;
  readonly responseType?: 'json' | 'text' | 'arraybuffer';
  readonly signal?: AbortSignal;
}

export interface HttpResponse<T> {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Record<string, string>;
  readonly data: T;
}

export interface IHttpClientAdapter {
  get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

/**
 * ============================================================================
 * STORAGE PORT
 * ============================================================================
 * Abstract Key-Value / Relational store abstraction.
 * Implemented via AsyncStorage/MMKV (React Native), IndexedDB (Web), SQLite/Filesystem (Desktop).
 */

export interface IStorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
  multiGet<T>(keys: readonly string[]): Promise<Map<string, T>>;
  multiSet<T>(entries: readonly (readonly [string, T])[]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/**
 * ============================================================================
 * BINARY CACHE STORAGE PORT
 * ============================================================================
 * Binary stream chunk & file persistence for offline caching.
 */

export interface ICacheStorageAdapter {
  save(id: string, data: Uint8Array): Promise<void>;
  read(id: string): Promise<Uint8Array | null>;
  has(id: string): Promise<boolean>;
  getSize(id: string): Promise<number>;
  delete(id: string): Promise<void>;
  getUri(id: string): Promise<string | null>;
  clear(): Promise<void>;
}

/**
 * ============================================================================
 * AUDIO SINK PORT
 * ============================================================================
 * Abstract audio player driver.
 * Implemented via HTML5 Audio / Web Audio API (Web), react-native-track-player (Mobile),
 * or Rodio / Symphonia / native audio bindings (Tauri Desktop).
 */

export interface AudioSinkSource {
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly artworkUrl?: string;
  readonly durationSec?: number;
}

export type AudioSinkState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

export interface AudioSinkTime {
  readonly positionSec: number;
  readonly durationSec: number;
  readonly bufferedSec: number;
}

export interface AudioSinkError extends PlaybackError {}

export interface IAudioSinkAdapter {
  load(source: AudioSinkSource): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(positionSec: number): Promise<void>;
  setVolume(volume: number): Promise<void>; // 0.0 to 1.0
  setMuted(muted: boolean): Promise<void>;
  setPlaybackRate(rate: number): Promise<void>; // 0.5 to 2.0
  getPosition(): Promise<number>;
  getDuration(): Promise<number>;
  getBufferedPosition(): Promise<number>;

  // Event callbacks
  onStateChange(listener: (state: AudioSinkState) => void): Unsubscribe;
  onTimeUpdate(listener: (time: AudioSinkTime) => void): Unsubscribe;
  onError(listener: (error: AudioSinkError) => void): Unsubscribe;
  onEnded(listener: () => void): Unsubscribe;

  dispose(): Promise<void>;
}
