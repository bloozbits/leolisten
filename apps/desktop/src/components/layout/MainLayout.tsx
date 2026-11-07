import React, { useState, useEffect, useRef } from 'react';
import { Titlebar } from './Titlebar';
import { Sidebar, NavRoute } from './Sidebar';
import { NowPlayingPanel } from './NowPlayingPanel';
import { DesktopPlayerBar } from '../player/DesktopPlayerBar';
import { QueuePanel } from '../player/QueuePanel';
import { RepeatState } from '../player/PlayerControls';
import { TrackItem } from '../../types/music';
import { CollectionScreen } from '../../screens/CollectionScreen';
import { ArtistScreen } from '../../screens/ArtistScreen';
import { SongScreen } from '../../screens/SongScreen';
import {
  getRealAudioStream,
  searchRealMusic,
  searchItemToTrack,
  getRealUpNextTracks,
  getCachedUpNextTracks,
} from '../../services/innertubeService';
import {
  isSongLiked,
  toggleLikeSong,
  subscribeToLikedSongs,
} from '../../services/likedSongsService';
import { getOfflineAudioUrl } from '../../services/downloadService';
import {
  recordTrackToHistory,
  savePlaybackSession,
  getSavedPlaybackSession,
  SavedPlaybackSession,
} from '../../services/sessionService';
import { X, Mic2, Play, Search } from 'lucide-react';

export interface CurrentView {
  type: 'home' | 'album' | 'playlist' | 'artist' | 'song';
  id?: string;
  title?: string;
  subtitle?: string;
  coverUrl?: string;
  trackData?: TrackItem;
}

interface MainLayoutProps {
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  // Navigation & Platform states
  const [activeRoute, setActiveRoute] = useState<NavRoute>('home');
  const [currentView, setCurrentView] = useState<CurrentView>({ type: 'home' });
  const [navHistory, setNavHistory] = useState<CurrentView[]>([]);
  const [platform, setPlatform] = useState<'mac' | 'windows'>('windows');

  // Search state & Real search results
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Retrieve saved playback session from previous run
  const savedSession = useRef(getSavedPlaybackSession()).current;

  // Audio Playback states - Restores user session so user resumes where they left off!
  const [currentTrack, setCurrentTrack] = useState<TrackItem | null>(() => savedSession?.track || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => savedSession?.currentTime || 0);
  const [duration, setDuration] = useState(() => savedSession?.duration || savedSession?.track?.durationSec || 0);
  const [isShuffle, setIsShuffle] = useState(() => savedSession?.isShuffle || false);
  const [repeatMode, setRepeatMode] = useState<RepeatState>(() => savedSession?.repeatMode || 'off');
  const [volume, setVolume] = useState(() => savedSession?.volume ?? 80);
  const [isMuted, setIsMuted] = useState(() => savedSession?.isMuted || false);
  const [isLiked, setIsLiked] = useState(() => Boolean(savedSession?.track && isSongLiked(savedSession.track.id)));

  // Queue & Next Up states
  const [queue, setQueue] = useState<TrackItem[]>(() => savedSession?.queue || []);
  const [upNextTracks, setUpNextTracks] = useState<TrackItem[]>(() => savedSession?.upNextTracks || []);

