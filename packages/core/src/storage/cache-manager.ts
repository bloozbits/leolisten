import type { ICacheStorageAdapter, IStorageAdapter } from '../types/ports.js';

export interface CacheEntryMeta {
  readonly trackId: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly codec: string;
  readonly bitrate: number;
  readonly createdAt: number;
  readonly lastAccessedAt: number;
  readonly isPinned: boolean;
}

export type CacheEvictionPolicy = 'LRU' | 'FIFO';

export interface CacheManagerOptions {
  readonly metadataStorage: IStorageAdapter;
  readonly binaryStorage: ICacheStorageAdapter;
  readonly maxSizeBytes?: number; // e.g. 1 GB = 1024 * 1024 * 1024
  readonly evictionPolicy?: CacheEvictionPolicy;
}

export interface CacheStats {
  readonly totalBytes: number;
  readonly entryCount: number;
  readonly pinnedBytes: number;
  readonly maxSizeBytes: number;
}

const META_PREFIX = 'cache:meta:';
const INDEX_KEY = 'cache:index';

/**
 * Platform-Agnostic Audio Stream & Offline Cache Manager.
 *
 * Implements local-first storage with deterministic LRU/FIFO eviction policies,
 * pinned download protections, and metadata indexing.
 */
export class CacheManager {
  private readonly metaStorage: IStorageAdapter;
  private readonly binaryStorage: ICacheStorageAdapter;
  private readonly maxSizeBytes: number;
  private readonly evictionPolicy: CacheEvictionPolicy;

  public constructor(options: CacheManagerOptions) {
    this.metaStorage = options.metadataStorage;
    this.binaryStorage = options.binaryStorage;
    this.maxSizeBytes = options.maxSizeBytes ?? 1024 * 1024 * 1024; // 1 GB default
    this.evictionPolicy = options.evictionPolicy ?? 'LRU';
  }

  /**
   * Checks if an audio stream is fully cached and available locally.
   */
  public async has(trackId: string): Promise<boolean> {
    const meta = await this.getMeta(trackId);
    if (!meta) return false;
    return this.binaryStorage.has(trackId);
  }

  /**
   * Returns a local URI (file://, blob:, or custom scheme) suitable for direct audio sink playback.
   */
  public async getStreamUri(trackId: string): Promise<string | null> {
    const isPresent = await this.has(trackId);
    if (!isPresent) return null;

    await this.recordAccess(trackId);
    return this.binaryStorage.getUri(trackId);
  }

  /**
   * Retrieves raw binary audio buffer.
   */
  public async getStreamData(trackId: string): Promise<Uint8Array | null> {
    const isPresent = await this.has(trackId);
    if (!isPresent) return null;

    await this.recordAccess(trackId);
    return this.binaryStorage.read(trackId);
  }

  /**
   * Stores binary stream and updates indexing metadata.
   * Automatically executes cache eviction if needed.
   */
  public async storeTrack(
    trackId: string,
    data: Uint8Array,
    info: {
      mimeType: string;
      bitrate: number;
      codec: string;
      isPinned?: boolean;
    },
  ): Promise<void> {
    const sizeBytes = data.byteLength;

    // Run eviction if adding this track exceeds max cache budget
    await this.evictIfNecessary(sizeBytes);

    // Save binary data
    await this.binaryStorage.save(trackId, data);

    // Save metadata
    const now = Date.now();
    const meta: CacheEntryMeta = {
      trackId,
      sizeBytes,
      mimeType: info.mimeType,
      codec: info.codec,
      bitrate: info.bitrate,
      createdAt: now,
      lastAccessedAt: now,
      isPinned: Boolean(info.isPinned),
    };

    await this.metaStorage.set(`${META_PREFIX}${trackId}`, meta);

    // Update index
    const index = await this.getIndex();
    if (!index.includes(trackId)) {
      index.push(trackId);
      await this.saveIndex(index);
    }
  }

