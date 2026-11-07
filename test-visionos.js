const videoId = process.argv[2] || 'tdS3ijuqxW4'; // Default: Todo Lo Fue

async function test() {
  console.log('Testing videoId:', videoId);
  const watchUrl = 'https://www.youtube.com/watch?v=' + videoId + '&bpctr=9999999999&has_verified=1';
  const watchRes = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Cookie': 'PREF=hl=en&tz=UTC; SOCS=CAI'
    }
  });

  const html = await watchRes.text();
  const cookies = (watchRes.headers.getSetCookie ? watchRes.headers.getSetCookie() : []).map(c => c.split(';')[0]).join('; ');
  
  // Extract visitor data
  const visitorMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
  const visitorData = visitorMatch ? visitorMatch[1] : null;

  const body = {
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

  const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'X-YouTube-Client-Name': '101',
      'X-YouTube-Client-Version': '1.02',
      'X-Goog-Visitor-Id': visitorData || '',
      'Origin': 'https://www.youtube.com',
      'Cookie': cookies + '; PREF=hl=en&tz=UTC; SOCS=CAI;'
    },
    body: JSON.stringify(body)
  });

  const json = await playerRes.json();
  console.log('Player status:', playerRes.status, 'Playability:', json.playabilityStatus?.status);
  const formats = (json.streamingData?.adaptiveFormats || []).concat(json.streamingData?.formats || []);
  const audio = formats.filter(f => f.mimeType && f.mimeType.startsWith('audio/'));
  console.log('Audio count:', audio.length);
  const best = audio.find(f => f.itag === 140) || audio[0];
  if (best && best.url) {
    const getExo = await fetch(best.url, { headers: { 'Range': 'bytes=0-' } });
    console.log('  itag', best.itag, 'bytes=0- status:', getExo.status);
    const getNoRange = await fetch(best.url);
    console.log('  itag', best.itag, 'no range status:', getNoRange.status);
  }
}
test().catch(console.error);
