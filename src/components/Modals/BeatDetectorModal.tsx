import React, { useState } from 'react';
import {
  X,
  Check,
  Music,
  Zap,
  Activity,
  Flame,
  Volume2,
  Sparkles,
  Sliders,
  Scissors,
  CheckCircle2,
  Play,
  RotateCcw,
} from 'lucide-react';
import { AudioTrackClip, BeatMarker, BeatDetectionConfig, VideoClip } from '../../types';
import { detectAudioBeats } from '../../utils/beatDetector';

interface BeatDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAudio: AudioTrackClip | null;
  videoClips: VideoClip[];
  onApplyBeats: (
    audioId: string,
    beatMarkers: BeatMarker[],
    beatConfig: BeatDetectionConfig
  ) => void;
  onAutoCutClipsToBeats: (beatMarkers: BeatMarker[]) => void;
}

export const BeatDetectorModal: React.FC<BeatDetectorModalProps> = ({
  isOpen,
  onClose,
  selectedAudio,
  videoClips,
  onApplyBeats,
  onAutoCutClipsToBeats,
}) => {
  const initialMode = selectedAudio?.beatConfig?.autoDetectMode || 'dynamic-transient';
  const initialBpm = selectedAudio?.beatConfig?.bpm || 128;
  const initialSnapping = selectedAudio?.beatConfig?.snappingEnabled ?? true;

  const [detectMode, setDetectMode] = useState<'dynamic-transient' | 'fixed-tempo' | 'chill-half' | 'hype-double'>(initialMode);
  const [bpm, setBpm] = useState<number>(initialBpm);
  const [snappingEnabled, setSnappingEnabled] = useState<boolean>(initialSnapping);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [previewBeats, setPreviewBeats] = useState<BeatMarker[]>(() => {
    if (selectedAudio?.beatMarkers && selectedAudio.beatMarkers.length > 0) {
      return selectedAudio.beatMarkers.map((b) =>
        typeof b === 'number' ? { time: b, isDownbeat: false, intensity: 0.8 } : b
      );
    }
    return [];
  });

  if (!isOpen || !selectedAudio) return null;

  const handleRunBeatDetection = (mode = detectMode, customBpm = bpm) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const result = detectAudioBeats(
        selectedAudio.waveformData,
        selectedAudio.duration,
        mode,
        mode === 'fixed-tempo' ? customBpm : undefined
      );
      setBpm(result.bpm);
      setPreviewBeats(result.beats);
      setIsAnalyzing(false);
    }, 350);
  };

  const handleApply = () => {
    const config: BeatDetectionConfig = {
      bpm,
      offset: 0,
      autoDetectMode: detectMode,
      snappingEnabled,
    };
    onApplyBeats(selectedAudio.id, previewBeats, config);
    onClose();
  };

  const handleAutoCut = () => {
    if (previewBeats.length === 0) {
      const result = detectAudioBeats(
        selectedAudio.waveformData,
        selectedAudio.duration,
        detectMode,
        bpm
      );
      onApplyBeats(selectedAudio.id, result.beats, {
        bpm: result.bpm,
        offset: 0,
        autoDetectMode: detectMode,
        snappingEnabled,
      });
      onAutoCutClipsToBeats(result.beats);
    } else {
      handleApply();
      onAutoCutClipsToBeats(previewBeats);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                AI Beat Detector & Beat Sync
                <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  AUTO-BPM
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400 truncate max-w-[280px]">
                Audio Track: <span className="text-amber-300 font-bold">{selectedAudio.title}</span>
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

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[55vh]">
          {/* Waveform & Visual Beat Preview */}
          <div className="bg-[#1a1a1a] p-3.5 rounded-2xl border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Transient Beat Analysis
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-zinc-400">Tempo:</span>
                <span className="text-amber-400 font-bold">{bpm} BPM</span>
                <span className="text-zinc-500">•</span>
                <span className="text-amber-300 font-bold">{previewBeats.length} beats</span>
              </div>
            </div>

            {/* Visual Beat Bar Strip */}
            <div className="w-full h-12 bg-[#091f26] rounded-xl border border-[#164e63]/40 relative overflow-hidden flex items-center px-2">
              {/* Symmetrical discrete CapCut waveform */}
              <div className="w-full h-8 flex items-center justify-between gap-[2px] opacity-80">
                {selectedAudio.waveformData.slice(0, 60).map((peak, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-[#21C0B5] rounded-[1.5px]"
                    style={{ height: `${Math.max(4, peak * 28)}px` }}
                  />
                ))}
              </div>

              {/* Beat Marker Overlay Pins */}
              {previewBeats.map((b, idx) => {
                const leftPercent = (b.time / selectedAudio.duration) * 100;
                if (leftPercent > 100) return null;
                return (
                  <div
                    key={idx}
                    className={`absolute top-0 bottom-0 w-[2px] pointer-events-none transition-all ${
                      b.isDownbeat
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] z-20'
                        : 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)] z-10 opacity-80'
                    }`}
                    style={{ left: `${leftPercent}%` }}
                  >
                    <div
                      className={`w-2 h-2 rounded-full -translate-x-[3px] -translate-y-0.5 ${
                        b.isDownbeat ? 'bg-rose-400' : 'bg-amber-300'
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Downbeat (Bar Start)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Regular Rhythmic Beat
              </span>
            </div>
          </div>

          {/* Detection Algorithms / Presets */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-300 font-semibold">Beat Snapping Style</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  id: 'dynamic-transient',
                  name: 'AI Dynamic Transient',
                  desc: 'Detects natural kick & snare transients',
                  icon: <Zap className="w-4 h-4 text-amber-400" />,
                },
                {
                  id: 'fixed-tempo',
                  name: 'Regular 4/4 Beat Grid',
                  desc: 'Standard rhythmic dance tempo grid',
                  icon: <Activity className="w-4 h-4 text-cyan-400" />,
                },
                {
                  id: 'hype-double',
                  name: '2x Double Tempo (Fast)',
                  desc: 'High-energy fast cuts for viral reels',
                  icon: <Flame className="w-4 h-4 text-rose-400" />,
                },
                {
                  id: 'chill-half',
                  name: '0.5x Half-Time (Cinematic)',
                  desc: 'Spaced out transitions for vlogs & b-roll',
                  icon: <Sparkles className="w-4 h-4 text-purple-400" />,
                },
              ].map((m) => {
                const isSelected = detectMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setDetectMode(m.id as any);
                      handleRunBeatDetection(m.id as any);
                    }}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-400/40 text-white'
                        : 'bg-[#1a1a1a] border-white/5 text-zinc-300 hover:bg-[#222]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {m.icon}
                      <span className="text-xs font-bold">{m.name}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BPM Fine Tuning Slider */}
          <div className="bg-[#1a1a1a] p-3 rounded-2xl border border-white/10 space-y-2">
            <div className="flex justify-between text-xs text-zinc-300">
              <span className="font-semibold">BPM Tempo Fine Adjustment</span>
              <span className="font-mono text-amber-400 font-bold">{bpm} BPM</span>
            </div>
            <input
              type="range"
              min="60"
              max="200"
              value={bpm}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBpm(val);
                setDetectMode('fixed-tempo');
                handleRunBeatDetection('fixed-tempo', val);
              }}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Magnetic Beat Snapping Toggle */}
          <div className="bg-[#1a1a1a] p-3 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white">Magnetic Timeline Beat Snapping</h4>
              <p className="text-[10px] text-zinc-400">Playhead magnetically locks to beat markers while scrubbing</p>
            </div>
            <button
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                snappingEnabled
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {snappingEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={() => handleRunBeatDetection()}
            disabled={isAnalyzing}
            className="py-2.5 px-3 rounded-xl bg-[#242424] text-zinc-300 text-xs font-semibold hover:text-white hover:bg-[#2c2c2c] active:scale-95 transition-all flex items-center gap-1.5"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Re-detect
          </button>

          {/* Auto Cut Button */}
          <button
            onClick={handleAutoCut}
            className="flex-1 py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            id="auto-cut-on-beats-btn"
          >
            <Scissors className="w-4 h-4" />
            Auto-Cut Video on Beats ({videoClips.length} Clips)
          </button>

          {/* Apply Beats Button */}
          <button
            onClick={handleApply}
            className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            id="apply-beats-btn"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Apply Markers
          </button>
        </div>
      </div>
    </div>
  );
};
