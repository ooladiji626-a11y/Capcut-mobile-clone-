import React, { useState } from 'react';
import {
  X,
  Check,
  Layers,
  Sparkles,
  Circle,
  Square,
  Heart,
  Star,
  Columns,
  Rows,
  Sliders,
  RotateCw,
  Move,
  Maximize2,
  FlipHorizontal,
  Eye,
  Minimize2,
  Grid,
} from 'lucide-react';
import {
  BlendMode,
  ShapeMaskType,
  ShapeMaskConfig,
  OverlayClip,
  VideoClip,
} from '../../types';

interface PIPBlendMaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetItem: {
    id: string;
    title: string;
    thumbnailUrl: string;
    opacity?: number;
    blendMode?: BlendMode;
    mask?: ShapeMaskConfig;
    transform?: {
      x: number;
      y: number;
      scale: number;
      rotation: number;
    };
  } | null;
  targetType: 'overlay' | 'clip';
  onUpdateSettings: (
    id: string,
    settings: {
      opacity?: number;
      blendMode?: BlendMode;
      mask?: ShapeMaskConfig;
      transform?: {
        x: number;
        y: number;
        scale: number;
        rotation: number;
      };
    }
  ) => void;
}

const BLEND_MODES: {
  id: BlendMode;
  name: string;
  category: string;
  description: string;
}[] = [
  { id: 'normal', name: 'Normal', category: 'Standard', description: 'Default opaque rendering' },
  { id: 'screen', name: 'Screen', category: 'Lighten', description: 'Removes black backgrounds, ideal for fire/sparks' },
  { id: 'lighten', name: 'Lighten', category: 'Lighten', description: 'Selects the lighter pixel colors' },
  { id: 'color-dodge', name: 'Color Dodge', category: 'Lighten', description: 'Brightens and saturates highlights intensely' },
  { id: 'multiply', name: 'Multiply', category: 'Darken', description: 'Removes white backgrounds, darkens shadows' },
  { id: 'darken', name: 'Darken', category: 'Darken', description: 'Selects the darker pixel colors' },
  { id: 'overlay', name: 'Overlay', category: 'Contrast', description: 'Boosts midtone contrast with underlying video' },
  { id: 'soft-light', name: 'Soft Light', category: 'Contrast', description: 'Subtle cinematic diffused contrast glow' },
  { id: 'difference', name: 'Difference', category: 'Inversion', description: 'Inverts colors based on luminance differences' },
  { id: 'exclusion', name: 'Exclusion', category: 'Inversion', description: 'Milder psychedelic color inversion' },
];

const SHAPE_MASKS: {
  id: ShapeMaskType;
  name: string;
  icon: React.ReactNode;
}[] = [
  { id: 'none', name: 'No Mask', icon: <Minimize2 className="w-4 h-4" /> },
  { id: 'circle', name: 'Circle', icon: <Circle className="w-4 h-4" /> },
  { id: 'rectangle', name: 'Rectangle', icon: <Square className="w-4 h-4" /> },
  { id: 'heart', name: 'Heart', icon: <Heart className="w-4 h-4" /> },
  { id: 'star', name: 'Star', icon: <Star className="w-4 h-4" /> },
  { id: 'split-horizontal', name: 'Split (H)', icon: <Columns className="w-4 h-4" /> },
  { id: 'split-vertical', name: 'Split (V)', icon: <Rows className="w-4 h-4" /> },
  { id: 'filmstrip', name: 'Film Strip', icon: <Grid className="w-4 h-4" /> },
  { id: 'linear-wipe', name: 'Linear Wipe', icon: <Layers className="w-4 h-4" /> },
];

