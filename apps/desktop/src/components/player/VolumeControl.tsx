import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Volume1, Volume, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number; // 0 to 100
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveVolume = isMuted ? 0 : volume;

  const renderVolumeIcon = () => {
    if (isMuted || effectiveVolume === 0) {
      return <VolumeX className="w-4 h-4 text-[#b3b3b3]" />;
    }
    if (effectiveVolume < 35) {
      return <Volume className="w-4 h-4 text-[#b3b3b3]" />;
    }
    if (effectiveVolume < 70) {
      return <Volume1 className="w-4 h-4 text-[#b3b3b3]" />;
    }
    return <Volume2 className="w-4 h-4 text-[#b3b3b3]" />;
  };

  const updateVolumeFromY = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const height = rect.height;
    const offsetY = rect.bottom - clientY;
    const ratio = Math.max(0, Math.min(1, offsetY / height));
    const newVol = Math.round(ratio * 100);
    onVolumeChange(newVol);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    updateVolumeFromY(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      updateVolumeFromY(e.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (isDragging) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  const showVerticalSlider = isHovered || isDragging;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center select-none"
    >
      {/* Volume Icon Button */}
      <button
        onClick={onToggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        className="p-1.5 rounded-full text-[#b3b3b3] hover:text-white hover:bg-zinc-800/60 transition-colors"
      >
        {renderVolumeIcon()}
      </button>

      {/* Vertical Volume Slider Popover (Appears on hover directly above the icon) */}
      {showVerticalSlider && (
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 pb-2 z-50">
          <div className="w-10 py-3 px-2 bg-[#242424] border border-zinc-700/70 rounded-xl shadow-2xl flex flex-col items-center gap-2 select-none animate-in fade-in zoom-in-95 duration-100">
            {/* Level percentage */}
            <span className="text-[10px] font-mono font-bold text-zinc-300 tabular-nums">
              {effectiveVolume}%
            </span>

            {/* Vertical Track Container */}
            <div
              ref={trackRef}
              onMouseDown={handleMouseDown}
              className="relative w-2 h-28 bg-[#4d4d4d] rounded-full cursor-pointer flex flex-col justify-end group/track"
            >
              {/* Fill Level */}
              <div
                className="w-full bg-white group-hover/track:bg-[#1ed760] rounded-full transition-all"
                style={{ height: `${effectiveVolume}%` }}
              />

              {/* Thumb Handle */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md pointer-events-none transition-all"
                style={{
                  bottom: `calc(${effectiveVolume}% - 7px)`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
