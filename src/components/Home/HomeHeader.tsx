import React from 'react';
import { Search, Sparkles, Bell, Settings, Cloud, HardDrive } from 'lucide-react';

interface HomeHeaderProps {
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenInbox: () => void;
  unreadCount?: number;
  cloudStorageUsedMb?: number;
  cloudStorageTotalMb?: number;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  onOpenSearch,
  onOpenSettings,
  onOpenInbox,
  unreadCount = 2,
  cloudStorageUsedMb = 281,
  cloudStorageTotalMb = 10240, // 10 GB
}) => {
  const percentUsed = Math.min(100, Math.round((cloudStorageUsedMb / cloudStorageTotalMb) * 100));

  return (
    <header className="w-full bg-[#121216] border-b border-white/[0.08] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md bg-[#121216]/90">
      {/* Left: CapCut-style Logo & Name */}
      <div className="flex items-center gap-3 select-none">
        <div className="relative flex items-center justify-center">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-lg shadow-blue-500/20">
            <div className="w-full h-full bg-[#16161e] rounded-[10px] flex items-center justify-center">
              {/* CapCut signature geometric logo emblem */}
              <div className="relative w-5 h-5 flex items-center justify-center">
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-cyan-200 to-blue-400 text-sm tracking-tighter">
                  C
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </div>
            </div>
          </div>
          <span className="absolute -top-1 -right-1 px-1 py-0.2 bg-gradient-to-r from-amber-500 to-orange-500 text-[9px] font-black text-black rounded uppercase tracking-wider shadow">
            PRO
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-black tracking-tight text-white">
              CapCut
            </span>
            <span className="text-xs font-semibold text-zinc-400 tracking-wider">
              Studio
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 hidden sm:block">
            Professional AI & Timeline Video Editor
          </p>
        </div>
      </div>

      {/* Center: Search Trigger Bar (Desktop/Tablet) */}
      <button
        onClick={onOpenSearch}
        className="hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1d1d26] hover:bg-[#252532] border border-white/10 text-zinc-400 hover:text-zinc-200 text-xs w-64 lg:w-80 transition-all group"
      >
        <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
        <span className="truncate">Search projects, templates, AI tools...</span>
        <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">
          ⌘K
        </kbd>
      </button>

      {/* Right: Cloud Sync, Search (Mobile), Notifications, Settings */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 rounded-xl bg-[#1d1d26] hover:bg-[#252532] text-zinc-300 hover:text-white border border-white/5 active:scale-95 transition-all"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Cloud Storage Status */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[#1a1a24] border border-white/5 text-[11px] text-zinc-300"
          title={`Cloud Storage: ${cloudStorageUsedMb} MB of ${(cloudStorageTotalMb / 1024).toFixed(0)} GB used`}
        >
          <Cloud className="w-3.5 h-3.5 text-cyan-400" />
          <div className="flex flex-col">
            <span className="font-medium text-white leading-tight">
              {(cloudStorageUsedMb / 1024).toFixed(1)}GB / 10GB
            </span>
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-0.5">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>
        </div>

        {/* Notifications / Inbox Bell */}
        <button
          onClick={onOpenInbox}
          className="relative p-2 rounded-xl bg-[#1d1d26] hover:bg-[#252532] text-zinc-300 hover:text-white border border-white/5 active:scale-95 transition-all"
          title="Inbox & Updates"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute 1 top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#121216]" />
          )}
        </button>

        {/* Settings Gear */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl bg-[#1d1d26] hover:bg-[#252532] text-zinc-300 hover:text-white border border-white/5 active:scale-95 transition-all"
          title="App Settings & Preferences"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
