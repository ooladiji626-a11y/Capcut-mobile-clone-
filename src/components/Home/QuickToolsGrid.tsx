import React from 'react';
import {
  Subtitles,
  Sparkles,
  Mic,
  Gauge,
  Activity,
  Scissors,
  Wand2,
  Image as ImageIcon,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { QUICK_TOOLS } from '../../data/sampleProjectsData';
import { QuickToolItem } from '../../types';
import { motion } from 'motion/react';

interface QuickToolsGridProps {
  onSelectTool: (actionKey: string) => void;
}

export const QuickToolsGrid: React.FC<QuickToolsGridProps> = ({ onSelectTool }) => {
  // Helper to render icon by name
  const renderIcon = (name: string, className: string) => {
    switch (name) {
      case 'Subtitles':
        return <Subtitles className={className} />;
      case 'Sparkles':
        return <Sparkles className={className} />;
      case 'Mic':
        return <Mic className={className} />;
      case 'Gauge':
        return <Gauge className={className} />;
      case 'Activity':
        return <Activity className={className} />;
      case 'Scissors':
        return <Scissors className={className} />;
      case 'Wand2':
        return <Wand2 className={className} />;
      case 'Image':
        return <ImageIcon className={className} />;
      default:
        return <Zap className={className} />;
    }
  };

  return (
    <section className="w-full" id="quick-tools-section">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Editing Tools & AI Studio
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-300 font-bold border border-cyan-400/20">
            PRO
          </span>
        </div>
        <span className="text-xs text-zinc-400 hidden sm:inline">
          Tap tool to apply on a new or active project
        </span>
      </div>

      {/* Grid of tools */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5">
        {QUICK_TOOLS.map((tool) => (
          <motion.button
            key={tool.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelectTool(tool.actionKey)}
            className="group relative flex flex-col items-center text-center p-3 rounded-2xl bg-[#171722] hover:bg-[#1f1f2e] border border-white/5 hover:border-white/15 transition-all text-left w-full overflow-hidden"
          >
            {/* Badge */}
            {tool.badge && (
              <span
                className={`absolute top-1.5 right-1.5 px-1 py-0.2 text-[8px] font-black rounded uppercase tracking-wider ${
                  tool.badge === 'AI'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : tool.badge === 'PRO'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : tool.badge === 'HOT'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {tool.badge}
              </span>
            )}

            {/* Icon Container */}
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} border flex items-center justify-center mb-2.5 shadow-sm group-hover:scale-110 transition-transform`}
            >
              {renderIcon(tool.iconName, 'w-5 h-5')}
            </div>

            {/* Title */}
            <span className="text-xs font-bold text-zinc-200 group-hover:text-white tracking-tight leading-tight line-clamp-1">
              {tool.name}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
};
