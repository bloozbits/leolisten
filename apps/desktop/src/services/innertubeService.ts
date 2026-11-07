import {
  InnertubeClient,
  parseHomeFeed,
  parseSearchResults,
  parseSearchSuggestions,
  parsePlayerResponse,
  parseAlbumPage,
  parsePlaylistPage,
  parseArtistPage,
  parseMusicResponsiveListItem,
  parseDurationSec,
  extractText,
  extractThumbnails,
  selectBestAudioFormat,
  type IHttpClientAdapter,
  type HttpRequestOptions,
  type HttpResponse,
  type SearchResultItem,
} from '@leolisen/core';
import type { TrackItem, MediaShelfItem, YTMSection, RealArtistDetails } from '../types/music';

/**
 * Universal Desktop HTTP Client Adapter.
 * In a browser dev environment (Vite), routes through Vite reverse proxy to bypass CORS.
 * In native Tauri or production desktop runtime, calls directly or uses Tauri fetch.
 */
class DesktopHttpClientAdapter implements IHttpClientAdapter {
  private resolveUrl(url: string): string {
    const isBrowser = typeof window !== 'undefined' && !(window as any).__TAURI__ && !(window as any).electron;
    if (isBrowser) {
      if (url.startsWith('https://music.youtube.com/youtubei/v1')) {
        return url.replace('https://music.youtube.com/youtubei/v1', '/yt-music-api');
      }
      if (url.startsWith('https://www.youtube.com/youtubei/v1')) {
        return url.replace('https://www.youtube.com/youtubei/v1', '/yt-watch-api');
      }
    }
    return url;
  }

  public async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    const targetUrl = this.resolveUrl(url);
    const headers = { ...(options?.headers || {}) };

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    const data = (options?.responseType === 'text' ? await res.text() : await res.json()) as T;
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  }

  public async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    const targetUrl = this.resolveUrl(url);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    };

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal: options?.signal,
    });

    const data = (options?.responseType === 'text' ? await res.text() : await res.json()) as T;
    return {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    };
  }
}

// Global Singleton Instance
const httpAdapter = new DesktopHttpClientAdapter();
export const innertube = new InnertubeClient({
  httpClient: httpAdapter,
  gl: 'US',
  hl: 'en',
});

/**
 * Robust High-Res Thumbnail resolver for YouTube Music and YouTube CDN images.
 * Upgrades low-res thumbnails to 544x544 HD square imagery or full HD 720p/1080p.
 */
