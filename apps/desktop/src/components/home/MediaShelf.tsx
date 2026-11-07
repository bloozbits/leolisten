import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, MoreVertical, Radio } from 'lucide-react';
import { MediaShelfItem, RadioStationItem, TrackItem } from '../../types/music';

interface MediaShelfProps {
  title: string;
  subtitle?: string;
  showAllText?: string;
  onShowAll?: () => void;
  stations?: RadioStationItem[];
  items?: MediaShelfItem[];
  onPlayTrack?: (track: TrackItem) => void;
  onOpenAlbum?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onOpenPlaylist?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onOpenArtist?: (id: string, name?: string, coverUrl?: string) => void;
  onOpenSong?: (track: TrackItem) => void;
  isLoading?: boolean;
}

export const MediaShelf: React.FC<MediaShelfProps> = ({
  title,
  subtitle,
  showAllText = 'Show all',
  onShowAll,
  stations,
  items,
  onPlayTrack,
  onOpenAlbum,
  onOpenPlaylist,
  onOpenArtist,
  onOpenSong,
  isLoading = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
  }, [stations, items]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -scrollRef.current.clientWidth * 0.75 : scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };

  // Render skeleton shelf while loading YouTube Music
  if (isLoading) {
    return (
      <section className="mb-8 select-none">
        <div className="flex items-center justify-between mb-3">
          <div className="h-7 w-48 bg-[#282828] rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-44 md:w-48 shrink-0 flex flex-col p-3 rounded-lg bg-[#181818] animate-pulse"
            >
              <div className="aspect-square w-full rounded-md bg-[#282828] mb-3" />
              <div className="h-4 w-3/4 bg-[#282828] rounded mb-2" />
              <div className="h-3 w-1/2 bg-[#282828] rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 select-none group/shelf">
      {/* Header */}
      <div className="flex items-end justify-between mb-3">
        <div>
          {subtitle && (
            <p className="text-xs font-medium text-[#b3b3b3] mb-1">
              {subtitle}
            </p>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-white hover:underline cursor-pointer">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {showAllText && (
            <button
              onClick={onShowAll}
              className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:underline transition-colors"
            >
              {showAllText}
            </button>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              title="Scroll left"
              className="w-7 h-7 rounded-full bg-[#181818] hover:bg-[#282828] text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              title="Scroll right"
              className="w-7 h-7 rounded-full bg-[#181818] hover:bg-[#282828] text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1"
      >
        {/* Render Station Cards */}
        {stations?.map((station) => (
          <div
            key={station.id}
            onClick={() => {
              onPlayTrack?.({
                id: station.id,
                title: station.title + ' Radio',
                artist: station.title,
                album: station.title + ' Station',
                durationSec: 280,
                coverUrl: station.avatars[0] || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80',
              });
            }}
            className="w-44 md:w-48 shrink-0 group flex flex-col p-3 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer relative"
          >
            {/* Station Graphic Banner */}
            <div
              className={`relative aspect-square w-full rounded-md overflow-hidden bg-gradient-to-br ${station.bannerColor} shadow-md flex items-center justify-center p-2 mb-2`}
            >
              {/* Radio Tag */}
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-bold text-white tracking-widest uppercase">
                {station.tag || 'RADIO'}
              </div>

              {/* Overlapping Artist Circles */}
              <div className="flex items-center justify-center -space-x-3 w-full">
                {station.avatars.map((av, idx) => (
                  <div
                    key={idx}
                    className="w-16 h-16 rounded-full overflow-hidden border-2 border-black/40 shadow-xl bg-zinc-900 shrink-0"
                  >
                    <img
                      src={av}
                      alt="Artist"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>

              {/* White Triangle Play Button on Hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayTrack?.({
                    id: station.id,
                    title: station.title + ' Radio',
                    artist: station.title,
                    album: station.title + ' Station',
                    durationSec: 280,
                    coverUrl: station.avatars[0],
                  });
                }}
                title={`Play ${station.title} Radio`}
                className="absolute right-3 bottom-3 p-1 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-115 active:scale-95 drop-shadow-xl"
              >
                <Play className="w-6 h-6 fill-current text-white ml-0.5" />
              </button>
            </div>

            {/* Title & Description */}
            <h3
              title={station.title}
              className="font-bold text-sm text-white truncate group-hover:underline"
            >
              {station.title}
            </h3>
            <p
              title={station.subtitle}
              className="text-xs text-[#b3b3b3] line-clamp-2 mt-1 leading-snug"
            >
              {station.subtitle}
            </p>
          </div>
        ))}

        {/* Render Regular Media Cards */}
        {items?.map((item) => {
          const isArtist = item.type === 'artist' || item.id.startsWith('UC');
          const isAlbum = item.type === 'album' || item.id.startsWith('MPREb_');
          const isPlaylist = item.type === 'playlist' || item.id.startsWith('VL') || item.id.startsWith('PL') || item.id.startsWith('RD');

          const handleCardClick = () => {
            if (isArtist && onOpenArtist) {
              onOpenArtist(item.id, item.title, item.coverUrl);
            } else if (isAlbum && onOpenAlbum) {
              onOpenAlbum(item.id, item.title, item.subtitle, item.coverUrl);
            } else if (isPlaylist && onOpenPlaylist) {
              onOpenPlaylist(item.id, item.title, item.subtitle, item.coverUrl);
            } else if (onPlayTrack) {
              onPlayTrack({
                id: item.id,
                title: item.title,
                artist: item.subtitle,
                album: item.title,
                durationSec: 240,
                coverUrl: item.coverUrl,
              });
            }
          };

          return (
            <div
              key={item.id}
              onClick={handleCardClick}
              className="w-44 md:w-48 shrink-0 group flex flex-col p-3 rounded-lg bg-[#181818] hover:bg-[#282828] transition-colors cursor-pointer relative"
            >
              <div className={`relative aspect-square w-full overflow-hidden bg-zinc-800 shadow-md mb-2 ${
                isArtist ? 'rounded-full' : 'rounded-md'
              }`}>
                <img
                  src={item.coverUrl}
                  alt={item.title}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick();
                  }}
                  title={`Play ${item.title}`}
                  className="absolute right-3 bottom-3 p-1 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-115 active:scale-95 drop-shadow-xl"
                >
                  <Play className="w-6 h-6 fill-current text-white ml-0.5" />
                </button>
              </div>

              <h3
                title={item.title}
                className="font-bold text-sm text-white truncate group-hover:underline"
              >
                {item.title}
              </h3>
              <p
                title={item.subtitle}
                className="text-xs text-[#b3b3b3] line-clamp-2 mt-1 leading-snug"
              >
                {item.subtitle}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
