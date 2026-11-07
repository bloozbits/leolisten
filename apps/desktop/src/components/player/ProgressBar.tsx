import React, { useState, useRef } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (newTime: number) => void;
  disabled?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  onSeek,
  disabled = false,
}) => {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hoverTime =
    hoverPosition !== null && duration > 0 ? (hoverPosition / 100) * duration : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || disabled) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || disabled || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  return (
    <div className="w-full flex items-center gap-2 select-none group">
      {/* Current Time Display (matching screenshot "4:30") */}
      <span className="text-[11px] font-mono text-[#b3b3b3] w-9 text-right tabular-nums">
        {formatTime(currentTime)}
      </span>

      {/* Progress Track */}
      <div
        ref={barRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setHoverPosition(null);
        }}
        className="relative flex-1 h-3 flex items-center cursor-pointer"
      >
        {/* Hover Time Tooltip */}
        {isHovering && hoverPosition !== null && (
          <div
            className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#282828] border border-zinc-700 text-white text-[10px] font-mono shadow-lg pointer-events-none z-30"
            style={{ left: `${hoverPosition}%` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        {/* Base Track */}
        <div className="w-full h-1 rounded-full bg-[#4d4d4d] relative overflow-hidden">
          {/* Active Played Track (turns green on hover like Spotify) */}
          <div
            className="h-full bg-white group-hover:bg-[#1ed760] rounded-full transition-colors"
            style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
          />
        </div>

        {/* Slider Thumb Handle */}
        <div
          className="absolute -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ left: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
        />
      </div>

      {/* Duration Display (matching screenshot "4:55") */}
      <span className="text-[11px] font-mono text-[#b3b3b3] w-9 text-left tabular-nums">
        {formatTime(duration)}
      </span>
    </div>
  );
};
