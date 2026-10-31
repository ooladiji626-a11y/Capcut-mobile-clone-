import React, { useState } from 'react';
import {
  X,
  Check,
  Scissors,
  Sparkles,
  Pipette,
  Layers,
  Palette,
  Sliders,
  Eye,
  RefreshCw,
  Zap,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { VideoClip } from '../../types';

interface ChromaKeyCutoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClip: VideoClip | null;
  onUpdateClipCutout: (
    clipId: string,
    chromaKey?: VideoClip['chromaKey'],
    cutout?: VideoClip['cutout']
  ) => void;
}

const PRESET_KEY_COLORS = [
  { id: '#00ff00', label: 'Classic Green Screen', colorClass: 'bg-[#00ff00]' },
  { id: '#0000ff', label: 'Classic Blue Screen', colorClass: 'bg-[#0000ff]' },
  { id: '#ff00ff', label: 'Magenta Screen', colorClass: 'bg-[#ff00ff]' },
  { id: '#00ffff', label: 'Cyan / Light Blue', colorClass: 'bg-[#00ffff]' },
  { id: '#000000', label: 'Black Luma Key', colorClass: 'bg-black border border-white/20' },
  { id: '#ffffff', label: 'White Luma Key', colorClass: 'bg-white' },
];

const BACKDROP_PRESETS: {
  id: NonNullable<NonNullable<VideoClip['cutout']>['backdrop']>;
  name: string;
  preview: string;
  gradient?: string;
  type: 'color' | 'image' | 'gradient';
}[] = [
  {
    id: 'transparent',
    name: 'Transparent PNG / Alpha',
    preview: '🏁',
    gradient: 'bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:8px_8px] bg-zinc-900',
    type: 'color',
  },
  {
    id: 'blur',
    name: 'Blurred Video Echo',
    preview: '🌫️',
    gradient: 'bg-gradient-to-tr from-cyan-900/60 via-indigo-900/60 to-purple-900/60 backdrop-blur-xl',
    type: 'color',
  },
  {
    id: 'cyberpunk-city',
    name: 'Cyberpunk Neon Alley',
    preview: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=600&auto=format&fit=crop&q=80',
    type: 'image',
  },
  {
    id: 'studio-gradient',
    name: 'Pro Studio Warm Glow',
    preview: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80',
    type: 'image',
  },
  {
    id: 'outer-space',
    name: 'Deep Nebula Galaxy',
    preview: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
    type: 'image',
  },
  {
    id: 'custom-color',
    name: 'Solid Color Screen',
    preview: '🎨',
    gradient: 'bg-gradient-to-r from-emerald-600 to-teal-700',
    type: 'color',
  },
];

const NEON_OUTLINE_PRESETS = [
  { label: 'None', color: 'transparent', width: 0 },
  { label: 'Neon Cyan', color: '#00f2fe', width: 4 },
  { label: 'Neon Rose', color: '#ff007f', width: 4 },
  { label: 'Golden Aura', color: '#ffd700', width: 4 },
  { label: 'Cyber Green', color: '#00ff88', width: 4 },
  { label: 'Ultra White', color: '#ffffff', width: 3 },
];

