const videoId = 'oRdxUFDoQe0'; // Michael Jackson Beat It

const clients = [
  {
    name: 'ANDROID',
    clientName: 'ANDROID',
    clientVersion: '19.09.37',
    androidSdkVersion: 30,
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
  },
  {
    name: 'ANDROID_TESTSUITE',
    clientName: 'ANDROID_TESTSUITE',
    clientVersion: '1.9',
    userAgent: 'Dalvik/2.1.0 (Linux; U; Android 11)'
  },
  {
    name: 'IOS',
    clientName: 'IOS',
    clientVersion: '19.09.3',
    deviceMake: 'Apple',
    deviceModel: 'iPhone14,3',
    osName: 'iPhone',
    osVersion: '17.4.1.21E236',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 17_4_1 like Mac OS X; en_US)'
  },
  {
    name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
    clientVersion: '2.0',
    userAgent: 'Mozilla/5.0 (PlayStation; PlayStation 4/11.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15'
  },
  {
    name: 'WEB_REMIX',
    clientName: 'WEB_REMIX',
    clientVersion: '1.20240318.01.00',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  },
  {
    name: 'WEB',
    clientName: 'WEB',
    clientVersion: '2.20240318.01.00',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
];

async function runTests() {
  for (const c of clients) {
    console.log(`\n=================== Testing ${c.name} ===================`);
    try {
      const body = {
        context: {
          client: {
            clientName: c.clientName,
            clientVersion: c.clientVersion,
            hl: 'en',
            gl: 'US',
            deviceMake: c.deviceMake,
            deviceModel: c.deviceModel,
            osName: c.osName,
            osVersion: c.osVersion,
            androidSdkVersion: c.androidSdkVersion,
            userAgent: c.userAgent
          }
        },
        videoId,
        playbackContext: {
          contentPlaybackContext: {
            html5Preference: 'HTML5_PREF_WANTS',
            signatureTimestamp: 20759
          }
        },
        contentCheckOk: true,
        racyCheckOk: true
      };

      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': c.userAgent
        },
        body: JSON.stringify(body)
      });

      const json = await res.json();
      const status = json.playabilityStatus?.status;
      console.log(`Playability: ${status}`);
      if (status !== 'OK') {
        console.log(`Reason: ${json.playabilityStatus?.reason}`);
        continue;
      }

      const streamingData = json.streamingData;
      if (!streamingData) {
        console.log('No streamingData');
        continue;
      }

      const formats = (streamingData.adaptiveFormats || []).concat(streamingData.formats || []);
      const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/'));
      console.log(`Audio formats found: ${audioFormats.length}`);
      
      for (const f of audioFormats.slice(0, 2)) {
        console.log(`itag: ${f.itag}, mime: ${f.mimeType}`);
        if (f.url) {
          // Test with ExoPlayer default header (no range, and bytes=0-)
          const getNoRange = await fetch(f.url);
          console.log(`- GET (no range): ${getNoRange.status}`);
          const getExo = await fetch(f.url, { headers: { 'Range': 'bytes=0-' } });
          console.log(`- GET (Range bytes=0-): ${getExo.status}`);
        } else if (f.signatureCipher || f.cipher) {
          console.log(`- Ciphered (requires decipher)`);
        }
      }
    } catch (e) {
      console.error(`Error on ${c.name}:`, e.message);
    }
  }
}

runTests();

