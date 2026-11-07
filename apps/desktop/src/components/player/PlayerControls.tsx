import React from 'react';
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
} from 'lucide-react';

export type RepeatState = 'off' | 'all' | 'one';

interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: RepeatState;
  onToggleRepeat: () => void;
  disabled?: boolean;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-5 select-none mb-1">
      {/* Shuffle Button */}
      <button
        onClick={onToggleShuffle}
        disabled={disabled}
        title={isShuffle ? 'Disable Shuffle' : 'Enable Shuffle'}
        className={`relative transition-all disabled:opacity-40 p-1 ${
          isShuffle
            ? 'text-[#1ed760] hover:text-[#1fdf64]'
            : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <Shuffle className="w-4 h-4" />
        {isShuffle && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />
        )}
      </button>

      {/* Previous Track Button */}
      <button
        onClick={onPrev}
        disabled={disabled}
        title="Previous Track"
        className="text-[#b3b3b3] hover:text-white transition-all active:scale-95 disabled:opacity-40 p-1"
      >
        <SkipBack className="w-5 h-5 fill-current" />
      </button>

      {/* Main Play / Pause Button (Clean Spotify white circle) */}
      <button
        onClick={onTogglePlay}
        disabled={disabled}
        title={isPlaying ? 'Pause' : 'Play'}
        className="w-8 h-8 rounded-full bg-white text-black hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg disabled:opacity-40"
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Next Track Button */}
      <button
        onClick={onNext}
        disabled={disabled}
        title="Next Track"
        className="text-[#b3b3b3] hover:text-white transition-all active:scale-95 disabled:opacity-40 p-1"
      >
        <SkipForward className="w-5 h-5 fill-current" />
      </button>

      {/* Repeat Button */}
      <button
        onClick={onToggleRepeat}
        disabled={disabled}
        title={`Repeat mode: ${repeatMode}`}
        className={`relative transition-all disabled:opacity-40 p-1 ${
          repeatMode !== 'off'
            ? 'text-[#1ed760] hover:text-[#1fdf64]'
            : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        {repeatMode === 'one' ? (
          <Repeat1 className="w-4 h-4" />
        ) : (
          <Repeat className="w-4 h-4" />
        )}
        {repeatMode !== 'off' && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1ed760] rounded-full" />
        )}
      </button>
    </div>
  );
};
