/**
 * Schema definitions for media entities in the Leolisen core audio architecture.
 * Designed to represent YouTube Music entities uniformly across Web, Desktop, and Mobile.
 */

export interface Thumbnail {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

export interface ArtistSummary {
  readonly id: string;
  readonly name: string;
}

export interface AlbumSummary {
  readonly id: string;
  readonly name: string;
}

export interface Track {
  readonly id: string; // YouTube Video ID
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly album?: AlbumSummary;
  readonly durationSec: number;
  readonly thumbnails: readonly Thumbnail[];
  readonly explicit?: boolean;
  readonly isLive?: boolean;
  readonly isAvailable?: boolean;
}

export interface Album {
  readonly id: string; // YouTube Browse ID
  readonly title: string;
  readonly artists: readonly ArtistSummary[];
  readonly year?: number | string;
  readonly thumbnails: readonly Thumbnail[];
  readonly tracks: readonly Track[];
  readonly description?: string;
  readonly trackCount?: number;
  readonly durationSec?: number;
}

export interface Artist {
  readonly id: string; // YouTube Channel/Browse ID
  readonly name: string;
  readonly thumbnails: readonly Thumbnail[];
  readonly subscribers?: string;
  readonly description?: string;
  readonly topTracks: readonly Track[];
  readonly albums: readonly AlbumSummary[];
  readonly singles?: readonly AlbumSummary[];
}

export interface Playlist {
  readonly id: string; // YouTube Playlist ID or Browse ID
  readonly title: string;
  readonly author?: ArtistSummary;
  readonly thumbnails: readonly Thumbnail[];
  readonly trackCount: number;
  readonly tracks: readonly Track[];
  readonly description?: string;
}

export type SearchResultType = 'track' | 'album' | 'artist' | 'playlist';

export interface TrackSearchResult {
  readonly type: 'track';
  readonly data: Track;
}

export interface AlbumSearchResult {
  readonly type: 'album';
  readonly data: AlbumSummary & {
    readonly thumbnails: readonly Thumbnail[];
    readonly year?: string;
    readonly artist?: string;
  };
}

export interface ArtistSearchResult {
  readonly type: 'artist';
  readonly data: ArtistSummary & {
    readonly thumbnails: readonly Thumbnail[];
    readonly subscribers?: string;
  };
}

export interface PlaylistSearchResult {
  readonly type: 'playlist';
  readonly data: {
    readonly id: string;
    readonly title: string;
    readonly author?: string;
    readonly trackCount?: number;
    readonly thumbnails: readonly Thumbnail[];
  };
}

export type SearchResultItem =
  | TrackSearchResult
  | AlbumSearchResult
  | ArtistSearchResult
  | PlaylistSearchResult;

export interface SearchSuggestion {
  readonly query: string;
  readonly isHistory?: boolean;
}

export interface BrowseSection {
  readonly id: string;
  readonly title: string;
  readonly strapline?: string;
  readonly items: readonly SearchResultItem[];
}

