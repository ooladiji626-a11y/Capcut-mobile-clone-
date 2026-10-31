import React, { useRef, useState, useMemo } from 'react';
import { AudioTrackClip } from '../../types';

interface AudioTrackProps {
  audioClips: AudioTrackClip[];
  selectedAudioId: string | null;
  onSelectAudio: (id: string | null) => void;
  onTrimAudio: (id: string, deltaStart: number, deltaEnd: number) => void;
  onMoveAudio?: (id: string, newStartTime: number) => void;
  pixelsPerSecond: number;
  isAutoDuckingActive?: boolean;
}

interface DiscreteWaveformProps {
  waveformData?: number[];
  width: number;
  isSelected?: boolean;
  category?: 'voiceover' | 'music' | 'sfx' | string;
}

/**
 * CapCut Discrete Symmetrical Waveform Renderer
 * Ultra-optimized GPU-accelerated SVG renderer using a single unified path.
 * Eliminates thousands of individual DOM divs for buttery-smooth 60fps scrolling.
 */
const DiscreteWaveform: React.FC<DiscreteWaveformProps> = React.memo(({
  waveformData = [],
  width,
  isSelected = false,
  category = 'music',
}) => {
  // Base bar width: 2.5px, Gap: 1px => baseStep = 3.5px
  const baseStep = 3.5;
  // Cap to max 350 bars to prevent GPU memory saturation on long tracks (e.g. 500s = 23,000px)
  const maxBars = 350;
  const step = Math.max(baseStep, (width - 8) / maxBars);
  const barWidth = Math.min(3, Math.max(2, step > 4 ? step * 0.6 : 2.5));
  const barCount = Math.max(3, Math.floor((width - 8) / step));

  const fillColor = useMemo(() => {
    if (isSelected) {
      if (category === 'voiceover') return '#c7d2fe';
      if (category === 'sfx') return '#fde68a';
      return '#6ee7b7';
    }
    if (category === 'voiceover') return '#818cf8';
    if (category === 'sfx') return '#f59e0b';
    return '#10b981';
  }, [isSelected, category]);

  const pathD = useMemo(() => {
    const rawData = waveformData.length > 0
      ? waveformData
      : [0.2, 0.4, 0.7, 0.9, 0.6, 0.8, 0.5, 0.3, 0.7, 0.5, 0.3];
    const dataLen = rawData.length;
    const centerY = 16; // 32px height container center
    let d = '';

    for (let i = 0; i < barCount; i++) {
      const progress = barCount > 1 ? i / (barCount - 1) : 0;
      const indexFloat = progress * (dataLen - 1);
      const idxLow = Math.floor(indexFloat);
      const idxHigh = Math.min(dataLen - 1, idxLow + 1);
      const frac = indexFloat - idxLow;

      const amp = (rawData[idxLow] || 0.2) * (1 - frac) + (rawData[idxHigh] || 0.2) * frac;
      const barHeight = Math.max(3, Math.min(26, amp * 26));
      const halfH = barHeight / 2;
      const x = 4 + i * step;
      const y = centerY - halfH;

      // Draw rounded rectangle bar in single path
      d += `M${x},${y + 1} Q${x},${y} ${x + 1},${y} H${x + barWidth - 1} Q${x + barWidth},${y} ${x + barWidth},${y + 1} V${y + barHeight - 1} Q${x + barWidth},${y + barHeight} ${x + barWidth - 1},${y + barHeight} H${x + 1} Q${x},${y + barHeight} ${x},${y + barHeight - 1} Z `;
    }
    return d;
  }, [waveformData, barCount, step, barWidth]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center">
      <svg
        width={width}
        height="32"
        className="w-full h-full pointer-events-none"
        style={{ display: 'block', willChange: 'transform' }}
      >
        <path
          d={pathD}
          fill={fillColor}
        />
      </svg>
    </div>
  );
});

