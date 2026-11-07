const videoId = 'oRdxUFDoQe0'; // Beat It

class UniversalHttpClientAdapter {
  async get(url, options) {
    const res = await fetch(url, { method: 'GET', headers: options?.headers });
    const data = (options?.responseType === 'text' ? await res.text() : await res.json());
    return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), data };
  }
  async post(url, body, options) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const data = (options?.responseType === 'text' ? await res.text() : await res.json());
    return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), data };
  }
}

async function test() {
  const http = new UniversalHttpClientAdapter();
  
  // 1. Probe watch page
  const probeUrl = `https://www.youtube.com/watch?v=${videoId}&bpctr=9999999999&has_verified=1`;
  const probeRes = await http.get(probeUrl, {
    responseType: 'text',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Cookie': 'PREF=hl=en&tz=UTC; SOCS=CAI'
    }
  });

  const visitorMatch = (typeof probeRes.data === 'string' ? probeRes.data.match(/"VISITOR_DATA":"([^"]+)"/) : null);
  const visitorData = visitorMatch ? visitorMatch[1] : '';
  console.log('Got visitor data:', visitorData.substring(0, 30));

  // 2. Call player with VISIONOS
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
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        hl: 'en',
        timeZone: 'UTC',
        utcOffsetMinutes: 0
      }
    },
    videoId,
    playbackContext: {
      contentPlaybackContext: {
        html5Preference: 'HTML5_PREF_WANTS',
        signatureTimestamp: 20760
      }
    },
    contentCheckOk: true,
    racyCheckOk: true
  };

  const visionHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'X-YouTube-Client-Name': '101',
    'X-YouTube-Client-Version': '1.02',
    'Origin': 'https://www.youtube.com',
    'X-Goog-Visitor-Id': visitorData,
    'Cookie': 'PREF=hl=en&tz=UTC; SOCS=CAI;'
  };

  const res = await http.post(visionUrl, visionBody, { headers: visionHeaders });
  console.log('Player status:', res.status, 'Playability:', res.data.playabilityStatus?.status);
  const formats = (res.data.streamingData?.adaptiveFormats || []).concat(res.data.streamingData?.formats || []);
  const audio = formats.filter(f => f.mimeType?.startsWith('audio/'));
  console.log('Audio formats count:', audio.length);
  const aac = audio.find(f => f.itag === 140);
  console.log('AAC 140 URL length:', aac?.url?.length);
  const testExo = await fetch(aac.url, { headers: { 'Range': 'bytes=0-' } });
  console.log('ExoPlayer test status (Range: bytes=0-):', testExo.status);
}
test().catch(console.error);