const PIP_LAYOUT_PRESETS = [
  {
    name: 'Top-Right PIP',
    transform: { x: 28, y: -28, scale: 0.38, rotation: 0 },
    mask: { type: 'circle' as ShapeMaskType, size: 90, feather: 5, roundness: 50, rotation: 0, inverted: false },
  },
  {
    name: 'Top-Left Corner',
    transform: { x: -28, y: -28, scale: 0.38, rotation: 0 },
    mask: { type: 'rectangle' as ShapeMaskType, size: 95, feather: 8, roundness: 25, rotation: 0, inverted: false },
  },
  {
    name: 'Bottom Reaction Cam',
    transform: { x: 26, y: 26, scale: 0.42, rotation: 0 },
    mask: { type: 'circle' as ShapeMaskType, size: 90, feather: 8, roundness: 50, rotation: 0, inverted: false },
  },
  {
    name: 'Split Screen Left',
    transform: { x: -25, y: 0, scale: 1, rotation: 0 },
    mask: { type: 'split-horizontal' as ShapeMaskType, size: 50, feather: 0, roundness: 0, rotation: 0, inverted: false },
  },
  {
    name: 'Center Hero Focus',
    transform: { x: 0, y: 0, scale: 0.8, rotation: 0 },
    mask: { type: 'circle' as ShapeMaskType, size: 80, feather: 25, roundness: 50, rotation: 0, inverted: false },
  },
  {
    name: 'Full Reset',
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    mask: { type: 'none' as ShapeMaskType, size: 100, feather: 0, roundness: 0, rotation: 0, inverted: false },
  },
];

