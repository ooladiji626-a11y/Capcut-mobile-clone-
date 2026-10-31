import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Check,
  Gauge,
  Activity,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  RotateCcw,
  Volume2,
  Flame,
  CheckCheck,
} from 'lucide-react';
import { SpeedSettings, SpeedCurvePreset, SpeedCurvePoint, VideoClip } from '../../types';

interface SpeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetClip?: VideoClip;
  currentSpeed: number;
  currentSpeedSettings?: SpeedSettings;
  onSaveSpeed: (speed: number, speedSettings?: SpeedSettings, applyToAll?: boolean) => void;
}

const PRESET_CURVES: Record<
  Exclude<SpeedCurvePreset, 'normal' | 'custom'>,
  { name: string; icon: string; points: SpeedCurvePoint[]; desc: string }
> = {
  montage: {
    name: 'Montage',
    icon: '⚡',
    desc: 'Dynamic pacing with punchy speed-ups & dramatic pauses',
    points: [
      { timeRatio: 0.0, speedMultiplier: 1.0 },
      { timeRatio: 0.2, speedMultiplier: 0.4 },
      { timeRatio: 0.45, speedMultiplier: 4.5 },
      { timeRatio: 0.7, speedMultiplier: 0.3 },
      { timeRatio: 1.0, speedMultiplier: 1.2 },
    ],
  },
  hero: {
    name: 'Hero',
    icon: '🦸',
    desc: 'Dramatic slow-motion freeze at peak impact',
    points: [
      { timeRatio: 0.0, speedMultiplier: 1.0 },
      { timeRatio: 0.25, speedMultiplier: 0.2 },
      { timeRatio: 0.5, speedMultiplier: 6.0 },
      { timeRatio: 0.75, speedMultiplier: 0.2 },
      { timeRatio: 1.0, speedMultiplier: 1.0 },
    ],
  },
  bullet: {
    name: 'Bullet Time',
    icon: '🎯',
    desc: 'Matrix-style ultra slow motion in the middle',
    points: [
      { timeRatio: 0.0, speedMultiplier: 5.0 },
      { timeRatio: 0.35, speedMultiplier: 0.2 },
      { timeRatio: 0.65, speedMultiplier: 0.2 },
      { timeRatio: 1.0, speedMultiplier: 5.0 },
    ],
  },
  'jump-cut': {
    name: 'Jump Cut',
    icon: '⏭️',
    desc: 'Rapid acceleration ramps between key frames',
    points: [
      { timeRatio: 0.0, speedMultiplier: 0.3 },
      { timeRatio: 0.3, speedMultiplier: 7.0 },
      { timeRatio: 0.7, speedMultiplier: 7.0 },
      { timeRatio: 1.0, speedMultiplier: 0.3 },
    ],
  },
  'flash-in': {
    name: 'Flash In',
    icon: '💥',
    desc: 'High speed entry exploding into natural speed',
    points: [
      { timeRatio: 0.0, speedMultiplier: 9.0 },
      { timeRatio: 0.3, speedMultiplier: 2.0 },
      { timeRatio: 0.6, speedMultiplier: 0.5 },
      { timeRatio: 1.0, speedMultiplier: 1.0 },
    ],
  },
  'flash-out': {
    name: 'Flash Out',
    icon: '💨',
    desc: 'Normal speed accelerating into a rocket exit',
    points: [
      { timeRatio: 0.0, speedMultiplier: 1.0 },
      { timeRatio: 0.4, speedMultiplier: 0.6 },
      { timeRatio: 0.7, speedMultiplier: 3.0 },
      { timeRatio: 1.0, speedMultiplier: 9.5 },
    ],
  },
};

