import type {
  Album,
  AlbumSummary,
  Artist,
  BrowseSection,
  Playlist,
  SearchResultItem,
  Thumbnail,
  Track,
} from '../../types/track.js';
import {
  extractText,
  extractThumbnails,
  parseMusicResponsiveListItem,
} from './search.js';

/**
 * Parses YouTube Music Home Feed shelves into structured BrowseSection entities.
 */
export function parseHomeFeed(data: Record<string, unknown>): readonly BrowseSection[] {
  const sections: BrowseSection[] = [];

  try {
    const sectionList = findSectionList(data);
    if (!sectionList) return sections;

    for (const sectionNode of sectionList) {
      if (!sectionNode || typeof sectionNode !== 'object') continue;
      const rec = sectionNode as Record<string, unknown>;
      const carousel = (rec['musicCarouselShelfRenderer'] ??
        rec['musicImmersiveCarouselShelfRenderer']) as Record<string, unknown> | undefined;

      if (!carousel) continue;

      const header = carousel['header'] as Record<string, unknown> | undefined;
      const basicHeader = header?.['musicCarouselShelfBasicHeaderRenderer'] as
        | Record<string, unknown>
        | undefined;

      const title = extractText(basicHeader?.['title']) || 'Recommended';
      const strapline = extractText(basicHeader?.['strapline']);
      const rawItems = Array.isArray(carousel['contents']) ? carousel['contents'] : [];

      const items: SearchResultItem[] = [];
      for (const itemNode of rawItems) {
        if (!itemNode || typeof itemNode !== 'object') continue;
        const parsed = parseTwoRowOrListItem(itemNode as Record<string, unknown>);
        if (parsed) {
          items.push(parsed);
        }
      }

      if (items.length > 0) {
        sections.push({
          id: `section_${sections.length + 1}`,
          title,
          strapline: strapline || undefined,
          items,
        });
      }
    }
  } catch {
    // Graceful fallback
  }

  return sections;
}

/**
 * Parses an Album Browse page (browseId starting with MPREb_ or release playlist).
 */
export function parseAlbumPage(browseId: string, data: Record<string, unknown>): Album {
  let title = 'Unknown Album';
  const artists: AlbumSummary[] = [];
  let year: string | undefined;
  let thumbnails: readonly Thumbnail[] = [];
  const tracks: Track[] = [];

  try {
    const header = findHeader(data);
    if (header) {
      title = extractText(header['title']) || title;
      thumbnails = extractThumbnails(header['thumbnail'] ?? header['foregroundThumbnail']);

      const straplineRuns = (header['straplineTextOne'] as Record<string, unknown> | undefined)?.[
        'runs'
      ] as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(straplineRuns)) {
        for (const run of straplineRuns) {
          const text = typeof run['text'] === 'string' ? run['text'] : '';
          const nav = run['navigationEndpoint'] as Record<string, unknown> | undefined;
          const bId = (nav?.['browseEndpoint'] as Record<string, unknown> | undefined)?.[
            'browseId'
          ];
          if (text && text !== ' • ' && text !== ', ') {
            artists.push({ id: typeof bId === 'string' ? bId : '', name: text });
          }
        }
      }

      const subtitleRuns = (header['subtitle'] as Record<string, unknown> | undefined)?.[
        'runs'
      ] as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(subtitleRuns)) {
        for (const run of subtitleRuns) {
          const text = typeof run['text'] === 'string' ? run['text'] : '';
          const nav = run['navigationEndpoint'] as Record<string, unknown> | undefined;
          const bId = (nav?.['browseEndpoint'] as Record<string, unknown> | undefined)?.[
            'browseId'
          ];
          if (typeof bId === 'string' && bId.startsWith('UC') && artists.length === 0) {
            artists.push({ id: bId, name: text });
          } else if (/^\d{4}$/.test(text.trim())) {
            year = text.trim();
          }
        }
      }

      const secondSubtitleRuns = (header['secondSubtitle'] as Record<string, unknown> | undefined)?.[
        'runs'
      ] as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(secondSubtitleRuns)) {
        for (const run of secondSubtitleRuns) {
          const text = typeof run['text'] === 'string' ? run['text'] : '';
          if (!year && /^\d{4}$/.test(text.trim())) {
            year = text.trim();
          }
        }
      }
    }

    // Extract Tracks from Shelf
    const shelfItems = findShelfContents(data);
    for (const item of shelfItems) {
      if (!item || typeof item !== 'object') continue;
      const parsed = parseMusicResponsiveListItem(item as Record<string, unknown>);
      if (parsed && parsed.type === 'track') {
        const t = { ...parsed.data };
        // Populate track artwork and artist from album if missing
        if ((!t.thumbnails || t.thumbnails.length === 0) && thumbnails.length > 0) {
          t.thumbnails = thumbnails;
        }
        if (
          (!t.artists || t.artists.length === 0 || t.artists[0]?.name === 'Unknown Artist') &&
          artists.length > 0
        ) {
          t.artists = artists;
        }
        if (!t.album) {
          t.album = { id: browseId, name: title };
        }
        tracks.push(t);
      }
    }

    // Fallbacks if header was sparse
    if (title === 'Unknown Album' && tracks.length > 0 && tracks[0]?.album?.name) {
      title = tracks[0].album.name;
    }
    if (artists.length === 0 && tracks.length > 0 && tracks[0]?.artists && tracks[0].artists.length > 0) {
      artists.push(...tracks[0].artists);
    }
    if (thumbnails.length === 0 && tracks.length > 0 && tracks[0]?.thumbnails && tracks[0].thumbnails.length > 0) {
      thumbnails = tracks[0].thumbnails;
    }
  } catch {
    // Return what was successfully parsed
  }

  return {
    id: browseId,
    title,
    artists,
    year,
    thumbnails,
    tracks,
    trackCount: tracks.length,
  };
}

