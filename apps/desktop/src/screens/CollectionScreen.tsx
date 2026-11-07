import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  Clock,
  MoreHorizontal,
  Music,
  Download,
  ListPlus,
  Check,
  Loader2,
} from 'lucide-react';
import { TrackItem } from '../types/music';
import {
  getRealAlbum,
  getRealPlaylist,
  getCachedAlbum,
  getCachedPlaylist,
} from '../services/innertubeService';
import {
  getLikedSongs,
  toggleLikeSong,
  isSongLiked,
  subscribeToLikedSongs,
} from '../services/likedSongsService';
import {
  downloadTrack,
  isTrackDownloading,
  isTrackDownloaded,
  subscribeToDownloads,
  getDownloadedTracks,
  removeDownloadedTrack,
} from '../services/downloadService';

interface CollectionScreenProps {
  type: 'album' | 'playlist';
  id: string;
  initialTitle?: string;
  initialSubtitle?: string;
  initialCoverUrl?: string;
  currentTrackId?: string;
  isPlaying?: boolean;
  onPlayTrack?: (track: TrackItem, collectionTracks?: TrackItem[]) => void;
  onTogglePlay?: () => void;
  onBack?: () => void;
  onOpenArtist?: (artistIdOrName: string, artistName?: string) => void;
  onOpenSong?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const CollectionScreen: React.FC<CollectionScreenProps> = ({
  type,
  id,
  initialTitle,
  initialSubtitle,
  initialCoverUrl,
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  onTogglePlay,
  onBack,
  onOpenArtist,
  onOpenSong,
  onAddToQueue,
}) => {
  const isLikedSongs = id === 'liked_songs';
  const isDownloads = id === 'downloaded_songs' || id === 'downloads';

  // Synchronous cache checks: If cached, load with 0ms delay, 0 loading state!
  const cachedAlbum = type === 'album' ? getCachedAlbum(id) : undefined;
  const cachedPlaylist = type === 'playlist' ? getCachedPlaylist(id) : undefined;
  const initialLiked = isLikedSongs ? getLikedSongs() : [];
  const initialDownloads = isDownloads ? getDownloadedTracks() : [];

  const [title, setTitle] = useState(() => {
    if (isLikedSongs) return 'Liked Songs';
    if (isDownloads) return 'Downloads';
    return cachedAlbum?.title || cachedPlaylist?.title || initialTitle || 'Loading...';
  });

  const [subtitle, setSubtitle] = useState(() => {
    if (isLikedSongs) return 'Your Collection';
    if (isDownloads) return 'Your Offline Collection';
    return cachedAlbum?.artists || cachedPlaylist?.author || initialSubtitle || '';
  });

  const [coverUrl, setCoverUrl] = useState(() => {
    if (isLikedSongs || isDownloads) return '';
    return cachedAlbum?.coverUrl || cachedPlaylist?.coverUrl || initialCoverUrl || '';
  });

  const [year, setYear] = useState<string | undefined>(() => cachedAlbum?.year);

  const [tracks, setTracks] = useState<TrackItem[]>(() => {
    if (isLikedSongs) return initialLiked;
    if (isDownloads) return initialDownloads;
    return cachedAlbum?.tracks || cachedPlaylist?.tracks || [];
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (isLikedSongs || isDownloads) return false;
    return type === 'album' ? !cachedAlbum : !cachedPlaylist;
  });

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [, setDownloadCounter] = useState(0);

  // Subscribe to Liked Songs changes
  useEffect(() => {
    if (isLikedSongs) {
      setTracks(getLikedSongs());
      const unsub = subscribeToLikedSongs((list) => {
        setTracks([...list]);
      });
      return unsub;
    }
  }, [id, isLikedSongs]);

  // Subscribe to download status & downloads library events
  useEffect(() => {
    if (isDownloads) {
      setTracks(getDownloadedTracks());
    }
    return subscribeToDownloads(() => {
      setDownloadCounter((c) => c + 1);
      if (isDownloads) {
        setTracks(getDownloadedTracks());
      }
    });
  }, [id, isDownloads]);

  // Fetch real data (instant if cached)
  useEffect(() => {
    if (isLikedSongs || isDownloads) return;

    let isMounted = true;

    async function loadCollection() {
      try {
        if (!cachedAlbum && !cachedPlaylist) {
          setIsLoading(true);
        }

        if (type === 'album') {
          const album = await getRealAlbum(id);
          if (isMounted) {
            setTitle(album.title);
            setSubtitle(album.artists);
            if (album.coverUrl) setCoverUrl(album.coverUrl);
            setYear(album.year);
            setTracks(album.tracks);
          }
        } else {
          const playlist = await getRealPlaylist(id);
          if (isMounted) {
            setTitle(playlist.title);
            setSubtitle(playlist.author);
            if (playlist.coverUrl) setCoverUrl(playlist.coverUrl);
            setTracks(playlist.tracks);
          }
        }
      } catch (err) {
        console.warn(`[CollectionScreen] Error loading ${type} ${id}:`, err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCollection();
    return () => {
      isMounted = false;
    };
  }, [id, type, isLikedSongs, isDownloads]);

  // Is any track from this collection currently active?
  const isCollectionActive = tracks.some((t) => t.id === currentTrackId);
  const isCollectionPlaying = isCollectionActive && isPlaying;

  const handlePlayCollection = () => {
    if (isCollectionActive && onTogglePlay) {
      onTogglePlay();
    } else if (tracks.length > 0 && onPlayTrack) {
      onPlayTrack(tracks[0], tracks);
    }
  };

  return (
    <div className="pb-16 select-none animate-fadeIn">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between mb-4 pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181818] hover:bg-[#282828] text-zinc-300 hover:text-white text-xs font-bold transition-all shadow-md group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back</span>
        </button>
      </div>

      {/* Hero Header Section */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 pt-2">
        {/* Artwork */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 shrink-0 rounded-lg overflow-hidden bg-zinc-900 shadow-2xl border border-zinc-800/60 relative group">
          {isLikedSongs ? (
            <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-purple-700 to-emerald-800 flex items-center justify-center shadow-inner">
              <Heart className="w-20 h-20 text-white fill-current drop-shadow-lg" />
            </div>
          ) : isDownloads ? (
            <div className="w-full h-full bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 flex items-center justify-center shadow-inner">
              <Download className="w-20 h-20 text-white drop-shadow-lg stroke-[2.5]" />
            </div>
          ) : coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true';
                  if (target.src.includes('=w544-h544')) {
                    target.src = target.src.replace('=w544-h544-l90-rj', '=w226-h226-l90-rj');
                  } else if (target.src.includes('hq720.jpg')) {
                    target.src = target.src.replace('hq720.jpg', 'hqdefault.jpg');
                  }
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
              <Music className="w-16 h-16 text-zinc-600" />
            </div>
          )}
        </div>

        {/* Collection Meta */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 flex-1">
          <span className="text-xs uppercase font-extrabold tracking-widest text-[#1ed760] mb-1">
            {isLikedSongs ? 'Playlist' : isDownloads ? 'Library' : type}
          </span>

          <h1
            title={title}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-3"
          >
            {title}
          </h1>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-xs text-[#b3b3b3] font-medium">
            <span
              onClick={() => {
                if (!isLikedSongs && !isDownloads) {
                  onOpenArtist?.(subtitle, subtitle);
                }
              }}
              className={`font-bold ${isLikedSongs ? 'text-white' : 'text-white hover:underline cursor-pointer'}`}
            >
              {subtitle}
            </span>
            {year && (
              <>
                <span>•</span>
                <span>{year}</span>
              </>
            )}
            {tracks.length > 0 && (
              <>
                <span>•</span>
                <span>{tracks.length} {tracks.length === 1 ? 'song' : 'songs'}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-6 mb-6">
        <button
          onClick={handlePlayCollection}
          disabled={tracks.length === 0}
          title={isCollectionPlaying ? 'Pause' : 'Play'}
          className="p-1 text-white hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-transform flex items-center justify-center"
        >
          {isCollectionPlaying ? (
            <Pause className="w-8 h-8 fill-current text-white" />
          ) : (
            <Play className="w-8 h-8 fill-current text-white ml-0.5" />
          )}
        </button>

        <button
          title="More options"
          className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      {/* Skeletons while loading tracklist (only if not cached) */}
      {isLoading && tracks.length === 0 ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded bg-[#181818]/60 animate-pulse flex items-center gap-4 px-4"
            >
              <div className="w-4 h-4 bg-zinc-800 rounded shrink-0" />
              <div className="w-10 h-10 bg-zinc-800 rounded shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-1/3 h-3 bg-zinc-700 rounded" />
                <div className="w-1/4 h-2 bg-zinc-800 rounded" />
              </div>
              <div className="w-10 h-3 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : tracks.length > 0 ? (
        /* Tracklist Table */
        <div className="w-full">
          {/* Table Header */}
          <div className="grid grid-cols-[36px_1fr_120px_60px] md:grid-cols-[36px_1fr_1fr_120px_60px] gap-3 px-4 py-2 border-b border-zinc-800/80 text-xs font-bold text-[#b3b3b3] uppercase tracking-wider mb-2">
            <span className="text-center">#</span>
            <span>Title</span>
            <span className="hidden md:block">{type === 'album' ? 'Artist' : 'Album'}</span>
            <span className="text-right pr-2">Actions</span>
            <span className="flex justify-end pr-2">
              <Clock className="w-4 h-4" />
            </span>
          </div>

          {/* Table Rows */}
          <div className="space-y-0.5">
            {tracks.map((track, idx) => {
              const isCurrent = currentTrackId === track.id;
              const isCurrentPlaying = isCurrent && isPlaying;
              const isHovered = hoveredIndex === idx;
              const isLiked = isSongLiked(track.id);
              const isDownloading = isTrackDownloading(track.id);
              const isDownloaded = isTrackDownloaded(track.id);

              return (
                <div
                  key={track.id + idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    if (isCurrent && onTogglePlay) {
                      onTogglePlay();
                    } else {
                      onPlayTrack?.(track, tracks);
                    }
                  }}
                  className={`grid grid-cols-[36px_1fr_120px_60px] md:grid-cols-[36px_1fr_1fr_120px_60px] gap-3 px-4 py-2.5 rounded-md cursor-pointer transition-colors group items-center ${
                    isCurrent
                      ? 'bg-white/10 text-[#1ed760]'
                      : 'hover:bg-white/5 text-zinc-300'
                  }`}
                >
                  {/* Track Number / Play Indicator */}
                  <div className="flex items-center justify-center text-xs font-semibold">
                    {isCurrentPlaying ? (
                      <div className="flex items-end gap-0.5 h-3">
                        <span className="w-0.5 bg-[#1ed760] animate-[bounce_1s_infinite_100ms] h-full" />
                        <span className="w-0.5 bg-[#1ed760] animate-[bounce_1s_infinite_300ms] h-2/3" />
                        <span className="w-0.5 bg-[#1ed760] animate-[bounce_1s_infinite_200ms] h-4/5" />
                      </div>
                    ) : isHovered ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCurrent && onTogglePlay) {
                            onTogglePlay();
                          } else {
                            onPlayTrack?.(track, tracks);
                          }
                        }}
                        className="text-white hover:scale-110 transition-transform"
                      >
                        <Play className="w-4 h-4 fill-current text-white" />
                      </button>
                    ) : (
                      <span className={isCurrent ? 'text-[#1ed760]' : 'text-zinc-500'}>
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {(type === 'playlist' || isLikedSongs) && track.coverUrl && (
                      <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 shrink-0 shadow-sm">
                        <img
                          src={track.coverUrl}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSong?.(track);
                        }}
                        className={`text-sm font-semibold truncate hover:underline ${
                          isCurrent ? 'text-[#1ed760]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenArtist?.(track.artistId || track.artist, track.artist);
                        }}
                        className="text-xs text-[#b3b3b3] hover:text-white hover:underline truncate mt-0.5"
                      >
                        {track.artist}
                      </span>
                    </div>
                  </div>

                  {/* Album / Artist (medium screens) */}
                  <div className="hidden md:block truncate text-xs text-[#b3b3b3]">
                    {type === 'album' ? track.artist : track.album}
                  </div>

                  {/* Quick Action Buttons (Like, Download, Add to Queue) */}
                  <div className="flex items-center justify-end gap-1 text-zinc-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeSong(track);
                      }}
                      title={isLiked ? 'Unlike' : 'Save to Liked Songs'}
                      className={`p-1.5 rounded transition-transform ${
                        isLiked
                          ? 'text-[#1ed760]'
                          : 'opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDownloaded) {
                          removeDownloadedTrack(track.id);
                        } else {
                          downloadTrack(track);
                        }
                      }}
                      disabled={isDownloading}
                      title={
                        isDownloaded
                          ? 'Downloaded (click to remove)'
                          : isDownloading
                          ? 'Downloading...'
                          : 'Download song'
                      }
                      className={`p-1.5 rounded transition-colors ${
                        isDownloaded
                          ? 'text-[#1ed760]'
                          : 'opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
                      ) : isDownloaded ? (
                        <Check className="w-4 h-4 text-[#1ed760]" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>

                    {onAddToQueue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(track);
                        }}
                        title="Add to queue"
                        className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center justify-end text-xs text-[#b3b3b3] pr-2 font-mono">
                    {formatDuration(track.durationSec || 180)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-20 text-center text-zinc-500">
          {isDownloads ? (
            <>
              <Download className="w-12 h-12 mx-auto mb-3 opacity-30 text-teal-400" />
              <p className="text-base font-semibold text-zinc-300">No downloaded songs yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Click the download button on any song to save it to your Downloads library.
              </p>
            </>
          ) : isLikedSongs ? (
            <>
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-400" />
              <p className="text-base font-semibold text-zinc-300">No liked songs yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Tap the heart on any song to save it here.
              </p>
            </>
          ) : (
            <>
              <Music className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No tracks found in this {type}.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