export const SpeedModal: React.FC<SpeedModalProps> = ({
  isOpen,
  onClose,
  targetClip,
  currentSpeed,
  currentSpeedSettings,
  onSaveSpeed,
}) => {
  const [mode, setMode] = useState<'normal' | 'curve'>(
    currentSpeedSettings?.mode || (currentSpeed !== 1.0 && !currentSpeedSettings ? 'normal' : 'normal')
  );
  const [normalSpeed, setNormalSpeed] = useState<number>(currentSpeed || 1.0);
  const [selectedCurvePreset, setSelectedCurvePreset] = useState<SpeedCurvePreset>(
    currentSpeedSettings?.curvePreset || 'montage'
  );
  const [curvePoints, setCurvePoints] = useState<SpeedCurvePoint[]>(
    currentSpeedSettings?.curvePoints || PRESET_CURVES.montage.points
  );
  const [selectedPointIndex, setSelectedPointIndex] = useState<number>(1);
  const [smoothSlowMo, setSmoothSlowMo] = useState<boolean>(
    currentSpeedSettings?.smoothSlowMo ?? true
  );
  const [pitchCorrection, setPitchCorrection] = useState<boolean>(
    currentSpeedSettings?.pitchCorrection ?? true
  );
  const [applyToAll, setApplyToAll] = useState<boolean>(false);

  const graphRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  if (!isOpen) return null;

  const rawClipDuration = targetClip?.rawDuration || targetClip?.duration || 4.0;

  // Calculate dynamic resulting duration
  const computeResultingDuration = (): number => {
    if (mode === 'normal') {
      return rawClipDuration / Math.max(0.1, normalSpeed);
    }
    // Integrate curve points
    let totalTime = 0;
    for (let i = 0; i < curvePoints.length - 1; i++) {
      const p1 = curvePoints[i];
      const p2 = curvePoints[i + 1];
      const segmentSpan = (p2.timeRatio - p1.timeRatio) * rawClipDuration;
      const avgSpeed = (p1.speedMultiplier + p2.speedMultiplier) / 2;
      totalTime += segmentSpan / Math.max(0.1, avgSpeed);
    }
    return Math.max(0.1, totalTime);
  };

  const resultingDuration = computeResultingDuration();

  const handleSelectCurvePreset = (preset: SpeedCurvePreset) => {
    setSelectedCurvePreset(preset);
    if (preset !== 'normal' && preset !== 'custom') {
      setCurvePoints(PRESET_CURVES[preset].points);
      setSelectedPointIndex(1);
    }
  };

  // Convert SVG coordinates to point values
  const handleGraphPointerDown = (index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedPointIndex(index);
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleGraphPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !graphRef.current || selectedPointIndex === null) return;
    const rect = graphRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    // Convert to timeRatio (X) and speedMultiplier (Y)
    // Y inverted: top is 10.0x, bottom is 0.1x
    const newRatio = x / rect.width;
    const speedRatio = 1 - y / rect.height; // 0 (bottom = 0.1x) to 1 (top = 10x)
    const newSpeed = 0.1 + speedRatio * 9.9; // 0.1 to 10.0x

    setCurvePoints((prev) => {
      const updated = [...prev];
      const pt = { ...updated[selectedPointIndex] };
      // End points pinned to X=0 and X=1
      if (selectedPointIndex === 0) {
        pt.timeRatio = 0.0;
      } else if (selectedPointIndex === updated.length - 1) {
        pt.timeRatio = 1.0;
      } else {
        pt.timeRatio = Math.max(0.05, Math.min(0.95, newRatio));
      }
      pt.speedMultiplier = Math.round(newSpeed * 10) / 10;
      updated[selectedPointIndex] = pt;

      // Sort intermediate points by timeRatio to keep order
      return updated;
    });

    setSelectedCurvePreset('custom');
  };

  const handleGraphPointerUp = () => {
    setIsDragging(false);
  };

  const handleAddPoint = () => {
    if (curvePoints.length >= 8) return;
    const newRatio = 0.5;
    const newPoint: SpeedCurvePoint = { timeRatio: newRatio, speedMultiplier: 1.0 };
    const updated = [...curvePoints, newPoint].sort((a, b) => a.timeRatio - b.timeRatio);
    setCurvePoints(updated);
    setSelectedPointIndex(updated.findIndex((p) => p === newPoint));
    setSelectedCurvePreset('custom');
  };

  const handleDeleteSelectedPoint = () => {
    if (curvePoints.length <= 3) return; // Keep at least 3 points
    if (selectedPointIndex === 0 || selectedPointIndex === curvePoints.length - 1) return;
    const updated = curvePoints.filter((_, idx) => idx !== selectedPointIndex);
    setCurvePoints(updated);
    setSelectedPointIndex(Math.max(0, selectedPointIndex - 1));
    setSelectedCurvePreset('custom');
  };

  const handleSave = () => {
    const effectiveSpeed = mode === 'normal' ? normalSpeed : 1.0;
    const speedSettings: SpeedSettings = {
      mode,
      normalSpeed,
      curvePreset: selectedCurvePreset,
      curvePoints,
      smoothSlowMo,
      pitchCorrection,
    };
    onSaveSpeed(effectiveSpeed, speedSettings, applyToAll);
    onClose();
  };

  // Build SVG Path for smooth Bezier curve
  const buildSvgPath = (width: number, height: number): string => {
    if (curvePoints.length === 0) return '';
    const coords = curvePoints.map((p) => {
      const x = p.timeRatio * width;
      const normalizedSpeed = (p.speedMultiplier - 0.1) / 9.9; // 0 to 1
      const y = (1 - normalizedSpeed) * height;
      return { x, y };
    });

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = i > 0 ? coords[i - 1] : coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = i != coords.length - 2 ? coords[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const activePoint = curvePoints[selectedPointIndex] || curvePoints[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Clip Speed & Curves
              </h2>
              {targetClip && (
                <p className="text-[10px] text-zinc-400 truncate max-w-[240px]">
                  Original: <span className="font-mono text-zinc-300">{rawClipDuration.toFixed(1)}s</span> → New:{' '}
                  <span className="font-mono text-blue-300 font-bold">
                    {resultingDuration.toFixed(1)}s
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-white/10 bg-[#181818]">
          <button
            onClick={() => setMode('normal')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'normal'
                ? 'text-blue-300 border-b-2 border-blue-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Normal Speed
          </button>
          <button
            onClick={() => setMode('curve')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              mode === 'curve'
                ? 'text-blue-300 border-b-2 border-blue-400 bg-white/5 font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Speed Curve
            <span className="bg-blue-500 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full ml-1">
              PRO
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[48vh]">
          {/* MODE 1: NORMAL SPEED */}
          {mode === 'normal' && (
            <div className="space-y-4 py-2">
              {/* Big Speed Value Display */}
              <div className="text-center py-4 bg-[#1a1a1a] rounded-2xl border border-white/5 relative overflow-hidden">
                <span className="text-4xl font-black font-mono text-blue-400 tracking-tight">
                  {normalSpeed.toFixed(1)}x
                </span>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Duration: {rawClipDuration.toFixed(1)}s →{' '}
                  <span className="text-white font-bold">{resultingDuration.toFixed(1)}s</span>
                </p>
              </div>

              {/* Slider */}
              <div className="space-y-2 px-1">
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={normalSpeed}
                  onChange={(e) => setNormalSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-400"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                  <span>0.1x (Slow-Mo)</span>
                  <span>1.0x (Standard)</span>
                  <span>5.0x</span>
                  <span>10.0x (Hyperlapse)</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="grid grid-cols-6 gap-1.5 pt-2">
                {[0.1, 0.5, 1.0, 2.0, 5.0, 10.0].map((p) => (
                  <button
                    key={p}
                    onClick={() => setNormalSpeed(p)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all active:scale-95 ${
                      Math.abs(normalSpeed - p) < 0.05
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300 ring-2 ring-blue-400/40 shadow-lg'
                        : 'border-white/5 bg-[#202020] text-zinc-300 hover:bg-[#282828]'
                    }`}
                  >
                    {p}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* MODE 2: SPEED CURVE (CAPCUT BEZIER GRAPH) */}
          {mode === 'curve' && (
            <div className="space-y-4">
              {/* Curve Presets Bar */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {Object.entries(PRESET_CURVES).map(([key, item]) => {
                  const isSelected = selectedCurvePreset === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectCurvePreset(key as SpeedCurvePreset)}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-blue-500/20 border-blue-400 text-white font-bold ring-2 ring-blue-400/40 shadow-md'
                          : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#242424]'
                      }`}
                    >
                      <span className="text-lg leading-none">{item.icon}</span>
                      <span className="text-[10px] truncate max-w-full font-medium">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Curve Canvas / SVG Graph */}
              <div className="bg-[#0e0e0e] rounded-2xl border border-white/15 p-3 relative space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span className="font-semibold text-white flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    Drag speed points to reshape
                  </span>
                  <div className="flex items-center gap-1 bg-blue-950/70 border border-blue-500/40 px-2 py-0.5 rounded-full text-blue-300 font-mono text-[10px] font-bold">
                    Point {selectedPointIndex + 1}: {activePoint?.speedMultiplier.toFixed(1)}x
                  </div>
                </div>

                <div className="relative w-full h-36 bg-[#161616] rounded-xl overflow-hidden border border-white/10 select-none">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none p-2 opacity-20">
                    <div className="border-b border-dashed border-white text-[8px] text-zinc-400">10.0x</div>
                    <div className="border-b border-dashed border-blue-400 text-[8px] text-blue-400">1.0x Standard</div>
                    <div className="border-b border-dashed border-white text-[8px] text-zinc-400">0.1x Slow-Mo</div>
                  </div>

                  {/* SVG Bezier Curve */}
                  <svg
                    ref={graphRef}
                    className="w-full h-full cursor-crosshair relative z-10"
                    onPointerMove={handleGraphPointerMove}
                    onPointerUp={handleGraphPointerUp}
                  >
                    {/* Shaded Area Below Curve */}
                    <path
                      d={`${buildSvgPath(340, 144)} L 340 144 L 0 144 Z`}
                      fill="url(#curveGradient)"
                      opacity="0.3"
                    />

                    {/* Gradient Definition */}
                    <defs>
                      <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Main Stroke Path */}
                    <path
                      d={buildSvgPath(340, 144)}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />

                    {/* Draggable Control Points */}
                    {curvePoints.map((pt, idx) => {
                      const cx = pt.timeRatio * 340;
                      const normalizedSpeed = (pt.speedMultiplier - 0.1) / 9.9;
                      const cy = (1 - normalizedSpeed) * 144;
                      const isSelected = idx === selectedPointIndex;

                      return (
                        <g key={idx}>
                          {isSelected && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r="10"
                              fill="#60a5fa"
                              opacity="0.3"
                              className="animate-pulse"
                            />
                          )}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 6.5 : 5}
                            fill={isSelected ? '#38bdf8' : '#ffffff'}
                            stroke="#1d4ed8"
                            strokeWidth="2"
                            className="cursor-pointer active:scale-125 transition-transform"
                            onPointerDown={(e) => handleGraphPointerDown(idx, e)}
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Graph Controls (Add Point, Delete Point, Reset) */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleAddPoint}
                      className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-[#2c2c2c] border border-white/10 text-zinc-300 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      Add Point
                    </button>
                    <button
                      onClick={handleDeleteSelectedPoint}
                      disabled={curvePoints.length <= 3 || selectedPointIndex === 0 || selectedPointIndex === curvePoints.length - 1}
                      className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-rose-950/40 border border-white/10 hover:border-rose-500/40 text-rose-400 text-xs font-semibold flex items-center gap-1 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>

                  <button
                    onClick={() => handleSelectCurvePreset('montage')}
                    className="px-2 py-1 rounded-lg text-zinc-400 hover:text-white text-xs flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Toggles: Optical Flow & Pitch Correction */}
          <div className="bg-[#1c1c1c] p-3 rounded-2xl border border-white/10 space-y-3">
            {/* Smooth Slow-Mo / Optical Flow */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">
                    Make it Smoother (Optical Flow)
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    AI frame-blending removes stutter from slow-motion cuts
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={smoothSlowMo}
                onChange={(e) => setSmoothSlowMo(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-400 cursor-pointer"
              />
            </label>

            {/* Natural Pitch Correction */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Pitch Correction</span>
                  <span className="text-[10px] text-zinc-400">
                    Preserves original voice tone during fast-forward / slow-mo
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={pitchCorrection}
                onChange={(e) => setPitchCorrection(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Apply to All Clips Toggle */}
          <div className="pt-1">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Apply speed to all clips</span>
                  <span className="text-[10px] text-zinc-400">
                    Rescales all video clips in the project
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-400 cursor-pointer"
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
            className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all"
            id="apply-speed-confirm-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            {applyToAll ? 'Apply to All Clips' : 'Apply Speed Curve'}
          </button>
        </div>
      </div>
    </div>
  );
};
