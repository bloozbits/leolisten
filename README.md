# Leolisten 

A high-performance, Spotify-inspired desktop music player powered by YouTube Music, built with React, Vite, Tailwind CSS, TypeScript, and Electron.

![Leolisten Banner](apps/desktop/public/app-logo.png)

## Features

- **Spotify-Grade UI/UX**: Dark theme (`#121212`), smooth animations, sleek typography, responsive panels.
- **YouTube Music Streaming**: Powered by InnerTube engine with zero ads, high-quality audio streams, and real-time watch queues.
- **Dynamic Quick Picks (2x4 Grid)**: Intelligent listening history that automatically updates your home dashboard with your favorite songs.
- **Real YouTube Music "Up Next"**: Algorithmic song queues populated directly from YouTube Music radio stations.
- **Offline Downloads & Caching**: Dual-layer offline caching supporting both web CacheStorage and local desktop disk storage.
- **Session Persistence**: Resumes playback precisely at the song and second where you left off.
- **Lyrics & Real Artist Profiles**: Integrated synchronized lyrics panel and rich multi-artist profiles with discographies and related artists.
- **Cross-Platform**: Native desktop packages for **Windows** (`.exe`), **macOS** (`.dmg`, `.zip`), and **Linux** (`.AppImage`, `.deb`).

---

## Tech Stack

- **Monorepo**: npm workspaces (`apps/desktop`, `packages/core`)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Desktop Runtime**: Electron 34, Electron Builder
- **CI/CD**: GitHub Actions cross-platform matrix build (Windows, macOS, Linux)

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/bloozbits/leolisten.git
cd leolisten
npm install
```

### Development

Run the desktop web app in development mode with hot reload:

```bash
npm run dev
# or
npm run desktop:dev
```

### Production Build

Build both core architecture and desktop bundles:

```bash
npm run build
```

---

## Packaging Desktop Binaries

Build platform-specific native executables:

```bash
# Windows (.exe installer + portable)
npm run desktop:pack:win

# macOS (.dmg + .zip)
npm run desktop:pack:mac

# Linux (.AppImage + .deb)
npm run desktop:pack:linux

# All platforms
npm run desktop:pack:all
```

The resulting binaries will be placed in `apps/desktop/release/`.

---

## Automated GitHub Actions CI/CD

Every push or pull request to `main` triggers a multi-platform matrix build on:
- **Windows** (`windows-latest`)
- **macOS** (`macos-latest`)
- **Linux** (`ubuntu-latest`)

Built binaries are automatically archived as downloadable artifacts on each run summary, and tagging a release (`v*.*.*`) automatically publishes the binaries to GitHub Releases.

---

## License

MIT © Leolisen Contributors
