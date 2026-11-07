import type {
  AlbumSummary,
  ArtistSummary,
  SearchResultItem,
  SearchSuggestion,
  Thumbnail,
  Track,
} from '../../types/track.js';

/**
 * Extracts plain text from Innertube text objects (runs or simpleText).
 */
export function extractText(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '';
  const record = obj as Record<string, unknown>;

  if (typeof record['simpleText'] === 'string') {
    return record['simpleText'];
  }

  if (Array.isArray(record['runs'])) {
    return (record['runs'] as Array<Record<string, unknown>>)
      .map((run) => (typeof run['text'] === 'string' ? run['text'] : ''))
      .join('');
  }

  return '';
}

/**
 * Upgrades a thumbnail URL from YouTube / Google CDN to the highest possible resolution (1200px+ HD).
 */
export function upgradeThumbnailUrl(url?: string, targetSize = 1200): string {
  if (!url || typeof url !== 'string') return '';

  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  } else if (cleanUrl.startsWith('http://')) {
    cleanUrl = `https://${cleanUrl.slice(7)}`;
  }

  // Google UserContent CDN (YouTube Music albums, songs, artists, playlists)
  if (cleanUrl.includes('googleusercontent.com')) {
    const whMatch = cleanUrl.match(/=w(\d+)-h(\d+)(.*)$/);
    if (whMatch) {
      const origW = parseInt(whMatch[1] ?? '0', 10);
      const origH = parseInt(whMatch[2] ?? '0', 10);
      if (origW > 0 && origW === origH) {
        return cleanUrl.replace(/=w\d+-h\d+.*$/, `=w${targetSize}-h${targetSize}-l90-rj`);
      } else if (origW > 0 && origH > 0) {
        const scale = targetSize / Math.max(origW, origH);
        const newW = Math.round(origW * scale);
        const newH = Math.round(origH * scale);
        return cleanUrl.replace(/=w\d+-h\d+.*$/, `=w${newW}-h${newH}-p-l90-rj`);
      }
    }

    if (cleanUrl.match(/=s\d+/)) {
      return cleanUrl.replace(/=s\d+.*$/, `=s${targetSize}`);
    }
  }

  // YouTube Video CDN (i.ytimg.com)
  if (cleanUrl.includes('i.ytimg.com')) {
    // Strip downsampling query params (?sqp=...)
    return cleanUrl.split('?')[0] ?? cleanUrl;
  }

  return cleanUrl;
}

/**
 * Normalizes thumbnails from Innertube response objects and ensures ultra-high-resolution entry.
 */
export function extractThumbnails(obj: unknown): readonly Thumbnail[] {
  if (!obj || typeof obj !== 'object') return [];
  const record = obj as Record<string, unknown>;

  let thumbs: unknown[] = [];
  if (Array.isArray(record['thumbnails'])) {
    thumbs = record['thumbnails'];
  } else if (
    record['musicThumbnailRenderer'] &&
    typeof record['musicThumbnailRenderer'] === 'object'
  ) {
    const mtr = record['musicThumbnailRenderer'] as Record<string, unknown>;
    const innerThumb = mtr['thumbnail'] as Record<string, unknown> | undefined;
    if (innerThumb && Array.isArray(innerThumb['thumbnails'])) {
      thumbs = innerThumb['thumbnails'];
    }
  }

  const list: Thumbnail[] = thumbs
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t) => ({
      url: typeof t['url'] === 'string' ? t['url'] : '',
      width: typeof t['width'] === 'number' ? t['width'] : undefined,
      height: typeof t['height'] === 'number' ? t['height'] : undefined,
    }))
    .filter((t) => Boolean(t.url));

  if (list.length === 0) return [];

  // Upgrade the highest quality thumbnail to full 1200px+ HD and append as the ultimate entry
  const maxThumb = list[list.length - 1];
  if (maxThumb && maxThumb.url) {
    const highResUrl = upgradeThumbnailUrl(maxThumb.url, 1200);
    if (highResUrl && highResUrl !== maxThumb.url) {
      list.push({
        url: highResUrl,
        width: 1200,
        height: 1200,
      });
    }
  }

  return list;
}

/**
 * Parses time string (e.g. "3:45" or "1:15:30") into total seconds.
 */
export function parseDurationSec(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.trim().split(':').map(Number);
  if (parts.some((p) => isNaN(p))) return 0;

  if (parts.length === 2) {
    const [min, sec] = parts;
    return (min ?? 0) * 60 + (sec ?? 0);
  }
  if (parts.length === 3) {
    const [hr, min, sec] = parts;
    return (hr ?? 0) * 3600 + (min ?? 0) * 60 + (sec ?? 0);
  }
  return parts[0] ?? 0;
}

