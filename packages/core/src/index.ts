/**
 * @leolisen/core
 * Headless, cross-platform, local-first core architecture for Leolisen YouTube Music client.
 */

// ==========================================
// TYPES
// ==========================================
export type {
  Thumbnail,
  ArtistSummary,
  AlbumSummary,
  Track,
  Album,
  Artist,
  Playlist,
  SearchResultType,
  TrackSearchResult,
  AlbumSearchResult,
  ArtistSearchResult,
  PlaylistSearchResult,
  SearchResultItem,
  SearchSuggestion,
  BrowseSection,
} from './types/track.js';

export type {
  PlaybackStatus,
  RepeatMode,
  PlaybackMode,
  AudioCodec,
  AudioQuality,
  AudioFormat,
  StreamResolution,
  PlaybackErrorCode,
  PlaybackError,
  PlaybackState,
} from './types/player.js';

export {
  TypedEventEmitter,
  type CoreEventMap,
  type EventListener,
  type Unsubscribe,
} from './types/events.js';

export type {
  HttpRequestOptions,
  HttpResponse,
  IHttpClientAdapter,
  IStorageAdapter,
  ICacheStorageAdapter,
  AudioSinkSource,
  AudioSinkState,
  AudioSinkTime,
  AudioSinkError,
  IAudioSinkAdapter,
} from './types/ports.js';

// ==========================================
// INNERTUBE API & CIPHER
// ==========================================
export {
  InnertubeClient,
  type InnertubeClientConfig,
} from './innertube/client.js';

export {
  SignatureDecipher,
  parseQueryString,
  buildQueryString,
  transformNParam,
  resolveFormatStreamUrl,
  type CipherOperations,
  type RawStreamFormat,
} from './innertube/cipher.js';

export {
  extractText,
  extractThumbnails,
  upgradeThumbnailUrl,
  parseDurationSec,
  parseSearchResults,
  parseSearchSuggestions,
  parseMusicResponsiveListItem,
  parseMusicCardShelf,
} from './innertube/parsers/search.js';

export {
  parseHomeFeed,
  parseAlbumPage,
  parseArtistPage,
  parsePlaylistPage,
} from './innertube/parsers/browse.js';

export {
  parsePlayerResponse,
  selectBestAudioFormat,
  type ParsedStreamManifest,
} from './innertube/parsers/stream.js';

export {
  extractLyricsBrowseId,
  extractLyricsFromBrowse,
  parseLrc,
  findActiveLyricIndex,
  type SyncedLyricLine,
  type LyricsData,
} from './innertube/lyrics.js';

// ==========================================
// QUEUE & RADIO
// ==========================================
export {
  QueueMachine,
  type QueueSnapshot,
  type QueueMachineOptions,
} from './queue/queue-machine.js';

export {
  RadioManager,
  type RadioOptions,
} from './queue/radio.js';

// ==========================================
// STORAGE & OFFLINE CACHE
// ==========================================
export {
  CacheManager,
  type CacheEntryMeta,
  type CacheEvictionPolicy,
  type CacheManagerOptions,
  type CacheStats,
} from './storage/cache-manager.js';

export {
  DatabaseFacade,
  DEFAULT_PREFERENCES,
  type HistoryEntry,
  type UserCustomPlaylist,
  type UserPreferences,
} from './storage/db-facade.js';

// ==========================================
// PLAYER CONTROLLER
// ==========================================
export {
  PlayerController,
  type PlayerControllerDependencies,
} from './player/player-controller.js';