export const ChromaKeyCutoutModal: React.FC<ChromaKeyCutoutModalProps> = ({
  isOpen,
  onClose,
  selectedClip,
  onUpdateClipCutout,
}) => {
  const [activeTab, setActiveTab] = useState<'auto-cutout' | 'chroma-key' | 'backdrop'>('auto-cutout');

  // Auto Cutout Mode
  const [isCutoutEnabled, setIsCutoutEnabled] = useState<boolean>(
    selectedClip?.cutout?.enabled || false
  );
  const [selectedBackdrop, setSelectedBackdrop] = useState<NonNullable<NonNullable<VideoClip['cutout']>['backdrop']>>(
    selectedClip?.cutout?.backdrop || 'cyberpunk-city'
  );
  const [customBackdropColor, setCustomBackdropColor] = useState<string>(
    selectedClip?.cutout?.backdropColor || '#1e1b4b'
  );
  const [strokeColor, setStrokeColor] = useState<string>(
    selectedClip?.cutout?.strokeColor || 'transparent'
  );
  const [strokeWidth, setStrokeWidth] = useState<number>(
    selectedClip?.cutout?.strokeWidth || 0
  );

  // Chroma Key State
  const [isChromaEnabled, setIsChromaEnabled] = useState<boolean>(
    selectedClip?.chromaKey?.enabled || false
  );
  const [chromaColor, setChromaColor] = useState<string>(
    selectedClip?.chromaKey?.color || '#00ff00'
  );
  const [intensity, setIntensity] = useState<number>(
    selectedClip?.chromaKey?.intensity ?? 50
  );
  const [shadow, setShadow] = useState<number>(
    selectedClip?.chromaKey?.shadow ?? 30
  );
  const [feather, setFeather] = useState<number>(
    selectedClip?.chromaKey?.feather ?? 20
  );

  // AI Processing Simulation
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [processedClipId, setProcessedClipId] = useState<string | null>(null);

  if (!isOpen || !selectedClip) return null;

  const handleApply = () => {
    onUpdateClipCutout(
      selectedClip.id,
      {
        enabled: isChromaEnabled,
        color: chromaColor,
        intensity,
        shadow,
        feather,
      },
      {
        enabled: isCutoutEnabled,
        mode: activeTab === 'chroma-key' ? 'chroma-key' : 'auto-cutout',
        strokeColor,
        strokeWidth,
        backdrop: selectedBackdrop,
        backdropColor: customBackdropColor,
      }
    );
    onClose();
  };

  const handleTriggerAutoCutout = () => {
    setIsProcessingAI(true);
    setTimeout(() => {
      setIsProcessingAI(false);
      setIsCutoutEnabled(true);
      setProcessedClipId(selectedClip.id);
    }, 700);
  };

  const handleReset = () => {
    setIsCutoutEnabled(false);
    setIsChromaEnabled(false);
    setStrokeColor('transparent');
    setStrokeWidth(0);
    setSelectedBackdrop('transparent');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
              <Scissors className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                Cutout, Chroma Key & Backdrops
                <span className="bg-teal-500/30 border border-teal-400 text-teal-300 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  AI MATTING
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[260px]">
                Target: <span className="text-teal-300 font-bold">{selectedClip.title}</span>
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
            onClick={() => setActiveTab('auto-cutout')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'auto-cutout'
                ? 'text-teal-300 border-b-2 border-teal-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto Cutout
          </button>
          <button
            onClick={() => setActiveTab('chroma-key')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'chroma-key'
                ? 'text-teal-300 border-b-2 border-teal-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Pipette className="w-3.5 h-3.5" />
            Chroma Key
          </button>
          <button
            onClick={() => setActiveTab('backdrop')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'backdrop'
                ? 'text-teal-300 border-b-2 border-teal-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Backdrop & Glow
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh]">
          {/* TAB 1: SMART AUTO-CUTOUT (AI PORTRAIT MATTING) */}
          {activeTab === 'auto-cutout' && (
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                    AI Subject Cutout (No Green Screen)
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Automatically segment human subjects and foreground objects
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (!isCutoutEnabled) {
                      handleTriggerAutoCutout();
                    } else {
                      setIsCutoutEnabled(false);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                    isCutoutEnabled
                      ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/20'
                      : 'bg-[#282828] text-zinc-300 hover:bg-[#333] border border-white/10'
                  }`}
                >
                  {isProcessingAI ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...
                    </>
                  ) : isCutoutEnabled ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Enabled
                    </>
                  ) : (
                    'Enable Cutout'
                  )}
                </button>
              </div>

              {/* Quick Preset Neon Outlines / Contours */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Neon Stroke & Outline Contour
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {NEON_OUTLINE_PRESETS.map((preset) => {
                    const isSelected = strokeColor === preset.color;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setStrokeColor(preset.color);
                          setStrokeWidth(preset.width);
                          if (!isCutoutEnabled) setIsCutoutEnabled(true);
                        }}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 text-white font-bold'
                            : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{
                            backgroundColor:
                              preset.color === 'transparent' ? '#333' : preset.color,
                          }}
                        />
                        <span className="text-[11px] truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stroke Width Slider if stroke active */}
              {strokeColor !== 'transparent' && (
                <div className="space-y-1 bg-[#181818] p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Outline Thickness</span>
                    <span className="font-mono text-teal-400 font-bold">{strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="16"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHROMA KEY (GREEN / BLUE SCREEN REMOVER) */}
          {activeTab === 'chroma-key' && (
            <div className="space-y-4">
              <div className="bg-[#1a1a1a] p-3.5 rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Pipette className="w-3.5 h-3.5 text-teal-400" />
                    Chroma Key Color Removal
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Key out green, blue, or custom background colors
                  </p>
                </div>
                <button
                  onClick={() => setIsChromaEnabled(!isChromaEnabled)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                    isChromaEnabled
                      ? 'bg-teal-500 text-black shadow-lg shadow-teal-500/20'
                      : 'bg-[#282828] text-zinc-300 hover:bg-[#333] border border-white/10'
                  }`}
                >
                  {isChromaEnabled ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Active
                    </>
                  ) : (
                    'Enable Chroma'
                  )}
                </button>
              </div>

              {/* Color Picker Grid */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300 font-semibold">Key Color Target</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_KEY_COLORS.map((preset) => {
                    const isSelected = chromaColor.toLowerCase() === preset.id.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setChromaColor(preset.id);
                          setIsChromaEnabled(true);
                        }}
                        className={`p-2 rounded-xl border flex items-center gap-2 transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 text-white font-bold'
                            : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full ${preset.colorClass} shrink-0`} />
                        <span className="text-[10px] truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders: Intensity & Shadow Tolerance & Softness */}
              <div className="space-y-3 bg-[#1a1a1a] p-3 rounded-2xl border border-white/10">
                {/* Intensity / Tolerance */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Intensity (Tolerance)</span>
                    <span className="font-mono text-teal-400 font-bold">{intensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

                {/* Shadow / Spill Suppression */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Shadow / Spill Suppression</span>
                    <span className="font-mono text-teal-400 font-bold">{shadow}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={shadow}
                    onChange={(e) => setShadow(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>

                {/* Edge Softness / Feather */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Edge Softness (Feather)</span>
                    <span className="font-mono text-teal-400 font-bold">{feather}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={feather}
                    onChange={(e) => setFeather(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKDROP REPLACEMENT */}
          {activeTab === 'backdrop' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Choose a high-definition replacement background behind your cutout subject:
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {BACKDROP_PRESETS.map((bg) => {
                  const isSelected = selectedBackdrop === bg.id;
                  return (
                    <button
                      key={bg.id}
                      onClick={() => {
                        setSelectedBackdrop(bg.id);
                        if (!isCutoutEnabled && !isChromaEnabled) {
                          setIsCutoutEnabled(true);
                        }
                      }}
                      className={`p-2 rounded-2xl border text-left flex flex-col gap-1.5 transition-all active:scale-95 relative overflow-hidden ${
                        isSelected
                          ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 text-white font-bold'
                          : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#242424]'
                      }`}
                    >
                      <div className="h-16 w-full rounded-xl overflow-hidden relative border border-white/10">
                        {bg.type === 'image' && bg.preview && bg.preview.trim() !== '' ? (
                          <img
                            src={bg.preview}
                            alt={bg.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center text-xl ${
                              bg.gradient || 'bg-zinc-800'
                            }`}
                          >
                            <span>{bg.preview}</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-teal-500 text-black p-0.5 rounded-full">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs font-bold truncate">{bg.name}</span>
                    </button>
                  );
                })}
              </div>

              {selectedBackdrop === 'custom-color' && (
                <div className="bg-[#181818] p-3 rounded-xl border border-white/10 flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-semibold">Custom Color Screen</span>
                  <input
                    type="color"
                    value={customBackdropColor}
                    onChange={(e) => setCustomBackdropColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                </div>
              )}
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
            className="flex-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            id="apply-cutout-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Apply Cutout & Chroma
          </button>
        </div>
      </div>
    </div>
  );
};
