import React, { useState, useEffect } from 'react';
import {
  X,
  MoreHorizontal,
  Share2,
  CheckCircle2,
  ListMusic,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { TrackItem, RealArtistDetails } from '../../types/music';
import { getRealArtist, extractAllArtists } from '../../services/innertubeService';

interface NowPlayingPanelProps {
  track: TrackItem;
  isLiked: boolean;
  onToggleLike: () => void;
  onClose: () => void;
  onOpenArtist?: (artistIdOrName: string, artistName?: string) => void;
  onOpenSong?: (track: TrackItem) => void;
}

export const NowPlayingPanel: React.FC<NowPlayingPanelProps> = ({
  track,
  isLiked,
  onToggleLike,
  onClose,
  onOpenArtist,
  onOpenSong,
}) => {
  const [artistsList, setArtistsList] = useState<RealArtistDetails[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  // Fetch real YouTube Music artist data for ALL performing/collaborating artists
  useEffect(() => {
    let isMounted = true;
    const extracted = extractAllArtists(track);

    if (extracted.length === 0) {
      setArtistsList([]);
      return;
    }

    setIsLoadingArtists(true);
    Promise.all(
      extracted.map(async (art) => {
        try {
          return await getRealArtist(art.id || art.name);
        } catch (err) {
          console.warn(`[NowPlayingPanel] Failed to fetch artist ${art.name}:`, err);
          return {
            id: art.id || art.name,
            name: art.name,
            avatarUrl: '',
            bannerUrl: '',
            subscribers: 'Artist',
            bio: undefined,
            topTracks: [],
            albums: [],
            singles: [],
          } as RealArtistDetails;
        }
      })
    )
      .then((results) => {
        if (isMounted) {
          setArtistsList(results);
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

  const extractedArtists = extractAllArtists(track);

  return (
    <aside className="w-[330px] xl:w-[370px] h-full bg-[#121212] rounded-lg overflow-y-auto no-scrollbar flex flex-col shrink-0 border border-zinc-800/40 select-none">
      {/* Panel Header */}
      <div className="h-14 px-4 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10 border-b border-zinc-800/30">
        <div
          onClick={() => onOpenSong?.(track)}
          className="flex items-center gap-2 text-zinc-300 font-semibold text-sm truncate hover:text-white cursor-pointer"
        >
          <ListMusic className="w-4 h-4 text-[#1ed760] shrink-0" />
          <span className="truncate">{track.album || 'Now Playing'}</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            title="More options"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close Now Playing View"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Clean Normal Album Artwork without animation, shadow, or plus overlay */}
        <div
          onClick={() => onOpenSong?.(track)}
          title={`View song details for ${track.title}`}
          className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800/40 cursor-pointer"
        >
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
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Title & Artist(s) & Quick Actions */}
        <div className="flex items-start justify-between gap-2 pt-1">
          <div className="flex flex-col min-w-0 flex-1">
            <h3
              onClick={() => onOpenSong?.(track)}
              title={track.title}
              className="text-2xl font-black text-white hover:underline cursor-pointer truncate"
            >
              {track.title}
            </h3>

            {/* List all collaborating artists who sing the song */}
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-zinc-400 mt-1">
              {extractedArtists.map((art, idx) => (
                <React.Fragment key={art.name + idx}>
                  <span
                    onClick={() => onOpenArtist?.(art.id || art.name, art.name)}
                    title={`View ${art.name}`}
                    className="hover:text-white hover:underline cursor-pointer truncate"
                  >
                    {art.name}
                  </span>
                  {idx < extractedArtists.length - 1 && (
                    <span className="text-zinc-600 font-bold">•</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              title="Share"
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleLike}
              title={isLiked ? 'Saved to Your Library' : 'Save to Your Library'}
              className="transition-transform active:scale-90"
            >
              {isLiked ? (
                <div className="w-6 h-6 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-5 h-5 fill-current text-[#121212]" />
                </div>
              ) : (
                <Plus className="w-5 h-5 text-zinc-400 hover:text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Real "About the Artist" Section - If two artists sing the song, both appear here! */}
        <div className="space-y-4 pt-2">
          {isLoadingArtists && artistsList.length === 0 ? (
            <div className="w-full rounded-xl overflow-hidden bg-[#242424] p-4 space-y-3 animate-pulse border border-zinc-800/40">
              <div className="h-40 w-full bg-zinc-800 rounded-lg" />
              <div className="h-4 w-1/3 bg-zinc-700 rounded" />
              <div className="h-3 w-1/4 bg-zinc-800 rounded" />
            </div>
          ) : (
            artistsList.map((artist, idx) => {
              const artistImage =
                artist.avatarUrl ||
                artist.bannerUrl ||
                (idx === 0 ? track.artistCoverUrl || track.coverUrl : '');

              const artistStats =
                artist.subscribers ||
                artist.views ||
                'Artist';

              // Filter out generic channel descriptions like "Official YouTube channel for Wegz."
              const hasRealBio =
                artist.bio &&
                artist.bio.trim().length > 15 &&
                !/official.*(?:channel|youtube)|youtube/i.test(artist.bio);

              return (
                <div
                  key={artist.id + idx}
                  onClick={() => onOpenArtist?.(artist.id, artist.name)}
                  className="w-full rounded-xl overflow-hidden bg-[#242424] shadow-md cursor-pointer group hover:bg-[#2a2a2a] transition-colors border border-zinc-800/40"
                >
                  {/* Real Artist Photo Banner */}
                  <div className="relative h-44 w-full bg-zinc-900 overflow-hidden">
                    {artistImage ? (
                      <img
                        src={artistImage}
                        alt={artist.name}
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
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 animate-pulse" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#242424] via-transparent to-black/30" />
                    <div className="absolute top-3 left-3 text-[11px] font-bold uppercase tracking-wider text-white/90 bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                      {artistsList.length > 1
                        ? `About the artist • ${artist.name}`
                        : 'About the artist'}
                    </div>
                    <div className="absolute top-3 right-3 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Real Artist Info */}
                  <div className="p-4 space-y-1.5">
                    <h4 className="text-base font-bold text-white group-hover:underline">
                      {artist.name}
                    </h4>

                    <p className="text-xs font-semibold text-[#1ed760]">
                      {artistStats}
                    </p>

                    {/* Only render biography if it's a genuine bio and not "Official YouTube channel..." */}
                    {hasRealBio && (
                      <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed pt-1">
                        {artist.bio}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
