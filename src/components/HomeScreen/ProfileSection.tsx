import React from 'react';
import {
  User,
  Crown,
  HardDrive,
  Settings,
  Sparkles,
  Film,
  Zap,
  Shield,
  HelpCircle,
  FolderDown,
  Cpu,
} from 'lucide-react';

interface ProfileSectionProps {
  onNewVideo: () => void;
  projectCount: number;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  onNewVideo,
  projectCount,
}) => {
  return (
    <section className="w-full select-none" id="home-profile-section">
      {/* Profile Card */}
      <div className="rounded-2xl bg-gradient-to-r from-[#1e1e2c] via-[#222234] to-[#1a1a26] border border-white/10 p-4 sm:p-6 mb-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 p-0.5 shadow-lg">
                <div className="w-full h-full rounded-2xl bg-[#14141e] flex items-center justify-center text-white">
                  <User className="w-7 h-7 text-blue-400" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#14141e] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Creative Director
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-black flex items-center gap-1 shadow-xs">
                  <Crown className="w-3 h-3 fill-current" />
                  <span>PRO VIP</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cloud Studio Plan • Hardware Accelerated
              </p>
            </div>
          </div>

          <button
            onClick={onNewVideo}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 active:scale-95 transition-all self-start sm:self-auto"
          >
            Start Editing
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5 text-center">
          <div className="p-2.5 rounded-xl bg-white/[0.03]">
            <span className="block text-lg font-black text-white">{projectCount}</span>
            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
              Projects
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.03]">
            <span className="block text-lg font-black text-blue-400">4K 60fps</span>
            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
              Export Max
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.03]">
            <span className="block text-lg font-black text-purple-400">Unlimited</span>
            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
              AI Prompts
            </span>
          </div>
        </div>
      </div>

      {/* Cloud Storage Meter */}
      <div className="p-4 rounded-2xl bg-[#181822] border border-white/5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-white">Cloud Storage</span>
          </div>
          <span className="text-xs text-zinc-400 font-mono">1.4 GB / 50 GB (3%)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full w-[12%]" />
        </div>
      </div>

      {/* Settings & Preferences List */}
      <div className="rounded-2xl bg-[#181822] border border-white/5 overflow-hidden divide-y divide-white/5 text-xs text-zinc-200">
        <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="font-semibold block text-white">GPU Hardware Acceleration</span>
              <span className="text-[10px] text-zinc-400">WebCodecs & WebGL real-time pipeline</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
            ACTIVE
          </span>
        </div>

        <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <div>
              <span className="font-semibold block text-white">Gemini Multimodal Video AI</span>
              <span className="text-[10px] text-zinc-400">Prompt cut generator & intelligent voice sync</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">
            ENABLED
          </span>
        </div>

        <div className="p-3.5 flex items-center justify-between hover:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-zinc-400" />
            <div>
              <span className="font-semibold block text-white">CapCut-Style Hotkeys & Gestures</span>
              <span className="text-[10px] text-zinc-400">Space to play, S to split, Delete to ripple cut</span>
            </div>
          </div>
          <span className="text-zinc-500 font-mono text-[11px]">Ready</span>
        </div>
      </div>
    </section>
  );
};
