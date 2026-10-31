import React from 'react';
import {
  Type,
  Scissors,
  Layers,
  Mic,
  Zap,
  Music,
  Sparkles,
  Grid,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { QUICK_TOOLS } from '../../data/sampleProjectsData';
import { QuickToolItem } from '../../types';

interface QuickToolsSectionProps {
  onSelectTool: (actionKey: string) => void;
}

export const QuickToolsSection: React.FC<QuickToolsSectionProps> = ({ onSelectTool }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Type':
        return <Type className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />;
      case 'Scissors':
        return <Scissors className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />;
      case 'Layers':
        return <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />;
      case 'Mic':
        return <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />;
      case 'Zap':
        return <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />;
      case 'Music':
        return <Music className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />;
      case 'Grid':
        return <Grid className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />;
      case 'BarChart3':
        return <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <section className="w-full select-none" id="home-quick-tools">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs sm:text-sm font-bold text-zinc-200 tracking-tight flex items-center gap-1.5">
          <span>AI & Creative Tools</span>
          <span className="text-[10px] text-zinc-500 font-normal">({QUICK_TOOLS.length})</span>
        </h3>
      </div>

      {/* Horizontal scrollable or wrap grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {QUICK_TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.actionKey)}
            className="group flex flex-col items-center justify-center p-2 sm:p-2.5 rounded-xl bg-[#181820] hover:bg-[#20202c] border border-white/[0.06] hover:border-white/20 transition-all active:scale-95 text-center relative"
            id={`tool-${tool.id}`}
          >
            {/* Badge */}
            {tool.badge && (
              <span className="absolute -top-1.5 -right-1 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-xs">
                {tool.badge}
              </span>
            )}

            {/* Icon Circle */}
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#22222e] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform shadow-inner`}>
              {getIcon(tool.iconName)}
            </div>

            {/* Title */}
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-300 group-hover:text-white leading-tight line-clamp-1">
              {tool.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};
