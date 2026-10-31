import React, { useState, useEffect } from 'react';
import { Transition, TransitionType } from '../../types';
import {
  X,
  Check,
  Zap,
  Film,
  Camera,
  Sparkles,
  Layers,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sliders,
  CheckCheck,
} from 'lucide-react';

interface TransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTransition?: Transition;
  fromClipTitle?: string;
  toClipTitle?: string;
  onApplyTransition: (transition: Transition | undefined, applyToAll: boolean) => void;
}

interface TransitionItem {
  type: TransitionType;
  name: string;
  category: 'Trending' | 'Basic' | 'Camera' | 'Glitch' | 'Light' | 'Slide';
  icon: string;
  description: string;
  defaultDuration?: number;
}

const TRANSITION_DATABASE: TransitionItem[] = [
  // Trending & Basic
  {
    type: 'dissolve',
    name: 'Dissolve',
    category: 'Trending',
    icon: '🌫️',
    description: 'Smooth opacity blend between clips',
  },
  {
    type: 'flash',
    name: 'White Flash',
    category: 'Trending',
    icon: '⚡',
    description: 'Cinematic overexposure flash cut',
  },
  {
    type: 'fade-black',
    name: 'Fade Black',
    category: 'Basic',
    icon: '🌑',
    description: 'Dip into dramatic black before next scene',
  },
  {
    type: 'blur-fade',
    name: 'Blur Fade',
    category: 'Basic',
    icon: '💧',
    description: 'Soft gaussian lens defocus transition',
  },

  // Camera Motion
  {
    type: 'zoom-in',
    name: 'Pull In (Zoom)',
    category: 'Camera',
    icon: '🔍',
    description: 'High-speed camera rush into the subject',
  },
  {
    type: 'zoom-out',
    name: 'Push Out',
    category: 'Camera',
    icon: '🔎',
    description: 'Rapid wide-angle camera pull back',
  },
  {
    type: 'whip-pan-left',
    name: 'Whip Pan L',
    category: 'Camera',
    icon: '💨',
    description: 'Fast horizontal motion blur pan to left',
  },
  {
    type: 'whip-pan-right',
    name: 'Whip Pan R',
    category: 'Camera',
    icon: '🌪️',
    description: 'Fast horizontal motion blur pan to right',
  },
  {
    type: 'spin-cw',
    name: 'Spin 360°',
    category: 'Camera',
    icon: '🔄',
    description: 'Clockwise rotating vortex spin',
  },
  {
    type: 'swirl',
    name: 'Swirl Warp',
    category: 'Camera',
    icon: '🌀',
    description: 'Spiral lens distortion transition',
  },

  // Glitch & Distortion
  {
    type: 'glitch',
    name: 'Cyber Glitch',
    category: 'Glitch',
    icon: '📺',
    description: 'Digital block artifact breakdown',
  },
  {
    type: 'rgb-split',
    name: 'RGB Split',
    category: 'Glitch',
    icon: '🚥',
    description: 'Chromatic aberration color separation',
  },
  {
    type: 'vhs-noise',
    name: 'VHS Noise',
    category: 'Glitch',
    icon: '📼',
    description: 'Vintage magnetic tape static pulse',
  },

  // Light & Overlay
  {
    type: 'light-leak',
    name: 'Light Leak',
    category: 'Light',
    icon: '✨',
    description: 'Warm golden analog sunlight spill',
  },
  {
    type: 'film-burn',
    name: 'Film Burn',
    category: 'Light',
    icon: '🔥',
    description: '35mm projector edge burn artifact',
  },
  {
    type: 'lens-flare',
    name: 'Lens Flare',
    category: 'Light',
    icon: '☀️',
    description: 'Anamorphic horizontal flare bloom',
  },

  // Slides
  {
    type: 'slide-left',
    name: 'Slide Left',
    category: 'Slide',
    icon: '⬅️',
    description: 'Dynamic horizontal slide wipe',
  },
  {
    type: 'slide-right',
    name: 'Slide Right',
    category: 'Slide',
    icon: '➡️',
    description: 'Dynamic right slide wipe',
  },
  {
    type: 'slide-up',
    name: 'Slide Up',
    category: 'Slide',
    icon: '⬆️',
    description: 'Vertical upwards wipe transition',
  },
];