export const AudioTrack: React.FC<AudioTrackProps> = React.memo(({
  audioClips,
  selectedAudioId,
  onSelectAudio,
  onTrimAudio,
  onMoveAudio,
  pixelsPerSecond,
  isAutoDuckingActive = true,
}) => {
  const [heldClipId, setHeldClipId] = useState<string | null>(null);

  const trimDragRef = useRef<{
    id: string;
    handle: 'left' | 'right';
    startX: number;
  } | null>(null);

  const holdTimerRef = useRef<number | null>(null);
  const clipDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    initialStartTime: number;
    isHoldActive: boolean;
    hasMoved: boolean;
  } | null>(null);

  // Handle Trimming (immediate on trim handles)
  const handleHandlePointerDown = (e: React.PointerEvent, id: string, handle: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    trimDragRef.current = {
      id,
      handle,
      startX: e.clientX,
    };
  };

  const handleHandlePointerMove = (e: React.PointerEvent) => {
    if (!trimDragRef.current) return;
    const { id, handle, startX } = trimDragRef.current;
    const deltaPixels = e.clientX - startX;
    if (Math.abs(deltaPixels) < 1) return;
    trimDragRef.current.startX = e.clientX;
    const deltaSeconds = deltaPixels / pixelsPerSecond;

    if (handle === 'left') {
      onTrimAudio(id, deltaSeconds, 0);
    } else {
      onTrimAudio(id, 0, deltaSeconds);
    }
  };

  const handleHandlePointerUp = (e: React.PointerEvent) => {
    if (trimDragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      trimDragRef.current = null;
    }
  };

  // Hold & Drag to Move (CapCut exact mechanic)
  const handleClipPointerDown = (e: React.PointerEvent, id: string, startTime: number) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return;

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    clipDragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialStartTime: startTime,
      isHoldActive: false,
      hasMoved: false,
    };

    // 240ms hold threshold to activate drag-to-move mode
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (clipDragRef.current && !clipDragRef.current.hasMoved) {
        clipDragRef.current.isHoldActive = true;
        setHeldClipId(id);
        onSelectAudio(id);
        try {
          if (navigator.vibrate) navigator.vibrate(30);
        } catch {}
      }
    }, 240);
  };

  const handleClipPointerMove = (e: React.PointerEvent) => {
    if (!clipDragRef.current) return;

    const deltaX = e.clientX - clipDragRef.current.startX;
    const deltaY = e.clientY - clipDragRef.current.startY;
    const dist = Math.hypot(deltaX, deltaY);

    if (!clipDragRef.current.isHoldActive) {
      // If moved before hold timer finished, cancel hold (user is swiping/scrolling)
      if (dist > 7) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        clipDragRef.current.hasMoved = true;
      }
      return;
    }

    // Hold is active: move the audio clip
    clipDragRef.current.hasMoved = true;
    if (onMoveAudio) {
      const deltaSeconds = deltaX / pixelsPerSecond;
      const newStart = Math.max(0, clipDragRef.current.initialStartTime + deltaSeconds);
      onMoveAudio(clipDragRef.current.id, newStart);
    }
  };

  const handleClipPointerUp = (e: React.PointerEvent, clipId: string) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    if (clipDragRef.current) {
      const { isHoldActive, hasMoved } = clipDragRef.current;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      clipDragRef.current = null;
      setHeldClipId(null);

      // If it wasn't a hold-and-drag and didn't move, it's a tap
      if (!isHoldActive && !hasMoved) {
        onSelectAudio(selectedAudioId === clipId ? null : clipId);
      }
    }
  };

  // Group audio clips into collision-free stacked lanes
  const lanes: AudioTrackClip[][] = [];
  const sortedClips = [...audioClips].sort((a, b) => a.startTime - b.startTime);

  for (const item of sortedClips) {
    let placed = false;
    for (const lane of lanes) {
      const lastInLane = lane[lane.length - 1];
      if (item.startTime >= lastInLane.startTime + lastInLane.duration - 0.05) {
        lane.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
    }
  }

  const effectiveLanes = lanes.length > 0 ? lanes : [audioClips];

  return (
    <div className="flex flex-col border-b border-white/5 bg-[#121212]" id="audio-multi-tracks">
      {effectiveLanes.map((lane, laneIdx) => (
        <div
          key={`audio-lane-${laneIdx}`}
          className="h-10 relative border-b border-white/5 last:border-b-0 flex items-center bg-[#0c1a1f]"
        >
          {lane.map((clip) => {
            const isSelected = selectedAudioId === clip.id;
            const isHeld = heldClipId === clip.id;
            const leftPos = clip.startTime * pixelsPerSecond;
            const width = Math.max(42, clip.duration * pixelsPerSecond);
            const category = clip.category || (clip.trackIndex === 1 ? 'voiceover' : clip.trackIndex === 3 ? 'sfx' : 'music');

            let cardStyles = 'bg-[#062c23] hover:bg-[#093c30] border-emerald-900/80 z-10 cursor-pointer touch-pan-x';
            let dotColor = '#10b981';
            let tagBadge = { label: 'BGM', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700/50' };

            if (category === 'voiceover') {
              dotColor = isSelected ? '#a5b4fc' : '#818cf8';
              tagBadge = { label: 'VO', bg: 'bg-indigo-950/80', text: 'text-indigo-300', border: 'border-indigo-700/50' };
              cardStyles = isHeld
                ? 'z-40 scale-[1.04] ring-2 ring-indigo-400 bg-[#282161] border-indigo-400 shadow-xl cursor-grabbing touch-none'
                : isSelected
                ? 'ring-2 ring-indigo-300 bg-[#201a52] border-indigo-400 z-20 shadow-md cursor-pointer touch-pan-x'
                : 'bg-[#151233] hover:bg-[#1c1844] border-indigo-950/90 z-10 cursor-pointer touch-pan-x';
            } else if (category === 'sfx') {
              dotColor = isSelected ? '#fde68a' : '#f59e0b';
              tagBadge = { label: 'SFX', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-700/50' };
              cardStyles = isHeld
                ? 'z-40 scale-[1.04] ring-2 ring-amber-400 bg-[#542104] border-amber-400 shadow-xl cursor-grabbing touch-none'
                : isSelected
                ? 'ring-2 ring-amber-300 bg-[#421b05] border-amber-400 z-20 shadow-md cursor-pointer touch-pan-x'
                : 'bg-[#291204] hover:bg-[#381805] border-amber-950/90 z-10 cursor-pointer touch-pan-x';
            } else {
              dotColor = isSelected ? '#6ee7b7' : '#10b981';
              cardStyles = isHeld
                ? 'z-40 scale-[1.04] ring-2 ring-emerald-400 bg-[#094738] border-emerald-400 shadow-xl cursor-grabbing touch-none'
                : isSelected
                ? 'ring-2 ring-emerald-300 bg-[#073b2e] border-emerald-400 z-20 shadow-md cursor-pointer touch-pan-x'
                : 'bg-[#06241d] hover:bg-[#093026] border-emerald-950/90 z-10 cursor-pointer touch-pan-x';
            }

            return (
              <div
                key={clip.id}
                onPointerDown={(e) => handleClipPointerDown(e, clip.id, clip.startTime)}
                onPointerMove={handleClipPointerMove}
                onPointerUp={(e) => handleClipPointerUp(e, clip.id)}
                onPointerCancel={(e) => handleClipPointerUp(e, clip.id)}
                className={`absolute top-0.5 bottom-0.5 rounded-[4px] flex items-center select-none transition-transform duration-75 overflow-hidden border ${cardStyles}`}
                style={{
                  left: `${leftPos}px`,
                  width: `${width}px`,
                }}
                id={`audio-clip-${clip.id}`}
              >
                {/* Visual Hold Lift Hint */}
                {isHeld && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-zinc-950 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shadow pointer-events-none whitespace-nowrap z-30">
                    Moving {clip.startTime.toFixed(1)}s
                  </div>
                )}

                {/* CapCut Symmetrical Discrete Waveform Bars */}
                <DiscreteWaveform
                  waveformData={clip.waveformData}
                  width={width}
                  isSelected={isSelected || isHeld}
                  category={category}
                />

                {/* Clip Name Label Pill */}
                <div className="relative z-10 px-2 py-0.5 pointer-events-none flex items-center gap-1.5 bg-black/70 backdrop-blur-xs rounded-sm mx-1 border border-white/10 shadow-sm max-w-[calc(100%-8px)]">
                  <span className={`text-[8px] font-extrabold px-1 py-0.2 rounded border ${tagBadge.bg} ${tagBadge.text} ${tagBadge.border}`}>
                    {tagBadge.label}
                  </span>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="text-[10px] font-bold text-white tracking-wide truncate">
                    {clip.title}
                  </span>
                  {category === 'music' && isAutoDuckingActive && width > 90 && (
                    <span className="text-[7.5px] font-semibold text-emerald-300/90 bg-emerald-950/80 px-1 rounded border border-emerald-600/30 whitespace-nowrap ml-1">
                      Duck: 18%/70%
                    </span>
                  )}
                </div>

                {/* Beat Markers */}
                {clip.beatMarkers &&
                  clip.beatMarkers.map((marker, bIdx) => {
                    const beatTime = typeof marker === 'number' ? marker : marker.time;
                    const isDownbeat = typeof marker === 'number' ? false : marker.isDownbeat;

                    if (beatTime < clip.duration) {
                      return (
                        <div
                          key={bIdx}
                          className={`absolute bottom-0 w-1.5 h-1.5 rounded-full pointer-events-none -translate-x-1/2 ${
                            isDownbeat ? 'bg-rose-500 scale-125 z-20' : 'bg-amber-400 z-10'
                          }`}
                          style={{ left: `${beatTime * pixelsPerSecond}px` }}
                        />
                      );
                    }
                    return null;
                  })}

                {/* CapCut Solid White Trimming Handles */}
                {isSelected && !isHeld && (
                  <>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, clip.id, 'left')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute left-0 top-0 bottom-0 w-3.5 bg-white flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
                      style={{ backgroundColor: '#ffffff' }}
                    >
                      <div className="w-[1.5px] h-2.5 bg-zinc-950 rounded-full pointer-events-none" />
                    </div>
                    <div
                      onPointerDown={(e) => handleHandlePointerDown(e, clip.id, 'right')}
                      onPointerMove={handleHandlePointerMove}
                      onPointerUp={handleHandlePointerUp}
                      onPointerCancel={handleHandlePointerUp}
                      className="trim-handle absolute right-0 top-0 bottom-0 w-3.5 bg-white flex items-center justify-center cursor-ew-resize z-30 touch-none shadow-sm"
                      style={{ backgroundColor: '#ffffff' }}
                    >
                      <div className="w-[1.5px] h-2.5 bg-zinc-950 rounded-full pointer-events-none" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