/**
 * Parses an Artist Browse page (channelId starting with UC).
 */
export function parseArtistPage(channelId: string, data: Record<string, unknown>): Artist {
  let name = 'Unknown Artist';
  let thumbnails: readonly Thumbnail[] = [];
  let subscribers: string | undefined;
  let description: string | undefined;
  const topTracks: Track[] = [];
  const albums: AlbumSummary[] = [];
  const singles: AlbumSummary[] = [];

  try {
    const header = findHeader(data);
    if (header) {
      name = extractText(header['title']) || name;
      thumbnails = extractThumbnails(
        header['thumbnail'] ?? header['foregroundThumbnail'] ?? header['thumbnails']
      );

      const subBtn = (header['subscriptionButton'] as Record<string, unknown> | undefined)?.[
        'subscribeButtonRenderer'
      ] as Record<string, unknown> | undefined;
      subscribers =
        extractText(subBtn?.['longSubscriberCountText']) ||
        extractText(subBtn?.['subscriberCountText']) ||
        extractText(header['subtitle']) ||
        undefined;

      description = extractText(header['description']) || undefined;
    }

    const sectionList = findSectionList(data);
    if (sectionList) {
      for (const sectionNode of sectionList) {
        if (!sectionNode || typeof sectionNode !== 'object') continue;
        const rec = sectionNode as Record<string, unknown>;

        // Check for artist description shelf
        if (rec['musicDescriptionShelfRenderer']) {
          const descShelf = rec['musicDescriptionShelfRenderer'] as Record<string, unknown>;
          if (!description) {
            description = extractText(descShelf['description']) || undefined;
          }
        }

        const shelf = (rec['musicShelfRenderer'] ??
          rec['musicCarouselShelfRenderer']) as Record<string, unknown> | undefined;
        if (!shelf) continue;

        const shelfHeader = shelf['header'] as Record<string, unknown> | undefined;
        const basicHeader = shelfHeader?.['musicCarouselShelfBasicHeaderRenderer'] as
          | Record<string, unknown>
          | undefined;
        const shelfTitle = extractText(shelf['title'] ?? basicHeader?.['title']).toLowerCase();

        const rawContents = Array.isArray(shelf['contents']) ? shelf['contents'] : [];

        for (const item of rawContents) {
          if (!item || typeof item !== 'object') continue;
          const parsed = parseTwoRowOrListItem(item as Record<string, unknown>);
          if (!parsed) continue;

          if (parsed.type === 'track' && shelfTitle.includes('song')) {
            topTracks.push(parsed.data);
          } else if (parsed.type === 'album') {
            if (shelfTitle.includes('single') || shelfTitle.includes('ep')) {
              singles.push({ id: parsed.data.id, name: parsed.data.name });
            } else {
              albums.push({ id: parsed.data.id, name: parsed.data.name });
            }
          }
        }
      }
    }

    // Clean Wikipedia suffix if present
    if (description) {
      description = description.replace(/\s*From Wikipedia\s*\([^)]*\)?/i, '').trim();
    }
  } catch {
    // Fallback
  }

  return {
    id: channelId,
    name,
    thumbnails,
    subscribers,
    description,
    topTracks,
    albums,
    singles,
  };
}

