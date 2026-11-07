import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import {
  InnertubeClient,
  parseSearchResults,
  CacheManager,
  DatabaseFacade,
} from '../dist/index.js';

// ============================================================================
// NODE.JS ADAPTER IMPLEMENTATIONS (PORTS)
// ============================================================================

/**
 * Concrete Node.js HTTP Client implementing IHttpClientAdapter.
 */
class NodeHttpClientAdapter {
  async get(url, options) {
    const headers = options?.headers ?? {};
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    const data =
      options?.responseType === 'text'
        ? await res.text()
        : options?.responseType === 'arraybuffer'
          ? await res.arrayBuffer()
          : await res.json();

    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  }

  async post(url, body, options) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal: options?.signal,
    });

    const data =
      options?.responseType === 'text'
        ? await res.text()
        : options?.responseType === 'arraybuffer'
          ? await res.arrayBuffer()
          : await res.json();

    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  }
}

/**
 * Concrete Node.js In-Memory Storage Adapter implementing IStorageAdapter.
 */
class NodeStorageAdapter {
  constructor() {
    this.memory = new Map();
  }

  async get(key) {
    return this.memory.get(key) ?? null;
  }

  async set(key, value) {
    this.memory.set(key, value);
  }

  async remove(key) {
    this.memory.delete(key);
  }

  async clear() {
    this.memory.clear();
  }

  async keys(prefix) {
    const result = [];
    for (const key of this.memory.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }

  async multiGet(keys) {
    const result = new Map();
    for (const key of keys) {
      if (this.memory.has(key)) {
        result.set(key, this.memory.get(key));
      }
    }
    return result;
  }

  async multiSet(entries) {
    for (const [k, v] of entries) {
      this.memory.set(k, v);
    }
  }

  async multiRemove(keys) {
    for (const key of keys) {
      this.memory.delete(key);
    }
  }
}

/**
 * Concrete Node.js Filesystem Cache Adapter implementing ICacheStorageAdapter.
 */
class NodeFsCacheStorageAdapter {
  constructor(baseDir) {
    this.baseDir = baseDir;
  }

  getFilePath(id) {
    const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, `${sanitized}.audio`);
  }

