import { extractText } from './parsers/search.js';

/**
 * Single timed lyric cue line.
 */
export interface SyncedLyricLine {
  readonly timeSec: number;
  readonly text: string;
}

/**
 * Normalized lyrics payload supporting both timed cues and raw text.
 */
export interface LyricsData {
  readonly plainLyrics: string;
  readonly syncedLyrics?: readonly SyncedLyricLine[];
  readonly isSynced: boolean;
  readonly source?: string;
}

/**
 * Extracts lyrics browseId from YouTube Music /next tab response.
 * YouTube Music embeds the lyrics tab in next.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[1].tabRenderer.endpoint.browseEndpoint.browseId
 */
export function extractLyricsBrowseId(nextData: Record<string, unknown>): string | null {
  try {
    const watchNext = (nextData['contents'] as Record<string, unknown> | undefined)?.[
      'singleColumnMusicWatchNextResultsRenderer'
    ] as Record<string, unknown> | undefined;

    const tabbed = watchNext?.['tabbedRenderer'] as Record<string, unknown> | undefined;
    const watchNextTabbed = tabbed?.['watchNextTabbedResultsRenderer'] as
      | Record<string, unknown>
      | undefined;

    const tabs = Array.isArray(watchNextTabbed?.['tabs'])
      ? (watchNextTabbed?.['tabs'] as Array<Record<string, unknown>>)
      : [];

    for (const tab of tabs) {
      const tabRenderer = tab['tabRenderer'] as Record<string, unknown> | undefined;
      const title = extractText(tabRenderer?.['title']).toLowerCase();
      const endpoint = tabRenderer?.['endpoint'] as Record<string, unknown> | undefined;
      const browseEndpoint = endpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;
      const browseId = browseEndpoint?.['browseId'];

      if (title.includes('lyric') && typeof browseId === 'string') {
        return browseId;
      }
    }
  } catch {
    // Fail silently
  }
  return null;
}

/**
 * Parses YouTube Music Browse response for lyrics (browseId: FEmusic_lyrics).
 */
export function extractLyricsFromBrowse(data: Record<string, unknown>): LyricsData | null {
  try {
    const sectionList = (data['contents'] as Record<string, unknown> | undefined)?.[
      'sectionListRenderer'
    ] as Record<string, unknown> | undefined;

    const contents = Array.isArray(sectionList?.['contents'])
      ? (sectionList?.['contents'] as Array<Record<string, unknown>>)
      : [];

    for (const item of contents) {
      const shelf = item['musicDescriptionShelfRenderer'] as Record<string, unknown> | undefined;
      if (shelf) {
        const plainLyrics = extractText(shelf['description']);
        const source = extractText(shelf['footer']);

        if (plainLyrics) {
          // Check if plain lyrics contain LRC time tags [mm:ss.xx]
          const parsedSynced = parseLrc(plainLyrics);
          const isSynced = parsedSynced.length > 0;

          return {
            plainLyrics: isSynced
              ? parsedSynced.map((l) => l.text).join('\n')
              : plainLyrics,
            syncedLyrics: isSynced ? parsedSynced : undefined,
            isSynced,
            source: source || undefined,
          };
        }
      }
    }
  } catch {
    // Fail silently
  }

  return null;
}

/**
 * Parses LRC (LyRiCs) formatted text into synchronized cue entries.
 * Format: [01:23.45] Lyric text line
 */
export function parseLrc(lrcContent: string): readonly SyncedLyricLine[] {
  const lines = lrcContent.split(/\r?\n/);
  const result: SyncedLyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    timeRegex.lastIndex = 0;
    const matches: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1] ?? '0', 10);
      const sec = parseInt(match[2] ?? '0', 10);
      const frac = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      const totalSec = min * 60 + sec + frac / 1000;
      matches.push(totalSec);
    }

    if (matches.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim();
      for (const timeSec of matches) {
        result.push({ timeSec, text });
      }
    }
  }

  // Sort chronologically
  result.sort((a, b) => a.timeSec - b.timeSec);
  return result;
}

/**
 * Binary search to efficiently identify active lyric line index for current playback time.
 */
export function findActiveLyricIndex(
  syncedLyrics: readonly SyncedLyricLine[],
  currentTimeSec: number,
): number {
  if (syncedLyrics.length === 0) return -1;
  if (currentTimeSec < (syncedLyrics[0]?.timeSec ?? 0)) return -1;

  let low = 0;
  let high = syncedLyrics.length - 1;
  let activeIndex = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = syncedLyrics[mid];

    if (line && line.timeSec <= currentTimeSec) {
      activeIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return activeIndex;
}
