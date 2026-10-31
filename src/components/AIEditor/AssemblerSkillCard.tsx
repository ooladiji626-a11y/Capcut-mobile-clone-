import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Mic,
  Image as ImageIcon,
  FileText,
  Subtitles,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  RotateCcw,
  Film,
  Smartphone,
  Tv,
  Wand2,
  Volume2,
} from 'lucide-react';
import { AspectRatio } from '../../types';

export interface AssemblerSkillData {
  voiceoverName?: string;
  voiceoverDuration?: number;
  hasVoiceover: boolean;
  imageCount: number;
  scriptBeatCount: number;
  srtCueCount: number;
  status: 'ready' | 'assembling' | 'completed';
  completedClips?: number;
  timelineDuration?: number;
  currentStep?: string;
  aspectRatio?: AspectRatio;
}

interface AssemblerSkillCardProps {
  data: AssemblerSkillData;
  isExecuting?: boolean;
  activeStepText?: string;
  onRunAssembler: (options: { aspectRatio: AspectRatio; autoKenBurns?: boolean; autoDucking?: boolean }) => void;
  onOpenReview?: () => void;
}

export const AssemblerSkillCard: React.FC<AssemblerSkillCardProps> = ({
  data,
  isExecuting = false,
  activeStepText,
  onRunAssembler,
  onOpenReview,
}) => {
  const [selectedAspect, setSelectedAspect] = useState<AspectRatio>(data.aspectRatio || '16:9');
  const [autoKenBurns, setAutoKenBurns] = useState(true);
  const [autoDucking, setAutoDucking] = useState(true);

  const isAssembling = isExecuting || data.status === 'assembling';
  const isDone = data.status === 'completed';

  const steps = [
    { id: 1, label: 'Analyze speech & voiceover master clock' },
    { id: 2, label: 'Align script beats with syllable-weighted DP' },
    { id: 3, label: 'Pair images to beats with numeric & visual priority' },
    { id: 4, label: 'Place and trim clips to voiceover with zero gaps' },
  ];

  const currentStepNum = activeStepText?.toLowerCase().includes('speech')
    ? 1
    : activeStepText?.toLowerCase().includes('align')
    ? 2
    : activeStepText?.toLowerCase().includes('pair') || activeStepText?.toLowerCase().includes('match')
    ? 3
    : activeStepText?.toLowerCase().includes('plac') || activeStepText?.toLowerCase().includes('trim')
    ? 4
    : 1;

  return (
    <div className="w-full my-2.5 rounded-2xl bg-gradient-to-b from-[#18181f] to-[#121216] border border-cyan-500/30 overflow-hidden shadow-xl text-stone-200">
      {/* Top Banner Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-950/70 via-cyan-950/60 to-purple-950/50 border-b border-cyan-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                Skill 1: The Assembler
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Core Builder
              </span>
            </div>
            <p className="text-[11px] text-stone-400">
              Synchronize voiceover, script beats, and visuals with zero cut drift
            </p>
          </div>
        </div>

        {/* State Badge */}
        {isDone ? (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Assembled</span>
          </span>
        ) : isAssembling ? (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 shrink-0 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Building Live</span>
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[11px] font-bold shrink-0">
            Ready
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4">
        {/* Asset Readiness Checklist */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 flex items-center justify-between">
            <span>Asset Readiness Checklist</span>
            <span className="text-[10px] font-normal text-stone-500">Live Memory Pool</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Voiceover Master Track */}
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                data.hasVoiceover
                  ? 'bg-blue-950/30 border-blue-500/40 text-stone-200'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  data.hasVoiceover
                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                    : 'bg-stone-800 text-stone-500'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] truncate">Voiceover Master</span>
                  {data.hasVoiceover && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {data.hasVoiceover
                    ? `${data.voiceoverDuration ? data.voiceoverDuration.toFixed(1) + 's' : 'Loaded'} (${data.voiceoverName || 'audio track'})`
                    : 'No audio loaded'}
                </p>
              </div>
            </div>

            {/* Visual Assets (Images / ZIP) */}
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                data.imageCount > 0
                  ? 'bg-cyan-950/30 border-cyan-500/40 text-stone-200'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  data.imageCount > 0
                    ? 'bg-cyan-600/30 text-cyan-400 border border-cyan-500/40'
                    : 'bg-stone-800 text-stone-500'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] truncate">Visual Assets</span>
                  {data.imageCount > 0 && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {data.imageCount > 0 ? `${data.imageCount} images / ZIP` : '0 in asset bin'}
                </p>
              </div>
            </div>

            {/* Script Beats */}
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                data.scriptBeatCount > 0
                  ? 'bg-purple-950/30 border-purple-500/40 text-stone-200'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  data.scriptBeatCount > 0
                    ? 'bg-purple-600/30 text-purple-400 border border-purple-500/40'
                    : 'bg-stone-800 text-stone-500'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] truncate">Script Beats</span>
                  {data.scriptBeatCount > 0 && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {data.scriptBeatCount > 0 ? `${data.scriptBeatCount} numbered beats` : 'None pasted'}
                </p>
              </div>
            </div>

            {/* Subtitles / SRT */}
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                data.srtCueCount > 0
                  ? 'bg-amber-950/30 border-amber-500/40 text-stone-200'
                  : 'bg-stone-900/60 border-stone-800 text-stone-400'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  data.srtCueCount > 0
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40'
                    : 'bg-stone-800 text-stone-500'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] truncate">Subtitles (SRT)</span>
                  {data.srtCueCount > 0 && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 ml-1" />
                  )}
                </div>
                <p className="text-[10px] text-stone-400 font-mono truncate">
                  {data.srtCueCount > 0 ? `${data.srtCueCount} word-level cues` : 'Optional'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Step-by-Step Progress Feedback during assembly */}
        {isAssembling && (
          <div className="p-3.5 rounded-xl bg-black/60 border border-cyan-500/40 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Live Timeline Assembly in Progress</span>
              </span>
              <span className="font-mono text-[10px] text-stone-400">Step {currentStepNum} of 4</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {steps.map((st) => {
                const isCurrent = st.id === currentStepNum;
                const isPassed = st.id < currentStepNum;
                return (
                  <div
                    key={st.id}
                    className={`flex items-center gap-2 text-[11px] transition-all ${
                      isCurrent
                        ? 'text-cyan-300 font-semibold pl-1'
                        : isPassed
                        ? 'text-emerald-400'
                        : 'text-stone-500'
                    }`}
                  >
                    {isPassed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-stone-600 shrink-0" />
                    )}
                    <span className="truncate">
                      {isCurrent && activeStepText ? activeStepText : st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {isDone && !isAssembling && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Timeline Assembled Successfully!</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-stone-300 pt-1 border-t border-emerald-900/40 font-mono">
              <span>{data.completedClips || data.imageCount || 0} clips placed</span>
              <span>{data.timelineDuration ? data.timelineDuration.toFixed(1) + 's' : ''} total</span>
              <span className="text-emerald-400">0 black gaps</span>
            </div>
          </div>
        )}

        {/* Aspect Ratio & Settings Selection (before assembling) */}
        {!isAssembling && !isDone && (
          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-stone-400 flex items-center gap-1">
              <span>Format:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedAspect('16:9')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  selectedAspect === '16:9'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>16:9 Horizontal</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAspect('9:16')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  selectedAspect === '9:16'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>9:16 Vertical Short</span>
              </button>
            </div>
          </div>
        )}

        {/* Sound & Motion Options */}
        <div className="bg-stone-900/90 rounded-xl p-2.5 border border-stone-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-1.5 text-stone-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoKenBurns}
                onChange={(e) => setAutoKenBurns(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-stone-800 border-stone-700 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold flex items-center gap-1 text-[11px]">
                <Wand2 className="w-3 h-3 text-cyan-400" />
                Auto Ken Burns
              </span>
            </label>
            <span className="text-[10px] text-stone-400">Alternating zooms & pans</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-1.5 text-stone-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDucking}
                onChange={(e) => setAutoDucking(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-stone-800 border-stone-700 text-emerald-500 focus:ring-0 cursor-pointer"
              />
              <span className="font-semibold flex items-center gap-1 text-[11px]">
                <Volume2 className="w-3 h-3 text-emerald-400" />
                Smart Auto-Ducking
              </span>
            </label>
            <span className="text-[10px] text-stone-400">Dips BGM to 18%, 400ms pause swell</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          {onOpenReview && (data.scriptBeatCount > 0 || data.imageCount > 0) && (
            <button
              type="button"
              onClick={onOpenReview}
              disabled={isAssembling}
              className="py-2.5 px-3 rounded-xl bg-stone-800/80 hover:bg-stone-700/80 text-cyan-300 border border-cyan-800/40 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview Matches</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onRunAssembler({ aspectRatio: selectedAspect, autoKenBurns, autoDucking })}
            disabled={isAssembling}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            id="run-assembler-skill-btn"
          >
            {isAssembling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Building Timeline...</span>
              </>
            ) : isDone ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-assemble Timeline</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Assembler</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
