import React, { useState, useEffect } from 'react';
import { Play, Pause, Heart } from 'lucide-react';
import { TrackItem } from '../../types/music';
import { getLikedSongs } from '../../services/likedSongsService';
import { getListeningHistory, subscribeToHistory } from '../../services/sessionService';

interface QuickPicksGridProps {
  tracks?: TrackItem[];
  currentTrackId?: string;
  isPlaying?: boolean;
  onPlayTrack?: (track: TrackItem, collectionTracks?: TrackItem[]) => void;
  onTogglePlay?: () => void;
  onOpenPlaylist?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  isLoading?: boolean;
}

export const QuickPicksGrid: React.FC<QuickPicksGridProps> = ({
  tracks = [],
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  onTogglePlay,
  onOpenPlaylist,
  isLoading = false,
}) => {
  // Real-time listening history that updates whenever user plays a song
  const [historyTracks, setHistoryTracks] = useState<TrackItem[]>(getListeningHistory);

  useEffect(() => {
    return subscribeToHistory((history) => {
      setHistoryTracks([...history]);
    });
  }, []);

  // If loading skeleton state and no data
  if (isLoading && tracks.length === 0 && historyTracks.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8 select-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded bg-[#282828]/40 h-14 overflow-hidden animate-pulse"
          >
            <div className="w-14 h-14 bg-zinc-800 shrink-0" />
            <div className="flex-1 pr-3 space-y-1.5">
              <div className="w-3/4 h-3 bg-zinc-700 rounded" />
              <div className="w-1/2 h-2 bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Build 8 display items:
  // Tile 1: Always "Liked Songs"
  // Tiles 2-8: Dynamic tracks from user's listening history, padded with real YouTube Music feed
  const historySlots = historyTracks.slice(0, 7);
  const historyIds = new Set(historySlots.map((t) => t.id));
  const remainingNeeded = Math.max(0, 7 - historySlots.length);
  const fallbackSlots = tracks.filter((t) => !historyIds.has(t.id)).slice(0, remainingNeeded);
  const activeSongs = [...historySlots, ...fallbackSlots];

  const displayTracks: Array<{
    id: string;
    title: string;
    artist?: string;
    coverUrl?: string;
    isLikedTile?: boolean;
    trackData?: TrackItem;
  }> = [];

  // Tile 1: Liked Songs Collection
  displayTracks.push({
    id: 'liked-collection',
    title: 'Liked Songs',
    isLikedTile: true,
    trackData: activeSongs[0],
  });

  // Tiles 2-8: Dynamic songs based on user listening
  activeSongs.forEach((t) => {
    displayTracks.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      coverUrl: t.coverUrl,
      trackData: t,
    });
  });

  // Extract pure track list for playlist/queue continuation
  const allSongTracks = activeSongs;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8 select-none">
      {displayTracks.map((card) => {
        const isCurrent = Boolean(card.trackData && currentTrackId === card.trackData.id);
        const isCurrentPlaying = isCurrent && isPlaying;

        return (
          <div
            key={card.id}
            onClick={() => {
              if (card.isLikedTile) {
                onOpenPlaylist?.('liked_songs', 'Liked Songs', 'Your Collection');
              } else if (card.trackData) {
                if (isCurrent && onTogglePlay) {
                  onTogglePlay();
                } else {
                  onPlayTrack?.(card.trackData, allSongTracks);
                }
              }
            }}
            className="group flex items-center justify-between rounded-md bg-[#282828]/60 hover:bg-[#383838]/80 cursor-pointer overflow-hidden transition-colors relative h-14"
          >
            {/* Left Artwork or Liked Gradient */}
            <div className="flex items-center gap-3 min-w-0 flex-1 h-full">
              {card.isLikedTile ? (
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                  <Heart className="w-6 h-6 fill-current text-white" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-zinc-800 shrink-0 overflow-hidden shadow-md">
                  <img
                    src={card.coverUrl}
                    alt={card.title}
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
                </div>
              )}

              {/* Title & Artist */}
              <div className="flex flex-col min-w-0 flex-1 pr-2">
                <span className="font-bold text-sm text-white truncate leading-tight">
                  {card.title}
                </span>
                {card.artist && (
                  <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                    {card.artist}
                  </span>
                )}
              </div>
            </div>

            {/* Right: White Triangle Play/Pause on Hover only (Nothing on Liked Songs) */}
            {!card.isLikedTile && (
              <div className="pr-4 shrink-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrent && onTogglePlay) {
                      onTogglePlay();
                    } else if (card.trackData) {
                      onPlayTrack?.(card.trackData, allSongTracks);
                    }
                  }}
                  title={isCurrentPlaying ? 'Pause' : 'Play'}
                  className="p-1 text-white hover:scale-110 active:scale-95 transition-transform"
                >
                  {isCurrentPlaying ? (
                    <Pause className="w-5 h-5 fill-current text-white" />
                  ) : (
                    <Play className="w-5 h-5 fill-current text-white ml-0.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
