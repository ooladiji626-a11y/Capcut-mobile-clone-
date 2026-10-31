import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Clock,
  Play,
  Share2,
  Music,
  User,
  ArrowRight,
  TrendingUp,
  Tag,
} from 'lucide-react';
import { TEMPLATE_PRESETS } from '../../data/sampleProjectsData';
import { TemplatePreset } from '../../types';
import { formatTime } from '../../utils/time';

interface TemplatesSectionProps {
  onUseTemplate: (template: TemplatePreset) => void;
  searchQuery?: string;
}

export const TemplatesSection: React.FC<TemplatesSectionProps> = ({
  onUseTemplate,
  searchQuery = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<TemplatePreset | null>(null);

  const categories = [
    { id: 'all', label: '🔥 All Templates' },
    { id: 'trending', label: 'Trending' },
    { id: 'movie-recap', label: '🎬 Movie Recap' },
    { id: 'countdown', label: '🏆 Top 5 Countdown' },
    { id: 'talking-head', label: '🎙️ Talking Head' },
    { id: 'cinematic', label: '🎥 Cinematic 4K' },
    { id: 'business', label: '📊 Explainer' },
  ];

  const filteredTemplates = TEMPLATE_PRESETS.filter((tpl) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        tpl.title.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tags.some((t) => t.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (activeCategory === 'all') return true;
    return tpl.category === activeCategory;
  });

  return (
    <section className="w-full select-none" id="home-templates-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-500 fill-current" />
            <span>Trending CapCut Templates</span>
          </h3>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
            VIRAL
          </span>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-3">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                : 'bg-[#1a1a24] text-zinc-400 hover:text-zinc-200 hover:bg-[#242432]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            className="group rounded-2xl bg-[#181822] hover:bg-[#20202e] border border-white/[0.07] hover:border-orange-500/40 p-2.5 flex flex-col justify-between transition-all duration-200 shadow-md overflow-hidden"
            id={`template-card-${tpl.id}`}
          >
            {/* Thumbnail Preview with 9:16 or 16:9 frame */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black/60 mb-2.5">
              {tpl.thumbnailUrl && tpl.thumbnailUrl.trim() !== '' ? (
                <img
                  src={tpl.thumbnailUrl}
                  alt={tpl.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-orange-400/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

              {/* Top Badges */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-black/70 text-white backdrop-blur-xs border border-white/10">
                  {tpl.aspectRatio}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/90 text-white flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>{tpl.usesCount}</span>
                </span>
              </div>

              {/* Duration Badge Bottom Right */}
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/80 text-zinc-200 backdrop-blur-xs flex items-center gap-1 z-10 border border-white/10">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{formatTime(tpl.duration)}</span>
              </div>
            </div>

            {/* Title & Creator */}
            <div className="mb-3">
              <h4 className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-1 group-hover:text-orange-400 transition-colors">
                {tpl.title}
              </h4>
              <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                {tpl.description}
              </p>

              {/* Audio Track Tag */}
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-zinc-400 bg-white/5 px-2 py-1 rounded-lg">
                <Music className="w-3 h-3 text-orange-400 shrink-0" />
                <span className="truncate">{tpl.audioTrackName}</span>
              </div>
            </div>

            {/* Use Template Action Button */}
            <button
              onClick={() => onUseTemplate(tpl)}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-orange-600/30 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use Template</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
