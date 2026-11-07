import {
  QueueMachine,
  CacheManager,
  TypedEventEmitter,
  parseDurationSec,
  parseQueryString,
  buildQueryString,
  SignatureDecipher,
  transformNParam,
  type IStorageAdapter,
  type ICacheStorageAdapter,
  type Track,
  type CoreEventMap,
} from '../dist/index.js';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- STARTING LEOLISEN CORE VERIFICATION ---');

// 1. Queue Machine Tests
console.log('Testing QueueMachine...');
const sampleTracks: Track[] = [
  { id: 'track_1', title: 'Song 1', artists: [{ id: 'a1', name: 'Artist 1' }], durationSec: 200, thumbnails: [] },
  { id: 'track_2', title: 'Song 2', artists: [{ id: 'a1', name: 'Artist 1' }], durationSec: 180, thumbnails: [] },
  { id: 'track_3', title: 'Song 3', artists: [{ id: 'a2', name: 'Artist 2' }], durationSec: 240, thumbnails: [] },
];

const qm = new QueueMachine({ initialTracks: sampleTracks, repeatMode: 'off' });
assert(qm.currentTrack?.id === 'track_1', 'Initial track should be track_1');
assert(qm.hasNext === true, 'Has next should be true');

// Advance next
const nextTrack = qm.next();
assert(nextTrack?.id === 'track_2', 'Next track should be track_2');
assert(qm.historyTracks.length === 1 && qm.historyTracks[0]?.id === 'track_1', 'Track 1 should be in history');

// Shuffle and un-shuffle
qm.toggleShuffle();
assert(qm.shuffled === true, 'Queue should be shuffled');
assert(qm.currentTrack?.id === 'track_2', 'Active track should remain current after shuffle');
qm.toggleShuffle();
assert(qm.shuffled === false, 'Queue should be un-shuffled');
assert(qm.currentTrack?.id === 'track_2', 'Active track should remain current after un-shuffle');
assert(qm.tracks[0]?.id === 'track_1' && qm.tracks[1]?.id === 'track_2' && qm.tracks[2]?.id === 'track_3', 'Original order restored');

console.log('✓ QueueMachine passed all assertions.');

// 2. CacheManager & LRU Eviction Tests
console.log('Testing CacheManager with LRU policy...');
class InMemoryStorageAdapter implements IStorageAdapter {
  private data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
  async clear(): Promise<void> {
    this.data.clear();
  }
  async keys(prefix?: string): Promise<string[]> {
    const res: string[] = [];
    for (const k of this.data.keys()) {
      if (!prefix || k.startsWith(prefix)) res.push(k);
    }
    return res;
  }
  async multiGet<T>(keys: readonly string[]): Promise<Map<string, T>> {
    const map = new Map<string, T>();
    for (const k of keys) {
      if (this.data.has(k)) map.set(k, this.data.get(k) as T);
    }
    return map;
  }
  async multiSet<T>(entries: readonly (readonly [string, T])[]): Promise<void> {
    for (const [k, v] of entries) this.data.set(k, v);
  }
  async multiRemove(keys: readonly string[]): Promise<void> {
    for (const k of keys) this.data.delete(k);
  }
}

class InMemoryCacheStorageAdapter implements ICacheStorageAdapter {
  private blobs = new Map<string, Uint8Array>();
  async save(id: string, data: Uint8Array): Promise<void> {
    this.blobs.set(id, data);
  }
  async read(id: string): Promise<Uint8Array | null> {
    return this.blobs.get(id) ?? null;
  }
  async has(id: string): Promise<boolean> {
    return this.blobs.has(id);
  }
  async getSize(id: string): Promise<number> {
    return this.blobs.get(id)?.byteLength ?? 0;
  }
  async delete(id: string): Promise<void> {
    this.blobs.delete(id);
  }
  async getUri(id: string): Promise<string | null> {
    return this.blobs.has(id) ? `memory://${id}` : null;
  }
  async clear(): Promise<void> {
    this.blobs.clear();
  }
}

