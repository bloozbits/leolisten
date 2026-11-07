import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Heart,
  Share2,
  MoreHorizontal,
  Clock,
  Radio,
  Sparkles,
  Download,
  ListPlus,
  Check,
  Loader2,
} from 'lucide-react';
import { TrackItem, RealArtistDetails } from '../types/music';
import { getRealArtist, extractAllArtists, getCachedArtist } from '../services/innertubeService';
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

interface SongScreenProps {
  track: TrackItem;
  currentTrackId?: string;
  isPlaying?: boolean;
  isLiked?: boolean;
  onPlayTrack?: (track: TrackItem) => void;
  onTogglePlay?: () => void;
  onToggleLike?: () => void;
  onOpenArtist?: (artistIdOrName: string, artistName?: string) => void;
  onOpenAlbum?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onAddToQueue?: (track: TrackItem) => void;
  onBack?: () => void;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const SongScreen: React.FC<SongScreenProps> = ({
  track,
  currentTrackId,
  isPlaying = false,
  isLiked = false,
  onPlayTrack,
  onTogglePlay,
  onToggleLike,
  onOpenArtist,
  onOpenAlbum,
  onAddToQueue,
  onBack,
}) => {
  const extractedArtists = extractAllArtists(track);
  const [artistsList, setArtistsList] = useState<RealArtistDetails[]>(() => {
    return extractedArtists
      .map((a) => getCachedArtist(a.id || a.name))
      .filter((a): a is RealArtistDetails => Boolean(a));
  });
  const [isLoadingArtists, setIsLoadingArtists] = useState(() => artistsList.length === 0);
  const [, setSyncCounter] = useState(0);

  const isCurrentSong = track.id === currentTrackId;
  const isSongPlaying = isCurrentSong && isPlaying;
  const songIsLiked = isLiked || isSongLiked(track.id);

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
    if (extractedArtists.length === 0) return;

    if (artistsList.length === 0) {
      setIsLoadingArtists(true);
    }

    Promise.all(
      extractedArtists.map(async (art) => {
        try {
          return await getRealArtist(art.id || art.name);
        } catch (err) {
          console.warn(`[SongScreen] Failed to fetch artist details for ${art.name}:`, err);
          return {
            id: art.id || art.name,
            name: art.name,
            avatarUrl: '',
            bannerUrl: '',
            subscribers: 'Artist',
            bio: `Official artist on YouTube Music. Listen to music by ${art.name} on LeoListen.`,
            topTracks: [],
            albums: [],
            singles: [],
          } as RealArtistDetails;
        }
      })
    )
      .then((data) => {
        if (isMounted) {
          setArtistsList(data);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingArtists(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [track.id, track.artist, track.title]);

  const handlePlaySong = () => {
    if (isCurrentSong && onTogglePlay) {
      onTogglePlay();
    } else if (onPlayTrack) {
      onPlayTrack(track);
    }
  };

  const primaryArtist = artistsList[0];
  const moreTracks = (primaryArtist?.topTracks || []).filter((t) => t.id !== track.id).slice(0, 5);

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

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 pt-2">
        {/* Large Album Artwork */}
        <div className="w-48 h-48 sm:w-56 sm:h-56 shrink-0 rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl border border-zinc-800/80 relative group">
          <img
            src={track.coverUrl}
            alt={track.title}
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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>

        {/* Track Metadata */}
        <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 flex-1">
          <span className="text-xs uppercase font-extrabold tracking-widest text-[#1ed760] mb-1">
            Song
          </span>

          <h1
            title={track.title}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2 mb-3"
          >
            {track.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-sm text-[#b3b3b3] font-medium">
            {/* Artists List with clickable links */}
            <div className="flex flex-wrap items-center gap-1.5">
              {extractedArtists.map((art, idx) => (
                <div
                  key={art.name + idx}
                  onClick={() => onOpenArtist?.(art.id || art.name, art.name)}
                  className="flex items-center gap-1.5 text-white font-bold hover:underline cursor-pointer"
                >
                  <span>{art.name}</span>
                  {idx < extractedArtists.length - 1 && (
                    <span className="text-zinc-600 font-bold">•</span>
                  )}
                </div>
              ))}
            </div>

            <span>•</span>

            {/* Album Link */}
            <span
              onClick={() => {
                if (track.albumId) {
                  onOpenAlbum?.(track.albumId, track.album, track.artist, track.coverUrl);
                }
              }}
              className="hover:text-white hover:underline cursor-pointer"
            >
              {track.album || 'Single'}
            </span>

            <span>•</span>

            <span>{formatDuration(track.durationSec)}</span>

            {track.explicit && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded">
                E
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-5 mb-8">
        <button
          onClick={handlePlaySong}
          title={isSongPlaying ? 'Pause' : 'Play'}
          className="p-1 text-white hover:scale-110 active:scale-95 transition-transform flex items-center justify-center"
        >
          {isSongPlaying ? (
            <Pause className="w-8 h-8 fill-current text-white" />
          ) : (
            <Play className="w-8 h-8 fill-current text-white ml-0.5" />
          )}
        </button>

        {/* Like Song Button */}
        <button
          onClick={() => {
            if (onToggleLike) {
              onToggleLike();
            } else {
              toggleLikeSong(track);
            }
          }}
          title={songIsLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          className={`p-2 transition-transform hover:scale-110 ${
            songIsLiked ? 'text-[#1ed760]' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Heart className={`w-8 h-8 ${songIsLiked ? 'fill-current text-[#1ed760]' : ''}`} />
        </button>

        {/* Download Song Button */}
        <button
          onClick={() => {
            if (isTrackDownloaded(track.id)) {
              removeDownloadedTrack(track.id);
            } else {
              downloadTrack(track);
            }
          }}
          disabled={isTrackDownloading(track.id)}
          title={
            isTrackDownloaded(track.id)
              ? 'Downloaded (click to remove)'
              : isTrackDownloading(track.id)
              ? 'Downloading...'
              : 'Download audio'
          }
          className="p-2 transition-transform hover:scale-110 text-zinc-400 hover:text-white"
        >
          {isTrackDownloading(track.id) ? (
            <Loader2 className="w-7 h-7 text-[#1ed760] animate-spin" />
          ) : isTrackDownloaded(track.id) ? (
            <Check className="w-7 h-7 text-[#1ed760]" />
          ) : (
            <Download className="w-7 h-7" />
          )}
        </button>

        {/* Add to Queue Button */}
        <button
          onClick={() => onAddToQueue?.(track)}
          title="Add to queue"
          className="p-2 text-zinc-400 hover:text-white transition-transform hover:scale-110"
        >
          <ListPlus className="w-7 h-7" />
        </button>

        <button
          title="Share"
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <Share2 className="w-6 h-6" />
        </button>

        <button
          title="More options"
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          <MoreHorizontal className="w-6 h-6" />
        </button>
      </div>

      {/* Audio Visualizer & Studio Stream Card */}
      <div className="w-full rounded-2xl bg-[#181818] border border-zinc-800/40 p-5 mb-10 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Radio className="w-4 h-4 text-[#1ed760]" />
            <span>Audio Playback Stream</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1ed760]/10 border border-[#1ed760]/30 text-[#1ed760] text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>48kHz Opus High-Fidelity</span>
          </div>
        </div>

        {/* Dynamic Visualizer Equalizer Waves */}
        <div className="h-16 flex items-end justify-between gap-1 px-2 pt-2 bg-zinc-950/50 rounded-xl overflow-hidden border border-zinc-800/30">
          {Array.from({ length: 36 }).map((_, i) => {
            return (
              <div
                key={i}
                style={{
                  height: isSongPlaying ? `${20 + (Math.sin(i * 0.7) + 1) * 35}%` : '8%',
                  animationDuration: `${0.6 + (i % 5) * 0.15}s`,
                }}
                className={`w-full rounded-t-sm transition-all duration-300 ${
                  isSongPlaying
                    ? 'bg-gradient-to-t from-[#1ed760]/40 to-[#1ed760] animate-pulse'
                    : 'bg-zinc-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* More by Artist */}
      {moreTracks.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              More by {track.artist}
            </h2>
            <button
              onClick={() =>
                onOpenArtist?.(primaryArtist?.id || track.artistId || track.artist, track.artist)
              }
              className="text-xs font-bold text-zinc-400 hover:text-white hover:underline"
            >
              See all
            </button>
          </div>

          <div className="space-y-1">
            {moreTracks.map((item, idx) => {
              const isItemPlaying = item.id === currentTrackId && isPlaying;
              return (
                <div
                  key={item.id + idx}
                  onClick={() => onPlayTrack?.(item)}
                  className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 shrink-0 relative">
                      <img
                        src={item.coverUrl}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className={`text-sm font-semibold truncate ${
                        isItemPlaying ? 'text-[#1ed760]' : 'text-white'
                      }`}>
                        {item.title}
                      </span>
                      <span className="text-xs text-zinc-400 truncate">
                        {item.album}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Like track */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeSong(item);
                      }}
                      title={isSongLiked(item.id) ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                      className={`p-1.5 transition-transform hover:scale-110 ${
                        isSongLiked(item.id)
                          ? 'text-[#1ed760] opacity-100'
                          : 'text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isSongLiked(item.id) ? 'fill-current text-[#1ed760]' : ''}`} />
                    </button>

                    {/* Download track */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTrackDownloaded(item.id)) {
                          removeDownloadedTrack(item.id);
                        } else {
                          downloadTrack(item);
                        }
                      }}
                      disabled={isTrackDownloading(item.id)}
                      title={
                        isTrackDownloaded(item.id)
                          ? 'Downloaded (click to remove)'
                          : isTrackDownloading(item.id)
                          ? 'Downloading...'
                          : 'Download audio'
                      }
                      className="p-1.5 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {isTrackDownloading(item.id) ? (
                        <Loader2 className="w-4 h-4 text-[#1ed760] animate-spin" />
                      ) : isTrackDownloaded(item.id) ? (
                        <Check className="w-4 h-4 text-[#1ed760]" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>

                    {/* Add to queue */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToQueue?.(item);
                      }}
                      title="Add to queue"
                      className="p-1.5 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-mono text-zinc-500 tabular-nums w-12 text-right">
                      {formatDuration(item.durationSec)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* About the Artist(s) - Supports multiple artists */}
      <section className="mb-6 space-y-4">
        <h2 className="text-xl font-bold text-white mb-2">
          {artistsList.length > 1 ? 'About the Artists' : 'About the Artist'}
        </h2>

        {artistsList.map((artist, idx) => {
          const artistAvatar =
            artist.avatarUrl ||
            artist.bannerUrl ||
            (idx === 0 ? track.artistCoverUrl || track.coverUrl : '');

          return (
            <div
              key={artist.id + idx}
              onClick={() => onOpenArtist?.(artist.id, artist.name)}
              className="w-full rounded-2xl overflow-hidden bg-[#181818] border border-zinc-800/40 p-6 flex flex-col md:flex-row items-center gap-6 hover:bg-[#222222] transition-colors cursor-pointer group"
            >
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden bg-zinc-900 shrink-0 shadow-xl border border-zinc-800 relative">
                {artistAvatar ? (
                  <img
                    src={artistAvatar}
                    alt={artist.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 animate-pulse" />
                )}
              </div>

              <div className="flex flex-col items-center md:items-start text-center md:text-left min-w-0 flex-1">
                <h3 className="text-2xl font-black text-white group-hover:underline mb-1">
                  {artist.name}
                </h3>

                <p className="text-xs font-semibold text-zinc-400 mb-3">
                  {artist.subscribers || 'Artist'}
                </p>

                {artist.bio && !/official.*(?:channel|youtube)|youtube/i.test(artist.bio) && (
                  <p className="text-xs sm:text-sm text-zinc-300 line-clamp-3 leading-relaxed mb-4">
                    {artist.bio}
                  </p>
                )}

                <button className="px-4 py-1.5 rounded-full border border-zinc-600 group-hover:border-white text-xs font-bold text-white transition-colors">
                  View Artist Profile
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};
