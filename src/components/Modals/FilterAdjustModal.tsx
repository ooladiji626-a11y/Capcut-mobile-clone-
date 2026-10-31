import React, { useState } from 'react';
import { ColorAdjustments, FilterPreset, VideoClip } from '../../types';
import {
  X,
  Check,
  Sliders,
  Sparkles,
  Sun,
  Contrast,
  Palette,
  Thermometer,
  Wand2,
  RotateCcw,
  CheckCheck,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface FilterAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClip?: VideoClip;
  onSaveAdjustments: (
    adjustments: ColorAdjustments,
    filterPreset: FilterPreset,
    chromaKey?: { enabled: boolean; color: string; intensity: number; shadow: number },
    backgroundBlur?: number,
    applyToAll?: boolean
  ) => void;
}

const LUT_PRESETS: { id: FilterPreset; name: string; category: string; icon: string; previewColor: string; description: string }[] = [
  {
    id: 'none',
    name: 'Original',
    category: 'Basic',
    icon: '⚪',
    previewColor: '#555',
    description: 'Natural unaltered source color',
  },
  {
    id: 'oppenheimer',
    name: 'Oppenheimer',
    category: 'Cinematic',
    icon: '🎬',
    previewColor: '#b45309',
    description: 'High-contrast warm amber film stock',
  },
  {
    id: 'cinematic-teal',
    name: 'Teal & Orange',
    category: 'Cinematic',
    icon: '🌊',
    previewColor: '#0e7490',
    description: 'Hollywood blockbuster dual-tone contrast',
  },
  {
    id: 'kodak-vintage',
    name: 'Kodak 35mm',
    category: 'Vintage',
    icon: '🎞️',
    previewColor: '#c2410c',
    description: '1970s analog film emulsion with warm shadows',
  },
  {
    id: 'dark-noir',
    name: 'Documentary Noir',
    category: 'B&W',
    icon: '🌑',
    previewColor: '#27272a',
    description: 'Deep shadows and crisp monochrome silver',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    category: 'Warm',
    icon: '🌅',
    previewColor: '#d97706',
    description: 'Sunset warm backlight flare and soft highlights',
  },
  {
    id: 'bleach-bypass',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    icon: '⚔️',
    previewColor: '#71717a',
    description: 'Desaturated gritty war & mystery thriller look',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    category: 'Stylized',
    icon: '👾',
    previewColor: '#9333ea',
    description: 'Vibrant neon purple and electric cyan boost',
  },
  {
    id: 'forest-mood',
    name: 'Nordic Mood',
    category: 'Cool',
    icon: '🌲',
    previewColor: '#065f46',
    description: 'Moody desaturated cold green forest aesthetic',
  },
  {
    id: 'vhs-retro',
    name: 'VHS Retro 90s',
    category: 'Vintage',
    icon: '📼',
    previewColor: '#be185d',
    description: 'Analog tape saturation with chromatic tint',
  },
];

const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  vignette: 0,
  sharpen: 0,
  grain: 0,
};