  /**
   * Updates last-accessed timestamp for LRU policy tracking.
   */
  public async recordAccess(trackId: string): Promise<void> {
    const meta = await this.getMeta(trackId);
    if (!meta) return;

    const updated: CacheEntryMeta = {
      ...meta,
      lastAccessedAt: Date.now(),
    };

    await this.metaStorage.set(`${META_PREFIX}${trackId}`, updated);
  }

  /**
   * Toggles pinned state (pinned tracks are immune to automatic LRU/FIFO eviction).
   */
  public async pinTrack(trackId: string, pinned: boolean): Promise<void> {
    const meta = await this.getMeta(trackId);
    if (!meta) return;

    const updated: CacheEntryMeta = {
      ...meta,
      isPinned: pinned,
    };

    await this.metaStorage.set(`${META_PREFIX}${trackId}`, updated);
  }

  /**
   * Removes a track from binary storage and metadata index.
   */
  public async deleteTrack(trackId: string): Promise<void> {
    await this.binaryStorage.delete(trackId);
    await this.metaStorage.remove(`${META_PREFIX}${trackId}`);

    const index = await this.getIndex();
    const updatedIndex = index.filter((id) => id !== trackId);
    await this.saveIndex(updatedIndex);
  }

  /**
   * Evicts unpinned tracks according to LRU/FIFO policy until capacity is freed.
   */
  public async evictIfNecessary(incomingBytes: number): Promise<readonly string[]> {
    const evictedIds: string[] = [];
    const entries = await this.getAllEntries();

    let totalUsedBytes = entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    const targetBudget = this.maxSizeBytes - incomingBytes;

    if (totalUsedBytes <= targetBudget) {
      return evictedIds;
    }

    // Filter unpinned tracks eligible for eviction
    const eligible = entries.filter((e) => !e.isPinned);

    // Sort according to policy
    if (this.evictionPolicy === 'LRU') {
      // Oldest access first
      eligible.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    } else {
      // FIFO: Oldest creation first
      eligible.sort((a, b) => a.createdAt - b.createdAt);
    }

    for (const candidate of eligible) {
      if (totalUsedBytes <= targetBudget) break;

      await this.deleteTrack(candidate.trackId);
      evictedIds.push(candidate.trackId);
      totalUsedBytes -= candidate.sizeBytes;
    }

    return evictedIds;
  }

  /**
   * Clears the cache.
   * If includePinned is false, user-pinned/downloaded tracks are preserved.
   */
  public async clear(includePinned: boolean = false): Promise<void> {
    if (includePinned) {
      await this.binaryStorage.clear();
      const index = await this.getIndex();
      for (const id of index) {
        await this.metaStorage.remove(`${META_PREFIX}${id}`);
      }
      await this.saveIndex([]);
    } else {
      const entries = await this.getAllEntries();
      for (const entry of entries) {
        if (!entry.isPinned) {
          await this.deleteTrack(entry.trackId);
        }
      }
    }
  }

  /**
   * Calculates current cache disk usage statistics.
   */
  public async getStats(): Promise<CacheStats> {
    const entries = await this.getAllEntries();
    let totalBytes = 0;
    let pinnedBytes = 0;

    for (const e of entries) {
      totalBytes += e.sizeBytes;
      if (e.isPinned) {
        pinnedBytes += e.sizeBytes;
      }
    }

    return {
      totalBytes,
      entryCount: entries.length,
      pinnedBytes,
      maxSizeBytes: this.maxSizeBytes,
    };
  }

  public async getMeta(trackId: string): Promise<CacheEntryMeta | null> {
    return this.metaStorage.get<CacheEntryMeta>(`${META_PREFIX}${trackId}`);
  }

  private async getIndex(): Promise<string[]> {
    const index = await this.metaStorage.get<string[]>(INDEX_KEY);
    return Array.isArray(index) ? index : [];
  }

  private async saveIndex(index: readonly string[]): Promise<void> {
    await this.metaStorage.set(INDEX_KEY, index);
  }

  private async getAllEntries(): Promise<CacheEntryMeta[]> {
    const index = await this.getIndex();
    const entries: CacheEntryMeta[] = [];

    for (const id of index) {
      const meta = await this.getMeta(id);
      if (meta) {
        entries.push(meta);
      }
    }

    return entries;
  }
}
