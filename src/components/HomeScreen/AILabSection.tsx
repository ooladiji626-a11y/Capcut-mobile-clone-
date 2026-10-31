import React from 'react';
import {
  Sparkles,
  Wand2,
  Subtitles,
  Scissors,
  Mic,
  Activity,
  Layers,
  Zap,
  ArrowRight,
  Video,
  Bot,
} from 'lucide-react';

interface AILabSectionProps {
  onOpenAIEditor: () => void;
  onSelectAITool: (toolKey: string) => void;
}

export const AILabSection: React.FC<AILabSectionProps> = ({
  onOpenAIEditor,
  onSelectAITool,
}) => {
  const aiFeatures = [
    {
      id: 'ai-script-to-video',
      title: 'Prompt to Video Studio',
      desc: 'Type or paste a full script, attach images/audio/ZIPs, and get an auto-timed documentary cut with voiceover sync.',
      badge: 'FLAGSHIP',
      icon: Wand2,
      color: 'from-purple-600 to-indigo-600',
      actionKey: 'ai-script-video',
    },
    {
      id: 'ai-auto-captions',
      title: 'Auto Captions & Subtitles',
      desc: 'Automatic speech recognition, animated Hormozi/Beast dynamic word highlights, and multilingual translation.',
      badge: 'HOT',
      icon: Subtitles,
      color: 'from-amber-600 to-orange-600',
      actionKey: 'auto-captions',
    },
    {
      id: 'ai-smart-cutout',
      title: 'Smart Chroma & Cutout',
      desc: '1-tap subject segmentation, background removal, neon contour glow strokes, and custom backdrop replacement.',
      badge: 'PRO',
      icon: Layers,
      color: 'from-cyan-600 to-blue-600',
      actionKey: 'chroma-cutout',
    },
    {
      id: 'ai-voice-tts',
      title: 'Studio AI Narration (TTS)',
      desc: 'Deep documentary narrators, energetic TikTok voice actors, pitch adjustment, and voice changers.',
      badge: 'AUDIO',
      icon: Mic,
      color: 'from-rose-600 to-pink-600',
      actionKey: 'voice-tts',
    },
    {
      id: 'ai-smart-highlights',
      title: 'Smart Highlights Auto-Cut',
      desc: 'AI analyzes speech pauses, audio energy peaks, and action clips to generate 15s viral snippets.',
      badge: 'VIRAL',
      icon: Scissors,
      color: 'from-emerald-600 to-teal-600',
      actionKey: 'smart-highlights',
    },
    {
      id: 'ai-beat-sync',
      title: 'Music Beat Synchronization',
      desc: 'Auto-detect transient drum drops and snap visual cuts directly on 808 beats and tempo drops.',
      badge: 'BEATS',
      icon: Activity,
      color: 'from-violet-600 to-fuchsia-600',
      actionKey: 'beat-detect',
    },
  ];

  return (
    <section className="w-full select-none" id="home-ailab-section">
      {/* Featured AI Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40 border border-purple-500/30 p-4 sm:p-6 mb-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-300 border border-purple-400/40">
                AI Video Studio
              </span>
              <span className="text-xs text-purple-200/70 font-medium">CapCut Next-Gen AI</span>
            </div>
            <h3 className="text-base sm:text-xl font-black text-white tracking-tight">
              Conversational Video Copilot
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 mt-1">
              Command cuts, transitions, captions, audio sync, and aspect ratios in plain English.
            </p>
          </div>

          <button
            onClick={onOpenAIEditor}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 transition-all shrink-0"
          >
            <Bot className="w-4 h-4" />
            <span>Launch AI Editor</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {aiFeatures.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.id}
              onClick={() => onSelectAITool(feat.actionKey)}
              className="group rounded-2xl bg-[#181822] hover:bg-[#20202e] border border-white/[0.07] hover:border-purple-500/40 p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-md active:scale-[0.99]"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feat.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white/10 text-zinc-300">
                    {feat.badge}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                  {feat.title}
                </h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {feat.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-semibold text-purple-400 group-hover:text-purple-300">
                <span>Try Tool</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
