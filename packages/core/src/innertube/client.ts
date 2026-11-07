import type { IHttpClientAdapter, HttpResponse } from '../types/ports.js';

/**
 * Innertube client configuration.
 */
export interface InnertubeClientConfig {
  readonly httpClient: IHttpClientAdapter;
  readonly gl?: string; // Country code (e.g. 'US')
  readonly hl?: string; // Language (e.g. 'en')
  readonly visitorData?: string;
  readonly cookie?: string;
  readonly clientVersion?: string;
}

/**
 * YouTube Music Innertube API Client.
 *
 * Communicates directly with YouTube Music's internal endpoints client-side
 * without requiring any intermediary servers or proxy backends.
 */
export class InnertubeClient {
  private readonly baseUrl = 'https://music.youtube.com/youtubei/v1';
  private readonly httpClient: IHttpClientAdapter;
  private readonly gl: string;
  private readonly hl: string;
  private readonly visitorData?: string;
  private readonly cookie?: string;
  private readonly clientVersion: string;

  private cachedVisitorData?: string;

  public constructor(config: InnertubeClientConfig) {
    this.httpClient = config.httpClient;
    this.gl = config.gl ?? 'US';
    this.hl = config.hl ?? 'en';
    this.visitorData = config.visitorData;
    this.cachedVisitorData = config.visitorData;
    this.cookie = config.cookie;
    this.clientVersion = config.clientVersion ?? '1.20240318.01.00';
  }