/**
 * Parses a Playlist page (VL / RDAMVM / VLPL).
 */
export function parsePlaylistPage(playlistId: string, data: Record<string, unknown>): Playlist {
  let title = 'Playlist';
  let author: AlbumSummary | undefined;
  let thumbnails: readonly Thumbnail[] = [];
  const tracks: Track[] = [];

  try {
    const header = findHeader(data);
    if (header) {
      title = extractText(header['title']) || title;
      thumbnails = extractThumbnails(header['thumbnail'] ?? header['foregroundThumbnail']);

      const straplineRuns = (header['straplineTextOne'] as Record<string, unknown> | undefined)?.[
        'runs'
      ] as Array<Record<string, unknown>> | undefined;

      if (Array.isArray(straplineRuns) && straplineRuns.length > 0) {
        const text = straplineRuns[0]?.['text'];
        const bId = (
          (straplineRuns[0]?.['navigationEndpoint'] as Record<string, unknown> | undefined)?.[
            'browseEndpoint'
          ] as Record<string, unknown> | undefined
        )?.['browseId'];
        if (typeof text === 'string' && text) {
          author = { id: typeof bId === 'string' ? bId : '', name: text };
        }
      }

      if (!author) {
        const facepile = (header['facepile'] as Record<string, unknown> | undefined)?.[
          'avatarStackViewModel'
        ] as Record<string, unknown> | undefined;
        const facepileText = (facepile?.['text'] as Record<string, unknown> | undefined)?.[
          'content'
        ];
        if (typeof facepileText === 'string' && facepileText) {
          author = { id: '', name: facepileText };
        }
      }

      if (!author) {
        const subtitleRuns = (header['subtitle'] as Record<string, unknown> | undefined)?.[
          'runs'
        ] as Array<Record<string, unknown>> | undefined;

        if (Array.isArray(subtitleRuns) && subtitleRuns.length > 0) {
          for (const run of subtitleRuns) {
            const text = typeof run?.['text'] === 'string' ? run['text'] : '';
            const bId = (
              (run?.['navigationEndpoint'] as Record<string, unknown> | undefined)?.[
                'browseEndpoint'
              ] as Record<string, unknown> | undefined
            )?.['browseId'];

            if (text && text !== 'Playlist' && text !== ' • ' && !/^\d{4}$/.test(text.trim())) {
              author = { id: typeof bId === 'string' ? bId : '', name: text };
              break;
            }
          }
        }
      }
    }

    const shelfContents = findShelfContents(data);
    for (const item of shelfContents) {
      if (!item || typeof item !== 'object') continue;
      const parsed = parseMusicResponsiveListItem(item as Record<string, unknown>);
      if (parsed && parsed.type === 'track') {
        const t = { ...parsed.data };
        if ((!t.thumbnails || t.thumbnails.length === 0) && thumbnails.length > 0) {
          t.thumbnails = thumbnails;
        }
        tracks.push(t);
      }
    }

    // Fallback thumbnail from first track if header had no thumbnail
    if (thumbnails.length === 0 && tracks.length > 0 && tracks[0]?.thumbnails && tracks[0].thumbnails.length > 0) {
      thumbnails = tracks[0].thumbnails;
    }
  } catch {
    // Fallback
  }

  return {
    id: playlistId,
    title,
    author,
    thumbnails,
    trackCount: tracks.length,
    tracks,
  };
}

/**
 * Handles both musicTwoRowItemRenderer and musicResponsiveListItemRenderer.
 */
