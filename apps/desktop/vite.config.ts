import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'stream-download-proxy',
      configureServer(server) {
        server.middlewares.use('/yt-download-stream', async (req, res) => {
          try {
            const reqUrl = new URL(req.url || '', 'http://localhost');
            const targetUrl = reqUrl.searchParams.get('url');
            const filename = reqUrl.searchParams.get('filename') || 'audio.opus';
            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }
            const upstream = await fetch(targetUrl);
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/opus');
            res.setHeader(
              'Content-Disposition',
              `attachment; filename="${encodeURIComponent(filename)}"`
            );
            res.setHeader('Access-Control-Allow-Origin', '*');
            if (upstream.body) {
              const reader = upstream.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
              }
            }
            res.end();
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/yt-music-api': {
        target: 'https://music.youtube.com/youtubei/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/yt-music-api/, ''),
        headers: {
          'Origin': 'https://music.youtube.com',
          'Referer': 'https://music.youtube.com/',
        },
      },
      '/yt-watch-api': {
        target: 'https://www.youtube.com/youtubei/v1',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/yt-watch-api/, ''),
        headers: {
          'Origin': 'https://www.youtube.com',
          'Referer': 'https://www.youtube.com/',
        },
      },
    },
  },
  clearScreen: false,
});
