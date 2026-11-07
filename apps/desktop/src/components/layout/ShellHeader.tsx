import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Settings,
  Bell,
  Laptop,
  Apple,
  Sparkles,
  TrendingUp,
  History,
} from 'lucide-react';

interface ShellHeaderProps {
  canGoBack?: boolean;
  canGoForward?: boolean;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  platform?: 'mac' | 'windows';
  onTogglePlatform?: () => void;
  onOpenSettings?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  canGoBack = true,
  canGoForward = false,
  onNavigateBack,
  onNavigateForward,
  platform = 'windows',
  onTogglePlatform,
  onOpenSettings,
  searchQuery = '',
  onSearchChange,
}) => {
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const isMac = platform === 'mac';
  const shortcutKey = isMac ? '⌘K' : 'Ctrl+K';

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && isSearchFocused) {
        searchInputRef.current?.blur();
        setIsSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchFocused]);

  // Click outside listener for search suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalQuery(val);
    onSearchChange?.(val);
  };

  const handleClear = () => {
    setInternalQuery('');
    onSearchChange?.('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="h-14 px-6 flex items-center justify-between gap-4 sticky top-0 z-40 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-800/40 select-none">
      {/* Navigation Arrows */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onNavigateBack}
          disabled={!canGoBack}
          title="Back"
          className="w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-zinc-800/60"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNavigateForward}
          disabled={!canGoForward}
          title="Forward"
          className="w-8 h-8 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors border border-zinc-800/60"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Integrated Search Bar with Shortcut Badge and Flyout Suggestions */}
      <div
        ref={searchContainerRef}
        className="relative flex-1 max-w-xl mx-auto"
      >
        <div
          className={`flex items-center gap-3 px-3.5 h-10 rounded-full bg-zinc-900/90 border transition-all duration-200 ${
            isSearchFocused
              ? 'border-zinc-500 ring-2 ring-zinc-500/20 bg-zinc-900'
              : 'border-zinc-800/80 hover:border-zinc-700/80'
          }`}
        >
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={internalQuery}
            onChange={handleChange}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search songs, albums, artists, podcasts..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />

          {internalQuery ? (
            <button
              onClick={handleClear}
              className="p-1 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 bg-zinc-800/90 border border-zinc-700/60 rounded-md tracking-wider">
              {shortcutKey}
            </kbd>
          )}
        </div>

        {/* Quick Search Flyout Dropdown */}
        {isSearchFocused && (
          <div className="absolute top-12 left-0 right-0 bg-zinc-900/95 backdrop-blur-2xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden py-3 px-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center justify-between">
              <span>Recent Searches</span>
              <button
                onClick={() => {}}
                className="hover:text-zinc-300 normal-case"
              >
                Clear
              </button>
            </div>
            <div className="space-y-0.5 mb-3">
              {['Starboy - The Weeknd', 'Synthwave Chill Radio', 'Daft Punk'].map(
                (term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setInternalQuery(term);
                      onSearchChange?.(term);
                      setIsSearchFocused(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/70 flex items-center justify-between group transition-colors"
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <History className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                      {term}
                    </span>
                    <span className="text-xs text-zinc-600 group-hover:text-zinc-400">
                      Search
                    </span>
                  </button>
                )
              )}
            </div>

            <div className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 border-t border-zinc-800/60 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span>Trending on YouTube Music</span>
            </div>
            <div className="grid grid-cols-2 gap-1 px-1 pt-1">
              {['Midnight City', 'After Dark', 'Resonance', 'Blinding Lights'].map(
                (trend) => (
                  <button
                    key={trend}
                    onClick={() => {
                      setInternalQuery(trend);
                      onSearchChange?.(trend);
                      setIsSearchFocused(false);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/60 text-left truncate flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400/80 shrink-0" />
                    <span className="truncate">{trend}</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Platform Preview Switcher & User Profile */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Quick Platform Style Preview Toggle */}
        <button
          onClick={onTogglePlatform}
          title={`Switch titlebar style (Currently: ${platform.toUpperCase()})`}
          className="px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1.5 transition-colors"
        >
          {platform === 'mac' ? (
            <Apple className="w-3.5 h-3.5" />
          ) : (
            <Laptop className="w-3.5 h-3.5" />
          )}
          <span className="hidden md:inline font-mono text-[11px] uppercase">
            {platform}
          </span>
        </button>

        <button
          title="Notifications"
          className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors border border-zinc-800/60"
        >
          <Bell className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings"
          className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors border border-zinc-800/60"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Avatar */}
        <div
          title="Leolisen User Profile"
          className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 cursor-pointer shadow-md shadow-red-900/20 active:scale-95 transition-transform"
        >
          <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center font-bold text-xs text-white">
            L
          </div>
        </div>
      </div>
    </div>
  );
};