function parseTwoRowOrListItem(node: Record<string, unknown>): SearchResultItem | null {
  if (node['musicResponsiveListItemRenderer']) {
    return parseMusicResponsiveListItem(node);
  }

  const twoRow = (node['musicTwoRowItemRenderer'] ?? node) as Record<string, unknown>;
  const title = extractText(twoRow['title']);
  if (!title) return null;

  const thumbnails = extractThumbnails(twoRow['thumbnailRenderer']);
  const navEndpoint = twoRow['navigationEndpoint'] as Record<string, unknown> | undefined;
  const watchEndpoint = navEndpoint?.['watchEndpoint'] as Record<string, unknown> | undefined;
  const browseEndpoint = navEndpoint?.['browseEndpoint'] as Record<string, unknown> | undefined;

  const videoId = typeof watchEndpoint?.['videoId'] === 'string' ? watchEndpoint['videoId'] : '';
  const browseId = typeof browseEndpoint?.['browseId'] === 'string' ? browseEndpoint['browseId'] : '';

  const subtitle = extractText(twoRow['subtitle']);
  const configs = browseEndpoint?.['browseEndpointContextSupportedConfigs'] as Record<string, unknown> | undefined;
  const musicConfig = configs?.['browseEndpointContextMusicConfig'] as Record<string, unknown> | undefined;
  const pageType = musicConfig?.['pageType'];

  const mtr = (twoRow['thumbnailRenderer'] as Record<string, unknown> | undefined)?.[
    'musicThumbnailRenderer'
  ] as Record<string, unknown> | undefined;
  const thumbnailCrop = mtr?.['thumbnailCrop'];

  if (videoId) {
    return {
      type: 'track',
      data: {
        id: videoId,
        title,
        artists: [{ id: '', name: subtitle || 'Unknown Artist' }],
        durationSec: 0,
        thumbnails,
      },
    };
  }

  // Check Artist before Album/Playlist
  const isArtist =
    pageType === 'MUSIC_PAGE_TYPE_ARTIST' ||
    browseId.startsWith('UC') ||
    browseId.startsWith('FEmusic_library_artist') ||
    thumbnailCrop === 'MUSIC_THUMBNAIL_CROP_CIRCLE' ||
    subtitle.toLowerCase().trim() === 'artist' ||
    subtitle.toLowerCase().startsWith('artist') ||
    subtitle.toLowerCase().endsWith('artist');

  if (isArtist) {
    return {
      type: 'artist',
      data: {
        id: browseId,
        name: title,
        thumbnails,
      },
    };
  }

  if (browseId.startsWith('MPREb_')) {
    return {
      type: 'album',
      data: {
        id: browseId,
        name: title,
        thumbnails,
        artist: subtitle,
      },
    };
  }

  if (browseId.startsWith('VL') || browseId.startsWith('RDAMVM')) {
    return {
      type: 'playlist',
      data: {
        id: browseId,
        title,
        thumbnails,
        author: subtitle,
      },
    };
  }

  return null;
}

