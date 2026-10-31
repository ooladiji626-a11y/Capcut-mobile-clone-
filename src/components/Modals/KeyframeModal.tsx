import React, { useState } from 'react';
import { Keyframe } from '../../types';
import { X, Sparkles, Move, RotateCw, Eye, ZoomIn, Check } from 'lucide-react';

interface KeyframeModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTitle: string;
  currentKeyframe: Keyframe | null;
  onSaveKeyframe: (kf: Partial<Keyframe>) => void;
  onApplyPreset: (presetName: string) => void;
}

export const KeyframeModal: React.FC<KeyframeModalProps> = ({
  isOpen,
  onClose,
  targetTitle,
  currentKeyframe,
  onSaveKeyframe,
  onApplyPreset,
}) => {
  const [scale, setScale] = useState(currentKeyframe?.scale ?? 1.0);
  const [x, setX] = useState(currentKeyframe?.x ?? 0);
  const [y, setY] = useState(currentKeyframe?.y ?? 0);
  const [rotation, setRotation] = useState(currentKeyframe?.rotation ?? 0);
  const [opacity, setOpacity] = useState(currentKeyframe?.opacity ?? 1.0);

  if (!isOpen) return null;

  const handleApply = () => {
    onSaveKeyframe({
      scale,
      x,
      y,
      rotation,
      opacity,
    });
    onClose();
  };

  const PRESETS = [
    { id: 'ken-burns-in', name: 'Ken Burns In', desc: 'Slow zoom into subject (+35%)' },
    { id: 'ken-burns-out', name: 'Zoom Out Reveal', desc: 'Wide establishing reveal (-25%)' },
    { id: 'pan-horizontal', name: 'Documentary Pan', desc: 'Smooth horizontal scan across map' },
    { id: 'dramatic-tilt', name: 'Cinematic Dutch Tilt', desc: 'Subtle 3° dynamic rotation' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#181818] border border-white/10 rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl pb-6 max-h-[85vh] flex flex-col"
        id="keyframe-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#202020]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
              ◆
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white leading-none">CapCut Keyframe Engine</h2>
              <span className="text-[11px] text-zinc-400 truncate max-w-[200px] block mt-0.5">
                {targetTitle}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Sliders */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Quick Presets */}
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Motion Presets
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onApplyPreset(p.id);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-[#222] hover:bg-[#2c2c2c] border border-white/5 text-left active:scale-95 transition-all group"
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white group-hover:text-cyan-400">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{p.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5 leading-tight">
                    {p.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-3.5">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
              Transform Values
            </span>

            {/* Scale / Zoom */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-3.5 h-3.5 text-cyan-400" /> Zoom Scale
                </span>
                <span className="font-mono text-cyan-400">{scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Pan X */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-emerald-400" /> Pan X (Horizontal)
                </span>
                <span className="font-mono text-emerald-400">{x > 0 ? `+${x}%` : `${x}%`}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={x}
                onChange={(e) => setX(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Pan Y */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-emerald-400" /> Pan Y (Vertical)
                </span>
                <span className="font-mono text-emerald-400">{y > 0 ? `+${y}%` : `${y}%`}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={y}
                onChange={(e) => setY(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            {/* Rotation */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <RotateCw className="w-3.5 h-3.5 text-amber-400" /> Rotation
                </span>
                <span className="font-mono text-amber-400">{rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotation}
                onChange={(e) => setRotation(parseInt(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Opacity */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-purple-400" /> Opacity
                </span>
                <span className="font-mono text-purple-400">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 pt-2 flex items-center gap-3">
          <button
            onClick={() => {
              setScale(1.0);
              setX(0);
              setY(0);
              setRotation(0);
              setOpacity(1.0);
            }}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Set Keyframe Point
          </button>
        </div>
      </div>
    </div>
  );
};