const CATEGORIES = ['All', 'Trending', 'Basic', 'Camera', 'Glitch', 'Light', 'Slide'] as const;

export const TransitionModal: React.FC<TransitionModalProps> = ({
  isOpen,
  onClose,
  currentTransition,
  fromClipTitle,
  toClipTitle,
  onApplyTransition,
}) => {
  const [selectedType, setSelectedType] = useState<TransitionType | 'none'>(
    currentTransition?.type || 'dissolve'
  );
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [duration, setDuration] = useState<number>(currentTransition?.duration || 0.5);
  const [soundEffect, setSoundEffect] = useState<string>(currentTransition?.soundEffect || 'swoosh');
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  // Live Animated Preview Loop State
  const [previewProgress, setPreviewProgress] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    let animFrame: number;
    let startTime = performance.now();

    const loop = (time: number) => {
      const elapsed = ((time - startTime) / 1000) % (duration * 2 + 1.2);
      let p = 0;
      if (elapsed < 0.6) {
        p = 0; // Show clip A
      } else if (elapsed < 0.6 + duration) {
        p = (elapsed - 0.6) / duration; // Transitioning
      } else if (elapsed < 0.6 + duration + 0.6) {
        p = 1; // Show clip B
      } else {
        startTime = time;
      }
      setPreviewProgress(Math.max(0, Math.min(1, p)));
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isOpen, duration, selectedType]);

  if (!isOpen) return null;

  const filteredTransitions =
    activeCategory === 'All'
      ? TRANSITION_DATABASE
      : TRANSITION_DATABASE.filter((t) => t.category === activeCategory);

  const selectedItem = TRANSITION_DATABASE.find((t) => t.type === selectedType);

  const handleSave = () => {
    if (selectedType === 'none') {
      onApplyTransition(undefined, applyToAll);
    } else {
      const item = TRANSITION_DATABASE.find((t) => t.type === selectedType);
      const newTransition: Transition = {
        id: `trans-${Date.now()}`,
        type: selectedType,
        name: item ? item.name : 'Transition',
        duration: duration,
        soundEffect: soundEffect !== 'none' ? soundEffect : undefined,
      };
      onApplyTransition(newTransition, applyToAll);
    }
    onClose();
  };

  const handleRemove = () => {
    setSelectedType('none');
    onApplyTransition(undefined, applyToAll);
    onClose();
  };

  // Compute live visual styles for the mini preview
  const getPreviewClipAStyle = () => {
    if (selectedType === 'none') return { opacity: previewProgress < 0.5 ? 1 : 0 };
    switch (selectedType) {
      case 'dissolve':
        return { opacity: 1 - previewProgress };
      case 'flash':
        return {
          opacity: previewProgress < 0.5 ? 1 : 0,
          filter: previewProgress > 0.2 && previewProgress < 0.8 ? 'brightness(300%)' : 'none',
        };
      case 'fade-black':
        return { opacity: previewProgress < 0.5 ? 1 - previewProgress * 2 : 0 };
      case 'zoom-in':
        return {
          transform: `scale(${1 + previewProgress * 0.8})`,
          opacity: 1 - previewProgress,
        };
      case 'zoom-out':
        return {
          transform: `scale(${1 - previewProgress * 0.5})`,
          opacity: 1 - previewProgress,
        };
      case 'whip-pan-left':
        return {
          transform: `translateX(${-previewProgress * 100}%)`,
          filter: `blur(${previewProgress * 8}px)`,
        };
      case 'whip-pan-right':
        return {
          transform: `translateX(${previewProgress * 100}%)`,
          filter: `blur(${previewProgress * 8}px)`,
        };
      case 'spin-cw':
        return {
          transform: `rotate(${previewProgress * 180}deg) scale(${1 - previewProgress * 0.4})`,
          opacity: 1 - previewProgress,
        };
      case 'glitch':
        return {
          transform: previewProgress > 0 && previewProgress < 1 ? `skewX(${(previewProgress % 0.2) * 40}deg)` : 'none',
          opacity: 1 - previewProgress,
          filter: previewProgress > 0 && previewProgress < 1 ? 'hue-rotate(90deg)' : 'none',
        };
      case 'slide-left':
        return { transform: `translateX(${-previewProgress * 100}%)` };
      case 'slide-right':
        return { transform: `translateX(${previewProgress * 100}%)` };
      case 'slide-up':
        return { transform: `translateY(${-previewProgress * 100}%)` };
      case 'blur-fade':
        return { filter: `blur(${previewProgress * 12}px)`, opacity: 1 - previewProgress };
      default:
        return { opacity: 1 - previewProgress };
    }
  };

  const getPreviewClipBStyle = () => {
    if (selectedType === 'none') return { opacity: previewProgress >= 0.5 ? 1 : 0 };
    switch (selectedType) {
      case 'dissolve':
        return { opacity: previewProgress };
      case 'flash':
        return {
          opacity: previewProgress >= 0.5 ? 1 : 0,
        };
      case 'fade-black':
        return { opacity: previewProgress >= 0.5 ? (previewProgress - 0.5) * 2 : 0 };
      case 'zoom-in':
        return {
          transform: `scale(${0.7 + previewProgress * 0.3})`,
          opacity: previewProgress,
        };
      case 'zoom-out':
        return {
          transform: `scale(${1.4 - previewProgress * 0.4})`,
          opacity: previewProgress,
        };
      case 'whip-pan-left':
        return {
          transform: `translateX(${(1 - previewProgress) * 100}%)`,
          filter: `blur(${(1 - previewProgress) * 8}px)`,
        };
      case 'whip-pan-right':
        return {
          transform: `translateX(${-(1 - previewProgress) * 100}%)`,
          filter: `blur(${(1 - previewProgress) * 8}px)`,
        };
      case 'spin-cw':
        return {
          transform: `rotate(${-(1 - previewProgress) * 180}deg) scale(${0.6 + previewProgress * 0.4})`,
          opacity: previewProgress,
        };
      case 'slide-left':
        return { transform: `translateX(${(1 - previewProgress) * 100}%)` };
      case 'slide-right':
        return { transform: `translateX(${-(1 - previewProgress) * 100}%)` };
      case 'slide-up':
        return { transform: `translateY(${(1 - previewProgress) * 100}%)` };
      case 'blur-fade':
        return { filter: `blur(${(1 - previewProgress) * 12}px)`, opacity: previewProgress };
      default:
        return { opacity: previewProgress };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
              ⧗
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                CapCut Transitions
              </h2>
              {fromClipTitle && toClipTitle && (
                <p className="text-[10px] text-zinc-400 truncate max-w-[280px]">
                  Between <span className="text-cyan-300">{fromClipTitle}</span> &{' '}
                  <span className="text-cyan-300">{toClipTitle}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
            id="close-transitions-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Interactive Transition Preview Stage */}
        <div className="p-3 bg-[#0d0d0d] border-b border-white/10 flex flex-col items-center justify-center relative">
          <div className="relative w-48 h-28 rounded-lg overflow-hidden bg-black border border-white/15 shadow-inner flex items-center justify-center">
            {/* Clip A (Sample Beach/Ocean) */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#1e3a8a] transition-all overflow-hidden"
              style={getPreviewClipAStyle()}
            >
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=60"
                alt="Scene A"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 left-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-white font-mono">
                Clip 1
              </span>
            </div>

            {/* Clip B (Sample Mountains/City) */}
            <div
              className="absolute inset-0 flex items-center justify-center bg-[#065f46] transition-all overflow-hidden"
              style={getPreviewClipBStyle()}
            >
              <img
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=60"
                alt="Scene B"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 right-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-white font-mono">
                Clip 2
              </span>
            </div>

            {/* Flash Overlay FX */}
            {selectedType === 'flash' && previewProgress > 0.35 && previewProgress < 0.65 && (
              <div className="absolute inset-0 bg-white transition-opacity pointer-events-none z-20" />
            )}

            {/* Light Leak FX */}
            {selectedType === 'light-leak' && previewProgress > 0.2 && previewProgress < 0.8 && (
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/80 via-orange-400/90 to-transparent mix-blend-screen pointer-events-none z-20" />
            )}

            {/* Film Burn FX */}
            {selectedType === 'film-burn' && previewProgress > 0.2 && previewProgress < 0.8 && (
              <div className="absolute inset-0 bg-gradient-to-t from-rose-600/80 via-amber-400/80 to-transparent mix-blend-color-dodge pointer-events-none z-20" />
            )}

            {/* Transition Cut Indicator */}
            <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm border border-white/20 rounded px-1.5 py-0.5 text-[9px] text-cyan-300 font-mono flex items-center gap-1">
              <span>{selectedItem ? selectedItem.name : 'No Transition'}</span>
              <span>({duration.toFixed(1)}s)</span>
            </div>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-[#181818] overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-white text-black shadow-md'
                  : 'bg-[#242424] text-zinc-400 hover:text-white hover:bg-[#2e2e2e]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Transition Grid List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[36vh]">
          <div className="grid grid-cols-4 gap-2">
            {/* None Option */}
            <button
              onClick={() => setSelectedType('none')}
              className={`h-20 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                selectedType === 'none'
                  ? 'bg-rose-500/20 border-rose-400 text-white font-bold ring-2 ring-rose-400/50 shadow-lg'
                  : 'bg-[#1c1c1c] border-white/5 text-zinc-400 hover:bg-[#252525]'
              }`}
              id="transition-option-none"
            >
              <span className="text-xl">🚫</span>
              <span className="text-[11px] font-medium">None</span>
            </button>

            {filteredTransitions.map((t) => {
              const isSelected = selectedType === t.type;
              return (
                <button
                  key={t.type}
                  onClick={() => setSelectedType(t.type)}
                  className={`h-20 rounded-xl border flex flex-col items-center justify-center p-1.5 gap-1 transition-all relative active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white font-bold ring-2 ring-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                      : 'bg-[#1e1e1e] border-white/5 text-zinc-300 hover:bg-[#282828]'
                  }`}
                  id={`transition-option-${t.type}`}
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  <span className="text-[10.5px] text-center leading-tight truncate max-w-full">
                    {t.name}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 text-black flex items-center justify-center text-[8px] font-black">
                      ✓
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Transition Customization Drawer (Duration & Sound) */}
          {selectedType !== 'none' && (
            <div className="bg-[#1c1c1c] p-3 rounded-xl border border-white/10 space-y-3">
              {/* Duration Slider & Quick Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Transition Duration</span>
                  <span className="text-cyan-400 font-mono font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                    {duration.toFixed(1)}s
                  </span>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max="2.5"
                  step="0.1"
                  value={duration}
                  onChange={(e) => setDuration(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />

                {/* Quick Duration Pills */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[0.2, 0.4, 0.6, 0.8, 1.0, 1.5].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-1 rounded-md text-[10px] font-mono font-semibold transition-all ${
                        Math.abs(duration - d) < 0.05
                          ? 'bg-cyan-400 text-black shadow-sm'
                          : 'bg-[#282828] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {d.toFixed(1)}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound Effect Selector */}
              <div className="space-y-1 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    Transition Sound FX
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { id: 'swoosh', label: 'Whoosh' },
                    { id: 'glitch-hit', label: 'Glitch' },
                    { id: 'riser', label: 'Braam' },
                    { id: 'none', label: 'Mute' },
                  ].map((sfx) => (
                    <button
                      key={sfx.id}
                      onClick={() => setSoundEffect(sfx.id)}
                      className={`py-1 px-1 rounded-lg text-[10px] font-medium transition-all ${
                        soundEffect === sfx.id
                          ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold'
                          : 'bg-[#282828] border border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      {sfx.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply to All Transitions Toggle */}
              <div className="pt-2 border-t border-white/10">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-cyan-400" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Apply to all clips</span>
                      <span className="text-[10px] text-zinc-400">
                        Applies {selectedItem?.name} to all cut points
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={applyToAll}
                    onChange={(e) => setApplyToAll(e.target.checked)}
                    className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                    id="apply-to-all-transitions-toggle"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          {currentTransition && (
            <button
              onClick={handleRemove}
              className="py-2.5 px-3 rounded-xl bg-[#242424] hover:bg-rose-950/40 border border-white/10 hover:border-rose-500/40 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1 active:scale-95 transition-all"
            >
              Remove
            </button>
          )}

          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all"
            id="apply-transition-confirm-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {applyToAll ? 'Apply to All Cuts' : 'Apply Transition'}
          </button>
        </div>
      </div>
    </div>
  );
};
