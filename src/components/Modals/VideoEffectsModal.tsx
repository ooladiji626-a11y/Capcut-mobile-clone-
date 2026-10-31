import React, { useState } from 'react';
import {
  X,
  Check,
  Sparkles,
  Zap,
  Flame,
  Layers,
  Eye,
  RotateCcw,
  Activity,
  Tv,
  Film,
  Radio,
  Sun,
  Shield,
  ScanLine,
} from 'lucide-react';
import { VideoClip, VideoEffectPreset } from '../../types';

interface VideoEffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClip: VideoClip | null;
  onUpdateEffects: (clipId: string, effects: VideoEffectPreset[]) => void;
}

interface EffectDefinition {
  id: VideoEffectPreset;
  name: string;
  category: 'Body VFX' | 'Retro Distortion' | 'Cinematic FX' | 'Glitch & Cyber';
  description: string;
  badge: 'AI' | 'PRO' | 'HOT';
  previewClass: string;
  icon: React.ReactNode;
}

const VIDEO_EFFECTS_CATALOG: EffectDefinition[] = [
  // Body VFX
  {
    id: 'lightning-aura',
    name: 'Lightning Aura',
    category: 'Body VFX',
    description: 'Electric arc sparks and energy currents pulsing along body contours',
    badge: 'AI',
    previewClass: 'from-amber-500/30 to-yellow-500/10 border-yellow-400/40 text-yellow-300',
    icon: <Zap className="w-4 h-4 text-yellow-400" />,
  },
  {
    id: 'cyber-eyes',
    name: 'Cyber Laser Eyes',
    category: 'Body VFX',
    description: 'Glowing laser eyes and facial highlight flares',
    badge: 'AI',
    previewClass: 'from-rose-500/30 to-red-500/10 border-rose-400/40 text-rose-300',
    icon: <Eye className="w-4 h-4 text-rose-400" />,
  },
  {
    id: 'neon-edge',
    name: 'Neon Silhouette Glow',
    category: 'Body VFX',
    description: 'Ultra-bright animated neon stroke tracing movement',
    badge: 'HOT',
    previewClass: 'from-cyan-500/30 to-blue-500/10 border-cyan-400/40 text-cyan-300',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
  },
  {
    id: 'body-clone',
    name: 'Phantom Echo Clone',
    category: 'Body VFX',
    description: 'Ghostly motion trails following subject movement with optical delay',
    badge: 'PRO',
    previewClass: 'from-purple-500/30 to-indigo-500/10 border-purple-400/40 text-purple-300',
    icon: <Layers className="w-4 h-4 text-purple-400" />,
  },

  // Retro Distortion
  {
    id: 'vhs-retro',
    name: 'VHS Camcorder 1994',
    category: 'Retro Distortion',
    description: 'Analog tracking jitter, tape static, noise lines, and PLAY timestamp',
    badge: 'HOT',
    previewClass: 'from-teal-500/30 to-emerald-500/10 border-teal-400/40 text-teal-300',
    icon: <Tv className="w-4 h-4 text-teal-400" />,
  },
  {
    id: 'crt-scanlines',
    name: 'CRT Arcade Monitor',
    category: 'Retro Distortion',
    description: 'Horizontal phosphor scanlines, subtle screen curve, and tube glow',
    badge: 'PRO',
    previewClass: 'from-green-500/30 to-lime-500/10 border-green-400/40 text-green-300',
    icon: <ScanLine className="w-4 h-4 text-green-400" />,
  },
  {
    id: 'film-grain-8mm',
    name: 'Vintage 8mm Film',
    category: 'Retro Distortion',
    description: 'Super 8 organic dust particles, warm flicker, and film gate weave',
    badge: 'PRO',
    previewClass: 'from-amber-600/30 to-yellow-700/10 border-amber-500/40 text-amber-300',
    icon: <Film className="w-4 h-4 text-amber-400" />,
  },

  // Glitch & Cyber
  {
    id: 'rgb-split',
    name: 'Chromatic RGB Split',
    category: 'Glitch & Cyber',
    description: 'Red and Cyan color channel aberration shaking on bass hits',
    badge: 'HOT',
    previewClass: 'from-fuchsia-500/30 to-cyan-500/10 border-fuchsia-400/40 text-fuchsia-300',
    icon: <Activity className="w-4 h-4 text-fuchsia-400" />,
  },
  {
    id: 'thermal-vision',
    name: 'Predator Thermal Heatmap',
    category: 'Glitch & Cyber',
    description: 'Infrared heat spectrum mapping highlights to hot orange/violet',
    badge: 'AI',
    previewClass: 'from-orange-500/30 to-purple-600/10 border-orange-400/40 text-orange-300',
    icon: <Flame className="w-4 h-4 text-orange-400" />,
  },
  {
    id: 'hologram',
    name: 'Cyber Hologram Matrix',
    category: 'Glitch & Cyber',
    description: 'Cyan interference grid with holographic transmission flicker',
    badge: 'AI',
    previewClass: 'from-sky-500/30 to-blue-600/10 border-sky-400/40 text-sky-300',
    icon: <Radio className="w-4 h-4 text-sky-400" />,
  },

  // Cinematic FX
  {
    id: 'prism-flare',
    name: 'Anamorphic Prism Flare',
    category: 'Cinematic FX',
    description: 'Horizontal blue anamorphic lens flare streaks across highlights',
    badge: 'PRO',
    previewClass: 'from-blue-500/30 to-cyan-500/10 border-blue-400/40 text-blue-300',
    icon: <Sun className="w-4 h-4 text-blue-400" />,
  },
  {
    id: 'bokeh-particles',
    name: 'Floating Bokeh Dust',
    category: 'Cinematic FX',
    description: 'Luminous out-of-focus light orbs gently drifting across the screen',
    badge: 'HOT',
    previewClass: 'from-yellow-500/30 to-amber-500/10 border-yellow-400/40 text-yellow-300',
    icon: <Sparkles className="w-4 h-4 text-yellow-400" />,
  },
];

