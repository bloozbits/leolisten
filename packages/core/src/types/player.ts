import type { Track } from './track.js';

/**
 * High-level playback status states for the state machine.
 */
export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

/**
 * Repeat modes for playback.
 * - 'off': Standard sequential playback, stops at queue end.
 * - 'all': Loops back to the queue head when the queue completes.
 * - 'one': Continuously repeats the current track.
 */
export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Playback behavior configuration.
 */
export interface PlaybackMode {
  readonly repeat: RepeatMode;
  readonly shuffle: boolean;
  readonly autoplayRadio: boolean;
}

/**
 * Audio codec options available from YouTube Music streams.
 */
export type AudioCodec = 'opus' | 'aac' | 'unknown';

/**
 * Target stream quality presets.
 * - 'low': ~48-64kbps Opus/AAC (Bandwidth saver / mobile network)
 * - 'medium': ~128kbps Opus/AAC (Balanced standard)
 * - 'high': ~160kbps Opus / 256kbps AAC (High fidelity)
 * - 'ultra': Maximum available bitrate from provider
 */
export type AudioQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Normalized extracted audio stream metadata.
 */
export interface AudioFormat {
  readonly itag: number;
  readonly mimeType: string;
  readonly codec: AudioCodec;
  readonly bitrate: number;
  readonly averageBitrate?: number;
  readonly sampleRate?: number;
  readonly channels?: number;
  readonly contentLength?: number;
  readonly url: string;
  readonly isDash: boolean;
  readonly isHls: boolean;
  readonly quality: AudioQuality;
}

/**
 * Resolved stream ready for audio sink playback.
 */
export interface StreamResolution {
  readonly trackId: string;
  readonly format: AudioFormat;
  readonly expiresAt: number; // Unix timestamp ms
  readonly cachedLocally: boolean;
  readonly localUri?: string;
}

/**
 * Standard error codes across audio operations.
 */
export type PlaybackErrorCode =
  | 'NETWORK_ERROR'
  | 'DECODE_ERROR'
  | 'UNPLAYABLE_TRACK'
  | 'STREAM_EXPIRED'
  | 'SINK_INITIALIZATION_FAILED'
  | 'UNKNOWN_ERROR';

export interface PlaybackError {
  readonly code: PlaybackErrorCode;
  readonly message: string;
  readonly fatal: boolean;
  readonly underlyingError?: unknown;
}

/**
 * Fully typed, discriminated union representing every valid playback state.
 */
export type PlaybackState =
  | {
      readonly status: 'idle';
      readonly track?: undefined;
      readonly positionSec: 0;
      readonly durationSec: 0;
      readonly bufferedSec: 0;
      readonly error?: undefined;
    }
  | {
      readonly status: 'loading';
      readonly track: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error?: undefined;
    }
  | {
      readonly status: 'playing';
      readonly track: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error?: undefined;
    }
  | {
      readonly status: 'paused';
      readonly track: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error?: undefined;
    }
  | {
      readonly status: 'buffering';
      readonly track: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error?: undefined;
    }
  | {
      readonly status: 'ended';
      readonly track: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error?: undefined;
    }
  | {
      readonly status: 'error';
      readonly track?: Track;
      readonly positionSec: number;
      readonly durationSec: number;
      readonly bufferedSec: number;
      readonly error: PlaybackError;
    };
