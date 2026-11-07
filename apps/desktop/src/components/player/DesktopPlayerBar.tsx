import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Plus,
  Mic2,
  ListMusic,
  Download,
  Loader2,
  Check,
} from 'lucide-react';
import { TrackItem } from '../../types/music';
import { PlayerControls, RepeatState } from './PlayerControls';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import {
  downloadTrack,
  removeDownloadedTrack,
  isTrackDownloading,
  isTrackDownloaded,
  subscribeToDownloads,
} from '../../services/downloadService';

interface DesktopPlayerBarProps {
  track: TrackItem | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatState;
  onToggleRepeat: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
  isLyricsOpen: boolean;
  onToggleLyrics: () => void;
  isQueueOpen: boolean;
  onToggleQueue: () => void;
  onOpenSong?: (track: TrackItem) => void;
  onOpenArtist?: (artistIdOrName: string, artistName?: string) => void;
}

export const DesktopPlayerBar: React.FC<DesktopPlayerBarProps> = ({
  track,
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  currentTime,
  duration,
  onSeek,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  isLiked,
  onToggleLike,
  isLyricsOpen,
  onToggleLyrics,
  isQueueOpen,
  onToggleQueue,
  onOpenSong,
  onOpenArtist,
}) => {
  const [, setDownloadCounter] = useState(0);

  useEffect(() => {
    return subscribeToDownloads(() => {
      setDownloadCounter((c) => c + 1);
    });
  }, []);

  const isDownloading = track ? isTrackDownloading(track.id) : false;
  const isDownloaded = track ? isTrackDownloaded(track.id) : false;

  const handleDownload = () => {
    if (track) {
      if (isDownloaded) {
        removeDownloadedTrack(track.id);
      } else {
        downloadTrack(track);
      }
    }
  };

  return (
    <footer className="h-[76px] w-full bg-[#121212] hover:bg-[#141414] transition-colors rounded-lg border border-zinc-800/50 px-4 py-2 flex items-center justify-between select-none shrink-0 shadow-xl">
      {/* LEFT SECTION: Artwork with Hover Plus, Title, Artist & Save (+) / Checkmark */}
      <div className="flex items-center gap-3 w-1/4 min-w-[180px] max-w-[260px]">
        {track ? (
          <>
            {/* Artwork with Hover Plus to add to Liked Songs */}
            <div
              onClick={onToggleLike}
              title={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              className="relative w-12 h-12 rounded overflow-hidden bg-zinc-900 shrink-0 shadow-md group/art cursor-pointer"
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
                      target.src = target.src.replace('=w544-h544-l90-rj', '=w120-h120-l90-rj');
                    } else if (target.src.includes('hq720.jpg')) {
                      target.src = target.src.replace('hq720.jpg', 'hqdefault.jpg');
                    }
                  }
                }}
                className="w-full h-full object-cover transition-transform duration-300 group-hover/art:scale-110"
              />

              {/* Plus Icon Overlay on Hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/art:opacity-100 transition-opacity flex items-center justify-center">
                {isLiked ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1ed760] fill-current text-black" />
                ) : (
                  <Plus className="w-6 h-6 text-white stroke-[2.5] hover:scale-110 transition-transform" />
                )}
              </div>
            </div>

            {/* Title & Artist */}
            <div className="flex flex-col min-w-0 flex-1">
              <span
                onClick={() => onOpenSong?.(track)}
                title={track.title}
                className="text-sm font-semibold text-white hover:underline cursor-pointer truncate"
              >
                {track.title}
              </span>
              <span
                onClick={() =>
                  onOpenArtist?.(track.artistId || track.artist, track.artist)
                }
                title={track.artist}
                className="text-xs text-[#b3b3b3] hover:text-white hover:underline cursor-pointer truncate mt-0.5"
              >
                {track.artist}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-zinc-800/40 shrink-0" />
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <div className="w-24 h-3 bg-zinc-800/40 rounded" />
              <div className="w-16 h-2 bg-zinc-800/25 rounded" />
            </div>
          </div>
        )}
      </div>

      {/* CENTER SECTION: Audio Controls & Progress Bar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-xl px-4">
        <PlayerControls
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onPrev={onPrev}
          onNext={onNext}
          isShuffle={isShuffle}
          onToggleShuffle={onToggleShuffle}
          repeatMode={repeatMode}
          onToggleRepeat={onToggleRepeat}
        />
        <div className="w-full">
          <ProgressBar
            currentTime={currentTime}
            duration={duration}
            onSeek={onSeek}
          />
        </div>
      </div>

      {/* RIGHT SECTION: Download, Lyrics, Queue, Volume */}
      <div className="flex items-center justify-end gap-2 w-1/4 min-w-[180px] max-w-[260px]">
        {/* Download Track */}
        {track && (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            title={
              isDownloaded
                ? 'Downloaded (click to remove)'
                : isDownloading
                ? 'Downloading...'
                : 'Download track'
            }
            className="p-1.5 rounded transition-colors text-[#b3b3b3] hover:text-white"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1ed760]" />
            ) : isDownloaded ? (
              <Check className="w-4 h-4 text-[#1ed760]" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Lyrics Toggle */}
        <button
          onClick={onToggleLyrics}
          title={isLyricsOpen ? 'Hide Lyrics' : 'Show Lyrics'}
          className={`p-1.5 rounded transition-colors ${
            isLyricsOpen
              ? 'text-[#1ed760]'
              : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          <Mic2 className="w-4 h-4" />
        </button>

        {/* Queue Toggle */}
        <button
          onClick={onToggleQueue}
          title={isQueueOpen ? 'Close Queue' : 'Queue'}
          className={`p-1.5 rounded transition-colors ${
            isQueueOpen
              ? 'text-[#1ed760]'
              : 'text-[#b3b3b3] hover:text-white'
          }`}
        >
          <ListMusic className="w-4 h-4" />
        </button>

        {/* Vertical Volume Slider on Hover */}
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onToggleMute={onToggleMute}
        />
      </div>
    </footer>
  );
};