export function getHighResThumbnail(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  let clean = url.trim();
  if (clean.startsWith('//')) clean = `https:${clean}`;

  // Google UserContent CDN (YouTube Music native albums, singles, artists, playlists)
  if (clean.includes('googleusercontent.com')) {
    if (clean.includes('=')) {
      return clean
        .replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj')
        .replace(/=s\d+.*$/, '=s544-c');
    }
    return `${clean}=w544-h544-l90-rj`;
  }

  // ytimg CDN (Video uploads)
  if (clean.includes('ytimg.com/vi/')) {
    const cleanNoQuery = clean.split('?')[0] || clean;
    if (cleanNoQuery.includes('hq720.jpg') || cleanNoQuery.includes('maxresdefault.jpg')) {
      return cleanNoQuery;
    }
    const match = clean.match(/\/vi\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }

  return clean.split('?')[0] || clean;
}

/**
 * Extracts the highest resolution thumbnail from an array of thumbnails.
 */
export function extractBestThumbnail(
  thumbnails?: readonly { url: string; width?: number; height?: number }[]
): string {
  if (!thumbnails || thumbnails.length === 0) return '';

  // Scan for 720p, maxres, or large width thumbnails
  for (const t of thumbnails) {
    if (
      t.url &&
      (t.url.includes('hq720') ||
        t.url.includes('maxresdefault') ||
        t.url.includes('1200') ||
        (t.width && t.width >= 500))
    ) {
      return getHighResThumbnail(t.url);
    }
  }

  // Fallback to the last (highest resolution) or first thumbnail
  const best = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
  return getHighResThumbnail(best);
}

/**
 * Transforms an Innertube SearchResultItem into a unified TrackItem.
 */
export function searchItemToTrack(item: SearchResultItem): TrackItem {
  if (item.type === 'track') {
    const t = item.data;
    const thumb = extractBestThumbnail(t.thumbnails);
    const primaryArtist = t.artists[0];
    return {
      id: t.id,
      title: t.title,
      artist: t.artists.map((a) => a.name).join(', ') || 'Unknown Artist',
      artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
      artistId: primaryArtist?.id,
      album: t.album?.name || 'Single',
      albumId: t.album?.id,
      durationSec: t.durationSec || 180,
      coverUrl: thumb,
      explicit: t.explicit,
    };
  }

  if (item.type === 'album') {
    const a = item.data;
    const thumb = extractBestThumbnail(a.thumbnails);
    return {
      id: a.id,
      title: a.name,
      artist: a.artist || 'Album',
      album: a.name,
      durationSec: 240,
      coverUrl: thumb,
    };
  }

  if (item.type === 'playlist') {
    const p = item.data;
    const thumb = extractBestThumbnail(p.thumbnails);
    return {
      id: p.id,
      title: p.title,
      artist: p.author || 'Playlist',
      album: p.title,
      durationSec: 300,
      coverUrl: thumb,
    };
  }

  // Artist
  const art = item.data;
  const thumb = extractBestThumbnail(art.thumbnails);
  return {
    id: art.id,
    title: art.name,
    artist: 'Artist',
    album: art.name,
    durationSec: 180,
    coverUrl: thumb,
  };
}

/**
 * Transforms an Innertube SearchResultItem into a MediaShelfItem.
 */
export function searchItemToShelfItem(item: SearchResultItem): MediaShelfItem {
  if (item.type === 'track') {
    const t = item.data;
    const thumb = extractBestThumbnail(t.thumbnails);
    return {
      id: t.id,
      title: t.title,
      subtitle: t.artists.map((a) => a.name).join(', ') || 'Track',
      coverUrl: thumb,
      type: 'single',
    };
  }

  if (item.type === 'album') {
    const a = item.data;
    const thumb = extractBestThumbnail(a.thumbnails);
    return {
      id: a.id,
      title: a.name,
      subtitle: a.artist || 'Album',
      coverUrl: thumb,
      type: 'album',
    };
  }

  if (item.type === 'playlist') {
    const p = item.data;
    const thumb = extractBestThumbnail(p.thumbnails);
    return {
      id: p.id,
      title: p.title,
      subtitle: p.author || 'Playlist',
      coverUrl: thumb,
      type: 'playlist',
    };
  }

  const art = item.data;
  const thumb = extractBestThumbnail(art.thumbnails);
  return {
    id: art.id,
    title: art.name,
    subtitle: 'Artist',
    coverUrl: thumb,
    type: 'artist',
  };
}

let homeFeedCache: { quickPicks: TrackItem[]; sections: YTMSection[] } | null = null;

export function getCachedHomeFeed(): { quickPicks: TrackItem[]; sections: YTMSection[] } | null {
  return homeFeedCache;
}

/**
 * Fetches real YouTube Music Home Feed shelves with robust in-memory caching.
 */
export async function getRealHomeFeed(force = false): Promise<{
  quickPicks: TrackItem[];
  sections: YTMSection[];
}> {
  if (!force && homeFeedCache) {
    return homeFeedCache;
  }

  try {
    const res = await innertube.getHomeFeed();
    const parsedSections = [...parseHomeFeed(res.data)];

    // Fetch continuation to get extra shelves if available
    try {
      const tab0 = (res.data as any)?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content;
      const sectionList = tab0?.sectionListRenderer;
      const cont = sectionList?.continuations?.[0]?.nextContinuationData?.continuation;
      if (cont) {
        const contRes = await innertube.browse('', cont);
        const contSections = parseHomeFeed(contRes.data);
        if (contSections.length > 0) {
          parsedSections.push(...contSections);
        }
      }
    } catch {
      // Continuation failure is non-fatal
    }

    let quickPicks: TrackItem[] = [];
    const sections: YTMSection[] = [];

    for (const sec of parsedSections) {
      const isQuickPicks =
        sec.title.toLowerCase().includes('quick pick') ||
        sec.title.toLowerCase().includes('listen again') ||
        sec.id === 'section_1';

      if (isQuickPicks && quickPicks.length === 0) {
        quickPicks = sec.items.map(searchItemToTrack);
      } else {
        if (!sections.some((s) => s.title.toLowerCase() === sec.title.toLowerCase())) {
          sections.push({
            id: sec.id,
            title: sec.title,
            strapline: sec.strapline,
            items: sec.items.map(searchItemToShelfItem),
          });
        }
      }
    }

    // Fallback: if quickPicks wasn't found from section titles, use first section's items
    if (quickPicks.length === 0 && sections.length > 0) {
      const firstSection = sections.shift();
      if (firstSection) {
        quickPicks = firstSection.items.map((item) => ({
          id: item.id,
          title: item.title,
          artist: item.subtitle,
          album: item.title,
          durationSec: 240,
          coverUrl: item.coverUrl,
        }));
      }
    }

    homeFeedCache = { quickPicks, sections };
    return homeFeedCache;
  } catch (err) {
    console.warn('[InnertubeService] Failed to fetch home feed:', err);
    throw err;
  }
}

/**
 * Searches real YouTube Music tracks.
 */
export async function searchRealMusic(query: string): Promise<readonly SearchResultItem[]> {
  try {
    const res = await innertube.search(query);
    return parseSearchResults(res.data);
  } catch (err) {
    console.warn('[InnertubeService] Search failed:', err);
    return [];
  }
}

/**
 * Fetches real search autocompletion suggestions.
 */
export async function getRealSearchSuggestions(input: string): Promise<string[]> {
  try {
    const res = await innertube.getSearchSuggestions(input);
    const parsed = parseSearchSuggestions(res.data);
    return parsed.map((s) => s.query);
  } catch (err) {
    console.warn('[InnertubeService] Suggestions failed:', err);
    return [];
  }
}

/**
 * Fetches the direct unthrottled audio stream URL for a given video ID.
 */
export async function getRealAudioStream(videoId: string): Promise<{
  streamUrl: string;
  durationSec: number;
  codec: string;
  bitrate: number;
} | null> {
  try {
    const res = await innertube.player(videoId);
    const manifest = parsePlayerResponse(videoId, res.data);
    const bestFormat = selectBestAudioFormat(manifest.formats, 'high', 'opus');

    if (!bestFormat || !bestFormat.url) {
      // Fallback to highest available format
      const fallback = manifest.formats[0];
      if (fallback?.url) {
        return {
          streamUrl: fallback.url,
          durationSec: manifest.durationSec,
          codec: fallback.codec,
          bitrate: fallback.bitrate,
        };
      }
      return null;
    }

    return {
      streamUrl: bestFormat.url,
      durationSec: manifest.durationSec,
      codec: bestFormat.codec,
      bitrate: bestFormat.bitrate,
    };
  } catch (err) {
    console.warn(`[InnertubeService] Failed to get audio stream for ${videoId}:`, err);
    return null;
  }
}

export interface RealAlbumDetails {
  id: string;
  title: string;
  artists: string;
  year?: string;
  coverUrl: string;
  tracks: TrackItem[];
}

export interface RealPlaylistDetails {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  tracks: TrackItem[];
}

const albumDetailsCache = new Map<string, RealAlbumDetails>();
const playlistDetailsCache = new Map<string, RealPlaylistDetails>();

export function getCachedAlbum(browseId: string): RealAlbumDetails | undefined {
  return albumDetailsCache.get(browseId);
}

export function getCachedPlaylist(playlistId: string): RealPlaylistDetails | undefined {
  return playlistDetailsCache.get(playlistId);
}

/**
 * Fetches full Album details and tracklist by browseId (e.g. MPREb_...).
 */
export async function getRealAlbum(browseId: string, force = false): Promise<RealAlbumDetails> {
  if (!force && albumDetailsCache.has(browseId)) {
    return albumDetailsCache.get(browseId)!;
  }

  try {
    const res = await innertube.browse(browseId);
    const album = parseAlbumPage(browseId, res.data);
    const cover = extractBestThumbnail(album.thumbnails);
    const artistName = album.artists.map((a) => a.name).join(', ') || 'Unknown Artist';

    const details: RealAlbumDetails = {
      id: album.id,
      title: album.title,
      artists: artistName,
      year: album.year ? String(album.year) : undefined,
      coverUrl: cover,
      tracks: album.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artists.map((a) => a.name).join(', ') || artistName,
        artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
        artistId: t.artists[0]?.id,
        album: album.title,
        albumId: album.id,
        durationSec: t.durationSec || 180,
        coverUrl: extractBestThumbnail(t.thumbnails) || cover,
        explicit: t.explicit,
      })),
    };

    albumDetailsCache.set(browseId, details);
    return details;
  } catch (err) {
    console.warn(`[InnertubeService] Failed to load album ${browseId}:`, err);
    throw err;
  }
}

