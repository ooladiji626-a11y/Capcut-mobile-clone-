import React, { useState } from 'react';
import { Search, Bell, Settings, Sparkles, X } from 'lucide-react';

interface HomeHeaderProps {
  onOpenSearch?: (query: string) => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onOpenSettings,
  onOpenNotifications,
  searchQuery,
  setSearchQuery,
}) => {
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);

  return (
    <header
      className="sticky top-0 z-40 w-full bg-[#121216]/95 backdrop-blur-md border-b border-white/[0.07] px-4 py-3 select-none"
      id="home-top-header"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Left: App Logo & Name */}
        {!isSearchActive ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/20 shrink-0">
              <span className="font-black text-white text-base tracking-tighter">C</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-base tracking-tight leading-none">CapCut</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-xs">
                  PRO AI
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-medium leading-tight">Mobile Video Editor</span>
            </div>
          </div>
        ) : (
          /* Expandable Search Input */
          <div className="flex-1 flex items-center gap-2 bg-[#1c1c24] border border-blue-500/40 rounded-full px-3 py-1.5 transition-all">
            <Search className="w-4 h-4 text-blue-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, templates, AI tools..."
              className="bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none w-full"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Right: Actions (Search, Notification, Settings) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsSearchActive(!isSearchActive)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isSearchActive
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-[#1e1e26] hover:bg-[#282834] text-zinc-300 border border-white/5'
            }`}
            title="Search projects and templates"
            id="home-search-btn"
          >
            {isSearchActive ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenNotifications}
            className="w-8 h-8 rounded-full bg-[#1e1e26] hover:bg-[#282834] text-zinc-300 border border-white/5 flex items-center justify-center relative transition-all"
            title="Notifications & AI updates"
            id="home-notif-btn"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#121216]" />
          </button>

          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-full bg-[#1e1e26] hover:bg-[#282834] text-zinc-300 border border-white/5 flex items-center justify-center transition-all"
            title="App Settings & Cloud storage"
            id="home-settings-btn"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
