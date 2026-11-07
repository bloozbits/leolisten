const videoId = 'oRdxUFDoQe0';

const clientVariants = [
  { name: 'ANDROID_CREATOR', clientName: 'ANDROID_CREATOR', clientVersion: '23.01.100', userAgent: 'com.google.android.apps.youtube.creator/23.01.100' },
  { name: 'ANDROID_EMBEDDED_PLAYER', clientName: 'ANDROID_EMBEDDED_PLAYER', clientVersion: '19.09.37', userAgent: 'com.google.android.youtube/19.09.37' },
  { name: 'TVHTML5', clientName: 'TVHTML5', clientVersion: '7.20240318.01.00', userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebkit/537.36' },
  { name: 'MEDIA_CONNECT', clientName: 'MEDIA_CONNECT', clientVersion: '1.0', userAgent: 'MediaConnect/1.0' },
  { name: 'WEB_KIDS', clientName: 'WEB_KIDS', clientVersion: '1.20240318.01.00', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  { name: 'MWEB', clientName: 'MWEB', clientVersion: '2.20240318.01.00', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1' }
];

async function test() {
  for (const c of clientVariants) {
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': c.userAgent
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: c.clientName,
              clientVersion: c.clientVersion,
              hl: 'en',
              gl: 'US'
            }
          },
          videoId,
          playbackContext: {
            contentPlaybackContext: {
              html5Preference: 'HTML5_PREF_WANTS'
            }
          }
        })
      });
      const json = await res.json();
      console.log(`${c.name}: Status ${res.status}, Playability: ${json.playabilityStatus?.status}`);
      const formats = (json.streamingData?.adaptiveFormats || []).concat(json.streamingData?.formats || []);
      const audio = formats.filter(f => f.mimeType?.startsWith('audio/'));
      if (audio.length > 0) {
        console.log(`  Audio formats: ${audio.length}, has url: ${!!audio[0].url}, cipher: ${!!(audio[0].signatureCipher || audio[0].cipher)}`);
        if (audio[0].url) {
          const testGet = await fetch(audio[0].url, { headers: { 'Range': 'bytes=0-' } });
          console.log(`  bytes=0- status: ${testGet.status}`);
        }
      }
    } catch (e) {
      console.log(`${c.name} error: ${e.message}`);
    }
  }
}
test();