/**
 * Recursively locates all objects under a specific key in a nested JSON structure.
 */
function findAllNodes(obj: unknown, key: string): Record<string, unknown>[] {
  if (!obj || typeof obj !== 'object') return [];
  const results: Record<string, unknown>[] = [];
  const record = obj as Record<string, unknown>;

  if (record[key] && typeof record[key] === 'object') {
    results.push(record[key] as Record<string, unknown>);
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      results.push(...findAllNodes(child, key));
    }
  }

  return results;
}

/**
 * Parses YouTube Music top card shelf (`musicCardShelfRenderer`).
 * YouTube Music uses this for the #1 Top Result (Top artist, song, video, or album).
 */
export function parseMusicCardShelf(
  renderer: Record<string, unknown>,
): SearchResultItem[] {
  const items: SearchResultItem[] = [];
  const title = extractText(renderer['title']);
  if (!title) return items;

  const thumbnails = extractThumbnails(renderer['thumbnail']);
  const navEndpoint =
    (renderer['onTap'] as Record<string, unknown> | undefined) ??
    ((renderer['title'] as Record<string, unknown> | undefined)?.['runs'] as Array<Record<string, unknown>> | undefined)?.[0]?.['navigationEndpoint'] as Record<string, unknown> | undefined;

  const watchEndpoint = navEndpoint?.['watchEndpoint'] as Record<string, unknown> | undefined;
  const browseEndpoint = navEndpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;

  const browseConfigs = browseEndpoint?.['browseEndpointContextSupportedConfigs'] as
    | Record<string, unknown>
    | undefined;
  const browseMusicConfig = browseConfigs?.['browseEndpointContextMusicConfig'] as
    | Record<string, unknown>
    | undefined;
  const browsePageType = browseMusicConfig?.['pageType'];
  const browseId = typeof browseEndpoint?.['browseId'] === 'string' ? browseEndpoint['browseId'] : '';

  const subtitleRuns = Array.isArray((renderer['subtitle'] as Record<string, unknown> | undefined)?.['runs'])
    ? ((renderer['subtitle'] as Record<string, unknown>)['runs'] as Array<Record<string, unknown>>)
    : [];

  const artists: ArtistSummary[] = [];
  let durationSec = 0;
  let album: AlbumSummary | undefined;
  let explicit = false;

  // Check explicit badge
  const subtitleBadges = (renderer['subtitleBadges'] ?? renderer['badges']) as unknown;
  if (Array.isArray(subtitleBadges)) {
    for (const b of subtitleBadges) {
      const badgeRenderer = (b as Record<string, unknown>)['musicInlineBadgeRenderer'] as
        | Record<string, unknown>
        | undefined;
      const icon = badgeRenderer?.['icon'] as Record<string, unknown> | undefined;
      if (icon?.['iconType'] === 'MUSIC_EXPLICIT_BADGE') {
        explicit = true;
      }
    }
  }

  for (const r of subtitleRuns) {
    const text = typeof r['text'] === 'string' ? r['text'] : '';
    const endpoint = r['navigationEndpoint'] as Record<string, unknown> | undefined;
    const bEndpoint = endpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;
    const bId = typeof bEndpoint?.['browseId'] === 'string' ? bEndpoint['browseId'] : undefined;
    const configs = bEndpoint?.['browseEndpointContextSupportedConfigs'] as
      | Record<string, unknown>
      | undefined;
    const musicConfig = configs?.['browseEndpointContextMusicConfig'] as
      | Record<string, unknown>
      | undefined;
    const pType = musicConfig?.['pageType'];

    if (bId && (pType === 'MUSIC_PAGE_TYPE_ARTIST' || bId.startsWith('UC'))) {
      artists.push({ id: bId, name: text });
    } else if (bId && (pType === 'MUSIC_PAGE_TYPE_ALBUM' || bId.startsWith('MPREb_'))) {
      album = { id: bId, name: text };
    } else if (/^\d+:\d{2}(:\d{2})?$/.test(text.trim())) {
      durationSec = parseDurationSec(text.trim());
    }
  }

  // Fallback for duration from accessibility label
  if (durationSec === 0) {
    const labelObj = ((renderer['subtitle'] as Record<string, unknown> | undefined)?.['accessibility'] as Record<string, unknown> | undefined)?.['accessibilityData'] as Record<string, unknown> | undefined;
    const labelStr = typeof labelObj?.['label'] === 'string' ? labelObj['label'] : '';
    const minMatch = labelStr.match(/(\d+)\s+minute/i);
    const secMatch = labelStr.match(/(\d+)\s+second/i);
    if (minMatch || secMatch) {
      const m = minMatch ? parseInt(minMatch[1] ?? '0', 10) : 0;
      const s = secMatch ? parseInt(secMatch[1] ?? '0', 10) : 0;
      durationSec = m * 60 + s;
    }
  }

  // Fallback artist name from subtitle runs if no link
  if (artists.length === 0 && subtitleRuns.length > 0) {
    for (const r of subtitleRuns) {
      const txt = typeof r['text'] === 'string' ? r['text'].trim() : '';
      if (
        txt &&
        txt !== '•' &&
        txt !== '&' &&
        !txt.includes(':') &&
        !['song', 'video', 'artist', 'album', 'single', 'ep', 'playlist'].includes(txt.toLowerCase()) &&
        !txt.toLowerCase().includes('views') &&
        !txt.toLowerCase().includes('audience')
      ) {
        artists.push({ id: '', name: txt });
        break;
      }
    }
  }

  const videoId = typeof watchEndpoint?.['videoId'] === 'string' ? watchEndpoint['videoId'] : '';

  let parentArtist: ArtistSummary | undefined;

  if (videoId) {
    items.push({
      type: 'track',
      data: {
        id: videoId,
        title,
        artists: artists.length > 0 ? artists : [{ id: '', name: 'Unknown Artist' }],
        album,
        durationSec,
        thumbnails,
        explicit,
      },
    });
  } else if (browsePageType === 'MUSIC_PAGE_TYPE_ARTIST' || browseId.startsWith('UC')) {
    parentArtist = { id: browseId, name: title };
    items.push({
      type: 'artist',
      data: {
        id: browseId,
        name: title,
        thumbnails,
      },
    });
  } else if (browsePageType === 'MUSIC_PAGE_TYPE_ALBUM' || browseId.startsWith('MPREb_')) {
    items.push({
      type: 'album',
      data: {
        id: browseId,
        name: title,
        thumbnails,
        artist: artists[0]?.name,
      },
    });
  } else if (
    browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    browseId.startsWith('VL') ||
    browseId.startsWith('PL')
  ) {
    items.push({
      type: 'playlist',
      data: {
        id: browseId,
        title,
        thumbnails,
        author: artists[0]?.name,
      },
    });
  }

  // Also parse card contents (e.g. top songs associated with this artist or card)
  const cardContents = Array.isArray(renderer['contents'])
    ? (renderer['contents'] as Array<Record<string, unknown>>)
    : [];
  for (const c of cardContents) {
    const parsed = parseMusicResponsiveListItem(c, parentArtist);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

/**
 * Parses YouTube Music search response JSON.
 */
export function parseSearchResults(data: Record<string, unknown>): readonly SearchResultItem[] {
  const results: SearchResultItem[] = [];
  const seenIds = new Set<string>();

  try {
    // 1. First parse Top Result card shelves (`musicCardShelfRenderer`)
    const cardShelves = findAllNodes(data, 'musicCardShelfRenderer');
    for (const card of cardShelves) {
      const cardItems = parseMusicCardShelf(card);
      for (const item of cardItems) {
        const id = item.data.id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          results.push(item);
        }
      }
    }

    // 2. Parse all responsive list items
    const rawItems = findAllNodes(data, 'musicResponsiveListItemRenderer');
    for (const item of rawItems) {
      const parsed = parseMusicResponsiveListItem(item);
      if (parsed) {
        const id = parsed.data.id;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          results.push(parsed);
        } else if (!id) {
          results.push(parsed);
        }
      }
    }
  } catch {
    // Return partially collected results on unexpected schema change
  }

  return results;
}