export const FilterAdjustModal: React.FC<FilterAdjustModalProps> = ({
  isOpen,
  onClose,
  targetClip,
  onSaveAdjustments,
}) => {
  const [activeTab, setActiveTab] = useState<'filters' | 'adjust' | 'cutout'>('filters');
  const [selectedFilter, setSelectedFilter] = useState<FilterPreset>(
    targetClip?.filterPreset || 'none'
  );
  const [adjustments, setAdjustments] = useState<ColorAdjustments>(
    targetClip?.adjustments || DEFAULT_ADJUSTMENTS
  );
  const [chromaKeyEnabled, setChromaKeyEnabled] = useState<boolean>(
    targetClip?.chromaKey?.enabled || false
  );
  const [chromaColor, setChromaColor] = useState<string>(
    targetClip?.chromaKey?.color || '#00FF00'
  );
  const [chromaIntensity, setChromaIntensity] = useState<number>(
    targetClip?.chromaKey?.intensity || 50
  );
  const [chromaShadow, setChromaShadow] = useState<number>(
    targetClip?.chromaKey?.shadow || 30
  );
  const [bgBlur, setBgBlur] = useState<number>(targetClip?.backgroundBlur || 0);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSliderChange = (key: keyof ColorAdjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetAdjustments = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setSelectedFilter('none');
    setChromaKeyEnabled(false);
    setBgBlur(0);
  };

  const handleSave = () => {
    onSaveAdjustments(
      adjustments,
      selectedFilter,
      {
        enabled: chromaKeyEnabled,
        color: chromaColor,
        intensity: chromaIntensity,
        shadow: chromaShadow,
      },
      bgBlur,
      applyToAll
    );
    onClose();
  };

  // Helper CSS filter string preview for current settings
  const computeCSSFilter = () => {
    let b = 100 + adjustments.brightness;
    let c = 100 + adjustments.contrast;
    let s = 100 + adjustments.saturation;
    let sepia = 0;
    let hue = 0;
    let invert = 0;

    if (selectedFilter === 'oppenheimer') {
      b += 5;
      c += 20;
      s += 15;
      sepia += 25;
    } else if (selectedFilter === 'cinematic-teal') {
      c += 25;
      hue += 15;
      s += 20;
    } else if (selectedFilter === 'kodak-vintage') {
      c += 10;
      s -= 10;
      sepia += 35;
    } else if (selectedFilter === 'dark-noir') {
      s = 0;
      c += 35;
      b -= 5;
    } else if (selectedFilter === 'golden-hour') {
      b += 10;
      s += 25;
      sepia += 30;
    } else if (selectedFilter === 'bleach-bypass') {
      c += 40;
      s -= 50;
    } else if (selectedFilter === 'cyberpunk') {
      c += 30;
      s += 60;
      hue -= 20;
    } else if (selectedFilter === 'forest-mood') {
      s -= 20;
      c += 15;
      hue += 10;
    } else if (selectedFilter === 'vhs-retro') {
      c += 20;
      s += 40;
      hue += 30;
    }

    // Temperature & Tint
    if (adjustments.temperature > 0) sepia += adjustments.temperature * 0.4;
    if (adjustments.tint !== 0) hue += adjustments.tint * 0.5;

    return `brightness(${Math.max(10, b)}%) contrast(${Math.max(10, c)}%) saturate(${Math.max(0, s)}%) sepia(${Math.min(100, sepia)}%) hue-rotate(${hue}deg)`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Color Grade & Filters
              </h2>
              {targetClip && (
                <p className="text-[10px] text-zinc-400 truncate max-w-[260px]">
                  Applying to <span className="text-amber-300 font-semibold">{targetClip.title}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetAdjustments}
              className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 text-xs flex items-center gap-1 transition-all"
              title="Reset all color settings"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Mini Preview Box */}
        <div className="p-3 bg-[#0c0c0c] border-b border-white/10 flex flex-col items-center justify-center relative">
          <div className="relative w-48 h-28 rounded-lg overflow-hidden bg-black border border-white/15 shadow-inner flex items-center justify-center">
            <img
              src={
                (targetClip?.thumbnailUrl && targetClip.thumbnailUrl.trim() !== '')
                  ? targetClip.thumbnailUrl
                  : 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80'
              }
              alt="Preview"
              className="w-full h-full object-cover transition-all"
              style={{
                filter: computeCSSFilter(),
              }}
              referrerPolicy="no-referrer"
            />

            {/* Vignette Overlay Simulator */}
            {adjustments.vignette > 0 && (
              <div
                className="absolute inset-0 pointer-events-none rounded-lg"
                style={{
                  boxShadow: `inset 0 0 ${adjustments.vignette * 0.8}px rgba(0,0,0,${
                    adjustments.vignette / 100
                  })`,
                }}
              />
            )}

            {/* Film Grain Simulator */}
            {adjustments.grain > 0 && (
              <div
                className="absolute inset-0 pointer-events-none bg-repeat opacity-25 mix-blend-overlay"
                style={{
                  backgroundImage: `radial-gradient(rgba(255,255,255,0.4) 1px, transparent 0)`,
                  backgroundSize: '4px 4px',
                }}
              />
            )}

            {/* Chroma Key Badge */}
            {chromaKeyEnabled && (
              <div className="absolute top-1.5 left-1.5 bg-emerald-500/90 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                CHROMA CUTOUT
              </div>
            )}

            <div className="absolute bottom-1 right-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-zinc-300 font-mono">
              {LUT_PRESETS.find((l) => l.id === selectedFilter)?.name || 'Original'}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#181818]">
          <button
            onClick={() => setActiveTab('filters')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'filters'
                ? 'text-amber-300 border-b-2 border-amber-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            LUT Filters
          </button>
          <button
            onClick={() => setActiveTab('adjust')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'adjust'
                ? 'text-amber-300 border-b-2 border-amber-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Adjustments
          </button>
          <button
            onClick={() => setActiveTab('cutout')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'cutout'
                ? 'text-amber-300 border-b-2 border-amber-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Smart Cutout
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[38vh]">
          {/* TAB 1: FILTERS / LUTS */}
          {activeTab === 'filters' && (
            <div className="grid grid-cols-3 gap-2.5">
              {LUT_PRESETS.map((lut) => {
                const isSelected = selectedFilter === lut.id;
                return (
                  <button
                    key={lut.id}
                    onClick={() => setSelectedFilter(lut.id)}
                    className={`h-22 rounded-xl border flex flex-col items-center justify-center p-2 gap-1 transition-all relative active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white font-bold ring-2 ring-amber-400/50 shadow-lg'
                        : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#252525]'
                    }`}
                  >
                    <span className="text-2xl">{lut.icon}</span>
                    <span className="text-[11px] font-medium truncate max-w-full">
                      {lut.name}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {lut.category}
                    </span>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[8px] font-black">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 2: MANUAL COLOR ADJUSTMENTS */}
          {activeTab === 'adjust' && (
            <div className="space-y-3.5">
              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.brightness}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.brightness}
                  onChange={(e) => handleSliderChange('brightness', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Contrast className="w-3.5 h-3.5 text-amber-400" /> Contrast
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.contrast}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.contrast}
                  onChange={(e) => handleSliderChange('contrast', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-400" /> Saturation
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.saturation}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation}
                  onChange={(e) => handleSliderChange('saturation', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" /> Temperature (Warm/Cool)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.temperature}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.temperature}
                  onChange={(e) => handleSliderChange('temperature', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Vignette */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Vignette Edge Falloff</span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.vignette}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adjustments.vignette}
                  onChange={(e) => handleSliderChange('vignette', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Film Grain */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Film Grain Texture</span>
                  <span className="font-mono text-amber-400 font-bold">{adjustments.grain}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adjustments.grain}
                  onChange={(e) => handleSliderChange('grain', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          )}

          {/* TAB 3: SMART CUTOUT & CHROMA KEY */}
          {activeTab === 'cutout' && (
            <div className="space-y-4">
              {/* Chroma Key Toggle */}
              <div className="bg-[#1c1c1c] p-3 rounded-xl border border-white/10 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Chroma Key Green Screen</span>
                    <span className="text-[10px] text-zinc-400">
                      Isolate subject and remove solid color backdrop
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={chromaKeyEnabled}
                    onChange={(e) => setChromaKeyEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
                  />
                </label>

                {chromaKeyEnabled && (
                  <div className="space-y-3 pt-2 border-t border-white/10 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Key Color</span>
                      <div className="flex items-center gap-2">
                        {['#00FF00', '#0000FF', '#000000', '#FFFFFF'].map((col) => (
                          <button
                            key={col}
                            onClick={() => setChromaColor(col)}
                            className={`w-6 h-6 rounded-full border transition-all ${
                              chromaColor === col ? 'ring-2 ring-white scale-110' : 'opacity-70'
                            }`}
                            style={{ backgroundColor: col }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Intensity</span>
                        <span className="font-mono text-emerald-400">{chromaIntensity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={chromaIntensity}
                        onChange={(e) => setChromaIntensity(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Background Blur */}
              <div className="bg-[#1c1c1c] p-3 rounded-xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Background Blur</span>
                  <span className="font-mono text-amber-400">{bgBlur}px</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: 'None', val: 0 },
                    { label: 'Subtle', val: 4 },
                    { label: 'Medium', val: 10 },
                    { label: 'Heavy', val: 20 },
                  ].map((b) => (
                    <button
                      key={b.val}
                      onClick={() => setBgBlur(b.val)}
                      className={`py-1 rounded-lg text-xs font-semibold transition-all ${
                        bgBlur === b.val
                          ? 'bg-amber-400 text-black shadow-sm'
                          : 'bg-[#252525] text-zinc-400 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Apply to All Clips Toggle */}
          <div className="pt-2 border-t border-white/10">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Apply to all clips</span>
                  <span className="text-[10px] text-zinc-400">
                    Apply this color grade across all project clips
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#242424] text-zinc-300 text-xs font-semibold hover:bg-[#2c2c2c] active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {applyToAll ? 'Apply to All Clips' : 'Save Adjustments'}
          </button>
        </div>
      </div>
    </div>
  );
};