async function testCache() {
  const metaStore = new InMemoryStorageAdapter();
  const binaryStore = new InMemoryCacheStorageAdapter();
  // Max size 300 bytes
  const cache = new CacheManager({
    metadataStorage: metaStore,
    binaryStorage: binaryStore,
    maxSizeBytes: 300,
    evictionPolicy: 'LRU',
  });

  const chunk100 = new Uint8Array(100);
  await cache.storeTrack('song_a', chunk100, { mimeType: 'audio/webm', bitrate: 160000, codec: 'opus' });
  await cache.storeTrack('song_b', chunk100, { mimeType: 'audio/webm', bitrate: 160000, codec: 'opus', isPinned: true });
  await cache.storeTrack('song_c', chunk100, { mimeType: 'audio/webm', bitrate: 160000, codec: 'opus' });

  let stats = await cache.getStats();
  assert(stats.totalBytes === 300, 'Cache should have 300 bytes');

  // Now adding song_d (100 bytes). Total would be 400 > 300.
  // song_a was accessed least recently. song_b is PINNED (immune). song_c is newer than song_a.
  // song_a must be evicted!
  await cache.storeTrack('song_d', chunk100, { mimeType: 'audio/webm', bitrate: 160000, codec: 'opus' });

  assert((await cache.has('song_a')) === false, 'song_a should have been evicted by LRU');
  assert((await cache.has('song_b')) === true, 'song_b (pinned) MUST NOT be evicted');
  assert((await cache.has('song_c')) === true, 'song_c should remain');
  assert((await cache.has('song_d')) === true, 'song_d should be present');

  console.log('✓ CacheManager LRU and pinned-immunity verified successfully.');
}
await testCache();

// 3. TypedEventEmitter Tests
console.log('Testing TypedEventEmitter...');
const emitter = new TypedEventEmitter<CoreEventMap>();
let receivedTrack: Track | null = null;
const unsub = emitter.on('playback:trackChange', (track) => {
  receivedTrack = track;
});

emitter.emit('playback:trackChange', sampleTracks[0]!);
assert(receivedTrack !== null && (receivedTrack as unknown as Track).id === 'track_1', 'Event listener should receive track_1');

unsub();
emitter.emit('playback:trackChange', sampleTracks[1]!);
assert((receivedTrack as unknown as Track).id === 'track_1', 'Unsubscribed listener should not receive updates');

console.log('✓ TypedEventEmitter passed all assertions.');

// 4. Cipher & Utility Tests
console.log('Testing Cipher and String Parsers...');
const parsedQuery = parseQueryString('s=abc123xyz&sp=sig&url=https%3A%2F%2Fexample.com%2Fstream%3Fid%3Dtest');
assert(parsedQuery['s'] === 'abc123xyz', 'Parsed query s mismatch');
assert(parsedQuery['sp'] === 'sig', 'Parsed query sp mismatch');
assert(parsedQuery['url'] === 'https://example.com/stream?id=test', 'Parsed query url mismatch');

const builtQuery = buildQueryString({ a: '1', b: 'test name' });
assert(builtQuery === 'a=1&b=test%20name', 'Built query mismatch');

const deciphered = SignatureDecipher.decipher('abcdef', [
  ['reverse', 0],
  ['swap', 2],
]);
assert(typeof deciphered === 'string', 'Decipher should return string');

const transformedN = transformNParam('abcz123ABC');
assert(transformedN.length === 10, 'N-param transform length match');

assert(parseDurationSec('3:45') === 225, 'Duration 3:45 should be 225s');
assert(parseDurationSec('1:02:15') === 3735, 'Duration 1:02:15 should be 3735s');

console.log('✓ Cipher and Parsers passed all assertions.');
console.log('--- ALL LEOLISEN CORE TESTS PASSED SUCCESSFULLY! ---');
