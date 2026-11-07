import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  Clock,
  MoreHorizontal,
  Download,
  ListPlus,
  Check,
  Loader2,
} from 'lucide-react';
import { TrackItem, RealArtistDetails } from '../types/music';
import { getRealArtist, getCachedArtist } from '../services/innertubeService';
import {
  toggleLikeSong,
  isSongLiked,
  subscribeToLikedSongs,
} from '../services/likedSongsService';
import {
  downloadTrack,
  removeDownloadedTrack,
  isTrackDownloading,
  isTrackDownloaded,
  subscribeToDownloads,
} from '../services/downloadService';

interface ArtistScreenProps {
  artistIdOrName: string;
  initialName?: string;
  initialCoverUrl?: string;
  currentTrackId?: string;
  isPlaying?: boolean;
  onPlayTrack?: (track: TrackItem, collectionTracks?: TrackItem[]) => void;
  onTogglePlay?: () => void;
  onOpenAlbum?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onOpenSong?: (track: TrackItem) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onBack?: () => void;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const ArtistScreen: React.FC<ArtistScreenProps> = ({
  artistIdOrName,
  initialName,
  initialCoverUrl,
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  onTogglePlay,
  onOpenAlbum,
  onOpenSong,
  onAddToQueue,
  onBack,
}) => {
  // Synchronous cache lookup: if in memory, load with 0ms delay!
  const cached = getCachedArtist(artistIdOrName);
  const [artist, setArtist] = useState<RealArtistDetails | null>(cached || null);
  const [isLoading, setIsLoading] = useState(!cached);
  const [hoveredTrackIndex, setHoveredTrackIndex] = useState<number | null>(null);
  const [, setSyncCounter] = useState(0);

  // Subscribe to liked songs and download status
  useEffect(() => {
    const unsubLikes = subscribeToLikedSongs(() => setSyncCounter((c) => c + 1));
    const unsubDownloads = subscribeToDownloads(() => setSyncCounter((c) => c + 1));
    return () => {
      unsubLikes();
      unsubDownloads();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadArtist() {
      try {
        if (!cached) {
          setIsLoading(true);
        }
        const data = await getRealArtist(artistIdOrName);
        if (isMounted) {
          setArtist(data);
        }
      } catch (err) {
        console.warn(`[ArtistScreen] Error loading artist ${artistIdOrName}:`, err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadArtist();
    return () => {
      isMounted = false;
    };
  }, [artistIdOrName]);

  const displayName = artist?.name || initialName || artistIdOrName;
  const bannerImage = artist?.bannerUrl || artist?.avatarUrl || initialCoverUrl || '';
  const topTracks = artist?.topTracks || [];
  const albums = artist?.albums || [];
  const singles = artist?.singles || [];

  const isCurrentArtistPlaying =
    topTracks.some((t) => t.id === currentTrackId) && isPlaying;

  const handlePlayArtist = () => {
    if (isCurrentArtistPlaying && onTogglePlay) {
      onTogglePlay();
    } else if (topTracks.length > 0 && onPlayTrack) {
      onPlayTrack(topTracks[0], topTracks);
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

      {/* Hero Header with Real Artist Photo Banner */}
      <div className="relative w-full h-72 sm:h-80 md:h-96 rounded-2xl overflow-hidden mb-6 shadow-2xl bg-zinc-900 border border-zinc-800/40">
        {bannerImage ? (
          <img
            src={bannerImage}
            alt={displayName}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true';
                if (target.src.includes('=w544-h544')) {
                  target.src = target.src.replace('=w544-h544-l90-rj', '=w226-h226-l90-rj');
                }
              }
            }}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
        )}

        {/* Gradient Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/50 to-transparent" />

        {/* Artist Header Text Content */}
        <div className="absolute bottom-6 left-6 right-6 flex flex-col items-start">
          <h1
            title={displayName}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight drop-shadow-lg mb-3"
          >
            {displayName}
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-300 font-semibold drop-shadow">
            {artist?.subscribers && (
              <span>{artist.subscribers}</span>
            )}
            {artist?.views && (
              <>
                <span>•</span>
                <span>{artist.views}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="flex items-center gap-4 sm:gap-6 mb-8 px-1">
        <button
          onClick={handlePlayArtist}
          disabled={topTracks.length === 0}
          title={isCurrentArtistPlaying ? 'Pause' : 'Play'}
          className="p-1 text-white hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-transform flex items-center justify-center"
        >
          {isCurrentArtistPlaying ? (
            <Pause className="w-8 h-8 fill-current text-white" />
          ) : (
            <Play className="w-8 h-8 fill-current text-white ml-0.5" />
          )}
        </button>

        <button
          title="More options"
          className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      {/* Section 1: Popular / Top Songs */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Popular</h2>

        {isLoading && topTracks.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-lg bg-[#242424]/40 animate-pulse flex items-center gap-4 px-4"
              >
                <div className="w-6 h-4 bg-zinc-800 rounded" />
                <div className="w-10 h-10 bg-zinc-800 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-3.5 bg-zinc-700 rounded" />
                  <div className="w-1/4 h-2.5 bg-zinc-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : topTracks.length > 0 ? (
          <div className="rounded-lg overflow-hidden bg-transparent">
            {topTracks.map((track, idx) => {
              const isCurrent = track.id === currentTrackId;
              const isTrackPlaying = isCurrent && isPlaying;
              const isHovered = hoveredTrackIndex === idx;
              const isLiked = isSongLiked(track.id);
              const isDownloading = isTrackDownloading(track.id);
              const isDownloaded = isTrackDownloaded(track.id);

              return (
                <div
                  key={track.id + idx}
                  onMouseEnter={() => setHoveredTrackIndex(idx)}
                  onMouseLeave={() => setHoveredTrackIndex(null)}
                  onClick={() => onPlayTrack?.(track, topTracks)}
                  className={`group flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors ${
                    isCurrent ? 'bg-[#242424]' : ''
                  }`}
                >
                  {/* Left: Index / Play Button + Cover + Title */}
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-5 text-center text-sm font-semibold shrink-0">
                      {isHovered ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isCurrent && onTogglePlay) onTogglePlay();
                            else onPlayTrack?.(track, topTracks);
                          }}
                          className="text-white hover:scale-110 transition-transform"
                        >
                          {isTrackPlaying ? (
                            <Pause className="w-4 h-4 fill-current text-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                          )}
                        </button>
                      ) : isTrackPlaying ? (
                        <div className="flex items-end justify-center gap-0.5 h-4">
                          <span className="w-0.5 h-full bg-[#1ed760] animate-pulse" />
                          <span className="w-0.5 h-2/3 bg-[#1ed760] animate-pulse delay-75" />
                          <span className="w-0.5 h-4/5 bg-[#1ed760] animate-pulse delay-150" />
                        </div>
                      ) : (
                        <span className={isCurrent ? 'text-[#1ed760]' : 'text-zinc-400'}>
                          {idx + 1}
                        </span>
                      )}
                    </div>

                    <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 shrink-0 shadow-sm relative">
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1 pr-2">
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
                      {track.explicit && (
                        <span className="inline-block w-max text-[9px] font-bold px-1 py-0.5 bg-zinc-700 text-zinc-300 rounded mt-0.5">
                          E
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Album Name */}
                  <div className="hidden md:block flex-1 text-xs text-zinc-400 truncate pr-4">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (track.albumId) {
                          onOpenAlbum?.(track.albumId, track.album, track.artist, track.coverUrl);
                        }
                      }}
                      className="hover:text-white hover:underline cursor-pointer"
                    >
                      {track.album}
                    </span>
                  </div>

                  {/* Right Actions: Like, Download, Queue, Duration */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeSong(track);
                      }}
                      title={isLiked ? 'Unlike' : 'Save to Liked Songs'}
                      className={`p-1.5 rounded transition-transform ${
                        isLiked
                          ? 'text-[#1ed760]'
                          : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${isLiked ? 'fill-current text-[#1ed760]' : ''}`}
                      />
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
                          : 'text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white'
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
                        className="p-1.5 text-zinc-500 rounded opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                    )}

                    <span className="text-xs font-mono text-zinc-400 tabular-nums w-10 text-right">
                      {formatDuration(track.durationSec)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No popular tracks found.</p>
        )}
      </section>

      {/* Section 2: Discography / Albums */}
      {albums.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Albums</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => onOpenAlbum?.(album.id, album.title, displayName, album.coverUrl)}
                className="w-44 shrink-0 group flex flex-col p-3 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden bg-zinc-800 shadow-md mb-2">
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 bottom-3 p-1 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-115 drop-shadow-xl">
                    <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                  </div>
                </div>
                <h3
                  title={album.title}
                  className="font-bold text-sm text-white truncate group-hover:underline"
                >
                  {album.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {album.year || 'Album'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Singles & EPs */}
      {singles.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">Singles and EPs</h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {singles.map((single) => (
              <div
                key={single.id}
                onClick={() => onOpenAlbum?.(single.id, single.title, displayName, single.coverUrl)}
                className="w-44 shrink-0 group flex flex-col p-3 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden bg-zinc-800 shadow-md mb-2">
                  <img
                    src={single.coverUrl}
                    alt={single.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute right-3 bottom-3 p-1 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-115 drop-shadow-xl">
                    <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                  </div>
                </div>
                <h3
                  title={single.title}
                  className="font-bold text-sm text-white truncate group-hover:underline"
                >
                  {single.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {single.year || 'Single'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Real "About" Section */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">About</h2>
        <div className="w-full rounded-2xl overflow-hidden bg-[#181818] border border-zinc-800/40 shadow-xl group">
          <div className="relative h-64 sm:h-80 w-full bg-zinc-900 overflow-hidden">
            {bannerImage && (
              <img
                src={bannerImage}
                alt={displayName}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/60 to-transparent" />

            <div className="absolute bottom-6 left-6 right-6">
              <div className="text-3xl font-black text-white mb-1">
                {artist?.subscribers || 'Artist'}
              </div>
              {artist?.views && (
                <div className="text-xs font-semibold uppercase tracking-wider text-[#1ed760]">
                  {artist.views}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-4xl whitespace-pre-line">
              {artist?.bio && !/official.*(?:channel|youtube)|youtube/i.test(artist.bio)
                ? artist.bio
                : `Listen to tracks, albums, and singles by ${displayName} on LeoListen.`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
