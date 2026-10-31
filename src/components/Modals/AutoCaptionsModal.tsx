import React, { useState } from 'react';
import { CaptionClip } from '../../types';
import { X, Sparkles, Wand2, Check, Globe, Mic } from 'lucide-react';

interface AutoCaptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalDuration: number;
  onGenerateCaptions: (newCaptions: CaptionClip[]) => void;
}

export const AutoCaptionsModal: React.FC<AutoCaptionsModalProps> = ({
  isOpen,
  onClose,
  totalDuration,
  onGenerateCaptions,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<'hormozi' | 'documentary' | 'bold-stroke' | 'karaoke'>('hormozi');
  const [language, setLanguage] = useState('English (Auto-detect)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(15);

    const timer1 = setTimeout(() => setProgress(55), 500);
    const timer2 = setTimeout(() => setProgress(90), 1000);
    const timer3 = setTimeout(() => {
      setProgress(100);
      setIsGenerating(false);

      // Generate rich animated documentary captions
      const generated: CaptionClip[] = [
        {
          id: `cap-ai-${Date.now()}-1`,
          text: '3,200 years ago, everything collapsed.',
          startTime: 0.5,
          duration: 2.8,
          stylePreset: selectedStyle,
        },
        {
          id: `cap-ai-${Date.now()}-2`,
          text: 'Trade routes burned overnight.',
          startTime: 3.5,
          duration: 2.6,
          stylePreset: selectedStyle,
        },
        {
          id: `cap-ai-${Date.now()}-3`,
          text: 'Ancient cities erased from the earth.',
          startTime: 6.4,
          duration: 3.0,
          stylePreset: selectedStyle,
        },
        {
          id: `cap-ai-${Date.now()}-4`,
          text: 'Who were the mysterious Sea Peoples?',
          startTime: 9.8,
          duration: 3.4,
          stylePreset: selectedStyle,
        },
        {
          id: `cap-ai-${Date.now()}-5`,
          text: 'Archeologists just found the answer.',
          startTime: 13.5,
          duration: 3.5,
          stylePreset: selectedStyle,
        },
      ];

      onGenerateCaptions(generated);
      onClose();
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#181818] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Auto-Captions</h3>
              <p className="text-[11px] text-zinc-400">AI Speech-to-Text for Animated Documentaries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10"
            id="close-auto-captions-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-4">
          {/* Audio Source / Language */}
          <div className="flex gap-2">
            <div className="flex-1 bg-[#222222] p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Sound Source</div>
                <div className="text-xs text-white font-medium">All Tracks Audio</div>
              </div>
            </div>
            <div className="flex-1 bg-[#222222] p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">Language</div>
                <div className="text-xs text-white font-medium">{language}</div>
              </div>
            </div>
          </div>

          {/* Caption Style Templates */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              Select Caption Preset Style
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Hormozi Style */}
              <button
                onClick={() => setSelectedStyle('hormozi')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  selectedStyle === 'hormozi'
                    ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400'
                    : 'border-white/10 bg-[#222222] hover:bg-[#282828]'
                }`}
                id="style-hormozi"
              >
                <span className="text-[11px] font-black text-amber-300 bg-black/70 px-1.5 py-0.5 rounded tracking-wide">
                  HORMOZI POP
                </span>
                <span className="text-[11px] text-white font-bold">
                  Word Highlight <span className="text-amber-400">⚡</span>
                </span>
                <span className="text-[9px] text-zinc-400">High retention bold uppercase</span>
              </button>

              {/* Documentary Style */}
              <button
                onClick={() => setSelectedStyle('documentary')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  selectedStyle === 'documentary'
                    ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400'
                    : 'border-white/10 bg-[#222222] hover:bg-[#282828]'
                }`}
                id="style-documentary"
              >
                <span className="text-[11px] font-serif italic text-zinc-200 bg-black/70 px-1.5 py-0.5 rounded">
                  Documentary
                </span>
                <span className="text-[11px] text-white font-medium">Cinematic Subtitles</span>
                <span className="text-[9px] text-zinc-400">Clean serif historical aesthetic</span>
              </button>

              {/* Bold Comic */}
              <button
                onClick={() => setSelectedStyle('bold-stroke')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  selectedStyle === 'bold-stroke'
                    ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400'
                    : 'border-white/10 bg-[#222222] hover:bg-[#282828]'
                }`}
                id="style-bold-stroke"
              >
                <span className="text-[11px] font-extrabold text-cyan-300 bg-black/70 px-1.5 py-0.5 rounded">
                  BOLD STROKE
                </span>
                <span className="text-[11px] text-white font-medium">Outlined Punch</span>
                <span className="text-[9px] text-zinc-400">Black contour high contrast</span>
              </button>

              {/* Karaoke Wave */}
              <button
                onClick={() => setSelectedStyle('karaoke')}
                className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                  selectedStyle === 'karaoke'
                    ? 'border-amber-400 bg-amber-500/15 ring-1 ring-amber-400'
                    : 'border-white/10 bg-[#222222] hover:bg-[#282828]'
                }`}
                id="style-karaoke"
              >
                <span className="text-[11px] font-semibold text-rose-300 bg-black/70 px-1.5 py-0.5 rounded">
                  KARAOKE
                </span>
                <span className="text-[11px] text-white font-medium">Flowing Glow</span>
                <span className="text-[9px] text-zinc-400">Smooth color fill progression</span>
              </button>
            </div>
          </div>

          {/* Progress Indicator while generating */}
          {isGenerating && (
            <div className="p-3 bg-[#202020] rounded-xl border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  Transcribing & aligning speech timestamps...
                </span>
                <span className="font-mono font-bold text-amber-400">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 bg-[#141414] border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg hover:bg-amber-300 active:scale-95 transition-transform disabled:opacity-50"
            id="generate-captions-submit-btn"
          >
            <Wand2 className="w-4 h-4" />
            <span>{isGenerating ? 'Generating...' : 'Generate Auto-Captions'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
