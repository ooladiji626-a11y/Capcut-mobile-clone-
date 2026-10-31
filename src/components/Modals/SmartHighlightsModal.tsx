import React, { useState } from 'react';
import {
  X,
  Check,
  Wand2,
  Sparkles,
  Zap,
  VolumeX,
  Flame,
  Music,
  Scissors,
  Layers,
  Clock,
  Eye,
  CheckCircle2,
  Play,
  RotateCcw,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { VideoClip, AudioTrackClip, CaptionClip, Transition } from '../../types';

interface SmartHighlightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoClips: VideoClip[];
  audioClips: AudioTrackClip[];
  onApplyHighlights: (
    newClips: VideoClip[],
    newCaptions?: CaptionClip[],
    newAudio?: AudioTrackClip[]
  ) => void;
}

type PacingPreset = '15s-viral' | '30s-reels' | '60s-documentary' | 'custom';

interface HighlightSegment {
  id: string;
  sourceClipId: string;
  title: string;
  tag: 'Viral Hook' | 'Peak Action' | 'Key Revelation' | 'Climax' | 'Outro';
  thumbnailUrl: string;
  duration: number;
  startOffset: number;
  confidenceScore: number;
  selected: boolean;
  transitionType: Transition['type'];
  captionText: string;
}

export const SmartHighlightsModal: React.FC<SmartHighlightsModalProps> = ({
  isOpen,
  onClose,
  videoClips,
  audioClips,
  onApplyHighlights,
}) => {
  const [pacingPreset, setPacingPreset] = useState<PacingPreset>('30s-reels');
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [removeSilence, setRemoveSilence] = useState<boolean>(true);
  const [autoBeatSync, setAutoBeatSync] = useState<boolean>(true);
  const [addDynamicMotion, setAddDynamicMotion] = useState<boolean>(true);
  const [generateHormoziCaptions, setGenerateHormoziCaptions] = useState<boolean>(true);

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [generatedSegments, setGeneratedSegments] = useState<HighlightSegment[] | null>(null);

  if (!isOpen) return null;

  const targetDuration =
    pacingPreset === '15s-viral'
      ? 15
      : pacingPreset === '30s-reels'
      ? 30
      : pacingPreset === '60s-documentary'
      ? 60
      : customDuration;

  // Run AI Highlight Extraction Simulation
  const handleRunAutoCutter = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisStep('Scanning visual motion vectors & frame saliency...');

    setTimeout(() => {
      setAnalysisProgress(35);
      setAnalysisStep('Detecting vocal cadence & pruning 3.8s of silence...');
    }, 600);

    setTimeout(() => {
      setAnalysisProgress(65);
      setAnalysisStep('Detecting audio beat transients for sync cuts...');
    }, 1200);

    setTimeout(() => {
      setAnalysisProgress(90);
      setAnalysisStep('Assembling high-retention viral storytelling structure...');
    }, 1800);

    setTimeout(() => {
      setAnalysisProgress(100);
      setIsAnalyzing(false);

      // Generate smart segments from project clips
      const sampleSegments: HighlightSegment[] = [
        {
          id: 'seg-1',
          sourceClipId: videoClips[0]?.id || 'clip-1',
          title: 'Dramatic Hook Moment',
          tag: 'Viral Hook',
          thumbnailUrl:
            videoClips[0]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
          duration: pacingPreset === '15s-viral' ? 3.0 : 4.0,
          startOffset: 0.5,
          confidenceScore: 98,
          selected: true,
          transitionType: 'flash',
          captionText: 'THIS 3,000 YEAR SECRET WAS HIDDEN UNDERWATER',
        },
        {
          id: 'seg-2',
          sourceClipId: videoClips[1]?.id || 'clip-2',
          title: 'War Fleet Movement',
          tag: 'Peak Action',
          thumbnailUrl:
            videoClips[1]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1524654458049-e36be0b21fa2?w=600&auto=format&fit=crop&q=80',
          duration: pacingPreset === '15s-viral' ? 3.5 : 5.2,
          startOffset: 1.2,
          confidenceScore: 94,
          selected: true,
          transitionType: 'glitch',
          captionText: 'AN UNKNOWN ARMADA SUDDENLY APPEARED ON THE COAST',
        },
        {
          id: 'seg-3',
          sourceClipId: videoClips[2]?.id || 'clip-3',
          title: 'The Great Fire Eruption',
          tag: 'Key Revelation',
          thumbnailUrl:
            videoClips[2]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
          duration: pacingPreset === '15s-viral' ? 4.0 : 6.0,
          startOffset: 0.8,
          confidenceScore: 91,
          selected: true,
          transitionType: 'zoom-in',
          captionText: 'EVERY SINGLE MAJOR EMPIRE BURNED IN LESS THAN 50 YEARS',
        },
        {
          id: 'seg-4',
          sourceClipId: videoClips[3]?.id || videoClips[0]?.id || 'clip-4',
          title: 'Unsolved Global Mystery',
          tag: 'Climax',
          thumbnailUrl:
            videoClips[3]?.thumbnailUrl ||
            'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80',
          duration: pacingPreset === '15s-viral' ? 4.5 : 7.0,
          startOffset: 0.0,
          confidenceScore: 89,
          selected: true,
          transitionType: 'dissolve',
          captionText: 'AND NO HISTORIAN HAS EVER DISCOVERED WHO THEY WERE',
        },
      ];

      setGeneratedSegments(sampleSegments);
    }, 2300);
  };

  // Toggle individual segment
  const handleToggleSegment = (id: string) => {
    setGeneratedSegments((prev) =>
      prev ? prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)) : null
    );
  };

  // Apply to timeline
  const handleApplyToTimeline = () => {
    if (!generatedSegments) return;
    const activeSegs = generatedSegments.filter((s) => s.selected);
    if (activeSegs.length === 0) return;

    // Build optimized VideoClips
    const newVideoClips: VideoClip[] = activeSegs.map((seg, idx) => {
      const parentClip = videoClips.find((c) => c.id === seg.sourceClipId) || videoClips[0];
      return {
        id: `highlight-${idx + 1}-${Date.now()}`,
        title: `${seg.tag}: ${seg.title}`,
        type: 'video',
        color: idx === 0 ? '#ec4899' : '#3b82f6',
        thumbnailUrl: seg.thumbnailUrl,
        frames: parentClip?.frames || [seg.thumbnailUrl],
        duration: seg.duration,
        startOffset: seg.startOffset,
        rawDuration: parentClip?.rawDuration || seg.duration + 2.0,
        volume: 100,
        speed: 1.0,
        keyframes: addDynamicMotion
          ? [
              { id: `kf-${idx}-1`, time: 0, scale: 1.0, x: 0, y: 0, rotation: 0, opacity: 1 },
              {
                id: `kf-${idx}-2`,
                time: seg.duration,
                scale: 1.2,
                x: idx % 2 === 0 ? 5 : -5,
                y: -3,
                rotation: idx % 2 === 0 ? 1 : -1,
                opacity: 1,
              },
            ]
          : undefined,
        transitionAfter:
          idx < activeSegs.length - 1
            ? {
                id: `trans-hl-${idx}`,
                type: seg.transitionType,
                name: `${seg.transitionType.toUpperCase()} Cut`,
                duration: 0.35,
              }
            : undefined,
      };
    });

    // Build Auto Hormozi Captions
    let newCaptions: CaptionClip[] | undefined = undefined;
    if (generateHormoziCaptions) {
      let cumulativeTime = 0;
      newCaptions = activeSegs.map((seg, idx) => {
        const cap: CaptionClip = {
          id: `cap-hl-${idx + 1}`,
          text: seg.captionText,
          startTime: Math.round(cumulativeTime * 10) / 10,
          duration: Math.round((seg.duration - 0.2) * 10) / 10,
          stylePreset: 'hormozi',
          highlightWordIndex: 2,
        };
        cumulativeTime += seg.duration;
        return cap;
      });
    }

    onApplyHighlights(newVideoClips, newCaptions);
    onClose();
  };

  const totalCuratedDuration =
    generatedSegments?.filter((s) => s.selected).reduce((acc, s) => acc + s.duration, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1c1c1c]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                AI Smart Highlights & Auto-Cutter
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  AI PRO
                </span>
              </h2>
              <p className="text-[10px] text-zinc-400">
                Transform footage into high-retention viral short cuts
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[52vh]">
          {/* Target Format & Duration Pills */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" /> Choose Target Short Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPacingPreset('15s-viral')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                  pacingPreset === '15s-viral'
                    ? 'bg-rose-500/20 border-rose-400 text-white ring-2 ring-rose-400/40 shadow-md font-bold'
                    : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#242424]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400">15s Viral</span>
                  <Zap className="w-3 h-3 text-amber-400" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">TikTok / Shorts Fast Pace</p>
              </button>

              <button
                onClick={() => setPacingPreset('30s-reels')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                  pacingPreset === '30s-reels'
                    ? 'bg-rose-500/20 border-rose-400 text-white ring-2 ring-rose-400/40 shadow-md font-bold'
                    : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#242424]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400">30s Reels</span>
                  <Flame className="w-3 h-3 text-rose-400" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">High Retention Hook</p>
              </button>

              <button
                onClick={() => setPacingPreset('60s-documentary')}
                className={`p-2.5 rounded-xl border text-left transition-all active:scale-95 ${
                  pacingPreset === '60s-documentary'
                    ? 'bg-rose-500/20 border-rose-400 text-white ring-2 ring-rose-400/40 shadow-md font-bold'
                    : 'bg-[#1c1c1c] border-white/5 text-zinc-300 hover:bg-[#242424]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400">60s Story</span>
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-[10px] text-zinc-400 mt-1">Full Narrative Arc</p>
              </button>
            </div>
          </div>

          {/* AI Optimizer Toggles */}
          <div className="bg-[#1a1a1a] p-3 rounded-2xl border border-white/10 space-y-2.5">
            {/* Silence Removal */}
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-rose-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Silence & Dead-Air Remover</span>
                  <span className="text-[10px] text-zinc-400">Trims awkward pauses & filler breath</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={removeSilence}
                onChange={(e) => setRemoveSilence(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-400 cursor-pointer"
              />
            </label>

            {/* Auto Beat Sync */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Auto Beat-Drop Sync</span>
                  <span className="text-[10px] text-zinc-400">Snaps cuts to audio transients</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={autoBeatSync}
                onChange={(e) => setAutoBeatSync(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-400 cursor-pointer"
              />
            </label>

            {/* Dynamic Motion Keyframes */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Dynamic Punch-In Zooms</span>
                  <span className="text-[10px] text-zinc-400">Adds subtle retention zooms on keyframes</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={addDynamicMotion}
                onChange={(e) => setAddDynamicMotion(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-400 cursor-pointer"
              />
            </label>

            {/* Auto Hormozi Captions */}
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Auto Viral Hormozi Captions</span>
                  <span className="text-[10px] text-zinc-400">Generates bold yellow highlighted subtitles</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={generateHormoziCaptions}
                onChange={(e) => setGenerateHormoziCaptions(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Analysis Trigger Button or Progress */}
          {!generatedSegments && !isAnalyzing && (
            <button
              onClick={handleRunAutoCutter}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 active:scale-98 transition-all"
              id="analyze-footage-btn"
            >
              <Wand2 className="w-4 h-4" />
              Scan & Auto-Extract Highlights ({targetDuration}s Target)
            </button>
          )}

          {/* Analyzing State */}
          {isAnalyzing && (
            <div className="bg-[#181818] p-4 rounded-2xl border border-rose-500/30 space-y-3 text-center animate-pulse">
              <div className="flex items-center justify-center gap-2 text-rose-400 text-xs font-bold">
                <Wand2 className="w-4 h-4 animate-spin" />
                AI Video Engine Analyzing Clips...
              </div>
              {/* Progress Bar */}
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-amber-400 transition-all duration-300"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">{analysisStep}</p>
            </div>
          )}

          {/* Curated Segments Review List */}
          {generatedSegments && !isAnalyzing && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Curated Moments ({generatedSegments.filter((s) => s.selected).length}/
                  {generatedSegments.length})
                </span>
                <span className="text-zinc-400 font-mono text-[11px]">
                  Total: <strong className="text-rose-400 font-bold">{totalCuratedDuration.toFixed(1)}s</strong>
                </span>
              </div>

              <div className="space-y-2">
                {generatedSegments.map((seg, idx) => (
                  <div
                    key={seg.id}
                    onClick={() => handleToggleSegment(seg.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      seg.selected
                        ? 'bg-[#1c1c1c] border-rose-500/40 ring-1 ring-rose-500/20'
                        : 'bg-[#141414] border-white/5 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-900 flex items-center justify-center">
                        {seg.thumbnailUrl && seg.thumbnailUrl.trim() !== '' ? (
                          <img
                            src={seg.thumbnailUrl}
                            alt={seg.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[8px] text-zinc-500 font-mono">Clip</span>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 py-0.2 rounded text-[8px] font-mono text-zinc-200">
                          {seg.duration.toFixed(1)}s
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                              seg.tag === 'Viral Hook'
                                ? 'bg-rose-500 text-white'
                                : seg.tag === 'Peak Action'
                                ? 'bg-amber-500 text-black'
                                : 'bg-blue-500 text-white'
                            }`}
                          >
                            {seg.tag}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            {seg.confidenceScore}% Match
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white mt-0.5">{seg.title}</h4>
                        <p className="text-[9px] text-zinc-400 line-clamp-1 italic">
                          "{seg.captionText}"
                        </p>
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={seg.selected}
                      onChange={() => handleToggleSegment(seg.id)}
                      className="w-4 h-4 rounded accent-rose-500 cursor-pointer shrink-0"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  onClick={handleRunAutoCutter}
                  className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Re-scan Clips
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center gap-2">
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-[#242424] text-zinc-300 text-xs font-semibold hover:bg-[#2c2c2c] active:scale-95 transition-all"
          >
            Cancel
          </button>
          {generatedSegments ? (
            <button
              onClick={handleApplyToTimeline}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
              id="apply-highlights-to-timeline-btn"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Apply {totalCuratedDuration.toFixed(1)}s Highlights to Timeline
            </button>
          ) : (
            <button
              onClick={handleRunAutoCutter}
              className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg active:scale-98 transition-all"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Cut Video
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
