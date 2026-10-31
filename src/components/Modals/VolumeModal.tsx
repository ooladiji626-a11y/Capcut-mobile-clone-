import React, { useState } from 'react';
import { X, Volume2 } from 'lucide-react';

interface VolumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVolume: number;
  onSaveVolume: (vol: number) => void;
}

export const VolumeModal: React.FC<VolumeModalProps> = ({
  isOpen,
  onClose,
  currentVolume,
  onSaveVolume,
}) => {
  const [vol, setVol] = useState(currentVolume ?? 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-sm bg-[#181818] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Clip Volume</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center py-2">
          <span className="text-3xl font-black font-mono text-white">{vol}%</span>
        </div>

        <input
          type="range"
          min="0"
          max="200"
          step="5"
          value={vol}
          onChange={(e) => setVol(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400"
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSaveVolume(vol);
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 font-bold text-xs text-zinc-950"
          >
            Apply Volume
          </button>
        </div>
      </div>
    </div>
  );
};
