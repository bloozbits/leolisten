import React from 'react';
import {
  Library,
  Plus,
  Heart,
  Download,
} from 'lucide-react';

export type NavRoute = 'home' | 'explore' | 'library' | 'liked' | 'downloads';

interface SidebarProps {
  activeRoute: NavRoute;
  onRouteChange: (route: NavRoute) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCreatePlaylist?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeRoute,
  onRouteChange,
  onCreatePlaylist,
}) => {
  return (
    <aside className="w-[72px] h-full flex flex-col items-center bg-[#121212] rounded-lg py-3 select-none shrink-0 border border-zinc-800/40">
      {/* Top Header: Library Icon */}
      <div className="flex flex-col items-center gap-3 w-full pb-3 border-b border-zinc-800/40">
        <button
          onClick={() => onRouteChange('library')}
          title="Your Library"
          className="w-11 h-11 rounded-full hover:bg-[#1f1f1f] text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors relative group"
        >
          <Library className="w-6 h-6 stroke-[2]" />
          {/* Tooltip */}
          <div className="absolute left-16 px-2.5 py-1 rounded bg-[#282828] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Your Library
          </div>
        </button>

        {/* Create Playlist (+) Button */}
        <button
          onClick={onCreatePlaylist}
          title="Create playlist or folder"
          className="w-10 h-10 rounded-full hover:bg-[#1f1f1f] text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors relative group"
        >
          <Plus className="w-5 h-5" />
          <div className="absolute left-16 px-2.5 py-1 rounded bg-[#282828] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Create playlist or folder
          </div>
        </button>
      </div>

      {/* Pinned Playlists & Artists Scrollable List */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar py-2 flex flex-col items-center gap-2">
        {/* Liked Songs Tile (Purple Gradient with Heart) */}
        <button
          onClick={() => onRouteChange('liked')}
          title="Liked Songs"
          className={`w-12 h-12 rounded-md bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-500 flex items-center justify-center text-white shadow-md relative group transition-transform hover:scale-105 ${
            activeRoute === 'liked' ? 'ring-2 ring-white' : ''
          }`}
        >
          <Heart className="w-5 h-5 fill-current" />

          {/* Tooltip */}
          <div className="absolute left-16 px-2.5 py-1 rounded bg-[#282828] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-1.5">
            <span>Liked Songs</span>
            <span className="text-[#b3b3b3] font-normal">• Playlist</span>
          </div>
        </button>

        {/* Downloads Library Tile (Emerald / Cyan Gradient with Download icon) */}
        <button
          onClick={() => onRouteChange('downloads')}
          title="Downloads"
          className={`w-12 h-12 rounded-md bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 flex items-center justify-center text-white shadow-md relative group transition-transform hover:scale-105 ${
            activeRoute === 'downloads' ? 'ring-2 ring-white' : ''
          }`}
        >
          <Download className="w-5 h-5 stroke-[2.5]" />

          {/* Tooltip */}
          <div className="absolute left-16 px-2.5 py-1 rounded bg-[#282828] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 flex items-center gap-1.5">
            <span>Downloads</span>
            <span className="text-[#b3b3b3] font-normal">• Library</span>
          </div>
        </button>
      </div>
    </aside>
  );
};
