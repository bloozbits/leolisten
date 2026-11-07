import type { TypedEventEmitter } from '../types/events.js';
import type { AudioCodec, AudioQuality } from '../types/player.js';
import type { IStorageAdapter } from '../types/ports.js';
import type { AlbumSummary, ArtistSummary, Track } from '../types/track.js';
import type { CoreEventMap } from '../types/events.js';

export interface HistoryEntry {
  readonly track: Track;
  readonly playedAt: number;
  readonly completed: boolean;
}

export interface UserCustomPlaylist {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly tracks: readonly Track[];
}

export interface UserPreferences {
  readonly audioQuality: AudioQuality;
  readonly preferredCodec: AudioCodec;
  readonly autoplayRadio: boolean;
  readonly volume: number;
  readonly muted: boolean;
  readonly maxCacheSizeBytes: number;
  readonly enableCache: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  audioQuality: 'high',
  preferredCodec: 'opus',
  autoplayRadio: true,
  volume: 1.0,
  muted: false,
  maxCacheSizeBytes: 1024 * 1024 * 1024, // 1 GB
  enableCache: true,
};

const KEYS = {
  FAV_TRACKS: 'lib:fav:tracks',
  FAV_ALBUMS: 'lib:fav:albums',
  FAV_ARTISTS: 'lib:fav:artists',
  PLAYLISTS_INDEX: 'lib:playlists:index',
  PLAYLIST_PREFIX: 'lib:playlist:',
  HISTORY: 'lib:history',
  PREFERENCES: 'settings:preferences',
} as const;

/**
 * High-level Database Facade.
 *
 * Provides a clean reactive repository over the storage port for playlists,
 * favorites, history tracking, and application preferences.
 */
export class DatabaseFacade {
  private readonly storage: IStorageAdapter;
  private readonly events?: TypedEventEmitter<CoreEventMap>;

  public constructor(storage: IStorageAdapter, events?: TypedEventEmitter<CoreEventMap>) {
    this.storage = storage;
    this.events = events;
  }

  // ==========================================
  // FAVORITES: TRACKS
  // ==========================================

  public async getFavoriteTracks(): Promise<readonly Track[]> {
    const list = await this.storage.get<Track[]>(KEYS.FAV_TRACKS);
    return Array.isArray(list) ? list : [];
  }

  public async isTrackFavorite(trackId: string): Promise<boolean> {
    const tracks = await this.getFavoriteTracks();
    return tracks.some((t) => t.id === trackId);
  }

  public async toggleFavoriteTrack(track: Track): Promise<boolean> {
    const tracks = [...(await this.getFavoriteTracks())];
    const index = tracks.findIndex((t) => t.id === track.id);
    let isFav = false;

    if (index !== -1) {
      tracks.splice(index, 1);
      isFav = false;
    } else {
      tracks.unshift(track);
      isFav = true;
    }

    await this.storage.set(KEYS.FAV_TRACKS, tracks);
    this.events?.emit('storage:sync', { type: 'favorites' });
    return isFav;
  }

  // ==========================================
  // FAVORITES: ALBUMS & ARTISTS
  // ==========================================

  public async getFavoriteAlbums(): Promise<readonly AlbumSummary[]> {
    const list = await this.storage.get<AlbumSummary[]>(KEYS.FAV_ALBUMS);
    return Array.isArray(list) ? list : [];
  }

  public async toggleFavoriteAlbum(album: AlbumSummary): Promise<boolean> {
    const list = [...(await this.getFavoriteAlbums())];
    const index = list.findIndex((a) => a.id === album.id);
    let isFav = false;

    if (index !== -1) {
      list.splice(index, 1);
    } else {
      list.unshift(album);
      isFav = true;
    }

    await this.storage.set(KEYS.FAV_ALBUMS, list);
    this.events?.emit('storage:sync', { type: 'favorites' });
    return isFav;
  }

  public async getFavoriteArtists(): Promise<readonly ArtistSummary[]> {
    const list = await this.storage.get<ArtistSummary[]>(KEYS.FAV_ARTISTS);
    return Array.isArray(list) ? list : [];
  }

  public async toggleFavoriteArtist(artist: ArtistSummary): Promise<boolean> {
    const list = [...(await this.getFavoriteArtists())];
    const index = list.findIndex((a) => a.id === artist.id);
    let isFav = false;

    if (index !== -1) {
      list.splice(index, 1);
    } else {
      list.unshift(artist);
      isFav = true;
    }

    await this.storage.set(KEYS.FAV_ARTISTS, list);
    this.events?.emit('storage:sync', { type: 'favorites' });
    return isFav;
  }