/**
 * Fetches full Playlist details and tracklist by playlistId (e.g. VL..., PL..., RD...).
 */
export async function getRealPlaylist(playlistId: string, force = false): Promise<RealPlaylistDetails> {
  if (!force && playlistDetailsCache.has(playlistId)) {
    return playlistDetailsCache.get(playlistId)!;
  }

  try {
    const res = await innertube.browse(playlistId);
    const playlist = parsePlaylistPage(playlistId, res.data);
    const cover = extractBestThumbnail(playlist.thumbnails);

    const details: RealPlaylistDetails = {
      id: playlist.id,
      title: playlist.title,
      author: playlist.author?.name || 'YouTube Music',
      coverUrl: cover,
      tracks: playlist.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artists.map((a) => a.name).join(', ') || 'Unknown Artist',
        artists: t.artists.map((a) => ({ id: a.id, name: a.name })),
        artistId: t.artists[0]?.id,
        album: t.album?.name || playlist.title,
        durationSec: t.durationSec || 180,
        coverUrl: extractBestThumbnail(t.thumbnails) || cover,
        explicit: t.explicit,
      })),
    };

    playlistDetailsCache.set(playlistId, details);
    return details;
  } catch (err) {
    console.warn(`[InnertubeService] Failed to load playlist ${playlistId}:`, err);
    throw err;
  }
}

