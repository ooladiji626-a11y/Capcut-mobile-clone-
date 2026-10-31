import React from 'react';
import { Volume2, VolumeX, Image as ImageIcon, Type, Music, Layers } from 'lucide-react';

interface TrackHeadersProps {
  isMuted: boolean;
  onToggleMute: () => void;
  coverThumbnail: string;
  onOpenCoverPicker: () => void;
  hasCaptions: boolean;
  hasAudio: boolean;
  hasOverlay: boolean;
  overlayLaneCount?: number;
}

export const TrackHeaders: React.FC<TrackHeadersProps> = React.memo(({
  isMuted,
  onToggleMute,
  coverThumbnail,
  onOpenCoverPicker,
  hasCaptions,
  hasAudio,
  hasOverlay,
  overlayLaneCount = 1,
}) => {
  const lanesToRender = Math.max(1, overlayLaneCount);

  return (
    <div
      className="sticky left-0 top-0 bottom-0 z-30 flex flex-col pointer-events-auto bg-[#121212]/95 backdrop-blur-md border-r border-white/10 shadow-[4px_0_12px_rgba(0,0,0,0.6)] select-none"
      style={{ width: '84px', minWidth: '84px' }}
      id="pinned-track-headers"
    >
      {/* Top Ruler spacer */}
      <div className="h-6 border-b border-white/10 flex items-center justify-center bg-[#181818]">
        <span className="text-[9px] font-medium tracking-wider text-zinc-500 uppercase">TRACKS</span>
      </div>

      {/* 1. Main Video Track Header (Cover + Mute clip audio) */}
      <div className="h-16 px-1.5 py-1.5 flex items-center gap-1.5 border-b border-white/5 bg-[#141414]">
        {/* Cover Selector Button */}
        <button
          onClick={onOpenCoverPicker}
          className="relative flex-1 h-full rounded bg-[#1e1e1e] border border-white/15 overflow-hidden flex flex-col items-center justify-center hover:border-white/40 active:scale-95 transition-all group"
          title="Edit Video Cover"
          id="cover-selector-btn"
        >
          {coverThumbnail && coverThumbnail.trim() !== '' ? (
            <img
              src={coverThumbnail}
              alt="Cover"
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              referrerPolicy="no-referrer"
            />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-zinc-400 mb-0.5" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-0.5">
            <span className="text-[8px] font-semibold text-white tracking-tight drop-shadow-md">Cover</span>
          </div>
        </button>

        {/* Mute Audio Toggle Button */}
        <button
          onClick={onToggleMute}
          className={`h-full w-8 rounded flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 border ${
            isMuted
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              : 'bg-[#1e1e1e] border-white/15 text-zinc-300 hover:text-white hover:border-white/40'
          }`}
          title={isMuted ? 'Unmute Audio' : 'Mute Clip Audio'}
          id="mute-track-btn"
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
          )}
          <span className="text-[7px] font-medium leading-none text-center">
            {isMuted ? 'Muted' : 'Mute'}
          </span>
        </button>
      </div>

      {/* 2. Overlay Track Headers (Directly under Main Video Track, with stacked layers) */}
      {hasOverlay &&
        Array.from({ length: lanesToRender }).map((_, idx) => (
          <div
            key={`overlay-header-${idx}`}
            className="h-12 px-2 flex items-center gap-1.5 border-b border-white/5 bg-[#161616]"
          >
            <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-2.5 h-2.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-semibold text-zinc-300 uppercase tracking-tight">
                {lanesToRender > 1 ? `Overlay ${idx + 1}` : 'Overlay'}
              </span>
            </div>
          </div>
        ))}

      {/* 3. Audio Track Header (Waveform / Beat sync) */}
      {hasAudio && (
        <div className="h-11 px-2 flex items-center gap-1.5 border-b border-white/5 bg-[#161616]">
          <div className="w-4 h-4 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-300">
            <Music className="w-2.5 h-2.5" />
          </div>
          <span className="text-[8px] font-semibold text-zinc-400 uppercase tracking-tight">Audio</span>
        </div>
      )}

      {/* 4. Text / Captions Track Header */}
      {hasCaptions && (
        <div className="h-9 px-2 flex items-center gap-1.5 border-b border-white/5 bg-[#161616]">
          <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center text-amber-300">
            <Type className="w-2.5 h-2.5" />
          </div>
          <span className="text-[8px] font-semibold text-zinc-400 uppercase tracking-tight">Text</span>
        </div>
      )}
    </div>
  );
});
