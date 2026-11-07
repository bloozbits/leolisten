import type { InnertubeClient } from '../innertube/client.js';
import { extractText, extractThumbnails, parseDurationSec } from '../innertube/parsers/search.js';
import type { ArtistSummary, Thumbnail, Track } from '../types/track.js';

export interface RadioOptions {
  readonly client: InnertubeClient;
  readonly maxBatchSize?: number;
}

/**
 * YouTube Music Auto-Radio / Contextual Queue Expander.
 *
 * Dynamically queries YouTube Music's radio algorithms (RDAMVM) to stream
 * seamless endless recommendations based on the currently playing track.
 */
export class RadioManager {
  private readonly client: InnertubeClient;
  private readonly maxBatchSize: number;
  private currentVideoId: string | null = null;
  private continuationToken: string | null = null;
  private readonly servedTrackIds = new Set<string>();

  public constructor(options: RadioOptions) {
    this.client = options.client;
    this.maxBatchSize = options.maxBatchSize ?? 15;
  }

  /**
   * Resets radio state when the user starts a completely new playlist or manual track.
   */
  public reset(): void {
    this.currentVideoId = null;
    this.continuationToken = null;
    this.servedTrackIds.clear();
  }

  /**
   * Fetches the next batch of radio recommendations for the target track.
   * Automatically deduplicates against existing queue and previously served tracks.
   */
  public async fetchNextRadioBatch(
    targetTrack: Track,
    existingQueueIds: ReadonlySet<string>,
  ): Promise<readonly Track[]> {
    // If target track changed, reset radio seed
    if (this.currentVideoId !== targetTrack.id) {
      this.currentVideoId = targetTrack.id;
      this.continuationToken = null;
      this.servedTrackIds.clear();
      this.servedTrackIds.add(targetTrack.id);
    }

    try {
      const response = await this.client.next({
        videoId: this.continuationToken ? undefined : targetTrack.id,
        playlistId: this.continuationToken ? undefined : `RDAMVM${targetTrack.id}`,
        continuation: this.continuationToken ?? undefined,
      });

      const { tracks, nextContinuation } = this.parseRadioPlaylistPanel(response.data);
      this.continuationToken = nextContinuation ?? null;

      // Filter duplicates
      const freshTracks: Track[] = [];
      for (const track of tracks) {
        if (
          !existingQueueIds.has(track.id) &&
          !this.servedTrackIds.has(track.id) &&
          track.id !== targetTrack.id
        ) {
          freshTracks.push(track);
          this.servedTrackIds.add(track.id);

          if (freshTracks.length >= this.maxBatchSize) {
            break;
          }
        }
      }

      return freshTracks;
    } catch {
      // Return empty batch on network failure
      return [];
    }
  }

  /**
   * Parses radio items from Innertube next response.
   */
  private parseRadioPlaylistPanel(data: Record<string, unknown>): {
    tracks: Track[];
    nextContinuation?: string;
  } {
    const tracks: Track[] = [];
    let nextContinuation: string | undefined;

    try {
      const panelContents = this.findPlaylistPanelContents(data);
      if (!panelContents) return { tracks };

      for (const item of panelContents) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;

        // Check for continuation
        const continuationRenderer = rec['continuationItemRenderer'] as
          | Record<string, unknown>
          | undefined;
        if (continuationRenderer) {
          const token = (
            continuationRenderer['continuationEndpoint'] as Record<string, unknown> | undefined
          )?.['continuationCommand'] as Record<string, unknown> | undefined;
          if (typeof token?.['token'] === 'string') {
            nextContinuation = token['token'];
          }
          continue;
        }

        const videoRenderer = (rec['playlistPanelVideoRenderer'] ??
          (rec['playlistPanelVideoWrapperRenderer'] as Record<string, unknown> | undefined)?.[
            'primaryRenderer'
          ]) as Record<string, unknown> | undefined;

        if (!videoRenderer) continue;

        const videoId = typeof videoRenderer['videoId'] === 'string' ? videoRenderer['videoId'] : '';
        const title = extractText(videoRenderer['title']);
        if (!videoId || !title) continue;

        const durationStr = extractText(videoRenderer['lengthText']);
        const durationSec = parseDurationSec(durationStr);
        const thumbnails: readonly Thumbnail[] = extractThumbnails(videoRenderer['thumbnail']);

        const artists: ArtistSummary[] = [];
        const bylineRuns = (videoRenderer['shortBylineText'] as Record<string, unknown> | undefined)?.[
          'runs'
        ] as Array<Record<string, unknown>> | undefined;

        if (Array.isArray(bylineRuns)) {
          for (const run of bylineRuns) {
            const text = typeof run['text'] === 'string' ? run['text'] : '';
            const bId = (
              (run['navigationEndpoint'] as Record<string, unknown> | undefined)?.[
                'browseEndpoint'
              ] as Record<string, unknown> | undefined
            )?.['browseId'];

            if (text && text !== ' • ') {
              artists.push({
                id: typeof bId === 'string' ? bId : '',
                name: text,
              });
            }
          }
        }

        tracks.push({
          id: videoId,
          title,
          artists: artists.length > 0 ? artists : [{ id: '', name: 'Unknown Artist' }],
          durationSec,
          thumbnails,
        });
      }
    } catch {
      // Ignore parsing errors
    }

    return { tracks, nextContinuation };
  }

  private findPlaylistPanelContents(data: Record<string, unknown>): unknown[] | null {
    try {
      const watchNext = (data['contents'] as Record<string, unknown> | undefined)?.[
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
        const queueRenderer = (tabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
          'musicQueueRenderer'
        ] as Record<string, unknown> | undefined;
        const panel = (queueRenderer?.['content'] as Record<string, unknown> | undefined)?.[
          'playlistPanelRenderer'
        ] as Record<string, unknown> | undefined;

        if (Array.isArray(panel?.['contents'])) {
          return panel['contents'];
        }
      }

      // Fallback for direct continuation responses
      const continuationContents = (data['continuationContents'] as
        | Record<string, unknown>
        | undefined)?.[
        'playlistPanelContinuation'
      ] as Record<string, unknown> | undefined;

      if (Array.isArray(continuationContents?.['contents'])) {
        return continuationContents['contents'];
      }
    } catch {
      // Return null
    }
    return null;
  }
}