const artistDetailsCache = new Map<string, RealArtistDetails>();

export function getCachedArtist(idOrName: string): RealArtistDetails | undefined {
  const key = idOrName.trim().toLowerCase();
  return artistDetailsCache.get(key);
}

/**
 * Fetches real artist details from YouTube Music (avatar, banner, subscribers, views, bio, top tracks, albums, singles).
 */
export async function getRealArtist(artistIdOrName: string): Promise<RealArtistDetails> {
  const cleanQuery = artistIdOrName.trim();
  const cacheKey = cleanQuery.toLowerCase();
  if (artistDetailsCache.has(cacheKey)) {
    return artistDetailsCache.get(cacheKey)!;
  }

  let browseId = cleanQuery.startsWith('UC') || cleanQuery.startsWith('FE') ? cleanQuery : null;

  if (!browseId) {
    try {
      const searchRes = await innertube.search(cleanQuery);
      const str = JSON.stringify(searchRes.data);
      const match = str.match(/"browseId":"(UC[^"]+)"/);
      if (match && match[1]) {
        browseId = match[1];
      }
    } catch (err) {
      console.warn(`[InnertubeService] Failed to search artist channel for ${cleanQuery}:`, err);
    }
  }

  if (!browseId) {
    const fallback: RealArtistDetails = {
      id: cleanQuery,
      name: cleanQuery,
      avatarUrl: '',
      bannerUrl: '',
      subscribers: 'Artist',
      bio: undefined,
      topTracks: [],
      albums: [],
      singles: [],
    };
    return fallback;
  }

  try {
    const res = await innertube.browse(browseId);
    const data = res.data as Record<string, unknown>;

    // 1. Header Extraction
    const rawHeader = (data['header'] as Record<string, unknown> | undefined) || {};
    const header =
      (rawHeader['musicImmersiveHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (rawHeader['musicVisualHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (rawHeader['musicHeaderRenderer'] as Record<string, unknown> | undefined) ??
      rawHeader;

    const name = extractText(header['title']) || cleanQuery;

    // Subscribers & Stats
    const subBtn = (header['subscriptionButton'] as Record<string, unknown> | undefined)?.[
      'subscribeButtonRenderer'
    ] as Record<string, unknown> | undefined;
    const longSubText = extractText(subBtn?.['longSubscriberCountText']);
    const shortSubText = extractText(subBtn?.['subscriberCountText']);
    const subtitleSub = extractText(header['subtitle']);
    const subscribers =
      longSubText || (shortSubText ? `${shortSubText} subscribers` : subtitleSub) || 'Official Artist';

    // Bio
    let bio: string | undefined = extractText(header['description']) || undefined;

    // Thumbnails & Banner
    let rawThumbs: any[] = [];
    const thumbRenderer = (header['thumbnail'] as Record<string, unknown> | undefined)?.[
      'musicThumbnailRenderer'
    ] as Record<string, unknown> | undefined;
    if (thumbRenderer?.['thumbnail'] && Array.isArray((thumbRenderer['thumbnail'] as any)?.['thumbnails'])) {
      rawThumbs = (thumbRenderer['thumbnail'] as any)['thumbnails'];
    } else if (Array.isArray(header['thumbnails'])) {
      rawThumbs = header['thumbnails'] as any[];
    }

    const bannerThumb = rawThumbs[rawThumbs.length - 1]?.url || rawThumbs[0]?.url || '';
    const bannerUrl = getHighResThumbnail(bannerThumb);
    const avatarUrl = bannerThumb ? getHighResThumbnail(bannerThumb) : '';

    // Shelves & Sections
    const tabs = (data['contents'] as any)?.singleColumnBrowseResultsRenderer?.tabs;
    const secList = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];

    let views: string | undefined;
    const topTracks: TrackItem[] = [];
    const albums: MediaShelfItem[] = [];
    const singles: MediaShelfItem[] = [];

    for (const s of secList) {
      if (s.musicDescriptionShelfRenderer) {
        const descShelf = s.musicDescriptionShelfRenderer;
        if (!bio) {
          bio = extractText(descShelf.description);
        }
        const subh = extractText(descShelf.subheader);
        if (subh) {
          views = subh;
        }
      }

      const shelf = s.musicShelfRenderer || s.musicCarouselShelfRenderer;
      if (!shelf) continue;

      const shelfTitle = (
        extractText(shelf.title) ||
        extractText(shelf?.header?.musicCarouselShelfBasicHeaderRenderer?.title)
      ).toLowerCase();

      const contents = Array.isArray(shelf.contents) ? shelf.contents : [];

      if (shelfTitle.includes('song') && topTracks.length === 0) {
        for (const item of contents) {
          const listItem = item.musicResponsiveListItemRenderer;
          if (!listItem) continue;
          const parsed = parseMusicResponsiveListItem(item);
          if (parsed && parsed.type === 'track') {
            const tr = parsed.data;
            topTracks.push({
              id: tr.id,
              title: tr.title,
              artist: tr.artists.map((a) => a.name).join(', ') || name,
              artists: tr.artists.map((a) => ({ id: a.id, name: a.name })),
              artistId: tr.artists[0]?.id || browseId,
              album: tr.album?.name || 'Single',
              albumId: tr.album?.id,
              durationSec: tr.durationSec || 180,
              coverUrl: extractBestThumbnail(tr.thumbnails) || avatarUrl,
              explicit: tr.explicit,
            });
          }
        }
      } else if (shelfTitle.includes('album')) {
        for (const item of contents) {
          const twoRow = item.musicTwoRowItemRenderer;
          if (!twoRow) continue;
          const aTitle = extractText(twoRow.title);
          const aSub = extractText(twoRow.subtitle);
          const aId = twoRow.navigationEndpoint?.browseEndpoint?.browseId || '';
          const aThumbs = extractThumbnails(twoRow.thumbnailRenderer);
          if (aTitle && aId) {
            albums.push({
              id: aId,
              title: aTitle,
              subtitle: aSub || 'Album',
              year: aSub,
              coverUrl: extractBestThumbnail(aThumbs),
              type: 'album',
            });
          }
        }
      } else if (shelfTitle.includes('single') || shelfTitle.includes('ep')) {
        for (const item of contents) {
          const twoRow = item.musicTwoRowItemRenderer;
          if (!twoRow) continue;
          const sTitle = extractText(twoRow.title);
          const sSub = extractText(twoRow.subtitle);
          const sId = twoRow.navigationEndpoint?.browseEndpoint?.browseId || '';
          const sThumbs = extractThumbnails(twoRow.thumbnailRenderer);
          if (sTitle && sId) {
            singles.push({
              id: sId,
              title: sTitle,
              subtitle: sSub || 'Single',
              year: sSub,
              coverUrl: extractBestThumbnail(sThumbs),
              type: 'single',
            });
          }
        }
      }
    }

    if (bio) {
      bio = bio.replace(/\s*From Wikipedia\s*\([^)]*\)?/i, '').trim();
      if (
        /official.*(?:channel|youtube)/i.test(bio) ||
        /welcome to/i.test(bio) ||
        /subscribe/i.test(bio) ||
        /youtube/i.test(bio)
      ) {
        bio = undefined;
      }
    }

    const artistDetails: RealArtistDetails = {
      id: browseId,
      name,
      avatarUrl,
      bannerUrl,
      subscribers,
      views,
      bio,
      topTracks,
      albums,
      singles,
    };

    artistDetailsCache.set(cacheKey, artistDetails);
    artistDetailsCache.set(browseId.toLowerCase(), artistDetails);
    artistDetailsCache.set(name.toLowerCase(), artistDetails);

    return artistDetails;
  } catch (err) {
    console.warn(`[InnertubeService] Failed to load artist page for ${browseId}:`, err);
    throw err;
  }
}