  // ==========================================
  // PLAYLIST MANAGEMENT
  // ==========================================

  public async getPlaylists(): Promise<readonly UserCustomPlaylist[]> {
    const index = (await this.storage.get<string[]>(KEYS.PLAYLISTS_INDEX)) ?? [];
    const playlists: UserCustomPlaylist[] = [];

    for (const id of index) {
      const pl = await this.storage.get<UserCustomPlaylist>(`${KEYS.PLAYLIST_PREFIX}${id}`);
      if (pl) playlists.push(pl);
    }

    return playlists;
  }

  public async getPlaylist(playlistId: string): Promise<UserCustomPlaylist | null> {
    return this.storage.get<UserCustomPlaylist>(`${KEYS.PLAYLIST_PREFIX}${playlistId}`);
  }

  public async createPlaylist(title: string, description?: string): Promise<UserCustomPlaylist> {
    const id = `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    const playlist: UserCustomPlaylist = {
      id,
      title,
      description,
      createdAt: now,
      updatedAt: now,
      tracks: [],
    };

    await this.storage.set(`${KEYS.PLAYLIST_PREFIX}${id}`, playlist);
    const index = (await this.storage.get<string[]>(KEYS.PLAYLISTS_INDEX)) ?? [];
    index.push(id);
    await this.storage.set(KEYS.PLAYLISTS_INDEX, index);

    this.events?.emit('storage:sync', { type: 'playlists' });
    return playlist;
  }

  public async deletePlaylist(playlistId: string): Promise<void> {
    await this.storage.remove(`${KEYS.PLAYLIST_PREFIX}${playlistId}`);
    const index = (await this.storage.get<string[]>(KEYS.PLAYLISTS_INDEX)) ?? [];
    const updated = index.filter((id) => id !== playlistId);
    await this.storage.set(KEYS.PLAYLISTS_INDEX, updated);

    this.events?.emit('storage:sync', { type: 'playlists' });
  }

  public async addTrackToPlaylist(playlistId: string, track: Track): Promise<void> {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) throw new Error(`Playlist ${playlistId} not found`);

    const tracks = [...pl.tracks, track];
    const updated: UserCustomPlaylist = {
      ...pl,
      updatedAt: Date.now(),
      tracks,
    };

    await this.storage.set(`${KEYS.PLAYLIST_PREFIX}${playlistId}`, updated);
    this.events?.emit('storage:sync', { type: 'playlists' });
  }

  public async removeTrackFromPlaylist(playlistId: string, trackIndex: number): Promise<void> {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) return;

    const tracks = [...pl.tracks];
    tracks.splice(trackIndex, 1);
    const updated: UserCustomPlaylist = {
      ...pl,
      updatedAt: Date.now(),
      tracks,
    };

    await this.storage.set(`${KEYS.PLAYLIST_PREFIX}${playlistId}`, updated);
    this.events?.emit('storage:sync', { type: 'playlists' });
  }

  // ==========================================
  // PLAYBACK HISTORY
  // ==========================================

  public async getHistory(limit: number = 50): Promise<readonly HistoryEntry[]> {
    const list = await this.storage.get<HistoryEntry[]>(KEYS.HISTORY);
    if (!Array.isArray(list)) return [];
    return list.slice(0, limit);
  }

  public async recordHistory(track: Track, completed: boolean = false): Promise<void> {
    const list = [...(await this.getHistory(200))];
    const newEntry: HistoryEntry = {
      track,
      playedAt: Date.now(),
      completed,
    };

    // Prepend and truncate
    list.unshift(newEntry);
    await this.storage.set(KEYS.HISTORY, list.slice(0, 200));
    this.events?.emit('storage:sync', { type: 'history' });
  }

  public async clearHistory(): Promise<void> {
    await this.storage.set(KEYS.HISTORY, []);
    this.events?.emit('storage:sync', { type: 'history' });
  }

  // ==========================================
  // USER PREFERENCES
  // ==========================================

  public async getPreferences(): Promise<UserPreferences> {
    const saved = await this.storage.get<UserPreferences>(KEYS.PREFERENCES);
    return {
      ...DEFAULT_PREFERENCES,
      ...saved,
    };
  }

  public async updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const updated: UserPreferences = {
      ...current,
      ...patch,
    };
    await this.storage.set(KEYS.PREFERENCES, updated);
    this.events?.emit('storage:sync', { type: 'settings' });
    return updated;
  }
}
