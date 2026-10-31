import React, { useRef, useState, useMemo } from 'react';
import { VideoClip } from '../../types';

interface VideoTrackProps {
  clips: VideoClip[];
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onTrimClip: (clipId: string, deltaStart: number, deltaEnd: number) => void;
  onOpenTransition: (fromClipIndex: number) => void;
  onReorderClips?: (fromIndex: number, toIndex: number) => void;
  pixelsPerSecond: number;
  visibleStartPx?: number;
  visibleEndPx?: number;
}

export const VideoTrack: React.FC<VideoTrackProps> = React.memo(({
  clips,
  selectedClipId,
  onSelectClip,
  onTrimClip,
  onOpenTransition,
  onReorderClips,
  pixelsPerSecond,
  visibleStartPx,
  visibleEndPx,
}) => {
  const [heldClipId, setHeldClipId] = useState<string | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);

  // Store drag state for trimming
  const trimDragRef = useRef<{
    clipId: string;
    handle: 'left' | 'right';
    startX: number;
    initialDuration: number;
  } | null>(null);

  // Store hold & reorder drag state
  const holdTimerRef = useRef<number | null>(null);
  const clipDragRef = useRef<{
    clipId: string;
    index: number;
    startX: number;
    startY: number;
    isHoldActive: boolean;
    hasMoved: boolean;
  } | null>(null);

  // Trimming Handlers
  const handleTrimPointerDown = (
    e: React.PointerEvent,
    clipId: string,
    handle: 'left' | 'right',
    duration: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    trimDragRef.current = {
      clipId,
      handle,
      startX: e.clientX,
      initialDuration: duration,
    };
  };

  const handleTrimPointerMove = (e: React.PointerEvent) => {
    if (!trimDragRef.current) return;
    const { clipId, handle, startX } = trimDragRef.current;
    const deltaPx = e.clientX - startX;
    if (Math.abs(deltaPx) < 1) return;
    trimDragRef.current.startX = e.clientX;
    const deltaSeconds = deltaPx / pixelsPerSecond;

    if (handle === 'left') {
      onTrimClip(clipId, deltaSeconds, 0);
    } else {
      onTrimClip(clipId, 0, deltaSeconds);
    }
  };

  const handleTrimPointerUp = (e: React.PointerEvent) => {
    if (trimDragRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      trimDragRef.current = null;
    }
  };

  // Hold & Drag Reorder Handlers (CapCut exact mechanic)
  const handleClipPointerDown = (e: React.PointerEvent, clipId: string, index: number) => {
    if ((e.target as HTMLElement).closest('.trim-handle') || (e.target as HTMLElement).closest('button')) {
      return;
    }

    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    clipDragRef.current = {
      clipId,
      index,
      startX: e.clientX,
      startY: e.clientY,
      isHoldActive: false,
      hasMoved: false,
    };
    setDragOffsetPx(0);

    // 240ms hold threshold
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      if (clipDragRef.current && !clipDragRef.current.hasMoved) {
        clipDragRef.current.isHoldActive = true;
        setHeldClipId(clipId);
        onSelectClip(clipId);
        try {
          if (navigator.vibrate) navigator.vibrate(35);
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
      if (dist > 7) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        clipDragRef.current.hasMoved = true;
      }
      return;
    }

    // Hold is active
    clipDragRef.current.hasMoved = true;
    setDragOffsetPx(deltaX);

    // Check if dragged far enough to swap with neighbor
    const curIdx = clipDragRef.current.index;
    const clipWidth = (clips[curIdx]?.duration || 1) * pixelsPerSecond;
    const threshold = Math.min(clipWidth * 0.5, 60);

    if (deltaX > threshold && curIdx < clips.length - 1) {
      // Move right
      onReorderClips?.(curIdx, curIdx + 1);
      clipDragRef.current.index = curIdx + 1;
      clipDragRef.current.startX = e.clientX;
      setDragOffsetPx(0);
      try {
        if (navigator.vibrate) navigator.vibrate(20);
      } catch {}
    } else if (deltaX < -threshold && curIdx > 0) {
      // Move left
      onReorderClips?.(curIdx, curIdx - 1);
      clipDragRef.current.index = curIdx - 1;
      clipDragRef.current.startX = e.clientX;
      setDragOffsetPx(0);
      try {
        if (navigator.vibrate) navigator.vibrate(20);
      } catch {}
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
      setDragOffsetPx(0);

      // If it was just a quick tap without drag, select/deselect
      if (!isHoldActive && !hasMoved) {
        onSelectClip(selectedClipId === clipId ? null : clipId);
      }
    }
  };

  // Viewport windowing: calculate start/end indices and exact spacer widths
  const { startIndex, endIndex, offsetBeforePx, offsetAfterPx } = useMemo(() => {
    if (typeof visibleStartPx !== 'number' || typeof visibleEndPx !== 'number' || clips.length === 0) {
      return {
        startIndex: 0,
        endIndex: clips.length - 1,
        offsetBeforePx: 0,
        offsetAfterPx: 0,
      };
    }

    let currentX = 0;
    let sIdx = -1;
    let eIdx = -1;

    for (let i = 0; i < clips.length; i++) {
      const clipWidth = Math.max(12, clips[i].duration * pixelsPerSecond);
      const clipStart = currentX;
      const clipEnd = currentX + clipWidth;
      currentX = clipEnd;

      // Clip is visible if its bounds intersect visible window, or if it is currently being held/dragged
      const isVisible = (clipEnd >= visibleStartPx && clipStart <= visibleEndPx) || clips[i].id === heldClipId;

      if (isVisible) {
        if (sIdx === -1) {
          sIdx = i;
        }
        eIdx = i;
      }
    }

    if (sIdx === -1) {
      return {
        startIndex: 0,
        endIndex: Math.min(clips.length - 1, 15),
        offsetBeforePx: 0,
        offsetAfterPx: 0,
      };
    }

    const beforePx = clips.slice(0, sIdx).reduce((acc, c) => acc + Math.max(12, c.duration * pixelsPerSecond), 0);
    const afterPx = clips.slice(eIdx + 1).reduce((acc, c) => acc + Math.max(12, c.duration * pixelsPerSecond), 0);

    return {
      startIndex: sIdx,
      endIndex: eIdx,
      offsetBeforePx: beforePx,
      offsetAfterPx: afterPx,
    };
  }, [clips, pixelsPerSecond, visibleStartPx, visibleEndPx, heldClipId]);

  const visibleClips = useMemo(() => {
    return clips.slice(startIndex, endIndex + 1);
  }, [clips, startIndex, endIndex]);

  return (
    <div
      className="h-16 relative flex items-center bg-[#141414] border-b border-white/5"
      id="main-video-track"
    >
      {/* Spacer block for non-visible clips before the window */}
      {offsetBeforePx > 0 && (
        <div
          style={{ width: `${offsetBeforePx}px`, height: '100%', flexShrink: 0 }}
          aria-hidden="true"
        />
      )}

      {visibleClips.map((clip, relIdx) => {
        const index = startIndex + relIdx;
        const isSelected = selectedClipId === clip.id;
        const isHeld = heldClipId === clip.id;
        const clipWidth = Math.max(12, clip.duration * pixelsPerSecond);
        const hasNextClip = index < clips.length - 1;

        return (
          <div
            key={clip.id}
            className={`relative flex items-center shrink-0 ${isHeld ? 'z-40' : 'z-10'}`}
          >
            {/* The Clip Element */}
            <div
              onPointerDown={(e) => handleClipPointerDown(e, clip.id, index)}
              onPointerMove={handleClipPointerMove}
              onPointerUp={(e) => handleClipPointerUp(e, clip.id)}
              onPointerCancel={(e) => handleClipPointerUp(e, clip.id)}
              className={`relative h-14 rounded-lg overflow-visible select-none transition-all duration-75 ${
                isHeld
                  ? 'ring-2 ring-yellow-400 scale-[1.03] shadow-xl cursor-grabbing touch-none'
                  : isSelected
                  ? 'ring-2 ring-white z-20 shadow-md cursor-pointer touch-pan-x'
                  : 'hover:brightness-110 cursor-pointer touch-pan-x'
              }`}
              style={{
                width: `${clipWidth}px`,
                backgroundColor: clip.color || '#2A59FE',
                transform: isHeld ? `translateX(${dragOffsetPx}px) scale(1.03)` : undefined,
              }}
              id={`video-clip-${clip.id}`}
            >
              {/* Visual Hold Indicator */}
              {isHeld && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-zinc-950 text-[8px] font-black px-2 py-0.2 rounded-full uppercase tracking-wider shadow pointer-events-none whitespace-nowrap z-50">
                  Hold & Drag Reorder
                </div>
              )}

              {/* Inner Filmstrip Frames */}
              <div className="absolute inset-0 rounded-lg overflow-hidden flex pointer-events-none">
                {(() => {
                  const validFrames = (clip.frames || []).filter((f) => f && typeof f === 'string' && f.trim() !== '');
                  if (validFrames.length > 0) {
                    return validFrames.map((frameImg, fIdx) => (
                      <div
                        key={fIdx}
                        className="h-full flex-1 min-w-[36px] relative overflow-hidden border-r border-white/10"
                      >
                        <img
                          src={frameImg}
                          alt="frame"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover pointer-events-none opacity-85"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
                      </div>
                    ));
                  }
                  if (clip.thumbnailUrl && clip.thumbnailUrl.trim() !== '') {
                    return (
                      <div className="w-full h-full relative overflow-hidden">
                        <img
                          src={clip.thumbnailUrl}
                          alt="clip"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover pointer-events-none opacity-85"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
                      </div>
                    );
                  }
                  return (
                    <div className="w-full h-full bg-[#2A59FE] opacity-90 flex items-center justify-center">
                      <span className="text-[10px] text-white/70 font-mono">Clip</span>
                    </div>
                  );
                })()}
              </div>

              {/* Clip Title and Duration Overlay */}
              <div className="absolute top-1 left-2 right-2 pointer-events-none flex items-center justify-between text-[10px] text-white font-medium drop-shadow-md z-10 truncate">
                <span className="truncate pr-1 flex items-center gap-1">
                  {clip.title}
                  {clip.speedSettings?.mode === 'curve' ? (
                    <span className="bg-blue-600/90 text-white text-[8px] font-bold px-1 rounded">
                      ⚡ Curve
                    </span>
                  ) : clip.speed && clip.speed !== 1.0 ? (
                    <span className="bg-blue-600/90 text-white text-[8px] font-bold px-1 rounded">
                      {clip.speed.toFixed(1)}x
                    </span>
                  ) : null}
                  {clip.filterPreset && clip.filterPreset !== 'none' && (
                    <span className="bg-amber-600/90 text-white text-[8px] font-bold px-1 rounded">
                      LUT
                    </span>
                  )}
                </span>
                <span className="font-mono text-[9px] bg-black/60 px-1 py-0.2 rounded text-zinc-200">
                  {clip.duration.toFixed(1)}s
                </span>
              </div>

              {/* CapCut Keyframe Diamond Markers */}
              {clip.keyframes && clip.keyframes.length > 0 && (
                <div className="absolute inset-x-0 bottom-1.5 h-3 pointer-events-none z-20">
                  {clip.keyframes.map((kf) => {
                    const posPercent = Math.max(0, Math.min(100, (kf.time / clip.duration) * 100));
                    return (
                      <div
                        key={kf.id}
                        className="absolute -translate-x-1/2 flex items-center justify-center"
                        style={{ left: `${posPercent}%` }}
                      >
                        <span className="text-[11px] font-black text-rose-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] select-none">
                          ◆
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Functional Trim Handles when Selected */}
              {isSelected && !isHeld && (
                <>
                  <div
                    onPointerDown={(e) => handleTrimPointerDown(e, clip.id, 'left', clip.duration)}
                    onPointerMove={handleTrimPointerMove}
                    onPointerUp={handleTrimPointerUp}
                    onPointerCancel={handleTrimPointerUp}
                    className="trim-handle absolute -left-2 top-0 bottom-0 w-4 bg-white rounded-l-[4px] shadow-md flex items-center justify-center cursor-ew-resize z-30 touch-none active:bg-zinc-200 border border-zinc-200"
                    style={{ backgroundColor: '#ffffff' }}
                    title="Trim clip start"
                    id={`handle-left-${clip.id}`}
                  >
                    <div className="w-[1.5px] h-4 bg-zinc-950 rounded-full pointer-events-none" />
                  </div>

                  <div
                    onPointerDown={(e) => handleTrimPointerDown(e, clip.id, 'right', clip.duration)}
                    onPointerMove={handleTrimPointerMove}
                    onPointerUp={handleTrimPointerUp}
                    onPointerCancel={handleTrimPointerUp}
                    className="trim-handle absolute -right-2 top-0 bottom-0 w-4 bg-white rounded-r-[4px] shadow-md flex items-center justify-center cursor-ew-resize z-30 touch-none active:bg-zinc-200 border border-zinc-200"
                    style={{ backgroundColor: '#ffffff' }}
                    title="Trim clip end"
                    id={`handle-right-${clip.id}`}
                  >
                    <div className="w-[1.5px] h-4 bg-zinc-950 rounded-full pointer-events-none" />
                  </div>
                </>
              )}
            </div>

            {/* CapCut Transition Cut Box [ | ] centered directly over seam between adjacent clips */}
            {hasNextClip && (
              <div className="w-0 overflow-visible flex items-center justify-center z-30 relative shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTransition(index);
                  }}
                  className={`absolute -translate-x-1/2 group rounded-[3px] flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                    clip.transitionAfter
                      ? 'w-5.5 h-5.5 bg-[#22d3ee] text-black ring-1 ring-cyan-400'
                      : 'w-5.5 h-5.5 bg-white text-zinc-950 border border-white hover:scale-110 active:bg-zinc-100'
                  }`}
                  style={!clip.transitionAfter ? { backgroundColor: '#ffffff', borderColor: '#ffffff' } : undefined}
                  title={
                    clip.transitionAfter
                      ? `Transition: ${clip.transitionAfter.name} (${clip.transitionAfter.duration}s)`
                      : 'Add Transition between clips'
                  }
                  id={`transition-cut-box-${index}`}
                >
                  {clip.transitionAfter ? (
                    <div className="flex flex-col items-center justify-center leading-none">
                      <span className="text-[9px] font-black leading-none">⧗</span>
                    </div>
                  ) : (
                    /* CapCut Classic [ | ] vertical cut line icon */
                    <div className="w-[1.5px] h-3 bg-zinc-950 rounded-full pointer-events-none" />
                  )}

                  {clip.transitionAfter && (
                    <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-black/90 text-cyan-300 font-mono text-[7.5px] px-1 rounded whitespace-nowrap font-bold pointer-events-none">
                      {clip.transitionAfter.duration.toFixed(1)}s
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Spacer block for non-visible clips after the window */}
      {offsetAfterPx > 0 && (
        <div
          style={{ width: `${offsetAfterPx}px`, height: '100%', flexShrink: 0 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
});