/**
 * Extracts all performing/collaborating artists for a track.
 * Handles explicit artists array, multiple artists in artist string (e.g. "Kendrick Lamar & SZA"),
 * and featured artists in song title (e.g. "tv off (feat. Lefty Gunplay)").
 */
export function extractAllArtists(track: TrackItem): Array<{ id?: string; name: string }> {
  const result: Array<{ id?: string; name: string }> = [];
  const seenNames = new Set<string>();

  function addArtist(name?: string, id?: string) {
    if (!name) return;
    const clean = name.trim();
    if (!clean || clean.toLowerCase() === 'various artists' || clean.length < 2) return;
    const key = clean.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      result.push({ id: id || undefined, name: clean });
    }
  }

  // 1. Explicit artists array if available
  if (Array.isArray(track.artists) && track.artists.length > 0) {
    for (const a of track.artists) {
      addArtist(a.name, a.id);
    }
  }

  // 2. Parse from track.artist string (e.g. "Kendrick Lamar & SZA", "Lady Gaga, Bruno Mars")
  if (track.artist) {
    const parts = track.artist.split(/\s*(?:&|,|\bfeat\.|\bft\.|\bwith\b|\bx\b)\s*/i);
    for (const p of parts) {
      addArtist(p, p.toLowerCase() === track.artist.toLowerCase() ? track.artistId : undefined);
    }
  }

  // 3. Parse featured artists from track.title strictly inside brackets/parens with feat/ft/with
  if (track.title) {
    const featMatch = track.title.match(/[\(\[]\s*(?:feat\.|ft\.|featuring|with)\s+([^\)\]]+)[\)\]]/i);
    if (featMatch && featMatch[1]) {
      const featParts = featMatch[1].split(/\s*(?:&|,|\band\b)\s*/i);
      for (const fp of featParts) {
        addArtist(fp);
      }
    }
  }

  // 4. Fallback to primary artist if nothing was added
  if (result.length === 0 && track.artist) {
    addArtist(track.artist, track.artistId);
  }

  return result;
}