/**
 * Parses search suggestions from 'music/get_search_suggestions'.
 */
export function parseSearchSuggestions(
  data: Record<string, unknown>,
): readonly SearchSuggestion[] {
  const suggestions: SearchSuggestion[] = [];

  try {
    const contents = findNestedArray(data, 'contents');
    if (!contents) return suggestions;

    for (const entry of contents) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const shelf = rec['searchSuggestionsSectionRenderer'] as Record<string, unknown> | undefined;
      const shelfContents = shelf ? (shelf['contents'] as unknown[]) : undefined;

      if (Array.isArray(shelfContents)) {
        for (const suggestionItem of shelfContents) {
          if (!suggestionItem || typeof suggestionItem !== 'object') continue;
          const sRec = suggestionItem as Record<string, unknown>;
          const renderer = (sRec['searchSuggestionRenderer'] ??
            sRec['historySuggestionRenderer']) as Record<string, unknown> | undefined;

          if (renderer) {
            const query = extractText(renderer['suggestion']);
            if (query) {
              suggestions.push({
                query,
                isHistory: Boolean(sRec['historySuggestionRenderer']),
              });
            }
          }
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  return suggestions;
}

/**
 * Parses individual `musicResponsiveListItemRenderer` nodes into typed items.
 */
export function parseMusicResponsiveListItem(
  node: Record<string, unknown>,
  parentArtist?: ArtistSummary,
): SearchResultItem | null {
  const renderer = (node['musicResponsiveListItemRenderer'] ?? node) as Record<string, unknown>;
  const flexColumns = Array.isArray(renderer['flexColumns'])
    ? (renderer['flexColumns'] as Array<Record<string, unknown>>)
    : [];

  if (flexColumns.length === 0) return null;

  // Title Column
  const firstCol = flexColumns[0];
  const firstColRenderer = (firstCol?.['musicResponsiveListItemFlexColumnRenderer'] ??
    firstCol) as Record<string, unknown> | undefined;
  const titleTextObj = firstColRenderer?.['text'];
  const title = extractText(titleTextObj);

  // Navigation Endpoint & Overlay Fallback
  const runs = (titleTextObj as Record<string, unknown> | undefined)?.['runs'];
  const firstRun = Array.isArray(runs) ? (runs[0] as Record<string, unknown> | undefined) : undefined;

  const overlay = (renderer['overlay'] as Record<string, unknown> | undefined)?.[
    'musicItemThumbnailOverlayRenderer'
  ] as Record<string, unknown> | undefined;
  const playBtn = (overlay?.['content'] as Record<string, unknown> | undefined)?.[
    'musicPlayButtonRenderer'
  ] as Record<string, unknown> | undefined;
  const playEndpoint = playBtn?.['playNavigationEndpoint'] as Record<string, unknown> | undefined;

  const navEndpoint =
    (firstRun?.['navigationEndpoint'] as Record<string, unknown> | undefined) ??
    (renderer['navigationEndpoint'] as Record<string, unknown> | undefined) ??
    playEndpoint;

  const watchEndpoint =
    (navEndpoint?.['watchEndpoint'] as Record<string, unknown> | undefined) ??
    (playEndpoint?.['watchEndpoint'] as Record<string, unknown> | undefined);

  const browseEndpoint = navEndpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;
  const playlistItemData = renderer['playlistItemData'] as Record<string, unknown> | undefined;

  // Thumbnails
  const thumbnails = extractThumbnails(renderer['thumbnail']);

  // Second Column (Metadata: Artists, Album, Duration, Type)
  const secondCol = flexColumns[1];
  const secondColRenderer = (secondCol?.['musicResponsiveListItemFlexColumnRenderer'] ??
    secondCol) as Record<string, unknown> | undefined;
  const secondRuns = (secondColRenderer?.['text'] as Record<string, unknown> | undefined)?.[
    'runs'
  ];

  const metaRuns = Array.isArray(secondRuns)
    ? (secondRuns as Array<Record<string, unknown>>)
    : [];

  const artists: ArtistSummary[] = [];
  let album: AlbumSummary | undefined;
  let durationSec = 0;
  let explicit = false;

  // Check explicit badge
  const badges = renderer['badges'];
  if (Array.isArray(badges)) {
    for (const b of badges) {
      const badgeRenderer = (b as Record<string, unknown>)['musicInlineBadgeRenderer'] as
        | Record<string, unknown>
        | undefined;
      const icon = badgeRenderer?.['icon'] as Record<string, unknown> | undefined;
      if (icon?.['iconType'] === 'MUSIC_EXPLICIT_BADGE') {
        explicit = true;
      }
    }
  }

  for (const r of metaRuns) {
    const text = typeof r['text'] === 'string' ? r['text'] : '';
    const endpoint = r['navigationEndpoint'] as Record<string, unknown> | undefined;
    const bEndpoint = endpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;
    const bId = typeof bEndpoint?.['browseId'] === 'string' ? bEndpoint['browseId'] : undefined;
    const configs = bEndpoint?.['browseEndpointContextSupportedConfigs'] as
      | Record<string, unknown>
      | undefined;
    const musicConfig = configs?.['browseEndpointContextMusicConfig'] as
      | Record<string, unknown>
      | undefined;
    const pageType = musicConfig?.['pageType'];

    if (bId && (pageType === 'MUSIC_PAGE_TYPE_ARTIST' || bId.startsWith('UC'))) {
      artists.push({ id: bId, name: text });
    } else if (bId && (pageType === 'MUSIC_PAGE_TYPE_ALBUM' || bId.startsWith('MPREb_'))) {
      album = { id: bId, name: text };
    } else if (text.includes(':') && /^\d+:\d{2}(:\d{2})?$/.test(text.trim())) {
      durationSec = parseDurationSec(text.trim());
    }
  }

  // Fallback for duration from fixedColumns (common in album & playlist tracks)
  if (durationSec === 0) {
    const fixedCols = Array.isArray(renderer['fixedColumns'])
      ? (renderer['fixedColumns'] as Array<Record<string, unknown>>)
      : [];
    for (const fc of fixedCols) {
      const fcRenderer = (fc?.['musicResponsiveListItemFixedColumnRenderer'] ?? fc) as
        | Record<string, unknown>
        | undefined;
      const text = extractText(fcRenderer?.['text']);
      if (text && /^\d+:\d{2}(:\d{2})?$/.test(text.trim())) {
        durationSec = parseDurationSec(text.trim());
        break;
      }
    }
  }

  // Fallback for duration in remaining flexColumns
  if (durationSec === 0 && flexColumns.length > 2) {
    for (let c = 2; c < flexColumns.length; c++) {
      const col = flexColumns[c];
      const colRenderer = (col?.['musicResponsiveListItemFlexColumnRenderer'] ?? col) as
        | Record<string, unknown>
        | undefined;
      const text = extractText(colRenderer?.['text']);
      if (text && /^\d+:\d{2}(:\d{2})?$/.test(text.trim())) {
        durationSec = parseDurationSec(text.trim());
        break;
      }
    }
  }

  // Fallback artist name from parent artist or first meta run if no navigationEndpoint was attached
  if (artists.length === 0) {
    if (parentArtist) {
      artists.push(parentArtist);
    } else if (metaRuns.length > 0) {
      const candidate = typeof metaRuns[0]?.['text'] === 'string' ? metaRuns[0]['text'].trim() : '';
      if (candidate && candidate !== '•' && !candidate.includes(':') && candidate.toLowerCase() !== 'song') {
        artists.push({ id: '', name: candidate });
      }
    }
  }

  // Deduce entity type
  const videoId =
    typeof watchEndpoint?.['videoId'] === 'string'
      ? watchEndpoint['videoId']
      : typeof playlistItemData?.['videoId'] === 'string'
        ? playlistItemData['videoId']
        : '';
  const browseId = typeof browseEndpoint?.['browseId'] === 'string' ? browseEndpoint['browseId'] : '';

  const browseConfigs = browseEndpoint?.['browseEndpointContextSupportedConfigs'] as
    | Record<string, unknown>
    | undefined;
  const browseMusicConfig = browseConfigs?.['browseEndpointContextMusicConfig'] as
    | Record<string, unknown>
    | undefined;
  const browsePageType = browseMusicConfig?.['pageType'];

  if (videoId) {
    const track: Track = {
      id: videoId,
      title,
      artists: artists.length > 0 ? artists : [{ id: '', name: 'Unknown Artist' }],
      album,
      durationSec,
      thumbnails,
      explicit,
    };
    return { type: 'track', data: track };
  }

  if (
    browsePageType === 'MUSIC_PAGE_TYPE_ALBUM' ||
    browseId.startsWith('MPREb_') ||
    browseId.startsWith('OLAK5uy_') ||
    browseId.startsWith('VLOLAK5uy_') ||
    browseId.startsWith('FEmusic_library_album')
  ) {
    return {
      type: 'album',
      data: {
        id: browseId,
        name: title,
        thumbnails,
        artist: artists[0]?.name,
      },
    };
  }

  if (
    browsePageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
    browseId.startsWith('UC') ||
    browseId.startsWith('FEmusic_library_artist')
  ) {
    return {
      type: 'artist',
      data: {
        id: browseId,
        name: title,
        thumbnails,
      },
    };
  }

  if (
    browsePageType === 'MUSIC_PAGE_TYPE_PLAYLIST' ||
    browseId.startsWith('VL') ||
    browseId.startsWith('PL') ||
    browseId.startsWith('RDAMVM')
  ) {
    return {
      type: 'playlist',
      data: {
        id: browseId,
        title,
        thumbnails,
        author: artists[0]?.name,
      },
    };
  }

  return null;
}

/**
 * Recursively inspects nested objects to locate a target array property.
 */
function findNestedArray(obj: unknown, key: string): unknown[] | null {
  if (!obj || typeof obj !== 'object') return null;
  const record = obj as Record<string, unknown>;

  if (Array.isArray(record[key])) {
    return record[key] as unknown[];
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      const found = findNestedArray(child, key);
      if (found) return found;
    }
  }

  return null;
}
