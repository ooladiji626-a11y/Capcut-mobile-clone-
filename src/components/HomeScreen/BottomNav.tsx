import React from 'react';
import {
  Scissors,
  Flame,
  Sparkles,
  FolderKanban,
  Bell,
  User,
} from 'lucide-react';

export type HomeTab = 'edit' | 'templates' | 'ailab' | 'projects' | 'inbox' | 'profile';

interface BottomNavProps {
  activeTab: HomeTab;
  onSelectTab: (tab: HomeTab) => void;
  unreadInboxCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  unreadInboxCount = 2,
}) => {
  const tabs = [
    {
      id: 'edit' as HomeTab,
      label: 'Edit',
      icon: Scissors,
    },
    {
      id: 'templates' as HomeTab,
      label: 'Templates',
      icon: Flame,
      badge: 'HOT',
    },
    {
      id: 'ailab' as HomeTab,
      label: 'AI Lab',
      icon: Sparkles,
      highlight: true,
    },
    {
      id: 'projects' as HomeTab,
      label: 'Projects',
      icon: FolderKanban,
    },
    {
      id: 'inbox' as HomeTab,
      label: 'Inbox',
      icon: Bell,
      unreadCount: unreadInboxCount,
    },
    {
      id: 'profile' as HomeTab,
      label: 'Me',
      icon: User,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#12121a]/95 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around max-w-7xl mx-auto select-none safe-bottom"
      id="home-bottom-navigation"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-2.5 sm:px-4 rounded-xl transition-all active:scale-90 ${
              isActive
                ? 'text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            id={`nav-tab-${tab.id}`}
          >
            {/* Top Indicator / Glow for active tab */}
            {isActive && (
              <span className="absolute -top-1.5 w-6 h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-sm shadow-blue-500" />
            )}

            {/* Icon with optional highlight styling */}
            <div className="relative">
              {tab.highlight ? (
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-gradient-to-tr from-purple-600 to-blue-600 text-white shadow-md shadow-purple-600/40'
                      : 'bg-purple-900/30 text-purple-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              ) : (
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-blue-400 stroke-[2.5]' : 'text-zinc-400'
                  }`}
                />
              )}

              {/* Unread badge */}
              {tab.unreadCount && tab.unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center border-2 border-[#12121a]">
                  {tab.unreadCount}
                </span>
              ) : null}

              {/* Pill badge */}
              {tab.badge && (
                <span className="absolute -top-1.5 -right-3 px-1 rounded text-[7px] font-black uppercase tracking-wider bg-orange-500 text-white">
                  {tab.badge}
                </span>
              )}
            </div>

            {/* Label */}
            <span
              className={`text-[10px] font-medium mt-0.5 tracking-tight transition-colors ${
                isActive ? 'font-bold text-white' : 'text-zinc-400'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