  /**
   * Retrieves or fetches origin visitorData token required for unthrottled streaming.
   * If a videoId is provided, probes the watch page to obtain the exact matching token & session.
   */
  public async getVisitorData(videoId?: string): Promise<{ visitorData: string; cookies?: string }> {
    if (this.cachedVisitorData && !videoId) {
      return { visitorData: this.cachedVisitorData };
    }

    try {
      const probeUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`
        : 'https://www.youtube.com';

      const res = await this.httpClient.get<string>(probeUrl, {
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Cookie': 'PREF=hl=en&tz=UTC; SOCS=CAI',
        },
      });

      let cookies = '';
      if (res.headers) {
        const rawCookies = res.headers['set-cookie'] ?? res.headers['Set-Cookie'];
        if (Array.isArray(rawCookies)) {
          cookies = rawCookies.map((c: string) => c.split(';')[0]).join('; ');
        } else if (typeof rawCookies === 'string') {
          cookies = rawCookies.split(';')[0] ?? '';
        }
      }

      if (typeof res.data === 'string') {
        const match =
          res.data.match(/"VISITOR_DATA":"([^"]+)"/) ??
          res.data.match(/"visitorData":"([^"]+)"/);

        if (match && match[1]) {
          this.cachedVisitorData = match[1];
          return { visitorData: this.cachedVisitorData, cookies };
        }
      }
    } catch {
      // Fallback to static origin token if network probe fails
    }

    this.cachedVisitorData =
      'CgtseXU3RXBaUDQtYyj_7LLXBjIKCgJFRxIEGgAgZ2KqAgqnAkN0b0JDQVVTakFFQkRCNlBEUEcyNGZDbVpJMFUxR2JLa3ZrWVdfcGpva3NFZFdwdHVWbUtpU0lsMWQyR1lZYzM2cnJTTnA3cVB5aFZncFF2Rk1SaWxFSzBsYzZmYnliM3ZEaVZjRGY0RGE4VkpWWUpLelFuYjJwVmxkMFIwY2MxUmxwa1U3UWZHMnRpcExCZHUzNS1kZmlQSExhbTZseldvOVI3NHVOd1JqeFVnUzJTNDdKUHplSHhVLTE0WTI0enpEc2FHU2dGTWtVQkhGajFhdGVXYkk5b2RYMWtFZHhjUXo2aEhOZmZsWHNJLWRZVDN0VWROLTRiWmY5eFRzM1BHeXc3TGZ1X0MxMUc4UDRzR2ZZTEZGR1Q3Um1zbmtrSXlHOU1PUVk%3D';
    return { visitorData: this.cachedVisitorData };
  }

  /**
   * Generates standard YouTube Music Web client context payload.
   */
  private buildContext(): Record<string, unknown> {
    const client: Record<string, unknown> = {
      clientName: 'WEB_REMIX',
      clientVersion: this.clientVersion,
      hl: this.hl,
      gl: this.gl,
      utcOffsetMinutes: 0,
    };

    if (this.visitorData) {
      client['visitorData'] = this.visitorData;
    }

    return {
      client,
      user: {
        lockedSafetyMode: false,
      },
    };
  }

  /**
   * Builds request headers for Innertube requests.
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Origin': 'https://music.youtube.com',
      'Referer': 'https://music.youtube.com/',
      'X-YouTube-Client-Name': '67', // WEB_REMIX
      'X-YouTube-Client-Version': this.clientVersion,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    };

    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    return headers;
  }

  /**
   * Internal POST helper to execute Innertube API calls.
   */
  private async postEndpoint<TResponse>(
    endpoint: string,
    payload: Record<string, unknown>,
    params?: Record<string, string>,
  ): Promise<HttpResponse<TResponse>> {
    const url = `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;
    const body = {
      context: this.buildContext(),
      ...payload,
    };

    return this.httpClient.post<TResponse>(url, body, {
      headers: this.buildHeaders(),
      params,
    });
  }

  /**
   * Searches YouTube Music for tracks, albums, artists, or playlists.
   */
  public async search(
    query: string,
    paramsFilter?: string,
  ): Promise<HttpResponse<Record<string, unknown>>> {
    const payload: Record<string, unknown> = {
      query,
    };
    if (paramsFilter) {
      payload['params'] = paramsFilter;
    }
    return this.postEndpoint<Record<string, unknown>>('search', payload);
  }

  /**
   * Fetches search autocompletion suggestions.
   */
  public async getSearchSuggestions(
    input: string,
  ): Promise<HttpResponse<Record<string, unknown>>> {
    const payload = {
      input,
    };
    return this.postEndpoint<Record<string, unknown>>('music/get_search_suggestions', payload);
  }

  /**
   * Generic browse caller for albums, artists, playlists, or tabs.
   */
  public async browse(
    browseId: string,
    params?: string,
  ): Promise<HttpResponse<Record<string, unknown>>> {
    let targetBrowseId = browseId;
    if (
      targetBrowseId.startsWith('PL') ||
      targetBrowseId.startsWith('OLAK') ||
      targetBrowseId.startsWith('RD')
    ) {
      targetBrowseId = `VL${targetBrowseId}`;
    }
    const payload: Record<string, unknown> = {
      browseId: targetBrowseId,
    };
    if (params) {
      payload['params'] = params;
    }
    return this.postEndpoint<Record<string, unknown>>('browse', payload);
  }

  /**
   * Fetches the YouTube Music Home Feed (explore, recommendations).
   */
  public async getHomeFeed(): Promise<HttpResponse<Record<string, unknown>>> {
    return this.browse('FEmusic_home');
  }

  /**
   * Fetches YouTube Music Charts.
   */
  public async getCharts(): Promise<HttpResponse<Record<string, unknown>>> {
    return this.browse('FEmusic_charts');
  }

  /**
   * Fetches Queue, Next Up, and Radio recommendation items.
   */
  public async next(params: {
    videoId?: string;
    playlistId?: string;
    playlistSetVideoId?: string;
    continuation?: string;
  }): Promise<HttpResponse<Record<string, unknown>>> {
    const payload: Record<string, unknown> = {
      enablePersistentPlaylistPanel: true,
      isAudioOnly: true,
    };

    if (params.videoId) payload['videoId'] = params.videoId;
    if (params.playlistId) payload['playlistId'] = params.playlistId;
    if (params.playlistSetVideoId) payload['playlistSetVideoId'] = params.playlistSetVideoId;
    if (params.continuation) payload['continuation'] = params.continuation;

    return this.postEndpoint<Record<string, unknown>>('next', payload);
  }

  /**
   * Fetches streaming formats, playback status, and metadata for a video.
   * Utilizes VISIONOS and modern client contexts to obtain direct, unthrottled audio streams
   * supporting full byte-range streaming without 403 blocks or 1MB caps.
   */
  public async player(
    videoId: string,
    playlistId?: string,
  ): Promise<HttpResponse<Record<string, unknown>>> {
    const { visitorData, cookies } = await this.getVisitorData(videoId);

    // Strategy 1: VISIONOS client (supports full open-ended Range bytes=0- & unthrottled streaming)
    try {
      const visionUrl = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
      const visionBody = {
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.02',
            deviceMake: 'Apple',
            deviceModel: 'RealityDevice17,1',
            osName: 'visionOS',
            osVersion: '26.5.23O471',
            userAgent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
            hl: this.hl,
            timeZone: 'UTC',
            utcOffsetMinutes: 0,
          },
        },
        videoId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS',
            signatureTimestamp: 20760,
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      };

      const visionHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'X-YouTube-Client-Name': '101',
        'X-YouTube-Client-Version': '1.02',
        'Origin': 'https://www.youtube.com',
        'X-Goog-Visitor-Id': visitorData,
      };

