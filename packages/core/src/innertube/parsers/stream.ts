import type {
  AudioCodec,
  AudioFormat,
  AudioQuality,
  PlaybackError,
} from '../../types/player.js';
import { parseQueryString, resolveFormatStreamUrl, type RawStreamFormat } from '../cipher.js';

/**
 * Result of parsing Innertube player response.
 */
export interface ParsedStreamManifest {
  readonly videoId: string;
  readonly isLive: boolean;
  readonly durationSec: number;
  readonly formats: readonly AudioFormat[];
  readonly dashManifestUrl?: string;
  readonly hlsManifestUrl?: string;
  readonly expiresAt: number; // Unix timestamp ms
}

/**
 * Parses YouTube Music Innertube /player response into typed audio formats.
 */
export function parsePlayerResponse(
  videoId: string,
  data: Record<string, unknown>,
  decipherOps?: readonly (readonly [action: 'reverse' | 'splice' | 'swap', param: number])[],
): ParsedStreamManifest {
  // 1. Playability Check
  const playabilityStatus = data['playabilityStatus'] as Record<string, unknown> | undefined;
  const status = typeof playabilityStatus?.['status'] === 'string' ? playabilityStatus['status'] : 'UNKNOWN';

  if (status !== 'OK') {
    const reason =
      typeof playabilityStatus?.['reason'] === 'string'
        ? playabilityStatus['reason']
        : `Track is not playable: status=${status}`;

    const error: PlaybackError = {
      code: 'UNPLAYABLE_TRACK',
      message: reason,
      fatal: true,
      underlyingError: playabilityStatus,
    };
    throw error;
  }

  // 2. Video Details
  const videoDetails = data['videoDetails'] as Record<string, unknown> | undefined;
  const isLive = Boolean(videoDetails?.['isLiveContent']);
  const lengthSeconds = typeof videoDetails?.['lengthSeconds'] === 'string'
    ? parseInt(videoDetails['lengthSeconds'], 10)
    : 0;

  // 3. Streaming Data
  const streamingData = data['streamingData'] as Record<string, unknown> | undefined;
  if (!streamingData) {
    throw {
      code: 'UNPLAYABLE_TRACK',
      message: 'No streamingData found in player response',
      fatal: true,
    } as PlaybackError;
  }

  const rawAdaptiveFormats = Array.isArray(streamingData['adaptiveFormats'])
    ? (streamingData['adaptiveFormats'] as unknown[])
    : [];

  const rawStandardFormats = Array.isArray(streamingData['formats'])
    ? (streamingData['formats'] as unknown[])
    : [];

  const allRawFormats = [...rawAdaptiveFormats, ...rawStandardFormats];
  const audioFormats: AudioFormat[] = [];
  let earliestExpireEpoch = Date.now() + 6 * 3600 * 1000; // Default 6 hour fallback

  for (const raw of allRawFormats) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const mimeType = typeof item['mimeType'] === 'string' ? item['mimeType'] : '';

    // Only process audio streams
    if (!mimeType.startsWith('audio/')) continue;

    const itag = typeof item['itag'] === 'number' ? item['itag'] : 0;
    const bitrate = typeof item['bitrate'] === 'number' ? item['bitrate'] : 0;
    const averageBitrate = typeof item['averageBitrate'] === 'number' ? item['averageBitrate'] : undefined;
    const audioSampleRate = typeof item['audioSampleRate'] === 'string'
      ? parseInt(item['audioSampleRate'], 10)
      : undefined;
    const audioChannels = typeof item['audioChannels'] === 'number' ? item['audioChannels'] : 2;
    const contentLength = typeof item['contentLength'] === 'string'
      ? parseInt(item['contentLength'], 10)
      : undefined;

    let resolvedUrl = '';
    try {
      resolvedUrl = resolveFormatStreamUrl(
        item as unknown as RawStreamFormat,
        decipherOps,
      );
    } catch {
      // If resolving cipher fails for this format, skip to next format
      continue;
    }

    if (!resolvedUrl) continue;

    // Detect expiration time from URL query string 'expire'
    const qIdx = resolvedUrl.indexOf('?');
    if (qIdx !== -1) {
      const qParams = parseQueryString(resolvedUrl.slice(qIdx + 1));
      const expireStr = qParams['expire'];
      if (expireStr) {
        const expireEpoch = parseInt(expireStr, 10) * 1000;
        if (!isNaN(expireEpoch) && expireEpoch < earliestExpireEpoch) {
          earliestExpireEpoch = expireEpoch;
        }
      }
    }

    const codec = determineCodec(mimeType);
    const quality = determineQuality(bitrate, itag);

    audioFormats.push({
      itag,
      mimeType,
      codec,
      bitrate,
      averageBitrate,
      sampleRate: audioSampleRate,
      channels: audioChannels,
      contentLength,
      url: resolvedUrl,
      isDash: false,
      isHls: false,
      quality,
    });
  }

  // Sort formats by bitrate descending
  audioFormats.sort((a, b) => b.bitrate - a.bitrate);

  return {
    videoId,
    isLive,
    durationSec: lengthSeconds,
    formats: audioFormats,
    dashManifestUrl:
      typeof streamingData['dashManifestUrl'] === 'string'
        ? streamingData['dashManifestUrl']
        : undefined,
    hlsManifestUrl:
      typeof streamingData['hlsManifestUrl'] === 'string'
        ? streamingData['hlsManifestUrl']
        : undefined,
    expiresAt: earliestExpireEpoch,
  };
}

/**
 * Selects the optimal AudioFormat matching the user's AudioQuality preference.
 */
export function selectBestAudioFormat(
  formats: readonly AudioFormat[],
  preferredQuality: AudioQuality = 'high',
  preferredCodec: AudioCodec = 'opus',
): AudioFormat {
  if (formats.length === 0) {
    throw {
      code: 'UNPLAYABLE_TRACK',
      message: 'No available audio streams for this track',
      fatal: true,
    } as PlaybackError;
  }

  // Filter by preferred codec if available
  const codecMatched = formats.filter((f) => f.codec === preferredCodec);
  const pool = codecMatched.length > 0 ? codecMatched : formats;

  // Exact quality match
  const exactMatch = pool.find((f) => f.quality === preferredQuality);
  if (exactMatch) return exactMatch;

  // Fallback according to target hierarchy
  switch (preferredQuality) {
    case 'ultra':
      return pool[0] ?? formats[0]!;
    case 'high':
      return pool.find((f) => f.quality === 'medium') ?? pool[0] ?? formats[0]!;
    case 'medium':
      return pool.find((f) => f.quality === 'low') ?? pool[pool.length - 1] ?? formats[0]!;
    case 'low':
      return pool[pool.length - 1] ?? formats[0]!;
  }
}

function determineCodec(mimeType: string): AudioCodec {
  const lower = mimeType.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('mp4a') || lower.includes('aac')) return 'aac';
  return 'unknown';
}

function determineQuality(bitrate: number, itag: number): AudioQuality {
  // Common YouTube Music itags
  if (itag === 251) return 'high'; // Opus 160kbps
  if (itag === 140) return 'medium'; // AAC 128kbps
  if (itag === 250) return 'medium'; // Opus 70kbps
  if (itag === 249) return 'low'; // Opus 50kbps

  if (bitrate >= 240000) return 'ultra';
  if (bitrate >= 140000) return 'high';
  if (bitrate >= 80000) return 'medium';
  return 'low';
}
