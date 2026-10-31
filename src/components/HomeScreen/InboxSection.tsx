import React, { useState } from 'react';
import {
  Bell,
  Sparkles,
  Download,
  Gift,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface InboxSectionProps {
  onOpenAIEditor: () => void;
  onExploreTemplates: () => void;
}

export const InboxSection: React.FC<InboxSectionProps> = ({
  onOpenAIEditor,
  onExploreTemplates,
}) => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'announcements'>('notifications');

  const notifications = [
    {
      id: 'notif-1',
      title: '🎉 AI Script-to-Video Engine 2.0 Released',
      body: 'You can now paste full narration scripts, attach ZIP bundles, and generate timed documentary cuts automatically.',
      time: '10m ago',
      type: 'ai',
      unread: true,
      action: onOpenAIEditor,
      actionLabel: 'Try AI Video Copilot',
    },
    {
      id: 'notif-2',
      title: '🔥 New Viral TikTok & Reels Templates Added',
      body: 'Check out 5 trending countdown and Hormozi-style dynamic caption presets ready for 1-tap editing.',
      time: '2h ago',
      type: 'template',
      unread: true,
      action: onExploreTemplates,
      actionLabel: 'View Templates',
    },
    {
      id: 'notif-3',
      title: '📦 Cloud Storage Synchronized',
      body: '12 project assets and timeline caches were successfully backed up to cloud storage.',
      time: 'Yesterday',
      type: 'system',
      unread: false,
    },
    {
      id: 'notif-4',
      title: '⚡ 4K 60FPS Hardware Acceleration Active',
      body: 'Your device browser now supports full WebCodecs multi-track hardware decoding and real-time playback.',
      time: '3 days ago',
      type: 'system',
      unread: false,
    },
  ];

  return (
    <section className="w-full select-none" id="home-inbox-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" />
            <span>Inbox & Notifications</span>
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
            2 New
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-3">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            activeTab === 'notifications'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Notifications
        </button>
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
            activeTab === 'announcements'
              ? 'bg-blue-600 text-white'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          System Updates
        </button>
      </div>

      {/* Notifications list */}
      <div className="flex flex-col gap-2.5">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`p-3.5 rounded-2xl border transition-all ${
              item.unread
                ? 'bg-[#1a1b28] border-blue-500/30'
                : 'bg-[#161620] border-white/5 opacity-80 hover:opacity-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  {item.type === 'ai' ? (
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  ) : item.type === 'template' ? (
                    <Flame className="w-4 h-4 text-orange-400" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    {item.body}
                  </p>
                  <span className="text-[10px] text-zinc-500 font-mono mt-1.5 inline-block">
                    {item.time}
                  </span>
                </div>
              </div>
            </div>

            {item.action && (
              <div className="mt-3 pt-2.5 border-t border-white/5 flex justify-end">
                <button
                  onClick={item.action}
                  className="px-3 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