      if (cookies) {
        visionHeaders['Cookie'] = `${cookies}; PREF=hl=en&tz=UTC; SOCS=CAI;`;
      } else {
        visionHeaders['Cookie'] = 'PREF=hl=en&tz=UTC; SOCS=CAI;';
      }

      const visionResponse = await this.httpClient.post<Record<string, unknown>>(
        visionUrl,
        visionBody,
        { headers: visionHeaders },
      );

      const playability = visionResponse.data['playabilityStatus'] as
        | Record<string, unknown>
        | undefined;
      const streaming = visionResponse.data['streamingData'] as
        | Record<string, unknown>
        | undefined;

      if (playability?.['status'] === 'OK' && streaming) {
        return visionResponse;
      }
    } catch {
      // Fall through to Strategy 2 (ANDROID_VR)
    }

    // Strategy 2: ANDROID_VR client fallback
    try {
      const vrUrl = 'https://www.youtube.com/youtubei/v1/player';
      const vrBody = {
        context: {
          client: {
            clientName: 'ANDROID_VR',
            clientVersion: '1.65.10',
            deviceMake: 'Oculus',
            deviceModel: 'Quest 3',
            androidSdkVersion: 32,
            userAgent:
              'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
            osName: 'Android',
            osVersion: '12L',
            hl: this.hl,
            gl: this.gl,
            timeZone: 'UTC',
            utcOffsetMinutes: 0,
          },
        },
        videoId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS',
            signatureTimestamp: 20759,
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      };

      const vrHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent':
          'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
        'X-YouTube-Client-Name': '28',
        'X-YouTube-Client-Version': '1.65.10',
        'X-Goog-Visitor-Id': visitorData,
        'Origin': 'https://www.youtube.com',
      };

      const vrResponse = await this.httpClient.post<Record<string, unknown>>(vrUrl, vrBody, {
        headers: vrHeaders,
      });

      const playability = vrResponse.data['playabilityStatus'] as Record<string, unknown> | undefined;
      const streaming = vrResponse.data['streamingData'] as Record<string, unknown> | undefined;

      if (playability?.['status'] === 'OK' && streaming) {
        return vrResponse;
      }
    } catch {
      // Fall through to WEB_REMIX strategy
    }

    // Strategy 3: Fallback to WEB_REMIX
    const payload: Record<string, unknown> = {
      videoId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS',
          signatureTimestamp: Math.floor(Date.now() / 1000) - 86400,
        },
      },
    };

    if (playlistId) {
      payload['playlistId'] = playlistId;
    }

    return this.postEndpoint<Record<string, unknown>>('player', payload);
  }
}
