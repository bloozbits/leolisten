import React from 'react';
import {
  X,
  ListMusic,
  Play,
  Trash2,
  Clock,
  Sparkles,
  Music,
} from 'lucide-react';
import { TrackItem } from '../../types/music';

interface QueuePanelProps {
  currentTrack: TrackItem | null;
  isPlaying: boolean;
  queue: TrackItem[];
  upNextTracks: TrackItem[];
  onPlayTrack: (track: TrackItem) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  onClose: () => void;
  onOpenSong?: (track: TrackItem) => void;
  onOpenArtist?: (artistIdOrName: string, artistName?: string) => void;
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  currentTrack,
  isPlaying,
  queue,
  upNextTracks,
  onPlayTrack,
  onRemoveFromQueue,
  onClearQueue,
  onClose,
  onOpenSong,
  onOpenArtist,
}) => {
  return (
    <div className="pb-16 select-none animate-fadeIn max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1ed760]/10 flex items-center justify-center text-[#1ed760]">
            <ListMusic className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Queue</h1>
            <p className="text-xs text-zinc-400">
              {queue.length + (currentTrack ? 1 : 0) + upNextTracks.length} tracks in queue
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {queue.length > 0 && (
            <button
              onClick={onClearQueue}
              className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              Clear Queue
            </button>
          )}
          <button
            onClick={onClose}
            title="Close Queue"
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Section 1: Now Playing */}
      <section className="mb-10">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3">
          Now Playing
        </h2>

        {currentTrack ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#242424] border border-zinc-800/60 shadow-lg">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Cover Art with Live Animated Waveform */}
              <div
                onClick={() => onOpenSong?.(currentTrack)}
                className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-900 shrink-0 relative group cursor-pointer shadow-md"
              >
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-end justify-center gap-0.5 pb-2">
                    <span className="w-1 bg-[#1ed760] animate-[bounce_0.8s_infinite_100ms] h-4 rounded-full" />
                    <span className="w-1 bg-[#1ed760] animate-[bounce_0.8s_infinite_300ms] h-6 rounded-full" />
                    <span className="w-1 bg-[#1ed760] animate-[bounce_0.8s_infinite_200ms] h-5 rounded-full" />
                  </div>
                )}
              </div>

              <div className="flex flex-col min-w-0 flex-1 pr-2">
                <span
                  onClick={() => onOpenSong?.(currentTrack)}
                  className="text-base font-bold text-white hover:underline cursor-pointer truncate"
                >
                  {currentTrack.title}
                </span>
                <span
                  onClick={() =>
                    onOpenArtist?.(currentTrack.artistId || currentTrack.artist, currentTrack.artist)
                  }
                  className="text-xs text-[#1ed760] hover:underline cursor-pointer truncate mt-0.5 font-medium"
                >
                  {currentTrack.artist}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 pr-2">
              <span className="text-xs font-mono text-zinc-400">
                {formatDuration(currentTrack.durationSec)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#181818] border border-zinc-800/40 text-center text-zinc-500 text-sm">
            No song is currently playing.
          </div>
        )}
      </section>

      {/* Section 2: Next In Queue (User-queued tracks) */}
      {queue.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
              Next In Queue
            </h2>
            <span className="text-xs text-zinc-500">{queue.length} queued</span>
          </div>

          <div className="space-y-1">
            {queue.map((track, idx) => (
              <div
                key={track.id + idx}
                onClick={() => onPlayTrack(track)}
                className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 shrink-0 relative shadow-sm">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1 pr-2">
                    <span className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      {track.title}
                    </span>
                    <span className="text-xs text-zinc-400 truncate">
                      {track.artist}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromQueue(idx);
                    }}
                    title="Remove from queue"
                    className="p-1.5 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-zinc-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-mono text-zinc-500 tabular-nums w-12 text-right">
                    {formatDuration(track.durationSec)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Next Up (From current album / playlist / recommendations) */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#1ed760]" />
            <span>Next Up</span>
          </h2>
          {upNextTracks.length > 0 && (
            <span className="text-xs text-zinc-500">{upNextTracks.length} tracks</span>
          )}
        </div>

        {upNextTracks.length > 0 ? (
          <div className="space-y-1">
            {upNextTracks.map((track, idx) => (
              <div
                key={track.id + idx}
                onClick={() => onPlayTrack(track)}
                className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-[#282828] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded overflow-hidden bg-zinc-800 shrink-0 relative shadow-sm">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-4 h-4 fill-current text-white ml-0.5" />
                    </div>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1 pr-2">
                    <span className="text-sm font-semibold text-white truncate group-hover:text-[#1ed760] transition-colors">
                      {track.title}
                    </span>
                    <span className="text-xs text-zinc-400 truncate">
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-zinc-500 tabular-nums">
                    {formatDuration(track.durationSec)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-[#181818] border border-zinc-800/40 text-center text-zinc-500">
            <Music className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No upcoming tracks in queue.</p>
            <p className="text-xs text-zinc-600 mt-1">
              Play an album or playlist, or add songs to queue to see them here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

