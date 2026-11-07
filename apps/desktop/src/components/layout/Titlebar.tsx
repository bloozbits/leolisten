import React, { useState, useEffect, useRef } from 'react';
import {
  Minus,
  Square,
  Copy,
  X,
  Home,
  Search,
  Bell,
  History,
} from 'lucide-react';
import appLogo from '../../assets/app-logo.svg';
import { getRealSearchSuggestions } from '../../services/innertubeService';

interface TitlebarProps {
  platform?: 'mac' | 'windows';
  onPlatformToggle?: () => void;
  onHomeClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  platform: forcedPlatform,
  onHomeClick,
  searchQuery = '',
  onSearchChange,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform, setPlatform] = useState<'mac' | 'windows'>('windows');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [internalQuery, setInternalQuery] = useState(searchQuery);
  const [realSuggestions, setRealSuggestions] = useState<string[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forcedPlatform) {
      setPlatform(forcedPlatform);
      return;
    }
    const electronPlatform = (window as any).electron?.platform;
    if (electronPlatform) {
      setPlatform(electronPlatform === 'darwin' ? 'mac' : 'windows');
      return;
    }
    const isMac =
      typeof navigator !== 'undefined' &&
      /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
    setPlatform(isMac ? 'mac' : 'windows');
  }, [forcedPlatform]);

  // Click outside to close search flyout
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

  // Fetch real YouTube Music search suggestions on typing
  useEffect(() => {
    if (!internalQuery.trim()) {
      setRealSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const sugs = await getRealSearchSuggestions(internalQuery);
        setRealSuggestions(sugs.slice(0, 6));
      } catch {
        // Fallback silently if offline
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [internalQuery]);

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ((window as any).electron?.minimize) {
        (window as any).electron.minimize();
        return;
      }
      const tauri = (window as unknown as {
        __TAURI__?: { window?: { getCurrentWindow: () => { minimize: () => Promise<void> } } };
      }).__TAURI__;
      if (tauri?.window) {
        await tauri.window.getCurrentWindow().minimize();
      }
    } catch (err) {
      console.warn('Minimize fallback:', err);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ((window as any).electron?.maximize) {
        (window as any).electron.maximize();
        setIsMaximized((prev) => !prev);
        return;
      }
      const tauri = (window as unknown as {
        __TAURI__?: { window?: { getCurrentWindow: () => { toggleMaximize: () => Promise<void> } } };
      }).__TAURI__;
      if (tauri?.window) {
        await tauri.window.getCurrentWindow().toggleMaximize();
      }
      setIsMaximized((prev) => !prev);
    } catch (err) {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ((window as any).electron?.close) {
        (window as any).electron.close();
        return;
      }
      const tauri = (window as unknown as {
        __TAURI__?: { window?: { getCurrentWindow: () => { close: () => Promise<void> } } };
      }).__TAURI__;
      if (tauri?.window) {
        await tauri.window.getCurrentWindow().close();
      }
    } catch (err) {
      console.warn('Close fallback:', err);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalQuery(val);
    onSearchChange?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchChange?.(internalQuery);
      setIsSearchFocused(false);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-16 w-full bg-black px-4 flex items-center justify-between select-none z-50 shrink-0"
    >
      {/* Left: App Logo + macOS Traffic Lights */}
      <div className="flex items-center gap-4 min-w-[200px]" data-tauri-drag-region>
        {platform === 'mac' && (
          <div className="flex items-center gap-2 pr-2 group" data-no-drag>
            <button
              onClick={handleClose}
              title="Close"
              className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] flex items-center justify-center text-zinc-900"
            >
              <X className="w-2 h-2 opacity-0 group-hover:opacity-100 stroke-[3]" />
            </button>
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#d89e24] flex items-center justify-center text-zinc-900"
            >
              <Minus className="w-2 h-2 opacity-0 group-hover:opacity-100 stroke-[3]" />
            </button>
            <button
              onClick={handleMaximize}
              title="Zoom"
              className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29] flex items-center justify-center text-zinc-900"
            >
              <span className="text-[7px] font-bold opacity-0 group-hover:opacity-100">+</span>
            </button>
          </div>
        )}

        {/* Clean Leolisen Brand Logo */}
        <div
          onClick={onHomeClick}
          className="flex items-center cursor-pointer group select-none py-1"
          data-no-drag
          title="Leolisen"
        >
          <img
            src={appLogo}
            alt="Leolisen"
            className="h-10 w-auto max-h-11 object-contain transition-transform group-hover:scale-105 active:scale-95"
          />
        </div>
      </div>

      {/* Center: Dedicated Home Button + Wide Search Pill */}
      <div
        className="flex items-center gap-2 flex-1 max-w-2xl justify-center"
        data-no-drag
      >
        {/* Dedicated Home Button */}
        <button
          onClick={onHomeClick}
          title="Home"
          className="w-12 h-12 rounded-full bg-[#1f1f1f] hover:bg-[#2a2a2a] hover:scale-105 text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-md"
        >
          <Home className="w-5 h-5 fill-current text-white" />
        </button>

        {/* Search Input Box */}
        <div
          ref={searchContainerRef}
          className="relative flex-1 max-w-lg"
        >
          <div
            className={`flex items-center h-11 px-3.5 rounded-lg bg-[#1f1f1f] hover:bg-[#282828] border transition-all duration-200 ${
              isSearchFocused
                ? 'border-white/40 bg-[#282828] ring-1 ring-white/10'
                : 'border-transparent'
            }`}
          >
            <Search className="w-5 h-5 text-[#b3b3b3] shrink-0 mr-3" />
            <input
              ref={searchInputRef}
              type="text"
              value={internalQuery}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="What do you want to play?"
              className="w-full bg-transparent text-sm text-white placeholder-[#b3b3b3] focus:outline-none font-medium"
            />

            {internalQuery && (
              <button
                onClick={() => {
                  setInternalQuery('');
                  onSearchChange?.('');
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown with Real YouTube Music Suggestions */}
          {isSearchFocused && (
            <div className="absolute top-13 left-0 right-0 bg-[#242424] border border-zinc-800 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {realSuggestions.length > 0 ? 'YouTube Music Suggestions' : 'Recent Searches'}
              </div>
              {(realSuggestions.length > 0
                ? realSuggestions
                : ['The Weeknd', 'Wegz Radio', 'Amr Diab Mix', 'Daft Punk', 'Top 50 Global']
              ).map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setInternalQuery(term);
                    onSearchChange?.(term);
                    setIsSearchFocused(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left text-sm text-zinc-200 hover:text-white hover:bg-[#2a2a2a] flex items-center gap-2 transition-colors"
                >
                  {realSuggestions.length > 0 ? (
                    <Search className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <History className="w-4 h-4 text-zinc-500" />
                  )}
                  <span>{term}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Notifications & Windows Window Controls */}
      <div
        className="flex items-center justify-end gap-3 min-w-[200px]"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-1.5" data-no-drag>
          <button
            title="What's New"
            className="w-9 h-9 rounded-full bg-[#121212] hover:bg-[#1f1f1f] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>

        {/* Windows Standard Window Controls */}
        {platform === 'windows' && (
          <div className="flex items-center ml-2 -mr-4" data-no-drag>
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="w-11 h-16 inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={handleMaximize}
              title={isMaximized ? 'Restore Down' : 'Maximize'}
              className="w-11 h-16 inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {isMaximized ? <Copy className="w-3.5 h-3.5 rotate-180" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleClose}
              title="Close"
              className="w-11 h-16 inline-flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
