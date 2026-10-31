import React, { useState } from 'react';
import { VideoClip } from '../../types';
import { X, Check, Image as ImageIcon, Sparkles } from 'lucide-react';

interface CoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoClips: VideoClip[];
  currentCover: string;
  onSaveCover: (coverUrl: string) => void;
}

export const CoverModal: React.FC<CoverModalProps> = ({
  isOpen,
  onClose,
  videoClips,
  currentCover,
  onSaveCover,
}) => {
  const [selectedThumb, setSelectedThumb] = useState(currentCover);

  if (!isOpen) return null;

  // Gather all frame images from clips, filtering out invalid/empty strings
  const allFrames = videoClips
    .flatMap((c) => (c.frames && c.frames.length > 0 ? c.frames : [c.thumbnailUrl]))
    .filter((f): f is string => Boolean(f && typeof f === 'string' && f.trim() !== ''));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#181818] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-zinc-300" />
            <h3 className="text-sm font-semibold text-white">Select Video Cover</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Active Preview */}
          <div className="w-full h-44 rounded-xl bg-black overflow-hidden relative border border-white/15 shadow-inner flex items-center justify-center">
            {selectedThumb && selectedThumb.trim() !== '' ? (
              <img
                src={selectedThumb}
                alt="Selected Cover"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-xs text-zinc-500">No cover selected</span>
            )}
            <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-semibold uppercase">
              Cover Preview
            </div>
          </div>

          {/* Select from Timeline Frames */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">
              Choose from Timeline Frames
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
              {allFrames.map((frame, idx) => {
                const isSelected = selectedThumb === frame;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedThumb(frame)}
                    className={`h-16 rounded-lg overflow-hidden border transition-all relative ${
                      isSelected
                        ? 'border-white ring-2 ring-white scale-95 shadow-md'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img
                      src={frame}
                      alt="frame"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-[#141414] border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSaveCover(selectedThumb);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow hover:bg-zinc-200"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Set as Cover</span>
          </button>
        </div>
      </div>
    </div>
  );
};