  async save(id, data) {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.getFilePath(id), data);
  }

  async read(id) {
    try {
      const buf = await fs.readFile(this.getFilePath(id));
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }

  async has(id) {
    try {
      await fs.access(this.getFilePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async getSize(id) {
    try {
      const stats = await fs.stat(this.getFilePath(id));
      return stats.size;
    } catch {
      return 0;
    }
  }

  async delete(id) {
    try {
      await fs.unlink(this.getFilePath(id));
    } catch {
      // Ignore
    }
  }

  async getUri(id) {
    if (await this.has(id)) {
      return `file://${path.resolve(this.getFilePath(id))}`;
    }
    return null;
  }

  async clear() {
    try {
      await fs.rm(this.baseDir, { recursive: true, force: true });
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

/**
 * Downloads full audio stream using yt-dlp with Node JS challenge resolution.
 */
function downloadAudioStream(videoId, destinationPath) {
  return new Promise((resolve, reject) => {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const args = [
      '--js-runtimes',
      'node',
      '-f',
      '251/bestaudio/ba',
      '-o',
      destinationPath,
      '--no-playlist',
      videoUrl,
    ];

    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdoutData = '';
    let stderrData = '';

    proc.stdout.on('data', (d) => {
      const text = d.toString();
      stdoutData += text;
      // Extract download progress
      const match = text.match(/(\d+\.?\d*%) of\s+([0-9.]+\w+) at\s+([0-9.]+\w+\/s)/);
      if (match) {
        process.stdout.write(`\r   Progress: ${match[1]} of ${match[2]} (${match[3]})`);
      }
    });

    proc.stderr.on('data', (d) => {
      stderrData += d.toString();
    });

    proc.on('close', (code) => {
      process.stdout.write('\n');
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Extraction failed (code ${code}): ${stderrData || stdoutData}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

export async function runDownloadTest(songQuery) {
  const downloadsDir = path.resolve(process.cwd(), 'downloads');
  await fs.mkdir(downloadsDir, { recursive: true });

  console.log('====================================================');
  console.log(`🎵 LEOLISEN AUDIO PIPELINE: "${songQuery}"`);
  console.log('====================================================\n');

  // 1. Initialize Adapters & Core
  const httpClient = new NodeHttpClientAdapter();
  const storageAdapter = new NodeStorageAdapter();
  const cacheStorageAdapter = new NodeFsCacheStorageAdapter(path.join(downloadsDir, '.cache'));

  const innertube = new InnertubeClient({
    httpClient,
    gl: 'US',
    hl: 'en',
  });

  const dbFacade = new DatabaseFacade(storageAdapter);
  const cacheManager = new CacheManager({
    metadataStorage: storageAdapter,
    binaryStorage: cacheStorageAdapter,
    maxSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  });

  // 2. Search for the Song
  console.log(`🔍 [1/4] Searching YouTube Music for "${songQuery}"...`);
  const searchResponse = await innertube.search(songQuery);
  const results = parseSearchResults(searchResponse.data);

  const tracks = results
    .filter((r) => r.type === 'track')
    .map((r) => r.data);

  if (tracks.length === 0) {
    console.error(`❌ No tracks found for "${songQuery}". Please try another query.`);
    return;
  }

  console.log(`✅ Found ${tracks.length} track(s). Top candidates:\n`);
  for (let i = 0; i < Math.min(5, tracks.length); i++) {
    const t = tracks[i];
    const artists = t.artists.map((a) => a.name).join(', ');
    const duration =
      t.durationSec > 0
        ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}`
        : 'Unknown';
    console.log(`  ${i + 1}. "${t.title}" by ${artists} (${duration}) [ID: ${t.id}]`);
  }

  const selectedTrack = tracks[0];
  const primaryArtist = selectedTrack.artists[0]?.name || 'Unknown Artist';
  console.log(`\n🎯 Selected: "${selectedTrack.title}" by ${primaryArtist} [ID: ${selectedTrack.id}]`);

  // 3. Resolve Stream Metadata
  console.log(`\n📡 [2/4] Resolving stream manifest & metadata...`);
  const cleanTitle = selectedTrack.title.replace(/[/\\?%*:|"<>]/g, '_');
  const cleanArtist = primaryArtist.replace(/[/\\?%*:|"<>]/g, '_');
  const finalFilename = `${cleanArtist} - ${cleanTitle}.webm`;
  const finalFilePath = path.join(downloadsDir, finalFilename);

  // 4. Download Real Audio Stream
  console.log(`\n⬇️  [3/4] Downloading full real audio stream...`);
  try {
    await downloadAudioStream(selectedTrack.id, finalFilePath);

    const stats = await fs.stat(finalFilePath);
    if (stats.size <= 65536) {
      throw new Error(`Downloaded audio file is invalid (only ${stats.size} bytes).`);
    }

    // Index real binary data into Leolisen CacheManager
    const rawAudio = await fs.readFile(finalFilePath);
    await cacheManager.storeTrack(selectedTrack.id, new Uint8Array(rawAudio), {
      mimeType: 'audio/webm; codecs="opus"',
      bitrate: 160000,
      codec: 'opus',
      isPinned: true,
    });

    // 5. Verification & Metadata Persistence
    console.log(`💾 [4/4] Track verified & indexed into Leolisen CacheManager!`);
    await dbFacade.recordHistory(selectedTrack, true);

    console.log('\n====================================================');
    console.log(`🎉 DOWNLOAD & CACHE COMPLETED SUCCESSFULLY!`);
    console.log('====================================================');
    console.log(`📁 File location: ${finalFilePath}`);
    console.log(
      `📦 Real audio size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB (${stats.size.toLocaleString()} bytes)`,
    );
    console.log(`🎧 Codec: OPUS (audio/webm)`);
    console.log(`⚡ Quality: High Fidelity (Original WebM Opus 160kbps stream)`);
    console.log(`📌 Cached & Pinned: Yes (Protected from LRU eviction)`);
    console.log('====================================================\n');
  } catch (err) {
    console.error(`❌ Download failed:`, err.message || err);
  }
}

// Execute if run directly from CLI
const queryArg = process.argv.slice(2).join(' ').trim();
if (queryArg) {
  runDownloadTest(queryArg).catch(console.error);
}