export const VideoEffectsModal: React.FC<VideoEffectsModalProps> = ({
  isOpen,
  onClose,
  selectedClip,
  onUpdateEffects,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeEffects, setActiveEffects] = useState<VideoEffectPreset[]>(
    selectedClip?.videoEffects || []
  );

  if (!isOpen || !selectedClip) return null;

  const categories = ['All', 'Body VFX', 'Retro Distortion', 'Glitch & Cyber', 'Cinematic FX'];

  const filteredEffects =
    selectedCategory === 'All'
      ? VIDEO_EFFECTS_CATALOG
      : VIDEO_EFFECTS_CATALOG.filter((fx) => fx.category === selectedCategory);

  const handleToggleEffect = (effectId: VideoEffectPreset) => {
    setActiveEffects((prev) => {
      if (prev.includes(effectId)) {
        return prev.filter((id) => id !== effectId);
      } else {
        return [...prev, effectId];
      }
    });
  };

  const handleApply = () => {
    onUpdateEffects(selectedClip.id, activeEffects);
    onClose();
  };

  const handleClearAll = () => {
    setActiveEffects([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                AI Video Effects & Body VFX
                <span className="bg-purple-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  CAPCUT FX
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[260px]">
                Target: <span className="text-purple-300 font-bold">{selectedClip.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-[#181818] overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all active:scale-95 ${
                selectedCategory === cat
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-[#242424] text-zinc-400 hover:text-white hover:bg-[#2c2c2c]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Effects Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
          {activeEffects.length > 0 && (
            <div className="flex items-center justify-between bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-purple-200 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Active Stack: <strong className="text-white font-bold">{activeEffects.length} Effects</strong>
              </span>
              <button
                onClick={handleClearAll}
                className="text-[10px] text-purple-300 hover:text-white underline"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {filteredEffects.map((fx) => {
              const isSelected = activeEffects.includes(fx.id);
              return (
                <button
                  key={fx.id}
                  onClick={() => handleToggleEffect(fx.id)}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all active:scale-95 relative overflow-hidden bg-gradient-to-br ${
                    isSelected
                      ? `${fx.previewClass} ring-2 ring-purple-400/50 shadow-lg`
                      : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                      {fx.icon}
                    </div>
                    <span
                      className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                        fx.badge === 'AI'
                          ? 'bg-purple-500 text-white'
                          : fx.badge === 'HOT'
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-black'
                      }`}
                    >
                      {fx.badge}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1">
                      {fx.name}
                    </h4>
                    <p className="text-[9px] text-zinc-400 line-clamp-2 mt-0.5 leading-tight">
                      {fx.description}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-purple-500 text-white p-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={handleClearAll}
            className="py-2.5 px-3 rounded-xl bg-[#242424] text-zinc-400 text-xs font-semibold hover:text-white hover:bg-[#2c2c2c] active:scale-95 transition-all"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#242424] text-zinc-300 text-xs font-semibold hover:bg-[#2c2c2c] active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            id="apply-video-effects-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Apply ({activeEffects.length}) Video Effects
          </button>
        </div>
      </div>
    </div>
  );
};