// In-memory cache for Up Next & Queue recommendations
const upNextTracksCache = new Map<string, TrackItem[]>();

/**
 * Synchronously retrieves cached Up Next tracks for a song if available.
 */
export function getCachedUpNextTracks(trackId: string): TrackItem[] | undefined {
  return upNextTracksCache.get(trackId);
}

/**
 * Fetches the real Up Next / Queue algorithm recommendations for a song from YouTube Music (v1/next).
 * Matches the exact queue and radio recommendations that YouTube Music plays next!
 */
export async function getRealUpNextTracks(trackId: string, playlistId?: string): Promise<TrackItem[]> {
  if (!trackId) return [];

  const cached = upNextTracksCache.get(trackId);
  if (cached && cached.length > 0) {
    return cached;
  }

  try {
    const response = await innertube.next({
      videoId: trackId,
      playlistId: playlistId || `RDAMVM${trackId}`,
    });

    const data = response.data as Record<string, unknown> | undefined;
    const watchNext = data?.['contents'] as Record<string, unknown> | undefined;
    const singleCol = watchNext?.['singleColumnMusicWatchNextResultsRenderer'] as Record<string, unknown> | undefined;
    const tabbed = singleCol?.['tabbedRenderer'] as Record<string, unknown> | undefined;
    const tabs = (tabbed?.['watchNextTabbedResultsRenderer'] as Record<string, unknown> | undefined)?.[
      'tabs'
    ] as Array<Record<string, unknown>> | undefined;

    const queueTab = tabs?.[0]?.['tabRenderer'] as Record<string, unknown> | undefined;
    const musicQueue = queueTab?.['content'] as Record<string, unknown> | undefined;
    const playlistPanel = (musicQueue?.['musicQueueRenderer'] as Record<string, unknown> | undefined)?.[
      'content'
    ] as Record<string, unknown> | undefined;
    const contents = (playlistPanel?.['playlistPanelRenderer'] as Record<string, unknown> | undefined)?.[
      'contents'
    ] as Array<Record<string, unknown>> | undefined;

    if (!Array.isArray(contents)) {
      return [];
    }

    const tracks: TrackItem[] = [];

    for (const item of contents) {
      if (!item || typeof item !== 'object') continue;
      const vr = (item['playlistPanelVideoRenderer'] ||
        (item['playlistPanelVideoWrapperRenderer'] as Record<string, unknown> | undefined)?.[
          'primaryRenderer'
        ]) as Record<string, unknown> | undefined;

      if (!vr || !vr['videoId']) continue;
      const videoId = String(vr['videoId']);

      // Skip the currently playing track itself from the Up Next list
      if (videoId === trackId) continue;

      const title = extractText(vr['title']) || 'Track';
      const artist =
        extractText(vr['shortBylineText']) ||
        extractText(vr['longBylineText']) ||
        'Unknown Artist';

      const lengthText = extractText(vr['lengthText']);
      const durationSec = lengthText ? parseDurationSec(lengthText) : 180;

      const thumbnails = (vr['thumbnail'] as Record<string, unknown> | undefined)?.[
        'thumbnails'
      ] as Array<{ url: string }> | undefined;
      const bestThumb =
        Array.isArray(thumbnails) && thumbnails.length > 0
          ? getHighResThumbnail(thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url)
          : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      tracks.push({
        id: videoId,
        title,
        artist,
        album: 'YouTube Music Radio',
        durationSec,
        coverUrl: bestThumb,
      });
    }

    if (tracks.length > 0) {
      upNextTracksCache.set(trackId, tracks);
    }

    return tracks;
  } catch (err) {
    console.warn(`[InnertubeService] Failed to fetch watch-next queue for ${trackId}:`, err);
    return [];
  }
}
