import React, { useState, useEffect } from 'react';
import { QuickPicksGrid } from '../components/home/QuickPicksGrid';
import { MediaShelf } from '../components/home/MediaShelf';
import { TrackItem, YTMSection } from '../types/music';
import { getRealHomeFeed, getCachedHomeFeed } from '../services/innertubeService';

interface HomeScreenProps {
  currentTrackId?: string;
  isPlaying?: boolean;
  onPlayTrack?: (track: TrackItem) => void;
  onTogglePlay?: () => void;
  onLoadedTracks?: (tracks: TrackItem[]) => void;
  onOpenAlbum?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onOpenPlaylist?: (id: string, title?: string, subtitle?: string, coverUrl?: string) => void;
  onOpenArtist?: (id: string, name?: string, coverUrl?: string) => void;
  onOpenSong?: (track: TrackItem) => void;
}

const CATEGORY_CHIPS = ['All', 'Music', 'Podcasts', 'Audiobooks'];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  onLoadedTracks,
  onOpenAlbum,
  onOpenPlaylist,
  onOpenArtist,
  onOpenSong,
}) => {
  const cachedFeed = getCachedHomeFeed();
  const [activeChip, setActiveChip] = useState('All');
  const [quickPicks, setQuickPicks] = useState<TrackItem[]>(cachedFeed?.quickPicks || []);
  const [sections, setSections] = useState<YTMSection[]>(cachedFeed?.sections || []);
  const [isLoading, setIsLoading] = useState(!cachedFeed);

  // Fetch real YouTube Music feed via Innertube on mount (instant if cached)
  useEffect(() => {
    let isMounted = true;

    async function loadRealData() {
      // If already cached, don't flash loading skeletons
      if (!cachedFeed) {
        setIsLoading(true);
      }
      try {
        const data = await getRealHomeFeed();
        if (isMounted) {
          if (data.quickPicks.length > 0) {
            setQuickPicks(data.quickPicks);
            onLoadedTracks?.(data.quickPicks);
          }
          if (data.sections.length > 0) {
            setSections(data.sections);
          }
        }
      } catch (err) {
        console.warn('[HomeScreen] Failed to load YouTube Music feed:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRealData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="pb-16 select-none">
      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 mb-6 pt-1">
        {CATEGORY_CHIPS.map((chip) => {
          const isActive = activeChip === chip;
          return (
            <button
              key={chip}
              onClick={() => setActiveChip(chip)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white text-black shadow-md'
                  : 'bg-[#2a2a2a] text-white hover:bg-[#333333]'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Speed Dial / Quick Picks 2x4 Grid with Real YouTube Music Data or Skeleton */}
      <QuickPicksGrid
        tracks={quickPicks}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onPlayTrack={onPlayTrack}
        onTogglePlay={onTogglePlay}
        onOpenPlaylist={onOpenPlaylist}
        isLoading={isLoading}
      />

      {/* Skeletons while loading YouTube Music shelves */}
      {isLoading && sections.length === 0 && (
        <>
          <MediaShelf title="Loading recommendations..." isLoading />
          <MediaShelf title="Loading hits & albums..." isLoading />
        </>
      )}

      {/* Dynamic YouTube Music Feed Sections from Innertube */}
      {sections.map((section) => (
        <MediaShelf
          key={section.id}
          title={section.title}
          subtitle={section.strapline}
          showAllText="Show all"
          onShowAll={() => console.log(`Show all for ${section.title}`)}
          items={section.items}
          onPlayTrack={onPlayTrack}
          onOpenAlbum={onOpenAlbum}
          onOpenPlaylist={onOpenPlaylist}
          onOpenArtist={onOpenArtist}
          onOpenSong={onOpenSong}
        />
      ))}
    </div>
  );
};