export const PIPBlendMaskModal: React.FC<PIPBlendMaskModalProps> = ({
  isOpen,
  onClose,
  targetItem,
  targetType,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'blend' | 'mask' | 'pip'>('blend');

  // Blend & Opacity State
  const [blendMode, setBlendMode] = useState<BlendMode>(
    targetItem?.blendMode || 'normal'
  );
  const [opacity, setOpacity] = useState<number>(
    targetItem?.opacity ?? 1
  );

  // Mask State
  const [maskType, setMaskType] = useState<ShapeMaskType>(
    targetItem?.mask?.type || 'none'
  );
  const [maskSize, setMaskSize] = useState<number>(
    targetItem?.mask?.size ?? 80
  );
  const [maskFeather, setMaskFeather] = useState<number>(
    targetItem?.mask?.feather ?? 10
  );
  const [maskRoundness, setMaskRoundness] = useState<number>(
    targetItem?.mask?.roundness ?? 20
  );
  const [maskRotation, setMaskRotation] = useState<number>(
    targetItem?.mask?.rotation ?? 0
  );
  const [maskInverted, setMaskInverted] = useState<boolean>(
    targetItem?.mask?.inverted ?? false
  );

  // PIP Transform State
  const [transformX, setTransformX] = useState<number>(
    targetItem?.transform?.x ?? 0
  );
  const [transformY, setTransformY] = useState<number>(
    targetItem?.transform?.y ?? 0
  );
  const [transformScale, setTransformScale] = useState<number>(
    targetItem?.transform?.scale ?? 1
  );
  const [transformRotation, setTransformRotation] = useState<number>(
    targetItem?.transform?.rotation ?? 0
  );

  if (!isOpen || !targetItem) return null;

  const handleApply = () => {
    onUpdateSettings(targetItem.id, {
      blendMode,
      opacity,
      mask: {
        type: maskType,
        size: maskSize,
        feather: maskFeather,
        roundness: maskRoundness,
        rotation: maskRotation,
        inverted: maskInverted,
      },
      transform: {
        x: transformX,
        y: transformY,
        scale: transformScale,
        rotation: transformRotation,
      },
    });
    onClose();
  };

  const applyPreset = (preset: typeof PIP_LAYOUT_PRESETS[0]) => {
    setTransformX(preset.transform.x);
    setTransformY(preset.transform.y);
    setTransformScale(preset.transform.scale);
    setTransformRotation(preset.transform.rotation);
    if (preset.mask) {
      setMaskType(preset.mask.type);
      setMaskSize(preset.mask.size);
      setMaskFeather(preset.mask.feather);
      setMaskRoundness(preset.mask.roundness);
    }
  };

  const handleReset = () => {
    setBlendMode('normal');
    setOpacity(1);
    setMaskType('none');
    setMaskSize(80);
    setMaskFeather(10);
    setMaskRoundness(20);
    setMaskRotation(0);
    setMaskInverted(false);
    setTransformX(0);
    setTransformY(0);
    setTransformScale(1);
    setTransformRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                PIP Layering, Blend & Mask
                <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  MULTI-TRACK
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[260px]">
                Target: <span className="text-emerald-300 font-bold">{targetItem.title}</span>
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

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-[#181818]">
          <button
            onClick={() => setActiveTab('blend')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'blend'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Blend Modes
          </button>
          <button
            onClick={() => setActiveTab('mask')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'mask'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
            Shape Masks
          </button>
          <button
            onClick={() => setActiveTab('pip')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'pip'
                ? 'text-emerald-300 border-b-2 border-emerald-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            PIP & Position
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh]">
          {/* TAB 1: BLEND MODES */}
          {activeTab === 'blend' && (
            <div className="space-y-4">
              {/* Opacity Slider */}
              <div className="bg-[#1a1a1a] p-3 rounded-2xl border border-white/10 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span className="font-semibold">Layer Opacity</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              {/* Blend Modes Grid */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold">
                  Select Visual Blend Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BLEND_MODES.map((mode) => {
                    const isSelected = blendMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => setBlendMode(mode.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 text-white font-bold'
                            : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{mode.name}</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-white/10 text-zinc-400">
                            {mode.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 line-clamp-2 leading-tight">
                          {mode.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SHAPE MASKS */}
          {activeTab === 'mask' && (
            <div className="space-y-4">
              {/* Shape Selector */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold">Mask Shape</label>
                <div className="grid grid-cols-3 gap-2">
                  {SHAPE_MASKS.map((mask) => {
                    const isSelected = maskType === mask.id;
                    return (
                      <button
                        key={mask.id}
                        onClick={() => setMaskType(mask.id)}
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/40 text-white font-bold'
                            : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                        }`}
                      >
                        <div className="p-1 rounded-lg bg-white/5">{mask.icon}</div>
                        <span className="text-[10px]">{mask.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mask Controls if not None */}
              {maskType !== 'none' && (
                <div className="bg-[#1a1a1a] p-3.5 rounded-2xl border border-white/10 space-y-3">
                  {/* Mask Scale / Size */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Mask Scale / Size</span>
                      <span className="font-mono text-emerald-400 font-bold">{maskSize}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="140"
                      value={maskSize}
                      onChange={(e) => setMaskSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>

                  {/* Feather / Edge Softness */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-300">
                      <span>Feather / Edge Softness</span>
                      <span className="font-mono text-emerald-400 font-bold">{maskFeather}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={maskFeather}
                      onChange={(e) => setMaskFeather(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                    />
                  </div>

                  {/* Corner Roundness (if rect or star) */}
                  {(maskType === 'rectangle' || maskType === 'filmstrip') && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-300">
                        <span>Corner Radius</span>
                        <span className="font-mono text-emerald-400 font-bold">{maskRoundness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={maskRoundness}
                        onChange={(e) => setMaskRoundness(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                    </div>
                  )}

                  {/* Invert Mask Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-xs text-zinc-300 font-medium">Invert Mask (Cutout Hole)</span>
                    <button
                      onClick={() => setMaskInverted(!maskInverted)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        maskInverted
                          ? 'bg-emerald-500 text-black'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {maskInverted ? 'Inverted' : 'Standard'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PIP POSITION & PRESETS */}
          {activeTab === 'pip' && (
            <div className="space-y-4">
              {/* Quick Layout Presets */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold">Quick PIP Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  {PIP_LAYOUT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className="p-2 rounded-xl bg-[#1a1a1a] border border-white/5 hover:border-emerald-400/40 text-left flex flex-col gap-1 transition-all active:scale-95"
                    >
                      <span className="text-[11px] font-bold text-white truncate">
                        {preset.name}
                      </span>
                      <span className="text-[9px] text-zinc-400">
                        {Math.round(preset.transform.scale * 100)}% scale
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Transform Sliders */}
              <div className="bg-[#1a1a1a] p-3.5 rounded-2xl border border-white/10 space-y-3">
                {/* Scale */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Scale / Size</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      {Math.round(transformScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.0"
                    step="0.05"
                    value={transformScale}
                    onChange={(e) => setTransformScale(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Pan X */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Horizontal Position (X)</span>
                    <span className="font-mono text-emerald-400 font-bold">{transformX}%</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={transformX}
                    onChange={(e) => setTransformX(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Pan Y */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Vertical Position (Y)</span>
                    <span className="font-mono text-emerald-400 font-bold">{transformY}%</span>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={transformY}
                    onChange={(e) => setTransformY(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>

                {/* Rotation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Rotation</span>
                    <span className="font-mono text-emerald-400 font-bold">{transformRotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={transformRotation}
                    onChange={(e) => setTransformRotation(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={handleReset}
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
            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            id="apply-pip-blend-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Apply Blend & Mask
          </button>
        </div>
      </div>
    </div>
  );
};