function findSectionList(data: Record<string, unknown>): unknown[] | null {
  try {
    const contents = data['contents'] as Record<string, unknown> | undefined;
    if (!contents) return null;

    // Check singleColumnBrowseResultsRenderer
    const single = contents['singleColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
    const singleTabs = Array.isArray(single?.['tabs']) ? single?.['tabs'] : undefined;
    const singleTabRenderer = (singleTabs?.[0] as Record<string, unknown> | undefined)?.[
      'tabRenderer'
    ] as Record<string, unknown> | undefined;
    const singleSectionList = (singleTabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
      'sectionListRenderer'
    ] as Record<string, unknown> | undefined;

    if (Array.isArray(singleSectionList?.['contents'])) {
      return singleSectionList['contents'];
    }

    // Check twoColumnBrowseResultsRenderer
    const twoCol = contents['twoColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
    const twoTabs = Array.isArray(twoCol?.['tabs']) ? twoCol?.['tabs'] : undefined;
    const twoTabRenderer = (twoTabs?.[0] as Record<string, unknown> | undefined)?.[
      'tabRenderer'
    ] as Record<string, unknown> | undefined;
    const twoSectionList = (twoTabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
      'sectionListRenderer'
    ] as Record<string, unknown> | undefined;

    if (Array.isArray(twoSectionList?.['contents'])) {
      return twoSectionList['contents'];
    }

    // Check direct sectionListRenderer
    const directSectionList = contents['sectionListRenderer'] as Record<string, unknown> | undefined;
    if (Array.isArray(directSectionList?.['contents'])) {
      return directSectionList['contents'];
    }
  } catch {
    // Return null
  }
  return null;
}

function findHeader(data: Record<string, unknown>): Record<string, unknown> | null {
  // 1. Direct header property on root data
  const header = data['header'] as Record<string, unknown> | undefined;
  if (header) {
    const unwrap =
      (header['musicDetailHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (header['musicResponsiveHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (header['musicImmersiveHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (header['musicVisualHeaderRenderer'] as Record<string, unknown> | undefined) ??
      header;
    if (unwrap) return unwrap;
  }

  // 2. Look inside twoColumnBrowseResultsRenderer & singleColumnBrowseResultsRenderer
  const contents = data['contents'] as Record<string, unknown> | undefined;
  if (!contents) return null;

  const candidateSections: unknown[] = [];

  const twoCol = contents['twoColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
  if (twoCol) {
    const tabs = Array.isArray(twoCol['tabs']) ? twoCol['tabs'] : undefined;
    const tabRenderer = (tabs?.[0] as Record<string, unknown> | undefined)?.[
      'tabRenderer'
    ] as Record<string, unknown> | undefined;
    const sectionList = (tabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
      'sectionListRenderer'
    ] as Record<string, unknown> | undefined;
    if (Array.isArray(sectionList?.['contents'])) {
      candidateSections.push(...sectionList['contents']);
    }

    const secContents = (
      (twoCol['secondaryContents'] as Record<string, unknown> | undefined)?.[
        'sectionListRenderer'
      ] as Record<string, unknown> | undefined
    )?.['contents'];
    if (Array.isArray(secContents)) {
      candidateSections.push(...secContents);
    }
  }

  const single = contents['singleColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
  if (single) {
    const tabs = Array.isArray(single['tabs']) ? single['tabs'] : undefined;
    const tabRenderer = (tabs?.[0] as Record<string, unknown> | undefined)?.[
      'tabRenderer'
    ] as Record<string, unknown> | undefined;
    const sectionList = (tabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
      'sectionListRenderer'
    ] as Record<string, unknown> | undefined;
    if (Array.isArray(sectionList?.['contents'])) {
      candidateSections.push(...sectionList['contents']);
    }
  }

  for (const item of candidateSections) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const h =
      (rec['musicResponsiveHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (rec['musicDetailHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (rec['musicVisualHeaderRenderer'] as Record<string, unknown> | undefined) ??
      (rec['musicImmersiveHeaderRenderer'] as Record<string, unknown> | undefined);
    if (h) return h;
  }

  return null;
}

function findShelfContents(data: Record<string, unknown>): unknown[] {
  try {
    const contents = data['contents'] as Record<string, unknown> | undefined;
    if (!contents) return [];

    const candidateSections: unknown[] = [];

    // In twoColumnBrowseResultsRenderer, the track shelf is typically in secondaryContents
    const twoCol = contents['twoColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
    if (twoCol) {
      const secContents = (
        (twoCol['secondaryContents'] as Record<string, unknown> | undefined)?.[
          'sectionListRenderer'
        ] as Record<string, unknown> | undefined
      )?.['contents'];
      if (Array.isArray(secContents)) {
        candidateSections.push(...secContents);
      }

      const tabs = Array.isArray(twoCol['tabs']) ? twoCol['tabs'] : undefined;
      const tabRenderer = (tabs?.[0] as Record<string, unknown> | undefined)?.[
        'tabRenderer'
      ] as Record<string, unknown> | undefined;
      const tabSectionList = (tabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
        'sectionListRenderer'
      ] as Record<string, unknown> | undefined;
      if (Array.isArray(tabSectionList?.['contents'])) {
        candidateSections.push(...tabSectionList['contents']);
      }
    }

    const single = contents['singleColumnBrowseResultsRenderer'] as Record<string, unknown> | undefined;
    if (single) {
      const tabs = Array.isArray(single['tabs']) ? single['tabs'] : undefined;
      const tabRenderer = (tabs?.[0] as Record<string, unknown> | undefined)?.[
        'tabRenderer'
      ] as Record<string, unknown> | undefined;
      const sectionList = (tabRenderer?.['content'] as Record<string, unknown> | undefined)?.[
        'sectionListRenderer'
      ] as Record<string, unknown> | undefined;
      if (Array.isArray(sectionList?.['contents'])) {
        candidateSections.push(...sectionList['contents']);
      }
    }

    for (const item of candidateSections) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const shelf = rec['musicShelfRenderer'] as Record<string, unknown> | undefined;
      const playlistShelf = rec['musicPlaylistShelfRenderer'] as Record<string, unknown> | undefined;
      const shelfList = shelf?.['contents'] ?? playlistShelf?.['contents'];
      if (Array.isArray(shelfList) && shelfList.length > 0) {
        return shelfList;
      }
    }
  } catch {
    // Ignore
  }
  return [];
}