  // Panels & Overlays - Right sidebar opens if user had an active track
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(() => Boolean(savedSession?.track));
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);

  // Real HTML5 Audio Element for live streaming
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Persist playback session so user resumes seamlessly on next launch
  useEffect(() => {
    if (!currentTrack) return;
    const session: SavedPlaybackSession = {
      track: currentTrack,
      currentTime,
      duration,
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      queue,
      upNextTracks,
      savedAt: Date.now(),
    };
    savePlaybackSession(session);
  }, [currentTrack, currentTime, duration, volume, isMuted, repeatMode, isShuffle, queue, upNextTracks]);

  // Window beforeunload fallback to ensure final timestamp is saved
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentTrack) {
        savePlaybackSession({
          track: currentTrack,
          currentTime: audioRef.current?.currentTime ?? currentTime,
          duration: audioRef.current?.duration ?? duration,
          volume,
          isMuted,
          repeatMode,
          isShuffle,
          queue,
          upNextTracks,
          savedAt: Date.now(),
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentTrack, currentTime, duration, volume, isMuted, repeatMode, isShuffle, queue, upNextTracks]);

  // Synchronize volume with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  // If app launched with a restored track but empty Up Next, populate real queue from YouTube Music
  useEffect(() => {
    if (currentTrack && upNextTracks.length === 0) {
      getRealUpNextTracks(currentTrack.id)
        .then((next) => {
          if (next.length > 0) setUpNextTracks(next);
        })
        .catch(console.warn);
    }
  }, []);

  // Synchronize liked status with likedSongsService
  useEffect(() => {
    if (currentTrack) {
      setIsLiked(isSongLiked(currentTrack.id));
    }
    const unsub = subscribeToLikedSongs(() => {
      if (currentTrack) {
        setIsLiked(isSongLiked(currentTrack.id));
      }
    });
    return unsub;
  }, [currentTrack]);

  // Execute real search on YouTube Music when search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const rawItems = await searchRealMusic(searchQuery);
        const tracks = rawItems.map(searchItemToTrack);
        setSearchResults(tracks);
      } catch (err) {
        console.warn('[MainLayout] Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + 5));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - 5));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume((prev) => Math.min(100, prev + 5));
        setIsMuted(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume((prev) => Math.max(0, prev - 5));
      } else if (e.key.toLowerCase() === 'm') {
        setIsMuted((prev) => !prev);
      } else if (e.key.toLowerCase() === 'l') {
        handleToggleLike();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, currentTime, isPlaying, currentTrack]);

  // Navigation Stack Helpers - Zero Reloading on Back Navigation
  const navigateToView = (newView: CurrentView) => {
    setNavHistory((prev) => [...prev, currentView]);
    setCurrentView(newView);
    setSearchQuery('');
    setIsLyricsOpen(false);
    setIsQueueOpen(false);
  };

  const handleBack = () => {
    if (navHistory.length > 0) {
      const prevView = navHistory[navHistory.length - 1];
      setNavHistory((prev) => prev.slice(0, -1));
      setCurrentView(prevView);
    } else {
      setCurrentView({ type: 'home' });
    }
    setIsLyricsOpen(false);
    setIsQueueOpen(false);
    setSearchQuery('');
  };

  const handleOpenArtist = (artistIdOrName: string, artistName?: string, coverUrl?: string) => {
    navigateToView({
      type: 'artist',
      id: artistIdOrName,
      title: artistName || artistIdOrName,
      coverUrl,
    });
  };

  const handleOpenSong = (track: TrackItem) => {
    navigateToView({
      type: 'song',
      id: track.id,
      title: track.title,
      trackData: track,
    });
  };

  const handleOpenAlbum = (id: string, title?: string, subtitle?: string, coverUrl?: string) => {
    navigateToView({
      type: 'album',
      id,
      title,
      subtitle,
      coverUrl,
    });
  };

  const handleOpenPlaylist = (id: string, title?: string, subtitle?: string, coverUrl?: string) => {
    navigateToView({
      type: 'playlist',
      id,
      title,
      subtitle,
      coverUrl,
    });
  };

  // Queue Operations
  const handleAddToQueue = (track: TrackItem) => {
    setQueue((prev) => [...prev, track]);
  };

  const handleRemoveFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearQueue = () => {
    setQueue([]);
  };

  // Resume playback at a specific minute/second (used for restoring session where user left off)
  const resumeTrackAtTime = async (track: TrackItem, startTime: number) => {
    setIsPlaying(true);
    recordTrackToHistory(track);

    // If up next queue is empty, populate from YouTube Music
    if (upNextTracks.length === 0) {
      getRealUpNextTracks(track.id)
        .then((next) => {
          if (next.length > 0) setUpNextTracks(next);
        })
        .catch(console.warn);
    }

    try {
      const offlineUrl = await getOfflineAudioUrl(track.id);
      let streamUrl = offlineUrl;
      if (!streamUrl) {
        const stream = await getRealAudioStream(track.id);
        streamUrl = stream?.streamUrl || null;
      }

      if (streamUrl && audioRef.current) {
        audioRef.current.src = streamUrl;
        const applySeek = () => {
          if (audioRef.current && startTime > 0) {
            audioRef.current.currentTime = Math.min(startTime, audioRef.current.duration || startTime);
          }
        };
        audioRef.current.addEventListener('loadedmetadata', applySeek, { once: true });
        await audioRef.current.play().catch((e) => {
          console.warn('[Audio] Autoplay blocked, user interaction required:', e);
        });
      }
    } catch (err) {
      console.warn('[Audio] Failed to resume track:', track.title, err);
    }
  };

  // Play a track with real unthrottled audio stream from YouTube Music
  const handlePlayTrack = async (track: TrackItem, collectionTracks?: TrackItem[]) => {
    recordTrackToHistory(track);
    setCurrentTrack(track);
    setIsNowPlayingOpen(true);
    setCurrentTime(0);
    setDuration(track.durationSec || 180);
    setIsPlaying(true);
    setIsLiked(isSongLiked(track.id));

    // 1. Initial collection tracks if available
    let collectionNext: TrackItem[] = [];
    if (collectionTracks && collectionTracks.length > 0) {
      const idx = collectionTracks.findIndex((t) => t.id === track.id);
      if (idx >= 0 && idx < collectionTracks.length - 1) {
        collectionNext = collectionTracks.slice(idx + 1);
      }
    }

    if (collectionNext.length > 0) {
      setUpNextTracks(collectionNext);
    } else {
      // Synchronously check cache for 0ms delay
      const cached = getCachedUpNextTracks(track.id);
      if (cached && cached.length > 0) {
        setUpNextTracks(cached);
      }
    }

    // 2. Query YouTube Music's real Up Next / Queue algorithm recommendations (v1/next)
    getRealUpNextTracks(track.id)
      .then((realNext) => {
        if (realNext.length > 0) {
          if (collectionNext.length > 0) {
            const existingIds = new Set(collectionNext.map((t) => t.id));
            existingIds.add(track.id);
            const fresh = realNext.filter((t) => !existingIds.has(t.id));
            setUpNextTracks([...collectionNext, ...fresh]);
          } else {
            setUpNextTracks(realNext);
          }
        }
      })
      .catch((err) => {
        console.warn('[MainLayout] Error fetching watch-next tracks:', err);
      });

    try {
      // 1. Instant zero-bandwidth playback if the song is downloaded locally
      const offlineUrl = await getOfflineAudioUrl(track.id);
      if (offlineUrl && audioRef.current) {
        audioRef.current.src = offlineUrl;
        await audioRef.current.play().catch((e) => {
          console.warn('[Audio] Autoplay blocked, user interaction required:', e);
        });
        return;
      }

      // 2. Stream online audio stream from YouTube Music
      const stream = await getRealAudioStream(track.id);
      if (stream && stream.streamUrl && audioRef.current) {
        audioRef.current.src = stream.streamUrl;
        if (stream.durationSec) {
          setDuration(stream.durationSec);
        }
        await audioRef.current.play().catch((e) => {
          console.warn('[Audio] Autoplay blocked, user interaction required:', e);
        });
      }
    } catch (err) {
      console.warn('[Audio] Failed to stream audio for track:', track.title, err);
    }
  };

  const handleTogglePlay = async () => {
    if (!currentTrack) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      return;
    }

    // If audio element does not yet have an active source (resuming restored session on launch)
    if (!audioRef.current?.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
      await resumeTrackAtTime(currentTrack, currentTime);
      return;
    }

    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch((e) => {
        console.warn('[Audio] Play failed, attempting stream reload:', e);
        resumeTrackAtTime(currentTrack, currentTime);
      });
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current) {
      if (!audioRef.current.src || audioRef.current.src === '' || audioRef.current.src === window.location.href) {
        if (currentTrack) {
          resumeTrackAtTime(currentTrack, newTime);
        }
      } else {
        audioRef.current.currentTime = newTime;
      }
    }
  };

  const handleNext = () => {
    // 1. Play next song from user queue if any
    if (queue.length > 0) {
      const nextTrack = queue[0];
      setQueue((prev) => prev.slice(1));
      handlePlayTrack(nextTrack);
      return;
    }

    // 2. Play next song from album / playlist up-next list
    if (upNextTracks.length > 0) {
      const nextTrack = upNextTracks[0];
      setUpNextTracks((prev) => prev.slice(1));
      handlePlayTrack(nextTrack);
      return;
    }

    // 3. Loop or rewind
    handleSeek(0);
  };

  const handlePrev = () => {
    handleSeek(0);
  };

  const handleToggleRepeat = () => {
    const nextMode: Record<RepeatState, RepeatState> = {
      off: 'all',
      all: 'one',
      one: 'off',
    };
    setRepeatMode(nextMode[repeatMode]);
  };

  const handleToggleLike = (track?: TrackItem) => {
    const target = track || currentTrack;
    if (target) {
      const nextStatus = toggleLikeSong(target);
      if (!track || track.id === currentTrack?.id) {
        setIsLiked(nextStatus);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden font-sans select-none">
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration) {
            setDuration(audioRef.current.duration);
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (repeatMode === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play();
            }
          } else if (repeatMode === 'all') {
            handleNext();
          } else {
            if (queue.length > 0 || upNextTracks.length > 0) {
              handleNext();
            } else {
              setIsPlaying(false);
              handleSeek(0);
            }
          }
        }}
        onError={(e) => {
          console.warn('[Audio] Stream playback error:', e);
        }}
      />

      {/* 1. Top Frameless Header & Real Search Bar */}
      <Titlebar
        platform={platform}
        onPlatformToggle={() =>
          setPlatform((p) => (p === 'windows' ? 'mac' : 'windows'))
        }
        onHomeClick={() => {
          setActiveRoute('home');
          navigateToView({ type: 'home' });
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 2. Middle Three-Column Desktop Grid */}
      <div className="flex-1 flex gap-2 px-2 pb-2 overflow-hidden min-h-0">
        {/* Left Column: Libraries Rail (w-[72px]) */}
        <Sidebar
          activeRoute={activeRoute}
          onRouteChange={(route) => {
            setActiveRoute(route);
            if (isLyricsOpen) setIsLyricsOpen(false);
            if (isQueueOpen) setIsQueueOpen(false);
            if (route === 'home') {
              navigateToView({ type: 'home' });
            } else if (route === 'library' || route === 'downloads') {
              navigateToView({
                type: 'playlist',
                id: 'downloaded_songs',
                title: 'Downloads',
                subtitle: 'Your Offline Collection',
              });
            } else if (route === 'liked') {
              navigateToView({
                type: 'playlist',
                id: 'liked_songs',
                title: 'Liked Songs',
                subtitle: 'Your Collection',
              });
            }
          }}
          onCreatePlaylist={() => alert('Create playlist modal')}
        />

        {/* Center Column: Big Rectangle in the Middle + Aligned Rounded Player Bar */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 h-full">
          {/* Main Scrollable Content Card */}
          <main className="flex-1 bg-[#121212] rounded-lg overflow-y-auto no-scrollbar p-6 relative border border-zinc-800/40 min-h-0">
            {/* Real Search Results View if Searching */}
            {isQueueOpen ? (
              <QueuePanel
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                queue={queue}
                upNextTracks={upNextTracks}
                onPlayTrack={handlePlayTrack}
                onRemoveFromQueue={handleRemoveFromQueue}
                onClearQueue={handleClearQueue}
                onClose={() => setIsQueueOpen(false)}
                onOpenSong={handleOpenSong}
                onOpenArtist={handleOpenArtist}
              />
            ) : searchQuery ? (
              <div className="pb-16 select-none">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-[#1ed760]" />
                    <h2 className="text-xl font-bold text-white">
                      Search results for "{searchQuery}"
                    </h2>
                  </div>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-[#b3b3b3] hover:text-white"
                  >
                    Clear search
                  </button>
                </div>

                {isSearching ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 rounded-lg bg-[#242424]/40 animate-pulse flex items-center gap-3 p-2"
                      >
                        <div className="w-12 h-12 bg-zinc-800 rounded" />
                        <div className="flex-1 space-y-2">
                          <div className="w-1/3 h-3.5 bg-zinc-700 rounded" />
                          <div className="w-1/4 h-2.5 bg-zinc-800 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((item, idx) => (
                      <div
                        key={item.id + idx}
                        onClick={() => {
                          if (item.id.startsWith('UC') || item.artist === 'Artist') {
                            handleOpenArtist(item.id, item.title, item.coverUrl);
                          } else if (item.id.startsWith('MPREb_')) {
                            handleOpenAlbum(item.id, item.title, item.artist, item.coverUrl);
                          } else if (
                            item.id.startsWith('VL') ||
                            item.id.startsWith('PL') ||
                            item.id.startsWith('RD')
                          ) {
                            handleOpenPlaylist(item.id, item.title, item.artist, item.coverUrl);
                          } else {
                            handlePlayTrack(item);
                          }
                        }}
                        className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-11 h-11 overflow-hidden bg-zinc-800 shrink-0 shadow-sm relative ${
                            item.id.startsWith('UC') || item.artist === 'Artist' ? 'rounded-full' : 'rounded'
                          }`}>
                            <img
                              src={item.coverUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (!target.dataset.triedFallback) {
                                  target.dataset.triedFallback = 'true';
                                  if (target.src.includes('=w544-h544')) {
                                    target.src = target.src.replace('=w544-h544-l90-rj', '=w120-h120-l90-rj');
                                  } else if (target.src.includes('hq720.jpg')) {
                                    target.src = target.src.replace('hq720.jpg', 'hqdefault.jpg');
                                  }
                                }
                              }}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                              {item.title}
                            </span>
                            <span className="text-xs text-[#b3b3b3] truncate">
                              {item.artist} {item.album ? `• ${item.album}` : ''}
                            </span>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-zinc-500 tabular-nums">
                          {Math.floor(item.durationSec / 60)}:
                          {Math.floor(item.durationSec % 60)
                            .toString()
                            .padStart(2, '0')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20 text-zinc-500 text-sm">
                    No results found for "{searchQuery}" on YouTube Music.
                  </div>
                )}
              </div>
            ) : isLyricsOpen ? (
              /* Lyrics View */
              <div className="max-w-2xl mx-auto py-12 text-center select-none">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-zinc-400 font-semibold text-sm">
                    <Mic2 className="w-5 h-5 text-[#1ed760]" />
                    <span>Lyrics {currentTrack ? `• ${currentTrack.title}` : ''}</span>
                  </div>
                  <button
                    onClick={() => setIsLyricsOpen(false)}
                    className="p-1 rounded-full text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="py-20 text-center">
                  <Mic2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                  <p className="text-xl font-bold text-white mb-2">
                    {currentTrack ? currentTrack.title : 'No Song Playing'}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {currentTrack
                      ? 'Lyrics are loading or not available for this track.'
                      : 'Play a song to view its lyrics.'}
                  </p>
                </div>
              </div>
            ) : currentView.type === 'artist' && currentView.id ? (
              <ArtistScreen
                artistIdOrName={currentView.id}
                initialName={currentView.title}
                initialCoverUrl={currentView.coverUrl}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onOpenAlbum={handleOpenAlbum}
                onOpenSong={handleOpenSong}
                onAddToQueue={handleAddToQueue}
                onBack={handleBack}
              />
            ) : currentView.type === 'song' && currentView.trackData ? (
              <SongScreen
                track={currentView.trackData}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                isLiked={isLiked}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onToggleLike={() => handleToggleLike(currentView.trackData)}
                onOpenArtist={handleOpenArtist}
                onOpenAlbum={handleOpenAlbum}
                onAddToQueue={handleAddToQueue}
                onBack={handleBack}
              />
            ) : currentView.type === 'album' && currentView.id ? (
              <CollectionScreen
                type="album"
                id={currentView.id}
                initialTitle={currentView.title}
                initialSubtitle={currentView.subtitle}
                initialCoverUrl={currentView.coverUrl}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onOpenArtist={handleOpenArtist}
                onOpenSong={handleOpenSong}
                onAddToQueue={handleAddToQueue}
                onBack={handleBack}
              />
            ) : currentView.type === 'playlist' && currentView.id ? (
              <CollectionScreen
                type="playlist"
                id={currentView.id}
                initialTitle={currentView.title}
                initialSubtitle={currentView.subtitle}
                initialCoverUrl={currentView.coverUrl}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                onPlayTrack={handlePlayTrack}
                onTogglePlay={handleTogglePlay}
                onOpenArtist={handleOpenArtist}
                onOpenSong={handleOpenSong}
                onAddToQueue={handleAddToQueue}
                onBack={handleBack}
              />
            ) : (
              /* Standard Screen View (e.g. HomeScreen with real YouTube Music feed) */
              React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                  return React.cloneElement(child as React.ReactElement<any>, {
                    currentTrackId: currentTrack?.id,
                    isPlaying,
                    onPlayTrack: handlePlayTrack,
                    onTogglePlay: handleTogglePlay,
                    onOpenAlbum: handleOpenAlbum,
                    onOpenPlaylist: handleOpenPlaylist,
                    onOpenArtist: handleOpenArtist,
                    onOpenSong: handleOpenSong,
                  });
                }
                return child;
              })
            )}
          </main>

          {/* Rounded Player Bar Aligned Perfectly to the Big Rectangle in the Middle */}
          <DesktopPlayerBar
            track={currentTrack}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onPrev={handlePrev}
            onNext={handleNext}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            isShuffle={isShuffle}
            onToggleShuffle={() => setIsShuffle((prev) => !prev)}
            repeatMode={repeatMode}
            onToggleRepeat={handleToggleRepeat}
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={(v) => {
              setVolume(v);
              setIsMuted(false);
            }}
            onToggleMute={() => setIsMuted((prev) => !prev)}
            isLiked={isLiked}
            onToggleLike={() => handleToggleLike(currentTrack || undefined)}
            isLyricsOpen={isLyricsOpen}
            onToggleLyrics={() => {
              setIsLyricsOpen((prev) => !prev);
              if (!isLyricsOpen) setIsQueueOpen(false);
            }}
            isQueueOpen={isQueueOpen}
            onToggleQueue={() => {
              setIsQueueOpen((prev) => !prev);
              if (!isQueueOpen) setIsLyricsOpen(false);
            }}
            onOpenSong={handleOpenSong}
            onOpenArtist={handleOpenArtist}
          />
        </div>

        {/* Right Column: "The Music Which On" Panel (NowPlayingPanel) - Only shown when a track is active */}
        {isNowPlayingOpen && currentTrack && (
          <NowPlayingPanel
            track={currentTrack}
            isLiked={isLiked}
            onToggleLike={() => handleToggleLike(currentTrack || undefined)}
            onClose={() => setIsNowPlayingOpen(false)}
            onOpenArtist={handleOpenArtist}
            onOpenSong={handleOpenSong}
          />
        )}
      </div>
    </div>
  );
};
